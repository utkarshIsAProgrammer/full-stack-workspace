import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const signup = async (req, res) => {
	const { fullName, email, password } = req.body;

	try {
		if (!fullName || !email || !password) {
			return res
				.status(400)
				.json({ message: "All fields are required!" });
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

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ message: "Email already exists!" });
		}

		const idx = Math.floor(Math.random() * 100) + 1;
		const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

		const newUser = await User.create({
			fullName,
			email,
			password,
			profilePic: randomAvatar,
		});

		// TODO: create the user in stream as well

		const token = jwt.sign(
			{ userId: newUser._id },
			process.env.JWT_SECRET,
			{ expiresIn: "7d" },
		);
		res.cookie("jwt", token, {
			maxAge: 7 * 24 * 60 * 60 * 1000,
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
		});

		res.status(201).json({ success: true, newUser });
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
