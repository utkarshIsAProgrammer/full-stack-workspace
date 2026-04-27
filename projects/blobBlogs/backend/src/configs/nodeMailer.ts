import type { Request } from "express";
import nodemailer from "nodemailer";
import "dotenv/config";
import { signupSchema } from "../schemas/user.schema";

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
		console.log("Email sent!");
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
		console.log("Email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};

export const sendForgotPasswordMail = async (user: MailUser) => {
	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: user.email,
			subject: "Signup Successful!",
			text: `Hi ${user.username}! Welcome to the blobBlogs, thanks for signing up.`,
			html: `<p>Hi ${user.username}! welcome to <b>blobBlogs</b>, thanks for signing up.</p>`,
		});
		console.log("Email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};
