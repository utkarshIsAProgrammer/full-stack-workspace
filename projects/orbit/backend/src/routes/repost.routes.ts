import express from "express";
import { protect } from "../middlewares/auth.middleware";
import { toggleRepost } from "../controllers/repost.controllers";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.post("/:postId", protect, interactionLimiter, toggleRepost);

export { router as repostRoutes };
