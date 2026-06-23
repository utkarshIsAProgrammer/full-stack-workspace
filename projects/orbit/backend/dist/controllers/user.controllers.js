"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getPinnedPosts = exports.unpinPost = exports.pinPost = exports.getSuggestedUsers = exports.getUserPosts = exports.getUserByUsername = exports.viewsCount = exports.shareProfile = exports.deleteAccount = exports.getAll = exports.getUserById = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
const nodeMailer_1 = require("../configs/nodeMailer");
const cache_1 = require("../configs/cache");
const post_model_1 = __importDefault(require("../models/post.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const like_model_1 = __importDefault(require("../models/like.model"));
const follow_model_1 = __importDefault(require("../models/follow.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const repost_model_1 = __importDefault(require("../models/repost.model"));
const conversation_model_1 = require("../models/conversation.model");
const message_model_1 = require("../models/message.model");
const env_1 = require("../configs/env");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const socket_1 = require("../configs/socket");
const postStatus_1 = require("../utilities/postStatus");
// get user by id
const getUserById = async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user id!");
        }
        const cacheKey = `user:${userId}`;
        let user = null;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                user = cached;
        }
        catch (e) { }
        if (!user) {
            user = await user_model_1.User.findById(userId)
                .select("-password -otp -otpExpiry")
                .lean();
            if (!user) {
                throw new errors_1.NotFoundError("User not found!");
            }
            try {
                await (0, cache_1.setCache)(cacheKey, user, 60 * 30);
            }
            catch (e) { }
        }
        let isFollowing = false;
        if (currentUserId) {
            const existingFollow = await follow_model_1.default.findOne({
                follower: currentUserId,
                following: userId,
            }).lean();
            isFollowing = !!existingFollow;
        }
        const responseData = {
            success: true,
            message: "User fetched successfully!",
            user: {
                ...user,
                followingByMe: isFollowing,
                pinnedPosts: user.pinnedPosts || [],
            },
        };
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getUserById controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getUserById = getUserById;
// get all users
const getAll = async (req, res) => {
    const currentUserId = req.user?._id;
    try {
        // pagination
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const cursor = req.query.cursor;
        // query
        const query = {};
        // if cursor exists fetch older user
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // fetch all users
        const users = await user_model_1.User.find(query)
            .select("-password -otp -otpExpiry")
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();
        // check more user exits if limit is applied
        const hasMore = users.length > limit;
        if (hasMore) {
            users.pop();
        }
        // check empty list (user)
        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No users found!",
                users: [],
                nextCursor: null,
                hasMore: false,
            });
        }
        // get following status for each user
        const followingSet = new Set();
        if (currentUserId && users.length > 0) {
            const userIds = users.map((u) => u._id);
            const existingFollows = await follow_model_1.default.find({
                follower: currentUserId,
                following: { $in: userIds },
            }).lean();
            existingFollows.forEach((follow) => {
                followingSet.add(follow.following.toString());
            });
        }
        // add followingByMe to each user
        const usersWithStatus = users.map((user) => ({
            ...user,
            followingByMe: followingSet.has(user._id.toString()),
        }));
        // next cursor
        const nextCursor = hasMore ? users.slice(-1).shift()?._id : null;
        // prepare response
        const responseData = {
            success: true,
            message: "All users fetched successfully!",
            users: usersWithStatus,
            nextCursor,
            hasMore,
        };
        // cache the full user list (60s — users list changes infrequently)
        try {
            await (0, cache_1.setCache)(`users:all:${currentUserId?.toString() || "anon"}:${cursor || "first"}:${limit}`, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getAll users!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the getAll users controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getAll = getAll;
// delete account
const deleteAccount = async (req, res) => {
    const result = user_schema_1.deleteAccountSchema.safeParse(req.body);
    try {
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid Data");
        }
        // get user id from the auth middleware
        const userId = req.user?._id;
        // find user and verify credentials — must match authenticated user
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        // enforce that submitted email matches the authenticated user
        if (user.email !== result.data.email) {
            throw new errors_1.ForbiddenError("Email does not match your account!");
        }
        const isMatch = await user.comparePassword(result.data.password);
        if (!isMatch) {
            throw new errors_1.BadRequestError("Invalid credentials!");
        }
        // delete profile pic and banner image from cloudinary
        if (user.profilePic?.public_id) {
            try {
                await cloudinary_1.default.uploader.destroy(user.profilePic.public_id);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
        if (user.bannerImage?.public_id) {
            try {
                await cloudinary_1.default.uploader.destroy(user.bannerImage.public_id);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
        // handle orphaned cloudinary images from posts
        const userPosts = await post_model_1.default.find({ author: user._id }).select("image images");
        const imageDeletions = userPosts.flatMap((post) => {
            const promises = [];
            if (post.image?.public_id) {
                promises.push(cloudinary_1.default.uploader.destroy(post.image.public_id));
            }
            if (post.images && Array.isArray(post.images)) {
                for (const img of post.images) {
                    if (img.public_id) {
                        promises.push(cloudinary_1.default.uploader.destroy(img.public_id));
                    }
                }
            }
            return promises;
        });
        await Promise.allSettled(imageDeletions).then((results) => {
            results.forEach((result) => {
                if (result.status === "rejected") {
                    logger_1.logger.error("Cloudinary deletion failed for post image", {
                        error: result.reason,
                    });
                }
            });
        });
        // ── Clean up follow relationships and fix counts on other users ──
        // 1. Users that the deleted user was FOLLOWING → decrement their followersCount
        const usersBeingFollowed = await follow_model_1.default.find({
            follower: user._id,
        }).select("following");
        if (usersBeingFollowed.length > 0) {
            const followingIds = usersBeingFollowed.map((f) => f.following);
            await user_model_1.User.updateMany({ _id: { $in: followingIds } }, { $inc: { followersCount: -1 } });
        }
        // 2. Users who were FOLLOWING the deleted user → decrement their followingCount
        const usersFollowingDeleted = await follow_model_1.default.find({
            following: user._id,
        }).select("follower");
        if (usersFollowingDeleted.length > 0) {
            const followerIds = usersFollowingDeleted.map((f) => f.follower);
            await user_model_1.User.updateMany({ _id: { $in: followerIds } }, { $inc: { followingCount: -1 } });
        }
        // 3. Prevent negative counts (safety clamp)
        await user_model_1.User.updateMany({ followersCount: { $lt: 0 } }, { $set: { followersCount: 0 } });
        await user_model_1.User.updateMany({ followingCount: { $lt: 0 } }, { $set: { followingCount: 0 } });
        // 4. Update Post counts for deleted interactions
        const userComments = await comment_model_1.default.aggregate([
            {
                $match: {
                    author: user._id,
                },
            },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]);
        for (const stat of userComments) {
            await post_model_1.default.updateOne({ _id: stat._id }, { $inc: { commentsCount: -stat.count } });
        }
        const userLikes = await like_model_1.default.aggregate([
            {
                $match: {
                    author: user._id,
                    post: { $ne: null },
                },
            },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]);
        for (const stat of userLikes) {
            await post_model_1.default.updateOne({ _id: stat._id }, { $inc: { likesCount: -stat.count } });
        }
        const userSaves = await saves_model_1.default.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]);
        for (const stat of userSaves) {
            await post_model_1.default.updateOne({ _id: stat._id }, { $inc: { savesCount: -stat.count } });
        }
        const userReposts = await repost_model_1.default.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: "$post", count: { $sum: 1 } } },
        ]);
        for (const stat of userReposts) {
            await post_model_1.default.updateOne({ _id: stat._id }, { $inc: { repostsCount: -stat.count } });
        }
        // Safety clamp for post counts
        const postNegativeFields = [
            "commentsCount",
            "likesCount",
            "savesCount",
            "repostsCount",
        ];
        for (const field of postNegativeFields) {
            await post_model_1.default.updateMany({ [field]: { $lt: 0 } }, { $set: { [field]: 0 } });
        }
        // Delete orphaned data
        await post_model_1.default.deleteMany({ author: user._id });
        await comment_model_1.default.deleteMany({ author: user._id });
        await like_model_1.default.deleteMany({ author: user._id });
        await saves_model_1.default.deleteMany({ user: user._id });
        await repost_model_1.default.deleteMany({ user: user._id });
        await follow_model_1.default.deleteMany({
            $or: [{ follower: user._id }, { following: user._id }],
        });
        // Clean up direct chat data (Conversations, Messages, and attachments)
        const userConversations = await conversation_model_1.Conversation.find({
            participants: user._id,
        });
        const userConversationIds = userConversations.map((c) => c._id);
        if (userConversationIds.length > 0) {
            // Find messages with attachments to delete them from Cloudinary
            const messagesWithAttachments = await message_model_1.Message.find({
                conversation: { $in: userConversationIds },
                "attachments.0": { $exists: true },
            })
                .select("attachments")
                .lean();
            const chatCloudinaryDeletions = messagesWithAttachments.flatMap((msg) => (msg.attachments || [])
                .map((att) => att.public_id)
                .filter(Boolean)
                .map((pubId) => cloudinary_1.default.uploader.destroy(pubId)));
            await Promise.allSettled(chatCloudinaryDeletions).then((results) => {
                results.forEach((res) => {
                    if (res.status === "rejected") {
                        logger_1.logger.error("Cloudinary deletion failed for chat message attachment", {
                            error: res.reason,
                        });
                    }
                });
            });
            // Delete messages and conversations
            await message_model_1.Message.deleteMany({
                conversation: { $in: userConversationIds },
            });
            await conversation_model_1.Conversation.deleteMany({
                _id: { $in: userConversationIds },
            });
        }
        await user_model_1.User.findByIdAndDelete(user._id);
        // clear users and session cache
        await (0, cache_1.clearUsersCache)();
        await (0, cache_1.deleteCache)(`auth:user:${user._id}`);
        await (0, cache_1.deleteCache)(`presence:user:${user._id}`);
        // Clear all user-related caches
        await (0, cache_1.deleteCache)(`user:${user._id}`);
        await (0, cache_1.deleteCache)(`posts:author:${user._id}`);
        await (0, cache_1.deleteCache)(`saves:user:${user._id}`);
        await (0, cache_1.deleteCache)(`user:username:${user.username}`);
        // Emit account deletion event so connected clients can clean up in real-time
        (0, socket_1.emitAccountDeleted)(user._id.toString());
        // send account deletion email
        (0, nodeMailer_1.sendDeletionMail)({
            email: user.email,
            username: user.username,
        });
        res.status(200).json({
            success: true,
            message: "Account deleted successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the deleteAccount controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.deleteAccount = deleteAccount;
// share profile
const shareProfile = async (req, res) => {
    const { userId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user id!");
        }
        // increment share count
        const user = await user_model_1.User.findByIdAndUpdate(userId, {
            $inc: { sharesCount: 1 },
        }, { new: true });
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        // emit share socket event
        (0, socket_1.emitUserShare)(userId, user.sharesCount);
        // generate url
        const shareUrl = `${env_1.env.CLIENT_URL}/user/${user.username}`;
        res.status(200).json({
            success: true,
            message: "Profile shared successfully!",
            shares: user.sharesCount,
            shareUrl,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the shareProfile controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.shareProfile = shareProfile;
const viewsCount = async (req, res) => {
    const { userId } = req.params;
    const currentUser = req.user?._id;
    try {
        // validate post
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user Id!");
        }
        // check post exists
        const profile = await user_model_1.User.findById(userId)
            .select("_id viewsCount")
            .lean();
        if (!profile) {
            throw new errors_1.NotFoundError("Profile not found!");
        }
        // check self view
        if (currentUser && profile._id.toString() === currentUser.toString()) {
            return res.status(200).json({
                success: true,
                message: "Own profile view ignored!",
                views: profile.viewsCount,
            });
        }
        // increment profile views count
        const updatedProfile = await user_model_1.User.findByIdAndUpdate(userId, {
            $inc: { viewsCount: 1 },
        }, { new: true });
        // emit real-time view update
        if (updatedProfile?.viewsCount) {
            (0, socket_1.emitUserView)(userId, updatedProfile.viewsCount);
        }
        return res.status(200).json({
            success: true,
            message: "View counted successfully!",
            views: updatedProfile?.viewsCount,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the viewsCount controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.viewsCount = viewsCount;
// get user by username
const getUserByUsername = async (req, res) => {
    const { username } = req.params;
    const currentUserId = req.user?._id;
    try {
        const cacheKey = `user:username:${username}`;
        let user = null;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                user = cached;
        }
        catch (e) { }
        if (!user) {
            user = await user_model_1.User.findOne({ username })
                .select("-password -otp -otpExpiry")
                .lean();
            if (!user) {
                throw new errors_1.NotFoundError("User not found!");
            }
            try {
                await (0, cache_1.setCache)(cacheKey, user, 60 * 30);
            }
            catch (e) { }
        }
        let isFollowing = false;
        if (currentUserId) {
            const existingFollow = await follow_model_1.default.findOne({
                follower: currentUserId,
                following: user._id,
            }).lean();
            isFollowing = !!existingFollow;
        }
        // sync follow counts from Follow collection (authoritative)
        const [actualFollowers, actualFollowing] = await Promise.all([
            follow_model_1.default.countDocuments({ following: user._id }),
            follow_model_1.default.countDocuments({ follower: user._id }),
        ]);
        const responseData = {
            success: true,
            message: "User fetched successfully!",
            user: {
                ...user,
                followersCount: actualFollowers,
                followingCount: actualFollowing,
                followingByMe: isFollowing,
                pinnedPosts: user.pinnedPosts || [],
            },
        };
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getUserByUsername controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getUserByUsername = getUserByUsername;
// get user's posts
const getUserPosts = async (req, res) => {
    const { userId } = req.params;
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        const cacheKey = `user:${userId}:posts:${cursor || "first"}:${limit}`;
        const currentUserId = req.user?._id?.toString();
        let postsData = null;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                postsData = cached;
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getUserPosts!`, {
                error: err.message,
            });
        }
        if (!postsData) {
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new errors_1.BadRequestError("Invalid user id!");
            }
            const query = { author: userId };
            if (cursor) {
                query._id = { $lt: cursor };
            }
            const posts = await post_model_1.default.find(query)
                .sort({ _id: -1 })
                .limit(limit + 1)
                .populate("author", "username email fullName profilePic")
                .lean();
            const hasMore = posts.length > limit;
            if (hasMore) {
                posts.pop();
            }
            const nextCursor = posts.slice(-1).shift()?._id || null;
            postsData = {
                posts,
                nextCursor,
                hasMore,
            };
            try {
                await (0, cache_1.setCache)(cacheKey, postsData, 60 * 30);
            }
            catch (err) {
                logger_1.logger.error(`Cache set error in getUserPosts!`, {
                    error: err.message,
                });
            }
        }
        // Add user status to posts AFTER cache retrieval
        const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)(postsData.posts, currentUserId);
        const responseData = {
            success: true,
            message: postsWithStatus.length
                ? "User posts fetched successfully!"
                : "No posts yet!",
            posts: postsWithStatus,
            nextCursor: postsData.nextCursor,
            hasMore: postsData.hasMore,
        };
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getUserPosts controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getUserPosts = getUserPosts;
// get suggested users (who to follow)
const getSuggestedUsers = async (req, res) => {
    const currentUserId = req.user?._id;
    try {
        const limit = Math.min(Number(req.query.limit) || 5, 10);
        if (!currentUserId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // cache key — suggestions change rarely for a given user
        const cacheKey = `users:suggested:${currentUserId.toString()}:${limit}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getSuggestedUsers!`, { error: err.message });
        }
        // get users the current user already follows
        const following = await follow_model_1.default.find({ follower: currentUserId })
            .select("following")
            .lean();
        const followingIds = following.map((f) => f.following);
        followingIds.push(currentUserId); // exclude self
        // find users with most followers that user doesn't follow
        const suggestedUsers = await user_model_1.User.find({
            _id: { $nin: followingIds },
        })
            .select("_id fullName username profilePic bio followersCount")
            .sort({ followersCount: -1, createdAt: -1 })
            .limit(limit)
            .lean();
        // Add followingByMe to each user (they're all not-followed since filtered above, but this keeps consistency)
        const usersWithStatus = suggestedUsers.map((user) => ({
            ...user,
            followingByMe: false,
        }));
        const responseData = {
            success: true,
            users: usersWithStatus,
        };
        // set cache (2 min — suggestions are relatively stable)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 120);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getSuggestedUsers!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getSuggestedUsers controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getSuggestedUsers = getSuggestedUsers;
// pin a post to profile
const pinPost = async (req, res) => {
    const { userId } = req.params;
    const { postId } = req.body;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // only allow pinning own profile
        if (currentUserId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Forbidden!");
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        // verify post exists and belongs to user
        const post = await post_model_1.default.findById(postId).select("author").lean();
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        if (post.author.toString() !== userId) {
            throw new errors_1.BadRequestError("Cannot pin another user's post!");
        }
        const user = await user_model_1.User.findById(userId);
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
        // Emit real-time pin event
        (0, socket_1.emitPostPin)(postId, userId);
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
// unpin a post from profile
const unpinPost = async (req, res) => {
    const { userId } = req.params;
    const { postId } = req.body;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        if (currentUserId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Forbidden!");
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            throw new errors_1.BadRequestError("Invalid post ID!");
        }
        const user = await user_model_1.User.findById(userId);
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
        // Emit real-time unpin event
        (0, socket_1.emitPostUnpin)(postId, userId);
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
// get pinned posts for a user
const getPinnedPosts = async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id?.toString();
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user ID!");
        }
        // cache key
        const cacheKey = `user:${userId}:pinned`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getPinnedPosts!`, { error: err.message });
        }
        const user = await user_model_1.User.findById(userId).select("pinnedPosts").lean();
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        const pinnedIds = user.pinnedPosts || [];
        if (pinnedIds.length === 0) {
            return res.status(200).json({ success: true, posts: [] });
        }
        const posts = await post_model_1.default.find({ _id: { $in: pinnedIds } })
            .populate("author", "username fullName profilePic")
            .lean();
        const postsWithStatus = await (0, postStatus_1.addUserStatusToPosts)(posts, currentUserId);
        // preserve pinned order and add pinnedByMe flag
        const orderedPosts = pinnedIds
            .map((id) => postsWithStatus.find((p) => p._id.toString() === id.toString()))
            .filter(Boolean)
            .map((post) => ({
            ...post,
            pinnedByMe: true,
        }));
        const responseData = {
            success: true,
            posts: orderedPosts,
        };
        // set cache (5 min — pinned posts rarely change)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 300);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getPinnedPosts!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getPinnedPosts controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getPinnedPosts = getPinnedPosts;
// update profile
const updateProfile = async (req, res) => {
    const result = user_schema_1.updateProfileSchema.safeParse(req.body);
    const cleanupFiles = async (filesObj) => {
        if (!filesObj)
            return;
        const files = filesObj;
        const pPic = files.profilePic?.[0];
        const bImg = files.bannerImage?.[0];
        if (pPic?.filename) {
            try {
                await cloudinary_1.default.uploader.destroy(pPic.filename);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
        if (bImg?.filename) {
            try {
                await cloudinary_1.default.uploader.destroy(bImg.filename);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
    };
    try {
        if (!result.success) {
            await cleanupFiles(req.files);
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid data");
        }
        const userId = req.user?._id;
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            await cleanupFiles(req.files);
            throw new errors_1.NotFoundError("User not found!");
        }
        // check if username exists
        if (result.data.username && result.data.username !== user.username) {
            const userExists = await user_model_1.User.findOne({
                username: result.data.username,
            });
            if (userExists) {
                await cleanupFiles(req.files);
                throw new errors_1.BadRequestError("Username already exists!");
            }
        }
        // Check explicit deletion flags first
        const updateData = { ...result.data };
        delete updateData.removeProfilePic;
        delete updateData.removeBannerImage;
        // Remove profile pic
        if (result.data.removeProfilePic) {
            if (user.profilePic?.public_id) {
                try {
                    await cloudinary_1.default.uploader.destroy(user.profilePic.public_id);
                }
                catch (e) {
                    logger_1.logger.error("Cloudinary deletion failed", { error: e });
                }
            }
            updateData.profilePic = { url: "", public_id: "" };
        }
        // Remove banner image
        if (result.data.removeBannerImage) {
            if (user.bannerImage?.public_id) {
                try {
                    await cloudinary_1.default.uploader.destroy(user.bannerImage.public_id);
                }
                catch (e) {
                    logger_1.logger.error("Cloudinary deletion failed", { error: e });
                }
            }
            updateData.bannerImage = { url: "", public_id: "" };
        }
        if (req.files) {
            const files = req.files;
            const newProfilePic = files.profilePic?.[0];
            const newBannerImg = files.bannerImage?.[0];
            if (newProfilePic) {
                if (user.profilePic?.public_id) {
                    try {
                        await cloudinary_1.default.uploader.destroy(user.profilePic.public_id);
                    }
                    catch (e) {
                        logger_1.logger.error("Cloudinary deletion failed", {
                            error: e,
                        });
                    }
                }
                updateData.profilePic = {
                    url: newProfilePic.path,
                    public_id: newProfilePic.filename,
                };
            }
            if (newBannerImg) {
                if (user.bannerImage?.public_id) {
                    try {
                        await cloudinary_1.default.uploader.destroy(user.bannerImage.public_id);
                    }
                    catch (e) {
                        logger_1.logger.error("Cloudinary deletion failed", {
                            error: e,
                        });
                    }
                }
                updateData.bannerImage = {
                    url: newBannerImg.path,
                    public_id: newBannerImg.filename,
                };
            }
        }
        const updatedUser = await user_model_1.User.findByIdAndUpdate(user._id, updateData, {
            new: true,
        });
        // update cache
        await (0, cache_1.clearUsersCache)();
        await (0, cache_1.clearFeedCache)();
        await (0, cache_1.deleteCache)(`auth:user:${user._id}`);
        await (0, cache_1.clearUserByIdCache)(user._id.toString());
        if (user.username) {
            await (0, cache_1.clearUserByUsernameCache)(user.username);
        }
        if (updatedUser?.username && updatedUser.username !== user.username) {
            await (0, cache_1.clearUserByUsernameCache)(updatedUser.username);
        }
        // Emit real-time profile update event so other users see changes instantly
        if (updatedUser) {
            (0, socket_1.emitUserUpdated)({
                _id: updatedUser._id,
                fullName: updatedUser.fullName,
                username: updatedUser.username,
                email: updatedUser.email,
                gender: updatedUser.gender,
                bio: updatedUser.bio,
                profilePic: updatedUser.profilePic,
                bannerImage: updatedUser.bannerImage,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully!",
            user: {
                _id: updatedUser?._id,
                fullName: updatedUser?.fullName,
                username: updatedUser?.username,
                email: updatedUser?.email,
                gender: updatedUser?.gender,
                bio: updatedUser?.bio,
                profilePic: updatedUser?.profilePic,
                bannerImage: updatedUser?.bannerImage,
            },
        });
    }
    catch (err) {
        await cleanupFiles(req.files);
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the updateProfile controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=user.controllers.js.map