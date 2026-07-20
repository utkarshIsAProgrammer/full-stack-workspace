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

    const collections = await Collection.find({ user: currentUserId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, collections });
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

    const collection = await Collection.findById(collectionId)
      .populate({
        path: "posts",
        populate: { path: "author", select: "username fullName profilePic" },
      })
      .lean();

    if (!collection) return next(new NotFoundError("Collection not found!"));
    if ((collection as any).user.toString() !== currentUserId.toString()) {
      return next(new BadRequestError("You can only view your own collections!"));
    }

    return res.status(200).json({ success: true, posts: (collection as any).posts || [] });
  } catch (err: any) {
    logger.error("Error getting collection posts", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};
