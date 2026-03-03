import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = async (res, userId) => {
	const jwtSecret = process.env.JWT_SECRET;
	const token = jwt.sign(
		{
			userId,
		},
		jwtSecret,
		{ expiresIn: "15d" },
	);
	res.cookie("jwt", token, {
		maxAge: 15 * 24 * 60 * 60 * 1000,
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
	});
};
