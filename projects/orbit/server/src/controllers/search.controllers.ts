import type { Request, Response } from "express";
import { User } from "../models/user.model";
import Post from "../models/post.model";
import Follow from "../models/follow.model";
import { getCache, setCache } from "../configs/cache";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError } from "../utilities/errors";
import { addUserStatusToPosts } from "../utilities/postStatus";

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const q = req.query.q?.toString().trim();
    const currentUserId = req.user?._id;
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = req.query.cursor as string;
    const escapedQuery = q ? q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";

    // cache key
    const cacheKey = `search:users:${q || ""}:${cursor || "first"}:${limit}:${currentUserId?.toString() || "anon"}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in searchUsers!`, { error: err.message });
    }

    let users: any[] = [];

    if (q) {
      try {
        const textQuery: Record<string, any> = { $text: { $search: q } };
        if (currentUserId && cursor) {
          textQuery._id = { $ne: currentUserId, $lt: cursor };
        } else if (currentUserId) {
          textQuery._id = { $ne: currentUserId };
        } else if (cursor) {
          textQuery._id = { $lt: cursor };
        }
        users = await User.find(textQuery)
          .select("_id fullName username profilePic followersCount followingCount")
          .sort({ _id: -1 })
          .limit(limit + 1)
          .lean();
      } catch (textErr: any) {
        logger.info("Text search failed, falling back to regex search", { error: textErr.message });
      }

      if (users.length === 0) {
        const regexQuery: Record<string, any> = {
          $or: [
            { username: { $regex: escapedQuery, $options: "i" } },
            { fullName: { $regex: escapedQuery, $options: "i" } },
          ],
        };
        if (currentUserId && cursor) {
          regexQuery._id = { $ne: currentUserId, $lt: cursor };
        } else if (currentUserId) {
          regexQuery._id = { $ne: currentUserId };
        } else if (cursor) {
          regexQuery._id = { $lt: cursor };
        }
        users = await User.find(regexQuery)
          .select("_id fullName username profilePic followersCount followingCount")
          .sort({ _id: -1 })
          .limit(limit + 1)
          .lean();
      }
    } else {
      // No query: show all users except current
      const allUsersQuery: Record<string, any> = {};
      if (currentUserId && cursor) {
        allUsersQuery._id = { $ne: currentUserId, $lt: cursor };
      } else if (currentUserId) {
        allUsersQuery._id = { $ne: currentUserId };
      } else if (cursor) {
        allUsersQuery._id = { $lt: cursor };
      }
      users = await User.find(allUsersQuery)
        .select("_id fullName username profilePic followersCount followingCount")
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();
    }

    const hasMore = users.length > limit;
    if (hasMore) {
      users.pop();
    }
    const nextCursor = users.slice(-1).pop()?._id || null;

    // add followingByMe to each user
    const followingSet = new Set<string>();
    if (currentUserId && users.length > 0) {
      const userIds = users.map(u => u._id);
      const existingFollows = await Follow.find({
        follower: currentUserId,
        following: { $in: userIds },
      }).lean();

      existingFollows.forEach(follow => {
        followingSet.add(follow.following.toString());
      });
    }

    const usersWithStatus = users.map(user => ({
      ...user,
      followingByMe: followingSet.has(user._id.toString()),
    }));

    const responseData = {
      success: true,
      count: usersWithStatus.length,
      users: usersWithStatus,
      nextCursor,
      hasMore,
    };

    // cache search results (60s — results are relatively stable)
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in searchUsers!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the searchUsers controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

export const searchPosts = async (req: Request, res: Response) => {
  try {
    const q = req.query.q?.toString().trim();
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = req.query.cursor as string;
    const escapedQuery = q ? q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
    const currentUserId = req.user?._id?.toString();

    // cache key
    const cacheKey = `search:posts:${q || ""}:${cursor || "first"}:${limit}:${currentUserId || "anon"}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in searchPosts!`, { error: err.message });
    }

    let posts: any[] = [];

    if (q) {
      try {
        const textQuery: any = { $text: { $search: q } };
        if (cursor) {
          textQuery._id = { $lt: cursor };
        }
        posts = await Post.find(textQuery)
          .select(
            "title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug",
          )
          .populate("author", "fullName username profilePic")
          .sort({ _id: -1 })
          .limit(limit + 1)
          .lean();
      } catch (textErr: any) {
        logger.info("Text search failed, falling back to regex search", { error: textErr.message });
      }

      if (posts.length === 0) {
        // Handle hashtag search - remove # from query if present and escape regex
        const tagQuery = q.startsWith('#') ? q.slice(1) : q;
        const escapedTagQuery = tagQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regexQuery: any = { 
          visibility: "public",
          $or: [
            { title: { $regex: escapedQuery, $options: "i" } },
            { content: { $regex: escapedQuery, $options: "i" } },
            { tags: { $in: [new RegExp(escapedTagQuery, "i")] } },
            { hashtags: { $in: [new RegExp(escapedTagQuery, "i")] } }
          ]
        };
        if (cursor) {
          regexQuery._id = { $lt: cursor };
        }
        posts = await Post.find(regexQuery)
          .select(
            "title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug",
          )
          .populate("author", "fullName username profilePic")
          .sort({ _id: -1 })
          .limit(limit + 1)
          .lean();
      }
    } else {
      // If no query, show public posts
      const allPostsQuery: any = { visibility: "public" };
      if (cursor) {
        allPostsQuery._id = { $lt: cursor };
      }
      posts = await Post.find(allPostsQuery)
        .select(
          "title content image images likesCount commentsCount repostsCount createdAt author viewsCount savesCount sharesCount tags slug",
        )
        .populate("author", "fullName username profilePic")
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();
    }

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    const nextCursor = posts.slice(-1).pop()?._id || null;

    const postsWithStatus = await addUserStatusToPosts(posts, currentUserId);

    const responseData = {
      success: true,
      count: postsWithStatus.length,
      posts: postsWithStatus,
      nextCursor,
      hasMore,
    };

    // cache search results (60s)
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in searchPosts!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the searchPosts controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
