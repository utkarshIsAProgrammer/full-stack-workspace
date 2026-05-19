import express from "express";
import {
  getAll,
  deleteAccount,
  shareProfile,
  viewsCount,
} from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/", getAll);
router.delete("/delete-account/", protect, deleteAccount);
router.post("/:userId/share", protect, interactionLimiter, shareProfile);

router.post("/:userId/view", protectViews, interactionLimiter, viewsCount);

export { router as userRoutes };
