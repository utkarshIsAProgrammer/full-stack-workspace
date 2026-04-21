import { z } from "zod";

export const taskSchema = z.object({
	title: z
		.string()
		.min(3, "Title must be 3 characters long!")
		.max(100, "Title must be less than 100 characters!"),
	description: z.string().optional(),
	status: z.enum(["todo", "in progress", "done"]).default("todo"),
	priority: z.enum(["low", "medium", "high"]).default("medium"),
	dueDate: z.coerce.date().default(() => new Date()),
	isDeleted: z.boolean().default(false),
});

export const createTaskSchema = taskSchema;
export const updateTaskSchema = taskSchema.partial().omit({ isDeleted: true });

export type TaskInput = z.infer<typeof createTaskSchema>;
export type TaskUpdate = z.infer<typeof updateTaskSchema>;
