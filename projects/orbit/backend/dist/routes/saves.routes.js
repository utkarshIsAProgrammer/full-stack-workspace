"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveRoutes = void 0;
const express_1 = __importDefault(require("express"));
const saves_controllers_1 = require("../controllers/saves.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.saveRoutes = router;
// Cache GET endpoints for better performance
router.get("/folders", auth_middleware_1.protect, (0, cache_middleware_1.cacheMiddleware)({ ttl: 300 }), saves_controllers_1.getSaveFolders);
router.post("/:postId", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, saves_controllers_1.toggleSavePost);
router.patch("/:postId/folder", auth_middleware_1.protect, saves_controllers_1.updateSaveFolder);
router.get("/", auth_middleware_1.protect, (0, cache_middleware_1.cacheMiddleware)({ ttl: 60 }), saves_controllers_1.getSavedPosts);
//# sourceMappingURL=saves.routes.js.map