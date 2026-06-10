"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFollowing = exports.getFollowers = exports.toggleFollowUser = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const follow_model_1 = __importDefault(require("../models/follow.model"));
const cache_1 = require("../configs/cache");
const notification_1 = require("../utilities/notification");
const logger_1 = require("../utilities/logger");
const socket_1 = require("../configs/socket");
const errors_1 = require("../utilities/errors");
// toggle follow/unfollow user
const toggleFollowUser = async (req, res) => {
    const follower = req.user?._id;
    const { userId } = req.params;
    try {
        // auth check
        if (!follower) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user ID!");
        }
        // prevent self follow
        if (follower.toString() === userId) {
            throw new errors_1.BadRequestError("You cannot follow yourself!");
        }
        // check target user exists
        const targetUser = await user_model_1.User.findById(userId).select("_id").lean();
        if (!targetUser) {
            throw new errors_1.NotFoundError("User not found!");
        }
        // check existing follow
        const existingFollow = await follow_model_1.default.findOne({
            follower,
            following: userId,
        });
        // follow
        if (!existingFollow) {
            // create follow relation
            const follow = await follow_model_1.default.create({
                follower,
                following: userId,
            });
            // sync counts from Follow collection (authoritative)
            const [actualTargetFollowers, actualFollowerFollowing] = await Promise.all([
                follow_model_1.default.countDocuments({ following: userId }),
                follow_model_1.default.countDocuments({ follower }),
            ]);
            const updatedTargetUser = await user_model_1.User.findByIdAndUpdate(userId, { $set: { followersCount: actualTargetFollowers } }, { new: true });
            await user_model_1.User.findByIdAndUpdate(follower, {
                $set: { followingCount: actualFollowerFollowing },
            });
            await (0, notification_1.createNotification)({
                recipient: userId,
                sender: follower.toString(),
                type: "follow",
            });
            // clear cache
            await (0, cache_1.clearFollowCache)(userId, follower.toString());
            // emit follow event
            if (updatedTargetUser) {
                (0, socket_1.emitFollowUser)(userId, follower.toString(), updatedTargetUser.followersCount);
            }
            return res.status(201).json({
                success: true,
                message: "User followed successfully!",
                following: true,
                followersCount: updatedTargetUser?.followersCount,
                follow,
            });
        }
        await existingFollow.deleteOne();
        await (0, notification_1.deleteInteractionNotification)({
            recipient: userId,
            sender: follower.toString(),
            type: "follow",
        });
        // sync counts from Follow collection (authoritative)
        const [actualTargetFollowers, actualFollowerFollowing] = await Promise.all([
            follow_model_1.default.countDocuments({ following: userId }),
            follow_model_1.default.countDocuments({ follower }),
        ]);
        const updatedTargetUser = await user_model_1.User.findByIdAndUpdate(userId, { $set: { followersCount: actualTargetFollowers } }, { new: true });
        await user_model_1.User.findByIdAndUpdate(follower, {
            $set: { followingCount: actualFollowerFollowing },
        });
        // clear cache
        await (0, cache_1.clearFollowCache)(userId, follower.toString());
        // emit unfollow event
        if (updatedTargetUser) {
            (0, socket_1.emitUnfollowUser)(userId, follower.toString(), updatedTargetUser.followersCount);
        }
        return res.status(200).json({
            success: true,
            message: "User unfollowed successfully!",
            following: false,
            followersCount: updatedTargetUser?.followersCount,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the toggleFollowUser controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.toggleFollowUser = toggleFollowUser;
// get followers list
const getFollowers = async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id;
    try {
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user ID!");
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        // query
        const query = {};
        // if cursor exist fetch older data
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `followers:${userId}:${cursor || "first"}:${limit}`;
        // get from cache
        try {
            const cachedFollowers = await (0, cache_1.getCache)(cacheKey);
            if (cachedFollowers)
                return res.status(200).json(cachedFollowers);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getFollowers!`, { error: err.message });
        }
        // followers list
        const followers = await follow_model_1.default.find({
            following: userId,
            ...query,
        })
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("follower", "_id username fullName profilePic bio followersCount followingCount createdAt")
            .lean();
        // check more exists
        const hasMore = followers.length > limit;
        // remove extra data
        if (hasMore) {
            followers.pop();
        }
        // get follower ids to check if current user follows them
        const followerIds = followers.map((f) => f.follower?._id).filter(Boolean);
        // get following status for current user
        const followingSet = new Set();
        if (currentUserId && followerIds.length > 0) {
            const existingFollows = await follow_model_1.default.find({
                follower: currentUserId,
                following: { $in: followerIds },
            }).lean();
            existingFollows.forEach((follow) => {
                followingSet.add(follow.following.toString());
            });
        }
        // add isFollowing to each follower
        const followersWithStatus = followers.map((follow) => ({
            ...follow,
            follower: follow.follower ? {
                ...follow.follower,
                isFollowing: followingSet.has(follow.follower._id.toString()),
            } : null,
        }));
        // next cursor
        const nextCursor = followers.slice(-1).shift()?._id || null;
        // get actual followers count from Follow collection (authoritative)
        const followersCount = await follow_model_1.default.countDocuments({ following: userId });
        const responseData = {
            success: true,
            followersCount,
            followers: followersWithStatus,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getFollowers!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getFollowers controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getFollowers = getFollowers;
// get following list
const getFollowing = async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id;
    try {
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new errors_1.BadRequestError("Invalid user ID!");
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        // query
        const query = {};
        // if cursor exists fetch old data
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `following:${userId}:${cursor || "first"}:${limit}`;
        // get from cache
        try {
            const cachedFollowing = await (0, cache_1.getCache)(cacheKey);
            if (cachedFollowing)
                return res.status(200).json(cachedFollowing);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getFollowing!`, { error: err.message });
        }
        // following list
        const following = await follow_model_1.default.find({
            follower: userId,
            ...query,
        })
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("following", "_id username fullName profilePic bio followersCount followingCount createdAt")
            .lean();
        // check more exists
        const hasMore = following.length > limit;
        // remove extra data
        if (hasMore) {
            following.pop();
        }
        // get following ids to check if current user follows them
        const followingIds = following.map((f) => f.following?._id).filter(Boolean);
        // get following status for current user
        const followingSet = new Set();
        if (currentUserId && followingIds.length > 0) {
            const existingFollows = await follow_model_1.default.find({
                follower: currentUserId,
                following: { $in: followingIds },
            }).lean();
            existingFollows.forEach((follow) => {
                followingSet.add(follow.following.toString());
            });
        }
        // add isFollowing to each following user
        const followingWithStatus = following.map((follow) => ({
            ...follow,
            following: follow.following ? {
                ...follow.following,
                isFollowing: followingSet.has(follow.following._id.toString()) || (currentUserId && userId.toString() === currentUserId.toString()),
            } : null,
        }));
        // get actual following count from Follow collection (authoritative)
        const followingCount = await follow_model_1.default.countDocuments({ follower: userId });
        // next cursor
        const nextCursor = following.slice(-1).shift()?._id || null;
        const responseData = {
            success: true,
            followingCount,
            following: followingWithStatus,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getFollowing!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getFollowing controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getFollowing = getFollowing;
//# sourceMappingURL=follow.controllers.js.map