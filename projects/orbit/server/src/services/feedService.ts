import mongoose from "mongoose";
import Post from "../models/post.model";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";
import Block from "../models/block.model";
import { getCache, setCache, clearByPattern } from "../configs/cache";
import { logger } from "../utilities/logger";

// ─── Named scoring constants (tuneable) ────────────────────────────

const SCORE = {
  /** Weight for per-author affinity (log-scaled engagement history) */
  AFFINITY_WEIGHT: 0.35,
  /** Weight for content-type / tag affinity */
  CONTENT_AFFINITY_WEIGHT: 0.20,
  /** Weight for post velocity (recent engagement rate) */
  VELOCITY_WEIGHT: 0.25,
  /** Weight for recency (exponential decay) */
  RECENCY_DECAY_WEIGHT: 0.15,
  /** Weight for follow relationship boost */
  FOLLOW_BOOST_WEIGHT: 0.05,
  /** Multiplier applied if the user follows the post's author */
  FOLLOW_BOOST_MULTIPLIER: 1.5,
  /** Base multiplier (no boost) */
  BASE_BOOST: 1.0,
  /** Recency decay factor: exp(-DECAY_RATE * hours) */
  RECENCY_DECAY_RATE: 0.08,
} as const;

const VELOCITY = {
  /** Weight of each like in velocity calculation */
  LIKE: 1,
  /** Weight of each comment (higher = deeper engagement) */
  COMMENT: 4,
  /** Weight of each save (strong interest signal) */
  SAVE: 3,
  /** Weight of each share (strongest passive signal) */
  SHARE: 5,
  /** Minimum denominator to avoid division by zero */
  MIN_HOURS: 0.5,
} as const;

const POOL = {
  /** Max candidates to fetch from each source */
  FOLLOWING_LIMIT: 300,
  /** Max candidates from high-affinity authors (not followed) */
  AFFINITY_LIMIT: 100,
  /** Max trending/discovery posts */
  DISCOVERY_LIMIT: 50,
  /** Total candidate budget */
  MAX_CANDIDATES: 450,
  /** Recent posts window (in days) */
  RECENT_DAYS: 3,
  /** Don't recompute affinity if it's fresher than this (in minutes) */
  AFFINITY_STALE_THRESHOLD_MINUTES: 15,
} as const;

const DIVERSITY = {
  /** Max consecutive posts from the same author */
  MAX_SAME_AUTHOR: 2,
  /** Slots to reserve for very fresh content (< 2 hours old) */
  FRESHNESS_SLOTS: 3,
  /** Reserve these 0-indexed positions for fresh posts */
  FRESHNESS_POSITIONS: [2, 6],
  /** Freshness window in hours */
  FRESHNESS_HOURS: 2,
} as const;

// ─── Types ─────────────────────────────────────────────────────────

export interface ScoredPost {
  post: any;
  score: number;
  authorId: string;
  isFollowed: boolean;
  isFresh: boolean;
}

interface FeedResult {
  posts: any[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Step 1: Candidate Generation ───────────────────────────────────

/**
 * Build a diverse candidate pool of up to ~450 posts:
 * 1. Posts from followed authors in the last 3 days (~300)
 * 2. Posts from high-affinity authors even if not followed (~100)
 * 3. Trending/discovery posts from outside the network (~50)
 */
async function generateCandidates(
  userId: string,
  affinityScores: Map<string, number>,
  seenPosts: string[],
  followedUserIds: string[]
): Promise<any[]> {
  const threeDaysAgo = new Date(Date.now() - POOL.RECENT_DAYS * 24 * 60 * 60 * 1000);
  const candidateMap = new Map<string, any>(); // dedup by post._id

  // Fetch blocked and muted users to exclude from feed
  const [blockedDocs, userDoc] = await Promise.all([
    Block.find({ $or: [{ blocker: userId }, { blocked: userId }] }).select("blocker blocked").lean(),
    User.findById(userId).select("mutedUsers").lean(),
  ]);

  const excludedUserIds = new Set<string>();
  blockedDocs.forEach((b: any) => {
    if (b.blocker?.toString() === userId.toString()) excludedUserIds.add(b.blocked.toString());
    if (b.blocked?.toString() === userId.toString()) excludedUserIds.add(b.blocker.toString());
  });

  const now = new Date();
  ((userDoc as any)?.mutedUsers || []).forEach((m: any) => {
    if (!m.expiresAt || new Date(m.expiresAt) > now) {
      excludedUserIds.add(m.user.toString());
    }
  });

  const networkUserIds = [...followedUserIds, userId.toString()].filter((id) => !excludedUserIds.has(id));

  if (networkUserIds.length > 0) {
    // For network users (followed users + self), include public posts, and closeFriends posts
    const networkPosts = await Post.find({
      author: { $in: networkUserIds },
      createdAt: { $gte: threeDaysAgo },
      status: "published",
    })
      .populate("author", "username fullName profilePic closeFriends")
      .sort({ createdAt: -1 })
      .limit(POOL.FOLLOWING_LIMIT)
      .lean();

    for (const post of networkPosts) {
      const authorIdStr = (post as any).author?._id?.toString() || (post as any).author?.toString();
      if (excludedUserIds.has(authorIdStr)) continue;

      if ((post as any).visibility === "closeFriends" && authorIdStr !== userId.toString()) {
        const authorCloseFriends: any[] = (post as any).author?.closeFriends || [];
        const isCloseFriend = authorCloseFriends.some(
          (id: any) => id.toString() === userId.toString()
        );
        if (!isCloseFriend) continue;
      }

      const id = (post as any)._id.toString();
      if (!seenPosts.includes(id)) {
        candidateMap.set(id, { ...post, _isFollowed: true });
      }
    }
  }

  // 2. Posts from high-affinity authors (even if not followed)
  if (affinityScores && affinityScores.size > 0) {
    const highAffinityIds: string[] = [];
    for (const [authorId, score] of affinityScores) {
      if (score > 0.5 && !followedUserIds.includes(authorId) && !excludedUserIds.has(authorId)) {
        highAffinityIds.push(authorId);
      }
    }

    if (highAffinityIds.length > 0) {
      // Only show public posts from high-affinity authors (not followed)
      const affinityPosts = await Post.find({
        author: { $in: highAffinityIds },
        createdAt: { $gte: threeDaysAgo },
        status: "published",
        visibility: "public",
        _id: { $nin: [...candidateMap.keys()] },
      })
        .populate("author", "username fullName profilePic")
        .sort({ createdAt: -1 })
        .limit(POOL.AFFINITY_LIMIT)
        .lean();

      for (const post of affinityPosts) {
        const id = (post as any)._id.toString();
        if (!seenPosts.includes(id)) {
          candidateMap.set(id, { ...post, _isFollowed: false });
        }
      }
    }
  }

  // 3. Discovery / trending posts (high velocity from outside network)
  // Only public posts are visible in discovery — closeFriends posts aren't shown
  const excludedDiscoveryAuthors = [...followedUserIds, ...excludedUserIds];
  const discoveryPosts = await Post.find({
    author: { $nin: excludedDiscoveryAuthors },
    createdAt: { $gte: threeDaysAgo },
    status: "published",
    visibility: "public",
    _id: { $nin: [...candidateMap.keys()] },
  })
    .populate("author", "username fullName profilePic")
    .sort({ likesCount: -1, commentsCount: -1 })
    .limit(POOL.DISCOVERY_LIMIT)
    .lean();

  for (const post of discoveryPosts) {
    const id = (post as any)._id.toString();
    if (!seenPosts.includes(id)) {
      candidateMap.set(id, { ...post, _isFollowed: false });
    }
  }

  return [...candidateMap.values()];
}

// ─── Step 2: Scoring Function ──────────────────────────────────────

/**
 * Compute the final score for a single candidate post.
 *
 * finalScore = (affinity × 0.35)
 *            + (contentAffinity × 0.20)
 *            + (velocity × 0.25)
 *            + (recencyDecay × 0.15)
 *            + (followBoost × 0.05)
 */
function computeScore(
  post: any,
  affinityScores: Map<string, number>,
  contentAffinity: Map<string, number>,
  followedIds: Set<string>
): ScoredPost {
  const authorId = post.author?._id?.toString() || post.author?.toString();
  const hoursSincePost = Math.max(
    (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000,
    VELOCITY.MIN_HOURS
  );

  // ── Affinity score (log-scaled per-author engagement) ─────────────
  // Use affine form: affinity = log1p(rawScore) so 0→0, small signals don't vanish
  const rawAffinity = affinityScores?.get(authorId) || 0;
  const affinity = Math.log1p(rawAffinity);

  // ── Content affinity (user's engagement with this post's tags) ────
  let contentAffinityScore = 0;
  const hashtags: string[] = post.hashtags || [];
  if (hashtags.length > 0 && contentAffinity && contentAffinity.size > 0) {
    for (const tag of hashtags) {
      contentAffinityScore += contentAffinity.get(tag) || 0;
    }
    // Average across tags
    contentAffinityScore /= hashtags.length;
  }

  // ── Velocity (engagement rate normalized by time) ─────────────────
  // velocity = (likes*1 + comments*4 + saves*3 + shares*5) / max(hours, 0.5)
  const velocityNumerator =
    (post.likesCount || 0) * VELOCITY.LIKE +
    (post.commentsCount || 0) * VELOCITY.COMMENT +
    (post.savesCount || 0) * VELOCITY.SAVE +
    (post.sharesCount || 0) * VELOCITY.SHARE;
  const velocity = velocityNumerator / hoursSincePost;

  // ── Recency decay ────────────────────────────────────────────────
  // Recent posts score higher; exponential decay at 8% per hour
  const recencyDecay = Math.exp(-SCORE.RECENCY_DECAY_RATE * hoursSincePost);

  // ── Follow boost ─────────────────────────────────────────────────
  const isFollowed = followedIds.has(authorId);
  const followBoost = isFollowed ? SCORE.FOLLOW_BOOST_MULTIPLIER : SCORE.BASE_BOOST;

  // ── Final score ──────────────────────────────────────────────────
  const finalScore =
    affinity * SCORE.AFFINITY_WEIGHT +
    contentAffinityScore * SCORE.CONTENT_AFFINITY_WEIGHT +
    velocity * SCORE.VELOCITY_WEIGHT +
    recencyDecay * SCORE.RECENCY_DECAY_WEIGHT +
    followBoost * SCORE.FOLLOW_BOOST_WEIGHT;

  const isFresh = hoursSincePost < DIVERSITY.FRESHNESS_HOURS;

  return {
    post,
    score: finalScore,
    authorId,
    isFollowed,
    isFresh,
  };
}

// ─── Step 3: Affinity is handled by the scheduled job ──────────────
// (see affinityService.ts)

// ─── Step 4: Diversity Re-ranking ───────────────────────────────────

/**
 * After scoring, re-rank to enforce:
 * - No more than 2 consecutive posts from the same author
 * - Alternate content types where possible
 */
function applyDiversityRanking(scored: ScoredPost[]): ScoredPost[] {
  const result: ScoredPost[] = [];
  const remaining = [...scored];
  const recentAuthors: string[] = [];

  while (remaining.length > 0) {
    // Find the best candidate that doesn't violate diversity constraints
    let bestIdx = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (!candidate) continue;

      // Check author diversity: count consecutive same-author
      const sameAuthorRecent = recentAuthors.filter(
        (a) => a === candidate.authorId
      ).length;

      if (sameAuthorRecent >= DIVERSITY.MAX_SAME_AUTHOR) {
        continue; // Skip — would violate author diversity
      }

      bestIdx = i;
      break;
    }

    // Fallback: if all remaining violate, just take the top one
    if (bestIdx === -1) {
      bestIdx = 0;
    }

    const selected = remaining.splice(bestIdx, 1)[0];
    if (!selected) break;
    result.push(selected);
    recentAuthors.push(selected.authorId);
    // Keep sliding window limited
    if (recentAuthors.length > DIVERSITY.MAX_SAME_AUTHOR * 2) {
      recentAuthors.shift();
    }
  }

  return result;
}

// ─── Step 5: Freshness Guarantee ───────────────────────────────────

/**
 * Inject very recent posts (< 2 hours old) into reserved slots
 * (positions 3 and 7, 0-indexed) if they aren't already near the top.
 */
function applyFreshnessGuarantee(scored: ScoredPost[]): ScoredPost[] {
  const freshPosts = scored.filter((s) => s.isFresh);
  const nonFresh = scored.filter((s) => !s.isFresh);

  for (const pos of DIVERSITY.FRESHNESS_POSITIONS) {
    if (pos >= scored.length) break;

    // Check if the current post at this position is already fresh
    if (scored[pos]?.isFresh) continue;

    // Find a fresh post that isn't already in the top N
    const freshIdx = freshPosts.findIndex(
      (f) => !scored.slice(0, DIVERSITY.FRESHNESS_SLOTS).includes(f)
    );
    if (freshIdx === -1) break;

    const fresh = freshPosts.splice(freshIdx, 1)[0];
    if (fresh) {
      // Swap placeholder: replace the post at `pos` with the fresh one
      scored.splice(pos, 1, fresh);
    }
  }

  return scored;
}

// ─── Step 6: Pagination + Caching ──────────────────────────────────

/**
 * Get the ranked feed for a user.
 *
 * Strategy:
 * 1. Check cache (5-10 min TTL per user)
 * 2. Generate candidate pool
 * 3. Score each candidate
 * 4. Diversity re-rank
 * 5. Freshness guarantee
 * 6. Apply cursor-based pagination
 * 7. Cache the result
 */
export async function getRankedFeed(
  userId: string,
  cursor?: string | null,
  limit: number = 20
): Promise<FeedResult> {
  const cacheKey = `feed:ranked:${userId}`;
  const actualLimit = Math.min(limit, 50);

  // 1. Try cache first (TTL: 5 minutes)
  try {
    const cached = await getCache<ScoredPost[]>(cacheKey);
    if (cached && !cursor) {
      return paginateFromCandidates(cached, cursor, actualLimit);
    }
  } catch (err: any) {
    logger.error("Feed cache read error", { error: err.message });
  }

  // 2. Load user data
  const user = await User.findById(userId)
    .select("affinityScores contentAffinity seenPosts following")
    .lean();

  if (!user) {
    return { posts: [], nextCursor: null, hasMore: false };
  }

  const affinityScores = (user as any).affinityScores as Map<string, number> || new Map();
  const contentAffinity = (user as any).contentAffinity as Map<string, number> || new Map();
  const seenPosts: string[] = (user as any).seenPosts || [];

  // Get followed IDs once to reuse in candidate generation and scoring
  const followedUserIds = await Follow.find({ follower: userId })
    .select("following")
    .lean()
    .then((docs) => docs.map((d) => d.following.toString()));
  const followedIds = new Set(followedUserIds);

  // 3. Generate candidates (new users with empty affinity fall back to recency/follow-based feed)
  const candidates = await generateCandidates(userId, affinityScores, seenPosts, followedUserIds);

  if (candidates.length === 0) {
    return { posts: [], nextCursor: null, hasMore: false };
  }

  // 5. Score each candidate
  let scored: ScoredPost[] = candidates.map((post) =>
    computeScore(post, affinityScores, contentAffinity, followedIds)
  );

  // 6. Sort by score descending (stable tiebreaker: post ID)
  scored.sort((a, b) => {
    const diff = b.score - a.score;
    if (Math.abs(diff) < 0.0001) {
      return (b.post as any)._id.toString().localeCompare((a.post as any)._id.toString());
    }
    return diff;
  });

  // 7. Apply diversity re-ranking
  scored = applyDiversityRanking(scored);

  // 8. Apply freshness guarantee
  scored = applyFreshnessGuarantee(scored);

  // 9. Cache the full ranked list (5 min TTL)
  try {
    await setCache(cacheKey, scored, 300);
  } catch (err: any) {
    logger.error("Feed cache write error", { error: err.message });
  }

  // 10. Paginate
  return paginateFromCandidates(scored, cursor, actualLimit);
}

/**
 * Extract a page from the pre-sorted candidate list using cursor-based pagination.
 */
function paginateFromCandidates(
  candidates: ScoredPost[],
  cursor?: string | null,
  limit: number = 20
): FeedResult {
  let startIdx = 0;

  if (cursor) {
    const foundIdx = candidates.findIndex(
      (s) => (s.post as any)._id.toString() === cursor
    );
    if (foundIdx > -1) {
      startIdx = foundIdx + 1;
    }
  }

  const page = candidates.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < candidates.length;
  const lastItem = page.length > 0 ? page[page.length - 1] : null;
  const nextCursor =
    hasMore && lastItem
      ? (lastItem.post as any)._id.toString()
      : null;

  return {
    posts: page.map((s) => s.post),
    nextCursor,
    hasMore,
  };
}

/**
 * Invalidate the feed cache for a user (call when user follows someone or posts).
 */
export async function invalidateFeedCache(userId: string): Promise<void> {
  await clearByPattern(`feed:ranked:${userId}`);
  logger.info("Feed cache invalidated for user", { userId });
}
