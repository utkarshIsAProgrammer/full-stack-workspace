import User from "../models/user.model.js";

export const signup = async (req, res) => {
	const { username, email, password } = req.body;

	try {
		const user = await User.findOne({ email });
		if (user) {
			return res
				.status(400)
				.json({ success: false, message: "User already exists!" });
		}

		const newUser = await User.create({ username, email, password });
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

		const checkPassword = await user.comparePassword(password);
		if (checkPassword) {
			return res.status(200).json({
				success: true,
				message: "Login successful!",
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
