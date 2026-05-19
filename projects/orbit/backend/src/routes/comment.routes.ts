import express from "express";
import {
  getComment,
  addComment,
  updateComment,
  deleteComment,
} from "../controllers/comment.controllers";
import { protect } from "../middlewares/auth.middleware";
import { commentLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/:postId", getComment);
router.post("/:postId", protect, commentLimiter, addComment);
router.put("/:commentId", protect, commentLimiter, updateComment);
router.delete("/:commentId", protect, deleteComment);

export { router as commentRoutes };
