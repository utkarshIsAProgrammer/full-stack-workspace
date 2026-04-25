import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";
import { sendMail } from "../configs/nodeMailer";

export const signup = async (req: Request, res: Response) => {
	const result = signupSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data",
				error: result.error.issues,
			});
		}

		const userExists = await User.findOne({
			email: result.data.email,
			username: result.data.username,
		});

		if (userExists) {
			return res.status(400).json({
				success: true,
				message: "User already exists!",
			});
		}

		const user = new User(result.data);
		await user.save();

		const token = user?.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			user,
		});

		sendMail(req);
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req: Request, res: Response) => {};

export const logout = async (req: Request, res: Response) => {};
