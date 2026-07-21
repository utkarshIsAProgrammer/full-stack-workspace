import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Group, GroupDocument } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utilities/errors";
import { sanitizePlainText } from "../configs/sanitize";
import { getIO } from "../configs/socket";
import { logger } from "../utilities/logger";

/**
 * POST /api/chats/groups — Create a group chat.
 */
export const createGroup = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;
  const name = typeof req.body.name === "string" ? req.body.name : "";
  const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!name || !name.trim()) throw new BadRequestError("Group name is required!");
    if (memberIds.length === 0) {
      throw new BadRequestError("At least one member is required!");
    }

    const members = [currentUserId.toString(), ...memberIds.filter((id: string) => id !== currentUserId.toString())];
    const uniqueMembers = [...new Set(members)];

    const group = new Group({
      name: name.trim(),
      admin: currentUserId,
      members: uniqueMembers.map((id: string) => new mongoose.Types.ObjectId(id)),
    });

    await group.save();

    const populated = await Group.findById(group._id)
      .populate("admin", "username fullName profilePic")
      .populate("members", "username fullName profilePic")
      .lean();

    return res.status(201).json({ success: true, group: populated });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in createGroup", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/chats/groups — List groups the current user is in.
 */
export const getMyGroups = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");

    const groups = await Group.find({ members: currentUserId })
      .populate("admin", "username fullName profilePic")
      .populate("members", "username fullName profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, groups });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getMyGroups", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * PUT /api/chats/groups/:groupId — Update group name/avatar.
 */
export const updateGroup = async (req: Request, res: Response) => {
  const groupId: string = req.params.groupId as string;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");
    if (group.admin.toString() !== currentUserId.toString()) throw new ForbiddenError("Only admin can update group!");

    if (req.body.name) group.name = req.body.name.trim();
    await group.save();

    return res.status(200).json({ success: true, message: "Group updated!", group });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in updateGroup", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/chats/groups/:groupId/add — Add members to group.
 */
export const addGroupMembers = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const currentUserId = req.user?._id;
  const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");
    if (group.admin.toString() !== currentUserId.toString()) throw new ForbiddenError("Only admin can add members!");

    const existingIds = new Set(group.members.map((m) => m.toString()));
    const toAdd = (memberIds || []).filter((id: string) => !existingIds.has(id));

    for (const id of toAdd) {
      group.members.push(new mongoose.Types.ObjectId(id));
    }
    await group.save();

    const io = getIO();
    toAdd.forEach((userId: string) => {
      io.to(`user:${userId}`).emit("group:member:added", { groupId, groupName: group.name });
    });

    return res.status(200).json({ success: true, message: `${toAdd.length} member(s) added!` });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in addGroupMembers", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/chats/groups/:groupId/remove — Remove members from group.
 */
export const removeGroupMembers = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const currentUserId = req.user?._id;
  const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");
    if (group.admin.toString() !== currentUserId.toString()) throw new ForbiddenError("Only admin can remove members!");

    const removeSet = new Set((memberIds || []).map((id: string) => id.toString()));
    group.members = group.members.filter((m) => !removeSet.has(m.toString()));
    await group.save();

    const io = getIO();
    memberIds.forEach((userId: string) => {
      io.to(`user:${userId}`).emit("group:member:removed", { groupId, groupName: group.name });
    });

    return res.status(200).json({ success: true, message: `${memberIds.length} member(s) removed!` });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in removeGroupMembers", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * DELETE /api/chats/groups/:groupId — Delete group.
 */
export const deleteGroup = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");
    if (group.admin.toString() !== currentUserId.toString()) throw new ForbiddenError("Only admin can delete group!");

    await GroupMessage.deleteMany({ group: groupId });
    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({ success: true, message: "Group deleted!" });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in deleteGroup", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * GET /api/chats/groups/:groupId/messages — Get group messages.
 */
export const getGroupMessages = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const currentUserId = req.user?._id;
  const cursor = req.query.cursor as string;
  const limit = Math.min(Number(req.query.limit) || 30, 50);

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");

    const query: any = { group: new mongoose.Types.ObjectId(groupId), isDeleted: { $ne: true } };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const messages = await GroupMessage.find(query)
      .populate("sender", "username fullName profilePic")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();
    messages.reverse();

    const nextCursor = hasMore && messages.length > 0 ? (messages[0]!._id) : null;

    return res.status(200).json({ success: true, messages, nextCursor, hasMore });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in getGroupMessages", { error: err.message });
    throw new AppError("Internal server error!");
  }
};

/**
 * POST /api/chats/groups/:groupId/messages — Send a group message.
 */
export const sendGroupMessage = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const currentUserId = req.user?._id;
  const text = typeof req.body.text === "string" ? req.body.text : "";

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(groupId)) throw new BadRequestError("Invalid group ID!");
    if (!text || !text.trim()) throw new BadRequestError("Message text is required!");

    const group = await Group.findById(groupId);
    if (!group) throw new NotFoundError("Group not found!");

    const isMember = group.members.some((m) => m.toString() === currentUserId.toString());
    if (!isMember) throw new ForbiddenError("You are not a member of this group!");

    const message = new GroupMessage({
      group: groupId,
      sender: currentUserId,
      text: sanitizePlainText(text),
    });    await message.save();

    const populated = await GroupMessage.findById(message._id)
      .populate("sender", "username fullName profilePic")
      .lean();

    if (!populated) {
      return res.status(201).json({ success: true, message: "Message sent!", sentMessage: message });
    }

    group.lastMessage = message._id;
    group.updatedAt = new Date();
    await group.save();

    const io = getIO();
    group.members.forEach((memberId) => {
      if (memberId) {
        io.to(`user:${memberId.toString()}`).emit("group:message:new", populated);
      }
    });

    return res.status(201).json({ success: true, message: "Message sent!", sentMessage: populated });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error("Error in sendGroupMessage", { error: err.message });
    throw new AppError("Internal server error!");
  }
};
