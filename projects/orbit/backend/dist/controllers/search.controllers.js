"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPosts = exports.searchUsers = void 0;
const user_model_1 = require("../models/user.model");
const post_model_1 = __importDefault(require("../models/post.model"));
const searchUsers = async (req, res) => {
    try {
        // search query
        const q = req.query.q?.toString().trim();
        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Search query required!",
            });
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        // search user
        const users = await user_model_1.User.find({
            $text: { $search: q },
        })
            .select("_id fullName username profilePic followersCount followingCount")
            .sort({ followersCount: -1 })
            .limit(limit)
            .lean();
        return res.status(200).json({
            success: true,
            count: users.length,
            users,
        });
    }
    catch (err) {
        console.log(`Error in the searchUsers controller! ${err.message}`);
        return res.status(500).json({ message: "Internal server error!" });
    }
};
exports.searchUsers = searchUsers;
const searchPosts = async (req, res) => {
    try {
        // query
        const q = req.query.q?.toString().trim();
        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Search query required!",
            });
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        // search post
        const posts = await post_model_1.default.find({
            $text: { $search: q },
        })
            .select("title image likesCount commentsCount repostsCount createdAt author ")
            .populate("author", "fullName username profilePic")
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return res.status(200).json({
            success: true,
            count: posts.length,
            posts,
        });
    }
    catch (err) {
        console.log(`Error in the searchPosts controller! ${err.message}`);
        return res.status(500).json({ message: "Internal server error!" });
    }
};
exports.searchPosts = searchPosts;
//# sourceMappingURL=search.controllers.js.map