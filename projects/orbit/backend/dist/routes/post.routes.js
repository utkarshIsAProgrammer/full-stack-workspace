"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postRoutes = void 0;
const express_1 = __importDefault(require("express"));
const post_controllers_1 = require("../controllers/post.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const view_middleware_1 = require("../middlewares/view.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.postRoutes = router;
// Cache GET endpoints for better performance
router.get("/hashtag/:hashtag", auth_middleware_1.optionalAuth, ratelimit_middleware_1.searchLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), post_controllers_1.getPostsByHashtag);
router.get("/slug/:slug", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), post_controllers_1.getPostBySlug);
router.get("/:postId", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), post_controllers_1.getPost);
router.get("/", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), post_controllers_1.getAllPosts);
router.post("/", auth_middleware_1.protect, upload_middleware_1.uploadPostImages.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
]), post_controllers_1.createPost);
router.put("/:postId", auth_middleware_1.protect, upload_middleware_1.uploadPostImages.fields([
    { name: "images", maxCount: 10 },
    { name: "image", maxCount: 1 },
]), post_controllers_1.updatePost);
router.delete("/:postId", auth_middleware_1.protect, post_controllers_1.deletePost);
router.post("/:postId/view", view_middleware_1.protectViews, ratelimit_middleware_1.interactionLimiter, post_controllers_1.viewsCount);
router.post("/:postId/share", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, post_controllers_1.sharePost);
router.post("/:postId/pin", auth_middleware_1.protect, post_controllers_1.pinPost);
router.post("/:postId/unpin", auth_middleware_1.protect, post_controllers_1.unpinPost);
//# sourceMappingURL=post.routes.js.map