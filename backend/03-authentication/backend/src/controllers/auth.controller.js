import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { generateVerificationToken } from "../utils/generateVerificationToken.js";

export const signup = async (req, res) => {
	const { email, password, name } = req.body;

	if (!email || !password || !name) {
		throw new Error("All fields are required!");
	}

	try {
		const userAlreadyExists = await User.findOne({ email });
		if (userAlreadyExists) {
			return res
				.status(400)
				.json({ success: false, message: "Use already exists!" });
		}

		const hashedPassword = await bcryptjs.hash(password, 10);
		const verificationToken = generateVerificationToken();

		const user = new User({
			email,
			password: hashedPassword,
			name,
			verificationToken,
			verificationTokeExpiresAt: Date.now() + 24 * 60 * 60 + 10000, // 24 hours
		});

		await user.save();

		generateTokenAndSetCookie(res, user._id);
	} catch (err) {
		console.log("Error in the signup controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const logout = async (req, res) => {
	res.send("Logout");
};

export const login = async (req, res) => {
	res.send("Login");
};
