/**
 * @file user.schema.ts
 * @description Zod validation schemas for user-related inputs.
 */

import { z } from "zod";

/**
 * Base user schema for common fields.
 */
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

/** Schema for user signup */
export const signupSchema = userSchema;

/** Schema for user login */
export const loginSchema = z.object({
	email: z.string().email("Invalid email format!").trim().lowercase(),
	password: z.string().min(1, "Password is required!"),
});

/** Schema for updating password while logged in */
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

/** Schema for requesting password reset via email */
export const forgotPasswordSchema = z.object({
	email: z.string().email("Invalid email format!").trim().lowercase(),
});

/** Schema for verifying OTP and resetting password */
export const verifyOtpSchema = z
	.object({
		email: z.string().email("Invalid email format!").trim().lowercase(),
		otp: z.string(),
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

/** Schema for account deletion */
export const deleteAccountSchema = loginSchema;

// Type definitions derived from Zod schemas
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type updatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type forgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type verifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type deleteAccountInput = z.infer<typeof deleteAccountSchema>;
