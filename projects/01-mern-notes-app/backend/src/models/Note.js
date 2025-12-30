import mongoose from "mongoose";

// schema
const noteSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},

		content: {
			type: String,
			required: true,
		},
	},

	{ timestamps: true } // createdAt,, updatedAt
);

// model
const NoteModel = mongoose.model("Note", noteSchema); // "Note" will be converted to "notes" when executed

export default NoteModel;
