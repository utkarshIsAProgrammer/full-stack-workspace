import z from "zod";

export const createPostSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters long!")
    .max(500, "Title must be less than 500 characters!"),

  content: z
    .string()
    .min(5, "Content must be at least 5 characters long!")
    .max(5000, "Content must be less than 5000 characters!"),

  image: z.string().optional(),
});

export const updatePostSchema = z
  .object({
    title: z
      .string()
      .min(5, "Title must be at least 5 characters long!")
      .max(500, "Title must be less than 500 characters!")
      .optional(),

    content: z
      .string()
      .min(5, "Content must be at least 5 characters long!")
      .max(5000, "Content must be less than 5000 characters!")
      .optional(),

    image: z.string().optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: "At least one of title or content must be provided!",
    path: ["title"],
  });

type createPostSchemaInput = z.infer<typeof createPostSchema>;
type updateSchemaInput = z.infer<typeof updatePostSchema>;
