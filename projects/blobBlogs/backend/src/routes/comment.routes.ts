import express from "express";
import {
	getComment,
	addComment,
	updateComment,
	deleteComment,
} from "../controllers/comment.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/:id", protect, getComment);
router.post("/:postId", protect, addComment);
router.put("/:id", protect, updateComment);
router.delete("/:id", protect, deleteComment);

export { router as commentRoutes };
