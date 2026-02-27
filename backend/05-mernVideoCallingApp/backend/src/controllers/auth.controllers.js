import User from "../models/user.model.js";
import { upsertStreamUser } from "../libs/stream.js";
// import jwt from "jsonwebtoken";

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

		// CREATE: upstream user
		try {
			await upsertStreamUser({
				id: newUser._id.toString(),
				name: newUser.fullName,
				image: newUser.profilePic || "",
			});
			console.log(`Stream user created for ${newUser.fullName}`);
		} catch (err) {
			console.log(`Error creating Stream user! ${err.message}`);
		}

		/* 	const token = jwt.sign(
			{ userId: newUser._id },
			process.env.JWT_SECRET,
			{ expiresIn: "7d" },
		); */

		const token = await newUser.generateToken();
		res.cookie("jwt", token, {
			maxAge: 7 * 24 * 60 * 60 * 1000,
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
		});

		res.status(201).json({
			success: true,
			message: "Signup successful!",
			newUser,
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json({ message: "All fields are required!" });
	}

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res
				.status(400)
				.json({ message: "Invalid email or password!" });
		}

		const isPasswordCorrect = await user.matchPassword(password);
		if (!isPasswordCorrect) {
			return res
				.status(400)
				.json({ message: "Invalid email or password!" });
		}

		/* 		const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
		}); */

		const token = await user.generateToken();
		res.cookie("jwt", token, {
			maxAge: 7 * 24 * 60 * 60 * 1000,
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
		});

		res.status(200).json({
			success: true,
			message: "Login successful!",
			user,
		});
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const logout = async (req, res) => {
	res.clearCookie("jwt");
	res.status(200).json({ success: true, message: "Logout successful!" });
};
