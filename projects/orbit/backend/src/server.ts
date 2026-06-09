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
import { initSocket } from "./configs/socket";
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

import { AppError } from "./utilities/errors";
import { logger } from "./utilities/logger";
import { cookieOptions } from "./configs/cookie";
import { csrfProtection } from "./middlewares/csrf.middleware";
import { generalLimiter } from "./middlewares/ratelimit.middleware";

// ─── Global process-level error handlers ──────────────────────────
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error("Unhandled Promise Rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

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
const allowedOrigins = env.NODE_ENV === "development"
  ? [
    env.CLIENT_URL.replace(/\/$/, ""),
    "http://localhost:5173",
    "http://localhost:5174",
  ].filter(Boolean)
  : [env.CLIENT_URL.replace(/\/$/, "")].filter(Boolean);

app.set("trust proxy", 1);

app.use(compression());

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like direct GET requests, health checks, or curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      const originWithoutSlash = origin.replace(/\/$/, "");
      if (
        allowedOrigins.includes(originWithoutSlash) ||
        originWithoutSlash.endsWith(".vercel.app") ||
        originWithoutSlash.startsWith("http://localhost:")
      ) {
        callback(null, true);
        return;
      }
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com"],
        connectSrc: ["'self'", "https://res.cloudinary.com", env.CLIENT_URL],
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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
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



// Health Check
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    let dbStatus = "connected";
    let redisStatus = "connected";

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      dbStatus = "disconnected";
    }

    // Check Redis connection
    try {
      await redis.ping();
    } catch (redisErr) {
      redisStatus = "disconnected";
    }

    const allHealthy = dbStatus === "connected" && redisStatus === "connected";

    return res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      message: allHealthy ? "Server is healthy!" : "Server is unhealthy!",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
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

// 404 Handler
app.use((req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found!`,
    requestId: req.requestId,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, {
    requestId: req.requestId,
    stack: err.stack,
  });

  let statusCode = 500;
  let message = "Internal Server Error";
  let errors: any[] = [];

  // Handle Zod errors specifically
  if (err.name === "ZodError") {
    statusCode = 400;
    errors = err.issues.map((issue: any) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    // Use the first error as the main message, or combine them
    message = errors[0]?.message || "Validation failed";
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  } else if ((err.name === "MongoError" || err.name === "MongoServerError") && err.code === 11000) {
    statusCode = 409;
    // Extract the field from the error message for better UX
    const field = Object.keys(err.keyPattern || {})[0];
    message = field ? `${field} already exists` : "Duplicate field value";
  }

  // Standardised error response shape
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    requestId: req.requestId,
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

connectDB().then(() => {
  initSocket(server);
  server.listen(port, () => {
    logger.info(`Server is running on PORT: ${port}`);
  });
});
