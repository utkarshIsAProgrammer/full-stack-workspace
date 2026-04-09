import type { Request, Response } from "express";
import { registerSchema } from "../validations/auth.validation.ts";
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

export const login = async (req: Request, res: Response) => {};

export const logout = async (req: Request, res: Response) => {};
