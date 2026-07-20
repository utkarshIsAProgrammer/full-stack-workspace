import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { logger } from "../utilities/logger";

/**
 * Add a user to close friends list.
 * POST /api/users/close-friends/:userId
 */
export const addCloseFriend = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId as string;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: "Cannot add yourself as a close friend" });
    }

    const targetUser = await User.findById(targetUserId).select("_id").lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { closeFriends: targetUserId },
    });

    return res.status(200).json({ success: true, message: "Added to close friends" });
  } catch (err: any) {
    logger.error("Error in addCloseFriend", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to add close friend" });
  }
};

/**
 * Remove a user from close friends list.
 * DELETE /api/users/close-friends/:userId
 */
export const removeCloseFriend = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { closeFriends: targetUserId },
    });

    return res.status(200).json({ success: true, message: "Removed from close friends" });
  } catch (err: any) {
    logger.error("Error in removeCloseFriend", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to remove close friend" });
  }
};

/**
 * Get close friends list.
 * GET /api/users/close-friends
 */
export const getCloseFriends = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();

    const user = await User.findById(currentUserId)
      .populate("closeFriends", "_id username fullName profilePic")
      .lean();

    return res.status(200).json({
      success: true,
      closeFriends: user?.closeFriends || [],
    });
  } catch (err: any) {
    logger.error("Error in getCloseFriends", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to get close friends" });
  }
};

/**
 * Check if a user is a close friend.
 * GET /api/users/close-friends/:userId/check
 */
export const checkCloseFriend = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user._id?.toString();
    const targetUserId = req.params.userId;

    const user = await User.findById(currentUserId).select("closeFriends").lean();
    const isCloseFriend = (user?.closeFriends || []).some(
      (id) => id.toString() === targetUserId
    );

    return res.status(200).json({ success: true, isCloseFriend });
  } catch (err: any) {
    logger.error("Error in checkCloseFriend", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to check close friend status" });
  }
};
