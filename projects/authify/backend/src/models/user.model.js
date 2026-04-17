import mongoose from "mongoose";
import { union } from "zod";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},

		email: {
			type: String,
			required: true,
			unique: true,
		},

		password: {
			type: String,
			required: true,
		},

		lastLogin: {
			type: Date,
			default: Date.now,
		},

		isVerified: {
			type: Boolean,
			default: false,
		},

		resetPasswordToken: String,
		resetPasswordExpiresAt: Date,
		verificationToken: String,
		verificationTokenExpiresAt: Date,
	},
	{ timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
