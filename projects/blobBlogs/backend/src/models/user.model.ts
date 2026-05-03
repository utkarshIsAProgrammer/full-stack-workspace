/**
 * @file user.model.ts
 * @description Mongoose model for User, including schema definitions, hooks, and instance methods.
 */

import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * User schema definition with validation and timestamps.
 */
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

/**
 * Pre-save hook to hash the password before saving it to the database.
 */
userSchema.pre("save", async function () {
	// Only hash the password if it has been modified (or is new)
	if (!this.isModified("password")) {
		return;
	}

	this.password = await bcrypt.hash(this.password, 10);
});

/**
 * Generates a JWT for the user instance.
 * @method signToken
 * @returns {string} The signed JWT.
 * @throws Will throw an error if JWT_SECRET is not defined.
 */
userSchema.methods.signToken = function () {
	if (!process.env.JWT_SECRET) {
		throw new Error("JWT_SECRET not defined");
	}
	return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

/**
 * Compares a plain text password with the hashed password in the database.
 * @async
 * @method comparePassword
 * @param {string} password - The plain text password to compare.
 * @returns {Promise<boolean>} True if passwords match, false otherwise.
 */
userSchema.methods.comparePassword = function (password: string) {
	return bcrypt.compare(password, this.password);
};

// Define type for User instance with custom methods
type UserType = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserType> & {
	otp?: string | null;
	otpExpiry?: Date | null;
	signToken: () => string;
	comparePassword: (password: string) => Promise<boolean>;
};

/**
 * Mongoose Model for User.
 */
export const User = mongoose.model<UserDocument>("User", userSchema);
