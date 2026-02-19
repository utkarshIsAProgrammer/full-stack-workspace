import User from "../models/user.model.js";
// import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
	const { username, email, phone, password } = req.body;

	try {
		const userExists = await User.findOne({ email });

		if (userExists) {
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
	res.send("Welcome to the Login page!");
};

export const logout = async (req, res) => {
	res.send("Welcome to the Logout page!");
};
