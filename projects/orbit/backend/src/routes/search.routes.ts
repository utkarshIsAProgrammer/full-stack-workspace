import express from "express";
import { searchUsers, searchPosts } from "../controllers/search.controllers";
import { optionalAuth } from "../middlewares/auth.middleware";
import { searchLimiter } from "../middlewares/ratelimit.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = express.Router();

// Cache search endpoints for better performance
router.get("/users", optionalAuth, searchLimiter, cacheMiddleware({ ttl: 120 }), searchUsers);
router.get("/posts", optionalAuth, searchLimiter, cacheMiddleware({ ttl: 120 }), searchPosts);

export { router as searchRoutes };
