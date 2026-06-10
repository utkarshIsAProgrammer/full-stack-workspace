"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_controllers_1 = require("../controllers/user.controllers");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const view_middleware_1 = require("../middlewares/view.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const password_controllers_1 = require("../controllers/password.controllers");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.userRoutes = router;
// Cache GET endpoints for better performance
router.get("/", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), user_controllers_1.getAll);
router.get("/suggestions", auth_middleware_1.protect, (0, cache_middleware_1.cacheMiddleware)({ ttl: 120 }), user_controllers_1.getSuggestedUsers);
router.get("/username/:username", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), user_controllers_1.getUserByUsername);
router.get("/:userId", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), user_controllers_1.getUserById);
router.get("/:userId/posts", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), user_controllers_1.getUserPosts);
router.get("/:userId/pinned", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), user_controllers_1.getPinnedPosts);
router.delete("/delete-account", auth_middleware_1.protect, user_controllers_1.deleteAccount);
router.post("/:userId/share", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, user_controllers_1.shareProfile);
router.post("/:userId/pin", auth_middleware_1.protect, user_controllers_1.pinPost);
router.post("/:userId/unpin", auth_middleware_1.protect, user_controllers_1.unpinPost);
router.post("/:userId/view", view_middleware_1.protectViews, ratelimit_middleware_1.interactionLimiter, user_controllers_1.viewsCount);
router.put("/update-password", auth_middleware_1.protect, ratelimit_middleware_1.authLimiter, password_controllers_1.updatePassword); // Client alias
router.put("/update-profile", auth_middleware_1.protect, upload_middleware_1.default.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
]), user_controllers_1.updateProfile);
//# sourceMappingURL=user.routes.js.map