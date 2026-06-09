import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { User } from "../models/user.model";
import { sendMessageSchema, editMessageSchema } from "../schemas/chat.schema";
import {
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	AppError,
} from "../utilities/errors";
import { logger } from "../utilities/logger";
import { getCache, setCache, clearChatCache } from "../configs/cache";
import { sanitizePlainText } from "../configs/sanitize";
import cloudinary from "../configs/cloudinary";
import {
	isRecipientActiveInConversation,
	getUserPresenceStatus,
	emitNewMessage,
	emitMessageEdit,
	emitMessageDelete,
	emitChatNotification,
	getIO,
} from "../configs/socket";

type ConversationParams = {
	conversationId: string;
};

type MessageParams = {
	messageId: string;
};

type UserParams = {
	userId: string;
};

// ─── Conversations ───────────────────────────────────────────────────

/**
 * Create or fetch a 1-on-1 conversation with another user.
 */
export const getOrCreateConversation = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const { recipientId } = req.body;

	try {
		if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
			return next(
				new BadRequestError("Invalid or missing recipient ID!"),
			);
		}

		const currentUserId = req.user?._id;
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (currentUserId.toString() === recipientId.toString()) {
			return next(
				new BadRequestError(
					"You cannot start a conversation with yourself!",
				),
			);
		}

		// Verify recipient exists
		const recipient = await User.findById(recipientId).select(
			"username fullName profilePic",
		);
		if (!recipient) {
			return next(new NotFoundError("Recipient user not found!"));
		}

		// Sort participant IDs lexicographically and cast to ObjectIds to satisfy unique index
		const sortedStr = [
			currentUserId.toString(),
			recipientId.toString(),
		].sort();
		const participants = sortedStr.map(
			(id) => new mongoose.Types.ObjectId(id),
		);

		const idA = new mongoose.Types.ObjectId(currentUserId.toString());
		const idB = new mongoose.Types.ObjectId(recipientId.toString());

		// Look up existing conversation — $all handles any ordering
		let conversation = await Conversation.findOne({
			participants: { $all: [idA, idB] },
		});

		if (!conversation) {
			conversation = new Conversation({
				participants,
				unreadCounts: {
					[currentUserId.toString()]: 0,
					[recipientId.toString()]: 0,
				},
			});
			await conversation.save();
		}

		// Populate participants info
		const populatedConversation = await Conversation.findById(
			conversation._id,
		)
			.populate("participants", "username fullName profilePic")
			.populate({
				path: "lastMessage",
				populate: {
					path: "sender",
					select: "username fullName profilePic",
				},
			})
			.lean();

		// Fetch real-time presence for the other participant
		const otherParticipantId = recipientId.toString();
		const presence = await getUserPresenceStatus(otherParticipantId);

		return res.status(200).json({
			success: true,
			message: "Conversation retrieved successfully!",
			conversation: { ...populatedConversation, presence },
		});
	} catch (err: any) {
		logger.error("Error in getOrCreateConversation controller", {
			error: err.message,
			stack: err.stack,
		});
		// Handle MongoDB duplicate key (conversation already exists) gracefully
		if (
			(err.name === "MongoServerError" || err.name === "MongoError") &&
			err.code === 11000
		) {
			// Race condition: conversation was inserted between our findOne and save — retry the find
			try {
				const idA = new mongoose.Types.ObjectId(
					req.user?._id?.toString(),
				);
				const idB = new mongoose.Types.ObjectId(recipientId);
				const existing = await Conversation.findOne({
					participants: { $all: [idA, idB] },
				})
					.populate("participants", "username fullName profilePic")
					.populate({
						path: "lastMessage",
						populate: {
							path: "sender",
							select: "username fullName profilePic",
						},
					})
					.lean();
				if (existing) {
					const retryPresence = await getUserPresenceStatus(recipientId);
					return res.status(200).json({
						success: true,
						message: "Conversation retrieved successfully!",
						conversation: { ...existing, presence: retryPresence },
					});
				}
			} catch (retryErr: any) {
				return next(new AppError("Internal server error!"));
			}
		}
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

/**
 * Get all conversations for the authenticated user, populated with presence status.
 */
export const getConversations = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		const conversations = await Conversation.find({
			participants: currentUserId,
		})
			.populate("participants", "username fullName profilePic")
			.populate({
				path: "lastMessage",
				populate: {
					path: "sender",
					select: "username fullName profilePic",
				},
			})
			.sort({ updatedAt: -1 })
			.lean();

		// Map conversations to add the presence status of the other participant dynamically
		const conversationsWithPresence = await Promise.all(
			conversations.map(async (conv: any) => {
				// Filter out null participants (e.g. deleted users)
				const activeParticipants = (conv.participants || []).filter(
					(p: any) => p != null,
				);
				const otherParticipant = activeParticipants.find(
					(p: any) =>
						p._id && p._id.toString() !== currentUserId.toString(),
				);
				let presence = "offline";
				if (otherParticipant) {
					presence = await getUserPresenceStatus(
						otherParticipant._id.toString(),
					);
				}
				return {
					...conv,
					participants: activeParticipants,
					presence,
				};
			}),
		);

		const responseData = {
			success: true,
			message: conversationsWithPresence.length
				? "Conversations fetched successfully!"
				: "No conversations yet!",
			conversations: conversationsWithPresence,
		};

		// cache conversations per user (30s TTL — chat changes frequently via socket)
		try {
			await setCache(`chat:conversations:${currentUserId.toString()}`, responseData, 30);
		} catch (err: any) {
			logger.error(`Cache set error in getConversations!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		logger.error("Error in getConversations controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

// ─── Messages ────────────────────────────────────────────────────────

/**
 * Get paginated messages for a specific conversation using cursor-based pagination.
 */
export const getMessages = async (
	req: Request<ConversationParams>,
	res: Response,
	next: NextFunction,
) => {
	const { conversationId } = req.params;
	const currentUserId = req.user?._id;
	const cursor = req.query.cursor as string;
	const limit = Math.min(Number(req.query.limit) || 20, 50);

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(conversationId)) {
			return next(new BadRequestError("Invalid conversation ID!"));
		}

		// Verify conversation exists and user is a participant
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) {
			return next(new NotFoundError("Conversation not found!"));
		}

		if (
			!conversation.participants
				.map((id) => id.toString())
				.includes(currentUserId.toString())
		) {
			return next(
				new ForbiddenError(
					"You are not authorized to access this conversation!",
				),
			);
		}

		// cache key
		const cacheKey = `chat:messages:${conversationId}:${cursor || "first"}:${limit}`;
		try {
			const cached = await getCache(cacheKey);
			if (cached) return res.status(200).json(cached);
		} catch (err: any) {
			logger.error(`Cache error in getMessages!`, { error: err.message });
		}

		// Build pagination query
		const query: any = { conversation: conversationId };
		if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
			query._id = { $lt: cursor };
		}

		// Fetch messages (limit + 1 to check for hasMore)
		const messages = await Message.find(query)
			.populate("sender", "username fullName profilePic")
			.sort({ _id: -1 })
			.limit(limit + 1)
			.lean();

		const hasMore = messages.length > limit;
		if (hasMore) {
			messages.pop(); // Remove the extra record used for checking
		}

		// Reverse messages to present them in chronological order to the client
		messages.reverse();

		const nextCursor =
			hasMore && messages.length > 0 ? messages[0]!._id : null;

		const responseData = {
			success: true,
			message: messages.length
				? "Messages fetched successfully!"
				: "No messages yet!",
			messages,
			nextCursor,
			hasMore,
		};

		// cache messages per conversation (30s TTL)
		try {
			await setCache(cacheKey, responseData, 30);
		} catch (err: any) {
			logger.error(`Cache set error in getMessages!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		logger.error("Error in getMessages controller", { error: err.message });
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

/**
 * Send a message with text and/or file uploads.
 */
export const sendMessage = async (
	req: Request<ConversationParams>,
	res: Response,
	next: NextFunction,
) => {
	const { conversationId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(conversationId)) {
			return next(new BadRequestError("Invalid conversation ID!"));
		}

		// Verify conversation and participation
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) {
			return next(new NotFoundError("Conversation not found!"));
		}

		const participantsStr = conversation.participants.map((id) =>
			id.toString(),
		);
		if (!participantsStr.includes(currentUserId.toString())) {
			return next(
				new ForbiddenError(
					"You are not a participant in this conversation!",
				),
			);
		}

		const recipientId = participantsStr.find(
			(id) => id !== currentUserId.toString(),
		);
		if (!recipientId) {
			return next(
				new AppError(
					"Recipient not found in conversation participants list!",
				),
			);
		}

		// Map files uploaded via Multer
		const uploadedFiles = (req.files as any[]) || [];
		const fileAttachments = uploadedFiles.map((file) => {
			let type: "voice_note" | "image" | "gif" = "image";
			if (file.mimetype.startsWith("audio/")) {
				type = "voice_note";
			} else if (file.mimetype === "image/gif") {
				type = "gif";
			}
			return {
				url: file.path,
				public_id: file.filename,
				type,
			};
		});

		// Parse external attachments (e.g. external gifs, memes)
		let bodyAttachments: any[] = [];
		if (req.body.attachments) {
			try {
				bodyAttachments =
					typeof req.body.attachments === "string"
						? JSON.parse(req.body.attachments)
						: req.body.attachments;
			} catch (parseErr) {
				return next(new BadRequestError("Invalid attachments format."));
			}
		}

		const attachments = [...fileAttachments, ...bodyAttachments];

		// Validate request contents using Zod
		const validation = sendMessageSchema.safeParse({
			text: req.body.text,
			attachments: attachments.length > 0 ? attachments : undefined,
		});

		if (!validation.success) {
			return next(
				new BadRequestError(
					validation.error.issues[0]?.message || "Validation failed",
				),
			);
		}

		const sanitizedText = validation.data.text
			? sanitizePlainText(validation.data.text)
			: "";

		// Check if the recipient is currently viewing this conversation room
		const isRecipientActive = await isRecipientActiveInConversation(
			conversationId,
			recipientId,
		);

		// Create the message
		const message = new Message({
			conversation: conversationId,
			sender: currentUserId,
			recipient: recipientId,
			text: sanitizedText,
			attachments,
			seen: isRecipientActive,
			seenAt: isRecipientActive ? new Date() : null,
		});

		await message.save();

		// Update conversation properties
		const updateObj: any = { lastMessage: message._id };
		if (!isRecipientActive) {
			// Increment unread count for recipient if they are not active in the chatbox
			updateObj.$inc = { [`unreadCounts.${recipientId}`]: 1 };
		}

		const updatedConversation = await Conversation.findByIdAndUpdate(
			conversationId,
			updateObj,
			{ new: true },
		);

		// Clear chat cache
		await clearChatCache(conversationId, [currentUserId.toString(), recipientId.toString()]);

		// Populate sender info for the client response and socket emits
		const populatedMessage = await Message.findById(message._id)
			.populate("sender", "username fullName profilePic")
			.lean();

		// Emit real-time message event to conversation room (active viewers)
		emitNewMessage(conversationId, populatedMessage);

		// If recipient is not actively in the chatbox, emit to their personal room
		// so they still get the message data in real-time (even on other tabs)
		// and send a badge/toast notification
		if (!isRecipientActive) {
			// Emit to personal room — the Chat.tsx handler appends to messages if viewing
			// this conversation, otherwise updates the conversations list
			getIO().to(`user:${recipientId}`).emit("message:new", populatedMessage);

			const recipientUnreadCount =
				updatedConversation?.unreadCounts?.get(recipientId) || 1;
			emitChatNotification(recipientId, {
				conversationId,
				message: populatedMessage,
				unreadCount: recipientUnreadCount,
			});
		}

		return res.status(201).json({
			success: true,
			message: "Message sent successfully!",
			sentMessage: populatedMessage,
		});
	} catch (err: any) {
		logger.error("Error in sendMessage controller", { error: err.message });
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

/**
 * Edit a message within 5 minutes of sending.
 */
export const editMessage = async (
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

		const validation = editMessageSchema.safeParse(req.body);
		if (!validation.success) {
			return next(
				new BadRequestError(
					validation.error.issues[0]?.message || "Validation failed",
				),
			);
		}

		const message = await Message.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		// Ownership check
		if (message.sender.toString() !== currentUserId.toString()) {
			return next(
				new ForbiddenError("You can only edit your own messages!"),
			);
		}

		// 5 minutes check
		const diffMs = Date.now() - message.createdAt.getTime();
		const EDIT_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes
		if (diffMs > EDIT_TIME_LIMIT) {
			return next(
				new BadRequestError(
					"Message can only be edited within 5 minutes of sending!",
				),
			);
		}

		const sanitizedText = sanitizePlainText(validation.data.text);
		message.text = sanitizedText;
		message.isEdited = true;
		await message.save();

		// Clear chat cache
		const conversation = await Conversation.findById(message.conversation);
		if (conversation) {
			await clearChatCache(message.conversation.toString(), conversation.participants.map(p => p.toString()));
		}

		const populatedMessage = await Message.findById(message._id)
			.populate("sender", "username fullName profilePic")
			.lean();

		// Emit live update to conversation room
		emitMessageEdit(message.conversation.toString(), populatedMessage);

		return res.status(200).json({
			success: true,
			message: "Message edited successfully!",
			editedMessage: populatedMessage,
		});
	} catch (err: any) {
		logger.error("Error in editMessage controller", { error: err.message });
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};

/**
 * Delete a message (mark as deleted) within 5 minutes of sending.
 */
export const deleteMessage = async (
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

		const message = await Message.findById(messageId);
		if (!message) {
			return next(new NotFoundError("Message not found!"));
		}

		// Ownership check
		if (message.sender.toString() !== currentUserId.toString()) {
			return next(
				new ForbiddenError("You can only delete your own messages!"),
			);
		}

		// 5 minutes check
		const diffMs = Date.now() - message.createdAt.getTime();
		const DELETE_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes
		if (diffMs > DELETE_TIME_LIMIT) {
			return next(
				new BadRequestError(
					"Message can only be deleted within 5 minutes of sending!",
				),
			);
		}

		// Cloudinary cleanup of attachments asynchronously
		const oldAttachments = message.attachments || [];
		const imageDeletions = oldAttachments
			.map((att) => att.public_id)
			.filter(Boolean)
			.map((pubId) => cloudinary.uploader.destroy(pubId));

		Promise.allSettled(imageDeletions).then((results) => {
			results.forEach((result) => {
				if (result.status === "rejected") {
					logger.error(
						"Cloudinary deletion failed during chat message delete",
						{
							error: result.reason,
						},
					);
				}
			});
		});

		// Mark as deleted, replace text, and clear attachments list
		message.isDeleted = true;
		message.text = "This message was deleted";
		message.attachments = [] as any;
		await message.save();

		// Clear chat cache
		const conversation = await Conversation.findById(message.conversation);
		if (conversation) {
			await clearChatCache(message.conversation.toString(), conversation.participants.map(p => p.toString()));
		}

		// Emit live deletion to conversation room
		emitMessageDelete(
			message.conversation.toString(),
			message._id.toString(),
		);

		return res.status(200).json({
			success: true,
			message: "Message deleted successfully!",
		});
	} catch (err: any) {
		logger.error("Error in deleteMessage controller", {
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
 * Delete an entire conversation and its messages.
 */
export const deleteConversation = async (
	req: Request<ConversationParams>,
	res: Response,
	next: NextFunction,
) => {
	const { conversationId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(conversationId)) {
			return next(new BadRequestError("Invalid conversation ID!"));
		}

		// Verify conversation exists and user is a participant
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) {
			return next(new NotFoundError("Conversation not found!"));
		}

		if (
			!conversation.participants
				.map((id) => id.toString())
				.includes(currentUserId.toString())
		) {
			return next(
				new ForbiddenError(
					"You are not authorized to delete this conversation!",
				),
			);
		}

		// Find all messages in this conversation to clear their cloudinary attachments
		const messages = await Message.find({ conversation: conversationId });
		const allPublicIds: string[] = [];
		for (const msg of messages) {
			if (msg.attachments && msg.attachments.length > 0) {
				msg.attachments.forEach((att) => {
					if (att.public_id) {
						allPublicIds.push(att.public_id);
					}
				});
			}
		}

		// Destroy Cloudinary attachments asynchronously
		if (allPublicIds.length > 0) {
			const imageDeletions = allPublicIds.map((pubId) =>
				cloudinary.uploader.destroy(pubId),
			);
			Promise.allSettled(imageDeletions).then((results) => {
				results.forEach((result) => {
					if (result.status === "rejected") {
						logger.error(
							"Cloudinary deletion failed during conversation delete",
							{
								error: result.reason,
							},
						);
					}
				});
			});
		}

		// Delete all messages in the conversation
		await Message.deleteMany({ conversation: conversationId });

		// Delete the conversation document itself
		await Conversation.findByIdAndDelete(conversationId);

		// Clear chat cache
		const participants = conversation.participants.map((p) => p.toString());
		await clearChatCache(conversationId, participants);

		// Emit live socket events to individual user rooms to ensure sidebar updating
		const io = getIO();
		participants.forEach((pId) => {
			io.to(`user:${pId}`).emit("conversation:delete", {
				conversationId,
			});
		});

		return res.status(200).json({
			success: true,
			message: "Conversation deleted successfully!",
		});
	} catch (err: any) {
		logger.error("Error in deleteConversation controller", {
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
 * Clear all messages in a conversation.
 */
export const clearConversationMessages = async (
	req: Request<ConversationParams>,
	res: Response,
	next: NextFunction,
) => {
	const { conversationId } = req.params;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			return next(new UnauthorizedError("Unauthorized!"));
		}

		if (!mongoose.Types.ObjectId.isValid(conversationId)) {
			return next(new BadRequestError("Invalid conversation ID!"));
		}

		// Verify conversation exists and user is a participant
		const conversation = await Conversation.findById(conversationId);
		if (!conversation) {
			return next(new NotFoundError("Conversation not found!"));
		}

		if (
			!conversation.participants
				.map((id) => id.toString())
				.includes(currentUserId.toString())
		) {
			return next(
				new ForbiddenError(
					"You are not authorized to clear this conversation!",
				),
			);
		}

		// Find all messages in this conversation to clear their cloudinary attachments
		const messages = await Message.find({ conversation: conversationId });
		const allPublicIds: string[] = [];
		for (const msg of messages) {
			if (msg.attachments && msg.attachments.length > 0) {
				msg.attachments.forEach((att) => {
					if (att.public_id) {
						allPublicIds.push(att.public_id);
					}
				});
			}
		}

		// Destroy Cloudinary attachments asynchronously
		if (allPublicIds.length > 0) {
			const imageDeletions = allPublicIds.map((pubId) =>
				cloudinary.uploader.destroy(pubId),
			);
			Promise.allSettled(imageDeletions).then((results) => {
				results.forEach((result) => {
					if (result.status === "rejected") {
						logger.error(
							"Cloudinary deletion failed during conversation clear",
							{
								error: result.reason,
							},
						);
					}
				});
			});
		}

		// Delete all messages in the conversation
		await Message.deleteMany({ conversation: conversationId });

		// Reset conversation metadata
		conversation.lastMessage = undefined;
		// Reset unread counts
		const participants = conversation.participants.map((p) => p.toString());
		participants.forEach((pId) => {
			conversation.unreadCounts.set(pId, 0);
		});
		await conversation.save();

		// Clear chat cache
		await clearChatCache(conversationId, participants);

		// Emit live socket event to conversation room and individual user rooms
		const io = getIO();
		io.to(`conversation:${conversationId}`).emit("conversation:clear", {
			conversationId,
		});
		participants.forEach((pId) => {
			io.to(`user:${pId}`).emit("conversation:cleared", {
				conversationId,
			});
		});

		return res.status(200).json({
			success: true,
			message: "Conversation messages cleared successfully!",
		});
	} catch (err: any) {
		logger.error("Error in clearConversationMessages controller", {
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
 * Fetch direct presence status of a user.
 */
export const getUserPresence = async (
	req: Request<UserParams>,
	res: Response,
	next: NextFunction,
) => {
	const { userId } = req.params;

	try {
		if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
			return next(new BadRequestError("Invalid or missing user ID!"));
		}

		const presence = await getUserPresenceStatus(userId);

		return res.status(200).json({
			success: true,
			userId,
			presence,
		});
	} catch (err: any) {
		logger.error("Error in getUserPresence controller", {
			error: err.message,
		});
		return next(
			err instanceof AppError
				? err
				: new AppError("Internal server error!"),
		);
	}
};
