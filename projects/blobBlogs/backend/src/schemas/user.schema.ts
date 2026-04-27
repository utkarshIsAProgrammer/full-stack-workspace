import { z } from "zod";

const userSchema = z.object({
	username: z
		.string()
		.min(3, "Name must be at least 3 characters long!")
		.max(100, "Name must be less than 100 characters!")
		.trim(),

	email: z.string().email("Invalid email format!").trim().lowercase(),

	password: z
		.string()
		.min(8, "Password must be at least 8 characters long!")
		.regex(/[A-Z]/, "Must include uppercase letter!")
		.regex(/[a-z]/, "Must include lowercase letter!")
		.regex(/[0-9]/, "Must include number!")
		.regex(/[^A-Za-z0-9]/, "Must include special character!"),
});

export const signupSchema = userSchema;
export const loginSchema = z.object({
	email: z.string().email("Invalid email format!").trim().lowercase(),
	password: z.string().min(1, "Password is required!"),
});

export const updatePasswordSchema = z
	.object({
		email: z.string().email("Invalid email format!").trim().lowercase(),
		currentPassword: z.string().min(1, "Current password is required!"),
		newPassword: z
			.string()
			.min(8, "Password must be at least 8 characters long!")
			.regex(/[A-Z]/, "Must include uppercase letter!")
			.regex(/[a-z]/, "Must include lowercase letter!")
			.regex(/[0-9]/, "Must include number!")
			.regex(/[^A-Za-z0-9]/, "Must include special character!"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match!",
		path: ["confirmPassword"],
	});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type updatePasswordInput = z.infer<typeof updatePasswordSchema>;
