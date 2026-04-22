import { z } from "zod";

export const userSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be 3 characters long!")
		.max(100, "Name must be less than 100 characters!")
		.trim()
		.optional(),
	email: z.string().email("Invalid email!").trim().lowercase(),
	password: z
		.string()
		.min(8, "Password must be 8 characters long!")
		.trim(),
});

export const signupSchema = userSchema;
export const loginSchema = z.object({
	email: z.string().email("Invalid email!").trim().lowercase(),
	password: z.string().min(1, "Password is required!"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
