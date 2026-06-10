"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitChatNotification = exports.emitMessageDelete = exports.emitMessageEdit = exports.emitNewMessage = exports.getUserPresenceStatus = exports.isRecipientActiveInConversation = exports.emitPostUnpin = exports.emitPostPin = exports.emitUserView = exports.emitPostView = exports.emitMessageReaction = exports.emitCommentReaction = exports.emitUserShare = exports.emitPostShare = exports.emitUnfollowUser = exports.emitFollowUser = exports.emitCommentDeleted = exports.emitCommentUpdated = exports.emitPostUpdated = exports.emitPostDeleted = exports.emitPostCreated = exports.emitCommentUnlike = exports.emitCommentLike = exports.emitCommentReply = exports.emitPostComment = exports.emitPostUnrepost = exports.emitPostRepost = exports.emitPostUnsave = exports.emitPostSave = exports.emitPostUnlike = exports.emitPostLike = exports.sendNotification = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie = __importStar(require("cookie"));
const env_1 = require("./env");
const logger_1 = require("../utilities/logger");
const cache_1 = require("./cache");
const redis_1 = require("./redis");
const conversation_model_1 = require("../models/conversation.model");
const message_model_1 = require("../models/message.model");
let io;
// Track connection attempts for rate limiting using Redis for distributed systems
const checkConnectionRateLimit = async (ip) => {
    try {
        const key = `socket:ratelimit:${ip}`;
        const current = await redis_1.redis.get(key);
        const count = current && typeof current === 'string' ? parseInt(current, 10) : 0;
        const MAX_CONNECTIONS_PER_MINUTE = 30;
        if (count >= MAX_CONNECTIONS_PER_MINUTE) {
            return false;
        }
        if (count === 0) {
            await redis_1.redis.set(key, "1", { ex: 60 });
        }
        else {
            await redis_1.redis.incr(key);
        }
        return true;
    }
    catch (error) {
        // Fallback to allow connection if Redis fails
        logger_1.logger.warn("Redis rate limiting failed, allowing connection", { error, ip });
        return true;
    }
};
const initSocket = (server) => {
    const allowedOrigins = [
        env_1.env.CLIENT_URL,
        env_1.env.CLIENT_URL.replace(/\/$/, ""),
        "http://localhost:5173",
        "http://localhost:5174"
    ];
    io = new socket_io_1.Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) {
                    callback(null, true);
                    return;
                }
                const originWithoutSlash = origin.replace(/\/$/, "");
                if (allowedOrigins.includes(originWithoutSlash) ||
                    originWithoutSlash.endsWith(".vercel.app") ||
                    originWithoutSlash.startsWith("http://localhost:")) {
                    callback(null, true);
                    return;
                }
                callback(new Error("Not allowed by CORS"));
            },
            credentials: true,
        },
        perMessageDeflate: {
            threshold: 1024, // only compress messages > 1 KB
        },
        connectTimeout: 10000,
    });
    io.use(async (socket, next) => {
        const s = socket;
        const clientIp = socket.handshake.headers["x-forwarded-for"] ||
            socket.handshake.headers["x-real-ip"] ||
            socket.conn.remoteAddress || "unknown";
        // Rate limit connections using Redis
        const allowed = await checkConnectionRateLimit(clientIp);
        if (!allowed) {
            logger_1.logger.warn("Socket connection rate limited", { ip: clientIp });
            return next(new Error("Too many connection attempts. Please try again later."));
        }
        let token = socket.handshake.auth.token || socket.handshake.headers.token;
        // Also check cookies if token not found in auth/headers
        if (!token && socket.handshake.headers.cookie) {
            const cookies = cookie.parse(socket.handshake.headers.cookie);
            token = cookies.jwt;
        }
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, {
                    issuer: "orbit",
                    audience: "orbit-users",
                });
                s.userId = decoded.userId;
                s.isAuthenticated = true;
                logger_1.logger.info("Socket authenticated", { userId: s.userId, ip: clientIp });
            }
            catch (error) {
                // Invalid token - log but allow connection for public events
                logger_1.logger.warn("Socket auth failed with invalid token", {
                    ip: clientIp,
                    error: error instanceof Error ? error.message : "Unknown error"
                });
                s.isAuthenticated = false;
            }
        }
        else {
            s.isAuthenticated = false;
        }
        next();
    });
    io.on("connection", (socket) => {
        const s = socket;
        logger_1.logger.info("User connected", {
            userId: s.userId,
            isAuthenticated: s.isAuthenticated,
            socketId: socket.id
        });
        if (s.userId) {
            socket.join(`user:${s.userId}`);
            // Update presence to online in Redis and notify other users
            (0, cache_1.setCache)(`presence:user:${s.userId}`, "online", 86400).then(async () => {
                try {
                    const conversations = await conversation_model_1.Conversation.find({ participants: s.userId }).select("participants").lean();
                    for (const conv of conversations) {
                        const otherParticipant = conv.participants.find((p) => p.toString() !== s.userId);
                        if (otherParticipant) {
                            io.to(`user:${otherParticipant.toString()}`).emit("user:presence", {
                                userId: s.userId,
                                status: "online",
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error("Error broadcasting online presence", { error, userId: s.userId });
                }
            }).catch(err => {
                logger_1.logger.error("Failed to set user presence in Redis", { error: err.message, userId: s.userId });
            });
        }
        // Join conversation room
        socket.on("chat:join", async ({ conversationId }) => {
            if (!s.userId || !conversationId)
                return;
            s.activeConversationId = conversationId;
            socket.join(`conversation:${conversationId}`);
            logger_1.logger.info("Socket joined conversation", { userId: s.userId, conversationId });
            try {
                // Mark all messages from the other user in this conversation as seen
                const result = await message_model_1.Message.updateMany({ conversation: conversationId, recipient: s.userId, seen: false }, { $set: { seen: true, seenAt: new Date() } }); // Always clear unread counts when joining (even if no unseen messages)
                await conversation_model_1.Conversation.findByIdAndUpdate(conversationId, {
                    $set: { [`unreadCounts.${s.userId}`]: 0 }
                });
                // Always emit messages:seen — even if modifiedCount was 0, the UI needs
                // to show double-ticks for already-seen messages and clear the badge
                io.to(`conversation:${conversationId}`).emit("messages:seen", {
                    conversationId,
                    seenBy: s.userId,
                    seenAt: new Date(),
                });
            }
            catch (error) {
                logger_1.logger.error("Error marking messages seen on chat:join", { error: error.message, conversationId, userId: s.userId });
            }
        });
        // Leave conversation room
        socket.on("chat:leave", ({ conversationId }) => {
            s.activeConversationId = undefined;
            socket.leave(`conversation:${conversationId}`);
            logger_1.logger.info("Socket left conversation", { userId: s.userId, conversationId });
        });
        // Typing indicator
        socket.on("chat:typing", ({ conversationId, isTyping }) => {
            if (!s.userId || !conversationId)
                return;
            socket.to(`conversation:${conversationId}`).emit("chat:typing", {
                conversationId,
                userId: s.userId,
                isTyping,
            });
        });
        socket.on("disconnect", (reason) => {
            logger_1.logger.info("User disconnected", {
                userId: s.userId,
                socketId: socket.id,
                reason
            });
            if (s.userId) {
                // Clear presence in Redis and notify other users
                (0, cache_1.deleteCache)(`presence:user:${s.userId}`).then(async () => {
                    try {
                        const conversations = await conversation_model_1.Conversation.find({ participants: s.userId }).select("participants").lean();
                        for (const conv of conversations) {
                            const otherParticipant = conv.participants.find((p) => p.toString() !== s.userId);
                            if (otherParticipant) {
                                io.to(`user:${otherParticipant.toString()}`).emit("user:presence", {
                                    userId: s.userId,
                                    status: "offline",
                                });
                            }
                        }
                    }
                    catch (error) {
                        logger_1.logger.error("Error broadcasting offline presence", { error, userId: s.userId });
                    }
                }).catch(err => {
                    logger_1.logger.error("Failed to delete user presence from Redis", { error: err.message, userId: s.userId });
                });
            }
        });
        // Handle unauthorized access attempts to protected events
        socket.on("error", (error) => {
            logger_1.logger.error("Socket error", {
                userId: s.userId,
                error: error.message
            });
        });
    });
    logger_1.logger.info("Socket.io initialized");
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};
exports.getIO = getIO;
const pendingBatches = new Map();
const flushBatch = (event) => {
    const batch = pendingBatches.get(event);
    if (!batch || batch.length === 0)
        return;
    pendingBatches.delete(event);
    for (const entry of batch) {
        if (entry.room) {
            io.to(entry.room).emit(event, entry.data);
        }
        else {
            io.emit(event, entry.data);
        }
    }
};
/** Events where every payload is unique and must not be dropped by batching. */
const IMMEDIATE_EVENTS = new Set([
    "post:created",
    "post:deleted",
    "post:updated",
    "post:comment",
    "comment:reply",
    "comment:updated",
    "comment:deleted",
    "comment:reaction",
    "comment:like",
    "comment:unlike",
    "user:follow",
    "user:unfollow",
    "post:pin",
    "post:unpin",
]);
const batchEmit = (event, data, room) => {
    if (IMMEDIATE_EVENTS.has(event)) {
        if (room) {
            io.to(room).emit(event, data);
        }
        else {
            io.emit(event, data);
        }
        return;
    }
    if (!pendingBatches.has(event)) {
        pendingBatches.set(event, []);
        queueMicrotask(() => flushBatch(event));
    }
    const batch = pendingBatches.get(event);
    batch.push({ room: room ?? undefined, data });
};
// ─── Emit helpers (all use event batching) ───────────────────────────
const sendNotification = (userId, notification) => {
    try {
        const curriedIo = (0, exports.getIO)();
        curriedIo.to(`user:${userId}`).emit("notification", notification);
        logger_1.logger.info("Notification sent via socket", { userId, notificationType: notification.type });
    }
    catch (error) {
        logger_1.logger.error("Failed to send socket notification", { error: error.message, userId });
    }
};
exports.sendNotification = sendNotification;
const emitPostLike = (postId, userId, likesCount) => {
    try {
        batchEmit("post:like", { postId, userId, likesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:like", { error: error.message });
    }
};
exports.emitPostLike = emitPostLike;
const emitPostUnlike = (postId, userId, likesCount) => {
    try {
        batchEmit("post:unlike", { postId, userId, likesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:unlike", { error: error.message });
    }
};
exports.emitPostUnlike = emitPostUnlike;
const emitPostSave = (postId, userId, savesCount) => {
    try {
        batchEmit("post:save", { postId, userId, savesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:save", { error: error.message });
    }
};
exports.emitPostSave = emitPostSave;
const emitPostUnsave = (postId, userId, savesCount) => {
    try {
        batchEmit("post:unsave", { postId, userId, savesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:unsave", { error: error.message });
    }
};
exports.emitPostUnsave = emitPostUnsave;
const emitPostRepost = (postId, userId, repostsCount) => {
    try {
        batchEmit("post:repost", { postId, userId, repostsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:repost", { error: error.message });
    }
};
exports.emitPostRepost = emitPostRepost;
const emitPostUnrepost = (postId, userId, repostsCount) => {
    try {
        batchEmit("post:unrepost", { postId, userId, repostsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:unrepost", { error: error.message });
    }
};
exports.emitPostUnrepost = emitPostUnrepost;
const emitPostComment = (postId, comment, userId, commentsCount) => {
    try {
        batchEmit("post:comment", { postId, comment, userId, commentsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:comment", { error: error.message });
    }
};
exports.emitPostComment = emitPostComment;
const emitCommentReply = (postId, commentId, reply, userId, commentsCount, repliesCount) => {
    try {
        batchEmit("comment:reply", { postId, commentId, reply, userId, commentsCount, repliesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:reply", { error: error.message });
    }
};
exports.emitCommentReply = emitCommentReply;
const emitCommentLike = (commentId, userId, likesCount) => {
    try {
        batchEmit("comment:like", { commentId, userId, likesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:like", { error: error.message });
    }
};
exports.emitCommentLike = emitCommentLike;
const emitCommentUnlike = (commentId, userId, likesCount) => {
    try {
        batchEmit("comment:unlike", { commentId, userId, likesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:unlike", { error: error.message });
    }
};
exports.emitCommentUnlike = emitCommentUnlike;
const emitPostCreated = (post) => {
    try {
        batchEmit("post:created", post);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:created", { error: error.message });
    }
};
exports.emitPostCreated = emitPostCreated;
const emitPostDeleted = (postId) => {
    try {
        batchEmit("post:deleted", postId);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:deleted", { error: error.message });
    }
};
exports.emitPostDeleted = emitPostDeleted;
const emitPostUpdated = (post) => {
    try {
        batchEmit("post:updated", post);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:updated", { error: error.message });
    }
};
exports.emitPostUpdated = emitPostUpdated;
const emitCommentUpdated = (comment) => {
    try {
        batchEmit("comment:updated", comment);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:updated", { error: error.message });
    }
};
exports.emitCommentUpdated = emitCommentUpdated;
const emitCommentDeleted = (postId, commentId, commentsCount) => {
    try {
        batchEmit("comment:deleted", { postId, commentId, commentsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:deleted", { error: error.message });
    }
};
exports.emitCommentDeleted = emitCommentDeleted;
const emitFollowUser = (targetUserId, followerId, followersCount) => {
    try {
        batchEmit("user:follow", { targetUserId, followerId, followersCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit user:follow", { error: error.message });
    }
};
exports.emitFollowUser = emitFollowUser;
const emitUnfollowUser = (targetUserId, followerId, followersCount) => {
    try {
        batchEmit("user:unfollow", { targetUserId, followerId, followersCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit user:unfollow", { error: error.message });
    }
};
exports.emitUnfollowUser = emitUnfollowUser;
const emitPostShare = (postId, sharesCount) => {
    try {
        batchEmit("post:share", { postId, sharesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:share", { error: error.message });
    }
};
exports.emitPostShare = emitPostShare;
const emitUserShare = (userId, sharesCount) => {
    try {
        batchEmit("user:share", { userId, sharesCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit user:share", { error: error.message });
    }
};
exports.emitUserShare = emitUserShare;
/**
 * Emits a comment reaction event (add or remove).
 */
const emitCommentReaction = (commentId, payload) => {
    try {
        batchEmit("comment:reaction", { commentId, ...payload });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit comment:reaction", { error: error.message, commentId });
    }
};
exports.emitCommentReaction = emitCommentReaction;
/**
 * Emits a message reaction event (add or remove) to the conversation room,
 * AND to each participant's personal room so the reaction is received even when
 * the other user is not actively viewing the conversation.
 */
const emitMessageReaction = async (conversationId, payload, participantIds) => {
    try {
        // Always emit to the conversation room (for active viewers)
        io.to(`conversation:${conversationId}`).emit("message:reaction", payload);
        // Also emit to each participant's personal room so the reaction is received
        // even when they're not actively viewing the conversation
        if (participantIds && participantIds.length > 0) {
            for (const pId of participantIds) {
                io.to(`user:${pId}`).emit("message:reaction", payload);
            }
        }
    }
    catch (error) {
        logger_1.logger.error("Failed to emit message:reaction", { error: error.message, conversationId });
    }
};
exports.emitMessageReaction = emitMessageReaction;
const emitPostView = (postId, viewsCount) => {
    try {
        batchEmit("post:view", { postId, viewsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:view", { error: error.message });
    }
};
exports.emitPostView = emitPostView;
const emitUserView = (userId, viewsCount) => {
    try {
        batchEmit("user:view", { userId, viewsCount });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit user:view", { error: error.message });
    }
};
exports.emitUserView = emitUserView;
const emitPostPin = (postId, userId) => {
    try {
        batchEmit("post:pin", { postId, userId });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:pin", { error: error.message });
    }
};
exports.emitPostPin = emitPostPin;
const emitPostUnpin = (postId, userId) => {
    try {
        batchEmit("post:unpin", { postId, userId });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit post:unpin", { error: error.message });
    }
};
exports.emitPostUnpin = emitPostUnpin;
// ─── Chat Feature Socket Helpers ─────────────────────────────────────
/**
 * Checks if the recipient of a message is actively in the conversation room.
 * This is used to determine if the message should be marked 'seen' immediately.
 */
const isRecipientActiveInConversation = async (conversationId, recipientId) => {
    try {
        const sockets = await io.in(`user:${recipientId}`).fetchSockets();
        for (const s of sockets) {
            if (s.activeConversationId === conversationId) {
                return true;
            }
        }
    }
    catch (error) {
        logger_1.logger.error("Error checking recipient active status", {
            error: error.message,
            conversationId,
            recipientId,
        });
    }
    return false;
};
exports.isRecipientActiveInConversation = isRecipientActiveInConversation;
/**
 * Fetches user online status from Redis.
 */
const getUserPresenceStatus = async (userId) => {
    try {
        const presence = await (0, cache_1.getCache)(`presence:user:${userId}`);
        return presence || "offline";
    }
    catch (error) {
        logger_1.logger.error("Error fetching user presence status", {
            error: error.message,
            userId,
        });
        return "offline";
    }
};
exports.getUserPresenceStatus = getUserPresenceStatus;
/**
 * Emits a new message event to the conversation room.
 */
const emitNewMessage = (conversationId, message) => {
    try {
        io.to(`conversation:${conversationId}`).emit("message:new", message);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit message:new", { error: error.message, conversationId });
    }
};
exports.emitNewMessage = emitNewMessage;
/**
 * Emits a message edit event to the conversation room.
 */
const emitMessageEdit = (conversationId, message) => {
    try {
        io.to(`conversation:${conversationId}`).emit("message:edit", message);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit message:edit", { error: error.message, conversationId });
    }
};
exports.emitMessageEdit = emitMessageEdit;
/**
 * Emits a message deletion event to the conversation room.
 */
const emitMessageDelete = (conversationId, messageId) => {
    try {
        io.to(`conversation:${conversationId}`).emit("message:delete", { messageId });
    }
    catch (error) {
        logger_1.logger.error("Failed to emit message:delete", { error: error.message, conversationId, messageId });
    }
};
exports.emitMessageDelete = emitMessageDelete;
/**
 * Emits a live chat notification to a user's personal room when they are not viewing the active chat.
 */
const emitChatNotification = (recipientId, payload) => {
    try {
        io.to(`user:${recipientId}`).emit("chat:notification", payload);
    }
    catch (error) {
        logger_1.logger.error("Failed to emit chat:notification", { error: error.message, recipientId });
    }
};
exports.emitChatNotification = emitChatNotification;
//# sourceMappingURL=socket.js.map