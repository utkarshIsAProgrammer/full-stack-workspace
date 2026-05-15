import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import "dotenv/config";

export const signup = async (req, res) => {
	let { name, email, password } = req.body;
	email = email.toLowerCase().trim();

	if (!name || !email || !password) {
		return res.status(400).json({
			success: false,
			message: "All fields are required!",
		});
	}

	try {
		// check user already exists
		const userExists = await User.findOne({ email });
		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		// hash password
		const hashPassword = await bcrypt.hash(password, 10);

		// create user
		const user = await User.create({ name, email, password: hashPassword });

		// create token
		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
		});

		res.cookie("token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "development",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const login = async (req, res) => {
	let { email, password } = req.body;
	email = email.toLowerCase().trim();

	try {
		// finding user
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found! ",
			});
		}

		// checking the password with the hash password
		const matchPassword = await bcrypt.compare(password, user.password);
		if (!matchPassword) {
			return res
				.status(401)
				.json({ success: false, message: "Incorrect Password!" });
		}

		// create token (must important for the login route)
		const token = jwt.sign(
			{ id: user._id, loginTime: Date.now() },
			process.env.JWT_SECRET,
			{
				expiresIn: "7d",
			},
		);

		// save token in cookie
		res.cookie("token", token, {
			httpOnly: true, // js cannot read cookie
			secure: process.env.NODE_ENV === "development", // true in production (https)
			sameSite: "strict", // CSRF protection
			maxAge: 7 * 24 * 60 * 60 * 1000, // expiration time
		});

		res.status(200).json({ success: true, message: "Login successful!" });
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const logout = async (req, res) => {
	try {
		// delete the cookie named "token"
		res.clearCookie("token", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "development",
			sameSite: "strict",
		});

		res.status(200).json({ success: true, message: "Logout successful!" });
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};
