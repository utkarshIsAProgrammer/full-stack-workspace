import mongoose from "mongoose";

// schema
const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
		},
	},

	{ timestamps: true }
);

// model
const UserModel = mongoose.model("User", userSchema);

export default UserModel;
