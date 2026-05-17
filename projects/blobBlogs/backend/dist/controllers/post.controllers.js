"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharePost = exports.deletePost = exports.updatePost = exports.createPost = exports.getAllPosts = exports.getPost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = __importDefault(require("../models/post.model"));
const post_schema_1 = require("../schemas/post.schema");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
// get single post by id
const getPost = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID!",
            });
        }
        // fetch post
        const post = await post_model_1.default.findOne({ _id: postId }).populate("author", "username email");
        // check existence
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        res.status(200).json({
            success: true,
            message: "Post fetched successfully!",
            post,
        });
    }
    catch (err) {
        console.log(`Error in the getPost controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getPost = getPost;
// get all posts
const getAllPosts = async (req, res) => {
    try {
        // fetch all posts
        const posts = await post_model_1.default.find()
            .sort({ createdAt: -1 })
            .populate("author", "username email");
        // check empty list (post)
        if (posts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No posts yet!",
            });
        }
        return res.status(200).json({
            success: true,
            message: "All posts fetched successfully!",
            posts,
        });
    }
    catch (err) {
        console.log(`Error in the getAllPosts controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getAllPosts = getAllPosts;
// create new post
const createPost = async (req, res) => {
    const result = post_schema_1.createPostSchema.safeParse(req.body);
    try {
        // check validation
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid input!",
                error: result.error.issues,
            });
        }
        // check user auth
        const author = req.user?._id;
        if (!author) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // create post object
        const post = new post_model_1.default({
            ...result.data,
            author,
            image: {
                url: req.file?.path || "",
                public_id: req.file?.filename || "",
            },
        });
        // save post
        await post.save();
        return res.status(201).json({
            success: true,
            message: "Post created successfully!",
            post,
        });
    }
    catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate slug, try different title",
            });
        }
        console.log(`Error in the createPost controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.createPost = createPost;
// update existing post
const updatePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID!",
            });
        }
        // auth check
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized!",
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
        // ownership check
        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Forbidden!",
            });
        }
        // normalize form-data values
        const title = req.body.title?.trim();
        const content = req.body.content?.trim();
        const file = req.file;
        // ensure at least one update exists
        const hasText = (title && title.length > 0) || (content && content.length > 0);
        const hasImage = !!file;
        if (!hasText && !hasImage) {
            return res.status(400).json({
                success: false,
                message: "At least one of title, content, or image must be provided!",
            });
        }
        // update text fields
        if (title)
            post.title = title;
        if (content)
            post.content = content;
        // update image if provided
        if (file) {
            // delete old image from cloudinary
            if (post.image?.public_id) {
                await cloudinary_1.default.uploader.destroy(post.image.public_id);
            }
            post.image = {
                url: file.path,
                public_id: file.filename,
            };
        }
        await post.save();
        return res.status(200).json({
            success: true,
            message: "Post updated successfully!",
            post,
        });
    }
    catch (err) {
        console.log(`Error in updatePost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.updatePost = updatePost;
// delete post
const deletePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID!",
            });
        }
        // check user auth
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized!",
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
        // verify ownership
        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Forbidden!",
            });
        }
        // delete cloudinary image
        if (post.image?.public_id) {
            await cloudinary_1.default.uploader.destroy(post.image.public_id);
        }
        console.log("PUBLIC_ID:", post.image?.public_id);
        // delete post
        await post.deleteOne();
        res.status(200).json({
            success: true,
            message: "Post deleted successfully!",
        });
    }
    catch (err) {
        console.log(`Error in the deletePost controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.deletePost = deletePost;
// share post
const sharePost = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post Id!",
            });
        }
        // increment share count
        const post = await post_model_1.default.findByIdAndUpdate(postId, {
            $inc: { sharesCount: 1 },
        }, { new: true });
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // generate url
        const shareUrl = `${process.env.CLIENT_URL}/post/${post.slug}`;
        res.status(200).json({
            success: true,
            message: "Post shared successfully!",
            shares: post.sharesCount,
            shareUrl,
            post,
        });
    }
    catch (err) {
        console.log(`Error in the share post controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.sharePost = sharePost;
//# sourceMappingURL=post.controllers.js.map