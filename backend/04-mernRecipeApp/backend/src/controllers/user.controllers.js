import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
	const { userName, password } = req.body;

	try {
		const user = await User.findOne({ userName });

		if (user) {
			return res.status(400).json({ message: "User already exists!" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = User.create({ userName, password: hashedPassword });

		res.status(200).json({ message: "Registration successful!" });
	} catch (err) {
		console.log(`Error in the signup controller! ${err.messaeg}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { userName, password } = req.body;
	const jwtSecret = process.env.JWT_SECRET;

	try {
		const user = await User.findOne({ userName });

		if (!user) {
			return res.status(404).json({ message: "User not found!" });
		}

		const correctPassword = await bcrypt.compare(password, user.password);

		if (!correctPassword) {
			return res.status(401).json({ message: "Incorrect password!" });
		}

		const token = jwt.sign({ id: user._id }, jwtSecret);
		res.status(200).json({ token, userID: user._id });
	} catch (err) {
		console.log(`Error in the login controller! ${err.messaeg}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
