import mongoose from "mongoose";
import { InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required!"],
			minlength: [3, "Name must be 3 characters long!"],
			maxlength: [100, "Name must be less than 100 characters!"],
		},
		email: {
			type: String,
			required: [true, "Email is required!"],
			unique: true,
		},
		password: {
			type: String,
			required: [true, "Password is required!"],
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

userSchema.methods.comparePassword = async function (password: string) {
	return bcrypt.compare(password, this.password);
};

type UserDocument = InferSchemaType<typeof userSchema> & {
	signToken: () => string;
	comparePassword: (password: string) => Promise<boolean>;
};

export const User = mongoose.model<UserDocument>("User", userSchema);
