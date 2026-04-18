import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required!"],
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
			minlength: [8, "Password must be at least 8 characters long!"],
		},

		cartItems: [
			{
				quantity: {
					type: Number,
					default: 1,
				},

				product: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Product",
				},
			},
		],

		role: {
			type: String,
			default: "customer",
			enum: ["customer", "admin"],
		},
	},

	{ timestamps: true },
);

userSchema.pre("save", async function () {
	if (!this.isModified("password")) return;

	try {
		this.password = await bcrypt.hash(this.password, 10);
	} catch (err) {
		throw new Error(err.message);
	}
});

userSchema.methods.comparePassword = async function (password) {
	return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
