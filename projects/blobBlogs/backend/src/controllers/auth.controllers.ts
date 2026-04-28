import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import {
	signupSchema,
	loginSchema,
	updatePasswordSchema,
	forgotPasswordSchema,
	verifyOtpSchema,
} from "../schemas/user.schema";
import {
	sendWelcomeMail,
	sendPasswordUpdateMail,
	sendForgotPasswordMail,
	sendOtpMail,
} from "../configs/nodeMailer";
import { generateOTP } from "../configs/generateOtp";

export const getAll = async (req: Request, res: Response) => {
	try {
		const users = await User.find();
		return res.status(200).json({
			success: true,
			mesage: "All users fetched successfully!",
			users,
		});
	} catch (err: any) {
		console.log(`Error in the getAll users controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const signup = async (req: Request, res: Response) => {
	const result = signupSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data",
				error: result.error.issues,
			});
		}

		const userExists = await User.findOne({
			email: result.data.email,
		});

		if (userExists) {
			return res.status(400).json({
				success: false,
				message: "User already exists!",
			});
		}

		const user = new User(result.data);
		await user.save();

		const token = user?.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		sendWelcomeMail({
			email: user.email,
			username: user.username,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully!",
			...user.toObject(),
			password: undefined,
		});
	} catch (err: any) {
		console.log(`Error in the signup controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const login = async (req: Request, res: Response) => {
	const result = loginSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data",
				error: result.error.issues,
			});
		}

		const user = await User.findOne({
			email: result.data.email,
		});

		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User doesn't exists!" });
		}

		const isMatch = await user.comparePassword(result.data.password);
		if (!isMatch) {
			return res
				.status(401)
				.json({ success: false, message: "Invalid credentials!" });
		}

		const token = user.signToken();
		res.cookie("jwt", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(200).json({
			success: true,
			message: "User logged in  successfully!",
			...user.toObject(),
			password: undefined,
		});
	} catch (err: any) {
		console.log(`Error in the login controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const logout = async (req: Request, res: Response) => {
	try {
		res.clearCookie("jwt", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
		});
		res.status(200).json({
			success: true,
			message: "User logged out successfully!",
		});
	} catch (err: any) {
		console.log(`Error in the logout controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const updatePassword = async (req: Request, res: Response) => {
	const result = updatePasswordSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid data!",
				error: result.error.issues,
			});
		}

		const user = await User.findOne({ email: result.data.email });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		const isMatch = await user.comparePassword(result.data.currentPassword);
		if (!isMatch) {
			return res
				.status(401)
				.json({ success: false, message: "Incorrect Password!" });
		}

		const isSamePassword = await bcrypt.compare(
			result.data.newPassword,
			user.password,
		);
		if (isSamePassword) {
			return res.status(400).json({
				success: false,
				message: "Current password and new password can't be same!",
			});
		}

		user.password = result.data.newPassword;
		await user.save();

		res.status(200).json({
			success: true,
			message: "Password updated successfully!",
		});

		sendPasswordUpdateMail({
			email: user.email,
			username: user.username,
		});
	} catch (err: any) {
		console.log(`Error in the updatePassword controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const requestPasswordReset = async (req: Request, res: Response) => {
	const result = forgotPasswordSchema.safeParse(req.body);
	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid Data!",
				error: result.error.issues,
			});
		}

		const user = await User.findOne({ email: result.data.email });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		const otp = generateOTP();
		const hashedOTP = await bcrypt.hash(otp, 10);

		user.otp = hashedOTP;
		user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

		await user.save();

		res.status(200).json({
			success: true,
			message: "OTP sent successfully!",
		});

		await sendOtpMail({ email: user.email, username: user.username }, otp);
	} catch (err: any) {
		console.log(
			`Error in the requestPasswordReset controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const verifyOtpAndResetPassword = async (
	req: Request,
	res: Response,
) => {
	const result = verifyOtpSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({ message: "Invalid data!" });
		}

		const { email, otp, newPassword } = result.data;

		const user = await User.findOne({ email });
		if (!user) return res.status(404).json({ message: "User not found!" });

		if (!user.otp || !user.otpExpiry) {
			return res.status(400).json({ message: "OTP not found!" });
		}

		if (user.otpExpiry < new Date()) {
			return res.status(400).json({ message: "OTP expired!" });
		}

		const isValid = await bcrypt.compare(otp, user.otp);
		if (!isValid) {
			return res.status(400).json({ message: "Invalid OTP!" });
		}

		const isSamePassword = await bcrypt.compare(
			result.data.newPassword,
			user.password,
		);
		if (isSamePassword) {
			return res.status(400).json({
				success: false,
				message: "Current password and new password can't be same!",
			});
		}
		user.password = newPassword;

		user.otp = null;
		user.otpExpiry = null;

		await sendForgotPasswordMail({
			email: user.email,
			username: user.username,
		});

		await user.save();

		res.status(200).json({
			success: true,
			message: "Password reset successfully!",
		});
	} catch (err: any) {
		console.log(
			`Error in the verifyOtpAndResetPassword controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};
