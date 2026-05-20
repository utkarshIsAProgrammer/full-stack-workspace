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
const router = express_1.default.Router();
exports.notificationRoutes = router;
router.get("/unread-count", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.getUnreadCount);
router.get("/", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.getNotifications);
router.put("/mark-as-read", auth_middleware_1.protect, ratelimit_middleware_1.notificationLimiter, notification_controllers_1.markAsRead);
//# sourceMappingURL=notification.routes.js.map