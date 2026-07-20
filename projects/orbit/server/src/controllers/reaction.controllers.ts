import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { Message } from "../models/message.model";
import { Conversation } from "../models/conversation.model";
import { BadRequestError, NotFoundError, ForbiddenError } from "../utilities/errors";
import { emitMessageReaction } from "../configs/socket";
import { createNotification } from "../utilities/notification";
import { logger } from "../utilities/logger";

export const toggleReaction = async (
  req: Request<{ messageId: string }>,
  res: Response,
  next: NextFunction,
) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new BadRequestError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return next(new BadRequestError("Invalid message ID!"));
    }

    if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
      return next(new BadRequestError("Emoji is required!"));
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return next(new NotFoundError("Message not found!"));
    }

    if (message.isDeleted) {
      return next(new BadRequestError("Cannot react to a deleted message!"));
    }

    const conversation = await Conversation.findById(message.conversation).select("participants").lean();
    if (!conversation) {
      return next(new NotFoundError("Conversation not found!"));
    }
    const isParticipant = (conversation.participants || []).some(
      (p: any) => p.toString() === currentUserId.toString()
    );
    if (!isParticipant) {
      return next(new ForbiddenError("You are not a participant in this conversation!"));
    }

    const userIdStr = currentUserId.toString();
    const existingIndex = (message.reactions || []).findIndex(
      (r) => (r.sender?._id || r.sender)?.toString() === userIdStr && r.emoji === emoji.trim(),
    );

    let reaction: any = null;
    let type: "add" | "remove" = "add";

    if (existingIndex >= 0) {
      // Remove all existing reactions by this user (toggle off)
      message.reactions = message.reactions!.filter(
        (r) => (r.sender?._id || r.sender)?.toString() !== userIdStr
      ) as any;
      type = "remove";
    } else {
      // Remove any previous reaction by this user (replace), then add new one
      message.reactions = message.reactions!.filter(
        (r) => (r.sender?._id || r.sender)?.toString() !== userIdStr
      ) as any;
      reaction = {
        emoji: emoji.trim(),
        sender: currentUserId,
        createdAt: new Date(),
      };
      message.reactions!.push(reaction);
    }

    await message.save();

    // Populate sender for the emitted event and client response
    const populatedMessage = await Message.findById(message._id)
      .populate("reactions.sender", "username fullName profilePic")
      .lean();

    // Find the reaction for the socket event
    let populatedReaction = null;
    if (type === "add" && populatedMessage?.reactions) {
      const populatedReactions = populatedMessage.reactions as any[];
      populatedReaction = populatedReactions.find(
        (r: any) => r.sender?._id?.toString() === userIdStr && r.emoji === emoji.trim(),
      );
    } else if (type === "remove") {
      // Send minimal data so client can remove the reaction from local state
      populatedReaction = { emoji: emoji.trim(), sender: { _id: userIdStr } } as any;
    }

    // Fetch conversation participants for cross-room emission
    let participantIds: string[] = [];
    try {
      const conv = await Conversation.findById(message.conversation).select("participants").lean();
      if (conv) {
        participantIds = conv.participants.map((p: any) => p.toString());
      }
    } catch (e) {
      // Non-critical — fall back to conversation-room-only emission
    }

    // Emit socket event with populated reaction
    emitMessageReaction(
      message.conversation.toString(),
      {
        messageId,
        reaction: populatedReaction || null,
        type,
      },
      participantIds,
    );

    // Only notify for reaction if the recipient hasn't seen the message yet
    // If they've already seen it, they can see the reaction in the chat UI directly
    if (type === "add" && !message.seen) {
      // Determine who should be notified (the other participant)
      const recipientId =
        userIdStr === message.sender.toString()
          ? message.recipient.toString()
          : message.sender.toString();

      await createNotification({
        recipient: recipientId,
        sender: currentUserId.toString(),
        type: "reaction",
        post: null,
        comment: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reaction updated successfully!",
      reactions: populatedMessage?.reactions || [],
    });
  } catch (err: any) {
    logger.error("Error in toggleReaction controller", { error: err.message });
    return next(err);
  }
};
