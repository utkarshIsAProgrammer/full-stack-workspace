import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { type IUser } from "../models/user.model.ts";

// Extend Express Request to include user
declare global {
	namespace Express {
		interface Request {
			user?: IUser;
		}
	}
}

export const isAuthenticated = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		// Extract token from cookie (named 'jwt') or Authorization header
		const token =
			req.cookies?.jwt || req.headers.authorization?.split(" ")[1];

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Authentication required. Please login.",
			});
		}

		const jwtSecret = process.env.JWT_SECRET;
		if (!jwtSecret) {
			throw new Error(
				"JWT_SECRET is not defined in environment variables!",
			);
		}

		// Verify token
		const decoded = jwt.verify(token, jwtSecret) as { userId: string };

		// Find user and attach to request
		const user = await User.findById(decoded.userId).select("-password");
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "User not found. Please login again.",
			});
		}

		req.user = user;
		next();
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));

		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				success: false,
				message: "Invalid token. Please login again.",
			});
		}

		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Token expired. Please login again.",
			});
		}

		console.log(`Error in isAuthenticated middleware: ${error.message}`);
		return res.status(500).json({
			success: false,
			message: "Internal server error during authentication!",
		});
	}
};
