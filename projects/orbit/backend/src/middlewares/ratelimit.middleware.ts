import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../configs/redis";
import { logger } from "../utilities/logger";
import type { Request, Response, NextFunction } from "express";

type RateLimiter = ReturnType<typeof createRateLimiter>;

const getClientIp = (req: Request): string => {
  // Use Express's built-in req.ip which correctly handles X-Forwarded-For 
  // when app.set('trust proxy', 1) is configured in server.ts
  return req.ip || req.socket?.remoteAddress || "unknown";
};

const createRateLimiter = (maxRequests: number, windowMs: number, message: string) => {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
    prefix: "ratelimit",
  });

  return async (req: Request, res: Response, next: NextFunction) => {
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
        
        logger.warn(`Rate limit exceeded for ${identifier} on ${req.method} ${req.path}`, {
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
    } catch (error) {
      // On Redis error, allow the request through but log the issue
      logger.warn("Rate limiting unavailable due to Redis error, allowing request through", {
        error: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
};

// auth limiter
export const authLimiter: RateLimiter = createRateLimiter(
  50, // Increased from 20 to 50
  15 * 60 * 1000,
  "Too many login/signup attempts. Please try after some time.",
);

// otp limiter
export const otpLimiter: RateLimiter = createRateLimiter(
  10, // Increased from 5 to 10
  10 * 60 * 1000,
  "Too many OTP requests. Please try after some time.",
);

// comments limiter
export const commentLimiter: RateLimiter = createRateLimiter(
  100, // Increased from 20 to 100
  60 * 1000,
  "Too many comment requests. Please try after some time.",
);

// interaction limiter
export const interactionLimiter: RateLimiter = createRateLimiter(
  200, // Increased from 30 to 200
  60 * 1000,
  "Too many actions performed. Please try after some time.",
);

// notification read limiter
export const notificationLimiter: RateLimiter = createRateLimiter(
  200, // Increased from 40 to 200
  60 * 1000,
  "Too many notification requests. Please try after some time.",
);

// general limiter for all other requests
export const generalLimiter: RateLimiter = createRateLimiter(
  1000, // Increased from 100 to 1000
  15 * 60 * 1000,
  "Too many requests. Please try after some time.",
);

// search limiter
export const searchLimiter: RateLimiter = createRateLimiter(
  100, // Increased from 30 to 100
  60 * 1000,
  "Too many search requests. Please try after some time.",
);

// upload limiter
export const uploadLimiter: RateLimiter = createRateLimiter(
  50, // Increased from 10 to 50
  60 * 1000,
  "Too many upload requests. Please try after some time.",
);
