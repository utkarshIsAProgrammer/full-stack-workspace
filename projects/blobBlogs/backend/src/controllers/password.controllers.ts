/**
 * @file password.controllers.ts
 * @description Controllers for password management, including updates and OTP-based resets.
 */

import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import {
	updatePasswordSchema,
	forgotPasswordSchema,
	verifyOtpSchema,
} from "../schemas/user.schema";
import {
	sendPasswordUpdateMail,
	sendForgotPasswordMail,
	sendOtpMail,
} from "../configs/nodeMailer";
import { generateOTP } from "../configs/generateOtp";

/**
 * Updates the password for a logged-in user.
 * @async
 * @function updatePassword
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Success or error message.
 */
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

		// req.user is populated by protect middleware
		const user = await User.findById(req.user?._id);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		// Check current password
		const isMatch = await user.comparePassword(result.data.currentPassword);
		if (!isMatch) {
			return res
				.status(401)
				.json({ success: false, message: "Incorrect Password!" });
		}

		// Prevent setting the same password
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

		// Update and save new password (hashed by pre-save hook)
		user.password = result.data.newPassword;
		await user.save();

		res.status(200).json({
			success: true,
			message: "Password updated successfully!",
		});

		// Notify user via email
		sendPasswordUpdateMail({
			email: user.email,
			username: user.username,
		});
	} catch (err: any) {
		console.log(`Error in the updatePassword controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

/**
 * Initiates a password reset process by generating and sending an OTP.
 * @async
 * @function requestPasswordReset
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Success or error message.
 */
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

		// Generate and hash OTP for secure storage
		const otp = generateOTP();
		const hashedOTP = await bcrypt.hash(otp, 10);

		user.otp = hashedOTP;
		user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

		await user.save();

		res.status(200).json({
			success: true,
			message: "OTP sent successfully!",
		});

		// Send raw OTP to user via email
		await sendOtpMail({ email: user.email, username: user.username }, otp);
	} catch (err: any) {
		console.log(
			`Error in the requestPasswordReset controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};

/**
 * Verifies the OTP and resets the user's password.
 * @async
 * @function verifyOtpAndResetPassword
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Success or error message.
 */
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

		// Check if OTP exists and is valid
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

		// Prevent setting the same password
		const isSamePassword = await bcrypt.compare(newPassword, user.password);
		if (isSamePassword) {
			return res.status(400).json({
				success: false,
				message: "Current password and new password can't be same!",
			});
		}

		// Update password and clear OTP fields
		user.password = newPassword;
		user.otp = null;
		user.otpExpiry = null;

		await user.save();

		res.status(200).json({
			success: true,
			message: "Password reset successfully!",
		});

		// Send confirmation email
		await sendForgotPasswordMail({
			email: user.email,
			username: user.username,
		});
	} catch (err: any) {
		console.log(
			`Error in the verifyOtpAndResetPassword controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};
