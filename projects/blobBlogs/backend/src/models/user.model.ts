import mongoose from "mongoose";
import { InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			required: [true, "Username is required!"],
			minlength: [3, "Username must be at least 3 characters long!"],
			maxlength: [100, "Username must be less than 100 characters!"],
			trim: true,
			unique: true,
		},

		email: {
			type: String,
			required: [true, "Email is required!"],
			trim: true,
			lowercase: true,
			unique: true,
		},

		password: {
			type: String,
			required: [true, "Password is required!"],
			min: [8, "Password must be at least 8 characters long!"],
		},

		otp: {
			type: String,
			default: null,
		},

		otpExpiry: {
			type: Date,
			default: null,
		},
	},

	{ timestamps: true },
);

userSchema.pre("save", async function () {
	if (!this.isModified("password")) {
		return;
	}

	this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.signToken = function () {
	return jwt.sign(
		{ userId: this._id },
		process.env.JWT_SECRET || "jwtSecret",
		{
			expiresIn: "7d",
		},
	);
};

userSchema.methods.comparePassword = function (password: string) {
	return bcrypt.compare(password, this.password);
};

export type UserDocument = InferSchemaType<typeof userSchema> & {
	otp?: string | null;
	otpExpiry?: Date | null;
	signToken: () => string;
	comparePassword: (password: string) => Promise<boolean>;
};

export const User = mongoose.model<UserDocument>("User", userSchema);
