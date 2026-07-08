import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";
import { sendWelcomeMail } from "../configs/nodeMailer";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../configs/cookie";
import { setCsrfCookie } from "../middlewares/csrf.middleware";

import cloudinary from "../configs/cloudinary";
import { env } from "../configs/env";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ConflictError } from "../utilities/errors";

// signup
export const signup = async (req: Request, res: Response) => {
  const result = signupSchema.safeParse(req.body);

  const cleanupFiles = async (filesObj: any) => {
    if (!filesObj) return;
    const files = filesObj as { [fieldname: string]: any[] };
    const pPic = files.profilePic?.[0];
    const bImg = files.bannerImage?.[0];

    if (pPic?.filename) {
      try { await cloudinary.uploader.destroy(pPic.filename); } catch (e) { logger.error("Cloudinary deletion failed", { error: e }); }
    }
    if (bImg?.filename) {
      try { await cloudinary.uploader.destroy(bImg.filename); } catch (e) { logger.error("Cloudinary deletion failed", { error: e }); }
    }
  };

  try {
    if (!result.success) {
      await cleanupFiles(req.files);
      throw new BadRequestError(result.error.issues[0]?.message || "Invalid data");
    }

    const files = req.files as { [fieldname: string]: any[] } | undefined;
    const profilePic = files?.profilePic?.[0];
    const bannerImage = files?.bannerImage?.[0];

    // check user exists
    const userExists = await User.findOne({
      $or: [{ email: result.data.email }, { username: result.data.username }],
    });

    if (userExists) {
      await cleanupFiles(req.files);
      if (userExists.email === result.data.email) {
        throw new ConflictError("Email already exists!");
      }
      throw new ConflictError("Username already exists!");
    }

    // Strip confirmPassword (validated via schema refine) before spreading into user document
    const { confirmPassword, ...validData } = result.data;
    // confirmPassword is intentionally excluded — it's used only for schema-level password match validation
    void confirmPassword;
    const userData: any = {
      ...validData,
      isEmailVerified: true,
    };

    if (profilePic) {
      userData.profilePic = {
        url: profilePic.path,
        public_id: profilePic.filename,
      };
    }

    if (bannerImage) {
      userData.bannerImage = {
        url: bannerImage.path,
        public_id: bannerImage.filename,
      };
    }

    // create and save new user
    const user = new User(userData);
    await user.save();

    // generate jwt and set cookie
    const token = user?.signToken();
    res.cookie("jwt", token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Set CSRF protection cookie
    setCsrfCookie(res);

    void sendWelcomeMail({
      email: user.email,
      username: user.username,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully!",
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        bio: user.bio,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    await cleanupFiles(req.files);
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the signup controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// login
export const login = async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  try {
    // validate input
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0]?.message || "Invalid data");
    }

    // check existing jwt cookie
    const existingToken = req.cookies?.jwt;

    if (existingToken) {
      try {
        jwt.verify(existingToken, env.JWT_SECRET, {
          issuer: "orbit",
          audience: "orbit-users",
        });

        throw new BadRequestError("You are already logged in!");
      } catch (err: any) {
        logger.info(`Invalid/expired token!`, { error: err.message });
        res.clearCookie("jwt", { ...cookieOptions, path: "/" });
      }
    }

    // find user by email OR username
    const user = await User.findOne({
      $or: [
        { email: result.data.usernameOrEmail },
        { username: result.data.usernameOrEmail }
      ]
    });

    if (!user) {
      throw new NotFoundError("User doesn't exist!");
    }

    // verify password
    const isMatch = await user.comparePassword(result.data.password);

    if (!isMatch) {
      logger.warn(`Failed login attempt`, { userId: user._id });
      throw new UnauthorizedError("Invalid credentials!");
    }

    // generate jwt
    const token = user.signToken();

    // set cookie
    res.cookie("jwt", token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Set CSRF protection cookie
    setCsrfCookie(res);

    // response
    return res.status(200).json({
      success: true,
      message: "User logged in successfully!",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        gender: user.gender,
        bio: user.bio,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the login controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get current user (me)
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    const user = await User.findById(userId).select("-password -otp -otpExpiry");
    if (!user) {
      throw new NotFoundError("User not found!");
    }

    const token = req.cookies?.jwt;
    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        bio: user.bio,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the getCurrentUser controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// logout
export const logout = async (req: Request, res: Response) => {
  try {
    // clear cookies
    res.clearCookie("jwt", { ...cookieOptions, path: "/" });
    res.clearCookie("csrf-token", { path: "/", secure: env.NODE_ENV === "production", sameSite: "lax" });
    res.status(200).json({
      success: true,
      message: "User logged out successfully!",
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the logout controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
