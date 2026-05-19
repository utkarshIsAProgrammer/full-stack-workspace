import express from "express";
import {
  toggleSavePost,
  getSavedPosts,
} from "../controllers/saves.controllers";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.post("/:postId", protect, interactionLimiter, toggleSavePost);
router.get("/", protect, getSavedPosts);

export { router as saveRoutes };
