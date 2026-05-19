import express from "express";
import {
  getPost,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  sharePost,
  viewsCount,
} from "../controllers/post.controllers";
import { protect } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import upload from "../middlewares/upload.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/:postId", getPost);
router.get("/", getAllPosts);
router.post(
  "/",
  protect,
  upload.single("image"),
  interactionLimiter,
  createPost,
);
router.put(
  "/:postId",
  protect,
  upload.single("image"),
  interactionLimiter,
  updatePost,
);
router.delete("/:postId", protect, deletePost);

router.post("/:postId/view", protectViews, interactionLimiter, viewsCount);
router.post("/:postId/share", protect, interactionLimiter, sharePost);

export { router as postRoutes };
