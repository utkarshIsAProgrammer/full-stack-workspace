import jwt from "jsonwebtoken";

export const auth = async (req, res, next) => {
	// read token from cookie sent by browser
	const token = req.cookies.token;

	// check is token exists
	if (!token) {
		return res
			.status(401)
			.json({ success: false, message: "User not logged in!" });
	}

	try {
		// verify token using jwt secret key
		const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

		// save user id
		req.user = decodedToken.id;
		next();
	} catch (err) {
		// if invalid token or expired token
		res.status(401).json({
			success: false,
			message: "Unauthorized User!",
		});
	}
};
