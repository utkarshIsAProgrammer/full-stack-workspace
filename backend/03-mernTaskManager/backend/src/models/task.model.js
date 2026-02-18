import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId, // user field will store a mongoose id
			ref: "User", // connecting task to user model, (ObjectId belongs to the user collection)
			required: true,
		},

		title: {
			type: String,
			required: true,
		},

		description: {
			type: String,
			maxLength: 1000,
		},

		dueDate: {
			type: Date,
			default: Date.now,
		},

		priority: {
			type: String,
			enum: ["low", "medium", "high"],
			default: "medium",
		},

		status: {
			type: String,
			enum: ["todo", "doing", "done"],
			default: "todo",
		},
	},
	{ timestamps: true },
);

// 1 is ascending and -1 is descending, (add user task index)
taskSchema.index({ user: 1 });

const Task = mongoose.model("Task", taskSchema);
export default Task;
