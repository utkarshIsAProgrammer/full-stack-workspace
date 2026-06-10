"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserStatusToPosts = void 0;
const like_model_1 = __importDefault(require("../models/like.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const repost_model_1 = __importDefault(require("../models/repost.model"));
const user_model_1 = require("../models/user.model");
/**
 * Adds user interaction status to posts (likedByMe, savedByMe, repostedByMe, pinnedByMe)
 * Uses batch queries for efficiency - only 4 queries regardless of post count
 *
 * @param posts - Array of posts to annotate
 * @param userId - Current user's ID (if authenticated)
 * @returns Posts with added status fields
 */
const addUserStatusToPosts = async (posts, userId) => {
    if (!userId || !posts.length)
        return posts;
    const postIds = posts.map(post => post._id?.toString() || post._id);
    // All queries run in parallel for optimal performance
    const [likedPosts, savedPosts, repostedPosts, currentUser] = await Promise.all([
        like_model_1.default.find({ author: userId, post: { $in: postIds } }).select("post").lean(),
        saves_model_1.default.find({ user: userId, post: { $in: postIds } }).select("post").lean(),
        repost_model_1.default.find({ user: userId, post: { $in: postIds } }).select("post").lean(),
        user_model_1.User.findById(userId).select("pinnedPosts").lean(),
    ]);
    // Build Sets for O(1) lookup
    const likedSet = new Set(likedPosts.map((l) => l.post?.toString()));
    const savedSet = new Set(savedPosts.map((s) => s.post?.toString()));
    const repostedSet = new Set(repostedPosts.map((r) => r.post?.toString()));
    const pinnedSet = new Set(currentUser?.pinnedPosts?.map((id) => id.toString()) || []);
    return posts.map(post => {
        const postId = post._id?.toString() || post._id;
        return {
            ...post,
            likedByMe: likedSet.has(postId),
            savedByMe: savedSet.has(postId),
            repostedByMe: repostedSet.has(postId),
            pinnedByMe: pinnedSet.has(postId),
        };
    });
};
exports.addUserStatusToPosts = addUserStatusToPosts;
//# sourceMappingURL=postStatus.js.map