"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCommentReaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const errors_1 = require("../utilities/errors");
const socket_1 = require("../configs/socket");
const notification_1 = require("../utilities/notification");
const logger_1 = require("../utilities/logger");
const toggleCommentReaction = async (req, res, next) => {
    const { commentId } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.BadRequestError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(commentId)) {
            return next(new errors_1.BadRequestError("Invalid comment ID!"));
        }
        if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
            return next(new errors_1.BadRequestError("Emoji is required!"));
        }
        const comment = await comment_model_1.default.findById(commentId);
        if (!comment) {
            return next(new errors_1.NotFoundError("Comment not found!"));
        }
        const userIdStr = currentUserId.toString();
        const existingIndex = (comment.reactions || []).findIndex((r) => (r.sender?._id || r.sender)?.toString() === userIdStr && r.emoji === emoji.trim());
        let type = "add";
        if (existingIndex >= 0) {
            // Remove all existing reactions by this user (toggle off)
            comment.reactions = comment.reactions.filter((r) => (r.sender?._id || r.sender)?.toString() !== userIdStr);
            type = "remove";
        }
        else {
            // Remove any previous reaction by this user (replace), then add new one
            comment.reactions = comment.reactions.filter((r) => (r.sender?._id || r.sender)?.toString() !== userIdStr);
            comment.reactions.push({
                emoji: emoji.trim(),
                sender: currentUserId,
                createdAt: new Date(),
            });
        }
        await comment.save();
        // Populate sender info for socket event and client response
        const populatedComment = await comment_model_1.default.findById(comment._id)
            .populate("reactions.sender", "username fullName profilePic")
            .lean();
        // Find the reaction for the socket event
        let populatedReaction = null;
        if (type === "add" && populatedComment?.reactions) {
            const populatedReactions = populatedComment.reactions;
            populatedReaction = populatedReactions.find((r) => r.sender?._id?.toString() === userIdStr && r.emoji === emoji.trim());
        }
        else if (type === "remove") {
            // Send minimal data so client can remove the reaction from local state
            populatedReaction = { emoji: emoji.trim(), sender: { _id: userIdStr } };
        }
        // Emit socket event to update comment reactions in realtime
        (0, socket_1.emitCommentReaction)(commentId, {
            reaction: populatedReaction || null,
            type,
        });
        // Create notification when a reaction is added
        if (type === "add") {
            const commentAuthor = comment.author.toString();
            const postId = comment.post ? comment.post.toString() : null;
            await (0, notification_1.createNotification)({
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
    }
    catch (err) {
        logger_1.logger.error("Error in toggleCommentReaction controller", { error: err.message });
        return next(err);
    }
};
exports.toggleCommentReaction = toggleCommentReaction;
//# sourceMappingURL=commentReaction.controllers.js.map