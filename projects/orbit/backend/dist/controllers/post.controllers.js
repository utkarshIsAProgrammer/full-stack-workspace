"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewsCount = exports.sharePost = exports.deletePost = exports.updatePost = exports.createPost = exports.getAllPosts = exports.getPost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const repost_model_1 = __importDefault(require("../models/repost.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const post_schema_1 = require("../schemas/post.schema");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
const cache_1 = require("../configs/cache");
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
        // cache key
        const cacheKey = `post:${postId}`;
        // get cached post
        try {
            const cachedPost = await (0, cache_1.getCache)(cacheKey);
            if (cachedPost) {
                return res.status(200).json(cachedPost);
            }
        }
        catch (cacheError) {
            console.log(`Cache error in getPost controller! ${cacheError.message}`);
        }
        // fetch post
        const post = await post_model_1.default.findById(postId)
            .populate("author", "username email")
            .lean();
        // check existence
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // response data
        const responseData = {
            success: true,
            message: "Post fetched successfully!",
            post,
        };
        // cache post
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60 * 5);
        }
        catch (cacheError) {
            console.log(`Cache set error in getPost controller! ${cacheError.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in getPost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.getPost = getPost;
// get all posts
const getAllPosts = async (req, res) => {
    try {
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        // query
        const query = {};
        // cursor pagination
        if (cursor) {
            query._id = {
                $lt: cursor,
            };
        }
        // cache key
        const cacheKey = `posts:${cursor || "first"}:${limit}`;
        // get cached posts
        try {
            const cachedPosts = await (0, cache_1.getCache)(cacheKey);
            if (cachedPosts) {
                return res.status(200).json(cachedPosts);
            }
        }
        catch (cacheError) {
            console.log(`Cache error in getAllPosts controller! ${cacheError.message}`);
        }
        // fetch posts
        const posts = await post_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("author", "username email")
            .lean();
        // check more posts
        const hasMore = posts.length > limit;
        // remove extra post
        if (hasMore) {
            posts.pop();
        }
        // next cursor
        const nextCursor = posts[posts.length - 1]?._id || null;
        // response data
        const responseData = {
            success: true,
            message: posts.length
                ? "All posts fetched successfully!"
                : "No posts yet!",
            posts,
            nextCursor,
            hasMore,
        };
        // cache posts
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (cacheError) {
            console.log(`Cache set error in getAllPosts controller! ${cacheError.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in getAllPosts controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.getAllPosts = getAllPosts;
// create new post
const createPost = async (req, res) => {
    const result = post_schema_1.createPostSchema.safeParse(req.body);
    try {
        // validate input
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid input!",
                error: result.error.issues,
            });
        }
        // auth check
        const author = req.user?._id;
        if (!author) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // create post
        const post = new post_model_1.default({
            ...result.data,
            author,
            image: req.file
                ? {
                    url: req.file.path,
                    public_id: req.file.filename,
                }
                : undefined,
        });
        // save post
        await post.save();
        // invalidate feed cache
        await (0, cache_1.clearFeedCache)();
        return res.status(201).json({
            success: true,
            message: "Post created successfully!",
            post,
        });
    }
    catch (err) {
        // duplicate slug
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate slug, try different title!",
            });
        }
        console.log(`Error in createPost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
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
        // normalize input
        const title = req.body.title?.trim();
        const content = req.body.content?.trim();
        const file = req.file;
        // ensure update exists
        const hasText = (title && title.length > 0) || (content && content.length > 0);
        const hasImage = !!file;
        if (!hasText && !hasImage) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required!",
            });
        }
        // update title
        if (title) {
            post.title = title;
        }
        // update content
        if (content) {
            post.content = content;
        }
        // update image
        if (file) {
            // delete old image
            if (post.image?.public_id) {
                await cloudinary_1.default.uploader.destroy(post.image.public_id);
            }
            post.image = {
                url: file.path,
                public_id: file.filename,
            };
        }
        // save
        await post.save();
        // invalidate cache
        await (0, cache_1.deleteCache)(`post:${postId}`);
        await (0, cache_1.clearFeedCache)();
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
        const comments = await comment_model_1.default.find({ post: postId }).select("_id").lean();
        const commentIds = comments.map((c) => c._id);
        await Promise.all([
            comment_model_1.default.deleteMany({ post: postId }),
            like_model_1.default.deleteMany({
                $or: [{ post: postId }, { comment: { $in: commentIds } }],
            }),
            repost_model_1.default.deleteMany({ post: postId }),
            saves_model_1.default.deleteMany({ post: postId }),
            notification_model_1.default.deleteMany({
                $or: [{ post: postId }, { comment: { $in: commentIds } }],
            }),
        ]);
        if (post.image?.public_id) {
            await cloudinary_1.default.uploader.destroy(post.image.public_id);
        }
        await post.deleteOne();
        await (0, cache_1.deleteCache)(`post:${postId}`);
        await (0, cache_1.clearFeedCache)();
        await (0, cache_1.clearCommentsCache)(postId);
        await (0, cache_1.clearAllSavesCache)();
        return res.status(200).json({
            success: true,
            message: "Post deleted successfully!",
        });
    }
    catch (err) {
        console.log(`Error in deletePost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
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
                message: "Invalid post ID!",
            });
        }
        // increment share count
        const post = await post_model_1.default.findByIdAndUpdate(postId, {
            $inc: {
                sharesCount: 1,
            },
        }, {
            new: true,
        }).select("sharesCount slug");
        // check existence
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // invalidate cache
        await (0, cache_1.deleteCache)(`post:${postId}`);
        // share url
        const shareUrl = `${process.env.CLIENT_URL}/post/${post.slug}`;
        return res.status(200).json({
            success: true,
            message: "Post shared successfully!",
            shares: post.sharesCount,
            shareUrl,
        });
    }
    catch (err) {
        console.log(`Error in sharePost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.sharePost = sharePost;
// increment post views
const viewsCount = async (req, res) => {
    const { postId } = req.params;
    const currentUser = req.user?._id;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID!",
            });
        }
        // fetch minimal fields
        const post = await post_model_1.default.findById(postId)
            .select("_id author viewsCount")
            .lean();
        // check existence
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // ignore self views
        if (currentUser && post.author.toString() === currentUser.toString()) {
            return res.status(200).json({
                success: true,
                message: "Own post view ignored!",
                views: post.viewsCount,
            });
        }
        // increment views
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, {
            $inc: {
                viewsCount: 1,
            },
        }, {
            new: true,
        }).select("viewsCount");
        // invalidate cache
        await (0, cache_1.deleteCache)(`post:${postId}`);
        return res.status(200).json({
            success: true,
            message: "View counted successfully!",
            views: updatedPost?.viewsCount,
        });
    }
    catch (err) {
        console.log(`Error in viewsCount controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.viewsCount = viewsCount;
//# sourceMappingURL=post.controllers.js.map