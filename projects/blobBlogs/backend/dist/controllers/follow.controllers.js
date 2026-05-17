"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFollowing = exports.getFollowers = exports.toggleFollowUser = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const follow_model_1 = __importDefault(require("../models/follow.model"));
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
        const targetUser = await user_model_1.User.findById(userId);
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
        // followers list
        const followers = await follow_model_1.default.find({
            following: userId,
        })
            .sort({ createdAt: -1 })
            .populate("follower", "username email followersCount followingCount");
        // followers count
        const followersCount = await follow_model_1.default.countDocuments({
            following: userId,
        });
        return res.status(200).json({
            success: true,
            followersCount,
            followers,
        });
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
        // following list
        const following = await follow_model_1.default.find({
            follower: userId,
        })
            .sort({ createdAt: -1 })
            .populate("following", "username email followersCount followingCount");
        // following count
        const followingCount = await follow_model_1.default.countDocuments({
            follower: userId,
        });
        return res.status(200).json({
            success: true,
            followingCount,
            following,
        });
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