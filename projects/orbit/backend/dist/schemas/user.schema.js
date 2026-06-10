"use strict";
/**
 * @file user.schema.ts
 * @description Zod validation schemas for user-related inputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileSchema = exports.deleteAccountSchema = exports.verifyOtpSchema = exports.forgotPasswordSchema = exports.updatePasswordSchema = exports.loginSchema = exports.signupSchema = void 0;
const zod_1 = require("zod");
/**
 * Base user schema for common fields.
 */
const userSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .min(3, "Name must be at least 3 characters long!")
        .max(100, "Name must be less than 100 characters!")
        .trim()
        .lowercase(),
    fullName: zod_1.z
        .string()
        .min(3, "Full name must be at least 3 characters long!")
        .max(50, "Full name must be less than 50 characters!")
        .trim(),
    gender: zod_1.z.enum(["male", "female", "others"]).optional(),
    email: zod_1.z.string().email("Invalid email format!").trim().lowercase(),
    bio: zod_1.z
        .string()
        .max(300, "Bio must be less than 300 characters!")
        .trim()
        .optional(),
    profilePic: zod_1.z.string().trim().optional().refine((val) => !val || zod_1.z.string().url().safeParse(val).success, "Invalid profile picture URL!"),
    bannerImage: zod_1.z.string().trim().optional().refine((val) => !val || zod_1.z.string().url().safeParse(val).success, "Invalid banner image URL!"),
    password: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters long!")
        .regex(/[A-Z]/, "Must include uppercase letter!")
        .regex(/[a-z]/, "Must include lowercase letter!")
        .regex(/[0-9]/, "Must include number!")
        .regex(/[^A-Za-z0-9]/, "Must include special character!"),
});
/** Schema for user signup */
exports.signupSchema = userSchema
    .extend({
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => {
    if (data.password !== data.confirmPassword) {
        return false;
    }
    return true;
}, {
    message: "Passwords do not match!",
    path: ["confirmPassword"],
});
/** Schema for user login */
exports.loginSchema = zod_1.z.object({
    usernameOrEmail: zod_1.z.string().min(1, "Username or email is required!").trim().toLowerCase(),
    password: zod_1.z.string().min(1, "Password is required!"),
});
/** Schema for updating password while logged in */
exports.updatePasswordSchema = zod_1.z
    .object({
    email: zod_1.z.string().email("Invalid email format!").trim().lowercase().optional(),
    currentPassword: zod_1.z.string().min(1, "Current password is required!"),
    newPassword: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters long!")
        .max(100, "Password must be less than 100 characters!")
        .regex(/[A-Z]/, "Must include uppercase letter!")
        .regex(/[a-z]/, "Must include lowercase letter!")
        .regex(/[0-9]/, "Must include number!")
        .regex(/[^A-Za-z0-9]/, "Must include special character!"),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match!",
    path: ["confirmPassword"],
});
/** Schema for requesting password reset via email */
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format!").trim().lowercase(),
});
/** Schema for verifying OTP and resetting password */
exports.verifyOtpSchema = zod_1.z
    .object({
    email: zod_1.z.string().email("Invalid email format!").trim().lowercase(),
    otp: zod_1.z.string(),
    newPassword: zod_1.z
        .string()
        .min(8, "Password must be at least 8 characters long!")
        .max(100, "Password must be less than 100 characters!")
        .regex(/[A-Z]/, "Must include uppercase letter!")
        .regex(/[a-z]/, "Must include lowercase letter!")
        .regex(/[0-9]/, "Must include number!")
        .regex(/[^A-Za-z0-9]/, "Must include special character!"),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match!",
    path: ["confirmPassword"],
});
/** Schema for account deletion */
exports.deleteAccountSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format!").trim().lowercase(),
    password: zod_1.z.string().min(1, "Password is required!"),
});
/** Schema for updating profile */
exports.updateProfileSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .min(3, "Name must be at least 3 characters long!")
        .max(100, "Name must be less than 100 characters!")
        .trim()
        .lowercase()
        .optional(),
    fullName: zod_1.z
        .string()
        .min(3, "Full name must be at least 3 characters long!")
        .max(50, "Full name must be less than 50 characters!")
        .trim()
        .optional(),
    gender: zod_1.z.enum(["male", "female", "others"]).optional(),
    bio: zod_1.z
        .string()
        .max(300, "Bio must be less than 300 characters!")
        .trim()
        .optional(),
    removeProfilePic: zod_1.z.preprocess((val) => val === "true" || val === true, zod_1.z.boolean().optional()),
    removeBannerImage: zod_1.z.preprocess((val) => val === "true" || val === true, zod_1.z.boolean().optional()),
});
//# sourceMappingURL=user.schema.js.map