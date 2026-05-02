import express from "express";
import {
	updatePassword,
	requestPasswordReset,
	verifyOtpAndResetPassword,
} from "../controllers/password.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/update-password", protect, updatePassword);

// ! REMOVED (protect) middleware
router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-otp", verifyOtpAndResetPassword);

export { router as passwordRoutes };
