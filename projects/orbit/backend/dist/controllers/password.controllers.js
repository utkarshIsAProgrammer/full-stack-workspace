"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtpAndForgotPassword = exports.requestOtpForForgotPassword = exports.updatePassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_model_1 = require("../models/user.model");
const user_schema_1 = require("../schemas/user.schema");
const nodeMailer_1 = require("../configs/nodeMailer");
const generateOtp_1 = require("../configs/generateOtp");
const cookie_1 = require("../configs/cookie");
const logger_1 = require("../utilities/logger");
const errors_1 = require("../utilities/errors");
const env_1 = require("../configs/env");
// Maximum number of previous passwords to keep in history
const PASSWORD_HISTORY_LIMIT = 5;
// Check if new password was used recently
const isPasswordInHistory = async (newPassword, passwordHistory) => {
    for (const entry of passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT)) {
        if (await bcryptjs_1.default.compare(newPassword, entry.password)) {
            return true;
        }
    }
    return false;
};
// update password
const updatePassword = async (req, res) => {
    const result = user_schema_1.updatePasswordSchema.safeParse(req.body);
    try {
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid data!");
        }
        // req.user is populated by protect middleware
        const user = await user_model_1.User.findById(req.user?._id);
        if (!user) {
            throw new errors_1.NotFoundError("User not found!");
        }
        // check current password
        const isMatch = await user.comparePassword(result.data.currentPassword);
        if (!isMatch) {
            throw new errors_1.UnauthorizedError("Incorrect Password!");
        }
        if (result.data.currentPassword === result.data.newPassword) {
            throw new errors_1.BadRequestError("New password cannot be the same as your current password!");
        }
        // check password history to prevent reuse
        const passwordHistory = user.passwordHistory || [];
        if (await isPasswordInHistory(result.data.newPassword, passwordHistory)) {
            throw new errors_1.BadRequestError("Cannot reuse a recently used password. Please choose a different password!");
        }
        // Save current password to history before updating
        const updatedHistory = [
            { password: user.password, changedAt: new Date() },
            ...passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT - 1),
        ];
        // update and save new password (hashed by pre-save hook)
        user.passwordHistory = updatedHistory;
        user.password = result.data.newPassword;
        await user.save();
        // notify via email before sending response
        await (0, nodeMailer_1.sendPasswordUpdateMail)({
            email: user.email,
            username: user.username,
        });
        // clear cookie and respond
        res.clearCookie("jwt", { ...cookie_1.cookieOptions, path: "/" });
        return res.status(200).json({
            success: true,
            message: "Password updated successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the updatePassword controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.updatePassword = updatePassword;
// request password reset
const requestOtpForForgotPassword = async (req, res) => {
    const result = user_schema_1.forgotPasswordSchema.safeParse(req.body);
    try {
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid Data!");
        }
        const user = await user_model_1.User.findOne({ email: result.data.email });
        // Always return success to prevent email enumeration
        // But only send OTP if user exists and email is verified
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If the email is registered and verified, an OTP has been sent!",
            });
        }
        // Check if email is verified (if verification is required)
        if (!user.isEmailVerified) {
            // Don't reveal that email exists but is not verified
            return res.status(200).json({
                success: true,
                message: "If the email is registered and verified, an OTP has been sent!",
            });
        }
        // generate and hash otp for security
        const otp = (0, generateOtp_1.generateOTP)();
        const hashedOTP = await bcryptjs_1.default.hash(otp, 12);
        user.otp = hashedOTP;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes
        await user.save();
        // send otp via email before sending response
        await (0, nodeMailer_1.sendOtpMail)({ email: user.email, username: user.username }, otp);
        // clear cookie and respond
        res.clearCookie("jwt", { ...cookie_1.cookieOptions, path: "/" });
        const message = env_1.env.NODE_ENV === "development"
            ? `If the email is registered and verified, an OTP has been sent! (Mock OTP: ${otp})`
            : "If the email is registered and verified, an OTP has been sent!";
        return res.status(200).json({
            success: true,
            message,
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the requestPasswordReset controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.requestOtpForForgotPassword = requestOtpForForgotPassword;
// verify otp and forgot password
const verifyOtpAndForgotPassword = async (req, res) => {
    const result = user_schema_1.verifyOtpSchema.safeParse(req.body);
    try {
        if (!result.success) {
            throw new errors_1.BadRequestError(result.error.issues[0]?.message || "Invalid data!");
        }
        const { email, otp, newPassword } = result.data;
        const user = await user_model_1.User.findOne({ email });
        if (!user)
            throw new errors_1.NotFoundError("User not found!");
        // check otp exists and valid
        if (!user.otp || !user.otpExpiry) {
            throw new errors_1.BadRequestError("OTP not found!");
        }
        if (user.otpExpiry < new Date()) {
            throw new errors_1.BadRequestError("OTP expired!");
        }
        const isValid = await bcryptjs_1.default.compare(otp, user.otp);
        if (!isValid) {
            // Increment failed attempt tracking could be added here
            throw new errors_1.BadRequestError("Invalid OTP!");
        }
        // Check if it matches current password
        if (await bcryptjs_1.default.compare(newPassword, user.password)) {
            throw new errors_1.BadRequestError("New password cannot be the same as your current password!");
        }
        // check password history to prevent reuse
        const passwordHistory = user.passwordHistory || [];
        if (await isPasswordInHistory(newPassword, passwordHistory)) {
            throw new errors_1.BadRequestError("Cannot reuse a recently used password. Please choose a different password!");
        }
        // Save current password to history before updating
        const updatedHistory = [
            { password: user.password, changedAt: new Date() },
            ...passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT - 1),
        ];
        // update password and clear otp fields
        user.passwordHistory = updatedHistory;
        user.password = newPassword;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();
        // notify via email before sending response
        await (0, nodeMailer_1.sendForgotPasswordMail)({
            email: user.email,
            username: user.username,
        });
        // clear cookie and respond
        res.clearCookie("jwt", { ...cookie_1.cookieOptions, path: "/" });
        return res.status(200).json({
            success: true,
            message: "Password reset successfully!",
        });
    }
    catch (err) {
        if (err.statusCode && err.statusCode < 500)
            throw err;
        logger_1.logger.error(`Error in the verifyOtpAndResetPassword controller!`, {
            error: err.message,
        });
        throw new errors_1.AppError("Internal server error!");
    }
};
exports.verifyOtpAndForgotPassword = verifyOtpAndForgotPassword;
//# sourceMappingURL=password.controllers.js.map