import express from "express";
import {
  getComment,
  getAllComments,
  getAllCommentsForPost,
  getCommentReplies,
  addComment,
  updateComment,
  deleteComment,
} from "../controllers/comment.controllers";
import { toggleCommentReaction } from "../controllers/commentReaction.controllers";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { commentLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

// Cache GET endpoints for better performance
router.get("/", optionalAuth, cacheMiddleware({ ttl: 60 }), getAllComments);
router.get("/replies/:commentId", optionalAuth, cacheMiddleware({ ttl: 120 }), getCommentReplies);
router.get("/:postId", optionalAuth, cacheMiddleware({ ttl: 60 }), getComment);
router.get("/:postId/all", optionalAuth, cacheMiddleware({ ttl: 30 }), getAllCommentsForPost);

// Comment CRUD operations
router.post("/:postId", protect, commentLimiter, addComment);
router.put("/:commentId", protect, commentLimiter, updateComment);
router.delete("/:commentId", protect, commentLimiter, deleteComment);

// Comment reactions
router.post("/:commentId/reactions", protect, commentLimiter, toggleCommentReaction);

export { router as commentRoutes };
