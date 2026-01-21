import mongoose from "mongoose";

// schema
const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},

		password: {
			type: String,
			required: true,
		},

		name: {
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
		verificationTokeExpiresAt: Date,
	},
	{ timestamps: true },
);

// model
const User = mongoose.model("User", userSchema);

export default User;
