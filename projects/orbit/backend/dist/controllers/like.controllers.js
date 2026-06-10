"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCommentLikes = exports.togglePostLikes = void 0;
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const notification_1 = require("../utilities/notification");
const socket_1 = require("../configs/socket");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const interaction_schema_1 = require("../schemas/interaction.schema");
// toggle like for a post
const togglePostLikes = async (req, res) => {
    const author = req.user?._id;
    const { postId } = req.params;
    try {
        // validate input
        const parsed = interaction_schema_1.toggleLikeSchema.safeParse({ postId });
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        // check user auth
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // find post
        const post = await post_model_1.default.findById(postId).select("_id author").lean();
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // check if already liked
        const existingLike = await like_model_1.default.findOne({
            author,
            post: postId,
        });
        if (!existingLike) {
            // like post
            await like_model_1.default.create({
                author,
                post: postId,
            });
            // increment likes count
            const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true });
            // create notification
            await (0, notification_1.createNotification)({
                recipient: post.author.toString(),
                sender: author.toString(),
                type: "like",
                post: postId,
            });
            // Emit socket event
            if (updatedPost) {
                (0, socket_1.emitPostLike)(postId, author.toString(), updatedPost.likesCount);
            }
            return res.status(201).json({
                success: true,
                message: "Post liked successfully!",
                liked: true,
                likesCount: updatedPost?.likesCount,
                post: updatedPost,
            });
        }
        await existingLike.deleteOne();
        await (0, notification_1.deleteInteractionNotification)({
            recipient: post.author.toString(),
            sender: author.toString(),
            type: "like",
            post: postId,
            comment: null,
        });
        // decrement likes count
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true });
        // Emit socket event
        if (updatedPost) {
            (0, socket_1.emitPostUnlike)(postId, author.toString(), updatedPost.likesCount);
        }
        return res.status(200).json({
            success: true,
            message: "Post disliked successfully!",
            liked: false,
            likesCount: updatedPost?.likesCount,
            post: updatedPost,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in togglePostLikes controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.togglePostLikes = togglePostLikes;
// toggle like for a comment
const toggleCommentLikes = async (req, res) => {
    const author = req.user?._id;
    const { commentId } = req.params;
    try {
        // validate input
        const parsed = interaction_schema_1.toggleCommentLikeSchema.safeParse({ commentId });
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        // check user auth
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // find comment
        const comment = await comment_model_1.default.findById(commentId)
            .select("_id author post")
            .lean();
        if (!comment) {
            throw new errors_1.NotFoundError("Comment not found!");
        }
        // check if already liked
        const existingLike = await like_model_1.default.findOne({
            author,
            comment: commentId,
        });
        if (!existingLike) {
            // like comment
            await like_model_1.default.create({
                author,
                comment: commentId,
            });
            // increment likes count
            const updatedComment = await comment_model_1.default.findByIdAndUpdate(commentId, { $inc: { likesCount: 1 } }, { new: true });
            // create notification
            await (0, notification_1.createNotification)({
                recipient: comment.author.toString(),
                sender: author.toString(),
                type: "like",
                post: comment.post.toString(),
                comment: commentId,
            });
            // Emit socket event
            if (updatedComment) {
                (0, socket_1.emitCommentLike)(commentId, author.toString(), updatedComment.likesCount);
            }
            return res.status(201).json({
                success: true,
                message: "Comment liked successfully!",
                liked: true,
                likesCount: updatedComment?.likesCount,
                comment: updatedComment,
            });
        }
        await existingLike.deleteOne();
        await (0, notification_1.deleteInteractionNotification)({
            recipient: comment.author.toString(),
            sender: author.toString(),
            type: "like",
            post: comment.post.toString(),
            comment: commentId,
        });
        const updatedComment = await comment_model_1.default.findByIdAndUpdate(commentId, { $inc: { likesCount: -1 } }, { new: true });
        // Emit socket event
        if (updatedComment) {
            (0, socket_1.emitCommentUnlike)(commentId, author.toString(), updatedComment.likesCount);
        }
        return res.status(200).json({
            success: true,
            message: "Comment disliked successfully!",
            liked: false,
            likesCount: updatedComment?.likesCount,
            comment: updatedComment,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in toggleCommentLikes controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.toggleCommentLikes = toggleCommentLikes;
//# sourceMappingURL=like.controllers.js.map