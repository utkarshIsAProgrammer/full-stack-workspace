import express from "express";
import { signup, login, logout } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", protect, logout);

export { router as authRoutes };
