import type { Request, Response, NextFunction } from "express";
import { UserStreak } from "../models/userStreak.model";
import { DailyReward } from "../models/dailyReward.model";
import Notification from "../models/notification.model";
import {
  BadRequestError,
  UnauthorizedError,
  AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";

export const getMyStreaks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    let streak = await UserStreak.findOne({ user: currentUserId });
    if (!streak) {
      streak = new UserStreak({ user: currentUserId });
      await streak.save();
    }

    // Also fetch daily reward status so the frontend knows if today's reward was claimed
    let dailyRewardClaimed = false;
    const reward = await DailyReward.findOne({ user: currentUserId });
    if (reward) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastClaim = reward.lastClaimedDate
        ? new Date(reward.lastClaimedDate.getFullYear(), reward.lastClaimedDate.getMonth(), reward.lastClaimedDate.getDate())
        : null;
      dailyRewardClaimed = lastClaim ? lastClaim.getTime() === today.getTime() : false;
    }

    return res.status(200).json({
      success: true,
      streak: {
        ...(streak as any)._doc,
        dailyRewardClaimed,
      },
    });
  } catch (err: any) {
    logger.error("Error getting streaks", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const claimDailyReward = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    let reward = await DailyReward.findOne({ user: currentUserId });
    if (!reward) {
      reward = new DailyReward({ user: currentUserId });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastClaim = reward.lastClaimedDate
      ? new Date(reward.lastClaimedDate.getFullYear(), reward.lastClaimedDate.getMonth(), reward.lastClaimedDate.getDate())
      : null;

    if (lastClaim && lastClaim.getTime() === today.getTime()) {
      return res.status(400).json({
        success: false,
        message: "You already claimed today's reward!",
      });
    }

    // Update streak
    if (lastClaim) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastClaim.getTime() === yesterday.getTime()) {
        reward.currentStreak += 1;
      } else {
        reward.currentStreak = 1;
      }
    } else {
      reward.currentStreak = 1;
    }

    reward.longestStreak = Math.max(reward.longestStreak, reward.currentStreak);

    // Calculate points based on streak
    const streakMultiplier = Math.min(reward.currentStreak, 30);
    const pointsEarned = 50 + (streakMultiplier - 1) * 10;
    reward.totalPoints += pointsEarned;
    reward.lastClaimedDate = now;

    await reward.save();

    // Also update UserStreak
    let streak = await UserStreak.findOne({ user: currentUserId });
    if (!streak) {
      streak = new UserStreak({ user: currentUserId, currentStreak: reward.currentStreak, longestStreak: reward.longestStreak, lastActiveDate: now });
    } else {
      streak.currentStreak = reward.currentStreak;
      streak.longestStreak = reward.longestStreak;
      streak.lastActiveDate = now;
    }
    await streak.save();

    return res.status(200).json({
      success: true,
      reward: {
        pointsEarned,
        currentStreak: reward.currentStreak,
        longestStreak: reward.longestStreak,
        totalPoints: reward.totalPoints,
      },
    });
  } catch (err: any) {
    logger.error("Error claiming daily reward", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getRewardStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    let reward = await DailyReward.findOne({ user: currentUserId });
    if (!reward) {
      reward = new DailyReward({ user: currentUserId });
      await reward.save();
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastClaim = reward.lastClaimedDate
      ? new Date(reward.lastClaimedDate.getFullYear(), reward.lastClaimedDate.getMonth(), reward.lastClaimedDate.getDate())
      : null;
    const claimedToday = lastClaim ? lastClaim.getTime() === today.getTime() : false;

    const nextRewardPoints = 50 + Math.min(reward.currentStreak, 30) * 10;

    return res.status(200).json({
      success: true,
      reward: {
        currentStreak: reward.currentStreak,
        longestStreak: reward.longestStreak,
        totalPoints: reward.totalPoints,
        claimedToday,
        nextRewardPoints,
      },
    });
  } catch (err: any) {
    logger.error("Error getting reward status", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const updatePartnerStreak = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { partnerId } = req.params as { partnerId: string };

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Update current user's partner streak
    let streak = await UserStreak.findOne({ user: currentUserId });
    if (!streak) {
      streak = new UserStreak({ user: currentUserId });
    }
    if (!streak.partnerStreaks) {
      streak.partnerStreaks = new Map();
    }

    const partnerData = streak.partnerStreaks.get(partnerId) || { currentStreak: 0, lastActiveDate: null };
    const lastPartnerDate = partnerData.lastActiveDate
      ? new Date(partnerData.lastActiveDate.getFullYear(), partnerData.lastActiveDate.getMonth(), partnerData.lastActiveDate.getDate())
      : null;

    if (lastPartnerDate) {
      if (lastPartnerDate.getTime() === today.getTime()) {
        return res.status(200).json({
          success: true,
          partnerStreak: partnerData.currentStreak,
        });
      }
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastPartnerDate.getTime() === yesterday.getTime()) {
        partnerData.currentStreak += 1;
      } else {
        partnerData.currentStreak = 1;
      }
    } else {
      partnerData.currentStreak = 1;
    }

    partnerData.lastActiveDate = now;
    streak.partnerStreaks.set(partnerId, partnerData);
    await streak.save();

    return res.status(200).json({
      success: true,
      partnerStreak: partnerData.currentStreak,
    });
  } catch (err: any) {
    logger.error("Error updating partner streak", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};
