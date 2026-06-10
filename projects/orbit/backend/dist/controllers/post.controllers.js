"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpinPost = exports.pinPost = exports.viewsCount = exports.getPostsByHashtag = exports.getPostBySlug = exports.sharePost = exports.deletePost = exports.updatePost = exports.createPost = exports.getAllPosts = exports.getPost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const repost_model_1 = __importDefault(require("../models/repost.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const post_schema_1 = require("../schemas/post.schema");
const interaction_schema_1 = require("../schemas/interaction.schema");
const errors_1 = require("../utilities/errors");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
const cache_1 = require("../configs/cache");
const user_model_1 = require("../models/user.model");
const env_1 = require("../configs/env");
const notification_1 = require("../utilities/notification");
const sanitize_1 = require("../configs/sanitize");
const socket_1 = require("../configs/socket");
const logger_1 = require("../utilities/logger");
const postStatus_1 = require("../utilities/postStatus");
// get single post by id
const getPost = async (req, res) => {
    const { postId } = req.params;
    const currentUserId = req.user?._id?.toString();
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid ID!");
        }
        // try cache first
        const cacheKey = `post:${postId}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached) {
                // Re-attach user status (following state may have changed)
                const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)([cached.post], currentUserId);
                return res.status(200).json({
                    success: true,
                    message: "Post fetched successfully!",
                    post: postsWithStatus[0],
                });
            }
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getPost!`, { error: err.message });
        }
        // fetch post
        let post = await post_model_1.default.findById(postId)
            .populate("author", "username email fullName profilePic")
            .lean();
        // check existence
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // Add user status
        const postWithStatus = await (0, postStatus_1.addUserStatusToPosts)([post], currentUserId);
        post = postWithStatus[0];
        // cache the post (without user status — status re-attached on read)
        try {
            await (0, cache_1.setCache)(cacheKey, { post }, 60 * 30); // 30 min — single posts rarely change
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getPost!`, { error: err.message });
        }
        return res.status(200).json({
            success: true,
            message: "Post fetched successfully!",
            post,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getPost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getPost = getPost;
// get all posts
const getAllPosts = async (req, res) => {
    const currentUserId = req.user?._id?.toString();
    try {
        // pagination
        const limit = Number(req.query.limit) || undefined;
        const cursor = req.query.cursor;
        const authorId = req.query.author;
        const cacheKey = `posts:${authorId || "all"}:${cursor || "first"}:${limit || "all"}:${currentUserId || "anon"}`;
        // try cache first
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached) {
                // Re-attach user status (in case following state changed since caching)
                const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)(cached.posts, currentUserId);
                return res.status(200).json({
                    ...cached,
                    posts: postsWithStatus,
                });
            }
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getAllPosts!`, { error: err.message });
        }
        // query
        const query = {};
        // author filter
        if (authorId && mongoose_1.default.Types.ObjectId.isValid(authorId)) {
            query.author = authorId;
        }
        // cursor pagination
        if (cursor) {
            query._id = {
                $lt: cursor,
            };
        }
        // Always cap at 20 max per page
        const actualLimit = Math.min(limit ?? 10, 20);
        // fetch posts
        let posts = await post_model_1.default.find(query)
            .sort({ _id: -1 })
            .populate("author", "username email fullName profilePic")
            .limit(actualLimit + 1)
            .lean();
        // check more posts
        const hasMore = posts.length > actualLimit;
        if (hasMore) {
            posts.pop();
        }
        // next cursor
        const nextCursor = posts.slice(-1).shift()?._id || null;
        // Add user status to posts
        posts = await (0, postStatus_1.addUserStatusToPosts)(posts, currentUserId);
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
        // cache with 15s TTL (feed changes frequently)
        try {
            await (0, cache_1.setCache)(cacheKey, {
                success: true,
                message: responseData.message,
                posts: posts,
                nextCursor,
                hasMore,
            }, 15);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getAllPosts!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getAllPosts controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getAllPosts = getAllPosts;
// create new post
const createPost = async (req, res) => {
    const result = post_schema_1.createPostSchema.safeParse(req.body);
    try {
        // validate input
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid input");
        }
        // auth check
        const author = req.user?._id;
        if (!author) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // extract hashtags
        const extractHashtags = (text) => {
            const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
            const matches = [...text.matchAll(hashtagRegex)];
            const hashtags = matches.map(match => match[1]?.toLowerCase()).filter(Boolean);
            // Remove duplicates and limit to 10 hashtags
            return [...new Set(hashtags)].slice(0, 10);
        };
        const sanitizedTitle = (0, sanitize_1.sanitizePlainText)(result.data.title);
        const sanitizedContent = (0, sanitize_1.sanitizePlainText)(result.data.content);
        const hashtags = extractHashtags(result.data.title + " " + result.data.content);
        // Validate hashtag count
        if (hashtags.length > 10) {
            throw new errors_1.BadRequestError("Maximum 10 hashtags allowed!");
        }
        // handle multiple images and single image
        const imagesFiles = req.files?.images || [];
        const imageFile = req.files?.image || [];
        const files = [...imagesFiles, ...imageFile];
        const images = files.map((file) => ({
            url: file.path,
            public_id: file.filename,
            alt: (result.data.title || "").substring(0, 100),
        }));
        // fall back to single file (in case future changes use req.file)
        if (images.length === 0 && req.file) {
            images.push({
                url: req.file.path,
                public_id: req.file.filename,
                alt: (result.data.title || "").substring(0, 100),
            });
        }
        // create post
        const post = new post_model_1.default({
            ...result.data,
            title: sanitizedTitle,
            content: sanitizedContent,
            hashtags,
            author,
            image: images.length > 0 ? { url: images[0].url, public_id: images[0].public_id } : null,
            images: images.length > 0 ? images : undefined,
        });
        // save post
        await post.save();
        // handle mentions
        const mentionedUserIds = await (0, notification_1.extractMentions)(result.data.content + " " + result.data.title);
        const notifyRecipients = new Set(mentionedUserIds);
        for (const recipient of notifyRecipients) {
            await (0, notification_1.createNotification)({
                recipient,
                sender: author.toString(),
                type: "mention",
                post: post._id.toString(),
            });
        }
        // invalidate feed cache
        await (0, cache_1.clearFeedCache)();
        await (0, cache_1.clearUserPostsCache)(author.toString());
        // populate post with author and user status
        let populatedPost = await post_model_1.default.findById(post._id)
            .populate("author", "username email fullName profilePic")
            .lean();
        if (populatedPost) {
            const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)([populatedPost], req.user?._id?.toString());
            populatedPost = postsWithStatus[0];
            (0, socket_1.emitPostCreated)(populatedPost);
        }
        return res.status(201).json({
            success: true,
            message: "Post created successfully!",
            post: populatedPost,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        // duplicate slug
        if (err.code === 11000) {
            throw new errors_1.ConflictError("Duplicate slug, try different title!");
        }
        logger_1.logger.error(`Error in createPost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
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
            throw new errors_1.BadRequestError("Invalid ID!");
        }
        // auth check
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // find post
        const post = await post_model_1.default.findById(postId);
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // ownership check
        if (post.author.toString() !== userId.toString()) {
            throw new errors_1.ForbiddenError("Forbidden!");
        }
        // parse and validate body
        const parsed = interaction_schema_1.updatePostSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        const file = req.file;
        const filesObj = req.files;
        const imagesFiles = filesObj?.images || [];
        const imageFile = filesObj?.image || [];
        const allFiles = [...imageFile, ...imagesFiles];
        // ensure update exists
        const hasText = !!parsed.data.title || !!parsed.data.content;
        const hasImage = !!file || allFiles.length > 0;
        if (!hasText && !hasImage) {
            throw new errors_1.BadRequestError("At least one field is required!");
        }
        // update title
        if (parsed.data.title) {
            post.title = (0, sanitize_1.sanitizePlainText)(parsed.data.title);
        }
        // update content
        if (parsed.data.content) {
            post.content = (0, sanitize_1.sanitizePlainText)(parsed.data.content);
        }
        // --- Image update logic ---
        const hasNewFiles = !!file || allFiles.length > 0;
        // Parse public_ids of existing images the user wants to keep
        const keepImageIds = req.body.existingImages
            ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
            : [];
        if (hasNewFiles || keepImageIds.length > 0) {
            const keepIdsSet = new Set(keepImageIds);
            // Build new images from uploaded files
            const uploadedImages = allFiles.length > 0
                ? allFiles.map((f) => ({
                    url: f.path,
                    public_id: f.filename,
                    alt: (parsed.data.title || "").substring(0, 100),
                }))
                : [];
            // fall back to single file
            if (uploadedImages.length === 0 && file) {
                uploadedImages.push({
                    url: file.path,
                    public_id: file.filename,
                    alt: (parsed.data.title || "").substring(0, 100),
                });
            }
            // Delete from Cloudinary only images the user chose to remove
            const imageDeletions = [];
            for (const oldImg of post.images || []) {
                if (oldImg.public_id && !keepIdsSet.has(oldImg.public_id)) {
                    imageDeletions.push(cloudinary_1.default.uploader.destroy(oldImg.public_id));
                }
            }
            if (post.image?.public_id && !keepIdsSet.has(post.image.public_id)) {
                imageDeletions.push(cloudinary_1.default.uploader.destroy(post.image.public_id));
            }
            await Promise.allSettled(imageDeletions).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        logger_1.logger.error("Cloudinary deletion failed for post image update", { error: result.reason });
                    }
                });
            });
            // Final images = kept existing images + new uploaded images
            const keptExisting = (post.images || []).filter((img) => img.public_id && keepIdsSet.has(img.public_id));
            const finalImages = [...keptExisting, ...uploadedImages];
            post.images = finalImages;
            post.image = finalImages.length > 0
                ? { url: finalImages[0].url, public_id: finalImages[0].public_id }
                : null;
        }
        // save
        await post.save();
        // invalidate cache
        await (0, cache_1.deleteCache)(`post:${postId}`);
        await (0, cache_1.clearFeedCache)();
        // populate post with author and user status
        let populatedPost = await post_model_1.default.findById(post._id)
            .populate("author", "username email fullName profilePic")
            .lean();
        if (populatedPost) {
            const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)([populatedPost], req.user?._id?.toString());
            populatedPost = postsWithStatus[0];
            (0, socket_1.emitPostUpdated)(populatedPost);
        }
        return res.status(200).json({
            success: true,
            message: "Post updated successfully!",
            post: populatedPost,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in updatePost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
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
            throw new errors_1.BadRequestError("Invalid ID!");
        }
        // auth check
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // find post
        const post = await post_model_1.default.findById(postId);
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // ownership check
        if (post.author.toString() !== userId.toString()) {
            throw new errors_1.ForbiddenError("Forbidden!");
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
        const imageDeletions = [];
        if (post.image?.public_id) {
            imageDeletions.push(cloudinary_1.default.uploader.destroy(post.image.public_id));
        }
        for (const img of post.images || []) {
            if (img.public_id) {
                imageDeletions.push(cloudinary_1.default.uploader.destroy(img.public_id));
            }
        }
        await Promise.allSettled(imageDeletions).then(results => {
            results.forEach(result => {
                if (result.status === 'rejected') {
                    logger_1.logger.error("Cloudinary deletion failed for deleted post", { error: result.reason });
                }
            });
        });
        await post.deleteOne();
        await (0, cache_1.deleteCache)(`post:${postId}`);
        await (0, cache_1.deleteCache)(`post:slug:${post.slug}`);
        await (0, cache_1.clearFeedCache)();
        await (0, cache_1.clearCommentsCache)(postId);
        // clear saves caches only for users who saved this post
        const savedBy = await saves_model_1.default.find({ post: postId }).select("user").lean();
        const uniqueUserIds = [...new Set(savedBy.map(s => s.user.toString()))];
        await Promise.all(uniqueUserIds.map((uid) => (0, cache_1.clearSavesCache)(uid)));
        await (0, cache_1.clearUserPostsCache)(userId.toString());
        (0, socket_1.emitPostDeleted)(postId);
        return res.status(200).json({
            success: true,
            message: "Post deleted successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in deletePost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.deletePost = deletePost;
// share post
const sharePost = async (req, res) => {
    const { postId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
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
            throw new errors_1.NotFoundError("Post not found!");
        }
        // invalidate cache
        await (0, cache_1.deleteCache)(`post:${postId}`);
        // emit share socket event
        (0, socket_1.emitPostShare)(postId, post.sharesCount);
        // share url
        const shareUrl = `${env_1.env.CLIENT_URL}/post/${post.slug}`;
        return res.status(200).json({
            success: true,
            message: "Post shared successfully!",
            shares: post.sharesCount,
            shareUrl,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in sharePost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.sharePost = sharePost;
// get post by slug
const getPostBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        // cache key
        const cacheKey = `post:slug:${slug}`;
        // get cached post
        try {
            const cachedPost = await (0, cache_1.getCache)(cacheKey);
            if (cachedPost) {
                return res.status(200).json(cachedPost);
            }
        }
        catch (cacheError) {
            logger_1.logger.error(`Cache error in getPostBySlug controller!`, { error: cacheError.message });
        }
        // fetch post
        const post = await post_model_1.default.findOne({ slug })
            .populate("author", "username email fullName profilePic")
            .lean();
        // check existence
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // response data
        const responseData = {
            success: true,
            message: "Post fetched successfully!",
            post,
        };
        // cache post
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60 * 30);
        }
        catch (cacheError) {
            logger_1.logger.error(`Cache set error in getPostBySlug controller!`, { error: cacheError.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getPostBySlug controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getPostBySlug = getPostBySlug;
const getPostsByHashtag = async (req, res) => {
    try {
        const { hashtag } = req.params;
        const lowerHashtag = hashtag.toLowerCase();
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        const query = { hashtags: lowerHashtag };
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // get posts by hashtag
        const posts = await post_model_1.default.find(query)
            .select("title image images likesCount commentsCount repostsCount savesCount createdAt author hashtags")
            .populate("author", "fullName username profilePic")
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();
        const hasMore = posts.length > limit;
        if (hasMore) {
            posts.pop();
        }
        const nextCursor = posts.slice(-1).shift()?._id || null;
        // Add user status to posts
        const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)(posts, req.user?._id?.toString());
        return res.status(200).json({
            success: true,
            count: postsWithStatus.length,
            posts: postsWithStatus,
            nextCursor,
            hasMore,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getPostsByHashtag controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getPostsByHashtag = getPostsByHashtag;
// increment post views
const viewsCount = async (req, res) => {
    const { postId } = req.params;
    const currentUser = req.user?._id;
    try {
        const parsed = interaction_schema_1.addViewSchema.safeParse({ postId });
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        // fetch minimal fields
        const post = await post_model_1.default.findById(postId)
            .select("_id author viewsCount")
            .lean();
        // check existence
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
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
        // emit real-time view update
        if (updatedPost?.viewsCount) {
            (0, socket_1.emitPostView)(postId, updatedPost.viewsCount);
        }
        return res.status(200).json({
            success: true,
            message: "View counted successfully!",
            views: updatedPost?.viewsCount,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in viewsCount controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.viewsCount = viewsCount;
// pin a post to the current user's profile
const pinPost = async (req, res) => {
    const { postId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        // verify post exists and belongs to user
        const post = await post_model_1.default.findById(postId).select("author").lean();
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        if (post.author.toString() !== currentUserId.toString()) {
            throw new errors_1.BadRequestError("Cannot pin another user's post!");
        }
        const user = await user_model_1.User.findById(currentUserId);
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        const pinned = user.pinnedPosts || [];
        // check if already pinned
        if (pinned.some((id) => id.toString() === postId)) {
            throw new errors_1.BadRequestError("Post already pinned!");
        }
        if (pinned.length >= 3) {
            throw new errors_1.BadRequestError("Maximum 3 pinned posts allowed!");
        }
        pinned.push(new mongoose_1.default.Types.ObjectId(postId));
        user.pinnedPosts = pinned;
        await user.save();
        // invalidate caches
        await (0, cache_1.clearUserPostsCache)(currentUserId.toString());
        await (0, cache_1.clearFeedCache)();
        // emit real-time pin event
        (0, socket_1.emitPostPin)(postId, currentUserId.toString());
        return res.status(200).json({
            success: true,
            message: "Post pinned successfully!",
            pinnedPosts: user.pinnedPosts,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in pinPost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.pinPost = pinPost;
// unpin a post from the current user's profile
const unpinPost = async (req, res) => {
    const { postId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        const user = await user_model_1.User.findById(currentUserId);
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        const pinned = user.pinnedPosts || [];
        const filtered = pinned.filter((id) => id.toString() !== postId);
        if (filtered.length === pinned.length) {
            throw new errors_1.BadRequestError("Post is not pinned!");
        }
        user.pinnedPosts = filtered;
        await user.save();
        // invalidate caches
        await (0, cache_1.clearUserPostsCache)(currentUserId.toString());
        await (0, cache_1.clearFeedCache)();
        // emit real-time unpin event
        (0, socket_1.emitPostUnpin)(postId, currentUserId.toString());
        return res.status(200).json({
            success: true,
            message: "Post unpinned successfully!",
            pinnedPosts: user.pinnedPosts,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in unpinPost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.unpinPost = unpinPost;
//# sourceMappingURL=post.controllers.js.map