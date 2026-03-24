import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		fullName: {
			type: String,
			required: [true, "Full name is required!"],
			trim: true,
		},

		userName: {
			type: String,
			required: [true, "Username is required!"],
			unique: [true, "Username already exists!"],
			trim: true,
		},

		password: {
			type: String,
			required: [true, "Password is required!"],
			minLength: [6, "Password must be at least 6 characters long!"],
		},

		gender: {
			type: String,
			required: [true, "Gender is required!"],
			enum: ["male", "female"],
		},

		profilePic: {
			type: String,
			default: "",
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
	return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

userSchema.methods.comparePassword = async function (password) {
	return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
