import express from "express";
import {
  getPost,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  sharePost,
} from "../controllers/post.controllers";
import { protect } from "../middlewares/auth.middleware";
import upload from "../middlewares/upload.middleware";

const router = express.Router();

router.get("/:postId", getPost);
router.get("/", getAllPosts);
router.post("/", protect, upload.single("image"), createPost);
router.put("/:postId", protect, upload.single("image"), updatePost);
router.delete("/:postId", protect, deletePost);

router.post("/:postId/share", protect, sharePost);

export { router as postRoutes };
