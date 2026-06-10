"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaveFolders = exports.updateSaveFolder = exports.getSavedPosts = exports.toggleSavePost = void 0;
const post_model_1 = __importDefault(require("../models/post.model"));
const saves_model_1 = __importDefault(require("../models/saves.model"));
const cache_1 = require("../configs/cache");
const notification_1 = require("../utilities/notification");
const socket_1 = require("../configs/socket");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const interaction_schema_1 = require("../schemas/interaction.schema");
const postStatus_1 = require("../utilities/postStatus");
const toggleSavePost = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;
    const folder = req.body?.folder?.trim() || "General";
    try {
        // validate input (req.body can be undefined)
        const parsed = interaction_schema_1.toggleSaveSchema.safeParse(req.body || {});
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        // check user auth
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // check post exists
        const post = await post_model_1.default.findById(postId).select("_id author").lean();
        if (!post) {
            throw new errors_1.NotFoundError("Post not found!");
        }
        // check user already saved this post
        const alreadySaved = await saves_model_1.default.findOne({
            user: userId,
            post: postId,
        });
        // unsave post
        if (alreadySaved) {
            await alreadySaved.deleteOne();
            await (0, notification_1.deleteInteractionNotification)({
                recipient: post.author.toString(),
                sender: userId.toString(),
                type: "save",
                post: postId,
            });
            // sync saves count from Save collection (authoritative)
            const actualSavesCount = await saves_model_1.default.countDocuments({ post: postId });
            const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $set: { savesCount: actualSavesCount } }, { new: true });
            // emit socket event
            if (updatedPost) {
                (0, socket_1.emitPostUnsave)(postId, userId.toString(), updatedPost.savesCount);
            }
            // clear cache
            await (0, cache_1.clearSavesCache)(userId.toString());
            return res.status(200).json({
                success: true,
                message: "Post unsaved!",
                saved: false,
                savedByMe: false,
                savesCount: updatedPost?.savesCount,
                post: updatedPost,
            });
        }
        // save post
        await saves_model_1.default.create({
            user: userId,
            post: postId,
            folder,
        });
        // sync saves count from Save collection (authoritative)
        const actualSavesCount = await saves_model_1.default.countDocuments({ post: postId });
        const updatedPost = await post_model_1.default.findByIdAndUpdate(postId, { $set: { savesCount: actualSavesCount } }, { new: true });
        await (0, notification_1.createNotification)({
            recipient: post.author.toString(),
            sender: userId.toString(),
            type: "save",
            post: postId,
        });
        // emit socket event
        if (updatedPost) {
            (0, socket_1.emitPostSave)(postId, userId.toString(), updatedPost.savesCount);
        }
        await (0, cache_1.clearSavesCache)(userId.toString());
        return res.status(201).json({
            success: true,
            message: "Post saved!",
            saved: true,
            savedByMe: true,
            savesCount: updatedPost?.savesCount,
            folder,
            post: updatedPost,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the toggleSavePost controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.toggleSavePost = toggleSavePost;
const getSavedPosts = async (req, res) => {
    const userId = req.user?._id;
    try {
        //  check user auth
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        const cursor = req.query.cursor;
        const folder = req.query.folder;
        // query
        const query = {
            user: userId,
        };
        // filter by folder if specified
        if (folder) {
            query.folder = folder;
        }
        // if cursor exists fetch older saves
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // cache key
        const cacheKey = `saves:${userId}:${folder || "all"}:${cursor || "first"}:${limit}`;
        // get from cache
        try {
            const cachedSaves = await (0, cache_1.getCache)(cacheKey);
            if (cachedSaves)
                return res.status(200).json(cachedSaves);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getSavedPosts!`, { error: err.message });
        }
        // find saved posts — also select folder
        const savedPosts = await saves_model_1.default.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .select("post folder createdAt")
            .populate({
            path: "post",
            select: "title slug image images author savesCount repostsCount likesCount commentsCount createdAt viewsCount sharesCount",
            populate: [
                {
                    path: "author",
                    select: "username fullName email profilePic",
                },
            ],
        })
            .lean();
        // Map saved posts to post data with folder info and savedByMe flag
        const mappedPosts = savedPosts.map((save) => ({
            ...save.post,
            savedFolder: save.folder,
            savedAt: save.createdAt,
            savedByMe: true,
        }));
        const posts = await (0, postStatus_1.addUserStatusToPosts)(mappedPosts, userId.toString());
        // no posts saved
        if (posts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No saved posts!",
                posts: [],
                folders: [],
            });
        }
        // check has more
        const hasMore = posts.length > limit;
        // remove extra item
        if (hasMore) {
            posts.pop();
        }
        // next cursor
        const nextCursor = savedPosts.slice(-1).shift()?._id || null;
        // get all unique folder names for this user
        const folders = await saves_model_1.default.distinct("folder", { user: userId });
        const responseData = {
            success: true,
            message: "Saved posts fetched successfully!",
            posts,
            folders,
            nextCursor,
            hasMore,
        };
        // set cache
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 60);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getSavedPosts!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the getSavedPosts controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getSavedPosts = getSavedPosts;
// update save folder for a saved post
const updateSaveFolder = async (req, res) => {
    const { postId } = req.params;
    const userId = req.user?._id;
    const { folder } = req.body;
    try {
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        const parsed = interaction_schema_1.updateSaveFolderSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new errors_1.BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
        }
        const trimmedFolder = parsed.data.folder.trim().substring(0, 50);
        const save = await saves_model_1.default.findOne({ user: userId, post: postId });
        if (!save) {
            throw new errors_1.NotFoundError("Save not found!");
        }
        save.folder = trimmedFolder;
        await save.save();
        await (0, cache_1.clearSavesCache)(userId.toString());
        return res.status(200).json({
            success: true,
            message: "Save folder updated!",
            folder: trimmedFolder,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in updateSaveFolder controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.updateSaveFolder = updateSaveFolder;
// get all unique folders for the current user
const getSaveFolders = async (req, res) => {
    const userId = req.user?._id;
    try {
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized!");
        }
        // cache key
        const cacheKey = `saves:${userId.toString()}:folders`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getSaveFolders!`, { error: err.message });
        }
        const folders = await saves_model_1.default.distinct("folder", { user: userId });
        // get counts per folder (in parallel)
        const folderCountEntries = await Promise.all(folders.map(async (folder) => {
            const count = await saves_model_1.default.countDocuments({ user: userId, folder });
            return { name: folder, count };
        }));
        const responseData = {
            success: true,
            folders: folderCountEntries,
        };
        // set cache (5 min — folder names are stable)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 300);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getSaveFolders!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getSaveFolders controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getSaveFolders = getSaveFolders;
//# sourceMappingURL=saves.controllers.js.map