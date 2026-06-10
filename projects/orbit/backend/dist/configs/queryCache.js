"use strict";
/**
 * Query Result Caching for Complex Queries
 *
 * This utility provides caching for complex database queries
 * to reduce database load and improve response times.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateCacheForOperation = exports.invalidateQueryCache = exports.getCachedQueryResult = exports.cacheQueryResult = void 0;
const redis_1 = require("./redis");
/**
 * Generate cache key for query
 */
const generateQueryKey = (collection, query, options) => {
    const prefix = options?.keyPrefix || 'query';
    const queryStr = JSON.stringify(query);
    return `${prefix}:${collection}:${Buffer.from(queryStr).toString('base64')}`;
};
/**
 * Cache query result
 */
const cacheQueryResult = async (collection, query, result, options = {}) => {
    try {
        const key = generateQueryKey(collection, query, options);
        const ttl = options.ttl || 300; // Default 5 minutes
        await redis_1.redis.setex(key, ttl, JSON.stringify(result));
    }
    catch (error) {
        console.error('Query cache set error:', error);
    }
};
exports.cacheQueryResult = cacheQueryResult;
/**
 * Get cached query result
 */
const getCachedQueryResult = async (collection, query, options = {}) => {
    try {
        const key = generateQueryKey(collection, query, options);
        const cached = await redis_1.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    catch (error) {
        console.error('Query cache get error:', error);
        return null;
    }
};
exports.getCachedQueryResult = getCachedQueryResult;
/**
 * Invalidate query cache for collection
 */
const invalidateQueryCache = async (collection) => {
    try {
        const pattern = `query:${collection}:*`;
        const keys = await redis_1.redis.keys(pattern);
        if (keys.length > 0) {
            await redis_1.redis.del(...keys);
        }
    }
    catch (error) {
        console.error('Query cache invalidation error:', error);
    }
};
exports.invalidateQueryCache = invalidateQueryCache;
/**
 * Cache invalidation helper for specific operations
 */
const invalidateCacheForOperation = async (operation, data) => {
    try {
        switch (operation) {
            case 'post':
                await (0, exports.invalidateQueryCache)('posts');
                await (0, exports.invalidateQueryCache)('users');
                break;
            case 'user':
                await (0, exports.invalidateQueryCache)('users');
                await (0, exports.invalidateQueryCache)('posts');
                break;
            case 'comment':
                await (0, exports.invalidateQueryCache)('comments');
                await (0, exports.invalidateQueryCache)('posts');
                break;
            case 'like':
                await (0, exports.invalidateQueryCache)('likes');
                await (0, exports.invalidateQueryCache)('posts');
                break;
            case 'follow':
                await (0, exports.invalidateQueryCache)('users');
                await (0, exports.invalidateQueryCache)('follows');
                break;
            case 'notification':
                await (0, exports.invalidateQueryCache)('notifications');
                break;
            case 'message':
                await (0, exports.invalidateQueryCache)('messages');
                await (0, exports.invalidateQueryCache)('conversations');
                break;
        }
    }
    catch (error) {
        console.error('Cache invalidation error:', error);
    }
};
exports.invalidateCacheForOperation = invalidateCacheForOperation;
//# sourceMappingURL=queryCache.js.map