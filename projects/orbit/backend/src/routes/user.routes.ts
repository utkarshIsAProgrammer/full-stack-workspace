import express from "express";
import {
  getAll,
  deleteAccount,
  shareProfile,
  viewsCount,
  updateProfile,
} from "../controllers/user.controllers";
import upload from "../middlewares/upload.middleware";
import { protect } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/", getAll);
router.delete("/delete-account/", protect, deleteAccount);
router.post("/:userId/share", protect, interactionLimiter, shareProfile);

router.post("/:userId/view", protectViews, interactionLimiter, viewsCount);
router.put(
  "/update-profile",
  protect,
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
  ]),
  updateProfile,
);

export { router as userRoutes };
