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

// hash password
userSchema.pre("save", async function (next) {
	const user = this;
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

// generate token
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
		console.log(`JWT Error! ${err.message}`);
	}
};

// compare password
userSchema.methods.comparePassword = async function (password) {
	const user = this;
	return bcrypt.compare(password, user.password);
};

const User = mongoose.model("User", userSchema);
export default User;
