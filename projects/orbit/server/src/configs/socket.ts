import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import * as cookie from "cookie";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./env";
import { logger } from "../utilities/logger";
import { getCache, setCache, deleteCache } from "./cache";
import { redis } from "./redis";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import Block from "../models/block.model";

// Extended socket type with auth properties
type UserSocket = Socket & {
  userId?: string;
  isAuthenticated?: boolean;
  activeConversationId?: string;
};

let io: SocketIOServer;

// Track online users in-memory for reliable presence broadcasts
const onlineUsers = new Set<string>();

// Module-level references for Redis adapter clients (needed for graceful shutdown)
let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;

// Track connection attempts for rate limiting using Redis for distributed systems
const checkConnectionRateLimit = async (ip: string): Promise<boolean> => {
  try {
    const key = `socket:ratelimit:${ip}`;
    const current = await redis.get(key);
    const count = current && typeof current === 'string' ? parseInt(current, 10) : 0;
    const MAX_CONNECTIONS_PER_MINUTE = 30;
    
    if (count >= MAX_CONNECTIONS_PER_MINUTE) {
      return false;
    }
    
    if (count === 0) {
      await redis.set(key, "1", { ex: 60 });
    } else {
      await redis.incr(key);
    }
    
    return true;
  } catch (error) {
    // Fallback to allow connection if Redis fails
    logger.warn("Redis rate limiting failed, allowing connection", { error, ip });
    return true;
  }
};

export const initSocket = async (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const originWithoutSlash = origin.replace(/\/$/, "");

        // In development, allow any localhost origin
        if (env.NODE_ENV === "development") {
          const isLocalhost =
            originWithoutSlash.startsWith("http://localhost:") ||
            originWithoutSlash.startsWith("http://127.0.0.1:") ||
            originWithoutSlash.startsWith("https://localhost:") ||
            originWithoutSlash.startsWith("https://127.0.0.1:");
          if (isLocalhost) {
            callback(null, true);
            return;
          }
        }

        // Also check the configured CLIENT_URL
        if (originWithoutSlash === env.CLIENT_URL.replace(/\/$/, "")) {
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
    maxHttpBufferSize: 100_000,
  });

  // ── Redis adapter for multi-instance support ─────────────
  // Allows Socket.io events to broadcast across multiple server instances
  // via Redis pub/sub. Falls back gracefully if Redis URL is not configured.
  try {
    const redisUrl = env.UPSTASH_REDIS_URL || (
      env.UPSTASH_REDIS_REST_URL
        ? `rediss://default:${env.UPSTASH_REDIS_REST_TOKEN}@${new URL(env.UPSTASH_REDIS_REST_URL).hostname}:6379`
        : null
    );

    if (redisUrl) {
      redisPubClient = new Redis(redisUrl, {
        tls: { rejectUnauthorized: false },
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 10000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 3000),
      });
      redisSubClient = redisPubClient.duplicate();

      await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);

      io.adapter(createAdapter(redisPubClient, redisSubClient));
      logger.info("Socket.io Redis adapter initialized for multi-instance support");
    } else {
      logger.info("Socket.io running in single-instance mode (no Redis URL configured)");
    }
  } catch (error: any) {
    logger.warn("Failed to initialize Socket.io Redis adapter, falling back to single-instance mode", {
      error: error.message,
    });
  }

  io.use(async (socket: Socket, next) => {
    const s = socket as UserSocket;
    const clientIp = socket.handshake.headers["x-forwarded-for"] as string || 
                     socket.handshake.headers["x-real-ip"] as string ||
                     socket.conn.remoteAddress || "unknown";
    
    // Rate limit connections using Redis
    const allowed = await checkConnectionRateLimit(clientIp);
    if (!allowed) {
      logger.warn("Socket connection rate limited", { ip: clientIp });
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
        const decoded = jwt.verify(token, env.JWT_SECRET, {
          issuer: "orbit",
          audience: "orbit-users",
        }) as any;
        s.userId = decoded.userId;
        s.isAuthenticated = true;
        logger.info("Socket authenticated", { userId: s.userId, ip: clientIp });
      } catch (error) {
        // Invalid token - log but allow connection for public events
        logger.warn("Socket auth failed with invalid token", { 
          ip: clientIp,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        s.isAuthenticated = false;
      }
    } else {
      s.isAuthenticated = false;
    }
    
    next();
  });

  io.on("connection", (socket: Socket) => {
    const s = socket as UserSocket;

    // Calls can only be signalled between users who share a direct-message
    // conversation. This prevents an authenticated account from using the
    // signalling server to ring arbitrary users or relay malformed payloads.
    const canRelayCall = async (targetUserId: unknown): Promise<boolean> => {
      if (
        !s.userId ||
        typeof targetUserId !== "string" ||
        targetUserId === s.userId ||
        !mongoose.isObjectIdOrHexString(targetUserId)
      ) {
        return false;
      }

      if (!s.data) {
        s.data = {};
      }
      if (!s.data.authorizedCalls) {
        s.data.authorizedCalls = new Set<string>();
      }

      if (s.data.authorizedCalls.has(targetUserId)) {
        return true;
      }

      // Check if blocked
      const isBlocked = await Block.exists({
        $or: [
          { blocker: s.userId, blocked: targetUserId },
          { blocker: targetUserId, blocked: s.userId },
        ],
      });
      if (isBlocked) {
        return false;
      }

      const sharedConversation = await Conversation.exists({
        participants: { $all: [s.userId, targetUserId] },
      });
      
      const allowed = Boolean(sharedConversation);
      if (allowed) {
        s.data.authorizedCalls.add(targetUserId);
      }
      return allowed;
    };
    logger.info("User connected", { 
      userId: s.userId, 
      isAuthenticated: s.isAuthenticated,
      socketId: socket.id 
    });

    if (s.userId) {
      socket.join(`user:${s.userId}`);
      onlineUsers.add(s.userId);

      // Broadcast presence IMMEDIATELY — not gated behind Redis.
      // Mobile browsers kill WebSocket when backgrounded, so we need to fire
      // presence as fast as possible before the user switches away.
      //
      // Uses CACHED conversation partner IDs to avoid a DB query on every
      // connect/disconnect (which can be frequent with mobile backgrounding).
      const broadcastOnline = async () => {
        try {
          // Try Redis cache first for conversation partner IDs
          const cachedPartners = await getCache<string[]>(`user:partners:${s.userId}`);
          let partnerIds: string[] = [];

          if (cachedPartners && cachedPartners.length > 0) {
            partnerIds = cachedPartners;
          } else {
            // Cache miss — query DB and cache for 5 minutes
            const conversations = await Conversation.find({ participants: s.userId }).select("participants").lean();
            partnerIds = conversations
              .map((conv) => {
                const other = conv.participants.find((p: any) => p.toString() !== s.userId);
                return other ? other.toString() : null;
              })
              .filter(Boolean) as string[];

            // Cache partner IDs (5 min TTL — new conversations update via clearByPattern on creation)
            setCache(`user:partners:${s.userId}`, partnerIds, 300).catch(() => {});
          }

          // Notify partners that this user is online
          for (const otherId of partnerIds) {
            io.to(`user:${otherId}`).emit("user:presence", {
              userId: s.userId,
              status: "online",
            });
          }

          // Send partner presences to the newly connected user
          for (const otherId of partnerIds) {
            if (onlineUsers.has(otherId)) {
              io.to(`user:${s.userId}`).emit("user:presence", {
                userId: otherId,
                status: "online",
              });
            }
          }
        } catch (error: any) {
          logger.error("Error broadcasting online presence", { error: error.message, userId: s.userId });
        }
      };

      // Fire immediately (no await — don't block connection for this)
      broadcastOnline();

      // Redis: persist presence in background with short TTL (60s)
      setCache(`presence:user:${s.userId}`, "online", 60).catch(err => {
        logger.error("Failed to set user presence in Redis", { error: err instanceof Error ? err.message : String(err), userId: s.userId });
      });
    }

    // Presence heartbeat — client sends this periodically to refresh their online status.
    // Without this, brief network blips (e.g. mobile backgrounding, tab switches) can
    // cause the user to fall out of onlineUsers, making them appear offline to partners.
    socket.on("presence:heartbeat", () => {
      if (!s.userId) return;

      // Refresh in-memory presence (may have been cleared by a stale disconnect event)
      onlineUsers.add(s.userId);

      // Refresh Redis TTL so getUserPresenceStatus() returns "online"
      setCache(`presence:user:${s.userId}`, "online", 60).catch(err => {
        logger.error("Failed to refresh presence in Redis on heartbeat", { error: err instanceof Error ? err.message : String(err), userId: s.userId });
      });
    });

    // Join conversation room
    socket.on("chat:join", async ({ conversationId }) => {
      if (!s.userId || !conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

      try {
        const conversation = await Conversation.findById(conversationId).select("participants").lean();
        if (!conversation) return;

        const isParticipant = (conversation.participants || []).some(
          (p: any) => p.toString() === s.userId
        );
        if (!isParticipant) {
          logger.warn("Unauthorized socket attempt to join chat room", { userId: s.userId, conversationId });
          return;
        }

        s.data.activeConversationId = conversationId;
        socket.join(`conversation:${conversationId}`);
        logger.info("Socket joined conversation", { userId: s.userId, conversationId });

        // Mark all messages from the other user in this conversation as seen
        const result = await Message.updateMany(
          { conversation: conversationId, recipient: s.userId, seen: false },
          { $set: { seen: true, seenAt: new Date() } }
        );          // Always clear unread counts when joining (even if no unseen messages)
          await Conversation.findByIdAndUpdate(conversationId, {
            $set: { [`unreadCounts.${s.userId}`]: 0 }
          });

          // Always emit messages:seen — even if modifiedCount was 0, the UI needs
          // to show double-ticks for already-seen messages and clear the badge
          io.to(`conversation:${conversationId}`).emit("messages:seen", {
            conversationId,
            seenBy: s.userId,
            seenAt: new Date(),
          });
      } catch (error: any) {
        logger.error("Error marking messages seen on chat:join", { error: error.message, conversationId, userId: s.userId });
      }
    });

    // Leave conversation room
    socket.on("chat:leave", ({ conversationId }) => {
      s.data.activeConversationId = undefined;
      socket.leave(`conversation:${conversationId}`);
      logger.info("Socket left conversation", { userId: s.userId, conversationId });
    });

    // Typing indicator
    socket.on("chat:typing", ({ conversationId, isTyping }) => {
      if (!s.userId || !conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("chat:typing", {
        conversationId,
        userId: s.userId,
        isTyping,
      });
    });

    // Voice note recording indicator
    socket.on("chat:recording", ({ conversationId, isRecording }) => {
      if (!s.userId || !conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("chat:recording", {
        conversationId,
        userId: s.userId,
        isRecording,
      });
    });

    socket.on("disconnect", (reason) => {
      logger.info("User disconnected", { 
        userId: s.userId, 
        socketId: socket.id,
        reason 
      });

      if (s.userId) {
        // Remove from in-memory tracking
        onlineUsers.delete(s.userId);

        // Broadcast offline IMMEDIATELY — not gated behind Redis
        const broadcastOffline = async () => {
          try {
            const conversations = await Conversation.find({ participants: s.userId }).select("participants").lean();
            for (const conv of conversations) {
              const otherParticipant = conv.participants.find((p: any) => p.toString() !== s.userId);
              if (otherParticipant) {
                io.to(`user:${otherParticipant.toString()}`).emit("user:presence", {
                  userId: s.userId,
                  status: "offline",
                });
              }
            }
          } catch (error) {
            logger.error("Error broadcasting offline presence", { error, userId: s.userId });
          }
        };

        broadcastOffline();

        // Redis: clear presence in background (failure is non-critical)
        deleteCache(`presence:user:${s.userId}`).catch(err => {
          logger.error("Failed to delete user presence from Redis", { error: err.message, userId: s.userId });
        });
      }
    });

    // ── WebRTC Call Signaling ──────────────────────────────────────
    // Relay call offer (SDP + ICE candidates bundled) to the callee
    socket.on("call:offer", async (data: { targetUserId: string; sdp: unknown; type: "audio" | "video" }) => {
      if (!data || !["audio", "video"].includes(data.type) || !data.sdp || !(await canRelayCall(data.targetUserId))) return;
      logger.info("Relaying call:offer", { from: s.userId, to: data.targetUserId, type: data.type });
      io.to(`user:${data.targetUserId}`).emit("call:offer", {
        callerId: s.userId,
        sdp: data.sdp,
        type: data.type,
      });
    });

    // Relay call answer back to the caller
    socket.on("call:answer", async (data: { targetUserId: string; sdp: unknown }) => {
      if (!data || !data.sdp || !(await canRelayCall(data.targetUserId))) return;
      logger.info("Relaying call:answer", { from: s.userId, to: data.targetUserId });
      io.to(`user:${data.targetUserId}`).emit("call:answer", {
        calleeId: s.userId,
        sdp: data.sdp,
      });
    });

    // Relay ICE candidates between peers
    socket.on("call:ice-candidate", async (data: { targetUserId: string; candidate: unknown }) => {
      if (!data || !data.candidate || !(await canRelayCall(data.targetUserId))) return;
      io.to(`user:${data.targetUserId}`).emit("call:ice-candidate", {
        senderId: s.userId,
        candidate: data.candidate,
      });
    });

    // ICE restart (network handoff — WiFi → cellular, etc.)
    socket.on("call:ice-restart", async (data: { targetUserId: string; sdp: unknown }) => {
      if (!data || !data.sdp || !(await canRelayCall(data.targetUserId))) return;
      logger.info("Relaying call:ice-restart", { from: s.userId, to: data.targetUserId });
      io.to(`user:${data.targetUserId}`).emit("call:ice-restart", {
        senderId: s.userId,
        sdp: data.sdp,
      });
    });

    // End call notification
    socket.on("call:end", async (data: { targetUserId: string }) => {
      if (!data || !(await canRelayCall(data.targetUserId))) return;
      logger.info("Relaying call:end", { from: s.userId, to: data.targetUserId });
      io.to(`user:${data.targetUserId}`).emit("call:end", {
        endedBy: s.userId,
      });
    });

    // Missed call notification (callee didn't answer within timeout)
    socket.on("call:missed", async (data: { targetUserId: string }) => {
      if (!data || !(await canRelayCall(data.targetUserId))) return;
      logger.info("Relaying call:missed", { from: s.userId, to: data.targetUserId });
      io.to(`user:${data.targetUserId}`).emit("call:missed", {
        callerId: s.userId,
      });
    });

    // ── Community Socket Events ──────────────────────────────────────
    socket.on("community:join", ({ communityId }) => {
      if (!s.userId || !communityId) return;
      socket.join(`community:${communityId}`);
      logger.info("Socket joined community", { userId: s.userId, communityId });
    });

    socket.on("community:leave", ({ communityId }) => {
      if (!s.userId || !communityId) return;
      socket.leave(`community:${communityId}`);
      logger.info("Socket left community", { userId: s.userId, communityId });
    });

    socket.on("community:typing", ({ communityId, isTyping }) => {
      if (!s.userId || !communityId) return;
      socket.to(`community:${communityId}`).emit("community:typing", {
        communityId,
        userId: s.userId,
        isTyping,
      });
    });

    // ── Audio Room Socket Events ──────────────────────────────────────
    socket.on("room:join", ({ roomId }) => {
      if (!s.userId || !roomId) return;
      socket.join(`room:${roomId}`);
      logger.info("Socket joined audio room", { userId: s.userId, roomId });
    });

    socket.on("room:leave", ({ roomId }) => {
      if (!s.userId || !roomId) return;
      socket.leave(`room:${roomId}`);
      logger.info("Socket left audio room", { userId: s.userId, roomId });
    });

    // Handle unauthorized access attempts to protected events
    socket.on("error", (error) => {
      logger.error("Socket error", { 
        userId: s.userId, 
        error: error.message 
      });
    });
  });

  logger.info("Socket.io initialized");
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};


// ─── Event batching ──────────────────────────────────────────────────
// Batches multiple emits for the same event into a single flush per
// microtask tick. For high-frequency events (likes, saves, follows),
// only the last payload is sent to avoid flooding clients.

interface BatchEntry {
  room: string | undefined;
  data: any;
}

const pendingBatches = new Map<string, BatchEntry[]>();

const flushBatch = (event: string) => {
  const batch = pendingBatches.get(event);
  if (!batch || batch.length === 0) return;
  pendingBatches.delete(event);

  for (const entry of batch) {
    if (entry.room) {
      io.to(entry.room).emit(event, entry.data);
    } else {
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
  "user:updated",
]);

const batchEmit = (event: string, data: any, room?: string) => {
  if (IMMEDIATE_EVENTS.has(event)) {
    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }
    return;
  }
  if (!pendingBatches.has(event)) {
    pendingBatches.set(event, []);
    queueMicrotask(() => flushBatch(event));
  }
  const batch = pendingBatches.get(event)!;
  batch.push({ room: room ?? undefined, data });
};

// ─── Emit helpers (all use event batching) ───────────────────────────

export const sendNotification = (userId: string, notification: any) => {
  try {
    const curriedIo = getIO();
    curriedIo.to(`user:${userId}`).emit("notification", notification);
    logger.info("Notification sent via socket", { userId, notificationType: notification.type });
  } catch (error: any) {
    logger.error("Failed to send socket notification", { error: error.message, userId });
  }
};

export const emitPostLike = (postId: string, userId: string, likesCount: number) => {
  try {
    batchEmit("post:like", { postId, userId, likesCount });
  } catch (error: any) {
    logger.error("Failed to emit post:like", { error: error.message });
  }
};

export const emitPostUnlike = (postId: string, userId: string, likesCount: number) => {
  try {
    batchEmit("post:unlike", { postId, userId, likesCount });
  } catch (error: any) {
    logger.error("Failed to emit post:unlike", { error: error.message });
  }
};

export const emitPostSave = (postId: string, userId: string, savesCount: number) => {
  try {
    batchEmit("post:save", { postId, userId, savesCount });
  } catch (error: any) {
    logger.error("Failed to emit post:save", { error: error.message });
  }
};

export const emitPostUnsave = (postId: string, userId: string, savesCount: number) => {
  try {
    batchEmit("post:unsave", { postId, userId, savesCount });
  } catch (error: any) {
    logger.error("Failed to emit post:unsave", { error: error.message });
  }
};

export const emitPostRepost = (postId: string, userId: string, repostsCount: number) => {
  try {
    batchEmit("post:repost", { postId, userId, repostsCount });
  } catch (error: any) {
    logger.error("Failed to emit post:repost", { error: error.message });
  }
};

export const emitPostUnrepost = (postId: string, userId: string, repostsCount: number) => {
  try {
    batchEmit("post:unrepost", { postId, userId, repostsCount });
  } catch (error: any) {
    logger.error("Failed to emit post:unrepost", { error: error.message });
  }
};

export const emitPostComment = (postId: string, comment: any, userId: string, commentsCount: number) => {
  try {
    batchEmit("post:comment", { postId, comment, userId, commentsCount });
  } catch (error: any) {
    logger.error("Failed to emit post:comment", { error: error.message });
  }
};

export const emitCommentReply = (postId: string, commentId: string, reply: any, userId: string, commentsCount: number, repliesCount: number) => {
  try {
    batchEmit("comment:reply", { postId, commentId, reply, userId, commentsCount, repliesCount });
  } catch (error: any) {
    logger.error("Failed to emit comment:reply", { error: error.message });
  }
};

export const emitCommentLike = (commentId: string, userId: string, likesCount: number) => {
  try {
    batchEmit("comment:like", { commentId, userId, likesCount });
  } catch (error: any) {
    logger.error("Failed to emit comment:like", { error: error.message });
  }
};

export const emitCommentUnlike = (commentId: string, userId: string, likesCount: number) => {
  try {
    batchEmit("comment:unlike", { commentId, userId, likesCount });
  } catch (error: any) {
    logger.error("Failed to emit comment:unlike", { error: error.message });
  }
};

export const emitPostCreated = (post: any) => {
  try {
    batchEmit("post:created", post);
  } catch (error: any) {
    logger.error("Failed to emit post:created", { error: error.message });
  }
};

export const emitPostDeleted = (postId: string) => {
  try {
    batchEmit("post:deleted", postId);
  } catch (error: any) {
    logger.error("Failed to emit post:deleted", { error: error.message });
  }
};

export const emitPostUpdated = (post: any) => {
  try {
    batchEmit("post:updated", post);
  } catch (error: any) {
    logger.error("Failed to emit post:updated", { error: error.message });
  }
};

export const emitCommentUpdated = (comment: any) => {
  try {
    batchEmit("comment:updated", comment);
  } catch (error: any) {
    logger.error("Failed to emit comment:updated", { error: error.message });
  }
};

export const emitCommentDeleted = (postId: string, commentId: string, commentsCount: number) => {
  try {
    batchEmit("comment:deleted", { postId, commentId, commentsCount });
  } catch (error: any) {
    logger.error("Failed to emit comment:deleted", { error: error.message });
  }
};

export const emitFollowUser = (targetUserId: string, followerId: string, followersCount: number) => {
  try {
    batchEmit("user:follow", { targetUserId, followerId, followersCount });
  } catch (error: any) {
    logger.error("Failed to emit user:follow", { error: error.message });
  }
};

export const emitUnfollowUser = (targetUserId: string, followerId: string, followersCount: number) => {
  try {
    batchEmit("user:unfollow", { targetUserId, followerId, followersCount });
  } catch (error: any) {
    logger.error("Failed to emit user:unfollow", { error: error.message });
  }
};

export const emitPostShare = (postId: string, sharesCount: number) => {
  try {
    batchEmit("post:share", { postId, sharesCount });
  } catch (error: any) {
    logger.error("Failed to emit post:share", { error: error.message });
  }
};

export const emitUserShare = (userId: string, sharesCount: number) => {
  try {
    batchEmit("user:share", { userId, sharesCount });
  } catch (error: any) {
    logger.error("Failed to emit user:share", { error: error.message });
  }
};

/**
 * Emits a comment reaction event (add or remove).
 */
export const emitCommentReaction = (
  commentId: string,
  payload: { reaction: any; type: "add" | "remove" }
) => {
  try {
    batchEmit("comment:reaction", { commentId, ...payload });
  } catch (error: any) {
    logger.error("Failed to emit comment:reaction", { error: error.message, commentId });
  }
};

/**
 * Emits a message reaction event (add or remove) to the conversation room,
 * AND to each participant's personal room so the reaction is received even when
 * the other user is not actively viewing the conversation.
 */
export const emitMessageReaction = async (
  conversationId: string,
  payload: { messageId: string; reaction: any; type: "add" | "remove" },
  participantIds?: string[]
) => {
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
  } catch (error: any) {
    logger.error("Failed to emit message:reaction", { error: error.message, conversationId });
  }
};

export const emitPostView = (postId: string, viewsCount: number) => {
  try {
    batchEmit("post:view", { postId, viewsCount });
  } catch (error: any) {
    logger.error("Failed to emit post:view", { error: error.message });
  }
};

export const emitUserView = (userId: string, viewsCount: number) => {
  try {
    batchEmit("user:view", { userId, viewsCount });
  } catch (error: any) {
    logger.error("Failed to emit user:view", { error: error.message });
  }
};

export const emitPostPin = (postId: string, userId: string) => {
  try {
    batchEmit("post:pin", { postId, userId });
  } catch (error: any) {
    logger.error("Failed to emit post:pin", { error: error.message });
  }
};

export const emitPostUnpin = (postId: string, userId: string) => {
  try {
    batchEmit("post:unpin", { postId, userId });
  } catch (error: any) {
    logger.error("Failed to emit post:unpin", { error: error.message });
  }
};

// ─── Chat Feature Socket Helpers ─────────────────────────────────────

/**
 * Checks if the recipient of a message is actively in the conversation room.
 * This is used to determine if the message should be marked 'seen' immediately.
 */
export const isRecipientActiveInConversation = async (
  conversationId: string,
  recipientId: string
): Promise<boolean> => {
  try {
    const sockets = await io.in(`user:${recipientId}`).fetchSockets();
    for (const s of sockets) {
      if ((s as any).data?.activeConversationId === conversationId) {
        return true;
      }
    }
  } catch (error: any) {
    logger.error("Error checking recipient active status", {
      error: error.message,
      conversationId,
      recipientId,
    });
  }
  return false;
};

/**
 * Fetches user online status from Redis.
 */
export const getUserPresenceStatus = async (userId: string): Promise<string> => {
  try {
    const presence = await getCache<string>(`presence:user:${userId}`);
    return presence || "offline";
  } catch (error: any) {
    logger.error("Error fetching user presence status", {
      error: error.message,
      userId,
    });
    return "offline";
  }
};

/**
 * Fetches multiple user online statuses in a single batch MGET command.
 */
export const getUserPresenceStatuses = async (userIds: string[]): Promise<Record<string, string>> => {
  if (userIds.length === 0) return {};
  try {
    const keys = userIds.map((id) => `presence:user:${id}`);
    const results = await redis.mget<string[]>(...keys);
    const presenceMap: Record<string, string> = {};
    userIds.forEach((id, idx) => {
      presenceMap[id] = results[idx] || "offline";
    });
    return presenceMap;
  } catch (error: any) {
    logger.error("Error fetching batch user presence statuses", {
      error: error.message,
      userIds,
    });
    const fallbackMap: Record<string, string> = {};
    userIds.forEach((id) => {
      fallbackMap[id] = "offline";
    });
    return fallbackMap;
  }
};

/**
 * Emits a user profile update event to notify all connected clients.
 * Also emits to all of the user's conversation rooms so participant data
 * (name, profile pic, etc.) is updated in real-time for chat partners.
 */
export const emitUserUpdated = async (user: any) => {
  try {
    // 1. Broadcast to all connected clients (for profile views, etc.)
    batchEmit("user:updated", user);
    
    // 2. Also emit to each conversation the user is in, so chat partners
    //    see updated name/profile pic immediately
    if (user._id) {
      const conversations = await Conversation.find({ participants: user._id }).select("_id").lean();
      for (const conv of conversations) {
        io.to(`conversation:${conv._id.toString()}`).emit("user:updated", user);
      }
    }
  } catch (error: any) {
    logger.error("Failed to emit user:updated", { error: error.message });
  }
};

/**
 * Emits an account deletion event so other clients know to clean up.
 */
export const emitAccountDeleted = (userId: string) => {
  try {
    io.emit("account:deleted", { userId });
  } catch (error: any) {
    logger.error("Failed to emit account:deleted", { error: error.message });
  }
};

/**
 * Emits a new message event to the conversation room.
 */
export const emitNewMessage = (conversationId: string, message: any) => {
  try {
    io.to(`conversation:${conversationId}`).emit("message:new", message);
  } catch (error: any) {
    logger.error("Failed to emit message:new", { error: error.message, conversationId });
  }
};

/**
 * Emits a message edit event to the conversation room.
 */
export const emitMessageEdit = (conversationId: string, message: any, participantIds?: string[]) => {
  try {
    io.to(`conversation:${conversationId}`).emit("message:edit", message);
    
    // Also emit to each participant's personal room so the conversations list updates
    // when they are not actively viewing this conversation
    if (participantIds && participantIds.length > 0) {
      for (const pId of participantIds) {
        io.to(`user:${pId}`).emit("message:edit", message);
      }
    }
  } catch (error: any) {
    logger.error("Failed to emit message:edit", { error: error.message, conversationId });
  }
};	/**
 * Emits a message deletion event to the conversation room and each participant's personal room.
 * Broadcasting to personal rooms ensures the conversation list updates even when the user
 * is not actively viewing the conversation.
 */
export const emitMessageDelete = (conversationId: string, messageId: string, participantIds?: string[]) => {
  try {
    io.to(`conversation:${conversationId}`).emit("message:delete", { messageId });
    
    // Also emit to each participant's personal room so the conversation list updates
    // when they are not actively viewing this conversation
    if (participantIds && participantIds.length > 0) {
      for (const pId of participantIds) {
        io.to(`user:${pId}`).emit("message:delete", { messageId });
      }
    }
  } catch (error: any) {
    logger.error("Failed to emit message:delete", { error: error.message, conversationId, messageId });
  }
};

/**
 * Emits a delete-for-me event so the deleting user's client hides the message.
 */
export const emitMessageDeleteForMe = (conversationId: string, messageId: string, deletedByUserId: string) => {
  try {
    io.to(`conversation:${conversationId}`).emit("message:delete-for-me", { messageId, deletedByUserId });
  } catch (error: any) {
    logger.error("Failed to emit message:delete-for-me", { error: error.message, conversationId, messageId });
  }
};

/**
 * Emits a live chat notification to a user's personal room when they are not viewing the active chat.
 */
export const emitChatNotification = (recipientId: string, payload: any) => {
  try {
    io.to(`user:${recipientId}`).emit("chat:notification", payload);
  } catch (error: any) {
    logger.error("Failed to emit chat:notification", { error: error.message, recipientId });
  }
};

/**
 * Forcefully disconnects all active socket instances for a specific user ID (e.g. when banned).
 */
export const disconnectUserSockets = (userId: string) => {
  try {
    if (io) {
      io.in(`user:${userId}`).disconnectSockets(true);
    }
  } catch (error: any) {
    logger.error("Failed to disconnect user sockets", { error: error.message, userId });
  }
};

// ─── Graceful shutdown ───────────────────────────────────────────────
export const shutdownSocket = async (): Promise<void> => {
  logger.info("Shutting down Socket.io...");
  
  // Disconnect Redis adapter clients
  if (redisPubClient) {
    try {
      await redisPubClient.quit();
      logger.info("Redis pubClient disconnected.");
    } catch (err) {
      logger.warn("Error disconnecting Redis pubClient:", { error: err instanceof Error ? err.message : String(err) });
    }
    redisPubClient = null;
  }
  if (redisSubClient) {
    try {
      await redisSubClient.quit();
      logger.info("Redis subClient disconnected.");
    } catch (err) {
      logger.warn("Error disconnecting Redis subClient:", { error: err instanceof Error ? err.message : String(err) });
    }
    redisSubClient = null;
  }
  
  // Close Socket.io server
  if (io) {
    io.close(() => {
      logger.info("Socket.io server closed.");
    });
  }
};
