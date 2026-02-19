import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			required: true,
		},

		email: {
			type: String,
			required: true,
		},

		phone: {
			type: Number,
			required: true,
		},

		password: {
			type: String,
			required: true,
		},

		isAdmin: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true },
);

// password hashing
userSchema.pre("save", async function (next) {
	const user = this;

	// if password is not modified or not created then call next()
	if (!user.isModified("password")) {
		next();
	}

	try {
		const hashedPassword = await bcrypt.hash(user.password, 10);
		user.password = hashedPassword;
	} catch (err) {
		next(err);
	}
});

// generate jwt token
userSchema.methods.generateToken = async function () {
	const user = this;
	const jwtSecret = process.env.JWT_SECRET;
	try {
		return jwt.sign(
			{
				userId: user._id.toString(),
				email: user.email,
				isAdmin: user.isAdmin,
			},
			jwtSecret,
			{ expiresIn: "7d" },
		);
	} catch (err) {
		console.log(`JWT error! ${err.message}`);
	}
};

const User = mongoose.model("User", userSchema);
export default User;
