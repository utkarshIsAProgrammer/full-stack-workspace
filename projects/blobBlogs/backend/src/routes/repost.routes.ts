import express from "express";
import { protect } from "../middlewares/auth.middleware";
import { toggleRepost } from "../controllers/repost.controllers";

const router = express.Router();

router.post("/:postId", protect, toggleRepost);

export { router as repostRoutes };
