import mongoose from "mongoose";
import { TaskInput } from "../schemas/task.schema";
import { InferSchemaType } from "mongoose";

const taskSchema = new mongoose.Schema<TaskInput>(
	{
		title: {
			type: String,
			required: [true, "Title is required!"],
			minlength: [3, "Title must be 3 characters long!"],
			maxlength: [100, "Title must be less than 100 characters!"],
		},

		description: {
			type: String,
		},

		status: {
			type: String,
			enum: ["todo", "in progress", "done"],
			default: "todo",
		},

		priority: {
			type: String,
			enum: ["low", "medium", "high"],
			default: "medium",
		},

		dueDate: {
			type: Date,
			default: Date.now,
		},

		isDeleted: {
			type: Boolean,
			default: false,
		},
	},

	{ timestamps: true },
);

type TaskDocument = InferSchemaType<typeof taskSchema>;

export const Task = mongoose.model<TaskDocument>("Task", taskSchema);
