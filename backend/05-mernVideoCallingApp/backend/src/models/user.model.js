import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		fullName: {
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
			minLength: 6,
		},

		bio: {
			type: String,
			default: "",
		},

		profilePic: {
			type: String,
			default: "",
		},

		nativeLanguage: {
			type: String,
			default: "",
		},

		learningLanguage: {
			type: String,
			default: "",
		},

		location: {
			type: String,
			default: "",
		},

		isOnboarded: {
			type: Boolean,
			default: false,
		},

		friends: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
	},

	{ timestamps: true },
);

// hash password
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) {
		return next();
	}
	try {
		const hashedPassword = await bcrypt.hash(this.password, 10);
		this.password = hashedPassword;
		next;
	} catch (err) {
		next(err);
	}
});

// generate token
userSchema.methods.generateToken = async function () {
	return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

// compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
	const isPasswordCorrect = await bcrypt.compare(
		enteredPassword,
		this.password,
	);
	return isPasswordCorrect;
};

const User = mongoose.model("User", userSchema);
export default User;
