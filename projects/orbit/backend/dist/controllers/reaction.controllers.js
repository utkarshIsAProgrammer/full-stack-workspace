"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleReaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const message_model_1 = require("../models/message.model");
const conversation_model_1 = require("../models/conversation.model");
const errors_1 = require("../utilities/errors");
const socket_1 = require("../configs/socket");
const notification_1 = require("../utilities/notification");
const logger_1 = require("../utilities/logger");
const toggleReaction = async (req, res, next) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.BadRequestError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
            return next(new errors_1.BadRequestError("Invalid message ID!"));
        }
        if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
            return next(new errors_1.BadRequestError("Emoji is required!"));
        }
        const message = await message_model_1.Message.findById(messageId);
        if (!message) {
            return next(new errors_1.NotFoundError("Message not found!"));
        }
        const userIdStr = currentUserId.toString();
        const existingIndex = (message.reactions || []).findIndex((r) => (r.sender?._id || r.sender)?.toString() === userIdStr && r.emoji === emoji.trim());
        let reaction = null;
        let type = "add";
        if (existingIndex >= 0) {
            // Remove all existing reactions by this user (toggle off)
            message.reactions = message.reactions.filter((r) => (r.sender?._id || r.sender)?.toString() !== userIdStr);
            type = "remove";
        }
        else {
            // Remove any previous reaction by this user (replace), then add new one
            message.reactions = message.reactions.filter((r) => (r.sender?._id || r.sender)?.toString() !== userIdStr);
            reaction = {
                emoji: emoji.trim(),
                sender: currentUserId,
                createdAt: new Date(),
            };
            message.reactions.push(reaction);
        }
        await message.save();
        // Populate sender for the emitted event and client response
        const populatedMessage = await message_model_1.Message.findById(message._id)
            .populate("reactions.sender", "username fullName profilePic")
            .lean();
        // Find the reaction for the socket event
        let populatedReaction = null;
        if (type === "add" && populatedMessage?.reactions) {
            const populatedReactions = populatedMessage.reactions;
            populatedReaction = populatedReactions.find((r) => r.sender?._id?.toString() === userIdStr && r.emoji === emoji.trim());
        }
        else if (type === "remove") {
            // Send minimal data so client can remove the reaction from local state
            populatedReaction = { emoji: emoji.trim(), sender: { _id: userIdStr } };
        }
        // Fetch conversation participants for cross-room emission
        let participantIds = [];
        try {
            const conv = await conversation_model_1.Conversation.findById(message.conversation).select("participants").lean();
            if (conv) {
                participantIds = conv.participants.map((p) => p.toString());
            }
        }
        catch (e) {
            // Non-critical — fall back to conversation-room-only emission
        }
        // Emit socket event with populated reaction
        (0, socket_1.emitMessageReaction)(message.conversation.toString(), {
            messageId,
            reaction: populatedReaction || null,
            type,
        }, participantIds);
        // Create notification when a reaction is added
        if (type === "add") {
            // Determine who should be notified (the other participant)
            const recipientId = userIdStr === message.sender.toString()
                ? message.recipient.toString()
                : message.sender.toString();
            await (0, notification_1.createNotification)({
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
    }
    catch (err) {
        logger_1.logger.error("Error in toggleReaction controller", { error: err.message });
        return next(err);
    }
};
exports.toggleReaction = toggleReaction;
//# sourceMappingURL=reaction.controllers.js.map