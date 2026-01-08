import rateLimit from "../config/upstash.js";

// rate limiter
const rateLimiter = async (req, res, next) => {
	try {
		const { success } = await rateLimit.limit("my-rate-limit");

		if (!success) {
			return res.status(409).json({
				message: "Too many requests, please try again later!",
			});
		}

		next();
	} catch (err) {
		console.log("Rate limit error", err.message);
		next(err);
	}
};

export default rateLimiter;
