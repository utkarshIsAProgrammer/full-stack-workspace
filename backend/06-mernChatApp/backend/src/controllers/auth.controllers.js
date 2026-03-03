import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import { generateTokenAndSetCookie } from "../utils/generateToken.js";

export const signup = async (req, res) => {
	const { fullName, userName, password, confirmPassword, gender } = req.body;
	// check if passwords are same
	if (!(password === confirmPassword)) {
		return res.status(400).json({ error: "Password does not match!" });
	}

	try {
		// check if user exists
		const user = await User.findOne({ userName });
		if (user) {
			return res.status(400).json({ error: "Username already exists!" });
		}

		// hash password
		const hashedPassword = await bcryptjs.hash(password, 10);

		// random gender based profile pic
		const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${userName}.png`;
		const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${userName}.png`;

		// create new user
		const newUser = await User.create({
			fullName,
			userName,
			password: hashedPassword,
			gender,
			profilePic: gender === "male" ? boyProfilePic : girlProfilePic,
		});

		if (newUser) {
			// generate token and set cookie once the user is created
			const token = generateTokenAndSetCookie(res, newUser._id);

			return res.status(201).json({
				success: true,
				message: "User created successfully!",
				newUser,
			});
		} else {
			return res.status(400).json({ error: "Invalid user data!" });
		}
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ error: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { userName, password } = req.body;
	try {
		// check if user exists
		const user = await User.findOne({ userName });

		// check if password is correct
		const isPasswordCorrect = await bcryptjs.compare(
			password,
			user?.password || "",
		);

		// check if user don't exist or incorrect password
		if (!user || !isPasswordCorrect) {
			return res
				.status(400)
				.json({ error: "Invalid userName or password!" });
		}

		// generate token and set cookie if the user exists
		const token = generateTokenAndSetCookie(res, user._id);

		res.status(200).json({
			success: true,
			message: "Login successfully!",
			user,
		});
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ error: "Internal server error!" });
	}
};

export const logout = async (req, res) => {
	try {
		// clear cookie for logout
		res.clearCookie("jwt");
		res.status(200).json({
			success: true,
			message: "Logout successfully!",
		});
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({ error: "Internal server error!" });
	}
};
