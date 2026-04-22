import type { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
	namespace Express {
		interface Request {
			user?: JwtPayload & { userId: string };
		}
	}
}

export const authUser = (req: Request, res: Response, next: NextFunction) => {
	try {
		let token = req.cookies?.jwt;
		
		if (!token && req.headers.authorization?.startsWith('Bearer ')) {
			token = req.headers.authorization.split(' ')[1];
		}
		
		if (!token) {
			return res.status(401).json({ message: "Unauthorized Access!" });
		}

		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET || "jwtSecret",
		) as JwtPayload & { userId: string };
		req.user = decoded;
		return next();
	} catch (err: any) {
		console.log(`Error in the authMiddleware! ${err.message}`);
		res.status(401).json({ message: "Invalid or expired token!" });
	}
};
