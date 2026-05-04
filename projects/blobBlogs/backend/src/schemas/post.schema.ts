import z from "zod";

export const createPostSchema = z.object({
	title: z
		.string()
		.min(5, "Title must be at least 5 characters long!")
		.max(300, "Title must be less than 300 characters!"),

	content: z
		.string()
		.min(5, "Content must be at least 5 characters long!")
		.max(1000, "Content must be less than 1000 characters!"),

	published: z.boolean().optional(),
});

export const updatePostSchema = z.object({
	title: z
		.string()
		.min(5, "Title must be at least 5 characters long!")
		.max(300, "Title must be less than 300 characters!")
		.optional(),

	content: z
		.string()
		.min(5, "Content must be at least 5 characters long!")
		.max(1000, "Content must be less than 1000 characters!")
		.optional(),
});

type createPostSchemaInput = z.infer<typeof createPostSchema>;
type updateSchemaInput = z.infer<typeof updatePostSchema>;
