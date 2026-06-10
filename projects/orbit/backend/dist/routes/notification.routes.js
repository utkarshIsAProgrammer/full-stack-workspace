"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const notification_controllers_1 = require("../controllers/notification.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.notificationRoutes = router;
// Cache GET endpoints for better performance
router.get("/unread-count", auth_middleware_1.optionalAuth, ratelimit_middleware_1.notificationLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 30 }), notification_controllers_1.getUnreadCount);
router.get("/", auth_middleware_1.optionalAuth, ratelimit_middleware_1.notificationLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 30 }), notification_controllers_1.getNotifications);
router.delete("/clear-all", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.clearAllNotifications);
router.delete("/", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.clearAllNotifications); // Client alias
router.delete("/:notificationId", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.deleteNotification);
router.put("/mark-as-read", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.markAsRead);
router.put("/read", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.markAsRead); // Client alias
router.put("/mark-as-read/:notificationId", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.markAsRead);
router.put("/:notificationId/read", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.markAsRead); // Client alias
//# sourceMappingURL=notification.routes.js.map