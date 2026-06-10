"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllNotifications = exports.deleteNotification = exports.markAsRead = exports.getNotifications = exports.getUnreadCount = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const cache_1 = require("../configs/cache");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const encodeNotificationCursor = (createdAt, id) => `${createdAt.getTime()}_${id.toString()}`;
const decodeNotificationCursor = (cursor) => {
    const separatorIndex = cursor.indexOf("_");
    if (separatorIndex === -1)
        return null;
    const timestamp = Number(cursor.slice(0, separatorIndex));
    const id = cursor.slice(separatorIndex + 1);
    if (!Number.isFinite(timestamp) || !mongoose_1.default.Types.ObjectId.isValid(id)) {
        return null;
    }
    return { createdAt: new Date(timestamp), id };
};
// get unread notification count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            // If no user, just return 0
            return res.status(200).json({
                success: true,
                unreadCount: 0,
            });
        }
        // cache key — 15s TTL is enough since notifications come via socket
        const cacheKey = `notifications:unread:${userId.toString()}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getUnreadCount!`, { error: err.message });
        }
        const unreadCount = await notification_model_1.default.countDocuments({
            recipient: userId,
            isRead: false,
        });
        const responseData = { success: true, unreadCount };
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 15);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getUnreadCount!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getUnreadCount controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getUnreadCount = getUnreadCount;
// get all notifications
const getNotifications = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            // If no user, return empty array
            return res.status(200).json({
                success: true,
                message: "Notifications fetched successfully!",
                notifications: [],
                hasMore: false,
                nextCursor: null,
            });
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const cursor = req.query.cursor;
        // cache key
        const cacheKey = `notifications:${userId}:${cursor || "first"}:${limit}`;
        // try cache first
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getNotifications!`, { error: err.message });
        }
        const query = { recipient: userId };
        if (cursor) {
            const decoded = decodeNotificationCursor(cursor);
            if (decoded) {
                query.$or = [
                    { createdAt: { $lt: decoded.createdAt } },
                    { createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
                ];
            }
        }
        const notifications = await notification_model_1.default.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .populate("sender", "username fullName profilePic")
            .populate("post", "title slug")
            .populate("comment", "content")
            .lean();
        const hasMore = notifications.length > limit;
        if (hasMore) {
            notifications.pop();
        }
        const last = notifications.slice(-1).shift();
        const nextCursor = last?.createdAt && last?._id
            ? encodeNotificationCursor(last.createdAt, last._id)
            : null;
        const responseData = {
            success: true,
            message: "Notifications fetched successfully!",
            notifications,
            hasMore,
            nextCursor,
        };
        // cache with short TTL (notifications change frequently)
        try {
            await (0, cache_1.setCache)(cacheKey, responseData, 30);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getNotifications!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in getNotifications controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getNotifications = getNotifications;
// mark notifications as read
const markAsRead = async (req, res) => {
    try {
        const userId = req.user?._id;
        const notificationId = req.params.notificationId;
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        // if notificationId is provided, mark only that single notification as read
        if (notificationId) {
            if (!mongoose_1.default.Types.ObjectId.isValid(notificationId)) {
                throw new errors_1.BadRequestError("Invalid notification ID!");
            }
            const notification = await notification_model_1.default.findOne({
                _id: notificationId,
                recipient: userId,
            });
            if (!notification) {
                throw new errors_1.NotFoundError("Notification not found!");
            }
            if (!notification.isRead) {
                notification.isRead = true;
                await notification.save();
            }
            // invalidate cache
            (0, cache_1.clearByPattern)(`notifications:${userId.toString()}:*`);
            return res.status(200).json({
                success: true,
                message: "Notification marked as read!",
            });
        }
        // if no notificationId is provided, mark ALL as read
        await notification_model_1.default.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        // invalidate cache
        (0, cache_1.clearByPattern)(`notifications:${userId.toString()}:*`);
        return res.status(200).json({
            success: true,
            message: "All notifications marked as read!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in markAsRead controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.markAsRead = markAsRead;
// delete a single notification
const deleteNotification = async (req, res) => {
    try {
        const userId = req.user?._id;
        const notificationId = req.params.notificationId;
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        if (typeof notificationId !== "string" ||
            !mongoose_1.default.Types.ObjectId.isValid(notificationId)) {
            throw new errors_1.BadRequestError("Invalid notification ID!");
        }
        const notification = await notification_model_1.default.findOneAndDelete({
            _id: notificationId,
            recipient: userId,
        });
        if (!notification) {
            throw new errors_1.NotFoundError("Notification not found!");
        }
        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in deleteNotification controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.deleteNotification = deleteNotification;
// clear all notifications for the current user
const clearAllNotifications = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        await notification_model_1.default.deleteMany({ recipient: userId });
        // invalidate cache
        (0, cache_1.clearByPattern)(`notifications:${userId.toString()}:*`);
        return res.status(200).json({
            success: true,
            message: "All notifications cleared successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in clearAllNotifications controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.clearAllNotifications = clearAllNotifications;
//# sourceMappingURL=notification.controllers.js.map