import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required!"],
			trim: true,
		},

		email: {
			type: String,
			required: [true, "Email is required!"],
			unique: true,
			trim: true,
			lowercase: true,
		},

		password: {
			type: String,
			required: [true, "Password is required!"],
			minLength: [6, "Password must be at least 6 characters long!"],
		},
	},
	{ timestamps: true },
);

userSchema.pre("save", async function () {
	if (!this.isModified("password")) {
		return;
	}

	try {
		this.password = await bcrypt.hash(this.password, 10);
	} catch (err) {
		console.log(`Error hashing password!`);
	}
});

userSchema.methods.signToken = function (userId) {
	return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

userSchema.methods.comparePassword = async function (password) {
	try {
		return await bcrypt.compare(password, this.password);
	} catch (err) {
		console.log(`Error comparing password! ${err.message}`);
	}
};

const User = mongoose.model("User", userSchema);
export default User;
