import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, UserDocument } from "../models/user.model";
import { env } from "../configs/env";
import { getCache, setCache } from "../configs/cache";

type JwtPayload = {
  userId: string;
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // get token from cookies or Authorization header
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token",
      });
    }

    // verify the token is using secret key
    const decoded = jwt.verify(
      token,
      env.JWT_SECRET,
      {
        issuer: "orbit",
        audience: "orbit-users",
      }
    ) as JwtPayload;

    // fetch user from cache or db and exclude password field
    const cacheKey = `auth:user:${decoded.userId}`;
    let user = await getCache<any>(cacheKey);

    if (!user) {
      user = await User.findById(decoded.userId).select("-password").lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found!",
        });
      }

      // cache for 5 minutes
      await setCache(cacheKey, user, 300);
    }

    // attach user to request object
    req.user = user;

    next();
  } catch (err: any) {
    let message = "Invalid token!";
    if (err instanceof jwt.TokenExpiredError) {
      message = "Token expired!";
    } else if (err instanceof jwt.JsonWebTokenError) {
      message = "Invalid token!";
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
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(
      token,
      env.JWT_SECRET,
      {
        issuer: "orbit",
        audience: "orbit-users",
      }
    ) as JwtPayload;

    const cacheKey = `auth:user:${decoded.userId}`;
    let user = await getCache<any>(cacheKey);

    if (!user) {
      user = await User.findById(decoded.userId).select("-password").lean();
      if (user) {
        await setCache(cacheKey, user, 300);
      }
    }

    if (user) {
      req.user = user;
    }

    next();
  } catch (err) {
    // silently ignore token errors for optional auth
    next();
  }
};
