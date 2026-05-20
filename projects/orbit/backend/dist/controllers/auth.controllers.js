"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.signup = void 0;
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const nodeMailer_1 = require("../configs/nodeMailer");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie_1 = require("../configs/cookie");
const cloudinary_1 = __importDefault(require("../configs/cloudinary"));
// signup
const signup = async (req, res) => {
    const result = user_schema_1.signupSchema.safeParse(req.body);
    try {
        if (!result.success) {
            if (req.file) {
                await cloudinary_1.default.uploader.destroy(req.file.filename);
            }
            return res.status(400).json({
                success: false,
                message: "Invalid data",
                error: result.error.issues,
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Profile picture is required!",
            });
        }
        // check user exists
        const userExists = await user_model_1.User.findOne({
            $or: [{ email: result.data.email }, { username: result.data.username }],
        });
        if (userExists) {
            await cloudinary_1.default.uploader.destroy(req.file.filename);
            if (userExists.email === result.data.email) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists!",
                });
            }
            return res.status(400).json({
                success: false,
                message: "Username already exists!",
            });
        }
        // create and save new user
        const user = new user_model_1.User({
            ...result.data,
            profilePic: {
                url: req.file.path,
                public_id: req.file.filename,
            },
        });
        await user.save();
        // generate jwt and set cookie
        const token = user?.signToken();
        res.cookie("jwt", token, {
            ...cookie_1.cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        return res.status(201).json({
            success: true,
            message: "User created successfully!",
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
        // send welcome email
        (0, nodeMailer_1.sendWelcomeMail)({
            email: user.email,
            username: user.username,
        });
    }
    catch (err) {
        if (req.file) {
            try {
                await cloudinary_1.default.uploader.destroy(req.file.filename);
            }
            catch (cloudErr) {
                console.log("Cloudinary destroy error: ", cloudErr);
            }
        }
        console.log(`Error in the signup controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.signup = signup;
// login
const login = async (req, res) => {
    const result = user_schema_1.loginSchema.safeParse(req.body);
    try {
        // validate input
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid data",
                error: result.error.issues,
            });
        }
        // check existing jwt cookie
        const existingToken = req.cookies?.jwt;
        if (existingToken) {
            try {
                jsonwebtoken_1.default.verify(existingToken, process.env.JWT_SECRET);
                return res.status(400).json({
                    success: false,
                    message: "You are already logged in!",
                });
            }
            catch (err) {
                console.log(`Invalid/expired token! ${err.message}`);
                return res.status(401).json({
                    success: false,
                    message: "Invalid/expired token!",
                });
            }
        }
        // find user
        const user = await user_model_1.User.findOne({
            email: result.data.email,
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User doesn't exist!",
            });
        }
        // verify password
        const isMatch = await user.comparePassword(result.data.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials!",
            });
        }
        // generate jwt
        const token = user.signToken();
        // set cookie
        res.cookie("jwt", token, {
            ...cookie_1.cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // response
        return res.status(200).json({
            success: true,
            message: "User logged in successfully!",
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
        console.log(`Error in the login controller! ${err.message}`);
        return res.status(500).json({
            success: false,
            message: "Internal server error!",
        });
    }
};
exports.login = login;
// logout
const logout = async (req, res) => {
    try {
        // clear cookie
        res.clearCookie("jwt", cookie_1.cookieOptions);
        res.status(200).json({
            success: true,
            message: "User logged out successfully!",
        });
    }
    catch (err) {
        console.log(`Error in the logout controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.logout = logout;
//# sourceMappingURL=auth.controllers.js.map