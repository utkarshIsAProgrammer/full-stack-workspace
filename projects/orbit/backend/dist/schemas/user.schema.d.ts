/**
 * @file user.schema.ts
 * @description Zod validation schemas for user-related inputs.
 */
import { z } from "zod";
/** Schema for user signup */
export declare const signupSchema: z.ZodObject<{
    username: z.ZodString;
    fullName: z.ZodString;
    gender: z.ZodEnum<{
        male: "male";
        female: "female";
        others: "others";
    }>;
    email: z.ZodString;
    bio: z.ZodOptional<z.ZodString>;
    profilePic: z.ZodOptional<z.ZodString>;
    bannerImage: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, z.core.$strip>;
/** Schema for user login */
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
/** Schema for updating password while logged in */
export declare const updatePasswordSchema: z.ZodObject<{
    email: z.ZodString;
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, z.core.$strip>;
/** Schema for requesting password reset via email */
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
/** Schema for verifying OTP and resetting password */
export declare const verifyOtpSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, z.core.$strip>;
/** Schema for account deletion */
export declare const deleteAccountSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
/** Schema for updating profile */
export declare const updateProfileSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    fullName: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<{
        male: "male";
        female: "female";
        others: "others";
    }>>;
    bio: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type updatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type forgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type verifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type deleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type updateProfileInput = z.infer<typeof updateProfileSchema>;
//# sourceMappingURL=user.schema.d.ts.map