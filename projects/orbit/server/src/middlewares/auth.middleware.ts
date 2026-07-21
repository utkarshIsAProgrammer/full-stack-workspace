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
 * Resolve a user from cache or database.
 * Returns null if not found.
 */
async function resolveUser(userId: string): Promise<SafeUser | null> {
  const cacheKey = `auth:user:${userId}`;
  const cached = await getCache<SafeUser>(cacheKey);
  if (cached) return cached;

  const user = await User.findById(userId).select("-password").lean();
  if (!user) return null;

  // Cache for 5 minutes
  await setCache(cacheKey, user, 300);
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
