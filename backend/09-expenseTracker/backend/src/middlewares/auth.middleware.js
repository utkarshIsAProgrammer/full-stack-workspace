import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
	try {
		const token = req.cookies.jwt;
		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - No token provided!",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (!decoded) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - Invalid token!",
			});
		}

		const currentUser = await User.findById(decoded.userId);
		req.user = currentUser;

		next();
	} catch (err) {
		console.log(`Error in the protectRoute middleware! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
