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
// toggle follow/unfollow user
const toggleFollowUser = async (req, res) => {
    const follower = req.user?._id;
    const { userId } = req.params;
    try {
        // auth check
        if (!follower) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID!",
            });
        }
        // prevent self follow
        if (follower.toString() === userId) {
            return res.status(400).json({
                success: false,
                message: "You cannot follow yourself!",
            });
        }
        // check target user exists
        const targetUser = await user_model_1.User.findById(userId).select("_id").lean();
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found!",
            });
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
            // increment counts
            const updatedTargetUser = await user_model_1.User.findByIdAndUpdate(userId, {
                $inc: { followersCount: 1 },
            }, { new: true });
            await user_model_1.User.findByIdAndUpdate(follower, {
                $inc: { followingCount: 1 },
            });
            // clear cache
            await (0, cache_1.clearFollowCache)(userId, follower.toString());
            return res.status(201).json({
                success: true,
                message: "User followed successfully!",
                following: true,
                followersCount: updatedTargetUser?.followersCount,
                follow,
            });
        }
        // unfollow
        await existingFollow.deleteOne();
        const updatedTargetUser = await user_model_1.User.findByIdAndUpdate(userId, {
            $inc: { followersCount: -1 },
        }, { new: true });
        await user_model_1.User.findByIdAndUpdate(follower, {
            $inc: { followingCount: -1 },
        });
        // clear cache
        await (0, cache_1.clearFollowCache)(userId, follower.toString());
        return res.status(200).json({
            success: true,
            message: "User unfollowed successfully!",
            following: false,
            followersCount: updatedTargetUser?.followersCount,
        });
    }
    catch (err) {
        console.log(`Error in the toggleFollowUser controller! ${err.message}`);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error!",
        });
    }
};
exports.toggleFollowUser = toggleFollowUser;
// get followers list
const getFollowers = async (req, res) => {
    const { userId } = req.params;
    try {
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID!",
            });
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
            console.log(`Cache error in getFollowers! ${err.message}`);
        }
        // followers list
        const followers = await follow_model_1.default.find({
            following: userId,
            ...query,
        })
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate("follower", "username email followersCount followingCount")
            .lean();
        // check more exists
        const hasMore = followers.length > limit;
        // remove extra data
        if (hasMore) {
            followers.pop();
        }
        // next cursor
        const nextCursor = followers[followers.length - 1]?._id || null;
        // followers count
        const followersCount = await follow_model_1.default.countDocuments({
            following: userId,
        });
        const responseData = {
            success: true,
            followersCount,
            followers,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            console.log(`Cache set error in getFollowers! ${err.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in getFollowers controller! ${err.message}`);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error!",
        });
    }
};
exports.getFollowers = getFollowers;
// get following list
const getFollowing = async (req, res) => {
    const { userId } = req.params;
    try {
        // validate user id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID!",
            });
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
            console.log(`Cache error in getFollowing! ${err.message}`);
        }
        // following list
        const following = await follow_model_1.default.find({
            follower: userId,
            ...query,
        })
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate("following", "username email followersCount followingCount")
            .lean();
        // check more exists
        const hasMore = following.length > limit;
        // remove extra data
        if (hasMore) {
            following.pop();
        }
        // following count
        const followingCount = await follow_model_1.default.countDocuments({
            follower: userId,
        });
        // next cursor
        const nextCursor = following[following.length - 1]?._id || null;
        const responseData = {
            success: true,
            followingCount,
            following,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            console.log(`Cache set error in getFollowing! ${err.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in getFollowing controller! ${err.message}`);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error!",
        });
    }
};
exports.getFollowing = getFollowing;
//# sourceMappingURL=follow.controllers.js.map