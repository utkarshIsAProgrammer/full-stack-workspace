import express from "express";
import {
  toggleSavePost,
  getSavedPosts,
} from "../controllers/saves.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/:postId", protect, toggleSavePost);
router.get("/", protect, getSavedPosts);

export { router as saveRoutes };
