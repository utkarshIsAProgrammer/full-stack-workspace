import type { Request } from "express";
import nodemailer from "nodemailer";
import "dotenv/config";
import { signupSchema } from "../schemas/user.schema";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: 587,
	secure: false, // true for port 465
	auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const sendMail = async (req: Request) => {
	const result = signupSchema.safeParse(req.body);
	if (!result.success) {
		throw new Error("Invalid Data!");
	}

	try {
		await transporter.sendMail({
			from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
			to: result.data.email,
			subject: "Signup Successful!",
			text: `Hi ${result.data.username}! Welcome to the blobBlogs, thanks for signing up.`,
			html: `<p>Hi ${result.data.username}! welcome to <b>blobBlogs</b>, thanks for signing up.</p>`,
		});
		console.log("Email sent!");
	} catch (err: any) {
		console.error("Failed to send email:", err.message);
	}
};
