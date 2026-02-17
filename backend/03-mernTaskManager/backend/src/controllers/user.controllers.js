import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

export const signup = async (req, res) => {
	const { name, email, password } = req.body;
	if (!name || !email || !password) {
		return res.status(400).json({
			success: false,
			message: "All fields are required!",
		});
	}

	try {
		const userExists = await User.findOne({ email });
		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		const hashPassword = await bcrypt.hash(password, 10);
		const user = await User.create({ name, email, password: hashPassword });
		const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
			expiresIn: "7d",
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
	const { email, password } = req.body;

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "Invalid Email! ",
			});
		}

		const matchPassword = await bcrypt.compare(password, user.password);
		if (!matchPassword) {
			return res
				.status(400)
				.json({ success: false, message: "Incorrect Password!" });
		}

		const token = jwt.sign(
			{ id: user._id, loginTime: Date.now() },
			process.env.JWT_SECRET,
			{
				expiresIn: "7d",
			},
		);

		res.status(200).json({ success: true, message: "Login successful!" });
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};
