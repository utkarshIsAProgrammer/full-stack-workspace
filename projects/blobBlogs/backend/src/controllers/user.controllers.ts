/**
 * @file user.controllers.ts
 * @description Controllers for user-specific operations, such as account deletion.
 */

import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { deleteAccountSchema } from "../schemas/user.schema";
import { sendDeletionMail } from "../configs/nodeMailer";

/**
 * Deletes the authenticated user's account.
 * Validates credentials before deletion and sends a confirmation email.
 * @async
 * @function deleteAccount
 * @param {Request} req - Express request object.
 * @param {Response} res - Express response object.
 * @returns {Promise<Response>} Success or error message.
 */
export const deleteAccount = async (req: Request, res: Response) => {
	const result = deleteAccountSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid Data!",
			});
		}

		// Find user and verify credentials
		const user = await User.findOne({ email: result.data.email });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found!",
			});
		}

		const isMatch = await user.comparePassword(result.data.password);
		if (!isMatch) {
			return res.status(400).json({
				success: false,
				message: "Invalid credentials!",
			});
		}

		// Get user ID from the authentication middleware
		const userId = req.user?._id;
		await User.findByIdAndDelete(userId);

		// Send deletion confirmation email
		sendDeletionMail({
			email: user.email,
			username: user.username,
		});

		res.status(200).json({
			success: true,
			message: "Account deleted successfully!",
		});
	} catch (err: any) {
		console.log(`Error in the deleteAccount controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
