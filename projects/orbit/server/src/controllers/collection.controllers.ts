import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import Collection from "../models/collection.model";
import Post from "../models/post.model";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";

export const createCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { name } = req.body;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));
    if (!name || typeof name !== "string" || !name.trim()) {
      return next(new BadRequestError("Collection name is required!"));
    }
    if (name.trim().length > 100) {
      return next(new BadRequestError("Collection name cannot exceed 100 characters!"));
    }

    const collection = new Collection({ user: currentUserId, name: name.trim() });
    await collection.save();

    return res.status(201).json({ success: true, collection });
  } catch (err: any) {
    logger.error("Error creating collection", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getCollections = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor: string | undefined = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const query: any = { user: currentUserId };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const collections = await Collection.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = collections.length > limit;
    if (hasMore) {
      collections.pop();
    }
    const nextCursor = collections.slice(-1).shift()?._id || null;

    return res.status(200).json({ success: true, collections, hasMore, nextCursor });
  } catch (err: any) {
    logger.error("Error getting collections", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const addPostToCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { collectionId, postId } = req.params;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const collection = await Collection.findById(collectionId);
    if (!collection) return next(new NotFoundError("Collection not found!"));
    if (collection.user.toString() !== currentUserId.toString()) {
      return next(new BadRequestError("You can only add posts to your own collections!"));
    }

    const post = await Post.findById(postId).populate("author", "closeFriends");
    if (!post) return next(new NotFoundError("Post not found!"));

    if (post.visibility === "closeFriends") {
      const authorId = (post.author as any)?._id?.toString() || post.author?.toString();
      const currentUserIdStr = currentUserId.toString();
      if (authorId !== currentUserIdStr) {
        const closeFriendsList = (post.author as any)?.closeFriends || [];
        const isCloseFriend = closeFriendsList.some((id: any) => id.toString() === currentUserIdStr);
        if (!isCloseFriend) {
          return next(new ForbiddenError("You are not authorized to view or collect this post!"));
        }
      }
    }

    if (collection.posts.some((p) => p.toString() === postId)) {
      return res.status(200).json({ success: true, message: "Post already in collection!" });
    }

    collection.posts.push(post._id);
    await collection.save();

    return res.status(200).json({ success: true, collection });
  } catch (err: any) {
    logger.error("Error adding post to collection", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const removePostFromCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { collectionId, postId } = req.params;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const collection = await Collection.findById(collectionId);
    if (!collection) return next(new NotFoundError("Collection not found!"));
    if (collection.user.toString() !== currentUserId.toString()) {
      return next(new BadRequestError("You can only remove posts from your own collections!"));
    }

    collection.posts = collection.posts.filter((p) => p.toString() !== postId);
    await collection.save();

    return res.status(200).json({ success: true, collection });
  } catch (err: any) {
    logger.error("Error removing post from collection", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const deleteCollection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { collectionId } = req.params;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const collection = await Collection.findById(collectionId);
    if (!collection) return next(new NotFoundError("Collection not found!"));
    if (collection.user.toString() !== currentUserId.toString()) {
      return next(new BadRequestError("You can only delete your own collections!"));
    }

    await Collection.findByIdAndDelete(collectionId);

    return res.status(200).json({ success: true, message: "Collection deleted!" });
  } catch (err: any) {
    logger.error("Error deleting collection", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getCollectionPosts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { collectionId } = req.params;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));
    if (typeof collectionId !== "string" || !mongoose.Types.ObjectId.isValid(collectionId)) {
      return next(new BadRequestError("Invalid collection ID!"));
    }

    const collection = await Collection.findById(collectionId).select("user posts").lean();
    if (!collection) return next(new NotFoundError("Collection not found!"));
    if (collection.user.toString() !== currentUserId.toString()) {
      return next(new BadRequestError("You can only view your own collections!"));
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    // Get a slice of the posts array using cursor
    const postIds: any[] = collection.posts || [];
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = postIds.findIndex(
        (p) => p.toString() === cursor
      );
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const slicedIds = postIds.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < postIds.length;
    const nextCursor = hasMore ? postIds[startIndex + limit - 1]?.toString() || null : null;

    // Fetch the sliced posts with author populated
    const posts = await Post.find({ _id: { $in: slicedIds } })
      .populate("author", "username fullName profilePic")
      .sort({ _id: -1 })
      .lean();

    return res.status(200).json({ success: true, posts, hasMore, nextCursor });
  } catch (err: any) {
    logger.error("Error getting collection posts", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};
