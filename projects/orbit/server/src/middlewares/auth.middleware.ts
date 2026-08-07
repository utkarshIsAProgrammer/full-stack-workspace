import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { env } from "../configs/env";
import { getCache, setCache } from "../configs/cache";
import { getErrorMessage } from "../types/global";

type JwtPayload = {
  userId: string;
};

/** Shape of the cached/returned user document (without password). */
interface SafeUser {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  profilePic?: { url: string; public_id: string };
  isBanned?: boolean;
  [key: string]: unknown;
}

/**
 * In-memory user cache (process-local).
 *
 * Upstash Redis is an HTTPS REST round-trip (~100-200ms on free tier) and
 * resolveUser runs on EVERY protected request — so without this, every
 * API call (feed, chat, search, …) pays that latency. An in-memory Map
 * with a short TTL makes repeated requests from the same user resolve in
 * microseconds while staying fresher than the 5-minute Redis cache.
 */
const memUserCache = new Map<
  string,
  { user: SafeUser; expiresAt: number }
>();
const MEM_USER_CACHE_TTL_MS = 60_000; // 60s
const MEM_USER_CACHE_MAX = 500;

/**
 * Remove a user from the in-memory cache — call alongside the Redis
 * `auth:user:` invalidation whenever profile / logout / ban state changes
 * so the next request reflects the change immediately.
 */
export function clearMemUserCache(userId: string): void {
  memUserCache.delete(userId);
}

function setMemUser(userId: string, user: SafeUser): void {
  if (memUserCache.size >= MEM_USER_CACHE_MAX) {
    const oldest = memUserCache.keys().next().value;
    if (oldest !== undefined) memUserCache.delete(oldest);
  }
  memUserCache.set(userId, { user, expiresAt: Date.now() + MEM_USER_CACHE_TTL_MS });
}

/**
 * Resolve a user from in-memory cache → Redis cache → database.
 * Returns null if not found.
 */
async function resolveUser(userId: string): Promise<SafeUser | null> {
  // 1. In-memory (fastest) — avoids the Upstash HTTPS round trip entirely.
  const mem = memUserCache.get(userId);
  if (mem && Date.now() < mem.expiresAt) return mem.user;

  const cacheKey = `auth:user:${userId}`;

  // 2. Redis cache (shared across instances).
  const cached = await getCache<SafeUser>(cacheKey);
  if (cached) {
    setMemUser(userId, cached);
    return cached;
  }

  // 3. Database fallback.
  const user = await User.findById(userId).select("-password").lean();
  if (!user) return null;

  // Cache for 5 minutes in Redis + 60s in memory
  await setCache(cacheKey, user, 300);
  setMemUser(userId, user as unknown as SafeUser);
  return user as unknown as SafeUser;
}

/**
 * Extract JWT token from cookie or Authorization header.
 */
function extractToken(req: Request): string | null {
  const fromCookie = req.cookies?.jwt;
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1] ?? null;
  }

  return null;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token",
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "orbit",
      audience: "orbit-users",
    }) as JwtPayload;

    const user = await resolveUser(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned!",
      });
    }

    req.user = user as any;
    next();
  } catch (err: any) {
    let message = "Invalid token!";
    if (err instanceof jwt.TokenExpiredError) {
      message = "Token expired!";
    } else if (err instanceof jwt.JsonWebTokenError) {
      message = getErrorMessage(err);
    }
    return res.status(401).json({
      success: false,
      message,
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: "orbit",
      audience: "orbit-users",
    }) as JwtPayload;

    const user = await resolveUser(decoded.userId);
    if (user && !user.isBanned) {
      req.user = user as any;
    }

    next();
  } catch (err: any) {
    // Silently ignore token errors for optional auth
    next();
  }
};
