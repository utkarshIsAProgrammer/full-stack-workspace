"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPosts = exports.searchUsers = void 0;
const user_model_1 = require("../models/user.model");
const post_model_1 = __importDefault(require("../models/post.model"));
const follow_model_1 = __importDefault(require("../models/follow.model"));
const cache_1 = require("../configs/cache");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const postStatus_1 = require("../utilities/postStatus");
const searchUsers = async (req, res) => {
    try {
        const q = req.query.q?.toString().trim();
        const currentUserId = req.user?._id;
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        const escapedQuery = q ? q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
        // cache key
        const cacheKey = `search:users:${q || ""}:${cursor || "first"}:${limit}:${currentUserId?.toString() || "anon"}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in searchUsers!`, { error: err.message });
        }
        let users = [];
        if (q) {
            try {
                const textQuery = { $text: { $search: q } };
                if (currentUserId && cursor) {
                    textQuery._id = { $ne: currentUserId, $lt: cursor };
                }
                else if (currentUserId) {
                    textQuery._id = { $ne: currentUserId };
                }
                else if (cursor) {
                    textQuery._id = { $lt: cursor };
                }
                users = await user_model_1.User.find(textQuery)
                    .select("_id fullName username profilePic followersCount followingCount")
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .lean();
            }
            catch (textErr) {
                logger_1.logger.info("Text search failed, falling back to regex search", { error: textErr.message });
            }
            if (users.length === 0) {
                const regexQuery = {
                    $or: [
                        { username: { $regex: escapedQuery, $options: "i" } },
                        { fullName: { $regex: escapedQuery, $options: "i" } },
                    ],
                };
                if (currentUserId && cursor) {
                    regexQuery._id = { $ne: currentUserId, $lt: cursor };
                }
                else if (currentUserId) {
                    regexQuery._id = { $ne: currentUserId };
                }
                else if (cursor) {
                    regexQuery._id = { $lt: cursor };
                }
                users = await user_model_1.User.find(regexQuery)
                    .select("_id fullName username profilePic followersCount followingCount")
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .lean();
            }
        }
        else {
            // No query: show all users except current
            const allUsersQuery = {};
            if (currentUserId && cursor) {
                allUsersQuery._id = { $ne: currentUserId, $lt: cursor };
            }
            else if (currentUserId) {
                allUsersQuery._id = { $ne: currentUserId };
            }
            else if (cursor) {
                allUsersQuery._id = { $lt: cursor };
            }
            users = await user_model_1.User.find(allUsersQuery)
                .select("_id fullName username profilePic followersCount followingCount")
                .sort({ _id: -1 })
                .limit(limit + 1)
                .lean();
        }
        const hasMore = users.length > limit;
        if (hasMore) {
            users.pop();
        }
        const nextCursor = users.slice(-1).pop()?._id || null;
        // add followingByMe to each user
        const followingSet = new Set();
        if (currentUserId && users.length > 0) {
            const userIds = users.map(u => u._id);
            const existingFollows = await follow_model_1.default.find({
                follower: currentUserId,
                following: { $in: userIds },
            }).lean();
            existingFollows.forEach(follow => {
                followingSet.add(follow.following.toString());
            });
        }
        const usersWithStatus = users.map(user => ({
            ...user,
            followingByMe: followingSet.has(user._id.toString()),
        }));
        const responseData = {
            success: true,
            count: usersWithStatus.length,
            users: usersWithStatus,
            nextCursor,
            hasMore,
        };
        // cache search results (60s — results are relatively stable)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in searchUsers!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the searchUsers controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.searchUsers = searchUsers;
const searchPosts = async (req, res) => {
    try {
        const q = req.query.q?.toString().trim();
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        const escapedQuery = q ? q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
        const currentUserId = req.user?._id?.toString();
        // cache key
        const cacheKey = `search:posts:${q || ""}:${cursor || "first"}:${limit}:${currentUserId || "anon"}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in searchPosts!`, { error: err.message });
        }
        let posts = [];
        if (q) {
            try {
                const textQuery = { $text: { $search: q } };
                if (cursor) {
                    textQuery._id = { $lt: cursor };
                }
                posts = await post_model_1.default.find(textQuery)
                    .select("title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug")
                    .populate("author", "fullName username profilePic")
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .lean();
            }
            catch (textErr) {
                logger_1.logger.info("Text search failed, falling back to regex search", { error: textErr.message });
            }
            if (posts.length === 0) {
                // Handle hashtag search - remove # from query if present
                const tagQuery = q.startsWith('#') ? q.slice(1) : q;
                const regexQuery = {
                    $or: [
                        { title: { $regex: escapedQuery, $options: "i" } },
                        { content: { $regex: escapedQuery, $options: "i" } },
                        { tags: { $in: [new RegExp(tagQuery, "i")] } },
                        { tags: { $in: [new RegExp(escapedQuery, "i")] } }
                    ]
                };
                if (cursor) {
                    regexQuery._id = { $lt: cursor };
                }
                posts = await post_model_1.default.find(regexQuery)
                    .select("title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug")
                    .populate("author", "fullName username profilePic")
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .lean();
            }
        }
        else {
            // If no query, show all posts
            const allPostsQuery = {};
            if (cursor) {
                allPostsQuery._id = { $lt: cursor };
            }
            posts = await post_model_1.default.find(allPostsQuery)
                .select("title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug")
                .populate("author", "fullName username profilePic")
                .sort({ _id: -1 })
                .limit(limit + 1)
                .lean();
        }
        const hasMore = posts.length > limit;
        if (hasMore)
            posts.pop();
        const nextCursor = posts.slice(-1).pop()?._id || null;
        const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)(posts, currentUserId);
        const responseData = {
            success: true,
            count: postsWithStatus.length,
            posts: postsWithStatus,
            nextCursor,
            hasMore,
        };
        // cache search results (60s)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in searchPosts!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the searchPosts controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.searchPosts = searchPosts;
//# sourceMappingURL=search.controllers.js.map