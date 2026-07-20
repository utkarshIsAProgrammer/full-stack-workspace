import type { Request, Response } from "express";
import mongoose from "mongoose";
import Repost from "../models/repost.model";
import Post from "../models/post.model";
import { User } from "../models/user.model";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";
import { emitPostRepost, emitPostUnrepost } from "../configs/socket";
import { getCache, setCache, clearByPattern, clearFeedCache } from "../configs/cache";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utilities/errors";
import { toggleRepostSchema } from "../schemas/interaction.schema";
import { addUserStatusToPosts } from "../utilities/postStatus";
import { logInteraction } from "../services/affinityService";

type Params = {
  postId: string;
};

export const getRepostedPosts = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  try {
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    const query: any = {
      user: userId,
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    // cache key
    const cacheKey = `reposts:${userId}:${cursor || "first"}:${limit}`;

    // try cache first
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in getRepostedPosts!`, { error: err.message });
    }

    const repostedPosts = await Repost.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
        path: "post",
        select:
          "title slug image author savesCount repostsCount likesCount commentsCount createdAt viewsCount sharesCount",
        populate: [
          {
            path: "author",
            select: "username fullName email profilePic",
          },
        ],
      })
      .lean();

    const mappedPosts = repostedPosts.map((repost) => ({
      ...repost.post,
      repostedByMe: true,
    }));

    const posts = await addUserStatusToPosts(mappedPosts, userId.toString());

    if (posts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No reposted posts!",
        posts: [],
      });
    }

    const hasMore = posts.length > limit;

    if (hasMore) {
      posts.pop();
    }

    const nextCursor = repostedPosts.slice(-1).shift()?._id || null;

    const responseData = {
      success: true,
      message: "Reposted posts fetched successfully!",
      posts,
      nextCursor,
      hasMore,
    };

    // set cache (short TTL since reposts can change frequently)
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in getRepostedPosts!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getRepostedPosts controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

export const toggleRepost = async (req: Request<Params>, res: Response) => {
  const userId = req.user?._id;
  const { postId } = req.params;

  try {
    const parsed = toggleRepostSchema.safeParse({ postId });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    // auth check
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // find post
    const post = await Post.findById(postId).select("_id author visibility").lean();

    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // prevent self repost
    if (post.author.toString() === userId.toString()) {
      throw new BadRequestError("You cannot repost your own post!");
    }

    // check closeFriends permission
    if ((post as any).visibility === "closeFriends") {
      const authorUser = await User.findById(post.author).select("closeFriends").lean();
      const closeFriendsList = (authorUser as any)?.closeFriends || [];
      const isCloseFriend = closeFriendsList.some((id: any) => id.toString() === userId.toString());
      if (!isCloseFriend) {
        throw new ForbiddenError("Cannot repost close friends content!");
      }
    }

    // check existing repost
    const existingRepost = await Repost.findOne({
      user: userId,
      post: postId,
    });

    // un-repost post
    if (existingRepost) {
      await existingRepost.deleteOne();

      await deleteInteractionNotification({
        recipient: post.author.toString(),
        sender: userId.toString(),
        type: "repost",
        post: postId,
      });

      // sync reposts count from Repost collection (authoritative)
      const actualRepostsCount = await Repost.countDocuments({ post: postId });
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $set: { repostsCount: actualRepostsCount } },
        { returnDocument: 'after' },
      );

      // Emit socket event
      if (updatedPost) {
        emitPostUnrepost(postId, userId.toString(), updatedPost.repostsCount);
      }

      // clear repost cache for this user
      clearByPattern(`reposts:${userId.toString()}:*`);
      await clearFeedCache();

      return res.status(200).json({
        success: true,
        message: "Repost removed!",
        reposted: false,
        repostedByMe: false,
        repostsCount: updatedPost?.repostsCount,
        post: updatedPost,
      });
    }

    // re-post post
    await Repost.create({
      user: userId,
      post: postId,
    });

    // sync reposts count from Repost collection (authoritative)
    const actualRepostsCount = await Repost.countDocuments({ post: postId });
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $set: { repostsCount: actualRepostsCount } },
      { returnDocument: 'after' },
    );

    await createNotification({
      recipient: post.author.toString(),
      sender: userId.toString(),
      type: "repost",
      post: postId,
    });      // Log interaction for feed ranking
      if (post.author.toString() !== userId.toString()) {
        logInteraction(
          userId.toString(),
          post.author.toString(),
          postId,
          "share",
          (updatedPost as any)?.hashtags || []
        );
      }

      // Emit socket event
      if (updatedPost) {
        emitPostRepost(postId, userId.toString(), updatedPost.repostsCount);
      }

      // clear repost cache for this user
      clearByPattern(`reposts:${userId.toString()}:*`);
      await clearFeedCache();

      return res.status(201).json({
        success: true,
        message: "Repost created!",
        reposted: true,
        repostedByMe: true,
        repostsCount: updatedPost?.repostsCount,
        post: updatedPost,
      });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in toggleRepost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
