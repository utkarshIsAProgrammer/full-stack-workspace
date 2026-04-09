import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface IUser {
	_id: mongoose.Types.ObjectId;
	name: string;
	email: string;
	password: string;
	signToken(): string;
}

const userSchema = new mongoose.Schema<IUser>(
	{
		name: {
			type: String,
			required: true,
			minlength: 3,
			maxlength: 30,
		},

		email: {
			type: String,
			required: true,
			unique: true,
		},

		password: {
			type: String,
			required: true,
			minlength: 6,
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

userSchema.methods.signToken = function (this: IUser): string {
	const jwtSecret = process.env.JWT_SECRET;
	if (!jwtSecret) {
		throw new Error("JWT_SECRET is not defined!");
	}
	return jwt.sign({ userId: this._id }, jwtSecret, {
		expiresIn: "7d",
	});
};

const User = mongoose.model("User", userSchema);
export default User;
