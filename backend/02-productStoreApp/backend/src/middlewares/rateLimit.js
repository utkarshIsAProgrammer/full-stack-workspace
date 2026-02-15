import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 2, // limit each IP to 100 requests
	message: "Too many requests, try again later!",
});
