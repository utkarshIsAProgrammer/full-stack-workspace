import express from "express";
import { protect } from "../middlewares/auth.middleware";
import {
	togglePostLikes,
	toggleCommentLikes,
	// getPostLikes,
	// getCommentLikes,
} from "../controllers/like.controllers";

const router = express.Router();

router.post("/post/:postId", protect, togglePostLikes);
// router.get("/post/:postId", protect, getPostLikes);

router.post("/comment/:commentId", protect, toggleCommentLikes);
// router.get("/comment/:commentId", protect, getCommentLikes);

export { router as likeRoutes };
