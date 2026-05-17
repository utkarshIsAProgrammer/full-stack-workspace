"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCommentLikes = exports.togglePostLikes = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
// toggle like for a post
const togglePostLikes = async (req, res) => {
    const author = req.user?._id;
    const { postId } = req.params;
    try {
        // check user auth
        if (!author) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // check post id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID!",
            });
        }
        // find post
        const post = await post_model_1.default.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
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
            return res.status(201).json({
                success: true,
                message: "Post liked successfully!",
                liked: true,
                likesCount: updatedPost?.likesCount,
                post: updatedPost,
            });
        }
        // unlike post
        await existingLike.deleteOne();
        // decrement likes count
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true });
        return res.status(200).json({
            success: true,
            message: "Post disliked successfully!",
            liked: false,
            likesCount: updatedPost?.likesCount,
            post: updatedPost,
        });
    }
    catch (err) {
        console.log(`Error in togglePostLikes controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.togglePostLikes = togglePostLikes;
// toggle like for a comment
const toggleCommentLikes = async (req, res) => {
    const author = req.user?._id;
    const { commentId } = req.params;
    try {
        // check user auth
        if (!author) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // check comment id
        if (!mongoose_1.default.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid comment ID!",
            });
        }
        // find comment
        const comment = await comment_model_1.default.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found!",
            });
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
            return res.status(201).json({
                success: true,
                message: "Comment liked successfully!",
                liked: true,
                likesCount: updatedComment?.likesCount,
                comment: updatedComment,
            });
        }
        await existingLike.deleteOne();
        const updatedComment = await comment_model_1.default.findByIdAndUpdate(commentId, { $inc: { likesCount: -1 } }, { new: true });
        return res.status(200).json({
            success: true,
            message: "Comment disliked successfully!",
            liked: false,
            likesCount: updatedComment?.likesCount,
            comment: updatedComment,
        });
    }
    catch (err) {
        console.log(`Error in toggleCommentLikes controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.toggleCommentLikes = toggleCommentLikes;
//# sourceMappingURL=like.controllers.js.map