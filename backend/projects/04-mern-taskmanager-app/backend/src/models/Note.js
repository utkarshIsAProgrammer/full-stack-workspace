import mongoose from "mongoose";
import mongooseDelete from "mongoose-delete";

// schema
const noteSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trimmed: true,
		},

		content: {
			type: String,
		},
	},
	{ timestamps: true }
);

// plugin
noteSchema.plugin(mongooseDelete, { overrideMethods: true });

// model
const noteModel = mongoose.model("Note", noteSchema);

export default noteModel;
