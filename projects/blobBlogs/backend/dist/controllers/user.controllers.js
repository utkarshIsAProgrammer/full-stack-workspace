"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewsCount = exports.shareProfile = exports.deleteAccount = exports.getAll = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const nodeMailer_1 = require("../configs/nodeMailer");
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
            query_id: {
                $lt: cursor;
            }
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
        return res.status(200).json({
            success: true,
            message: "All users fetched successfully!",
            users,
            nextCursor,
            hasMore,
        });
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
        await user_model_1.User.findByIdAndDelete(userId);
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
        const profile = await user_model_1.User.findById(userId)
            .select("_id viewsCount")
            .lean();
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
//# sourceMappingURL=user.controllers.js.map