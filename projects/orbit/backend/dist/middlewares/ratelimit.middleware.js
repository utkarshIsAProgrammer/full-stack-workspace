"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLimiter = exports.searchLimiter = exports.generalLimiter = exports.notificationLimiter = exports.interactionLimiter = exports.commentLimiter = exports.otpLimiter = exports.authLimiter = void 0;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("../configs/redis");
const logger_1 = require("../utilities/logger");
const getClientIp = (req) => {
    // Use Express's built-in req.ip which correctly handles X-Forwarded-For 
    // when app.set('trust proxy', 1) is configured in server.ts
    return req.ip || req.socket?.remoteAddress || "unknown";
};
const createRateLimiter = (maxRequests, windowMs, message) => {
    const ratelimit = new ratelimit_1.Ratelimit({
        redis: redis_1.redis,
        limiter: ratelimit_1.Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
        prefix: "ratelimit",
    });
    return async (req, res, next) => {
        try {
            const identifier = getClientIp(req);
            const { success, reset, limit, remaining } = await ratelimit.limit(identifier);
            // Set standard rate limiting headers
            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', remaining.toString());
            if (!success) {
                // Calculate retry-after time in seconds
                const retryAfter = Math.ceil((reset - Date.now()) / 1000);
                res.setHeader('Retry-After', retryAfter.toString());
                logger_1.logger.warn(`Rate limit exceeded for ${identifier} on ${req.method} ${req.path}`, {
                    identifier,
                    method: req.method,
                    path: req.path,
                    limit,
                    reset,
                });
                return res.status(429).json({
                    success: false,
                    message,
                    retryAfter, // Also include it in the response body for easier parsing
                });
            }
            next();
        }
        catch (error) {
            // On Redis error, allow the request through but log the issue
            logger_1.logger.warn("Rate limiting unavailable due to Redis error, allowing request through", {
                error: error instanceof Error ? error.message : String(error),
            });
            next();
        }
    };
};
// auth limiter
exports.authLimiter = createRateLimiter(50, // Increased from 20 to 50
15 * 60 * 1000, "Too many login/signup attempts. Please try after some time.");
// otp limiter
exports.otpLimiter = createRateLimiter(10, // Increased from 5 to 10
10 * 60 * 1000, "Too many OTP requests. Please try after some time.");
// comments limiter
exports.commentLimiter = createRateLimiter(100, // Increased from 20 to 100
60 * 1000, "Too many comment requests. Please try after some time.");
// interaction limiter
exports.interactionLimiter = createRateLimiter(200, // Increased from 30 to 200
60 * 1000, "Too many actions performed. Please try after some time.");
// notification read limiter
exports.notificationLimiter = createRateLimiter(200, // Increased from 40 to 200
60 * 1000, "Too many notification requests. Please try after some time.");
// general limiter for all other requests
exports.generalLimiter = createRateLimiter(1000, // Increased from 100 to 1000
15 * 60 * 1000, "Too many requests. Please try after some time.");
// search limiter
exports.searchLimiter = createRateLimiter(100, // Increased from 30 to 100
60 * 1000, "Too many search requests. Please try after some time.");
// upload limiter
exports.uploadLimiter = createRateLimiter(50, // Increased from 10 to 50
60 * 1000, "Too many upload requests. Please try after some time.");
//# sourceMappingURL=ratelimit.middleware.js.map