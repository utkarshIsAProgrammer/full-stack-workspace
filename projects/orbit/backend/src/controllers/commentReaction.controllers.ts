import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import Comment from "../models/comment.model";
import { BadRequestError, NotFoundError } from "../utilities/errors";
import { emitCommentReaction } from "../configs/socket";
import { createNotification } from "../utilities/notification";
import { logger } from "../utilities/logger";

export const toggleCommentReaction = async (
  req: Request<{ commentId: string }>,
  res: Response,
  next: NextFunction,
) => {
  const { commentId } = req.params;
  const { emoji } = req.body;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new BadRequestError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return next(new BadRequestError("Invalid comment ID!"));
    }

    if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
      return next(new BadRequestError("Emoji is required!"));
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return next(new NotFoundError("Comment not found!"));
    }

    const userIdStr = currentUserId.toString();
    const existingIndex = (comment.reactions || []).findIndex(
      (r) => (r.sender?._id || r.sender)?.toString() === userIdStr && r.emoji === emoji.trim(),
    );

    let type: "add" | "remove" = "add";

    if (existingIndex >= 0) {
      // Remove all existing reactions by this user (toggle off)
      comment.reactions = comment.reactions!.filter(
        (r) => (r.sender?._id || r.sender)?.toString() !== userIdStr
      ) as any;
      type = "remove";
    } else {
      // Remove any previous reaction by this user (replace), then add new one
      comment.reactions = comment.reactions!.filter(
        (r) => (r.sender?._id || r.sender)?.toString() !== userIdStr
      ) as any;
      comment.reactions!.push({
        emoji: emoji.trim(),
        sender: currentUserId,
        createdAt: new Date(),
      });
    }

    await comment.save();

    // Populate sender info for socket event and client response
    const populatedComment = await Comment.findById(comment._id)
      .populate("reactions.sender", "username fullName profilePic")
      .lean();

    // Find the reaction for the socket event
    let populatedReaction = null;
    if (type === "add" && populatedComment?.reactions) {
      const populatedReactions = populatedComment.reactions as any[];
      populatedReaction = populatedReactions.find(
        (r: any) => r.sender?._id?.toString() === userIdStr && r.emoji === emoji.trim(),
      );
    } else if (type === "remove") {
      // Send minimal data so client can remove the reaction from local state
      populatedReaction = { emoji: emoji.trim(), sender: { _id: userIdStr } } as any;
    }

    // Emit socket event to update comment reactions in realtime
    emitCommentReaction(commentId, {
      reaction: populatedReaction || null,
      type,
    });

    // Create notification when a reaction is added
    if (type === "add") {
      const commentAuthor = comment.author.toString();
      const postId = comment.post ? comment.post.toString() : null;
      await createNotification({
        recipient: commentAuthor,
        sender: currentUserId.toString(),
        type: "reaction",
        post: postId,
        comment: commentId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Comment reaction updated successfully!",
      reactions: populatedComment?.reactions || [],
    });
  } catch (err: any) {
    logger.error("Error in toggleCommentReaction controller", { error: err.message });
    return next(err);
  }
};
