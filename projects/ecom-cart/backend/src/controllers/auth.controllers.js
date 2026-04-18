import User from "../models/user.model.js";
import { generateTokens } from "../utils/generateTokens.js";
import { storeRefreshToken } from "../utils/storeRefreshTokens.js";
import { setCookies } from "../utils/setCookies.js";

export const register = async (req, res) => {
	const { name, email, password } = req.body;

	try {
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "All fields are required!",
			});
		}

		const userAlreadyExists = await User.findOne({ email });
		if (userAlreadyExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		const user = new User({ name, email, password });

		const { accessToken, refreshToken } = generateTokens(user._id);
		await storeRefreshToken(user._id, refreshToken);
		setCookies(res, accessToken, refreshToken);

		await user.save();

		res.status(201).json({
			success: true,
			message: "User registered successfully!",
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (err) {
		console.log(`Error in the register controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const login = async (req, res) => {};

export const logout = async (req, res) => {};
