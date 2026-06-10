"use strict";
/**
 * Redis Caching Middleware for API Responses
 *
 * This middleware provides Redis-based caching for API responses
 * to improve performance and reduce database load.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheStats = exports.clearAllCache = exports.cacheInvalidationMiddleware = exports.invalidateCache = exports.cacheMiddleware = void 0;
const redis_1 = require("../configs/redis");
/**
 * Generate cache key from request
 */
const generateCacheKey = (req, prefix = '') => {
    const userId = req.user?.id || 'anonymous';
    const path = req.path;
    const query = JSON.stringify(req.query);
    return `${prefix}:${userId}:${path}:${query}`;
};
/**
 * Cache middleware factory
 */
const cacheMiddleware = (options = {}) => {
    const { ttl = 300, keyPrefix = 'api', skipCache = false } = options;
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET' || skipCache) {
            return next();
        }
        try {
            const cacheKey = generateCacheKey(req, keyPrefix);
            // Try to get cached response
            const cached = await redis_1.redis.get(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                return res.json(data);
            }
            // Store original json method
            const originalJson = res.json.bind(res);
            // Override json method to cache response
            res.json = function (data) {
                // Cache the response
                redis_1.redis.setex(cacheKey, ttl, JSON.stringify(data)).catch((err) => {
                    console.error('Cache set error:', err);
                });
                return originalJson(data);
            };
            next();
        }
        catch (error) {
            console.error('Cache middleware error:', error);
            // Continue without caching if Redis fails
            next();
        }
    };
};
exports.cacheMiddleware = cacheMiddleware;
/**
 * Invalidate cache for a specific pattern
 */
const invalidateCache = async (pattern) => {
    try {
        const keys = await redis_1.redis.keys(pattern);
        if (keys.length > 0) {
            await redis_1.redis.del(...keys);
        }
    }
    catch (error) {
        console.error('Cache invalidation error:', error);
    }
};
exports.invalidateCache = invalidateCache;
/**
 * Cache invalidation middleware for POST/PUT/DELETE
 */
const cacheInvalidationMiddleware = (patterns) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Invalidate cache after successful mutation
            if (res.statusCode >= 200 && res.statusCode < 300) {
                patterns.forEach(async (pattern) => {
                    await (0, exports.invalidateCache)(pattern);
                });
            }
            return originalJson(data);
        };
        next();
    };
};
exports.cacheInvalidationMiddleware = cacheInvalidationMiddleware;
/**
 * Clear all cache
 */
const clearAllCache = async () => {
    try {
        await redis_1.redis.flushdb();
    }
    catch (error) {
        console.error('Clear cache error:', error);
    }
};
exports.clearAllCache = clearAllCache;
/**
 * Get cache statistics
 */
const getCacheStats = async () => {
    try {
        const keys = await redis_1.redis.dbsize();
        return {
            keys,
        };
    }
    catch (error) {
        console.error('Get cache stats error:', error);
        return { keys: 0 };
    }
};
exports.getCacheStats = getCacheStats;
//# sourceMappingURL=cache.middleware.js.map