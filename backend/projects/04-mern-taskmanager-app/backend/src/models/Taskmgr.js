import mongoose from "mongoose";
import mongooseDelete from "mongoose-delete";

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
			enum: ["pending", "completed", "in-progress"],
			default: "pending",
		},

		priority: {
			type: String,
			enum: ["low", "medium", "high"],
			default: "medium",
		},

		dueDate: {
			type: Date, // yy|mm|dd
		},
	},

	{ timestamps: true }
);

// use plugin
taskSchema.plugin(mongooseDelete, { overrideMethods: true });

// model
const TaskModel = mongoose.model("Task", taskSchema);
export default TaskModel;
