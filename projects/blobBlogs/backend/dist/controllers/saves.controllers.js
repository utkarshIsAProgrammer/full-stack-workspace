"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSavedPosts = exports.toggleSavePost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = __importDefault(require("../models/post.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const toggleSavePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;
    try {
        //  check user auth
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized!" });
        }
        //  check post id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post id!",
            });
        }
        // check post exists
        const post = await post_model_1.default.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // check user already saved this post
        const alreadySaved = await saves_model_1.default.findOne({
            user: userId,
            post: postId,
        });
        // unsave post
        if (alreadySaved) {
            await saves_model_1.default.findByIdAndDelete(alreadySaved._id);
            // decrement saves count
            const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { savesCount: -1 } }, { new: true });
            return res.status(200).json({
                success: true,
                message: "Post unsaved!",
                saved: false,
                savesCount: updatedPost?.savesCount,
                post: updatedPost,
            });
        }
        // save post
        await saves_model_1.default.create({
            user: userId,
            post: postId,
        });
        // increment saves count
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } }, { new: true });
        res.status(201).json({
            success: true,
            message: "Post saved!",
            saved: true,
            savesCount: updatedPost?.savesCount,
            post: updatedPost,
        });
    }
    catch (err) {
        console.log(`Error in the toggleSavePost controller! ${err.message}`);
        res.status(500).json({ success: true, message: "Internal server error!" });
    }
};
exports.toggleSavePost = toggleSavePost;
const getSavedPosts = async (req, res) => {
    const userId = req.user?._id;
    try {
        //  check user auth
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized!",
            });
        }
        // find saved posts
        const savedPosts = await saves_model_1.default.find({ user: userId })
            .sort({ createdAt: -1 })
            .populate({
            path: "post",
            select: "title slug image author savesCount repostsCount",
            populate: [
                {
                    path: "author",
                    select: "username fullName email",
                },
            ],
        });
        // no posts saved
        if (savedPosts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No saved posts!",
                saved: true,
            });
        }
        res.status(200).json({
            success: true,
            message: "Saved posts fetched successfully!",
            count: savedPosts.length,
            savedPosts,
        });
    }
    catch (err) {
        console.log(`Error in the getSavedPosts controller! ${err.message}`);
        res.status(500).json({ success: true, message: "Internal server error!" });
    }
};
exports.getSavedPosts = getSavedPosts;
//# sourceMappingURL=saves.controllers.js.map