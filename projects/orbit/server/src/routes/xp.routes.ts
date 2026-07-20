import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/ratelimit.middleware";
import { getMyXP, getUserXP } from "../controllers/xp.controllers";

const router = Router();
router.use(protect, generalLimiter);
router.get("/", getMyXP);
router.get("/:userId", getUserXP);
export default router;
