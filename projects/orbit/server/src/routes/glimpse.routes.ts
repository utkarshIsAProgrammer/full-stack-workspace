import express from "express";
import {
  getGlimpseFeed,
  createGlimpse,
  viewGlimpse,
  getGlimpse,
} from "../controllers/glimpse.controllers";
import { protect } from "../middlewares/auth.middleware";
import { uploadGlimpseMedia } from "../middlewares/upload.middleware";

const router = express.Router();

// Get glimpse feed
router.get("/feed", protect, getGlimpseFeed);

// Create a glimpse (with image upload)
router.post("/", protect, uploadGlimpseMedia.single("media"), createGlimpse);

// View a glimpse (mark as viewed)
router.post("/:glimpseId/view", protect, viewGlimpse);

// Get single glimpse
router.get("/:glimpseId", protect, getGlimpse);

export { router as glimpseRoutes };
