import type { Request, Response } from "express";
import mongoose from "mongoose";
import { AnalyticsEvent } from "../models/analyticsEvent.model";
import { User } from "../models/user.model";
import Post from "../models/post.model";
import { AppError, BadRequestError, UnauthorizedError } from "../utilities/errors";
import { getCache, setCache } from "../configs/cache";
import { logger } from "../utilities/logger";

/**
 * GET /api/analytics/overview
 * Total views, likes, followers, posts for the current user.
 */
export const getAnalyticsOverview = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const cacheKey = `analytics:overview:${currentUserId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const userId = currentUserId.toString();

    const [totalViews, totalLikes, totalComments, user, postCount] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { target: currentUserId, event: "profile_view" } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).option({ maxTimeMS: 5000 }),
      AnalyticsEvent.aggregate([
        { $match: { target: currentUserId, event: "like" } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).option({ maxTimeMS: 5000 }),
      AnalyticsEvent.aggregate([
        { $match: { target: currentUserId, event: "comment" } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).option({ maxTimeMS: 5000 }),
      User.findById(currentUserId).select("followersCount followingCount sharesCount viewsCount"),
      Post.countDocuments({ author: currentUserId }),
    ]);

    const result = {
      success: true,
      overview: {
        totalPosts: postCount,
        totalViews: totalViews[0]?.total || 0,
        totalLikes: totalLikes[0]?.total || 0,
        totalComments: totalComments[0]?.total || 0,
        followersCount: user?.followersCount || 0,
        followingCount: user?.followingCount || 0,
        sharesCount: user?.sharesCount || 0,
        profileViews: user?.viewsCount || 0,
      },
    };

    await setCache(cacheKey, result, 300);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getAnalyticsOverview", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/analytics/posts
 * Per-post performance data for the current user.
 */
export const getAnalyticsPosts = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));
  const cursor = req.query.cursor as string | undefined;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const query: any = { author: currentUserId };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const posts = await Post.find(query)
      .select("title slug likesCount commentsCount repostsCount savesCount viewsCount sharesCount createdAt")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }
    const nextCursor = posts.slice(-1).shift()?._id || null;

    return res.status(200).json({
      success: true,
      posts,
      hasMore,
      nextCursor,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getAnalyticsPosts", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/analytics/engagement
 * Daily/weekly engagement trends for the current user.
 */
export const getAnalyticsEngagement = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const period = (req.query.period as string) || "7d";

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const days = period === "30d" ? 30 : period === "90d" ? 90 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const trends = await AnalyticsEvent.aggregate([
      {
        $match: {
          user: currentUserId,
          date: { $gte: since },
        },
      },
      {
        $group: {
          _id: { date: "$date", event: "$event" },
          total: { $sum: "$count" },
        },
      },
      { $sort: { "_id.date": -1 } },
    ]).option({ maxTimeMS: 5000 });

    // Format as { date: string, likes: number, comments: number, ... }
    const dailyMap = new Map<string, Record<string, number>>();
    for (const t of trends) {
      const dateStr: string = t._id.date instanceof Date
        ? t._id.date.toISOString().split("T")[0]
        : String(t._id.date).split("T")[0];
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, {});
      const eventKey: string = (t._id.event as string) || "unknown";
      const entry = dailyMap.get(dateStr);
      if (entry) entry[eventKey] = t.total;
    }

    const engagement = Array.from(dailyMap.entries())
      .map(([date, events]) => ({ date, ...events }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({ success: true, engagement, period: days + "d" });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getAnalyticsEngagement", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/** Helper: increment an analytics event counter (called from controllers) */
export const incrementAnalytics = async (
  userId: string,
  event: string,
  targetId?: string,
  targetModel?: string,
) => {
  try {
    const today: string = new Date().toISOString().split("T")[0] ?? "";
    const date: Date = new Date(today);

    await AnalyticsEvent.findOneAndUpdate(
      {
        user: new mongoose.Types.ObjectId(userId),
        event,
        target: targetId ? new mongoose.Types.ObjectId(targetId) : null,
        date,
      },
      { $inc: { count: 1 } },
      { upsert: true, new: true },
    );
  } catch (err: any) {
    logger.error("Error incrementing analytics", { error: err.message, userId, event });
  }
};
