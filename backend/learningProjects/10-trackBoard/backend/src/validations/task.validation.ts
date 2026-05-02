import { z } from "zod";

export const addTaskSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	status: z.enum(["todo", "in-progress", "done"]).default("todo"),
});

// export const updateTaskSchema = addTaskSchema.partial();

export const updateTaskSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
	status: z.enum(["todo", "in-progress", "done"]).default("todo").optional(),
});

export type AddTaskInput = z.infer<typeof addTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
