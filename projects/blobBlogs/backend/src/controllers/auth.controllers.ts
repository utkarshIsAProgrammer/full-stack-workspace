/**
 * @file auth.controllers.ts
 * @description Controllers for handling authentication-related operations such as signup, login, and logout.
 */

import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";
import { sendWelcomeMail } from "../configs/nodeMailer";

/**
 * Fetches all users from the database.
 * @async
 * @function getAll
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Response with all users or error message.
 */
export const getAll = async (req: Request, res: Response) => {
	try {
		const users = await User.find();
		return res.status(200).json({
			success: true,
			message: "All users fetched successfully!",
			users,
		});
	} catch (err: any) {
		console.log(`Error in the getAll users controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

/**
 * Handles user registration.
 * Validates input, checks for existing user, hashes password (via model hook),
 * creates user, sets JWT cookie, and sends welcome email.
 * @async
 * @function signup
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Response with created user or error message.
 */
export const signup = async (req: Request, res: Response) => {
	// Validate request body against signup schema
	const result = signupSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data",
				error: result.error.issues,
			});
		}

		// Check if user already exists
		const userExists = await User.findOne({
			email: result.data.email,
		});

		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		// Create and save new user
		const user = new User(result.data);
		await user.save();

		// Generate JWT and set in cookie
		const token = user?.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Send welcome email asynchronously
		sendWelcomeMail({
			email: user.email,
			username: user.username,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			...user.toObject(),
			password: undefined, // Remove password from response
		});
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

/**
 * Handles user login.
 * Validates input, verifies user existence and password, sets JWT cookie.
 * @async
 * @function login
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Response with user data or error message.
 */
export const login = async (req: Request, res: Response) => {
	// Validate request body against login schema
	const result = loginSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data",
				error: result.error.issues,
			});
		}

		// Find user by email
		const user = await User.findOne({
			email: result.data.email,
		});

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User doesn't exists!" });
		}

		// Verify password
		const isMatch = await user.comparePassword(result.data.password);
		if (!isMatch) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid credentials!" });
		}

		// Generate JWT and set in cookie
		const token = user.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		res.status(200).json({
			success: true,
			message: "User logged in  successfully!",
			...user.toObject(),
			password: undefined, // Remove password from response
		});
	} catch (err: any) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

/**
 * Handles user logout.
 * Clears the JWT cookie.
 * @async
 * @function logout
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Success message or error.
 */
export const logout = async (req: Request, res: Response) => {
	try {
		// Clear JWT cookie with same options used when setting it
		res.clearCookie("jwt", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
		});
		res.status(200).json({
			success: true,
			message: "User logged out successfully!",
		});
	} catch (err: any) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
