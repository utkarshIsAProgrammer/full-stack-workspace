import redis from "./redis.js";

export const storeRefreshToken = async (userId, refreshToken) => {
	await redis.set(
		`refresh_token:${userId}`,
		refreshToken,
		"EX",
		7 * 24 * 60 * 60,
	);
};
