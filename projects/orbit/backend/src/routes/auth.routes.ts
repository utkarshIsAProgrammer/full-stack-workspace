import express from "express";
import { signup, login, logout } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/ratelimit.middleware";
import upload from "../middlewares/upload.middleware";

const router = express.Router();

router.post("/signup", authLimiter, upload.single("profilePic"), signup);
router.post("/login", authLimiter, login);
router.post("/logout", protect, logout);

export { router as authRoutes };
