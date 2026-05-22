import type { Request, Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/notification.model";

const encodeNotificationCursor = (
  createdAt: Date,
  id: mongoose.Types.ObjectId,
) => `${createdAt.getTime()}_${id.toString()}`;

const decodeNotificationCursor = (cursor: string) => {
  const separatorIndex = cursor.indexOf("_");
  if (separatorIndex === -1) return null;

  const timestamp = Number(cursor.slice(0, separatorIndex));
  const id = cursor.slice(separatorIndex + 1);

  if (!Number.isFinite(timestamp) || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return { createdAt: new Date(timestamp), id };
};

// get unread notification count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (err: any) {
    console.log(`Error in getUnreadCount controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// get all notifications
export const getNotifications = async (req: Request, res: Response) => {
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
    const cursor = req.query.cursor as string;

    const query: Record<string, unknown> = { recipient: userId };
    if (cursor) {
      const decoded = decodeNotificationCursor(cursor);
      if (decoded) {
        query.$or = [
          { createdAt: { $lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
        ];
      }
    }

    const notifications = await Notification.find(query)
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
    const nextCursor =
      last?.createdAt && last?._id
        ? encodeNotificationCursor(last.createdAt, last._id)
        : null;

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully!",
      notifications,
      hasMore,
      nextCursor,
    });
  } catch (err: any) {
    console.log(`Error in getNotifications controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// mark notifications as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const notificationId = req.params.notificationId as string | undefined;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // if notificationId is provided, mark only that single notification as read
    if (notificationId) {
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID!",
        });
      }

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId, isRead: false },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found or already read!",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification marked as read!",
      });
    }

    // if no notificationId is provided, mark ALL as read
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read!",
    });
  } catch (err: any) {
    console.log(`Error in markAsRead controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
