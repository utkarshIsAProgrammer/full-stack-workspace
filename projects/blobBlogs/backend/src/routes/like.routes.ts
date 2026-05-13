import express from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  togglePostLikes,
  toggleCommentLikes,
} from "../controllers/like.controllers";

const router = express.Router();

router.post("/post/:postId", protect, togglePostLikes);
router.post("/comment/:commentId", protect, toggleCommentLikes);

export { router as likeRoutes };
