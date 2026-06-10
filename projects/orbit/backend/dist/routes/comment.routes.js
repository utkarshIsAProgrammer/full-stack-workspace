"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const comment_controllers_1 = require("../controllers/comment.controllers");
const commentReaction_controllers_1 = require("../controllers/commentReaction.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.commentRoutes = router;
// Cache GET endpoints for better performance
router.get("/", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), comment_controllers_1.getAllComments);
router.get("/replies/:commentId", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 120 }), comment_controllers_1.getCommentReplies);
router.get("/:postId", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), comment_controllers_1.getComment);
router.get("/:postId/all", auth_middleware_1.optionalAuth, (0, cache_middleware_1.cacheMiddleware)({ ttl: 30 }), comment_controllers_1.getAllCommentsForPost);
// Comment CRUD operations
router.post("/:postId", auth_middleware_1.protect, ratelimit_middleware_1.commentLimiter, comment_controllers_1.addComment);
router.put("/:commentId", auth_middleware_1.protect, ratelimit_middleware_1.commentLimiter, comment_controllers_1.updateComment);
router.delete("/:commentId", auth_middleware_1.protect, ratelimit_middleware_1.commentLimiter, comment_controllers_1.deleteComment);
// Comment reactions
router.post("/:commentId/reactions", auth_middleware_1.protect, ratelimit_middleware_1.commentLimiter, commentReaction_controllers_1.toggleCommentReaction);
//# sourceMappingURL=comment.routes.js.map