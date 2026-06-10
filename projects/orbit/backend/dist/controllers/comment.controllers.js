"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.addComment = exports.getCommentReplies = exports.getAllComments = exports.getComment = exports.getAllCommentsForPost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const comment_schema_1 = require("../schemas/comment.schema");
const cache_1 = require("../configs/cache");
const notification_1 = require("../utilities/notification");
const sanitize_1 = require("../configs/sanitize");
const socket_1 = require("../configs/socket");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
// Get all comments for a specific post (including replies)
const getAllCommentsForPost = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        // cache key
        const cacheKey = `comments:all:${postId}`;
        // get from cache
        try {
            const cachedComments = await (0, cache_1.getCache)(cacheKey);
            if (cachedComments)
                return res.status(200).json(cachedComments);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getAllCommentsForPost!`, { error: err.message });
        }
        // fetch ALL comments for this post (including replies) with author info
        const comments = await comment_model_1.default.find({ post: postId })
            .sort({ _id: -1 })
            .populate("author", "username email fullName profilePic")
            .lean();
        const responseData = {
            success: true,
            comments,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getAllCommentsForPost!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getAllCommentsForPost:`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getAllCommentsForPost = getAllCommentsForPost;
// Get all comments for a specific post
const getComment = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        // query
        const query = {
            post: postId,
            parent: null,
        };
        // if cursor exists fetch older comments
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `comments:${postId}:${cursor || "first"}:${limit}`;
        // get from cache
        try {
            const cachedComments = await (0, cache_1.getCache)(cacheKey);
            if (cachedComments)
                return res.status(200).json(cachedComments);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getComment!`, { error: err.message });
        }
        // fetch comments with author info
        const comments = await comment_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("author", "username email fullName profilePic")
            .lean();
        // check more comments exists
        const hasMore = comments.length > limit;
        // remove extra comments
        if (hasMore) {
            comments.pop();
        }
        // next cursor
        const nextCursor = comments.slice(-1).shift()?._id || null;
        const responseData = {
            success: true,
            comments,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getComment!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getComment:`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getComment = getComment;
// Get all comments
const getAllComments = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        // cache key
        const cacheKey = `comments:all:${cursor || "first"}:${limit}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getAllComments!`, { error: err.message });
        }
        const query = {};
        if (cursor) {
            query._id = { $lt: cursor };
        }
        const comments = await comment_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("author", "username email fullName profilePic")
            .lean();
        const hasMore = comments.length > limit;
        if (hasMore) {
            comments.pop();
        }
        const nextCursor = comments.slice(-1).shift()?._id || null;
        const responseData = {
            success: true,
            comments,
            nextCursor,
            hasMore,
        };
        // set cache (2 min — global comments list is stable)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 120);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getAllComments!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getAllComments:`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getAllComments = getAllComments;
// Get replies for a specific comment
const getCommentReplies = async (req, res) => {
    const { commentId } = req.params;
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(commentId)) {
            throw new errors_1.BadRequestError("Invalid comment ID!");
        }
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        // cache key
        const cacheKey = `comments:replies:${commentId}:${cursor || "first"}:${limit}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getCommentReplies!`, { error: err.message });
        }
        const query = { parent: commentId };
        if (cursor) {
            query._id = { $lt: cursor };
        }
        const replies = await comment_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("author", "username email fullName profilePic")
            .lean();
        const hasMore = replies.length > limit;
        if (hasMore) {
            replies.pop();
        }
        const nextCursor = replies.slice(-1).shift()?._id || null;
        const responseData = {
            success: true,
            replies,
            nextCursor,
            hasMore,
        };
        // set cache (2 min — replies are stable)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 120);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getCommentReplies!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getCommentReplies:`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getCommentReplies = getCommentReplies;
// create a new comment or reply
const addComment = async (req, res) => {
    const result = comment_schema_1.addCommentSchema.safeParse(req.body);
    const postId = req.params.postId;
    const author = req.user?._id;
    try {
        // check validation result
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid Data!");
        }
        // check user auth
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // check for parent comment (is reply)
        const parent = result.data.parent;
        let parentComment = null;
        if (parent) {
            parentComment = await comment_model_1.default.findById(parent)
                .select("_id author post")
                .lean();
            if (!parentComment) {
                throw new errors_1.NotFoundError("Parent comment not found!");
            }
            // ensure parent comment belongs to the same post
            if (parentComment.post?.toString() !== postId) {
                throw new errors_1.BadRequestError("Parent comment does not belong to this post!");
            }
        }
        // ensure post id
        if (!postId)
            throw new errors_1.BadRequestError("Post ID required");
        const sanitizedContent = (0, sanitize_1.sanitizePlainText)(result.data.content);
        // save comment
        const comment = new comment_model_1.default({ ...result.data, content: sanitizedContent, author, post: postId });
        await comment.save();
        // populate comment for socket
        const populatedComment = await comment_model_1.default.findById(comment._id)
            .populate("author", "username fullName profilePic")
            .lean();
        // increment comments count
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }, { new: true });
        // increment parent comment's replies count if this is a reply
        let updatedParentComment = null;
        if (parent) {
            updatedParentComment = await comment_model_1.default.findByIdAndUpdate(parent, { $inc: { repliesCount: 1 } }, { new: true });
        }
        const notifyRecipients = new Set();
        if (updatedPost) {
            notifyRecipients.add(updatedPost.author.toString());
        }
        if (parentComment) {
            notifyRecipients.add(parentComment.author.toString());
        }
        // handle mentions
        const mentionedUserIds = await (0, notification_1.extractMentions)(sanitizedContent);
        mentionedUserIds.forEach(userId => notifyRecipients.add(userId));
        for (const recipient of notifyRecipients) {
            let notificationType = "comment";
            if (mentionedUserIds.includes(recipient)) {
                notificationType = "mention";
            }
            await (0, notification_1.createNotification)({
                recipient,
                sender: author.toString(),
                type: notificationType,
                post: postId,
                comment: comment._id.toString(),
            });
        }
        // Emit socket event
        if (populatedComment && updatedPost) {
            if (parent && updatedParentComment) {
                (0, socket_1.emitCommentReply)(postId, parent, populatedComment, author.toString(), updatedPost.commentsCount, updatedParentComment.repliesCount);
            }
            else if (parent) {
                (0, socket_1.emitCommentReply)(postId, parent, populatedComment, author.toString(), updatedPost.commentsCount, 1);
            }
            else {
                (0, socket_1.emitPostComment)(postId, populatedComment, author.toString(), updatedPost.commentsCount);
            }
        }
        // clear cache
        await (0, cache_1.clearCommentsCache)(postId);
        return res.status(201).json({
            success: true,
            message: "Comment added successfully!",
            comment: populatedComment,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the addComment controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.addComment = addComment;
// update existing comment
const updateComment = async (req, res) => {
    const result = comment_schema_1.updateCommentSchema.safeParse(req.body);
    const author = req.user?._id;
    const { commentId } = req.params;
    try {
        // check validation result
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid Data!");
        }
        // check user auth
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // find comment (exists)
        const comment = await comment_model_1.default.findById(commentId)
            .select("_id author post")
            .lean();
        if (!comment) {
            throw new errors_1.NotFoundError("Comment not found!");
        }
        // verify ownership
        if (comment.author.toString() !== author.toString()) {
            throw new errors_1.ForbiddenError("Forbidden!");
        }
        // update and save with sanitization
        const sanitizedContent = (0, sanitize_1.sanitizePlainText)(result.data.content);
        await comment_model_1.default.findByIdAndUpdate(commentId, { content: sanitizedContent, isEdited: true }, { new: true, runValidators: true });
        const updatedComment = await comment_model_1.default.findById(commentId)
            .populate("author", "username fullName profilePic")
            .lean();
        // emit socket event for realtime update
        if (updatedComment) {
            (0, socket_1.emitCommentUpdated)(updatedComment);
        }
        // clear cache
        if (comment.post)
            await (0, cache_1.clearCommentsCache)(comment.post.toString());
        return res.status(200).json({
            success: true,
            message: "Comment updated successfully!",
            updatedComment,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the updateComment controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.updateComment = updateComment;
const collectDescendantCommentIds = async (commentId) => {
    const replies = await comment_model_1.default.find({ parent: commentId })
        .select("_id")
        .lean();
    const ids = [commentId];
    for (const reply of replies) {
        ids.push(...(await collectDescendantCommentIds(reply._id.toString())));
    }
    return ids;
};
// delete comment
const deleteComment = async (req, res) => {
    const author = req.user?._id;
    const { commentId } = req.params;
    try {
        // check user auth
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // find comment (exists)
        const comment = await comment_model_1.default.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError("Comment not found!");
        }
        // verify ownership
        if (comment.author.toString() !== author.toString()) {
            throw new errors_1.ForbiddenError("Forbidden!");
        }
        const commentIds = await collectDescendantCommentIds(commentId);
        await Promise.all([
            comment_model_1.default.deleteMany({ _id: { $in: commentIds } }),
            like_model_1.default.deleteMany({ comment: { $in: commentIds } }),
            notification_model_1.default.deleteMany({ comment: { $in: commentIds } }),
        ]);
        const updatedPost = await post_model_1.default.findByIdAndUpdate(comment.post, {
            $inc: { commentsCount: -commentIds.length },
        }, { new: true });
        // if this is a reply, decrement parent's repliesCount
        let updatedParentComment = null;
        if (comment.parent) {
            updatedParentComment = await comment_model_1.default.findByIdAndUpdate(comment.parent, { $inc: { repliesCount: -1 } }, { new: true });
        }
        // clear cache
        if (comment.post)
            await (0, cache_1.clearCommentsCache)(comment.post.toString());
        // emit comment deleted event
        if (updatedPost) {
            (0, socket_1.emitCommentDeleted)(comment.post.toString(), commentId, updatedPost.commentsCount);
        }
        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the deleteComment controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.deleteComment = deleteComment;
//# sourceMappingURL=comment.controllers.js.map