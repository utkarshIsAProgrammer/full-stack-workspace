import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, UserDocument } from "../models/user.model";

declare global {
	namespace Express {
		interface Request {
			user?: UserDocument;
		}
	}
}

type JwtPayload = {
	userId: string;
};

export const protect = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const token = req.cookies?.jwt;

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - No token",
			});
		}

		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET as string,
		) as JwtPayload;

		const user = await User.findById(decoded.userId).select("-password");

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		req.user = user;

		next();
	} catch (err: any) {
		return res.status(401).json({
			success: false,
			message: "Invalid or expired token!",
		});
	}
};
