import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
	try {
		// get the cookie (using cookieParser)
		const token = req.cookies.jwt; // 'jwt' should be same as the name of the cookie set while generating cookies
		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized access - no token provided!",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (!decoded) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized access - invalid token!",
			});
		}

		const currentUser = await User.findById(decoded.userId); // 'userId' should be same as the argument that is provided while signToken()
		req.user = currentUser;

		next();
	} catch (err) {
		console.log(`Error in teh protectRoute middleware! ${err.message}`);
		res.status(500).json({ message: "Intenal server error!" });
	}
};
