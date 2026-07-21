// Trigger file change again
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { validateEnv } from "./configs/env";
import { connectDB } from "./db/db";
import { initSocket, shutdownSocket } from "./configs/socket";
import { redis } from "./configs/redis";
import { authRoutes } from "./routes/auth.routes";
import { passwordRoutes } from "./routes/password.routes";
import { userRoutes } from "./routes/user.routes";
import { postRoutes } from "./routes/post.routes";
import { commentRoutes } from "./routes/comment.routes";
import { likeRoutes } from "./routes/like.routes";
import { followRoutes } from "./routes/follow.routes";
import { saveRoutes } from "./routes/saves.routes";
import { repostRoutes } from "./routes/repost.routes";
import { searchRoutes } from "./routes/search.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { chatRoutes } from "./routes/chat.routes";
import { glimpseRoutes } from "./routes/glimpse.routes";
import { communityRoutes } from "./routes/community.routes";
import { collectionRoutes } from "./routes/collection.routes";
import { streakRoutes } from "./routes/streak.routes";
import { audioRoomRoutes } from "./routes/audioRoom.routes";
import { inviteRoutes } from "./routes/invite.routes";
import { reportRoutes } from "./routes/report.routes";
import { feedRoutes } from "./routes/feed.routes";
import { pushRoutes } from "./routes/push.routes";
import blockRoutes from "./routes/block.routes";
import missionRoutes from "./routes/dailyMission.routes";
import xpRoutes from "./routes/xp.routes";
import linkPreviewRoutes from "./routes/linkPreview.routes";
import translationRoutes from "./routes/translation.routes";
import leaderboardRoutes from "./routes/leaderboard.routes";
import { adminRoutes } from "./routes/admin.routes";

import { startAffinityScheduler, startNotificationPruner } from "./configs/scheduler";
import trendRoutes from "./routes/trending.routes";
import analyticsRoutes from "./routes/analytics.routes";
import feedForYouRoutes from "./routes/feedForYou.routes";
import moderationRoutes from "./routes/moderation.routes";
import dataExportRoutes from "./routes/dataExport.routes";
import webhookRoutes from "./routes/webhook.routes";
import apiKeyRoutes from "./routes/apiKey.routes";
import bulkOpRoutes from "./routes/bulkOperations.routes";
import groupRoutes from "./routes/group.routes";
import { AppError } from "./utilities/errors";
import { logger } from "./utilities/logger";
import { cookieOptions } from "./configs/cookie";
import { csrfProtection } from "./middlewares/csrf.middleware";
import { generalLimiter } from "./middlewares/ratelimit.middleware";

// ─── Monitoring & Documentation ────────────────────────────────────
import { initSentry, sentryErrorHandler } from "./configs/sentry";
import { setupSwagger } from "./configs/swagger";

// ─── CLUSTERING (multi-core) ────────────────────────────────────
// Fork one worker per CPU core. Each worker shares the same port.
// If clustering is disabled or only 1 CPU, runs in single-process mode.
//
// The primary process forks workers and then exits without starting the server.
// Workers and single-process mode continue to the full app setup below.
import cluster from "cluster";
import os from "os";

// Cluster mode: ONLY in production, NEVER in development/dev mode.
// tsx --watch cannot fork workers (causes EPIPE crashes), and clustering
// adds unneeded complexity for local development.
const isClusterEnabled = process.env.NODE_ENV === "production" && process.env.CLUSTER_ENABLED !== "false";
const numCPUs = Math.min(os.cpus().length, parseInt(process.env.CLUSTER_MAX_WORKERS || "2", 10));

if (isClusterEnabled && cluster.isPrimary && numCPUs > 1) {
  logger.info(`Primary process starting ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
    cluster.fork();
  });

  cluster.on("online", (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });

  // Primary exits — workers handle their own graceful shutdown
  process.exit(0);
}

// ─── Worker or single-process mode starts here ───────────────────
if (!cluster.isPrimary) {
  logger.info(`Worker ${process.pid} started`);
}

// ─── Global process-level error handlers ──────────────────────────
process.on(
	"unhandledRejection",
	(reason: unknown, promise: Promise<unknown>) => {
		logger.error("Unhandled Promise Rejection", {
			error: reason instanceof Error ? reason.message : String(reason),
			stack: reason instanceof Error ? reason.stack : undefined,
		});
	},
);

process.on("uncaughtException", (error: Error) => {
	logger.error("Uncaught Exception", {
		error: error.message,
		stack: error.stack,
	});
	// Give logger time to flush, then exit
	setTimeout(() => process.exit(1), 1000);
});

const env = validateEnv();

const app = express();
const server = http.createServer(app);
const port = env.PORT;
app.set("trust proxy", 1);

// ─── Sentry initialization (must be first) ─────────────────────────
initSentry();

// Compression: skip payloads under 1 KB (small responses don't benefit)
app.use(compression({ threshold: 1024 }));

// HTTP Keep-Alive tuning
server.keepAliveTimeout = 65000; // 65 seconds (default is 5s)
server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

// ─── Graceful Shutdown ────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed.");

    // Disconnect Socket.IO
    try {
      await shutdownSocket();
    } catch (err: any) {
      logger.error("Socket shutdown error", { error: err.message });
    }

    // Disconnect MongoDB
    try {
      await mongoose.disconnect();
      logger.info("MongoDB disconnected.");
    } catch (err: any) {
      logger.error("MongoDB disconnect error", { error: err.message });
    }

    logger.info("Graceful shutdown complete. Exiting.");
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 30000); // 30 second timeout
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

app.use(
	cors({
		origin: (
			origin: string | undefined,
			callback: (err: Error | null, allow?: boolean) => void,
		) => {
			// Allow requests with no origin (like direct GET requests, health checks, or curl)
			if (!origin) {
				callback(null, true);
				return;
			}

			const originWithoutSlash = origin.replace(/\/$/, "");

			// In development, allow any localhost origin (Vite can pick any port)
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

			// Also check the configured CLIENT_URL explicitly
			if (originWithoutSlash === env.CLIENT_URL.replace(/\/$/, "")) {
				callback(null, true);
				return;
			}

			// Log rejected origin for debugging, then deny
			logger.warn("CORS blocked origin", { origin: originWithoutSlash });
			callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
		maxAge: 86400, // cache pre-flight for 24 hours
	}),
);

app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" },
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				styleSrc: [
					"'self'",
					"'unsafe-inline'",
					"https://fonts.googleapis.com",
				],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				imgSrc: [
					"'self'",
					"data:",
					"blob:",
					"https://res.cloudinary.com",
					"https://images.unsplash.com",
				],
				connectSrc: [
					"'self'",
					"https://res.cloudinary.com",
					env.CLIENT_URL,
				],
				// WebSocket connections to the server are implicitly allowed via "'self'"
				mediaSrc: ["'self'", "blob:", "data:"],
				frameAncestors: ["'none'"],
				formAction: ["'self'"],
				objectSrc: ["'none'"],
				baseUri: ["'self'"],
			},
		},
		hsts: {
			maxAge: 31536000,
			includeSubDomains: true,
			preload: true,
		},
		noSniff: true,
		referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	}),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Request ID Middleware — must run before timeout & logging middlewares
app.use((req: Request, res: Response, next: NextFunction) => {
	req.requestId = randomUUID();
	next();
});

// Request Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		logger.info(`${req.method} ${req.path}`, {
			requestId: req.requestId,
			method: req.method,
			path: req.path,
			statusCode: res.statusCode,
			durationMs: duration,
		});
	});
	next();
});

// Enhanced Health Check with detailed system metrics
app.get("/api/health", async (req: Request, res: Response) => {
	const start = Date.now();
	try {
		let dbStatus = "disconnected";
		let dbState = mongoose.connection.readyState;
		const stateMap: Record<number, string> = {
			0: "disconnected",
			1: "connected",
			2: "connecting",
			3: "disconnecting",
		};
		dbStatus = stateMap[dbState] || "unknown";

		let redisStatus = "disconnected";
		let redisLatencyMs = -1;
		try {
			const redisStart = Date.now();
			await redis.ping();
			redisLatencyMs = Date.now() - redisStart;
			redisStatus = "connected";
		} catch {
			redisStatus = "disconnected";
		}

		const allHealthy = dbState === 1 && redisStatus === "connected";
		const memoryUsage = process.memoryUsage();

		return res.status(allHealthy ? 200 : 503).json({
			success: allHealthy,
			message: allHealthy ? "Server is healthy!" : "Server is unhealthy!",
			timestamp: new Date().toISOString(),
			requestId: req.requestId,
			uptime: process.uptime(),
			checks: {
				database: {
					status: dbStatus,
					state: dbState,
				},
				redis: {
					status: redisStatus,
					latencyMs: redisLatencyMs,
				},
			},
			memory: {
				rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB",
				heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
				heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB",
			},
			responseTimeMs: Date.now() - start,
		});
	} catch (err: any) {
		logger.error("Health check failed", { error: err.message });
		return res.status(503).json({
			success: false,
			message: "Server is unhealthy!",
			timestamp: new Date().toISOString(),
			requestId: req.requestId,
		});
	}
});

// Global rate limiter — baseline protection for all API routes
// Individual route limiters (authLimiter, etc.) apply stricter limits on top
app.use("/api", generalLimiter);

// CSRF protection — double-submit cookie pattern for state-changing requests
// API routes (mounted after CSRF middleware so they inherit the protection)
app.use(csrfProtection);

// api routes
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/saves", saveRoutes);
app.use("/api/reposts", repostRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/glimpses", glimpseRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/streaks", streakRoutes);
app.use("/api/rooms", audioRoomRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// Feed routes (ranked, Instagram-style feed)
app.use("/api/feed", feedRoutes);

// Push notification subscription routes
app.use("/api/push", pushRoutes);
app.use("/api/blocks", blockRoutes);

// Daily Missions routes
app.use("/api/missions", missionRoutes);

// XP routes
app.use("/api/xp", xpRoutes);

// Link Preview routes
app.use("/api/link-preview", linkPreviewRoutes);

// Translation routes
app.use("/api/translate", translationRoutes);

// Leaderboard routes
app.use("/api/leaderboard", leaderboardRoutes);

// Trending routes (users + topics)
app.use("/api/trending", trendRoutes);

// Analytics dashboard routes
app.use("/api/analytics", analyticsRoutes);

// For You feed (affinity-based) — route already includes /for-you
app.use("/api/feed", feedForYouRoutes);

// Moderation queue routes
app.use("/api/moderation", moderationRoutes);

// Data export routes
app.use("/api/export", dataExportRoutes);

// Webhook routes
app.use("/api/webhooks", webhookRoutes);

// Developer API key routes
app.use("/api/developer", apiKeyRoutes);

// Bulk operations routes
app.use("/api/bulk", bulkOpRoutes);

// Group chat routes
app.use("/api/chats/groups", groupRoutes);

// ─── Swagger API Documentation ───────────────────────────────────
setupSwagger(app);

// ─── Sentry Error Handler (before global handler) ────────────────
app.use(sentryErrorHandler as any);

// 404 Handler
app.use((req: Request, res: Response) => {
	return res.status(404).json({
		success: false,
		message: `Route ${req.originalUrl} not found!`,
		requestId: req.requestId,
	});
});

/** Error shape from known libraries */
interface ZodIssue {
	path: (string | number)[];
	message: string;
}

interface MongoError extends Error {
	code?: number;
	keyPattern?: Record<string, unknown>;
	issues?: ZodIssue[];
}

// Global Error Handler
app.use((err: MongoError, req: Request, res: Response, _next: NextFunction) => {
	const message = err.message || "Internal Server Error";
	logger.error(message, {
		requestId: req.requestId,
		stack: err.stack,
	});

	let statusCode = 500;
	let responseMessage = message;
	let errors: { field: string; message: string }[] = [];

	// Handle Zod errors specifically
	if (err.name === "ZodError" && err.issues) {
		statusCode = 400;
		errors = err.issues.map((issue) => ({
			field: issue.path.join("."),
			message: issue.message,
		}));
		responseMessage = errors[0]?.message || "Validation failed";
	} else if (err instanceof AppError) {
		statusCode = err.statusCode;
		responseMessage = err.message;
	} else if (err.name === "ValidationError") {
		statusCode = 400;
		responseMessage = message;
	} else if (
		(err.name === "MongoError" || err.name === "MongoServerError") &&
		err.code === 11000
	) {
		statusCode = 409;
		const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : null;
		responseMessage = field ? `${field} already exists` : "Duplicate field value";
	}

	return res.status(statusCode).json({
		success: false,
		message: responseMessage,
		...(errors.length > 0 && { errors }),
		requestId: req.requestId,
		...(env.NODE_ENV === "development" && { stack: err.stack }),
	});
});

connectDB().then(async () => {
	await initSocket(server);

	// Start background affinity recomputation for feed ranking
	startAffinityScheduler();

	// Start daily pruner for read notifications older than 30 days
	startNotificationPruner();

	server.listen(port, () => {
		logger.info(`Server is running on PORT: ${port}`);
	});
});
