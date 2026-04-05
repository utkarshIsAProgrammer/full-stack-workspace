import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},

	email: {
		type: String,
		unique: true,
		required: true,
	},

	password: {
		type: String,
		required: true,
	},

	age: {
		type: Number,
		required: true,
	},

	gender: {
		type: String,
		required: true,
		enum: ["male", "female"],
	},

	genderPreference: {
		type: String,
		required: true,
		enum: ["male", "female", "both"],
	},

	bio: {
		type: String,
		default: "",
	},

	image: {
		type: String,
		default: "",
	},

	likes: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	],

	dislikes: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	],

	matches: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
	],
});

userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) {
		return next;
	}

	this.password = await bcrypt.hash(this.password, 10);
	next;
});

userSchema.methods.comparePassword = async function (enteredPassword) {
	return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.signToken = function () {
	return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

const User = mongoose.model("User", userSchema);
export default User;
