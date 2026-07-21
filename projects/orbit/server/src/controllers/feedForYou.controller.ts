import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Post from "../models/post.model";
import { AppError, UnauthorizedError } from "../utilities/errors";
import { addUserStatusToPosts } from "../utilities/postStatus";
import { getCache, setCache } from "../configs/cache";
import { logger } from "../utilities/logger";

/**
 * GET /api/feed/for-you
 * Personalized feed based on affinity scores + recency + diversity.
 */
export const getForYouFeed = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id?.toString();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const cacheKey = `feed:for-you:${currentUserId}:${page}:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const user = await User.findById(currentUserId)
      .select("affinityScores contentAffinity seenPosts followingCount")
      .lean();

    if (!user) throw new AppError("User not found!");

    const affinityScores = (user as any).affinityScores || {};
    const contentAffinity = (user as any).contentAffinity || {};
    const seenPosts: string[] = (user as any).seenPosts || [];

    // Get author IDs with affinity scores sorted by score descending
    const authorEntries = Object.entries(affinityScores) as [string, number][];
    const weightedAuthors = authorEntries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([id]) => new mongoose.Types.ObjectId(id));

    // Get hashtags the user engages with
    const tagEntries = Object.entries(contentAffinity) as [string, number][];
    const topTags = tagEntries
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    // Build query: posts from weighted authors OR with matching hashtags
    const query: any = {
      _id: { $nin: seenPosts.map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return id; }
      }) },
      status: "published",
    };

    const orConditions: any[] = [];
    if (weightedAuthors.length > 0) {
      orConditions.push({ author: { $in: weightedAuthors } });
    }
    if (topTags.length > 0) {
      orConditions.push({ hashtags: { $in: topTags } });
    }
    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    // Fetch candidate posts
    const candidates = await Post.find(query)
      .populate("author", "username email fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(limit * 3)
      .lean();

    if (candidates.length === 0) {
      // Fallback: latest public posts
      const fallback = await Post.find({ status: "published", visibility: "public" })
        .populate("author", "username email fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const withStatus = await addUserStatusToPosts(fallback, currentUserId);
      const result = { success: true, posts: withStatus, hasMore: false, source: "fallback" };
      await setCache(cacheKey, result, 60);
      return res.status(200).json(result);
    }

    // Score and sort candidates
    const scored = candidates.map((post: any) => {
      const authorId = post.author?._id?.toString();
      const authorScore = authorId ? (affinityScores[authorId] || 0) : 0;
      const tagScore = (post.hashtags || []).reduce((sum: number, tag: string) => {
        return sum + (contentAffinity[tag] || 0);
      }, 0);
      const recencyScore = Math.min(1, (Date.now() - new Date(post.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const totalScore = (authorScore * 0.35) + (tagScore * 0.40) + ((1 - recencyScore) * 0.15);
      return { post, score: totalScore, authorId };
    });

    // Apply diversity penalty: reduce score for repeated authors
    const authorCounts = new Map<string, number>();
    scored.forEach((item) => {
      if (item.authorId) {
        const count = authorCounts.get(item.authorId) || 0;
        authorCounts.set(item.authorId, count + 1);
        item.score -= (count > 1 ? 0.1 * count : 0); // diversity penalty
      }
    });

    // Sort by score descending, take top N
    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);
    const posts = sorted.map((s) => s.post);

    const withStatus = await addUserStatusToPosts(posts, currentUserId);
    const hasMore = candidates.length > limit;

    const result = {
      success: true,
      posts: withStatus,
      hasMore,
      score: true,
    };

    await setCache(cacheKey, result, 60); // 60 second cache
    return res.status(200).json(result);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getForYouFeed", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
