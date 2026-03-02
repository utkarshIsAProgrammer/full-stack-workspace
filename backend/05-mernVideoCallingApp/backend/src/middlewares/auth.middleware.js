import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
	try {
		const token = req.cookies.jwt;
		if (!token) {
			return res.status(401).json({
				message: "Unauthorized access - Token not provided!",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (!decoded) {
			return res
				.status(401)
				.json({ message: "Unauthorized access - Invalid token!" });
		}

		const user = await User.findById(decoded.userId).select("-password"); // remove 'password' field to show on onboarding
		if (!user) {
			return res
				.status(401)
				.json({ message: "Unauthorized access - User not found!" });
		}
		req.user = user;
		next();
	} catch (err) {
		console.log(`Error in the protectRoute middleware! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
