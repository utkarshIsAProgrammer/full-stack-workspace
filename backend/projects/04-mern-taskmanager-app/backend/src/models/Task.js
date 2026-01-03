import mongoose from "mongoose";

// schema
const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},

		description: {
			type: String,
		},

		status: {
			type: String,
			enum: ["todo", "in progress", "done"],
			default: "todo",
		},

		dueDate: {
			type: String,
		},

		priority: {
			type: String,
			enum: ["low", "medium", "high"],
		},
	},
	{ timestamps: true }
);

// model
const TaskModel = mongoose.model("Task", taskSchema);

export default TaskModel;
