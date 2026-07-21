import type { Request, Response } from "express";
import { User } from "../models/user.model";
import Post from "../models/post.model";
import { AppError } from "../utilities/errors";
import { getCache, setCache } from "../configs/cache";
import { logger } from "../utilities/logger";

/**
 * GET /api/trending/users
 * Fastest-growing accounts by follower velocity in the last 7 days.
 */
export const getTrendingUsers = async (req: Request, res: Response) => {
  try {
    const cacheKey = "trending:users";
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const users = await User.find({
      createdAt: { $lte: sevenDaysAgo },
      followersCount: { $gte: 1 },
    })
      .select("username fullName profilePic bio followersCount createdAt")
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(20)
      .lean();

    const result = {
      success: true,
      users: users.map((u) => ({
        _id: u._id,
        username: u.username,
        fullName: u.fullName,
        profilePic: u.profilePic,
        bio: u.bio,
        followersCount: u.followersCount,
      })),
    };

    await setCache(cacheKey, result, 300);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error("Error in getTrendingUsers", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/trending/topics
 * Topic clusters beyond hashtags — computed from post content co-occurrence.
 */
export const getTrendingTopics = async (req: Request, res: Response) => {
  try {
    const cacheKey = "trending:topics";
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Aggregate hashtags from recent posts
    const topics = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          hashtags: { $exists: true, $not: { $size: 0 } },
          status: "published",
        },
      },
      { $unwind: "$hashtags" },
      {
        $group: {
          _id: "$hashtags",
          count: { $sum: 1 },
          recentPosts: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          tag: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    const result = {
      success: true,
      topics: topics.map((t) => ({
        tag: t.tag,
        postCount: t.count,
      })),
    };

    await setCache(cacheKey, result, 300);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error("Error in getTrendingTopics", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
