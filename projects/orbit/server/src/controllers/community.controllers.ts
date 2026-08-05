import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { Community } from "../models/community.model";
import { CommunityMessage } from "../models/communityMessage.model";
import Notification from "../models/notification.model";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";
import { sanitizePlainText } from "../configs/sanitize";
import cloudinary from "../configs/cloudinary";
import { getIO } from "../configs/socket";
import { generateToken } from "../services/livekitService";
import { sendPushToUser } from "../services/pushService";

type CommunityParams = {
	communityId: string;
};

type MessageParams = {
	messageId: string;
};

// ─── Communities ───────────────────────────────────────────────────

/**
 * Create a new community.
 * POST /api/communities
 */
export const createCommunity = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const { name, description } = req.body;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!name || typeof name !== "string" || !name.trim()) {
			return next(new BadRequestError("Community name is required!"));
		}

		if (name.trim().length > 50) {
			return next(new BadRequestError("Community name cannot exceed 50 characters!"));
		}

		// Handle optional image upload
		let image = { url: "", public_id: "" };
		if (req.file) {
			image = {
				url: (req.file as any).path,
				public_id: (req.file as any).filename,
			};
		}

		const community = new Community({
			name: name.trim(),
			description: description?.trim() || "",
			image,
			creator: currentUserId,
			members: [{ user: currentUserId, joinedAt: new Date() }],
			memberCount: 1,
		});

		await community.save();

		const populated = await Community.findById(community._id)
			.populate("creator", "username fullName profilePic")
			.populate("members.user", "username fullName profilePic")
			.lean();

		return res.status(201).json({
			success: true,
			message: "Community created successfully!",
			community: { ...populated, isMember: true },
		});
	} catch (err: any) {
		logger.error("Error in createCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const pinCommunityMessage = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		const message = await CommunityMessage.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		if (message.isDeleted) {
			return next(new BadRequestError("Cannot pin a deleted message!"));
		}

		const communityId = message.community.toString();
		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		// Verify user is creator
		const userIdStr = currentUserId.toString();
		if (community.creator.toString() !== userIdStr) {
			return next(
				new ForbiddenError("Only the community creator can pin messages!"),
			);
		}

		// Check if already pinned
		const alreadyPinned = community.pinnedMessages.some(
			(p) => p.toString() === messageId,
		);
		if (alreadyPinned) {
			return res.status(200).json({
				success: true,
				message: "Message is already pinned!",
			});
		}

		// Limit to 5 pinned messages — remove oldest if at limit
		if (community.pinnedMessages.length >= 5) {
			community.pinnedMessages.shift();
		}

		community.pinnedMessages.push(message._id);
		await community.save();

		const pinnedMessages = await CommunityMessage.find({
			_id: { $in: community.pinnedMessages },
		})
			.populate("sender", "username fullName profilePic")
			.sort({ createdAt: -1 })
			.lean();

		const io = getIO();
		io.to(`community:${communityId}`).emit("community:message:pinned", {
			communityId,
			messageId,
			pinnedMessages,
		});

		return res.status(200).json({
			success: true,
			message: "Message pinned!",
			pinnedMessages,
		});
	} catch (err: any) {
		logger.error("Error in pinCommunityMessage controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const unpinCommunityMessage = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		const community = await Community.findOne({
			pinnedMessages: messageId,
		});
		if (!community) {
			return next(new NotFoundError("Community with pinned message not found!"));
		}

		const userIdStr = currentUserId.toString();
		if (community.creator.toString() !== userIdStr) {
			return next(
				new ForbiddenError("Only the community creator can unpin messages!"),
			);
		}

		community.pinnedMessages = community.pinnedMessages.filter(
			(p) => p.toString() !== messageId,
		);
		await community.save();

		const communityId = community._id.toString();

		const pinnedMessages = await CommunityMessage.find({
			_id: { $in: community.pinnedMessages },
		})
			.populate("sender", "username fullName profilePic")
			.sort({ createdAt: -1 })
			.lean();

		const io = getIO();
		io.to(`community:${communityId}`).emit("community:message:unpinned", {
			communityId,
			messageId,
			pinnedMessages,
		});

		return res.status(200).json({
			success: true,
			message: "Message unpinned!",
			pinnedMessages,
		});
	} catch (err: any) {
		logger.error("Error in unpinCommunityMessage controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const getPinnedMessages = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		if (community.pinnedMessages.length === 0) {
			return res.status(200).json({
				success: true,
				pinnedMessages: [],
			});
		}

		const pinnedMessages = await CommunityMessage.find({
			_id: { $in: community.pinnedMessages },
			isDeleted: { $ne: true },
			clearedFor: { $nin: [currentUserId] },
		})
			.populate("sender", "username fullName profilePic")
			.populate({
				path: "replyTo",
				select: "sender text attachments createdAt",
				populate: { path: "sender", select: "username fullName profilePic" },
			})
			.sort({ createdAt: -1 })
			.lean();

		return res.status(200).json({
			success: true,
			pinnedMessages,
		});
	} catch (err: any) {
		logger.error("Error in getPinnedMessages controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const getCommunities = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const currentUserId = req.user?._id;
	const page = Math.max(1, parseInt(req.query.page as string) || 1);
	const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));
	const skip = (page - 1) * limit;

	try {
		const communities = await Community.find()
			.populate("creator", "username fullName profilePic")
			.populate("members.user", "username fullName profilePic")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		const total = await Community.countDocuments();

		// For each community, check if the current user is a member
		const communitiesWithMembership = communities.map((c: any) => {
			const isMember = currentUserId
				? c.members?.some(
					(m: any) => m.user?._id?.toString() === currentUserId.toString(),
				) || false
				: false;
			return { ...c, isMember };
		});

		return res.status(200).json({
			success: true,
			communities: communitiesWithMembership,
			total,
			page,
			totalPages: Math.ceil(total / limit),
		});
	} catch (err: any) {
		logger.error("Error in getCommunities controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const getCommunity = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId)
			.populate("creator", "username fullName profilePic")
			.populate("members.user", "username fullName profilePic")
			.lean();

		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		const isMember = currentUserId
			? (community as any).members?.some(
				(m: any) => m.user?._id?.toString() === currentUserId.toString(),
			) || false
			: false;

		return res.status(200).json({
			success: true,
			community: { ...community, isMember },
		});
	} catch (err: any) {
		logger.error("Error in getCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const getMyCommunities = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		const communities = await Community.find({ 'members.user': currentUserId })
			.populate("creator", "username fullName profilePic")
			.populate("members.user", "username fullName profilePic")
			.sort({ updatedAt: -1 })
			.lean();

		return res.status(200).json({
			success: true,
			communities: communities.map((c: any) => ({ ...c, isMember: true })),
		});
	} catch (err: any) {
		logger.error("Error in getMyCommunities controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

// ─── Get community members (with join dates) ──────────────────────

export const getCommunityMembers = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId)
			.populate("members.user", "username fullName profilePic")
			.lean();

		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		// Verify user is a member
		const isMember = (community as any).members?.some(
			(m: any) => m.user?._id?.toString() === currentUserId.toString(),
		);

		if (!isMember) {
			return next(
				new ForbiddenError("You must be a member to see the member list!"),
			);
		}

		const members = (community as any).members || [];

		return res.status(200).json({
			success: true,
			members: members.map((m: any) => ({
				user: m.user,
				joinedAt: m.joinedAt,
			})),
		});
	} catch (err: any) {
		logger.error("Error in getCommunityMembers controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const joinCommunity = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		const userIdStr = currentUserId.toString();
		const alreadyMember = community.members.some(
			(m) => m.user.toString() === userIdStr,
		);

		if (alreadyMember) {
			return res.status(200).json({
				success: true,
				message: "You are already a member of this community!",
				isMember: true,
			});
		}

		community.members.push({ user: currentUserId, joinedAt: new Date() });
		community.memberCount = community.members.length;
		await community.save();

		// ── Rejoin handling: only see messages sent after this join ──
		// If the user has left this community before (their ID exists in any
		// message's clearedFor from the leave-time bulk update), hide every
		// message created before now so they start with a clean chat history.
		// deletedFor is also checked to catch legacy leave-clear records.
		const hasLeftBefore = await CommunityMessage.exists({
			community: communityId,
			$or: [{ clearedFor: currentUserId }, { deletedFor: currentUserId }],
		});
		if (hasLeftBefore) {
			await CommunityMessage.updateMany(
				{ community: communityId, createdAt: { $lt: new Date() } },
				{ $addToSet: { clearedFor: currentUserId } },
			);
		}

		// Join the socket room for real-time updates
		const io = getIO();
		io.to(`community:${communityId}`).emit("community:member-joined", {
			communityId,
			userId: userIdStr,
			memberCount: community.memberCount,
		});

		return res.status(200).json({
			success: true,
			message: "Joined community successfully!",
			isMember: true,
			memberCount: community.memberCount,
		});
	} catch (err: any) {
		logger.error("Error in joinCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const leaveCommunity = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		const userIdStr = currentUserId.toString();

		// Cannot leave if you're the creator (must delete the community instead)
		if (community.creator.toString() === userIdStr) {
			return next(
				new BadRequestError(
					"As the creator, you cannot leave the community. You can delete it instead.",
				),
			);
		}

		const wasMember = community.members.some(
			(m) => m.user.toString() === userIdStr,
		);

		if (!wasMember) {
			return res.status(200).json({
				success: true,
				message: "You are not a member of this community!",
				isMember: false,
			});
		}

		community.members = community.members.filter(
			(m) => m.user.toString() !== userIdStr,
		) as any;
		community.memberCount = community.members.length;
		await community.save();

		// ── Clear the leaving user's chat history (per-user soft delete) ──
		// Every message in the community is marked clearedFor for this user so
		// they can no longer see any of it after leaving (or after rejoining).
		// Other members are completely unaffected — nothing is deleted globally.
		await CommunityMessage.updateMany(
			{ community: communityId },
			{ $addToSet: { clearedFor: currentUserId } },
		);

		const io = getIO();
		io.to(`community:${communityId}`).emit("community:member-left", {
			communityId,
			userId: userIdStr,
			memberCount: community.memberCount,
		});

		return res.status(200).json({
			success: true,
			message: "Left community successfully!",
			isMember: false,
			memberCount: community.memberCount,
		});
	} catch (err: any) {
		logger.error("Error in leaveCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const deleteCommunity = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		if (community.creator.toString() !== currentUserId.toString()) {
			return next(
				new ForbiddenError(
					"Only the community creator can delete the community!",
				),
			);
		}

		// Delete all community messages
		await CommunityMessage.deleteMany({ community: communityId });

		// Delete the community
		await Community.findByIdAndDelete(communityId);

		const io = getIO();
		io.to(`community:${communityId}`).emit("community:deleted", {
			communityId,
		});

		return res.status(200).json({
			success: true,
			message: "Community deleted successfully!",
		});
	} catch (err: any) {
		logger.error("Error in deleteCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const getCommunityMessages = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;
	const cursor = req.query.cursor as string;
	const limit = Math.min(Number(req.query.limit) || 30, 50);

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		// Verify user is a member
		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		if (
			!community.members.some(
				(m) => m.user.toString() === currentUserId.toString(),
			)
		) {
			return next(
				new ForbiddenError(
					"You must be a member to view community messages!",
				),
			);
		}

		// Build pagination query
		const query: any = {
			community: communityId,
			isDeleted: { $ne: true },
			// Hide messages the user cleared when they left the community
			// (per-user soft delete). Delete-for-me messages are returned intact
			// (with their deletedFor array) so the client can render the
			// "This message was deleted" placeholder for that user only.
			clearedFor: { $nin: [currentUserId] },
		};
		if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
			query._id = { $lt: cursor };
		}

		const messages = await CommunityMessage.find(query)
			.populate("sender", "username fullName profilePic")
			.populate({
				path: "replyTo",
				select: "sender text attachments createdAt",
				populate: { path: "sender", select: "username fullName profilePic" },
			})
			.sort({ _id: -1 })
			.limit(limit + 1)
			.lean();

		const hasMore = messages.length > limit;
		if (hasMore) {
			messages.pop();
		}

		messages.reverse();

		const nextCursor =
			hasMore && messages.length > 0 ? messages[0]!._id : null;

		return res.status(200).json({
			success: true,
			messages,
			nextCursor,
			hasMore,
		});
	} catch (err: any) {
		logger.error("Error in getCommunityMessages controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const sendCommunityMessage = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		// Verify user is a member
		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		if (
			!community.members.some(
				(m) => m.user.toString() === currentUserId.toString(),
			)
		) {
			return next(
				new ForbiddenError(
					"You must be a member to send messages!",
				),
			);
		}

		// Check if messaging is enabled (creator can always send)
		if (
			!community.messagingEnabled &&
			community.creator.toString() !== currentUserId.toString()
		) {
			return next(
				new ForbiddenError(
					"Messaging is currently disabled in this community!",
				),
			);
		}

		// Handle file uploads — upload to Cloudinary from memory buffer
		const uploadedFiles = (req.files as any[]) || [];
		const fileAttachments = await Promise.all(
			uploadedFiles.map(async (file) => {
				let type: "voice_note" | "image" | "gif" | "video" | "file" = "file";
				if (file.mimetype.startsWith("audio/")) {
					type = "voice_note";
				} else if (file.mimetype.startsWith("video/")) {
					type = "video";
				} else if (file.mimetype.startsWith("image/")) {
					type = file.mimetype === "image/gif" ? "gif" : "image";
				}

				// Upload to Cloudinary from buffer (memoryStorage does not provide file.path/file.filename)
				const cloudinaryUpload = (): Promise<any> => {
					return new Promise((resolve, reject) => {
						const stream = cloudinary.uploader.upload_stream(
							{
								folder: type === "voice_note" ? "orbit/chats/voice_notes" : "orbit/chats/media",
								resource_type: "auto",
							},
							(error, result) => {
								if (error || !result) {
									reject(error || new Error("Cloudinary upload failed"));
								} else {
									resolve(result);
								}
							}
						);
						stream.end(file.buffer);
					});
				};
				const uploadRes = await cloudinaryUpload();

				const attachment: any = {
					url: uploadRes.secure_url,
					public_id: uploadRes.public_id,
					type,
				};
				if (type === "voice_note") {
					const duration = req.body.duration ? Number(req.body.duration) : 0;
					if (duration > 0) {
						attachment.duration = duration;
					}
				}
				return attachment;
			})
		);

		// Parse external attachments
		let bodyAttachments: any[] = [];
		if (req.body.attachments) {
			try {
				bodyAttachments =
					typeof req.body.attachments === "string"
						? JSON.parse(req.body.attachments)
						: req.body.attachments;
			} catch {
				return next(new BadRequestError("Invalid attachments format."));
			}
		}

		const attachments = [...fileAttachments, ...bodyAttachments];

		// Require either text or attachments
		if ((!req.body.text || !req.body.text.trim()) && attachments.length === 0) {
			return next(new BadRequestError("Message text or attachments are required!"));
		}

		const sanitizedText = req.body.text
			? sanitizePlainText(req.body.text)
			: "";

		const message = new CommunityMessage({
			community: communityId,
			sender: currentUserId,
			text: sanitizedText,
			attachments,
			replyTo: req.body.replyTo || null,
		});

		await message.save();

		// Update community's updatedAt
		await Community.findByIdAndUpdate(communityId, { updatedAt: new Date() });

		// Populate sender info
		const populatedMessage = await CommunityMessage.findById(message._id)
			.populate("sender", "username fullName profilePic")
			.populate({
				path: "replyTo",
				select: "sender text attachments createdAt",
				populate: { path: "sender", select: "username fullName profilePic" },
			})
			.lean();

		// Emit to community room
		const io = getIO();
		io.to(`community:${communityId}`).emit("community:message:new", populatedMessage);

		// Determine message type from attachments for notification text
		let messageType: "text" | "photo" | "video" | "voice_note" | "file" | "gif" | "sticker" = "text";
		if (attachments.length > 0) {
			const firstAttach = attachments[0];
			if (firstAttach.type === "image") messageType = "photo";
			else if (firstAttach.type === "gif") messageType = "gif";
			else if (firstAttach.type === "sticker") messageType = "sticker";
			else if (firstAttach.type === "video") messageType = "video";
			else if (firstAttach.type === "voice_note") messageType = "voice_note";
			else if (firstAttach.type === "file") messageType = "file";
		}

		// Create notifications for all other members (not the sender)
		const otherMembers = community.members.filter(
			(m) => m.user.toString() !== currentUserId.toString()
		);

		// Create notifications and populate sender for socket emission
		const createAndEmitNotif = async (recipientId: string) => {
			try {
				const notif = new Notification({
					recipient: recipientId,
					sender: currentUserId,
					type: "community_message",
					community: communityId,
					message: populatedMessage?._id,
					messageType,
				});
				await notif.save();

				// Populate sender for the socket payload so App.tsx can read sender.fullName
				const populated = await Notification.findById(notif._id)
					.populate("sender", "username fullName profilePic")
					.lean();

				io.to(`user:${recipientId}`).emit("notification", populated);

				// Send a real on-device push notification
				const senderInfo = (populated as any)?.sender || {};
				const senderName =
					senderInfo?.fullName || senderInfo?.username || "Someone";
				const body =
					sanitizedText?.slice(0, 120) ||
					messageType === "photo"
						? "📷 Photo"
						: messageType === "video"
							? "🎬 Video"
							: messageType === "voice_note"
								? "🎤 Voice note"
								: "New message";
				sendPushToUser(recipientId, {
					title: senderName,
					body,
					icon: senderInfo?.profilePic?.url || "/icon-192.png",
					tag: `orbit-community-${communityId}`,
					timestamp: new Date().toISOString(),
					data: {
						url: "/communities",
						type: "community_message",
						communityId,
						unreadCount: 0,
					},
				});
			} catch (err: any) {
				logger.error("Failed to create community message notification", {
					error: err.message,
					recipientId,
				});
			}
		};

		Promise.allSettled(
			otherMembers.map((m) => createAndEmitNotif(m.user.toString()))
		);

		return res.status(201).json({
			success: true,
			message: "Message sent successfully!",
			sentMessage: populatedMessage,
		});
	} catch (err: any) {
		logger.error("Error in sendCommunityMessage controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const editCommunityMessage = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		const { text } = req.body;
		if (!text || !text.trim()) {
			return next(new BadRequestError("Message text is required!"));
		}

		const message = await CommunityMessage.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		if (message.sender.toString() !== currentUserId.toString()) {
			return next(
				new ForbiddenError("You can only edit your own messages!"),
			);
		}

		// 5 minutes check
		const diffMs = Date.now() - message.createdAt.getTime();
		const EDIT_TIME_LIMIT = 5 * 60 * 1000;
		if (diffMs > EDIT_TIME_LIMIT) {
			return next(
				new BadRequestError(
					"Message can only be edited within 5 minutes of sending!",
				),
			);
		}

		message.text = sanitizePlainText(text);
		message.isEdited = true;
		await message.save();

		const populatedMessage = await CommunityMessage.findById(message._id)
			.populate("sender", "username fullName profilePic")
			.lean();

		const io = getIO();
		io.to(`community:${message.community.toString()}`).emit(
			"community:message:edit",
			populatedMessage,
		);

		return res.status(200).json({
			success: true,
			message: "Message edited successfully!",
			editedMessage: populatedMessage,
		});
	} catch (err: any) {
		logger.error("Error in editCommunityMessage controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const deleteCommunityMessage = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		const message = await CommunityMessage.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		const community = await Community.findById(message.community);
		const isSender = message.sender.toString() === currentUserId.toString();
		const isCreator = community?.creator.toString() === currentUserId.toString();

		if (!isSender && !isCreator) {
			return next(
				new ForbiddenError("You can only delete your own messages or messages in your community!"),
			);
		}

		// 5 minutes check for regular members (creator bypasses this)
		if (isSender && !isCreator) {
			const diffMs = Date.now() - message.createdAt.getTime();
			const DELETE_TIME_LIMIT = 5 * 60 * 1000;
			if (diffMs > DELETE_TIME_LIMIT) {
				return next(
					new BadRequestError(
						"Message can only be deleted within 5 minutes of sending!",
					),
				);
			}
		}

		// Clean up Cloudinary attachments
		const oldAttachments = message.attachments || [];
		const imageDeletions = oldAttachments
			.map((att) => att.public_id)
			.filter(Boolean)
			.map((pubId) => cloudinary.uploader.destroy(pubId));

		Promise.allSettled(imageDeletions).then((results) => {
			results.forEach((result) => {
				if (result.status === "rejected") {
					logger.error(
						"Cloudinary deletion failed during community message delete",
						{ error: result.reason },
					);
				}
			});
		});

		message.isDeleted = true;
		message.text = "This message was deleted";
		message.attachments = [] as any;
		await message.save();

		const io = getIO();
		io.to(`community:${message.community.toString()}`).emit(
			"community:message:delete",
			{ messageId: message._id.toString(), communityId: message.community.toString() },
		);

		return res.status(200).json({
			success: true,
			message: "Message deleted successfully!",
		});
	} catch (err: any) {
		logger.error("Error in deleteCommunityMessage controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

export const deleteCommunityMessageForMe = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		const message = await CommunityMessage.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		const userIdStr = currentUserId.toString();
		const alreadyDeleted = (message.deletedFor || []).some(
			(id) => id.toString() === userIdStr,
		);

		if (!alreadyDeleted) {
			message.deletedFor.push(new mongoose.Types.ObjectId(userIdStr));
			await message.save();
		}

		const io = getIO();
		io.to(`community:${message.community.toString()}`).emit(
			"community:message:delete-for-me",
			{ messageId: message._id.toString(), deletedByUserId: userIdStr },
		);

		return res.status(200).json({
			success: true,
			message: "Message deleted for you!",
		});
	} catch (err: any) {
		logger.error("Error in deleteCommunityMessageForMe controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};	/**
 * Update a community's name, description, and/or image.
 * Only the creator can update the community.
 * PUT /api/communities/:communityId
 */
export const updateCommunity = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		// Only the creator can update
		if (community.creator.toString() !== currentUserId.toString()) {
			return next(
				new ForbiddenError(
					"Only the community creator can update the community!",
				),
			);
		}

		// Validate and update name
		const { name, description } = req.body;
		if (name !== undefined) {
			if (typeof name !== "string" || !name.trim()) {
				return next(new BadRequestError("Community name is required!"));
			}
			if (name.trim().length > 50) {
				return next(new BadRequestError("Community name cannot exceed 50 characters!"));
			}
			community.name = name.trim();
		}

		if (description !== undefined) {
			if (typeof description !== "string") {
				return next(new BadRequestError("Description must be a string!"));
			}
			if (description.length > 500) {
				return next(new BadRequestError("Description cannot exceed 500 characters!"));
			}
			community.description = description.trim();
		}

		// Handle optional image upload
		if (req.file) {
			// Delete old image from Cloudinary if it exists
			if (community.image?.public_id) {
				cloudinary.uploader
					.destroy(community.image.public_id)
					.catch((err) => {
						logger.error(
							"Failed to delete old community image from Cloudinary",
							{ error: err.message },
						);
					});
			}
			community.image = {
				url: (req.file as any).path,
				public_id: (req.file as any).filename,
			};
		}

		// Handle image removal (explicitly sent as empty string or null)
		if (req.body.removeImage === "true") {
			if (community.image?.public_id) {
				cloudinary.uploader
					.destroy(community.image.public_id)
					.catch((err) => {
						logger.error(
							"Failed to delete community image from Cloudinary",
							{ error: err.message },
						);
					});
			}
			community.image = { url: "", public_id: "" };
		}

		await community.save();

		const populated = await Community.findById(community._id)
			.populate("creator", "username fullName profilePic")
			.populate("members.user", "username fullName profilePic")
			.lean();

		const io = getIO();
		io.to(`community:${communityId}`).emit("community:updated", {
			communityId,
			community: { ...populated, isMember: true } as any,
		});

		return res.status(200).json({
			success: true,
			message: "Community updated successfully!",
			community: { ...populated, isMember: true },
		});
	} catch (err: any) {
		logger.error("Error in updateCommunity controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

// ─── Search Community Messages ────────────────────────────────────
/**
 * Search messages within a community by text content.
 * GET /api/communities/:communityId/messages/search?q=...
 */
export const searchCommunityMessages = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;
	const q = (req.query.q as string || "").trim();
	const limit = Math.min(Number(req.query.limit) || 20, 50);

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		if (!q || q.length < 1) {
			return next(new BadRequestError("Search query is required!"));
		}

		// Verify user is a member
		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		if (
			!community.members.some(
				(m) => m.user.toString() === currentUserId.toString(),
			)
		) {
			return next(
				new ForbiddenError(
					"You must be a member to search messages!",
				),
			);
		}

		// Escape regex special characters in the search query
		const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		const messages = await CommunityMessage.find({
			community: communityId,
			isDeleted: { $ne: true },
			clearedFor: { $nin: [currentUserId] },
			text: { $regex: escapedQ, $options: "i" },
		})
			.populate("sender", "username fullName profilePic")
			.populate({
				path: "replyTo",
				select: "sender text attachments createdAt",
				populate: { path: "sender", select: "username fullName profilePic" },
			})
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean();

		return res.status(200).json({
			success: true,
			messages: messages.reverse(),
			total: messages.length,
		});
	} catch (err: any) {
		logger.error("Error in searchCommunityMessages controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

// ─── Admin / Creator Actions ────────────────────────────────────

/**
 * Remove a member from the community (creator/admins only).
 * POST /api/communities/:communityId/remove-member
 */
export const removeMemberFromCommunity = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const { memberId } = req.body;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return next(new BadRequestError("Valid member ID is required!"));
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    const userIdStr = currentUserId.toString();
    const memberIdStr = memberId.toString();

    // Only the creator can remove members
    if (community.creator.toString() !== userIdStr) {
      return next(
        new ForbiddenError("Only the community creator can remove members!"),
      );
    }

    // Cannot remove the creator
    if (memberIdStr === community.creator.toString()) {
      return next(new BadRequestError("Cannot remove the community creator!"));
    }

    // Check member exists
    const memberExists = community.members.some(
      (m) => m.user.toString() === memberIdStr,
    );

    if (!memberExists) {
      return next(new NotFoundError("Member not found in this community!"));
    }

    // Remove member
    community.members = community.members.filter(
      (m) => m.user.toString() !== memberIdStr,
    ) as any;
    community.memberCount = community.members.length;
    await community.save();

    const io = getIO();
    io.to(`community:${communityId}`).emit("community:member-removed", {
      communityId,
      removedUserId: memberIdStr,
      memberCount: community.memberCount,
    });

    return res.status(200).json({
      success: true,
      message: "Member removed successfully!",
      memberCount: community.memberCount,
    });
  } catch (err: any) {
    logger.error("Error in removeMemberFromCommunity controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

/**
 * Toggle messaging enabled/disabled for the community (creator only).
 * POST /api/communities/:communityId/toggle-messaging
 */
export const toggleCommunityMessaging = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    if (community.creator.toString() !== currentUserId.toString()) {
      return next(
        new ForbiddenError("Only the community creator can toggle messaging!"),
      );
    }

    community.messagingEnabled = !community.messagingEnabled;
    await community.save();

    const io = getIO();
    io.to(`community:${communityId}`).emit("community:messaging-toggled", {
      communityId,
      messagingEnabled: community.messagingEnabled,
    });

    return res.status(200).json({
      success: true,
      message: community.messagingEnabled
        ? "Messaging enabled!"
        : "Messaging disabled!",
      messagingEnabled: community.messagingEnabled,
    });
  } catch (err: any) {
    logger.error("Error in toggleCommunityMessaging controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

/**
 * Toggle audio calls enabled/disabled for the community (creator only).
 * POST /api/communities/:communityId/toggle-audio-calls
 */
export const toggleCommunityAudioCalls = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    if (community.creator.toString() !== currentUserId.toString()) {
      return next(
        new ForbiddenError("Only the community creator can toggle audio calls!"),
      );
    }

    community.audioCallEnabled = !community.audioCallEnabled;
    await community.save();

    const io = getIO();
    io.to(`community:${communityId}`).emit("community:calls-toggled", {
      communityId,
      audioCallEnabled: community.audioCallEnabled,
    });

    return res.status(200).json({
      success: true,
      message: community.audioCallEnabled
        ? "Audio calls enabled!"
        : "Audio calls disabled!",
      audioCallEnabled: community.audioCallEnabled,
    });
  } catch (err: any) {
    logger.error("Error in toggleCommunityAudioCalls controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

/**
 * Toggle video calls enabled/disabled for the community (creator only).
 * POST /api/communities/:communityId/toggle-video-calls
 */
export const toggleCommunityVideoCalls = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    if (community.creator.toString() !== currentUserId.toString()) {
      return next(
        new ForbiddenError("Only the community creator can toggle video calls!"),
      );
    }

    community.videoCallEnabled = !community.videoCallEnabled;
    await community.save();

    const io = getIO();
    io.to(`community:${communityId}`).emit("community:calls-toggled", {
      communityId,
      videoCallEnabled: community.videoCallEnabled,
    });

    return res.status(200).json({
      success: true,
      message: community.videoCallEnabled
        ? "Video calls enabled!"
        : "Video calls disabled!",
      videoCallEnabled: community.videoCallEnabled,
    });
  } catch (err: any) {
    logger.error("Error in toggleCommunityVideoCalls controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

/**
 * Clear all messages in the community (creator only).
 * POST /api/communities/:communityId/clear-chat
 */
export const clearCommunityChat = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    if (community.creator.toString() !== currentUserId.toString()) {
      return next(
        new ForbiddenError("Only the community creator can clear the chat!"),
      );
    }

    // Soft-delete all messages
    await CommunityMessage.updateMany(
      { community: communityId },
      {
        $set: {
          isDeleted: true,
          text: "This message was deleted",
          attachments: [],
        },
      },
    );

    // Clear pinned messages since those are references
    community.pinnedMessages = [];
    await community.save();

    const io = getIO();
    io.to(`community:${communityId}`).emit("community:chat-cleared", {
      communityId,
    });

    return res.status(200).json({
      success: true,
      message: "Chat cleared successfully!",
    });
  } catch (err: any) {
    logger.error("Error in clearCommunityChat controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

// ─── Get community media by type ────────────────────────────────
/**
 * Get community messages filtered by attachment type (image, video, voice_note, file).
 * GET /api/communities/:communityId/media?type=image&limit=50
 */
export const getCommunityMedia = async (
	req: Request<CommunityParams>,
	res: Response,
	next: NextFunction,
) => {
	const { communityId } = req.params;
	const currentUserId = req.user?._id;
	const mediaType = (req.query.type as string) || "";
	const limit = Math.min(Number(req.query.limit) || 50, 100);
	const skip = Math.max(0, Number(req.query.skip) || 0);

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(communityId)) {
			return next(new BadRequestError("Invalid community ID!"));
		}

		const validTypes = ["image", "video", "voice_note", "file", "gif"];
		if (!mediaType || !validTypes.includes(mediaType)) {
			return next(new BadRequestError("Invalid media type! Must be one of: image, video, voice_note, file, gif"));
		}

		// Verify user is a member
		const community = await Community.findById(communityId);
		if (!community) {
			return next(new NotFoundError("Community not found!"));
		}

		const isMember = community.members.some(
			(m) => m.user.toString() === currentUserId.toString(),
		);
		if (!isMember) {
			return next(new ForbiddenError("You must be a member to view community media!"));
		}

		// Query messages with attachments matching the requested type.
		// Media is hidden for the user if they cleared the community history
		// (clearedFor) OR deleted the message for themselves (deletedFor).
		const messages = await CommunityMessage.find({
			community: communityId,
			isDeleted: { $ne: true },
			"attachments.type": mediaType,
			$nor: [{ clearedFor: currentUserId }, { deletedFor: currentUserId }],
		})
			.populate("sender", "username fullName profilePic")
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		return res.status(200).json({
			success: true,
			messages,
			total: messages.length,
		});
	} catch (err: any) {
		logger.error("Error in getCommunityMedia controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

// ─── LiveKit Group Call Token ────────────────────────────────────
/**
 * Generate a LiveKit access token for a community group call.
 * Creates a LiveKit room for the community so all members can join.
 * POST /api/communities/:communityId/livekit-token
 */
export const generateLiveKitToken = async (
  req: Request<CommunityParams>,
  res: Response,
  next: NextFunction,
) => {
  const { communityId } = req.params;
  const currentUserId = req.user?._id;
  const { type } = (req.body || {}) as { type?: "audio" | "video" };
  const callType: "audio" | "video" = type === "video" ? "video" : "audio";

  try {
    if (!currentUserId) {
      return next(new UnauthorizedError("Unauthorized!"));
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new BadRequestError("Invalid community ID!"));
    }

    // Verify user is a member
    const community = await Community.findById(communityId);
    if (!community) {
      return next(new NotFoundError("Community not found!"));
    }

    const isMember = community.members.some(
      (m) => m.user.toString() === currentUserId.toString(),
    );
    if (!isMember) {
      return next(new ForbiddenError("You must be a member to start a call!"));
    }

    // Check if calls are enabled
    if (!community.audioCallEnabled && !community.videoCallEnabled) {
      return next(new BadRequestError("Calls are disabled in this community!"));
    }

    // Validate the specific call type is enabled for this community
    if (callType === "audio" && !community.audioCallEnabled) {
      return next(new BadRequestError("Audio calls are disabled in this community!"));
    }
    if (callType === "video" && !community.videoCallEnabled) {
      return next(new BadRequestError("Video calls are disabled in this community!"));
    }

    // Stable room name per community — every member who requests a token
    // joins the SAME LiveKit room, so a real group call can form.
    const roomName = `community-${communityId}`;

    // Generate the LiveKit token
    const token = await generateToken(
      roomName,
      (req.user as any).fullName || "Unknown",
      currentUserId.toString(),
      true,
      true,
    );

    if (!token) {
      return next(new AppError("LiveKit is not configured. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET."));
    }

    return res.status(200).json({
      success: true,
      token,
      roomName,
      livekitUrl: process.env.LIVEKIT_URL || "",
      type: callType,
    });
  } catch (err: any) {
    logger.error("Error in generateLiveKitToken controller", {
      error: err.message,
    });
    return next(
      err instanceof AppError
        ? err
        : new AppError("Internal server error!"),
    );
  }
};

export const toggleCommunityMessageReaction = async (
	req: Request<MessageParams>,
	res: Response,
	next: NextFunction,
) => {
	const { messageId } = req.params;
	const { emoji } = req.body;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(messageId)) {
			return next(new BadRequestError("Invalid message ID!"));
		}

		if (!emoji || typeof emoji !== "string") {
			return next(new BadRequestError("Emoji is required!"));
		}

		const message = await CommunityMessage.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		// Check if user already reacted with this emoji
		const existingIndex = message.reactions.findIndex(
			(r) =>
				r.sender.toString() === currentUserId.toString() &&
				r.emoji === emoji,
		);

		let type: "add" | "remove";

		if (existingIndex > -1) {
			// Remove reaction
			message.reactions.splice(existingIndex, 1);
			type = "remove";
		} else {
			// Add reaction
			(message.reactions as any).push({
				emoji,
				sender: currentUserId,
			});
			type = "add";
		}

		await message.save();

		const populatedMessage = await CommunityMessage.findById(message._id)
			.populate("sender", "username fullName profilePic")
			.populate("reactions.sender", "username fullName profilePic")
			.lean();

		const io = getIO();
		io.to(`community:${message.community.toString()}`).emit(
			"community:message:reaction",
			{
				messageId: message._id.toString(),
				message: populatedMessage,
				type,
			},
		);

		return res.status(200).json({
			success: true,
			message: type === "add" ? "Reaction added!" : "Reaction removed!",
			reactions: populatedMessage?.reactions || [],
			type,
		});
	} catch (err: any) {
		logger.error("Error in toggleCommunityMessageReaction controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

