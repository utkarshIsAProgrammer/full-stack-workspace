import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import AudioRoom from "../models/audioRoom.model";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";
import { getIO } from "../configs/socket";
import Notification from "../models/notification.model";

export const createAudioRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { title, description } = req.body;

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));
    if (!title || typeof title !== "string" || !title.trim()) {
      return next(new BadRequestError("Room title is required!"));
    }
    if (title.trim().length > 200) {
      return next(new BadRequestError("Title cannot exceed 200 characters!"));
    }

    const room = new AudioRoom({
      host: currentUserId,
      title: title.trim(),
      description: description?.trim() || "",
      speakers: [currentUserId],
    });

    await room.save();

    const populated = await AudioRoom.findById(room._id)
      .populate("host", "username fullName profilePic")
      .populate("speakers", "username fullName profilePic")
      .lean();

    const io = getIO();
    io.emit("room:created", populated);

    return res.status(201).json({ success: true, room: populated });
  } catch (err: any) {
    logger.error("Error creating audio room", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getLiveRooms = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const query: any = { isLive: true };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const rooms = await AudioRoom.find(query)
      .populate("host", "username fullName profilePic")
      .populate("speakers", "username fullName profilePic")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rooms.length > limit;
    if (hasMore) {
      rooms.pop();
    }
    const nextCursor = rooms.slice(-1).shift()?._id || null;

    return res.status(200).json({ success: true, rooms, hasMore, nextCursor });
  } catch (err: any) {
    logger.error("Error getting live rooms", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const getAudioRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { roomId } = req.params as { roomId: string };

  try {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return next(new BadRequestError("Invalid room ID!"));
    }

    const room = await AudioRoom.findById(roomId)
      .populate("host", "username fullName profilePic")
      .populate("speakers", "username fullName profilePic")
      .populate("listeners", "username fullName profilePic")
      .lean();

    if (!room) return next(new NotFoundError("Room not found!"));

    return res.status(200).json({ success: true, room });
  } catch (err: any) {
    logger.error("Error getting audio room", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const joinAudioRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { roomId } = req.params as { roomId: string };

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const room = await AudioRoom.findById(roomId);
    if (!room) return next(new NotFoundError("Room not found!"));
    if (!room.isLive) return next(new BadRequestError("Room is not live!"));

    const userIdStr = currentUserId.toString();

    if (!room.speakers.some((s) => s.toString() === userIdStr) &&
        !room.listeners.some((l) => l.toString() === userIdStr)) {
      if (room.maxListeners > 0 && room.listeners.length >= room.maxListeners) {
        return next(new BadRequestError("Room is full!"));
      }
      room.listeners.push(currentUserId);
      await room.save();
    }

    const io = getIO();
    io.to(`room:${roomId}`).emit("room:user-joined", { roomId, userId: userIdStr });

    return res.status(200).json({ success: true, message: "Joined room!" });
  } catch (err: any) {
    logger.error("Error joining audio room", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const leaveAudioRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { roomId } = req.params as { roomId: string };

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const room = await AudioRoom.findById(roomId);
    if (!room) return next(new NotFoundError("Room not found!"));

    const userIdStr = currentUserId.toString();

    room.speakers = room.speakers.filter((s) => s.toString() !== userIdStr);
    room.listeners = room.listeners.filter((l) => l.toString() !== userIdStr);

    // If host leaves, end the room
    if (room.host.toString() === userIdStr) {
      room.isLive = false;
      room.endedAt = new Date();

      const io = getIO();
      io.to(`room:${roomId}`).emit("room:ended", { roomId });

      await room.save();
      return res.status(200).json({ success: true, message: "Room ended!" });
    }

    await room.save();

    const io = getIO();
    io.to(`room:${roomId}`).emit("room:user-left", { roomId, userId: userIdStr });

    return res.status(200).json({ success: true, message: "Left room!" });
  } catch (err: any) {
    logger.error("Error leaving audio room", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};

export const inviteToRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentUserId = req.user?._id;
  const { roomId, userId } = req.params as { roomId: string; userId: string };

  try {
    if (!currentUserId) return next(new UnauthorizedError("Unauthorized!"));

    const room = await AudioRoom.findById(roomId);
    if (!room) return next(new NotFoundError("Room not found!"));
    if (!room.isLive) return next(new BadRequestError("Room is not live!"));

    const currentUserIdStr = currentUserId.toString();
    const isHost = room.host.toString() === currentUserIdStr;
    const isSpeaker = room.speakers.some((s) => s.toString() === currentUserIdStr);
    const isListener = room.listeners.some((l) => l.toString() === currentUserIdStr);

    if (!isHost && !isSpeaker && !isListener) {
      return next(new ForbiddenError("You must be in the room to invite others!"));
    }

    await Notification.create({
      recipient: userId,
      sender: currentUserId,
      type: "room_invite",
      room: room._id,
    });

    const io = getIO();
    io.to(`user:${userId}`).emit("notification", {
      type: "room_invite",
      sender: req.user,
      room: { _id: room._id, title: room.title },
    });

    return res.status(200).json({ success: true, message: "Invite sent!" });
  } catch (err: any) {
    logger.error("Error inviting to room", { error: err.message });
    return next(new AppError("Internal server error!"));
  }
};
