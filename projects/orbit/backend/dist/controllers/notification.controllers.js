"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotifications = exports.getUnreadCount = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
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
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        const unreadCount = await notification_model_1.default.countDocuments({
            recipient: userId,
            isRead: false,
        });
        return res.status(200).json({
            success: true,
            unreadCount,
        });
    }
    catch (err) {
        console.log(`Error in getUnreadCount controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getUnreadCount = getUnreadCount;
// get all notifications
const getNotifications = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        // pagination
        const limit = Math.min(Number(req.query.limit) || 10, 20);
        const cursor = req.query.cursor;
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
        const last = notifications[notifications.length - 1];
        const nextCursor = last?.createdAt && last?._id
            ? encodeNotificationCursor(last.createdAt, last._id)
            : null;
        return res.status(200).json({
            success: true,
            message: "Notifications fetched successfully!",
            notifications,
            hasMore,
            nextCursor,
        });
    }
    catch (err) {
        console.log(`Error in getNotifications controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getNotifications = getNotifications;
// mark notifications as read
const markAsRead = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access!",
            });
        }
        await notification_model_1.default.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        return res.status(200).json({
            success: true,
            message: "Notifications marked as read!",
        });
    }
    catch (err) {
        console.log(`Error in markAsRead controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.markAsRead = markAsRead;
//# sourceMappingURL=notification.controllers.js.map