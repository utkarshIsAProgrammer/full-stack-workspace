import express from "express";
import {
  updatePassword,
  requestOtpForForgotPassword,
  verifyOtpAndForgotPassword,
} from "../controllers/password.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/request-otp", requestOtpForForgotPassword);
router.post("/verify-and-forgot-password", verifyOtpAndForgotPassword);
router.post("/update-password", protect, updatePassword);

export { router as passwordRoutes };
