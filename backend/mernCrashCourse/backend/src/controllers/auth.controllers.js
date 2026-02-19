import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
	const { username, email, phone, password } = req.body;

	try {
		const user = await User.findOne({ email });

		if (user) {
			return res
				.status(400)
				.json({ success: false, message: "Email already exists!" });
		}

		// const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = await User.create({
			username,
			email,
			phone,
			password,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			token: await newUser.generateToken(),
			userId: newUser.id.toString(),
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
			return res
				.status(404)
				.json({ success: false, message: "User not found!" });
		}

		// const validatePassword = await bcrypt.compare(password, user.password);

		const validatePassword = await user.comparePassword(password);
		if (validatePassword) {
			return res.status(200).json({
				success: true,
				message: "Login successfully!",
				token: await user.generateToken(),
				userId: user.id.toString(),
			});
		} else {
			return res.status(401).json({
				success: false,
				message: "Invalid email or password!",
			});
		}
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal Server Error!",
		});
	}
};

export const logout = async (req, res) => {
	res.send("Welcome to the Logout page!");
};
