"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleRepost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const repost_model_1 = __importDefault(require("../models/repost.model"));
const post_model_1 = __importDefault(require("../models/post.model"));
const notification_1 = require("../utilities/notification");
const toggleRepost = async (req, res) => {
    const userId = req.user?._id;
    const { postId } = req.params;
    try {
        // auth check
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized!",
            });
        }
        // validate post id
        if (!mongoose_1.default.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post id!",
            });
        }
        // find post
        const post = await post_model_1.default.findById(postId).select("_id author").lean();
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found!",
            });
        }
        // prevent self repost
        if (post.author.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot repost your own post!",
            });
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
            const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { repostsCount: -1 } }, { new: true });
            return res.status(200).json({
                success: true,
                message: "Repost removed!",
                reposted: false,
                repostsCount: updatedPost?.repostsCount,
                post: updatedPost,
            });
        }
        // re-post post
        await repost_model_1.default.create({
            user: userId,
            post: postId,
        });
        // increment repost count
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $inc: { repostsCount: 1 } }, { new: true });
        await (0, notification_1.createNotification)({
            recipient: post.author.toString(),
            sender: userId.toString(),
            type: "repost",
            post: postId,
        });
        return res.status(201).json({
            success: true,
            message: "Repost created!",
            reposted: true,
            repostsCount: updatedPost?.repostsCount,
            post: updatedPost,
        });
    }
    catch (err) {
        console.log(`Error in toggleRepost controller! ${err.message}`);
        return res.status(500).json({
            message: "Internal server error!",
        });
    }
};
exports.toggleRepost = toggleRepost;
//# sourceMappingURL=repost.controllers.js.map