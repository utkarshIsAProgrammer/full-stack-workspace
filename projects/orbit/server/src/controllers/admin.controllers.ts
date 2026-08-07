import type { Request, Response, NextFunction } from "express";
import { FeatureFlag } from "../models/featureFlag.model";
import { User } from "../models/user.model";
import Report from "../models/report.model";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Glimpse from "../models/glimpse.model";
import { Community } from "../models/community.model";
import { ModerationItem } from "../models/moderationItem.model";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";
import { deleteCache } from "../configs/cache";
import { clearMemUserCache } from "../middlewares/auth.middleware";
import {
  disconnectUserSockets,
  getOnlineUsersCount,
} from "../configs/socket";

/**
 * GET /api/admin/stats — platform overview metrics (admin only).
 */
export const getAdminStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalGlances,
      totalCommunities,
      pendingReports,
      pendingModeration,
      mutedUsers,
      bannedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ status: { $ne: "draft" } }),
      Comment.countDocuments(),
      Glimpse.countDocuments(),
      Community.countDocuments(),
      Report.countDocuments({ status: "pending" }),
      ModerationItem.countDocuments({ status: "pending" }),
      User.countDocuments({ isMuted: true }),
      User.countDocuments({ isBanned: true }),
    ]);

    // Authoritative "online now" count from in-memory socket presence.
    // (updatedAt is bumped by logins/profile edits, so a DB-based "active
    // in 24h" query would overcount — it always equalled totalUsers.)
    const onlineUsers = getOnlineUsersCount();

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalPosts,
        totalComments,
        totalGlances,
        totalCommunities,
        pendingReports,
        pendingModeration,
        activeUsers: onlineUsers,
        mutedUsers,
        bannedUsers,
      },
    });
  } catch (err: any) {
    logger.error("Error getting admin stats", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const createFeatureFlag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const { key, description, enabled, percentage } = req.body;
    if (!key) return next(new BadRequestError("Flag key is required!"));

    const existing = await FeatureFlag.findOne({ key });
    if (existing) return next(new BadRequestError("Flag with this key already exists!"));

    const flag = new FeatureFlag({ key, description, enabled, percentage });
    await flag.save();

    return res.status(201).json({ success: true, flag });
  } catch (err: any) {
    logger.error("Error creating feature flag", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getFeatureFlags = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const flags = await FeatureFlag.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, flags });
  } catch (err: any) {
    logger.error("Error getting feature flags", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const updateFeatureFlag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const { flagId } = req.params;
    const updates = req.body;

    const flag = await FeatureFlag.findByIdAndUpdate(flagId, updates, { new: true });
    if (!flag) return next(new NotFoundError("Flag not found!"));

    return res.status(200).json({ success: true, flag });
  } catch (err: any) {
    logger.error("Error updating feature flag", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getUserFlags = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const flags = await FeatureFlag.find({ enabled: true }).lean();

    const userFlags: Record<string, boolean> = {};
    for (const flag of flags) {
      if (flag.adminOverride) {
        userFlags[flag.key] = true;
        continue;
      }
      if (flag.users.length > 0) {
        userFlags[flag.key] = flag.users.some((u) => u.toString() === currentUserId.toString());
        continue;
      }
      // Check by percentage
      if (flag.percentage >= 100) {
        userFlags[flag.key] = true;
      } else if (flag.percentage > 0) {
        const hash = (currentUserId.toString() + flag.key).split("").reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
        userFlags[flag.key] = Math.abs(hash) % 100 < flag.percentage;
      } else {
        userFlags[flag.key] = false;
      }
    }

    return res.status(200).json({ success: true, flags: userFlags });
  } catch (err: any) {
    logger.error("Error getting user flags", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

// Admin user management
export const toggleUserMute = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const { userId } = req.params;
    const { muted } = req.body;

    const targetUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isMuted: muted } },
      { new: true },
    );

    if (!targetUser) return next(new NotFoundError("User not found!"));

    await deleteCache(`auth:user:${userId}`);
    clearMemUserCache(String(userId));

    return res.status(200).json({ success: true, message: muted ? "User muted" : "User unmuted" });
  } catch (err: any) {
    logger.error("Error toggling user mute", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const toggleUserBan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as any;
    if (!user?.isAdmin) return next(new ForbiddenError("Admin access required!"));

    const { userId } = req.params;
    const { banned } = req.body;

    const targetUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isBanned: banned } },
      { new: true },
    );

    if (!targetUser) return next(new NotFoundError("User not found!"));

    await deleteCache(`auth:user:${userId}`);
    clearMemUserCache(String(userId));

    if (banned && typeof userId === "string") {
      disconnectUserSockets(userId);
    }

    return res.status(200).json({ success: true, message: banned ? "User banned" : "User unbanned" });
  } catch (err: any) {
    logger.error("Error toggling user ban", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

