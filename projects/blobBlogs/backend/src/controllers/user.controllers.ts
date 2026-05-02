import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { deleteAccountSchema } from "../schemas/user.schema";
import { sendDeletionMail } from "../configs/nodeMailer";

export const deleteAccount = async (req: Request, res: Response) => {
	const { id } = req.params;
	const result = deleteAccountSchema.safeParse(req.body);

	try {
		if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
			throw new Error("Invalid id format!");
		}

		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid Data!",
			});
		}

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

		const userId = req.user?._id;
		await User.findByIdAndDelete(userId);
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
