"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.signup = exports.getAll = void 0;
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const nodeMailer_1 = require("../configs/nodeMailer");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// get all users
const getAll = async (req, res) => {
    try {
        const users = await user_model_1.User.find();
        return res.status(200).json({
            success: true,
            message: "All users fetched successfully!",
            users,
        });
    }
    catch (err) {
        console.log(`Error in the getAll users controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.getAll = getAll;
// signup
const signup = async (req, res) => {
    const result = user_schema_1.signupSchema.safeParse(req.body);
    try {
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid data",
                error: result.error.issues,
            });
        }
        // check user exists
        const userExists = await user_model_1.User.findOne({
            email: result.data.email,
        });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "User already exists!",
            });
        }
        // create and save new user
        const user = new user_model_1.User(result.data);
        await user.save();
        // generate jwt and set cookie
        const token = user?.signToken();
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        // send welcome email
        (0, nodeMailer_1.sendWelcomeMail)({
            email: user.email,
            username: user.username,
        });
        res.status(201).json({
            success: true,
            message: "User created successfully!",
            ...user.toObject(),
            password: undefined, // remove password from response
        });
    }
    catch (err) {
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
            jsonwebtoken_1.default.verify(existingToken, process.env.JWT_SECRET);
            return res.status(400).json({
                success: false,
                message: "You are already logged in!",
            });
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
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // response
        return res.status(200).json({
            success: true,
            message: "User logged in successfully!",
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
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
        res.clearCookie("jwt", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
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