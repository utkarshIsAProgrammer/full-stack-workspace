import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			minLength: 2,
			maxLength: 50,
			trim: true,
		},

		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
		},

		password: {
			type: String,
			required: true,
			minLength: 8,
		},
	},
	{ timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
