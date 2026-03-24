import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		title: {
			type: String,
			required: [true, "Title is required!"],
			trim: true,
		},

		amount: {
			type: Number,
			required: [true, "Amount is required!"],
		},

		category: {
			type: String,
			required: [true, "Category is required!"],
		},

		type: {
			type: String,
			enum: ["credit", "debit"],
			required: [true, "Type `credit/debit` must be provided!"],
		},

		date: {
			type: Date,
			default: Date.now(),
		},
	},
	{ timestamps: true },
);

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
