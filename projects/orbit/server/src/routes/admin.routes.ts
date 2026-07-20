import express from "express";
import {
  createFeatureFlag,
  getFeatureFlags,
  updateFeatureFlag,
  getUserFlags,
  toggleUserMute,
  toggleUserBan,
} from "../controllers/admin.controllers";
import { protect } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

// User-facing: get my feature flags
router.get("/flags/mine", protect, generalLimiter, getUserFlags);

// Admin routes (protected by isAdmin check in controller)
router.get("/flags", protect, generalLimiter, getFeatureFlags);
router.post("/flags", protect, generalLimiter, createFeatureFlag);
router.put("/flags/:flagId", protect, generalLimiter, updateFeatureFlag);

// Admin user management
router.put("/users/:userId/mute", protect, generalLimiter, toggleUserMute);
router.put("/users/:userId/ban", protect, generalLimiter, toggleUserBan);

export { router as adminRoutes };
