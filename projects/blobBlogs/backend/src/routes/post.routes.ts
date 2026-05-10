import express from "express";
import {
  getPost,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
} from "../controllers/post.controllers";
import { protect } from "../middlewares/auth.middleware";
import upload from "../middlewares/upload.middleware";

const router = express.Router();

router.get("/:id", getPost);
router.get("/", getAllPosts);
router.post("/", protect, upload.single("image"), createPost);
router.put("/:id", protect, upload.single("image"), updatePost);
router.delete("/:id", protect, deletePost);

export { router as postRoutes };
