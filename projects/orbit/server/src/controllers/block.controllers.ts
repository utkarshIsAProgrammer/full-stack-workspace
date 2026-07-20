import { Request, Response } from "express";
import Block from "../models/block.model";
import Follow from "../models/follow.model";
import { User } from "../models/user.model";
import { logger } from "../utilities/logger";

/**
 * Block a user.
 * POST /api/blocks/:userId
 */
export const blockUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: "Cannot block yourself" });
    }

    // Check if already blocked
    const existing = await Block.findOne({ blocker: currentUserId, blocked: targetUserId });
    if (existing) {
      return res.status(200).json({ success: true, message: "Already blocked", blocked: true });
    }

    await Block.create({ blocker: currentUserId as any, blocked: targetUserId as any });

    // Unfollow if following (clean up follow relationships and update counters)
    try {
      const followA = await Follow.findOneAndDelete({ follower: currentUserId, following: targetUserId });
      if (followA) {
        await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
      }

      const followB = await Follow.findOneAndDelete({ follower: targetUserId, following: currentUserId });
      if (followB) {
        await User.findByIdAndUpdate(targetUserId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(currentUserId, { $inc: { followersCount: -1 } });
      }
    } catch { /* non-critical */ }

    logger.info(`User ${currentUserId} blocked user ${targetUserId}`);
    return res.status(200).json({ success: true, message: "User blocked", blocked: true });
  } catch (err: any) {
    logger.error("Error in blockUser", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to block user" });
  }
};

/**
 * Unblock a user.
 * DELETE /api/blocks/:userId
 */
export const unblockUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    await Block.findOneAndDelete({ blocker: currentUserId, blocked: targetUserId });

    logger.info(`User ${currentUserId} unblocked user ${targetUserId}`);
    return res.status(200).json({ success: true, message: "User unblocked", blocked: false });
  } catch (err: any) {
    logger.error("Error in unblockUser", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to unblock user" });
  }
};

/**
 * Get list of users blocked by the current user.
 * GET /api/blocks
 */
export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();

    const blocks = await Block.find({ blocker: currentUserId })
      .populate("blocked", "_id username fullName profilePic")
      .sort({ createdAt: -1 });

    const users = blocks.map((b) => b.blocked);

    return res.status(200).json({ success: true, users });
  } catch (err: any) {
    logger.error("Error in getBlockedUsers", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to get blocked users" });
  }
};

/**
 * Check if current user has blocked a specific user.
 * GET /api/blocks/:userId/check
 */
export const checkBlocked = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    const block = await Block.findOne({ blocker: currentUserId, blocked: targetUserId });
    const blockedByThem = await Block.findOne({ blocker: targetUserId, blocked: currentUserId });

    return res.status(200).json({
      success: true,
      iBlocked: !!block,
      blockedByThem: !!blockedByThem,
    });
  } catch (err: any) {
    logger.error("Error in checkBlocked", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to check block status" });
  }
};

/**
 * Mute a user for 30 days.
 * POST /api/blocks/:userId/mute
 */
export const muteUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    // First remove any existing mute for this user (prevent duplicates)
    await User.findByIdAndUpdate(currentUserId, {
      $pull: { mutedUsers: { user: targetUserId as any } },
    });
    // Then add new mute
    await User.findByIdAndUpdate(currentUserId, {
      $push: {
        mutedUsers: {
          user: targetUserId,
          mutedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      },
    });

    return res.status(200).json({ success: true, message: "User muted for 30 days", muted: true });
  } catch (err: any) {
    logger.error("Error in muteUser", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to mute user" });
  }
};

/**
 * Unmute a user.
 * DELETE /api/blocks/:userId/mute
 */
export const unmuteUser = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { mutedUsers: { user: targetUserId } },
    });

    return res.status(200).json({ success: true, message: "User unmuted", muted: false });
  } catch (err: any) {
    logger.error("Error in unmuteUser", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to unmute user" });
  }
};
