import jwt from "jsonwebtoken";
import "dotenv.config";

export const auth = async (req, res, next) => {
	const header = req.header.authorization;
	if (!header) {
		return res.status(401).json({ success: false, message: "No Token!" });
	}

	try {
		const token = header.split(" ")[1];
		const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decodedToken.id;
		next();
	} catch (err) {
		res.status(401).json({
			success: false,
			message: "Unauthorized User!",
		});
	}
};
