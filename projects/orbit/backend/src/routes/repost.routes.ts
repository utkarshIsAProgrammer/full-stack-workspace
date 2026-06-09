import express from "express";
import { protect } from "../middlewares/auth.middleware";
import { toggleRepost, getRepostedPosts } from "../controllers/repost.controllers";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

router.post("/:postId", protect, interactionLimiter, toggleRepost);
// Cache GET endpoint for better performance
router.get("/", protect, cacheMiddleware({ ttl: 60 }), getRepostedPosts);

export { router as repostRoutes };
