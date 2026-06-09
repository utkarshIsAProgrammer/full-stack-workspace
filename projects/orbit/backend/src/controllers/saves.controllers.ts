import type { Request, Response } from "express";
import mongoose from "mongoose";
import Post from "../models/post.model";
import Save from "../models/saves.model";
import { getCache, setCache, clearSavesCache } from "../configs/cache";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";
import { emitPostSave, emitPostUnsave } from "../configs/socket";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";
import { toggleSaveSchema, updateSaveFolderSchema } from "../schemas/interaction.schema";
import { addUserStatusToPosts } from "../utilities/postStatus";

type Params = {
  postId: string;
};

export const toggleSavePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const userId = req.user?._id;
  const folder = (req.body?.folder as string)?.trim() || "General";

  try {
    // validate input (req.body can be undefined)
    const parsed = toggleSaveSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    // check user auth
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // check post exists
    const post = await Post.findById(postId).select("_id author").lean();
    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // check user already saved this post
    const alreadySaved = await Save.findOne({
      user: userId,
      post: postId,
    });

    // unsave post
    if (alreadySaved) {
      await alreadySaved.deleteOne();

      await deleteInteractionNotification({
        recipient: post.author.toString(),
        sender: userId.toString(),
        type: "save",
        post: postId,
      });

      // sync saves count from Save collection (authoritative)
      const actualSavesCount = await Save.countDocuments({ post: postId });
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $set: { savesCount: actualSavesCount } },
        { new: true },
      );

      // emit socket event
      if (updatedPost) {
        emitPostUnsave(postId, userId.toString(), updatedPost.savesCount);
      }

      // clear cache
      await clearSavesCache(userId.toString());

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
    await Save.create({
      user: userId,
      post: postId,
      folder,
    });

    // sync saves count from Save collection (authoritative)
    const actualSavesCount = await Save.countDocuments({ post: postId });
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $set: { savesCount: actualSavesCount } },
      { new: true },
    );

    await createNotification({
      recipient: post.author.toString(),
      sender: userId.toString(),
      type: "save",
      post: postId,
    });

    // emit socket event
    if (updatedPost) {
      emitPostSave(postId, userId.toString(), updatedPost.savesCount);
    }

    await clearSavesCache(userId.toString());

    return res.status(201).json({
      success: true,
      message: "Post saved!",
      saved: true,
      savedByMe: true,
      savesCount: updatedPost?.savesCount,
      folder,
      post: updatedPost,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the toggleSavePost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

export const getSavedPosts = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  try {
    //  check user auth
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;
    const folder = req.query.folder as string;

    // query
    const query: any = {
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
      const cachedSaves = await getCache(cacheKey);
      if (cachedSaves) return res.status(200).json(cachedSaves);
    } catch (err: any) {
      logger.error(`Cache error in getSavedPosts!`, { error: err.message });
    }

    // find saved posts — also select folder
    const savedPosts = await Save.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("post folder createdAt")
      .populate({
        path: "post",
        select:
          "title slug image images author savesCount repostsCount likesCount commentsCount createdAt viewsCount sharesCount",
        populate: [
          {
            path: "author",
            select: "username fullName email profilePic",
          },
        ],
      })
      .lean();

    // Map saved posts to post data with folder info and savedByMe flag
    const mappedPosts = savedPosts.map((save: any) => ({
      ...save.post,
      savedFolder: save.folder,
      savedAt: save.createdAt,
      savedByMe: true,
    }));

    const posts = await addUserStatusToPosts(mappedPosts, userId.toString());

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
    const folders = await Save.distinct("folder", { user: userId });

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
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in getSavedPosts!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the getSavedPosts controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// update save folder for a saved post
export const updateSaveFolder = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const userId = req.user?._id;
  const { folder } = req.body;

  try {
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const parsed = updateSaveFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    const trimmedFolder = parsed.data.folder.trim().substring(0, 50);

    const save = await Save.findOne({ user: userId, post: postId });
    if (!save) {
      throw new NotFoundError("Save not found!");
    }

    save.folder = trimmedFolder;
    await save.save();

    await clearSavesCache(userId.toString());

    return res.status(200).json({
      success: true,
      message: "Save folder updated!",
      folder: trimmedFolder,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in updateSaveFolder controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get all unique folders for the current user
export const getSaveFolders = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  try {
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // cache key
    const cacheKey = `saves:${userId.toString()}:folders`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in getSaveFolders!`, { error: err.message });
    }

    const folders = await Save.distinct("folder", { user: userId });

    // get counts per folder (in parallel)
    const folderCountEntries = await Promise.all(
      folders.map(async (folder) => {
        const count = await Save.countDocuments({ user: userId, folder });
        return { name: folder, count };
      })
    );

    const responseData = {
      success: true,
      folders: folderCountEntries,
    };

    // set cache (5 min — folder names are stable)
    try {
      await setCache(cacheKey, responseData, 300);
    } catch (err: any) {
      logger.error(`Cache set error in getSaveFolders!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getSaveFolders controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
