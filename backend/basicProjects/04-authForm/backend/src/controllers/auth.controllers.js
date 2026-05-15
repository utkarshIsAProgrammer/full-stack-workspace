import User from "../models/user.model.js";

export const signup = async (req, res) => {
	const { username, email, password } = req.body;
	if (!username || !email || !password) {
		return res.status(400).json({ message: "All fields are required!" });
	}

	if (username.length < 4) {
		return res
			.status(400)
			.json({ message: "Username must be at least 4 characters!" });
	}

	if (password.length < 6) {
		return res
			.status(400)
			.json({ message: "Password must be at least 6 characters!" });
	}

	try {
		const userExists = await User.findOne({ email });
		if (userExists) {
			return res.status(400).json({ message: "User already exists!" });
		}

		const newUser = User.create({ username, email, password });
		const token = await newUser.generateToken();

		res.cookies("jwt", token, {
			maxAge: 7 * 24 * 60 * 60 * 100,
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			newUser,
		});
	} catch (err) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
