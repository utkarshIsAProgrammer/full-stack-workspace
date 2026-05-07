import express from "express";
import {
	toggleFollowPost,
	getFollowers,
	getFollowing,
} from "../controllers/follow.controllers";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/:userId", protect, toggleFollowPost);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export { router as followRoutes };
