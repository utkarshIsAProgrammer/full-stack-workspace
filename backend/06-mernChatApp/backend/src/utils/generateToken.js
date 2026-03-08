import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;
export const generateToken = (userId, res) => {
	const token = jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" });
	res.cookie("jwt", token, {
		maxAge: 7 * 24 * 60 * 60 * 1000,
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production" ? true : false,
	});

	return token;
};
