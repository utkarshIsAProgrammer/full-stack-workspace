import type { Request, Response } from "express";
import mongoose from "mongoose";
import Post from "../models/post.model";
import Notification from "../models/notification.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { AppError, BadRequestError, UnauthorizedError } from "../utilities/errors";
import { clearFeedCache } from "../configs/cache";
import { logger } from "../utilities/logger";

/**
 * POST /api/posts/bulk-delete — Delete multiple posts by IDs.
 */
export const bulkDeletePosts = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const { postIds } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      throw new BadRequestError("postIds array is required!");
    }
    if (postIds.length > 50) throw new BadRequestError("Maximum 50 posts at a time!");

    const validIds = postIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    const result = await Post.deleteMany({
      _id: { $in: validIds },
      author: currentUserId,
    });

    await clearFeedCache();

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} post(s) deleted!`,
      deletedCount: result.deletedCount,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in bulkDeletePosts", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/notifications/bulk-read — Mark multiple notifications as read.
 */
export const bulkReadNotifications = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const { notificationIds } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new BadRequestError("notificationIds array is required!");
    }

    const validIds = notificationIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
    const result = await Notification.updateMany(
      { _id: { $in: validIds }, recipient: currentUserId },
      { $set: { isRead: true } },
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read!`,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in bulkReadNotifications", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/chats/bulk-delete — Delete multiple conversations.
 */
export const bulkDeleteConversations = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const { conversationIds } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      throw new BadRequestError("conversationIds array is required!");
    }

    const validIds = conversationIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    // Delete messages in these conversations
    await Message.deleteMany({ conversation: { $in: validIds } });

    // Delete conversations where the user is a participant
    const result = await Conversation.deleteMany({
      _id: { $in: validIds },
      participants: currentUserId,
    });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} conversation(s) deleted!`,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in bulkDeleteConversations", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
