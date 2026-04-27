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

const router = express.Router();

router.get("/", getAll);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.post("/update-password", updatePassword);
router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-otp", verifyOtpAndResetPassword);
export { router as authRoutes };
