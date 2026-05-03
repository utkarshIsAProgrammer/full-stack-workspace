/**
 * @file password.routes.ts
 * @description Routes for password management including updates and resets.
 */

import express from "express";
import {
	updatePassword,
	requestPasswordReset,
	verifyOtpAndResetPassword,
} from "../controllers/password.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// Update password for logged-in users
router.post("/update-password", protect, updatePassword);

// Request a password reset OTP
router.post("/request-password-reset", requestPasswordReset);
// Verify OTP and set a new password
router.post("/verify-otp", verifyOtpAndResetPassword);

export { router as passwordRoutes };
