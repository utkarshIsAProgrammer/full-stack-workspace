/**
 * Batch Notification Operations
 * 
 * This utility provides batch operations for notifications
 * to reduce database load and improve performance.
 */

import Notification from '../models/notification.model';
import { redis } from './redis';

interface BatchNotificationData {
  recipientId: string;
  type: string;
  content: string;
  relatedId?: string;
  metadata?: any;
}

/**
 * Create multiple notifications in a single batch operation
 */
export const createBatchNotifications = async (
  notifications: BatchNotificationData[]
): Promise<void> => {
  try {
    if (notifications.length === 0) return;

    // Use bulk insert for better performance
    const bulkOps = notifications.map((notif) => ({
      insertOne: {
        document: notif,
      },
    }));

    await Notification.bulkWrite(bulkOps);

    // Invalidate cache for affected users
    const recipientIds = [...new Set(notifications.map((n) => n.recipientId))];
    for (const recipientId of recipientIds) {
      await invalidateNotificationCache(recipientId);
    }
  } catch (error) {
    console.error('Batch notification creation error:', error);
    throw error;
  }
};

/**
 * Mark multiple notifications as read in a single batch operation
 */
export const markNotificationsAsReadBatch = async (
  recipientId: string,
  notificationIds: string[]
): Promise<void> => {
  try {
    if (notificationIds.length === 0) return;

    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient: recipientId,
      },
      { read: true }
    );

    await invalidateNotificationCache(recipientId);
  } catch (error) {
    console.error('Batch mark as read error:', error);
    throw error;
  }
};

/**
 * Delete multiple notifications in a single batch operation
 */
export const deleteNotificationsBatch = async (
  recipientId: string,
  notificationIds: string[]
): Promise<void> => {
  try {
    if (notificationIds.length === 0) return;

    await Notification.deleteMany({
      _id: { $in: notificationIds },
      recipient: recipientId,
    });

    await invalidateNotificationCache(recipientId);
  } catch (error) {
    console.error('Batch delete error:', error);
    throw error;
  }
};

/**
 * Invalidate notification cache for a user
 */
const invalidateNotificationCache = async (recipientId: string): Promise<void> => {
  try {
    const patterns = [
      `notification:${recipientId}:*`,
      `notifications:${recipientId}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('Notification cache invalidation error:', error);
  }
};

/**
 * Get unread count with caching
 */
export const getUnreadCountCached = async (recipientId: string): Promise<number> => {
  try {
    const cacheKey = `notifications:${recipientId}:unread-count`;
    const cached = await redis.get(cacheKey) as string | null;

    if (cached !== null) {
      return parseInt(cached, 10);
    }

    const count = await Notification.countDocuments({
      recipient: recipientId,
      read: false,
    });

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, count.toString());

    return count;
  } catch (error) {
    console.error('Get unread count error:', error);
    return 0;
  }
};
