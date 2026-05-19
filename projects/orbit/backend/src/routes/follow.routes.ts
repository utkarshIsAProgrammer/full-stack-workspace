import express from "express";
import {
  toggleFollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/follow.controllers";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.post("/:userId", protect, interactionLimiter, toggleFollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export { router as followRoutes };
