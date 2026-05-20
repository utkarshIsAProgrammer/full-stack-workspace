"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.viewsCount = exports.shareProfile = exports.deleteAccount = exports.getAll = void 0;
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
// get all users
const getAll = async (req, res) => {
    try {
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
        // query
        const query = {};
        // if cursor exists fetch older user
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `users:${cursor || "first"}:${limit}`;
        // get from cache
        try {
            const cachedUsers = await (0, cache_1.getCache)(cacheKey);
            if (cachedUsers)
                return res.status(200).json(cachedUsers);
        }
        catch (err) {
            console.log(`Cache error in getAll users! ${err.message}`);
        }
        // fetch all users
        const users = await user_model_1.User.find(query)
            .select("-password -otp -otpExpiry")
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();
        // .populate("author", "username email");
        // check more user exits
        const hasMore = users.length > limit;
        // remove extra users
        if (hasMore) {
            users.pop();
        }
        // check empty list (user)
        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No users found!",
            });
        }
        // next cursor
        const nextCursor = users[users.length - 1]?._id || null;
        // prepare response
        const responseData = {
            success: true,
            message: "All users fetched successfully!",
            users,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            console.log(`Cache set error in getAll users! ${err.message}`);
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        console.log(`Error in the getAll users controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getAll = getAll;
// delete account
const deleteAccount = async (req, res) => {
    const result = user_schema_1.deleteAccountSchema.safeParse(req.body);
    try {
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid Data!",
            });
        }
        // find user and verify credentials
        const user = await user_model_1.User.findOne({ email: result.data.email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found!",
            });
        }
        const isMatch = await user.comparePassword(result.data.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials!",
            });
        }
        // get user id from the auth middleware
        const userId = req.user?._id;
        // delete profile pic and banner image from cloudinary
        if (user.profilePic?.public_id) {
            try {
                await cloudinary_1.default.uploader.destroy(user.profilePic.public_id);
            }
            catch (e) { }
        }
        if (user.bannerImage?.public_id) {
            try {
                await cloudinary_1.default.uploader.destroy(user.bannerImage.public_id);
            }
            catch (e) { }
        }
        // handle orphaned cloudinary images from posts
        const userPosts = await post_model_1.default.find({ author: userId });
        for (const post of userPosts) {
            if (post.image?.public_id) {
                try {
                    await cloudinary_1.default.uploader.destroy(post.image.public_id);
                }
                catch (e) { }
            }
        }
        // Delete orphaned data
        await post_model_1.default.deleteMany({ author: userId });
        await comment_model_1.default.deleteMany({ author: userId });
        await like_model_1.default.deleteMany({ user: userId });
        await saves_model_1.default.deleteMany({ user: userId });
        await repost_model_1.default.deleteMany({ user: userId });
        await follow_model_1.default.deleteMany({
            $or: [{ follower: userId }, { following: userId }],
        });
        await user_model_1.User.findByIdAndDelete(userId);
        // clear users cache
        await (0, cache_1.clearUsersCache)();
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
        console.log(`Error in the deleteAccount controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.deleteAccount = deleteAccount;
// share profile
const shareProfile = async (req, res) => {
    const { userId } = req.params;
    try {
        // validate id
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user id!",
            });
        }
        // increment share count
        const user = await user_model_1.User.findByIdAndUpdate(userId, {
            $inc: { sharesCount: 1 },
        }, { new: true });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found!",
            });
        }
        // generate url
        const shareUrl = `${process.env.CLIENT_URL}/user/${user.username}`;
        res.status(200).json({
            success: true,
            message: "Profile shared successfully!",
            shares: user.sharesCount,
            shareUrl,
        });
    }
    catch (err) {
        console.log(`Error in the shareProfile controller! ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Internal server error!",
        });
    }
};
exports.shareProfile = shareProfile;
const viewsCount = async (req, res) => {
    const { userId } = req.params;
    const currentUser = req.user?._id;
    try {
        // validate post
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user Id!",
            });
        }
        // check post exists
        const profile = await user_model_1.User.findById(userId).select("_id viewsCount").lean();
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Profile not found!",
            });
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
        res.status(200).json({
            success: true,
            message: "View counted successfully!",
            views: updatedProfile?.viewsCount,
        });
    }
    catch (err) {
        console.log(`Error in the viewsCount controller! ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Internal server error!",
        });
    }
};
exports.viewsCount = viewsCount;
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
            catch (e) { }
        }
        if (bImg?.filename) {
            try {
                await cloudinary_1.default.uploader.destroy(bImg.filename);
            }
            catch (e) { }
        }
    };
    try {
        if (!result.success) {
            await cleanupFiles(req.files);
            return res.status(400).json({
                success: false,
                message: "Invalid data",
                error: result.error.issues,
            });
        }
        const userId = req.user?._id;
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            await cleanupFiles(req.files);
            return res
                .status(404)
                .json({ success: false, message: "User not found!" });
        }
        // check if username exists
        if (result.data.username && result.data.username !== user.username) {
            const userExists = await user_model_1.User.findOne({ username: result.data.username });
            if (userExists) {
                await cleanupFiles(req.files);
                return res
                    .status(400)
                    .json({ success: false, message: "Username already exists!" });
            }
        }
        const updateData = { ...result.data };
        if (req.files) {
            const files = req.files;
            const newProfilePic = files.profilePic?.[0];
            const newBannerImg = files.bannerImage?.[0];
            if (newProfilePic) {
                if (user.profilePic?.public_id) {
                    try {
                        await cloudinary_1.default.uploader.destroy(user.profilePic.public_id);
                    }
                    catch (e) { }
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
                    catch (e) { }
                }
                updateData.bannerImage = {
                    url: newBannerImg.path,
                    public_id: newBannerImg.filename,
                };
            }
        }
        const updatedUser = await user_model_1.User.findByIdAndUpdate(userId, updateData, {
            new: true,
        });
        // update cache
        await (0, cache_1.clearUsersCache)();
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
        console.log(`Error in the updateProfile controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.updateProfile = updateProfile;
//# sourceMappingURL=user.controllers.js.map