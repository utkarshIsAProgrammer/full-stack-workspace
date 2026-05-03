/**
 * @file nodeMailer.ts
 * @description Configuration for Nodemailer and functions to send various types of emails.
 */

import nodemailer from "nodemailer";
import "dotenv/config";

/**
 * Represents a user to whom an email will be sent.
 * @typedef {Object} MailUser
 * @property {string} email - The user's email address.
 * @property {string} username - The user's username.
 */
type MailUser = {
	email: string;
	username: string;
};

// Create a transporter object using SMTP configuration from environment variables
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: 587,
	secure: false, // true for port 465, false for other ports
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/**
 * Sends a welcome email to a newly signed-up user.
 * @async
 * @function sendWelcomeMail
 * @param {MailUser} user - The user object containing email and username.
 */
export const sendWelcomeMail = async (user: MailUser) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "Signup Successful!",
			text: `Hi ${user.username}! Welcome to the blobBlogs, thanks for signing up.`,
			html: `<p>Hi ${user.username}! welcome to <b>blobBlogs</b>, thanks for signing up.</p>`,
		});
		console.log("Welcome email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};

/**
 * Sends an email notification when a user's password is successfully updated.
 * @async
 * @function sendPasswordUpdateMail
 * @param {MailUser} user - The user object containing email and username.
 */
export const sendPasswordUpdateMail = async (user: MailUser) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "Password Successfully Updated!",
			text: `Hi ${user.username}! password to you user account is updated successfully!.`,
			html: `<p>Hi ${user.username}! password to you user account is updated successfully!</p>`,
		});
		console.log("Password update email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};

/**
 * Sends an OTP email for verification purposes.
 * @async
 * @function sendOtpMail
 * @param {MailUser} user - The user object containing email and username.
 * @param {string} otp - The one-time password to be sent.
 */
export const sendOtpMail = async (user: MailUser, otp: string) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "OTP verification!",
			text: `Hi ${user.username}! here is your one time password ${otp} don't reveal it to others.`,
			html: `Hi ${user.username}! here is your one time password <b>${otp}</b> don't reveal it to others.`,
		});
		console.log("Otp email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};

/**
 * Sends a confirmation email after a user has successfully reset their forgotten password.
 * @async
 * @function sendForgotPasswordMail
 * @param {MailUser} user - The user object containing email and username.
 */
export const sendForgotPasswordMail = async (user: MailUser) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "New password set successful!",
			text: `Hi ${user.username}! you've successfully created your new password.`,
			html: `Hi ${user.username}! you've successfully created your new password.`,
		});
		console.log("Forgot password email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};

/**
 * Sends a notification email when a user's account is deleted.
 * @async
 * @function sendDeletionMail
 * @param {MailUser} user - The user object containing email and username.
 */
export const sendDeletionMail = async (user: MailUser) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "Account deletion!",
			text: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
			html: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
		});
		console.log("Otp email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};
