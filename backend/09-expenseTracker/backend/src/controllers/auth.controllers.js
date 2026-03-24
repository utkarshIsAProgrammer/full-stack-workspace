import User from "../models/user.model.js";

export const signup = async (req, res) => {
	const { name, email, password } = req.body;

	try {
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "All fields must be provided!",
			});
		}

		const emailRegex =
			/^(?!.*\.\.)(?!.*\.$)[^\W][A-Za-z0-9._%+-]{0,63}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				success: false,
				message: "Invalid email format!",
			});
		}

		if (password.length < 6) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 6 characters long!",
			});
		}

		const userExists = await User.findOne({ email });
		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		const user = await User.create({ name, email, password });
		const token = user.signToken();

		res.cookie("jwt", token, {
			httpOnly: true,
			sameSite: "lax", // ← changed from "none" to "lax"
			secure: false,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			user: {
				userId: user._id,
				name: user.name,
				email: user.email,
			},
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body;

	try {
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "All fields must be provided!",
			});
		}

		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res.status(404).json({
				success: false,
				message: "User doesn't exist!",
			});
		}

		if (!(await existingUser.comparePassword(password))) {
			return res.status(400).json({
				success: false,
				message: "Invalid credentials!",
			});
		}

		const token = existingUser.signToken();

		res.cookie("jwt", token, {
			httpOnly: true,
			sameSite: "lax", // ← changed from "none" to "lax"
			secure: false,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(200).json({
			success: true,
			message: "Logged in successfully!",
		});
	} catch (err) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};

export const logout = async (req, res) => {
	try {
		res.clearCookie("jwt", {
			httpOnly: true,
			sameSite: "lax", // ← must match how it was set
			secure: false,
		});
		res.status(200).json({
			success: true,
			message: "Logged out successfully!",
		});
	} catch (err) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};
