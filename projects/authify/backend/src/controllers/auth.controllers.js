import User from "../models/user.model.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import bcrypt from "bcrypt";

export const signup = async (req, res) => {
	const { name, email, password } = req.body;

	try {
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "All fields are required!",
			});
		}

		const userAlreadyExists = await User.findOne({ email });
		if (userAlreadyExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const verificationToken = Math.floor(
			100000 + Math.random() * 900000,
		).toString();

		const user = new User({
			name,
			email,
			password: hashedPassword,
			verificationToken,
			verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
		});
		generateTokenAndSetCookie(res, user._id);

		await user.save();

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (err) {
		console.log(`Error in the signup controller!, ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
