import mongoose from "mongoose";
import type { Request, Response } from "express";
import Glimpse from "../models/glimpse.model";
import cloudinary from "../configs/cloudinary";
import { AppError, BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../utilities/errors";
import { logger } from "../utilities/logger";
import { getIO } from "../configs/socket";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { createNotification } from "../utilities/notification";

// Get glimpse feed for the current user
// Returns non-expired glimpses that still have remaining views
export const getGlimpseFeed = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id?.toString();

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const now = new Date();
    // Return all non-expired glimpses
    const glimpses = await Glimpse.find({
      expiresAt: { $gt: now },
    })
      .populate("author", "username fullName profilePic")
      .populate("viewers.user", "username fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean({ virtuals: true });

    // Enrich with per-user view status
    const enriched = glimpses.map((g) => ({
      ...g,
      viewedByMe: (g.viewers || []).some(
        (v: any) => v.user?.toString() === currentUserId
      ),
    }));

    return res.status(200).json({
      success: true,
      glimpses: enriched,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getGlimpseFeed controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Create a new glimpse
export const createGlimpse = async (req: Request, res: Response) => {
  const author = req.user?._id;

  try {
    if (!author) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const file = req.file;
    if (!file) {
      throw new BadRequestError("Media is required for a glimpse!");
    }

    const isVideo = file.mimetype.startsWith("video/");

    // Validate video duration from Cloudinary response
    if (isVideo && (file as any).duration) {
      const durationInSeconds = (file as any).duration;
      if (durationInSeconds > 60) {
        // Delete the uploaded file from Cloudinary
        cloudinary.uploader.destroy((file as any).filename, { resource_type: "video" }).catch(() => {});
        throw new BadRequestError("Video duration must not exceed 1 minute!");
      }
    }

    const glimpse = new Glimpse({
      author,
      media: {
        url: file.path,
        public_id: (file as any).filename,
      },
      mediaType: isVideo ? "video" : "image",
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });

    await glimpse.save();

    const populated = await Glimpse.findById(glimpse._id)
      .populate("author", "username fullName profilePic")
      .populate("viewers.user", "username fullName profilePic")
      .lean({ virtuals: true });

    const enrichedGlimpse = {
      ...populated,
      viewedByMe: false,
    };

    // Broadcast via socket
    try {
      const io = getIO();
      io.emit("glimpse:created", enrichedGlimpse);
    } catch (socketErr: any) {
      logger.warn("Failed to broadcast glimpse:created via socket", {
        error: socketErr.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Glimpse created successfully!",
      glimpse: enrichedGlimpse,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in createGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Helper: delete a glimpse and clean up Cloudinary image
const deleteGlimpseAndCleanup = async (glimpse: any) => {
  if (glimpse?.media?.public_id) {
    const resourceType = glimpse.mediaType === "video" ? "video" : "image";
    cloudinary.uploader.destroy(glimpse.media.public_id, { resource_type: resourceType }).catch((err: any) => {
      logger.warn("Failed to delete Cloudinary media for glimpse", {
        error: err?.message,
        public_id: glimpse.media.public_id,
      });
    });
  }
  await Glimpse.findByIdAndDelete(glimpse._id);
};

// Mark a glimpse as viewed by the current user
// Uses atomic findOneAndUpdate to prevent race conditions on the 2-viewer limit
export const viewGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    // Check if already viewed (lightweight read-only check)
    const existingGlimpse = await Glimpse.findById(glimpseId).select("author viewers expiresAt media");
    if (!existingGlimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    if (existingGlimpse.expiresAt < new Date()) {
      await deleteGlimpseAndCleanup(existingGlimpse);
      try { getIO().emit("glimpse:expired", { glimpseId }); } catch {}
      throw new BadRequestError("Glimpse has expired!");
    }

    // Prevent the author from being recorded as a viewer of their own glance
    const isAuthorViewing = existingGlimpse.author?.toString() === currentUserId;
    if (isAuthorViewing) {
      return res.status(200).json({
        success: true,
        message: "Authors cannot view their own glance!",
        isAuthor: true,
      });
    }

    const alreadyViewed = existingGlimpse.viewers.some(
      (v: any) => v.user?.toString() === currentUserId
    );
    if (alreadyViewed) {
      return res.status(200).json({
        success: true,
        message: "Already viewed!",
        alreadyViewed: true,
      });
    }

    // Add viewer to the glimpse (no view limit anymore — just record who viewed)
    const updatedGlimpse = await Glimpse.findByIdAndUpdate(
      glimpseId,
      {
        $addToSet: {
          viewers: {
            user: new mongoose.Types.ObjectId(String(currentUserId)),
            viewedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedGlimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    const viewers = updatedGlimpse.viewers.map((v: any) => ({
      user: v.user?.toString() || "",
      viewedAt: v.viewedAt,
    }));

    // Socket broadcasts
    try {
      const io = getIO();
      io.emit("glimpse:viewed", {
        glimpseId,
        viewerId: currentUserId,
        viewers,
      });
    } catch (socketErr: any) {
      logger.warn("Failed to emit glimpse socket events", {
        error: socketErr.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Glimpse viewed!",
      alreadyViewed: false,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in viewGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Get a single glimpse by ID
export const getGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    const glimpse = await Glimpse.findById(glimpseId)
      .populate("author", "username fullName profilePic")
      .lean({ virtuals: true });

    if (!glimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    const enriched = {
      ...glimpse,
      viewedByMe: (glimpse.viewers || []).some(
        (v: any) => v.user?.toString() === currentUserId
      ),

    };

    return res.status(200).json({
      success: true,
      glimpse: enriched,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// React to a glimpse (like/emoji reaction)
export const reactToGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");
  const { emoji } = req.body;

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    if (!emoji || typeof emoji !== "string") {
      throw new BadRequestError("Emoji is required!");
    }

    const glimpse = await Glimpse.findById(glimpseId);
    if (!glimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    // Check if user already reacted with this emoji
    const existingIdx = glimpse.reactions?.findIndex(
      (r) => r.user.toString() === currentUserId
    );

    let action: "added" | "removed";

    if (existingIdx !== undefined && existingIdx >= 0) {
      // Remove existing reaction (toggle off)
      glimpse.reactions!.splice(existingIdx, 1);
      action = "removed";
    } else {
      // Add new reaction
      glimpse.reactions!.push({
        user: new mongoose.Types.ObjectId(String(currentUserId)),
        emoji,
        createdAt: new Date(),
      } as any);
      action = "added";
    }

    await glimpse.save();

    // Broadcast via socket
    try {
      getIO().emit("glimpse:reacted", {
        glimpseId,
        userId: currentUserId,
        emoji,
        action,
        reactionsCount: glimpse.reactions?.length || 0,
      });
    } catch (socketErr: any) {
      logger.warn("Failed to emit glimpse:reacted socket event", { error: socketErr.message });
    }

    // Create notification for the author (only if reaction was added)
    try {
      const authorId = glimpse.author?.toString();
      if (authorId && action === "added" && authorId !== currentUserId) {
        await createNotification({
          recipient: authorId,
          sender: currentUserId,
          type: "glimpse_reaction",
          glimpse: glimpseId,
        });
      }
    } catch (notifErr: any) {
      logger.warn("Failed to create glimpse reaction notification", { error: notifErr.message });
    }

    return res.status(200).json({
      success: true,
      message: action === "added" ? "Reaction added!" : "Reaction removed!",
      action,
      reactionsCount: glimpse.reactions?.length || 0,
      reactions: glimpse.reactions,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in reactToGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Reply to a glimpse (creates a conversation + sends a message with the glimpse as an attachment)
export const replyToGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");
  const { text } = req.body;

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    const glimpse = await Glimpse.findById(glimpseId)
      .populate("author", "_id username fullName profilePic")
      .lean({ virtuals: true });
    if (!glimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    const authorId = glimpse.author?._id?.toString();
    if (!authorId) {
      throw new BadRequestError("Glimpse author not found!");
    }

    // Don't allow replying to your own glimpse
    if (authorId === currentUserId) {
      throw new BadRequestError("Cannot reply to your own glimpse!");
    }

    // Find existing conversation between these two users, or create a new one
    let conversation = await Conversation.findOne({
      participants: { $all: [
        new mongoose.Types.ObjectId(String(currentUserId)),
        new mongoose.Types.ObjectId(authorId),
      ]},
      type: { $ne: "group" },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [
          new mongoose.Types.ObjectId(String(currentUserId)),
          new mongoose.Types.ObjectId(authorId),
        ],
        unreadCounts: new Map(),
      });
      await conversation.save();
    }

    // Create a message with the glimpse attached
    const message = new Message({
      conversation: conversation._id,
      sender: new mongoose.Types.ObjectId(String(currentUserId)),
      recipient: new mongoose.Types.ObjectId(authorId),
      text: typeof text === "string" ? text : "",
      attachments: [{
        url: glimpse.media?.url || "",
        public_id: glimpse.media?.public_id || "",
        type: glimpse.mediaType === "video" ? "video" : "image",
      }],
      seen: false,
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username fullName profilePic")
      .lean();

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      updatedAt: new Date(),
      $inc: { [`unreadCounts.${authorId}`]: 1 },
    });

    // Broadcast to conversation
    try {
      const io = getIO();
      io.to(`conversation:${conversation._id}`).emit("message:new", populatedMessage);
      
      // Also notify the author if they're not in the conversation
      io.to(`user:${authorId}`).emit("chat:notification", {
        conversationId: conversation._id,
        message: populatedMessage,
        unreadCount: 1,
      });
    } catch (socketErr: any) {
      logger.warn("Failed to emit glimpse reply socket events", { error: socketErr.message });
    }

    // Create notification for the author
    try {
      await createNotification({
        recipient: authorId,
        sender: currentUserId,
        type: "glimpse_reply",
        glimpse: glimpseId,
      });
    } catch (notifErr: any) {
      logger.warn("Failed to create glimpse reply notification", { error: notifErr.message });
    }

    return res.status(200).json({
      success: true,
      message: "Reply sent!",
      conversation,
      sentMessage: populatedMessage,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in replyToGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Delete a glimpse (either by author, or because it has been fully viewed and closed)
export const deleteGlimpse = async (req: Request, res: Response) => {
  const glimpseId = req.params.glimpseId as string;
  const currentUserId = String(req.user?._id || "");

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(glimpseId)) {
      throw new BadRequestError("Invalid glimpse ID!");
    }

    const glimpse = await Glimpse.findById(glimpseId);
    if (!glimpse) {
      throw new NotFoundError("Glimpse not found!");
    }

    const isAuthor = glimpse.author.toString() === currentUserId;
    // Only allow deletion if the requester is the author
    if (!isAuthor) {
      throw new ForbiddenError("You are not authorized to delete this glance!");
    }

    await deleteGlimpseAndCleanup(glimpse);

    // Broadcast socket event to all clients so they can animate deletion in real-time
    try {
      getIO().emit("glimpse:expired", { glimpseId });
    } catch (socketErr: any) {
      logger.warn("Failed to emit glimpse:expired socket event", { error: socketErr.message });
    }

    return res.status(200).json({
      success: true,
      message: "Glimpse deleted successfully!",
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in deleteGlimpse controller!", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
