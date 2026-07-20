import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import UserInvite from "../models/userInvite.model";
import { User } from "../models/user.model";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";

export const generateInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const existing = await UserInvite.findOne({
      inviter: currentUserId,
      status: "pending",
    });

    if (existing) {
      return res.status(200).json({ success: true, inviteCode: existing.inviteCode });
    }

    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const invite = new UserInvite({ inviter: currentUserId, inviteCode });
    await invite.save();

    return res.status(201).json({ success: true, inviteCode });
  } catch (err: any) {
    logger.error("Error generating invite code", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getMyInvites = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const invites = await UserInvite.find({ inviter: currentUserId })
      .populate("invitedUser", "username fullName profilePic createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, invites });
  } catch (err: any) {
    logger.error("Error getting invites", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const redeemInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { code } = req.params;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));
    if (!code || typeof code !== "string") return next(new BadRequestError("Invite code is required!"));

    const invite = await UserInvite.findOne({ inviteCode: code.toUpperCase(), status: "pending" });
    if (!invite) return next(new NotFoundError("Invalid or expired invite code!"));

    if (invite.inviter.toString() === currentUserId.toString()) {
      return next(new BadRequestError("You cannot use your own invite code!"));
    }

    invite.invitedUser = currentUserId;
    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();

    return res.status(200).json({ success: true, message: "Invite redeemed!" });
  } catch (err: any) {
    logger.error("Error redeeming invite code", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getInviteStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const totalInvites = await UserInvite.countDocuments({ inviter: currentUserId });
    const acceptedInvites = await UserInvite.countDocuments({ inviter: currentUserId, status: "accepted" });

    return res.status(200).json({
      success: true,
      stats: { totalInvites, acceptedInvites },
    });
  } catch (err: any) {
    logger.error("Error getting invite stats", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};
