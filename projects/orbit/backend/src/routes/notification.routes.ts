import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
} from "../controllers/notification.controllers";
import { protect } from "../middlewares/auth.middleware";
import { notificationLimiter } from "../middlewares/ratelimit.middleware";

const router = express.Router();

router.get("/unread-count", protect, notificationLimiter, getUnreadCount);
router.get("/", protect, notificationLimiter, getNotifications);
router.put("/mark-as-read", protect, notificationLimiter, markAsRead);
router.put("/mark-as-read/:notificationId", protect, notificationLimiter, markAsRead);

export { router as notificationRoutes };
