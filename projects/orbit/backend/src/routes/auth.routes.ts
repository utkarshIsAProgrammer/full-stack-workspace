import express from "express";
import { signup, login, logout, getCurrentUser } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/ratelimit.middleware";
import upload from "../middlewares/upload.middleware";

const router = express.Router();

router.post(
  "/signup",
  authLimiter,
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  signup
);
router.post("/login", authLimiter, login);
router.post("/logout", protect, logout);
router.get("/me", protect, getCurrentUser);

export { router as authRoutes };
