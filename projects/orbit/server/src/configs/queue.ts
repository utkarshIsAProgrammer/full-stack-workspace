/**
 * BullMQ Configuration — Background Job Queue
 *
 * Provides Redis-backed queues for processing background jobs:
 * - Email delivery (welcome emails, password reset, digests)
 * - Image processing (thumbnails, compression)
 * - Notification batching (push, in-app, email)
 * - Data export generation
 *
 * Uses the existing ioredis connection for BullMQ's Redis backend.
 * Falls back gracefully if Redis is not configured (jobs are skipped).
 */

import { Queue } from "bullmq";
import { logger } from "../utilities/logger";

// ─── Redis Connection ──────────────────────────────────────────────
// BullMQ requires a direct TCP Redis connection (redis:// or rediss://).
// ⚠️ UPSTASH_REDIS_URL is an HTTPS REST endpoint — NOT compatible with BullMQ.
// Set a dedicated REDIS_URL env var for background jobs.
// Falls back gracefully if not configured.
const REDIS_URL = process.env.REDIS_URL || "";

const isRedisAvailable = (): boolean => {
  if (!REDIS_URL) {
    logger.warn(
      "[BullMQ] REDIS_URL not configured — background jobs disabled. " +
      "Set REDIS_URL to a TCP Redis connection string (e.g. redis://localhost:6379)."
    );
    return false;
  }
  return true;
};

// ─── Queue Definitions ─────────────────────────────────────────────

export enum QueueName {
  EMAILS = "orbit:emails",
  NOTIFICATIONS = "orbit:notifications",
  IMAGE_PROCESSING = "orbit:image-processing",
  DATA_EXPORT = "orbit:data-export",
  SEARCH_INDEX = "orbit:search-index",
}

// ─── Queue Factory ─────────────────────────────────────────────────

function createQueue(name: QueueName): Queue | null {
  if (!isRedisAvailable()) return null;
  return new Queue(name, {
    connection: { url: REDIS_URL, maxRetriesPerRequest: null } as any,
  });
}

// Export queue instances (lazily initialized)
let _emailQueue: Queue | null = null;
let _notificationQueue: Queue | null = null;
let _imageProcessingQueue: Queue | null = null;
let _dataExportQueue: Queue | null = null;
let _searchIndexQueue: Queue | null = null;

export const getEmailQueue = (): Queue | null => {
  if (!_emailQueue) _emailQueue = createQueue(QueueName.EMAILS);
  return _emailQueue;
};

export const getNotificationQueue = (): Queue | null => {
  if (!_notificationQueue) _notificationQueue = createQueue(QueueName.NOTIFICATIONS);
  return _notificationQueue;
};

export const getImageProcessingQueue = (): Queue | null => {
  if (!_imageProcessingQueue) _imageProcessingQueue = createQueue(QueueName.IMAGE_PROCESSING);
  return _imageProcessingQueue;
};

export const getDataExportQueue = (): Queue | null => {
  if (!_dataExportQueue) _dataExportQueue = createQueue(QueueName.DATA_EXPORT);
  return _dataExportQueue;
};

export const getSearchIndexQueue = (): Queue | null => {
  if (!_searchIndexQueue) _searchIndexQueue = createQueue(QueueName.SEARCH_INDEX);
  return _searchIndexQueue;
};

// ─── Job Data Types ────────────────────────────────────────────────

export interface EmailJobData {
  type: "welcome" | "password-reset" | "digest" | "verification";
  to: string;
  userId?: string;
  data?: Record<string, unknown>;
}

export interface NotificationJobData {
  type: "push" | "in-app" | "email";
  userId: string;
  notificationId?: string;
  payload?: Record<string, unknown>;
}

export interface ImageProcessingJobData {
  type: "thumbnail" | "compress" | "optimize";
  url: string;
  userId: string;
  postId?: string;
}

export interface DataExportJobData {
  userId: string;
  exportType: "posts" | "profile" | "messages" | "all";
  requestedAt: string;
}

export interface SearchIndexJobData {
  type: "index" | "update" | "delete";
  collection: "users" | "posts" | "communities" | "messages";
  documentId: string;
  data?: Record<string, unknown>;
}

// ─── Helper: Add a job to a queue ──────────────────────────────────

export async function enqueueJob<T>(
  queue: Queue | null,
  jobName: string,
  data: T,
  options?: { delay?: number; priority?: number },
): Promise<void> {
  if (!queue) {
    logger.warn(`[BullMQ] Queue not available — skipping job: ${jobName}`);
    return;
  }

  try {
    await queue.add(jobName, data, {
      delay: options?.delay,
      priority: options?.priority,
      removeOnComplete: { age: 3600 * 24 }, // Keep completed jobs for 1 day
      removeOnFail: { age: 3600 * 24 * 7 }, // Keep failed jobs for 7 days
    });
    logger.debug(`[BullMQ] Job enqueued: ${jobName}`);
  } catch (err) {
    logger.error(`[BullMQ] Failed to enqueue job: ${jobName}`, { error: (err as Error).message });
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────

export async function closeAllQueues(): Promise<void> {
  const queues = [
    _emailQueue,
    _notificationQueue,
    _imageProcessingQueue,
    _dataExportQueue,
    _searchIndexQueue,
  ];

  await Promise.allSettled(
    queues.map(async (q) => {
      if (q) await q.close();
    }),
  );

  logger.info("[BullMQ] All queues closed");
}
