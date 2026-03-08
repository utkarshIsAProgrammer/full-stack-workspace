import jwt from "jsonwebtoken";

const { JWT_SECRET, NODE_ENV } = process.env;

export const generateToken = (userId, res) => {
	if (!JWT_SECRET) {
		throw new Error("JWT Secret is not configured!");
	}

	const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
	res.cookie("jwt", token, {
		maxAge: 7 * 24 * 60 * 60 * 1000,
		httpOnly: true,
		sameSite: "strict",
		secure: NODE_ENV === "production" ? true : false,
	});

	return token;
};
