"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getCurrentUser = exports.login = exports.signup = void 0;
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const nodeMailer_1 = require("../configs/nodeMailer");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie_1 = require("../configs/cookie");
const csrf_middleware_1 = require("../middlewares/csrf.middleware");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
const env_1 = require("../configs/env");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
// signup
const signup = async (req, res) => {
    const result = user_schema_1.signupSchema.safeParse(req.body);
    const cleanupFiles = async (filesObj) => {
        if (!filesObj)
            return;
        const files = filesObj;
        const pPic = files.profilePic?.[0];
        const bImg = files.bannerImage?.[0];
        if (pPic?.filename) {
            try {
                await cloudinary_1.default.uploader.destroy(pPic.filename);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
        if (bImg?.filename) {
            try {
                await cloudinary_1.default.uploader.destroy(bImg.filename);
            }
            catch (e) {
                logger_1.logger.error("Cloudinary deletion failed", { error: e });
            }
        }
    };
    try {
        if (!result.success) {
            await cleanupFiles(req.files);
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid data");
        }
        const files = req.files;
        const profilePic = files?.profilePic?.[0];
        const bannerImage = files?.bannerImage?.[0];
        // check user exists
        const userExists = await user_model_1.User.findOne({
            $or: [{ email: result.data.email }, { username: result.data.username }],
        });
        if (userExists) {
            await cleanupFiles(req.files);
            if (userExists.email === result.data.email) {
                throw new errors_1.ConflictError("Email already exists!");
            }
            throw new errors_1.ConflictError("Username already exists!");
        }
        // Strip confirmPassword (validated via schema refine) before spreading into user document
        const { confirmPassword, ...validData } = result.data;
        // confirmPassword is intentionally excluded — it's used only for schema-level password match validation
        void confirmPassword;
        const userData = {
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
        const user = new user_model_1.User(userData);
        await user.save();
        // generate jwt and set cookie
        const token = user?.signToken();
        res.cookie("jwt", token, {
            ...cookie_1.cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: "/",
        });
        // Set CSRF protection cookie
        (0, csrf_middleware_1.setCsrfCookie)(res);
        void (0, nodeMailer_1.sendWelcomeMail)({
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
    }
    catch (err) {
        await cleanupFiles(req.files);
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the signup controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.signup = signup;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
// login
const login = async (req, res) => {
    const result = user_schema_1.loginSchema.safeParse(req.body);
    try {
        // validate input
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid data");
        }
        // check existing jwt cookie
        const existingToken = req.cookies?.jwt;
        if (existingToken) {
            try {
                jsonwebtoken_1.default.verify(existingToken, env_1.env.JWT_SECRET, {
                    issuer: "orbit",
                    audience: "orbit-users",
                });
                throw new errors_1.BadRequestError("You are already logged in!");
            }
            catch (err) {
                logger_1.logger.info(`Invalid/expired token!`, { error: err.message });
                res.clearCookie("jwt", { ...cookie_1.cookieOptions, path: "/" });
            }
        }
        // find user by email OR username
        const user = await user_model_1.User.findOne({
            $or: [
                { email: result.data.usernameOrEmail },
                { username: result.data.usernameOrEmail }
            ]
        });
        if (!user) {
            throw new errors_1.NotFoundError("User doesn't exist!");
        }
        // Check if account is locked
        if (user.lockUntil && user.lockUntil > new Date()) {
            const remainingMin = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
            logger_1.logger.warn(`Locked account login attempt`, { userId: user._id, remainingMin });
            throw new errors_1.BadRequestError(`Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMin} minutes.`);
        }
        // verify password
        const isMatch = await user.comparePassword(result.data.password);
        if (!isMatch) {
            const attempts = (user.loginAttempts || 0) + 1;
            const updateData = { loginAttempts: attempts };
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                updateData.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
                logger_1.logger.warn(`Account locked due to too many failed attempts`, { userId: user._id, attempts });
            }
            else {
                logger_1.logger.warn(`Failed login attempt`, { userId: user._id, attempts });
            }
            await user_model_1.User.findByIdAndUpdate(user._id, { $set: updateData });
            throw new errors_1.UnauthorizedError("Invalid credentials!");
        }
        // Reset login attempts on successful login
        if ((user.loginAttempts || 0) > 0 || user.lockUntil) {
            await user_model_1.User.findByIdAndUpdate(user._id, {
                $set: { loginAttempts: 0, lockUntil: null }
            });
        }
        // generate jwt
        const token = user.signToken();
        // set cookie
        res.cookie("jwt", token, {
            ...cookie_1.cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/",
        });
        // Set CSRF protection cookie
        (0, csrf_middleware_1.setCsrfCookie)(res);
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
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the login controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.login = login;
// get current user (me)
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            throw new errors_1.UnauthorizedError("Unauthorized access!");
        }
        const user = await user_model_1.User.findById(userId).select("-password -otp -otpExpiry");
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
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
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the getCurrentUser controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.getCurrentUser = getCurrentUser;
// logout
const logout = async (req, res) => {
    try {
        // clear cookies
        res.clearCookie("jwt", { ...cookie_1.cookieOptions, path: "/" });
        res.clearCookie("csrf-token", { path: "/", secure: env_1.env.NODE_ENV === "production", sameSite: "lax" });
        res.status(200).json({
            success: true,
            message: "User logged out successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the logout controller!`, { error: err.message });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.logout = logout;
//# sourceMappingURL=auth.controllers.js.map