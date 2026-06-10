"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleRepost = exports.getRepostedPosts = void 0;
const repost_model_1 = __importDefault(require("../models/repost.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const notification_1 = require("../utilities/notification");
const socket_1 = require("../configs/socket");
const cache_1 = require("../configs/cache");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const interaction_schema_1 = require("../schemas/interaction.schema");
const postStatus_1 = require("../utilities/postStatus");
const getRepostedPosts = async (req, res) => {
    const userId = req.user?._id;
    try {
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        const query = {
            user: userId,
        };
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `reposts:${userId}:${cursor || "first"}:${limit}`;
        // try cache first
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getRepostedPosts!`, { error: err.message });
        }
        const repostedPosts = await repost_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
            path: "post",
            select: "title slug image author savesCount repostsCount likesCount commentsCount createdAt viewsCount sharesCount",
            populate: [
                {
                    path: "author",
                    select: "username fullName email profilePic",
                },
            ],
        })
            .lean();
        const mappedPosts = repostedPosts.map((repost) => ({
            ...repost.post,
            repostedByMe: true,
        }));
        const posts = await (0, postStatus_1.addUserStatusToPosts)(mappedPosts, userId.toString());
        if (posts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No reposted posts!",
                posts: [],
            });
        }
        const hasMore = posts.length > limit;
        if (hasMore) {
            posts.pop();
        }
        const nextCursor = repostedPosts.slice(-1).shift()?._id || null;
        const responseData = {
            success: true,
            message: "Reposted posts fetched successfully!",
            posts,
            nextCursor,
            hasMore,
        };
        // set cache (short TTL since reposts can change frequently)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getRepostedPosts!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getRepostedPosts controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getRepostedPosts = getRepostedPosts;
const toggleRepost = async (req, res) => {
    const userId = req.user?._id;
    const { postId } = req.params;
    try {
        const parsed = interaction_schema_1.toggleRepostSchema.safeParse({ postId });
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        // auth check
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // find post
        const post = await post_model_1.default.findById(postId).select("_id author").lean();
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // prevent self repost
        if (post.author.toString() === userId.toString()) {
            throw new errors_1.BadRequestError("You cannot repost your own post!");
        }
        // check existing repost
        const existingRepost = await repost_model_1.default.findOne({
            user: userId,
            post: postId,
        });
        // un-repost post
        if (existingRepost) {
            await existingRepost.deleteOne();
            await (0, notification_1.deleteInteractionNotification)({
                recipient: post.author.toString(),
                sender: userId.toString(),
                type: "repost",
                post: postId,
            });
            // sync reposts count from Repost collection (authoritative)
            const actualRepostsCount = await repost_model_1.default.countDocuments({ post: postId });
            const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $set: { repostsCount: actualRepostsCount } }, { new: true });
            // Emit socket event
            if (updatedPost) {
                (0, socket_1.emitPostUnrepost)(postId, userId.toString(), updatedPost.repostsCount);
            }
            // clear repost cache for this user
            (0, cache_1.clearByPattern)(`reposts:${userId.toString()}:*`);
            return res.status(200).json({
                success: true,
                message: "Repost removed!",
                reposted: false,
                repostedByMe: false,
                repostsCount: updatedPost?.repostsCount,
                post: updatedPost,
            });
        }
        // re-post post
        await repost_model_1.default.create({
            user: userId,
            post: postId,
        });
        // sync reposts count from Repost collection (authoritative)
        const actualRepostsCount = await repost_model_1.default.countDocuments({ post: postId });
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $set: { repostsCount: actualRepostsCount } }, { new: true });
        await (0, notification_1.createNotification)({
            recipient: post.author.toString(),
            sender: userId.toString(),
            type: "repost",
            post: postId,
        });
        // Emit socket event
        if (updatedPost) {
            (0, socket_1.emitPostRepost)(postId, userId.toString(), updatedPost.repostsCount);
        }
        // clear repost cache for this user
        (0, cache_1.clearByPattern)(`reposts:${userId.toString()}:*`);
        return res.status(201).json({
            success: true,
            message: "Repost created!",
            reposted: true,
            repostedByMe: true,
            repostsCount: updatedPost?.repostsCount,
            post: updatedPost,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in toggleRepost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.toggleRepost = toggleRepost;
//# sourceMappingURL=repost.controllers.js.map