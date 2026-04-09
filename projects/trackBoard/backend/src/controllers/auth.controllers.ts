import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "../validations/auth.validation.ts";
import User from "../models/user.model.ts";

export const register = async (req: Request, res: Response) => {
	const validation = registerSchema.safeParse(req.body);
	if (!validation.success) {
		return res
			.status(400)
			.json({ success: false, errors: validation.error.format() });
	}

	const { name, email, password } = validation.data;

	try {
		const userExists = await User.findOne({ email });
		if (userExists) {
			return res
				.status(400)
				.json({ success: false, message: "User already exists!" });
		} else {
			const user = await User.create({ name, email, password });

			if (user) {
				const token = user.signToken();

				res.cookie("jwt", token, {
					httpOnly: true,
					sameSite: "strict",
					maxAge: 7 * 24 * 60 * 60 * 1000,
					secure: process.env.NODE_ENV === "production",
				});

				res.status(201).json({
					success: true,
					message: "User created successfully!",
					id: user._id,
					name: user.name,
					email: user.email,
					token,
				});
			}
		}
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.log(`Error in the register controller! ${error.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req: Request, res: Response) => {
	const validation = loginSchema.safeParse(req.body);
	if (!validation.success) {
		return res
			.status(400)
			.json({ success: false, errors: validation.error.format() });
	}

	const { email, password } = validation.data;

	try {
		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res
				.status(404)
				.json({ success: false, message: "User doesn't exist!" });
		} else {
			const isPasswordCorrect =
				await existingUser.comparePassword(password);
			if (!isPasswordCorrect) {
				return res.status(400).json({
					success: false,
					message: "Invalid email or password!",
				});
			} else {
				const token = existingUser.signToken();
				res.cookie("jwt", token, {
					httpOnly: true,
					sameSite: "strict",
					maxAge: 7 * 24 * 60 * 60 * 1000,
					secure: process.env.NODE_ENV === "production",
				});

				return res.status(200).json({
					success: true,
					message: "User logged in successfully!",
					id: existingUser._id,
					name: existingUser.name,
					email: existingUser.email,
					token,
				});
			}
		}
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.log(`Error in the login controller! ${error.message}`);
	}
};

export const logout = async (req: Request, res: Response) => {
	try {
		res.clearCookie("jwt");
		res.status(200).json({
			success: true,
			message: "User logged out successfully!",
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		console.log(`Error in the logout controller! ${error.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};
