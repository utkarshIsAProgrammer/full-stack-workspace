import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { generateVerificationToken } from "../utils/generateVerificationToken.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";

export const signup = async (req, res) => {
	try {
		const { email, password, name } = req.body;

		if (!email || !password || !name) {
			throw new Error("All fields are required!");
		}

		if (password.length < 6) {
			return res.status(400).json({
				message: "Password length must be more than 6 characters!",
			});
		}

		const userAlreadyExists = await User.findOne({ email });
		console.log("User already exists!", userAlreadyExists);
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

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			user: {
				...user._doc,
				password: undefined,
			},
		});
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
