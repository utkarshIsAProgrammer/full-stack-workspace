/**
 * @file auth.middleware.ts
 * @description Middleware for authenticating and protecting routes using JWT.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, UserDocument } from "../models/user.model";

// Extend Express Request interface to include the authenticated user
declare global {
	namespace Express {
		interface Request {
			user?: UserDocument;
		}
	}
}

/**
 * Payload structure for the JWT.
 */
type JwtPayload = {
	userId: string;
};

/**
 * Middleware that protects routes by verifying the JWT from cookies.
 * Attaches the user object to the request if authentication is successful.
 * @async
 * @function protect
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<Response | void>} Returns 401/404 if authentication fails, otherwise calls next().
 */
export const protect = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		// Retrieve token from cookies
		const token = req.cookies?.jwt;

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - No token",
			});
		}

		// Verify the token using the secret key
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET as string,
		) as JwtPayload;

		// Fetch user from database and exclude password field
		const user = await User.findById(decoded.userId).select("-password");

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		// Attach user to request object
		req.user = user;

		next();
	} catch (err: any) {
		return res.status(401).json({
			success: false,
			message: "Invalid or expired token!",
		});
	}
};
