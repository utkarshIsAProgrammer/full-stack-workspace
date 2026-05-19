"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.addComment = exports.getComment = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_schema_1 = require("../schemas/comment.schema");
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
        return res.status(200).json({
            success: true,
            comments,
            nextCursor,
            hasMore,
        });
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
        if (parent) {
            const parentComment = await comment_model_1.default.findById(parent).select("_id").lean();
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
        await post_model_1.default.findByIdAndUpdate(postId, {
            $inc: { commentsCount: 1 },
        });
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
        const comment = await comment_model_1.default.findById(commentId).select("_id author").lean();
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
        // decrement comments count
        await post_model_1.default.findByIdAndUpdate(comment.post, {
            $inc: { commentsCount: -1 },
        });
        // delete comment
        await comment.deleteOne();
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