"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDeletionMail = exports.sendForgotPasswordMail = exports.sendOtpMail = exports.sendPasswordUpdateMail = exports.sendWelcomeMail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("./env");
const logger_1 = require("../utilities/logger");
const transporter = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST,
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS },
});
// signup email
const sendWelcomeMail = async (user) => {
    try {
        await transporter.sendMail({
            from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
            to: user.email,
            subject: "Signup Successful!",
            text: `Hi ${user.username}! Welcome to the blobBlogs, thanks for signing up.`,
            html: `<p>Hi ${user.username}! welcome to <b>blobBlogs</b>, thanks for signing up.</p>`,
        });
        logger_1.logger.info("Welcome email sent!");
    }
    catch (err) {
        logger_1.logger.error("Failed to send email:", { error: err.message });
    }
};
exports.sendWelcomeMail = sendWelcomeMail;
// password update email
const sendPasswordUpdateMail = async (user) => {
    try {
        await transporter.sendMail({
            from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
            to: user.email,
            subject: "Password Successfully Updated!",
            text: `Hi ${user.username}! password to you user account is updated successfully!.`,
            html: `<p>Hi ${user.username}! password to you user account is updated successfully!</p>`,
        });
        logger_1.logger.info("Password update email sent!");
    }
    catch (err) {
        logger_1.logger.error("Failed to send email:", { error: err.message });
    }
};
exports.sendPasswordUpdateMail = sendPasswordUpdateMail;
// otp email
const sendOtpMail = async (user, otp) => {
    try {
        await transporter.sendMail({
            from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
            to: user.email,
            subject: "OTP verification!",
            text: `Hi ${user.username}! here is your one time password ${otp} don't reveal it to others.`,
            html: `Hi ${user.username}! here is your one time password <b>${otp}</b> don't reveal it to others.`,
        });
        logger_1.logger.info("OTP email sent!");
    }
    catch (err) {
        logger_1.logger.error("Failed to send OTP email:", { error: err.message });
    }
};
exports.sendOtpMail = sendOtpMail;
// forgot password email
const sendForgotPasswordMail = async (user) => {
    try {
        await transporter.sendMail({
            from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
            to: user.email,
            subject: "New password set successful!",
            text: `Hi ${user.username}! you've successfully created your new password.`,
            html: `Hi ${user.username}! you've successfully created your new password.`,
        });
        logger_1.logger.info("Forgot password email sent!");
    }
    catch (err) {
        logger_1.logger.error("Failed to send forgot password email:", { error: err.message });
    }
};
exports.sendForgotPasswordMail = sendForgotPasswordMail;
// account deletion email
const sendDeletionMail = async (user) => {
    try {
        await transporter.sendMail({
            from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
            to: user.email,
            subject: "Account deletion!",
            text: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
            html: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
        });
        logger_1.logger.info("Account deletion email sent!");
    }
    catch (err) {
        logger_1.logger.error("Failed to send account deletion email:", { error: err.message });
    }
};
exports.sendDeletionMail = sendDeletionMail;
//# sourceMappingURL=nodeMailer.js.map