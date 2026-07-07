import express from "express";
import {
  getPost,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  sharePost,
  viewsCount,
  getPostBySlug,
  getPostsByHashtag,
  pinPost,
  unpinPost,
} from "../controllers/post.controllers";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import { uploadPostMedia } from "../middlewares/upload.middleware";
import { searchLimiter, interactionLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

// Cache GET endpoints for better performance
router.get("/hashtag/:hashtag", optionalAuth, searchLimiter, cacheMiddleware({ ttl: 300 }), getPostsByHashtag);
router.get("/slug/:slug", optionalAuth, cacheMiddleware({ ttl: 300 }), getPostBySlug);
router.get("/:postId", optionalAuth, cacheMiddleware({ ttl: 300 }), getPost);
router.get("/", optionalAuth, cacheMiddleware({ ttl: 60 }), getAllPosts);
router.post(
  "/",
  protect,
  uploadPostMedia.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createPost,
);
router.put(
  "/:postId",
  protect,
  uploadPostMedia.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  updatePost,
);
router.delete("/:postId", protect, deletePost);

router.post("/:postId/view", protectViews, interactionLimiter, viewsCount);
router.post("/:postId/share", protect, interactionLimiter, sharePost);
router.post("/:postId/pin", protect, pinPost);
router.post("/:postId/unpin", protect, unpinPost);

export { router as postRoutes };
