import express from "express";
import {
	getAll,
	signup,
	login,
	logout,
	updatePassword,
	requestPasswordReset,
	verifyOtpAndResetPassword,
} from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", getAll);

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protect, logout);

router.post("/update-password", protect, updatePassword);
router.post("/request-password-reset", protect, requestPasswordReset);
router.post("/verify-otp", protect, verifyOtpAndResetPassword);

export { router as authRoutes };
