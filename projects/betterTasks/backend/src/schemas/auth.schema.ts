import { z } from "zod";

export const userSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be 3 characters long!")
		.max(100, "Name must be less than 100 characters!")
		.trim(),
	email: z.string().email("Invalid email!").trim().lowercase(),
	password: z
		.string()
		.min(8, "Password must be 8 characters long!")
		.regex(/[A-Z]/, "Must include uppercase letter")
		.regex(/[a-z]/, "Must include lowercase letter")
		.regex(/[0-9]/, "Must include number")
		.regex(/[^A-Za-z0-9]/, "Must include special character")
		.trim(),
});

export const signupSchema = userSchema;
export const loginSchema = z.object({
	email: z.string().email("Invalid email!").trim().lowercase(),
	password: z.string().min(1, "Password is required!"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
