import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		min: 4,
	},

	email: {
		type: String,
		required: true,
		unique: true,
	},

	password: {
		type: String,
		required: true,
		min: 6,
	},
});

userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) {
		next;
	}

	try {
		const hashedPassword = bcryptjs.hash(this.password, 10);
		this.password = hashedPassword;
	} catch (err) {
		next(err);
	}
});

userSchema.methods.generateToken = async function () {
	const jwtSecret = process.env.JWT_SECRET;

	try {
		return jwt.sign({ userId: this._id }, jwtSecret, { expiresIn: "7d" });
	} catch (err) {
		console.log(`Error while generating token! ${err.message}`);
	}
};

const User = mongoose.model("User", userSchema);
export default User;
