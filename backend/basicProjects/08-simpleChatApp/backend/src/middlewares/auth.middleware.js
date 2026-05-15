import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
	try {
		const token = req.cookies.jwt; // access token from request (cookie-parser)
		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - No token provided!",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET); // verify token from the jwt_secret as it was also signed with it
		if (!decoded) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized - Invalid token!",
			});
		}

		const user = await User.findById(decoded.userId).select("-password");
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found!" });
		}

		req.user = user;
		next();
	} catch (err) {
		console.log(`Error in the protectRoute middleware! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
