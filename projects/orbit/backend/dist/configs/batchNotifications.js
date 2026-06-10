"use strict";
/**
 * Batch Notification Operations
 *
 * This utility provides batch operations for notifications
 * to reduce database load and improve performance.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCountCached = exports.deleteNotificationsBatch = exports.markNotificationsAsReadBatch = exports.createBatchNotifications = void 0;
const notification_model_1 = __importDefault(require("../models/notification.model"));
const redis_1 = require("./redis");
/**
 * Create multiple notifications in a single batch operation
 */
const createBatchNotifications = async (notifications) => {
    try {
        if (notifications.length === 0)
            return;
        // Use bulk insert for better performance
        const bulkOps = notifications.map((notif) => ({
            insertOne: {
                document: notif,
            },
        }));
        await notification_model_1.default.bulkWrite(bulkOps);
        // Invalidate cache for affected users
        const recipientIds = [...new Set(notifications.map((n) => n.recipientId))];
        for (const recipientId of recipientIds) {
            await invalidateNotificationCache(recipientId);
        }
    }
    catch (error) {
        console.error('Batch notification creation error:', error);
        throw error;
    }
};
exports.createBatchNotifications = createBatchNotifications;
/**
 * Mark multiple notifications as read in a single batch operation
 */
const markNotificationsAsReadBatch = async (recipientId, notificationIds) => {
    try {
        if (notificationIds.length === 0)
            return;
        await notification_model_1.default.updateMany({
            _id: { $in: notificationIds },
            recipient: recipientId,
        }, { read: true });
        await invalidateNotificationCache(recipientId);
    }
    catch (error) {
        console.error('Batch mark as read error:', error);
        throw error;
    }
};
exports.markNotificationsAsReadBatch = markNotificationsAsReadBatch;
/**
 * Delete multiple notifications in a single batch operation
 */
const deleteNotificationsBatch = async (recipientId, notificationIds) => {
    try {
        if (notificationIds.length === 0)
            return;
        await notification_model_1.default.deleteMany({
            _id: { $in: notificationIds },
            recipient: recipientId,
        });
        await invalidateNotificationCache(recipientId);
    }
    catch (error) {
        console.error('Batch delete error:', error);
        throw error;
    }
};
exports.deleteNotificationsBatch = deleteNotificationsBatch;
/**
 * Invalidate notification cache for a user
 */
const invalidateNotificationCache = async (recipientId) => {
    try {
        const patterns = [
            `notification:${recipientId}:*`,
            `notifications:${recipientId}:*`,
        ];
        for (const pattern of patterns) {
            const keys = await redis_1.redis.keys(pattern);
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
            }
        }
    }
    catch (error) {
        console.error('Notification cache invalidation error:', error);
    }
};
/**
 * Get unread count with caching
 */
const getUnreadCountCached = async (recipientId) => {
    try {
        const cacheKey = `notifications:${recipientId}:unread-count`;
        const cached = await redis_1.redis.get(cacheKey);
        if (cached !== null) {
            return parseInt(cached, 10);
        }
        const count = await notification_model_1.default.countDocuments({
            recipient: recipientId,
            read: false,
        });
        // Cache for 30 seconds
        await redis_1.redis.setex(cacheKey, 30, count.toString());
        return count;
    }
    catch (error) {
        console.error('Get unread count error:', error);
        return 0;
    }
};
exports.getUnreadCountCached = getUnreadCountCached;
//# sourceMappingURL=batchNotifications.js.map