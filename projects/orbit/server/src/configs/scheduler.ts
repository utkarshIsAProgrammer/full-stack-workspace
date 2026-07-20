import cron from "node-cron";
import { User } from "../models/user.model";
import { recomputeAffinityScores } from "../services/affinityService";
import { logger } from "../utilities/logger";

/** How many users to process per batch to avoid overwhelming the DB/CPU */
const BATCH_SIZE = 50;

/** Process at most this many batches per scheduled run */
const MAX_BATCHES = 20;

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
