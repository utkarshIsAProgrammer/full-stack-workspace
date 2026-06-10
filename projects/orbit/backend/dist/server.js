"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Trigger file change again
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const env_1 = require("./configs/env");
const db_1 = require("./db/db");
const socket_1 = require("./configs/socket");
const redis_1 = require("./configs/redis");
const auth_routes_1 = require("./routes/auth.routes");
const password_routes_1 = require("./routes/password.routes");
const user_routes_1 = require("./routes/user.routes");
const post_routes_1 = require("./routes/post.routes");
const comment_routes_1 = require("./routes/comment.routes");
const like_routes_1 = require("./routes/like.routes");
const follow_routes_1 = require("./routes/follow.routes");
const saves_routes_1 = require("./routes/saves.routes");
const repost_routes_1 = require("./routes/repost.routes");
const search_routes_1 = require("./routes/search.routes");
const notification_routes_1 = require("./routes/notification.routes");
const chat_routes_1 = require("./routes/chat.routes");
const errors_1 = require("./utilities/errors");
const logger_1 = require("./utilities/logger");
const csrf_middleware_1 = require("./middlewares/csrf.middleware");
const ratelimit_middleware_1 = require("./middlewares/ratelimit.middleware");
// ─── Global process-level error handlers ──────────────────────────
process.on("unhandledRejection", (reason, promise) => {
    logger_1.logger.error("Unhandled Promise Rejection", {
        error: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});
process.on("uncaughtException", (error) => {
    logger_1.logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
    });
    // Give logger time to flush, then exit
    setTimeout(() => process.exit(1), 1000);
});
const env = (0, env_1.validateEnv)();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const port = env.PORT;
const allowedOrigins = env.NODE_ENV === "development"
    ? [
        env.CLIENT_URL.replace(/\/$/, ""),
        "http://localhost:5173",
        "http://localhost:5174",
    ].filter(Boolean)
    : [env.CLIENT_URL.replace(/\/$/, "")].filter(Boolean);
app.set("trust proxy", 1);
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like direct GET requests, health checks, or curl)
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
    maxAge: 86400, // cache pre-flight for 24 hours
}));
app.use((0, helmet_1.default)({
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
}));
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ limit: "1mb", extended: true }));
app.use((0, cookie_parser_1.default)());
// Request ID Middleware — must run before timeout & logging middlewares
app.use((req, res, next) => {
    req.requestId = (0, crypto_1.randomUUID)();
    next();
});
// Request Logging Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger_1.logger.info(`${req.method} ${req.path}`, {
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
app.get("/api/health", async (req, res) => {
    try {
        let dbStatus = "connected";
        let redisStatus = "connected";
        // Check MongoDB connection
        if (mongoose_1.default.connection.readyState !== 1) {
            dbStatus = "disconnected";
        }
        // Check Redis connection
        try {
            await redis_1.redis.ping();
        }
        catch (redisErr) {
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
    }
    catch (err) {
        logger_1.logger.error("Health check failed", { error: err.message });
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
app.use("/api", ratelimit_middleware_1.generalLimiter);
// CSRF protection — double-submit cookie pattern for state-changing requests
// API routes (mounted after CSRF middleware so they inherit the protection)
app.use(csrf_middleware_1.csrfProtection);
// api routes
app.use("/api/auth", auth_routes_1.authRoutes);
app.use("/api/password", password_routes_1.passwordRoutes);
app.use("/api/users", user_routes_1.userRoutes);
app.use("/api/posts", post_routes_1.postRoutes);
app.use("/api/comments", comment_routes_1.commentRoutes);
app.use("/api/likes", like_routes_1.likeRoutes);
app.use("/api/follows", follow_routes_1.followRoutes);
app.use("/api/saves", saves_routes_1.saveRoutes);
app.use("/api/reposts", repost_routes_1.repostRoutes);
app.use("/api/search", search_routes_1.searchRoutes);
app.use("/api/notifications", notification_routes_1.notificationRoutes);
app.use("/api/chats", chat_routes_1.chatRoutes);
// 404 Handler
app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found!`,
        requestId: req.requestId,
    });
});
// Global Error Handler
app.use((err, req, res, next) => {
    logger_1.logger.error(err.message, {
        requestId: req.requestId,
        stack: err.stack,
    });
    let statusCode = 500;
    let message = "Internal Server Error";
    let errors = [];
    // Handle Zod errors specifically
    if (err.name === "ZodError") {
        statusCode = 400;
        errors = err.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
        // Use the first error as the main message, or combine them
        message = errors[0]?.message || "Validation failed";
    }
    else if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    else if (err.name === "ValidationError") {
        statusCode = 400;
        message = err.message;
    }
    else if ((err.name === "MongoError" || err.name === "MongoServerError") && err.code === 11000) {
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
(0, db_1.connectDB)().then(() => {
    (0, socket_1.initSocket)(server);
    server.listen(port, () => {
        logger_1.logger.info(`Server is running on PORT: ${port}`);
    });
});
//# sourceMappingURL=server.js.map