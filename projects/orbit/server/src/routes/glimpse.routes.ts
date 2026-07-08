import express from "express";
import {
  getGlimpseFeed,
  createGlimpse,
  viewGlimpse,
  getGlimpse,
  deleteGlimpse,
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

// Delete a glimpse
router.delete("/:glimpseId", protect, deleteGlimpse);

export { router as glimpseRoutes };
