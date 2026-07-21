import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { generalLimiter } from "../middlewares/ratelimit.middleware";
import { getAnalyticsOverview, getAnalyticsPosts, getAnalyticsEngagement } from "../controllers/analytics.controller";

const router = Router();
router.use(protect, generalLimiter);
router.get("/overview", getAnalyticsOverview);
router.get("/posts", getAnalyticsPosts);
router.get("/engagement", getAnalyticsEngagement);

export default router;
