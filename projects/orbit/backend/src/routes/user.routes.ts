import express from "express";
import {
  getAll,
  deleteAccount,
  shareProfile,
  viewsCount,
  updateProfile,
  getUserByUsername,
  getUserPosts,
  getUserById,
  getSuggestedUsers,
  pinPost,
  unpinPost,
  getPinnedPosts,
} from "../controllers/user.controllers";
import upload from "../middlewares/upload.middleware";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import { interactionLimiter, authLimiter } from "../middlewares/ratelimit.middleware";
import { updatePassword } from "../controllers/password.controllers";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

// Cache GET endpoints for better performance
router.get("/", optionalAuth, cacheMiddleware({ ttl: 60 }), getAll);
router.get("/suggestions", protect, cacheMiddleware({ ttl: 120 }), getSuggestedUsers);
router.get("/username/:username", optionalAuth, cacheMiddleware({ ttl: 300 }), getUserByUsername);
router.get("/:userId", optionalAuth, cacheMiddleware({ ttl: 300 }), getUserById);
router.get("/:userId/posts", optionalAuth, cacheMiddleware({ ttl: 60 }), getUserPosts);
router.get("/:userId/pinned", optionalAuth, cacheMiddleware({ ttl: 300 }), getPinnedPosts);
router.delete("/delete-account", protect, deleteAccount);
router.post("/:userId/share", protect, interactionLimiter, shareProfile);
router.post("/:userId/pin", protect, pinPost);
router.post("/:userId/unpin", protect, unpinPost);

router.post("/:userId/view", protectViews, interactionLimiter, viewsCount);
router.put("/update-password", protect, authLimiter, updatePassword); // Client alias
router.put(
  "/update-profile",
  protect,
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  updateProfile,
);

export { router as userRoutes };
