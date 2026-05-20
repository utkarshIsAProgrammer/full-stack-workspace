"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.addComment = exports.getComment = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const comment_schema_1 = require("../schemas/comment.schema");
const cache_1 = require("../configs/cache");
const notification_1 = require("../utilities/notification");
// Get all comments for a specific post
const getComment = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID!",
            });
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
            console.log(`Cache error in getComment! ${err.message}`);
        }
        // fetch comments with author info
        const comments = await comment_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("author", "username email")
            .lean();
        // check more comments exists
        const hasMore = comments.length > limit;
        // remove extra comments
        if (hasMore) {
            comments.pop();
        }
        // next cursor
        const nextCursor = comments[comments.length - 1]?._id || null;
        const responseData = {
            success: true,
            comments,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            console.log(`Cache set error in getComment! ${err.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in getComment: ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.getComment = getComment;
// create a new comment or reply
const addComment = async (req, res) => {
    const result = comment_schema_1.addCommentSchema.safeParse(req.body);
    const postId = req.params.postId;
    const author = req.user?._id;
    try {
        // check validation result
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid Data!",
                error: result.error.issues,
            });
        }
        // check user auth
        if (!author) {
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized access!" });
        }
        // check for parent comment (is reply)
        const parent = result.data.parent;
        let parentComment = null;
        if (parent) {
            parentComment = await comment_model_1.default.findById(parent)
                .select("_id author")
                .lean();
            if (!parentComment) {
                return res.status(404).json({
                    success: false,
                    message: "Parent comment not found!",
                });
            }
        }
        // ensure post id
        if (!postId)
            return res
                .status(400)
                .json({ success: false, message: "Post ID required" });
        // save comment
        const comment = new comment_model_1.default({ ...result.data, author, post: postId });
        await comment.save();
        // increment comments count
        const postData = await post_model_1.default.findByIdAndUpdate(postId, {
            $inc: { commentsCount: 1 },
        });
        const notifyRecipients = new Set();
        if (postData) {
            notifyRecipients.add(postData.author.toString());
        }
        if (parentComment) {
            notifyRecipients.add(parentComment.author.toString());
        }
        for (const recipient of notifyRecipients) {
            await (0, notification_1.createNotification)({
                recipient,
                sender: author.toString(),
                type: "comment",
                post: postId,
                comment: comment._id.toString(),
            });
        }
        // clear cache
        await (0, cache_1.clearCommentsCache)(postId);
        res.status(201).json({
            success: true,
            message: "Comment added successfully!",
            comment,
        });
    }
    catch (err) {
        console.log(`Error in the addComment controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
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
            return res.status(400).json({
                success: false,
                message: "Invalid Data!",
                error: result.error.issues,
            });
        }
        // check user auth
        if (!author) {
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized access!" });
        }
        // find comment (exists)
        const comment = await comment_model_1.default.findById(commentId)
            .select("_id author post")
            .lean();
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found!",
            });
        }
        // verify ownership
        if (comment.author.toString() !== author.toString()) {
            return res.status(403).json({
                success: false,
                message: "Forbidden!",
            });
        }
        // update and save
        const updatedComment = await comment_model_1.default.findByIdAndUpdate(commentId, { content: result.data.content }, { new: true, runValidators: true });
        // clear cache
        if (comment.post)
            await (0, cache_1.clearCommentsCache)(comment.post.toString());
        res.status(200).json({
            success: true,
            message: "Comment updated successfully!",
            updatedComment,
        });
    }
    catch (err) {
        console.log(`Error in the updateComment controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.updateComment = updateComment;
const collectDescendantCommentIds = async (commentId) => {
    const replies = await comment_model_1.default.find({ parent: commentId }).select("_id").lean();
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
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized access!" });
        }
        // find comment (exists)
        const comment = await comment_model_1.default.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found!",
            });
        }
        // verify ownership
        if (comment.author.toString() !== author.toString()) {
            return res.status(403).json({
                success: false,
                message: "Forbidden!",
            });
        }
        const commentIds = await collectDescendantCommentIds(commentId);
        await Promise.all([
            comment_model_1.default.deleteMany({ _id: { $in: commentIds } }),
            like_model_1.default.deleteMany({ comment: { $in: commentIds } }),
            notification_model_1.default.deleteMany({ comment: { $in: commentIds } }),
        ]);
        await post_model_1.default.findByIdAndUpdate(comment.post, {
            $inc: { commentsCount: -commentIds.length },
        });
        // clear cache
        if (comment.post)
            await (0, cache_1.clearCommentsCache)(comment.post.toString());
        res.status(200).json({
            success: true,
            message: "Comment deleted successfully!",
        });
    }
    catch (err) {
        console.log(`Error in the deleteComment controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.deleteComment = deleteComment;
//# sourceMappingURL=comment.controllers.js.map