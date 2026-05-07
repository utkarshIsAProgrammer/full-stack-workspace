import express from "express";
import {
	getComment,
	addComment,
	updateComment,
	deleteComment,
} from "../controllers/comment.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/:postId", protect, getComment);
router.post("/:postId", protect, addComment);
router.put("/:commentId", protect, updateComment);
router.delete("/:commentId", protect, deleteComment);

export { router as commentRoutes };
