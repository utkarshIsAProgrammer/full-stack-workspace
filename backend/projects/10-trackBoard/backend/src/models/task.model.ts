import mongoose from "mongoose";

export interface ITask {
	title: string;
	description: string;
	status: string;
	user: mongoose.Types.ObjectId;
}

const taskSchema = new mongoose.Schema<ITask>(
	{
		title: {
			type: String,
			required: true,
		},

		description: {
			type: String,
			required: true,
		},

		status: {
			type: String,
			enum: ["todo", "in-progress", "done"],
			default: "todo",
		},

		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

export const Task = mongoose.model("Task", taskSchema);
