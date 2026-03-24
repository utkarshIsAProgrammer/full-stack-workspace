import User from "../models/user.model.js";
import { setCookie } from "../utils/setCookie.js";

export const signup = async (req, res) => {
	const { fullName, userName, password, confirmPassword, gender } = req.body;

	try {
		if (
			!fullName ||
			!userName ||
			!password ||
			!confirmPassword ||
			!gender
		) {
			return res
				.status(400)
				.json({ success: false, message: "All fields are required!" });
		}

		if (password.length < 6) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 6 characters long!",
			});
		}

		if (password !== confirmPassword) {
			return res
				.status(400)
				.json({ success: false, message: "Passwords don't match!" });
		}

		if (!["male", "female"].includes(gender)) {
			return res.status(400).json({
				success: false,
				message: "Gender must be male or female!",
			});
		}

		const user = await User.findOne({ userName });
		if (user) {
			return res
				.status(400)
				.json({ success: false, message: "User already exists!" });
		}

		const maleAvatar = `https://api.dicebear.com/9.x/open-peeps/svg?seed=${userName}&facialHairProbability=100&accessoriesProbability=0`;
		const femaleAvatar = `https://api.dicebear.com/9.x/open-peeps/svg?seed=${userName}&facialHairProbability=0&longHair=1&accessoriesProbability=50`;

		const newUser = await User.create({
			fullName,
			userName,
			password,
			gender,
			profilePic: gender === "male" ? maleAvatar : femaleAvatar,
		});

		const token = newUser.signToken();
		setCookie(res, token);

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			user: {
				userId: newUser._id,
				fullName: newUser.fullName,
				userName: newUser.userName,
				gender: newUser.gender,
				profilePic: newUser.profilePic,
			},
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { userName, password } = req.body;

	try {
		if (!userName || !password) {
			return res
				.status(400)
				.json({ success: false, message: "All fields are required!" });
		}

		const existingUser = await User.findOne({ userName });
		if (!existingUser) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid credentials!" });
		}

		const isPasswordCorrect = await existingUser.comparePassword(password);

		if (!isPasswordCorrect) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid credentials!" });
		}
		const token = existingUser.signToken();
		setCookie(res, token);

		res.status(200).json({
			success: true,
			message: "User logged in successfully!",
			user: {
				userId: existingUser._id,
				fullName: existingUser.fullName,
				userName: existingUser.userName,
				gender: existingUser.gender,
				profilePic: existingUser.profilePic,
			},
		});
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const logout = async (_, res) => {
	try {
		res.clearCookie("jwt");
		res.status(200).json({
			success: true,
			message: "User logged out successfully!",
		});
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
