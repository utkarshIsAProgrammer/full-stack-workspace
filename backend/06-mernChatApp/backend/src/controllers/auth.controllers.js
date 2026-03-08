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
		// check if user exists
		const user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({ message: "Email already exists!" });
		}

		// hashing password
		const hashedPassword = await bcrypt.hash(password, 10);

		// create new user
		const newUser = await User.create({
			fullName,
			email,
			password: hashedPassword,
		});

		// generate token if user created
		if (newUser) {
			generateToken(newUser._id, res);

			res.status(201).json({
				success: true,
				message: "User created successfully!",
				newUser,
			});

			// TODO: SEND A WELCOME EMAIL TO THE USER
		} else {
			return res.status(400).json({ message: "Invalid user data!" });
		}
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
