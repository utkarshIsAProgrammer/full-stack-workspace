import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},

		description: {
			type: String,
			default: "",
		},

		completed: {
			type: Boolean,
			default: false,
		},

		dueDate: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true },
);

const Task = mongoose.model("Task", taskSchema);
export default Task;
