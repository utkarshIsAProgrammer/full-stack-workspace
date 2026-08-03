import cron from "node-cron";
import { User } from "../models/user.model";
import { UserStreak } from "../models/userStreak.model";
import Notification from "../models/notification.model";
import UserMission from "../models/dailyMission.model";
import Post from "../models/post.model";
import { recomputeAffinityScores } from "../services/affinityService";
import { sendPushToUser } from "../services/pushService";
import { clearFeedCache, clearUserPostsCache } from "../configs/cache";
import { emitPostCreated } from "../configs/socket";
import { addUserStatusToPosts } from "../utilities/postStatus";
import { invalidateFeedCache } from "../services/feedService";
import { logger } from "../utilities/logger";

/** How many users to process per batch to avoid overwhelming the DB/CPU */
const BATCH_SIZE = 50;

/** Process at most this many batches per scheduled run */
const MAX_BATCHES = 20;

/**
 * Keep-alive pinger for free-tier hosting (e.g. Render free).
 *
 * Free platforms sleep the process after a period of inactivity and wake it
 * on the next request — causing ~30s cold-start delays for the first user.
 * To prevent that, we ping our own public /api/ping every 5 minutes, which
 * keeps the instance "active" so it never sleeps.
 *
 * Requires PUBLIC_API_URL to be set to the public URL of the API
 * (e.g. https://orbit-backend.onrender.com). No-ops in development or when
 * the URL is unset, so local dev is never affected.
 */
export function startKeepAlive(): void {
  const publicUrl = (process.env.PUBLIC_API_URL || "").trim();

  if (!publicUrl) {
    logger.info(
      "Keep-alive scheduler disabled — PUBLIC_API_URL not set (set it on your free-tier host to prevent sleeping)",
    );
    return;
  }
  if (process.env.NODE_ENV === "development") {
    logger.info("Keep-alive scheduler disabled in development");
    return;
  }

  // In cluster mode each worker would otherwise register its own cron and
  // ping N times per 5 minutes. Run it only from the primary process.
  const cluster = require("cluster") as { isPrimary?: boolean };
  if (cluster.isPrimary === false) {
    logger.info("Keep-alive scheduler skipped on cluster worker");
    return;
  }

  const target = publicUrl.replace(/\/$/, "") + "/api/ping";

  const ping = async () => {
    try {
      const res = await fetch(target, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        logger.info("Keep-alive ping OK", {
          status: res.status,
          target,
        });
      } else {
        logger.warn("Keep-alive ping returned non-OK status", {
          status: res.status,
          target,
        });
      }
    } catch (err: any) {
      logger.error("Keep-alive ping failed", {
        error: err?.message || String(err),
        target,
      });
    }
  };

  // Runs every 5 minutes: "*/5 * * * *"
  cron.schedule("*/5 * * * *", ping);

  logger.info(`Keep-alive scheduler registered (pings ${target} every 5 minutes)`);
}

/**
 * Start the affinity recomputation scheduler.
 *
 * Runs every 30 minutes. Each run picks up the most recently active
 * users (those whose `affinityUpdatedAt` is null or older than 15 min)
 * and recomputes their affinity scores in batches.
 */
export function startAffinityScheduler(): void {
  // Runs every 30 minutes: "*/30 * * * *"
  cron.schedule("*/30 * * * *", async () => {
    logger.info("Affinity scheduler: starting batch recomputation");

    try {
      const fifteenMinutesAgo = new Date(
        Date.now() - 15 * 60 * 1000
      );

      // Find users whose affinity hasn't been computed recently
      const staleUsers = await User.find({
        $or: [
          { affinityUpdatedAt: null },
          { affinityUpdatedAt: { $lt: fifteenMinutesAgo } },
        ],
      })
        .select("_id")
        .limit(BATCH_SIZE * MAX_BATCHES)
        .lean();

      if (staleUsers.length === 0) {
        logger.info("Affinity scheduler: no stale users found");
        return;
      }

      logger.info("Affinity scheduler: processing users", {
        count: staleUsers.length,
      });

      // Process in batches
      let processed = 0;
      for (let i = 0; i < staleUsers.length && i < MAX_BATCHES * BATCH_SIZE; i += BATCH_SIZE) {
        const batch = staleUsers.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map((u) => recomputeAffinityScores(u._id.toString()))
        );
        processed += batch.length;
      }

      logger.info("Affinity scheduler: batch complete", { processed });
    } catch (err: any) {
      logger.error("Affinity scheduler: error", { error: err.message });
    }
  });

  logger.info("Affinity scheduler registered (runs every 30 minutes)");
}

/**
 * Start the notification pruning scheduler.
 *
 * Runs daily at 3:00 AM. Deletes read notifications that are older than
 * 30 days to prevent unbounded collection growth. Unread notifications
 * are preserved indefinitely so users never lose unseen alerts.
 */
export function startNotificationPruner(): void {
  // Runs at 3:00 AM every day: "0 3 * * *"
  cron.schedule("0 3 * * *", async () => {
    logger.info("Notification pruner: starting cleanup");

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await Notification.deleteMany({
        isRead: true,
        createdAt: { $lt: thirtyDaysAgo },
      });

      logger.info("Notification pruner: cleanup complete", {
        deletedCount: result.deletedCount,
      });
    } catch (err: any) {
      logger.error("Notification pruner: error", { error: err.message });
    }
  });

  logger.info("Notification pruner registered (runs daily at 3:00 AM)");
}

/**
 * Start the daily missions reset scheduler.
 *
 * Runs at midnight (00:00) every day. Deletes all UserMission records
 * from the previous day so fresh missions are generated on next user visit.
 * Old records older than 7 days are hard-deleted to keep the collection lean.
 */
export function startDailyMissionReset(): void {
  // Runs at midnight every day: "0 0 * * *"
  cron.schedule("0 0 * * *", async () => {
    logger.info("Daily mission reset: starting cleanup of old missions");

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Delete missions older than 7 days
      const result = await UserMission.deleteMany({
        date: { $lt: sevenDaysAgo.toISOString().slice(0, 10) },
      });

      logger.info("Daily mission reset: cleanup complete", {
        deletedCount: result.deletedCount,
      });
    } catch (err: any) {
      logger.error("Daily mission reset: error", { error: err.message });
    }
  });

  logger.info("Daily mission reset registered (runs daily at midnight)");
}

/**
 * Start the streak break checker scheduler.
 *
 * Runs every hour. Detects users whose streak has been broken (lastActiveDate
 * is older than yesterday), resets their streak to 0, and sends a push
 * notification alerting them.
 */
export function startStreakBreakChecker(): void {
  // Runs every hour: "0 * * * *"
  cron.schedule("0 * * * *", async () => {
    logger.info("Streak break checker: starting");

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find users with active streaks but lastActiveDate is older than yesterday
      // (i.e. they missed at least one full day after yesterday)
      const brokenStreaks = await UserStreak.find({
        currentStreak: { $gt: 0 },
        lastActiveDate: { $ne: null, $lt: yesterday },
        streakBreakNotified: { $ne: true },
      })
        .select("user currentStreak longestStreak lastActiveDate")
        .limit(BATCH_SIZE * MAX_BATCHES)
        .lean();

      if (brokenStreaks.length === 0) {
        logger.info("Streak break checker: no broken streaks found");
        return;
      }

      logger.info("Streak break checker: processing broken streaks", {
        count: brokenStreaks.length,
      });

      for (const record of brokenStreaks) {
        try {
          // Reset streak to 0
          await UserStreak.updateOne(
            { _id: record._id },
            {
              $set: {
                currentStreak: 0,
                streakBreakNotified: true,
              },
            }
          );

          // Create an in-app notification
          await Notification.create({
            recipient: record.user,
            type: "streak_reminder",
            message: `Your ${record.currentStreak}-day streak has been broken! Start a new streak today.`,
            isRead: false,
          });

          // Send push notification
          await sendPushToUser(record.user.toString(), {
            title: "Streak Broken 💔",
            body: `Your ${record.currentStreak}-day streak has been broken! Start a new streak today to keep the flame alive.`,
            tag: "streak-broken",
            requireInteraction: false,
            data: { url: "/profile" },
          });
        } catch (err: any) {
          logger.error("Streak break checker: failed to process streak", {
            userId: record.user,
            error: err.message,
          });
        }
      }

      logger.info("Streak break checker: batch complete", {
        processed: brokenStreaks.length,
      });
    } catch (err: any) {
      logger.error("Streak break checker: error", { error: err.message });
    }
  });

  logger.info("Streak break checker registered (runs every hour)");
}

/**
 * Start the scheduled post publisher.
 *
 * Runs every minute. Finds posts whose `status` is "scheduled" and whose
 * `scheduledAt` has passed, flips them to "published", clears the feed
 * caches, and broadcasts a `post:created` event so they appear in feeds
 * in realtime — exactly as if the author had posted them manually.
 */
export function startScheduledPostPublisher(): void {
  // Runs every minute: "* * * * *"
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const duePosts = await Post.find({
        status: "scheduled",
        scheduledAt: { $lte: now },
      })
        .select("_id author")
        .limit(500)
        .lean();

      if (duePosts.length === 0) return;

      logger.info("Scheduled post publisher: publishing due posts", {
        count: duePosts.length,
      });

      const authorIds = new Set<string>();
      for (const post of duePosts) {
        try {
          await Post.updateOne(
            { _id: post._id },
            { $set: { status: "published", scheduledAt: null } }
          );
          if (post.author) authorIds.add(post.author.toString());
        } catch (err: any) {
          logger.error("Scheduled post publisher: failed to publish", {
            postId: post._id,
            error: err.message,
          });
        }
      }

      // Clear feed caches so published posts appear immediately
      await clearFeedCache();
      for (const authorId of authorIds) {
        await clearUserPostsCache(authorId);
        await invalidateFeedCache(authorId).catch(() => {});
      }

      // Broadcast each newly-published post to connected clients
      for (const post of duePosts) {
        try {
          const populated = await Post.findById(post._id)
            .populate("author", "username email fullName profilePic")
            .populate("collaborator", "username fullName profilePic")
            .lean();
          if (populated) {
            const postsWithStatus = await addUserStatusToPosts(
              [populated],
              populated.author?._id?.toString(),
            );
            emitPostCreated(postsWithStatus[0]);
          }
        } catch (err: any) {
          logger.error("Scheduled post publisher: emit failed", {
            postId: post._id,
            error: err.message,
          });
        }
      }

      logger.info("Scheduled post publisher: batch complete", {
        processed: duePosts.length,
      });
    } catch (err: any) {
      logger.error("Scheduled post publisher: error", { error: err.message });
    }
  });

  logger.info("Scheduled post publisher registered (runs every minute)");
}

