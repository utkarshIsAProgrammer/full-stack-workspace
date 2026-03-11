import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import cloudinary from "../utils/cloudinary.js";

export const signup = async (req, res) => {
	const { email, fullName, password } = req.body;

	try {
		if (password.length < 6) {
			return res
				.status(400)
				.json({ message: "Password must be at least 6 characters!" });
		}

		// check user exists
		const user = await User.findOne({ email });
		if (user) {
			return res.status(400).json({ message: "Email already exists!" });
		}

		// hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// create new user
		const newUser = await new User({
			email,
			fullName,
			password: hashedPassword,
		});
		if (newUser) {
			// generate token and save user in db
			generateToken(newUser._id, res);
			await newUser.save();

			res.status(201).json({
				message: "User created successfully!",
				newUser,
			});
		} else {
			return res.status(400).json({ message: "Invalid user data!" });
		}
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body;

	try {
		// check user exist
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ message: "Invalid credentials!" });
		}

		// compare password
		const isPasswordCorrect = await bcrypt.compare(password, user.password);
		if (!isPasswordCorrect) {
			return res.status(400).json({ message: "Invalid credentials!" });
		}

		// generate token
		generateToken(user._id, res);

		res.status(200).json({ message: "Login successful!", user });
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const logout = async (_, res) => {
	try {
		res.clearCookie("jwt");
		res.status(200).json({ message: "Logout successfully!" });
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const updateProfile = async (req, res) => {
	try {
		// get profile pic and user id
		const { profilePic } = req.body;
		const userId = req.user._id;

		if (!profilePic) {
			return res
				.status(400)
				.json({ message: "Profile pic is required!" });
		}

		// upload profile pic using cloudinary
		const uploadResponse = await cloudinary.uploader.upload(profilePic);
		const updatedUser = await User.findByIdAndUpdate(
			userId,
			{
				// update profile pic using cloudinary
				profilePic: uploadResponse.secure_url,
			},
			{ new: true },
		);

		res.status(200).json({
			message: "Profile pic updated successfully!",
			updatedUser,
		});
	} catch (err) {
		console.log(`Error in the updateProfile controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const checkAuth = (req, res) => {
	try {
		// send user back to the client
		res.status(200).json(req.user);
	} catch (err) {
		console.log(`Error in the checkAuth controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
