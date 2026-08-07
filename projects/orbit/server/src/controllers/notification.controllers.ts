import type { Request, Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/notification.model";
import { getCache, setCache, deleteCache, clearByPattern } from "../configs/cache";
import { logger } from "../utilities/logger";
import {
	AppError,
	BadRequestError,
	UnauthorizedError,
	NotFoundError,
} from "../utilities/errors";

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
			// If no user, just return 0
			return res.status(200).json({
				success: true,
				unreadCount: 0,
			});
		}

		// cache key — 15s TTL is enough since notifications come via socket
		const cacheKey = `notifications:unread:${userId.toString()}`;
		try {
			const cached = await getCache<{ unreadCount: number }>(cacheKey);
			if (cached) return res.status(200).json(cached);
		} catch (err: any) {
			logger.error(`Cache error in getUnreadCount!`, { error: err.message });
		}

		const unreadCount = await Notification.countDocuments({
			recipient: userId,
			isRead: false,
		});

		const responseData = { success: true, unreadCount };

		try {
			await setCache(cacheKey, responseData, 15);
		} catch (err: any) {
			logger.error(`Cache set error in getUnreadCount!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getUnreadCount controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// get all notifications
export const getNotifications = async (req: Request, res: Response) => {
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
		const cursor = req.query.cursor as string;

		// cache key
		const cacheKey = `notifications:${userId}:${cursor || "first"}:${limit}`;

		// try cache first
		try {
			const cached = await getCache(cacheKey);
			if (cached) return res.status(200).json(cached);
		} catch (err: any) {
			logger.error(`Cache error in getNotifications!`, { error: err.message });
		}

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
			.populate({
				path: "comment",
				select: "content post",
				// allow comment_share notifications to open the post that holds
				// the shared comment
				populate: { path: "post", select: "slug" },
			})
			.populate({
				path: "glimpse",
				select: "author",
				// allow glimpse_share notifications to open the glance author
				populate: { path: "author", select: "username fullName" },
			})
			.populate("user", "username fullName profilePic")
			.lean();

		const hasMore = notifications.length > limit;
		if (hasMore) {
			notifications.pop();
		}

		const last = notifications.slice(-1).shift();
		const nextCursor =
			last?.createdAt && last?._id
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
			await setCache(cacheKey, responseData, 30);
		} catch (err: any) {
			logger.error(`Cache set error in getNotifications!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getNotifications controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};	// mark notifications as read
export const markAsRead = async (req: Request, res: Response) => {
	try {
		const userId = req.user?._id;
		const notificationId = req.params.notificationId as string | undefined;

		if (!userId) {
			throw new UnauthorizedError("Unauthorized access!");
		}

		// Helper to clear all notification caches — the list cache, the unread
		// count cache (`notifications:unread:userId`), AND the route-level
		// cacheMiddleware keys (`api:<userId>:/unread-count:<query>` and
		// `api:<userId>:/:<query>`). Without the middleware keys, the badge
		// endpoint keeps serving the pre-read count for up to its TTL, so the
		// bell badge stays stale after marking notifications read.
		const clearNotificationCaches = async (uid: string) => {
			await clearByPattern(`notifications:${uid}:*`);
			await deleteCache(`notifications:unread:${uid}`);
			await clearByPattern(`api:${uid}:/unread-count*`);
			await clearByPattern(`api:${uid}:/:*`);
		};

		// if notificationId is provided, mark only that single notification as read
		if (notificationId) {
			if (!mongoose.Types.ObjectId.isValid(notificationId)) {
				throw new BadRequestError("Invalid notification ID!");
			}

			const notification = await Notification.findOne({
				_id: notificationId,
				recipient: userId,
			});

			if (!notification) {
				throw new NotFoundError("Notification not found!");
			}

			if (!notification.isRead) {
				notification.isRead = true;
				await notification.save();
			}

			// invalidate caches
			await clearNotificationCaches(userId.toString());

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

		// invalidate caches
		await clearNotificationCaches(userId.toString());

		return res.status(200).json({
			success: true,
			message: "All notifications marked as read!",
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in markAsRead controller!`, { error: err.message });
		throw new AppError("Internal server error!");
	}
};

// delete a single notification
export const deleteNotification = async (req: Request, res: Response) => {
	try {
		const userId = req.user?._id;
		const notificationId = req.params.notificationId;

		if (!userId) {
			throw new UnauthorizedError("Unauthorized access!");
		}

		if (
			typeof notificationId !== "string" ||
			!mongoose.Types.ObjectId.isValid(notificationId)
		) {
			throw new BadRequestError("Invalid notification ID!");
		}

		const notification = await Notification.findOneAndDelete({
			_id: notificationId,
			recipient: userId,
		});

		if (!notification) {
			throw new NotFoundError("Notification not found!");
		}

		await clearByPattern(`notifications:${userId.toString()}:*`);
		await deleteCache(`notifications:unread:${userId.toString()}`);
		// Invalidate route-level cacheMiddleware keys so the badge + list
		// reflect the deletion immediately (not after the middleware TTL).
		await clearByPattern(`api:${userId.toString()}:/unread-count*`);
		await clearByPattern(`api:${userId.toString()}:/:*`);

		return res.status(200).json({
			success: true,
			message: "Notification deleted successfully!",
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in deleteNotification controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// clear all notifications for the current user
export const clearAllNotifications = async (req: Request, res: Response) => {
	try {
		const userId = req.user?._id;

		if (!userId) {
			throw new UnauthorizedError("Unauthorized access!");
		}

		await Notification.deleteMany({ recipient: userId });

		// invalidate both caches (list + unread count)
		await clearByPattern(`notifications:${userId.toString()}:*`);
		await deleteCache(`notifications:unread:${userId.toString()}`);
		// Invalidate route-level cacheMiddleware keys so the badge + list
		// reflect the wipe immediately (not after the middleware TTL).
		await clearByPattern(`api:${userId.toString()}:/unread-count*`);
		await clearByPattern(`api:${userId.toString()}:/:*`);

		return res.status(200).json({
			success: true,
			message: "All notifications cleared successfully!",
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in clearAllNotifications controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};
