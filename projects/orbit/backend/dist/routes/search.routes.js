"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRoutes = void 0;
const express_1 = __importDefault(require("express"));
const search_controllers_1 = require("../controllers/search.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = express_1.default.Router();
exports.searchRoutes = router;
// Cache search endpoints for better performance
router.get("/users", auth_middleware_1.optionalAuth, ratelimit_middleware_1.searchLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 120 }), search_controllers_1.searchUsers);
router.get("/posts", auth_middleware_1.optionalAuth, ratelimit_middleware_1.searchLimiter, (0, cache_middleware_1.cacheMiddleware)({ ttl: 120 }), search_controllers_1.searchPosts);
//# sourceMappingURL=search.routes.js.map