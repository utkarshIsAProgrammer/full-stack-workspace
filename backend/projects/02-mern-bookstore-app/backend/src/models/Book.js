import mongoose from "mongoose";

// schema
const bookSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},

		author: {
			type: String,
			required: true,
		},

		publishYear: {
			type: Number,
			required: true,
		},
	},
	{ timestamps: true }
);

// model
const BookModel = mongoose.model("Book", bookSchema);

export default BookModel;
