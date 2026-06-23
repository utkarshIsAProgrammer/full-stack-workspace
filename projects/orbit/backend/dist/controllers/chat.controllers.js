"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserPresence = exports.clearConversationMessages = exports.deleteConversation = exports.deleteMessageForMe = exports.deleteMessage = exports.editMessage = exports.sendMessage = exports.getMessages = exports.getConversations = exports.getOrCreateConversation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const conversation_model_1 = require("../models/conversation.model");
const message_model_1 = require("../models/message.model");
const user_model_1 = require("../models/user.model");
const chat_schema_1 = require("../schemas/chat.schema");
const errors_1 = require("../utilities/errors");
const logger_1 = require("../utilities/logger");
const notification_1 = require("../utilities/notification");
const cache_1 = require("../configs/cache");
const sanitize_1 = require("../configs/sanitize");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
const socket_1 = require("../configs/socket");
// ─── Conversations ───────────────────────────────────────────────────
/**
 * Create or fetch a 1-on-1 conversation with another user.
 */
const getOrCreateConversation = async (req, res, next) => {
    const { recipientId } = req.body;
    try {
        if (!recipientId || !mongoose_1.default.Types.ObjectId.isValid(recipientId)) {
            return next(new errors_1.BadRequestError("Invalid or missing recipient ID!"));
        }
        const currentUserId = req.user?._id;
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (currentUserId.toString() === recipientId.toString()) {
            return next(new errors_1.BadRequestError("You cannot start a conversation with yourself!"));
        }
        // Verify recipient exists
        const recipient = await user_model_1.User.findById(recipientId).select("username fullName profilePic");
        if (!recipient) {
            return next(new errors_1.NotFoundError("Recipient user not found!"));
        }
        // Sort participant IDs lexicographically and cast to ObjectIds to satisfy unique index
        const sortedStr = [
            currentUserId.toString(),
            recipientId.toString(),
        ].sort();
        const participants = sortedStr.map((id) => new mongoose_1.default.Types.ObjectId(id));
        const idA = new mongoose_1.default.Types.ObjectId(currentUserId.toString());
        const idB = new mongoose_1.default.Types.ObjectId(recipientId.toString());
        // Look up existing conversation — $all handles any ordering
        let conversation = await conversation_model_1.Conversation.findOne({
            participants: { $all: [idA, idB] },
        });
        if (!conversation) {
            conversation = new conversation_model_1.Conversation({
                participants,
                unreadCounts: {
                    [currentUserId.toString()]: 0,
                    [recipientId.toString()]: 0,
                },
            });
            await conversation.save();
        }
        // Populate participants info
        const populatedConversation = await conversation_model_1.Conversation.findById(conversation._id)
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
        const presence = await (0, socket_1.getUserPresenceStatus)(otherParticipantId);
        return res.status(200).json({
            success: true,
            message: "Conversation retrieved successfully!",
            conversation: { ...populatedConversation, presence },
        });
    }
    catch (err) {
        logger_1.logger.error("Error in getOrCreateConversation controller", {
            error: err.message,
            stack: err.stack,
        });
        // Handle MongoDB duplicate key (conversation already exists) gracefully
        if ((err.name === "MongoServerError" || err.name === "MongoError") &&
            err.code === 11000) {
            // Race condition: conversation was inserted between our findOne and save — retry the find
            try {
                const idA = new mongoose_1.default.Types.ObjectId(req.user?._id?.toString());
                const idB = new mongoose_1.default.Types.ObjectId(recipientId);
                const existing = await conversation_model_1.Conversation.findOne({
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
                    const retryPresence = await (0, socket_1.getUserPresenceStatus)(recipientId);
                    return res.status(200).json({
                        success: true,
                        message: "Conversation retrieved successfully!",
                        conversation: { ...existing, presence: retryPresence },
                    });
                }
            }
            catch (retryErr) {
                return next(new errors_1.AppError("Internal server error!"));
            }
        }
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.getOrCreateConversation = getOrCreateConversation;
/**
 * Get all conversations for the authenticated user, populated with presence status.
 */
const getConversations = async (req, res, next) => {
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        const conversations = await conversation_model_1.Conversation.find({
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
        const conversationsWithPresence = await Promise.all(conversations.map(async (conv) => {
            // Filter out null participants (e.g. deleted users)
            const activeParticipants = (conv.participants || []).filter((p) => p != null);
            const otherParticipant = activeParticipants.find((p) => p._id && p._id.toString() !== currentUserId.toString());
            let presence = "offline";
            if (otherParticipant) {
                presence = await (0, socket_1.getUserPresenceStatus)(otherParticipant._id.toString());
            }
            return {
                ...conv,
                participants: activeParticipants,
                presence,
            };
        }));
        const responseData = {
            success: true,
            message: conversationsWithPresence.length
                ? "Conversations fetched successfully!"
                : "No conversations yet!",
            conversations: conversationsWithPresence,
        };
        // cache conversations per user (30s TTL — chat changes frequently via socket)
        try {
            await (0, cache_1.setCache)(`chat:conversations:${currentUserId.toString()}`, responseData, 30);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getConversations!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        logger_1.logger.error("Error in getConversations controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.getConversations = getConversations;
// ─── Messages ────────────────────────────────────────────────────────
/**
 * Get paginated messages for a specific conversation using cursor-based pagination.
 */
const getMessages = async (req, res, next) => {
    const { conversationId } = req.params;
    const currentUserId = req.user?._id;
    const cursor = req.query.cursor;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
            return next(new errors_1.BadRequestError("Invalid conversation ID!"));
        }
        // Verify conversation exists and user is a participant
        const conversation = await conversation_model_1.Conversation.findById(conversationId);
        if (!conversation) {
            return next(new errors_1.NotFoundError("Conversation not found!"));
        }
        if (!conversation.participants
            .map((id) => id.toString())
            .includes(currentUserId.toString())) {
            return next(new errors_1.ForbiddenError("You are not authorized to access this conversation!"));
        }
        // cache key
        const cacheKey = `chat:messages:${conversationId}:${cursor || "first"}:${limit}`;
        try {
            const cached = await (0, cache_1.getCache)(cacheKey);
            if (cached)
                return res.status(200).json(cached);
        }
        catch (err) {
            logger_1.logger.error(`Cache error in getMessages!`, { error: err.message });
        }
        // Build pagination query
        const query = { conversation: conversationId };
        if (cursor && mongoose_1.default.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: cursor };
        }
        // Fetch messages (limit + 1 to check for hasMore)
        const messages = await message_model_1.Message.find(query)
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
            messages.pop(); // Remove the extra record used for checking
        }
        // Reverse messages to present them in chronological order to the client
        messages.reverse();
        const nextCursor = hasMore && messages.length > 0 ? messages[0]._id : null;
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
            await (0, cache_1.setCache)(cacheKey, responseData, 30);
        }
        catch (err) {
            logger_1.logger.error(`Cache set error in getMessages!`, { error: err.message });
        }
        return res.status(200).json(responseData);
    }
    catch (err) {
        logger_1.logger.error("Error in getMessages controller", { error: err.message });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.getMessages = getMessages;
/**
 * Send a message with text and/or file uploads.
 */
const sendMessage = async (req, res, next) => {
    const { conversationId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
            return next(new errors_1.BadRequestError("Invalid conversation ID!"));
        }
        // Verify conversation and participation
        const conversation = await conversation_model_1.Conversation.findById(conversationId);
        if (!conversation) {
            return next(new errors_1.NotFoundError("Conversation not found!"));
        }
        const participantsStr = conversation.participants.map((id) => id.toString());
        if (!participantsStr.includes(currentUserId.toString())) {
            return next(new errors_1.ForbiddenError("You are not a participant in this conversation!"));
        }
        const recipientId = participantsStr.find((id) => id !== currentUserId.toString());
        if (!recipientId) {
            return next(new errors_1.AppError("Recipient not found in conversation participants list!"));
        }
        // Map files uploaded via Multer
        const uploadedFiles = req.files || [];
        const fileAttachments = uploadedFiles.map((file) => {
            let type = "image";
            if (file.mimetype.startsWith("audio/")) {
                type = "voice_note";
            }
            else if (file.mimetype === "image/gif") {
                type = "gif";
            }
            return {
                url: file.path,
                public_id: file.filename,
                type,
            };
        });
        // Parse external attachments (e.g. external gifs, memes)
        let bodyAttachments = [];
        if (req.body.attachments) {
            try {
                bodyAttachments =
                    typeof req.body.attachments === "string"
                        ? JSON.parse(req.body.attachments)
                        : req.body.attachments;
            }
            catch (parseErr) {
                return next(new errors_1.BadRequestError("Invalid attachments format."));
            }
        }
        const attachments = [...fileAttachments, ...bodyAttachments];
        // Validate request contents using Zod
        const validation = chat_schema_1.sendMessageSchema.safeParse({
            text: req.body.text,
            attachments: attachments.length > 0 ? attachments : undefined,
            replyTo: req.body.replyTo,
        });
        if (!validation.success) {
            return next(new errors_1.BadRequestError(validation.error.issues[0]?.message || "Validation failed"));
        }
        const sanitizedText = validation.data.text
            ? (0, sanitize_1.sanitizePlainText)(validation.data.text)
            : "";
        // Check if the recipient is currently viewing this conversation room
        const isRecipientActive = await (0, socket_1.isRecipientActiveInConversation)(conversationId, recipientId);
        // Create the message
        const message = new message_model_1.Message({
            conversation: conversationId,
            sender: currentUserId,
            recipient: recipientId,
            text: sanitizedText,
            attachments,
            replyTo: validation.data.replyTo || null,
            seen: isRecipientActive,
            seenAt: isRecipientActive ? new Date() : null,
        });
        await message.save();
        // Update conversation properties
        const updateObj = { lastMessage: message._id };
        if (!isRecipientActive) {
            // Increment unread count for recipient if they are not active in the chatbox
            updateObj.$inc = { [`unreadCounts.${recipientId}`]: 1 };
        }
        const updatedConversation = await conversation_model_1.Conversation.findByIdAndUpdate(conversationId, updateObj, { new: true });
        // Clear chat cache
        await (0, cache_1.clearChatCache)(conversationId, [currentUserId.toString(), recipientId.toString()]);
        // If this is a reply, create a notification for the original message's sender
        if (validation.data.replyTo) {
            try {
                const repliedMessage = await message_model_1.Message.findById(validation.data.replyTo).select("sender").lean();
                if (repliedMessage && repliedMessage.sender) {
                    const senderField = repliedMessage.sender;
                    const originalSenderId = senderField._id
                        ? senderField._id.toString()
                        : senderField.toString();
                    await (0, notification_1.createNotification)({
                        recipient: originalSenderId,
                        sender: currentUserId.toString(),
                        type: "message_reply",
                    });
                }
            }
            catch (notifErr) {
                logger_1.logger.error("Failed to create message_reply notification", { error: notifErr.message });
            }
        }
        // Populate sender info for the client response and socket emits
        const populatedMessage = await message_model_1.Message.findById(message._id)
            .populate("sender", "username fullName profilePic")
            .populate({
            path: "replyTo",
            select: "sender text attachments createdAt",
            populate: { path: "sender", select: "username fullName profilePic" },
        })
            .lean();
        // Emit real-time message event to conversation room (active viewers)
        (0, socket_1.emitNewMessage)(conversationId, populatedMessage);
        // If recipient is not actively in the chatbox, emit to their personal room
        // so they still get the message data in real-time (even on other tabs)
        // and send a badge/toast notification
        if (!isRecipientActive) {
            // Emit to personal room — the Chat.tsx handler appends to messages if viewing
            // this conversation, otherwise updates the conversations list
            (0, socket_1.getIO)().to(`user:${recipientId}`).emit("message:new", populatedMessage);
            const recipientUnreadCount = updatedConversation?.unreadCounts?.get(recipientId) || 1;
            (0, socket_1.emitChatNotification)(recipientId, {
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
    }
    catch (err) {
        logger_1.logger.error("Error in sendMessage controller", { error: err.message });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.sendMessage = sendMessage;
/**
 * Edit a message within 5 minutes of sending.
 */
const editMessage = async (req, res, next) => {
    const { messageId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
            return next(new errors_1.BadRequestError("Invalid message ID!"));
        }
        const validation = chat_schema_1.editMessageSchema.safeParse(req.body);
        if (!validation.success) {
            return next(new errors_1.BadRequestError(validation.error.issues[0]?.message || "Validation failed"));
        }
        const message = await message_model_1.Message.findById(messageId);
        if (!message) {
            return next(new errors_1.NotFoundError("Message not found!"));
        }
        // Ownership check
        if (message.sender.toString() !== currentUserId.toString()) {
            return next(new errors_1.ForbiddenError("You can only edit your own messages!"));
        }
        // 5 minutes check
        const diffMs = Date.now() - message.createdAt.getTime();
        const EDIT_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes
        if (diffMs > EDIT_TIME_LIMIT) {
            return next(new errors_1.BadRequestError("Message can only be edited within 5 minutes of sending!"));
        }
        const sanitizedText = (0, sanitize_1.sanitizePlainText)(validation.data.text);
        message.text = sanitizedText;
        message.isEdited = true;
        await message.save();
        // Clear chat cache
        const conversation = await conversation_model_1.Conversation.findById(message.conversation);
        if (conversation) {
            await (0, cache_1.clearChatCache)(message.conversation.toString(), conversation.participants.map(p => p.toString()));
        }
        const populatedMessage = await message_model_1.Message.findById(message._id)
            .populate("sender", "username fullName profilePic")
            .lean();
        // Emit live update to conversation room
        (0, socket_1.emitMessageEdit)(message.conversation.toString(), populatedMessage);
        return res.status(200).json({
            success: true,
            message: "Message edited successfully!",
            editedMessage: populatedMessage,
        });
    }
    catch (err) {
        logger_1.logger.error("Error in editMessage controller", { error: err.message });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.editMessage = editMessage;
/**
 * Delete a message (mark as deleted) within 5 minutes of sending.
 */
const deleteMessage = async (req, res, next) => {
    const { messageId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
            return next(new errors_1.BadRequestError("Invalid message ID!"));
        }
        const message = await message_model_1.Message.findById(messageId);
        if (!message) {
            return next(new errors_1.NotFoundError("Message not found!"));
        }
        // Ownership check
        if (message.sender.toString() !== currentUserId.toString()) {
            return next(new errors_1.ForbiddenError("You can only delete your own messages!"));
        }
        // 5 minutes check
        const diffMs = Date.now() - message.createdAt.getTime();
        const DELETE_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes
        if (diffMs > DELETE_TIME_LIMIT) {
            return next(new errors_1.BadRequestError("Message can only be deleted within 5 minutes of sending!"));
        }
        // Cloudinary cleanup of attachments asynchronously
        const oldAttachments = message.attachments || [];
        const imageDeletions = oldAttachments
            .map((att) => att.public_id)
            .filter(Boolean)
            .map((pubId) => cloudinary_1.default.uploader.destroy(pubId));
        Promise.allSettled(imageDeletions).then((results) => {
            results.forEach((result) => {
                if (result.status === "rejected") {
                    logger_1.logger.error("Cloudinary deletion failed during chat message delete", {
                        error: result.reason,
                    });
                }
            });
        });
        // Mark as deleted, replace text, and clear attachments list
        message.isDeleted = true;
        message.text = "This message was deleted";
        message.attachments = [];
        await message.save();
        // Clear chat cache
        const conversation = await conversation_model_1.Conversation.findById(message.conversation);
        if (conversation) {
            await (0, cache_1.clearChatCache)(message.conversation.toString(), conversation.participants.map(p => p.toString()));
        }
        // Emit live deletion to conversation room
        (0, socket_1.emitMessageDelete)(message.conversation.toString(), message._id.toString());
        return res.status(200).json({
            success: true,
            message: "Message deleted successfully!",
        });
    }
    catch (err) {
        logger_1.logger.error("Error in deleteMessage controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.deleteMessage = deleteMessage;
/**
 * Delete a message for the current user only (no time limit).
 * The message remains visible to other participants.
 */
const deleteMessageForMe = async (req, res, next) => {
    const { messageId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
            return next(new errors_1.BadRequestError("Invalid message ID!"));
        }
        const message = await message_model_1.Message.findById(messageId);
        if (!message) {
            return next(new errors_1.NotFoundError("Message not found!"));
        }
        // Verify the user is a participant in the conversation (can always delete for themselves)
        const conversation = await conversation_model_1.Conversation.findById(message.conversation);
        if (!conversation) {
            return next(new errors_1.NotFoundError("Conversation not found!"));
        }
        const participantsStr = conversation.participants.map((id) => id.toString());
        if (!participantsStr.includes(currentUserId.toString())) {
            return next(new errors_1.ForbiddenError("You are not a participant in this conversation!"));
        }
        // Add current user to deletedFor array if not already there
        const userIdStr = currentUserId.toString();
        const alreadyDeleted = (message.deletedFor || []).some((id) => id.toString() === userIdStr);
        if (!alreadyDeleted) {
            message.deletedFor.push(currentUserId);
            await message.save();
        }
        // Clear chat cache
        await (0, cache_1.clearChatCache)(message.conversation.toString(), participantsStr);
        // Emit to conversation room so the deleting user's client hides the message
        (0, socket_1.emitMessageDeleteForMe)(message.conversation.toString(), message._id.toString(), userIdStr);
        return res.status(200).json({
            success: true,
            message: "Message deleted for you!",
        });
    }
    catch (err) {
        logger_1.logger.error("Error in deleteMessageForMe controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.deleteMessageForMe = deleteMessageForMe;
/**
 * Delete an entire conversation and its messages.
 */
const deleteConversation = async (req, res, next) => {
    const { conversationId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
            return next(new errors_1.BadRequestError("Invalid conversation ID!"));
        }
        // Verify conversation exists and user is a participant
        const conversation = await conversation_model_1.Conversation.findById(conversationId);
        if (!conversation) {
            return next(new errors_1.NotFoundError("Conversation not found!"));
        }
        if (!conversation.participants
            .map((id) => id.toString())
            .includes(currentUserId.toString())) {
            return next(new errors_1.ForbiddenError("You are not authorized to delete this conversation!"));
        }
        // Find all messages in this conversation to clear their cloudinary attachments
        const messages = await message_model_1.Message.find({ conversation: conversationId });
        const allPublicIds = [];
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
            const imageDeletions = allPublicIds.map((pubId) => cloudinary_1.default.uploader.destroy(pubId));
            Promise.allSettled(imageDeletions).then((results) => {
                results.forEach((result) => {
                    if (result.status === "rejected") {
                        logger_1.logger.error("Cloudinary deletion failed during conversation delete", {
                            error: result.reason,
                        });
                    }
                });
            });
        }
        // Delete all messages in the conversation
        await message_model_1.Message.deleteMany({ conversation: conversationId });
        // Delete the conversation document itself
        await conversation_model_1.Conversation.findByIdAndDelete(conversationId);
        // Clear chat cache
        const participants = conversation.participants.map((p) => p.toString());
        await (0, cache_1.clearChatCache)(conversationId, participants);
        // Emit live socket events to individual user rooms to ensure sidebar updating
        const io = (0, socket_1.getIO)();
        participants.forEach((pId) => {
            io.to(`user:${pId}`).emit("conversation:delete", {
                conversationId,
            });
        });
        return res.status(200).json({
            success: true,
            message: "Conversation deleted successfully!",
        });
    }
    catch (err) {
        logger_1.logger.error("Error in deleteConversation controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.deleteConversation = deleteConversation;
/**
 * Clear all messages in a conversation.
 */
const clearConversationMessages = async (req, res, next) => {
    const { conversationId } = req.params;
    const currentUserId = req.user?._id;
    try {
        if (!currentUserId) {
            return next(new errors_1.UnauthorizedError("Unauthorized!"));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
            return next(new errors_1.BadRequestError("Invalid conversation ID!"));
        }
        // Verify conversation exists and user is a participant
        const conversation = await conversation_model_1.Conversation.findById(conversationId);
        if (!conversation) {
            return next(new errors_1.NotFoundError("Conversation not found!"));
        }
        if (!conversation.participants
            .map((id) => id.toString())
            .includes(currentUserId.toString())) {
            return next(new errors_1.ForbiddenError("You are not authorized to clear this conversation!"));
        }
        // Find all messages in this conversation to clear their cloudinary attachments
        const messages = await message_model_1.Message.find({ conversation: conversationId });
        const allPublicIds = [];
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
            const imageDeletions = allPublicIds.map((pubId) => cloudinary_1.default.uploader.destroy(pubId));
            Promise.allSettled(imageDeletions).then((results) => {
                results.forEach((result) => {
                    if (result.status === "rejected") {
                        logger_1.logger.error("Cloudinary deletion failed during conversation clear", {
                            error: result.reason,
                        });
                    }
                });
            });
        }
        // Delete all messages in the conversation
        await message_model_1.Message.deleteMany({ conversation: conversationId });
        // Reset conversation metadata
        conversation.lastMessage = undefined;
        // Reset unread counts
        const participants = conversation.participants.map((p) => p.toString());
        participants.forEach((pId) => {
            conversation.unreadCounts.set(pId, 0);
        });
        await conversation.save();
        // Clear chat cache
        await (0, cache_1.clearChatCache)(conversationId, participants);
        // Emit live socket event to conversation room and individual user rooms
        const io = (0, socket_1.getIO)();
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
    }
    catch (err) {
        logger_1.logger.error("Error in clearConversationMessages controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.clearConversationMessages = clearConversationMessages;
/**
 * Fetch direct presence status of a user.
 */
const getUserPresence = async (req, res, next) => {
    const { userId } = req.params;
    try {
        if (!userId || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return next(new errors_1.BadRequestError("Invalid or missing user ID!"));
        }
        const presence = await (0, socket_1.getUserPresenceStatus)(userId);
        return res.status(200).json({
            success: true,
            userId,
            presence,
        });
    }
    catch (err) {
        logger_1.logger.error("Error in getUserPresence controller", {
            error: err.message,
        });
        return next(err instanceof errors_1.AppError
            ? err
            : new errors_1.AppError("Internal server error!"));
    }
};
exports.getUserPresence = getUserPresence;
//# sourceMappingURL=chat.controllers.js.map