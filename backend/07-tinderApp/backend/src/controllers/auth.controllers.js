import User from "../models/user.model.js";

export const signup = async (req, res) => {
	const { name, email, password, age, gender, genderPreference } = req.body;

	try {
		if (
			!name ||
			!email ||
			!password ||
			!age ||
			!gender ||
			!genderPreference
		) {
			return res.status(400).json({
				success: false,
				message: "Please provide all input fields!",
			});
		}

		if (age < 18) {
			return res.status(400).json({
				success: false,
				message: "You must be at least 18 years old!",
			});
		}

		if (password.length < 6) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 6 characters!",
			});
		}

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res
				.status(400)
				.json({ success: false, message: "User already exists!" });
		}

		const newUser = await User.create({
			name,
			email,
			password,
			age,
			gender,
			genderPreference,
		});

		const token = newUser.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
			secure: process.env.NODE_ENV === "production",
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			newUser,
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body;

	try {
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "Please provide all input fields!",
			});
		}

		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res
				.status(404)
				.json({ success: false, message: "User doesn't exist!" });
		}

		if (!(await existingUser.comparePassword(password))) {
			return res
				.status(400)
				.json({ success: false, message: "Incorrect credentials!" });
		}

		const token = existingUser.signToken();

		res.cookie("jwt", token, {
			httpOnly: true,
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
			secure: process.env.NODE_ENV === "production",
		});

		res.status(200).json({
			success: true,
			message: "User logged in successfully!",
			existingUser,
		});
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const logout = async (req, res) => {
	try {
		res.clearCookie("jwt");
		res.status(200).json({
			success: true,
			message: "User logged out successfully!",
		});
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(200).json({ message: "Internal server error!" });
	}
};
