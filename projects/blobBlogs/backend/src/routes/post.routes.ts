import express from "express";
import {
	getPost,
	getAllPosts,
	createPost,
	updatePost,
	deletePost,
} from "../controllers/post.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/:id", protect, getPost);
router.get("/", protect, getAllPosts);
router.post("/", protect, createPost);
router.post("/:id", protect, updatePost);
router.post("/:id", protect, deletePost);

export { router as postRoutes };
