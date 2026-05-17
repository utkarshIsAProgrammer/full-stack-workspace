import express from "express";
import {
  getAll,
  deleteAccount,
  shareProfile,
  viewsCount,
} from "../controllers/user.controllers";
import { protect } from "../middlewares/auth.middleware";
import { protectViews } from "../middlewares/view.middleware";

const router = express.Router();

router.get("/", getAll);
router.delete("/delete-account/", protect, deleteAccount);
router.post("/:userId/share", protect, shareProfile);

router.post("/:userId/view", protectViews, viewsCount);

export { router as userRoutes };
