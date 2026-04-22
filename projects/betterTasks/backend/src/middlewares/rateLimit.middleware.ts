import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "../config/upstash";

export const rateLimiter = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { success } = await rateLimit.limit("my-limit-key");
		if (!success) {
			return res.status(429).json({
				message: "Too many requests, please try again later!",
			});
		}
		next();
	} catch (err: any) {
		console.log("Rate limit error!", err.message);
		next();
	}
};
