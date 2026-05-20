"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllSavesCache = exports.clearSavesCache = exports.clearFollowCache = exports.clearCommentsCache = exports.clearUsersCache = exports.clearFeedCache = exports.deleteCache = exports.setCache = exports.getCache = void 0;
const redis_1 = require("./redis");
// get data from cache
const getCache = async (key) => {
    const data = await redis_1.redis.get(key);
    return data ?? null;
};
exports.getCache = getCache;
// store data in cache
const setCache = async (key, value, ttl = 300) => {
    await redis_1.redis.set(key, value, {
        ex: ttl,
    });
};
exports.setCache = setCache;
// delete single item from cache
const deleteCache = async (key) => {
    await redis_1.redis.del(key);
};
exports.deleteCache = deleteCache;
// clear posts list cache
const clearFeedCache = async () => {
    const keys = await redis_1.redis.keys("posts:*");
    if (keys.length > 0)
        await redis_1.redis.del(...keys);
};
exports.clearFeedCache = clearFeedCache;
// clear users list cache
const clearUsersCache = async () => {
    const keys = await redis_1.redis.keys("users:*");
    if (keys.length > 0)
        await redis_1.redis.del(...keys);
};
exports.clearUsersCache = clearUsersCache;
// clear comments list cache for a post
const clearCommentsCache = async (postId) => {
    const keys = await redis_1.redis.keys(`comments:${postId}:*`);
    if (keys.length > 0)
        await redis_1.redis.del(...keys);
};
exports.clearCommentsCache = clearCommentsCache;
// clear followers and following list cache
const clearFollowCache = async (userId, followerId) => {
    const keys1 = await redis_1.redis.keys(`followers:${userId}:*`);
    const keys2 = await redis_1.redis.keys(`following:${followerId}:*`);
    if (keys1.length > 0)
        await redis_1.redis.del(...keys1);
    if (keys2.length > 0)
        await redis_1.redis.del(...keys2);
};
exports.clearFollowCache = clearFollowCache;
// clear saved posts list cache
const clearSavesCache = async (userId) => {
    const keys = await redis_1.redis.keys(`saves:${userId}:*`);
    if (keys.length > 0)
        await redis_1.redis.del(...keys);
};
exports.clearSavesCache = clearSavesCache;
// clear all saved-posts list caches (e.g. after a post is deleted)
const clearAllSavesCache = async () => {
    const keys = await redis_1.redis.keys("saves:*");
    if (keys.length > 0)
        await redis_1.redis.del(...keys);
};
exports.clearAllSavesCache = clearAllSavesCache;
//# sourceMappingURL=cache.js.map