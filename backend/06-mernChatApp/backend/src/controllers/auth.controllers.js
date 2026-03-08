import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

export const signup = async (req, res) => {
	const { fullName, email, password } = req.body;
	if (!fullName || !email || !password) {
		return res.status(400).json({ message: "All fields are required!" });
	}

	if (password.length < 6) {
		return res
			.status(400)
			.json({ message: "Password must be at least 6 characters!" });
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return res.status(400).json({ message: "Invalid email format!" });
	}

	try {
		const user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({ message: "User already exists!" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = await User.create({
			fullName,
			email,
			password: hashedPassword,
		});

		if (newUser) {
			generateToken(newUser._id, res);
		} else {
			return res.status(400).json({ message: "Invalid user data!" });
		}

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			newUser,
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
