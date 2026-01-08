import mongoose from "mongoose";
import mongooseDelete from "mongoose-delete";

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

// plugin
noteSchema.plugin(mongooseDelete, { overrideMethods: true });

// model
const NoteModel = mongoose.model("Note", noteSchema); // "Note" will be converted to "notes" when executed

export default NoteModel;
