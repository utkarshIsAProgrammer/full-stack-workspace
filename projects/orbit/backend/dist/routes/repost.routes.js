"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repostRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const repost_controllers_1 = require("../controllers/repost.controllers");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.repostRoutes = router;
router.post("/:postId", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, repost_controllers_1.toggleRepost);
// Cache GET endpoint for better performance
router.get("/", auth_middleware_1.protect, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), repost_controllers_1.getRepostedPosts);
//# sourceMappingURL=repost.routes.js.map