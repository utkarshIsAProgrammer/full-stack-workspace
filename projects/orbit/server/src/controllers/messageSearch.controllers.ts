import { Request, Response } from "express";
import mongoose from "mongoose";
import { Message } from "../models/message.model";
import { Conversation } from "../models/conversation.model";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";

/**
 * Search messages within a conversation.
 * GET /api/chats/:conversationId/search?q=<query>
 */
export const searchMessages = async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const query = (req.query.q as string)?.trim();
    const currentUserId = req.user?._id?.toString();

    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!query) return res.status(400).json({ success: false, message: "Search query required" });
    if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new BadRequestError("Invalid conversation ID!");

    // Verify user is a participant
    const conversation = await Conversation.findById(conversationId as any).select("participants").lean();
    if (!conversation) throw new NotFoundError("Conversation not found!");
    if (!conversation.participants.some((p: any) => p.toString() === currentUserId)) {
      throw new BadRequestError("Not a participant of this conversation!");
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Pagination
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const searchQuery: any = {
      conversation: conversationId,
      text: { $regex: escapedQuery, $options: "i" },
      deletedFor: { $ne: currentUserId },
    };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      searchQuery._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    // Search messages using text index (case-insensitive regex fallback)
    const messages = await Message.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("sender", "username fullName profilePic")
      .lean();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }
    const nextCursor = messages.slice(-1).shift()?._id || null;

    return res.status(200).json({ success: true, messages, count: messages.length, hasMore, nextCursor });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Message search error", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
