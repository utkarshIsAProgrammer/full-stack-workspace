import express from "express";
import {
  toggleSavePost,
  getSavedPosts,
  updateSaveFolder,
  getSaveFolders,
} from "../controllers/saves.controllers";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

// Cache GET endpoints for better performance
router.get("/folders", protect, cacheMiddleware({ ttl: 300 }), getSaveFolders);
router.post("/:postId", protect, interactionLimiter, toggleSavePost);
router.patch("/:postId/folder", protect, updateSaveFolder);
router.get("/", protect, cacheMiddleware({ ttl: 60 }), getSavedPosts);

export { router as saveRoutes };
