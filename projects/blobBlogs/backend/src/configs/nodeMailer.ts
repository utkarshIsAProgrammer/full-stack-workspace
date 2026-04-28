import nodemailer from "nodemailer";
import "dotenv/config";

type MailUser = {
	email: string;
	username: string;
};

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: 587,
	secure: false, // true for port 465
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

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
