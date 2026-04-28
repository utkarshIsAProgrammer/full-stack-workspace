import express from "express";
import {
	updatePassword,
	requestPasswordReset,
	verifyOtpAndResetPassword,
} from "../controllers/password.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/update-password", protect, updatePassword);
router.post("/request-password-reset", protect, requestPasswordReset);
router.post("/verify-otp", protect, verifyOtpAndResetPassword);

export { router as passwordRoutes };
