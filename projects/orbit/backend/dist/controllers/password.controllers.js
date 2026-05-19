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
// update password
const updatePassword = async (req, res) => {
    const result = user_schema_1.updatePasswordSchema.safeParse(req.body);
    try {
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid data!",
                error: result.error.issues,
            });
        }
        // req.user is populated by protect middleware
        const user = await user_model_1.User.findById(req.user?._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found!",
            });
        }
        // check current password
        const isMatch = await user.comparePassword(result.data.currentPassword);
        if (!isMatch) {
            return res
                .status(401)
                .json({ success: false, message: "Incorrect Password!" });
        }
        // prevent setting same password
        const isSamePassword = await bcryptjs_1.default.compare(result.data.newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password can't be same!",
            });
        }
        // update and save new password (hashed by pre-save hook)
        user.password = result.data.newPassword;
        await user.save();
        // clear cookie
        res.clearCookie("jwt", cookie_1.cookieOptions);
        res.status(200).json({
            success: true,
            message: "Password updated successfully!",
        });
        // notify via email
        await (0, nodeMailer_1.sendPasswordUpdateMail)({
            email: user.email,
            username: user.username,
        });
    }
    catch (err) {
        console.log(`Error in the updatePassword controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.updatePassword = updatePassword;
// request password reset
const requestOtpForForgotPassword = async (req, res) => {
    const result = user_schema_1.forgotPasswordSchema.safeParse(req.body);
    try {
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid Data!",
                error: result.error.issues,
            });
        }
        const user = await user_model_1.User.findOne({ email: result.data.email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found!",
            });
        }
        // generate and hash otp for security
        const otp = (0, generateOtp_1.generateOTP)();
        const hashedOTP = await bcryptjs_1.default.hash(otp, 10);
        user.otp = hashedOTP;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes
        await user.save();
        // clear cookie
        res.clearCookie("jwt", cookie_1.cookieOptions);
        res.status(200).json({
            success: true,
            message: "OTP sent successfully!",
        });
        // send raw otp via email
        await (0, nodeMailer_1.sendOtpMail)({ email: user.email, username: user.username }, otp);
    }
    catch (err) {
        console.log(`Error in the requestPasswordReset controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.requestOtpForForgotPassword = requestOtpForForgotPassword;
// verify otp and forgot password
const verifyOtpAndForgotPassword = async (req, res) => {
    const result = user_schema_1.verifyOtpSchema.safeParse(req.body);
    try {
        if (!result.success) {
            return res.status(400).json({ message: "Invalid data!" });
        }
        const { email, otp, newPassword } = result.data;
        const user = await user_model_1.User.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found!" });
        // check otp exists and valid
        if (!user.otp || !user.otpExpiry) {
            return res.status(400).json({ message: "OTP not found!" });
        }
        if (user.otpExpiry < new Date()) {
            return res.status(400).json({ message: "OTP expired!" });
        }
        const isValid = await bcryptjs_1.default.compare(otp, user.otp);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid OTP!" });
        }
        // prevent setting same password
        const isSamePassword = await bcryptjs_1.default.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password can't be same!",
            });
        }
        // update password and clear otp fields
        user.password = newPassword;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();
        // clear cookie
        res.clearCookie("jwt", cookie_1.cookieOptions);
        res.status(200).json({
            success: true,
            message: "Password reset successfully!",
        });
        // notify via email
        await (0, nodeMailer_1.sendForgotPasswordMail)({
            email: user.email,
            username: user.username,
        });
    }
    catch (err) {
        console.log(`Error in the verifyOtpAndResetPassword controller! ${err.message}`);
        res.status(500).json({ message: "Internal server error!" });
    }
};
exports.verifyOtpAndForgotPassword = verifyOtpAndForgotPassword;
//# sourceMappingURL=password.controllers.js.map