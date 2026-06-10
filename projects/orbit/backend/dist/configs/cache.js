"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearChatCache = exports.clearHashtagCache = exports.clearUserByIdCache = exports.clearUserByUsernameCache = exports.clearUserPostsCache = exports.clearSavesCache = exports.clearFollowCache = exports.clearCommentsCache = exports.clearUsersCache = exports.clearFeedCache = exports.deleteCache = exports.setCache = exports.getCache = exports.clearByPattern = void 0;
const redis_1 = require("./redis");
const logger_1 = require("../utilities/logger");
// SCAN-based pattern deletion — avoids O(N) blocking of KEYS
const clearByPattern = async (pattern) => {
    try {
        let cursor = 0;
        const batchSize = 100;
        do {
            const result = await redis_1.redis.scan(cursor, { match: pattern, count: batchSize });
            cursor = result[0];
            const keys = result[1];
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
            }
        } while (cursor !== "0");
    }
    catch (err) {
        logger_1.logger.error("Error clearing cache by pattern", { pattern, error: err.message });
    }
};
exports.clearByPattern = clearByPattern;
// get data from cache
const getCache = async (key) => {
    try {
        const data = await redis_1.redis.get(key);
        return data ?? null;
    }
    catch (err) {
        logger_1.logger.error("Error getting cache", { key, error: err.message });
        return null;
    }
};
exports.getCache = getCache;
// store data in cache
const setCache = async (key, value, ttl = 1800) => {
    try {
        await redis_1.redis.set(key, value, {
            ex: ttl,
        });
    }
    catch (err) {
        logger_1.logger.error("Error setting cache", { key, error: err.message });
    }
};
exports.setCache = setCache;
// delete single item from cache
const deleteCache = async (key) => {
    try {
        await redis_1.redis.del(key);
    }
    catch (err) {
        logger_1.logger.error("Error deleting cache", { key, error: err.message });
    }
};
exports.deleteCache = deleteCache;
// clear posts list cache
const clearFeedCache = async () => {
    await (0, exports.clearByPattern)("posts:*");
};
exports.clearFeedCache = clearFeedCache;
// clear users list cache
const clearUsersCache = async () => {
    await (0, exports.clearByPattern)("users:*");
};
exports.clearUsersCache = clearUsersCache;
// clear comments list cache for a post
const clearCommentsCache = async (postId) => {
    await (0, exports.clearByPattern)(`comments:${postId}:*`);
    await (0, exports.deleteCache)(`comments:all:${postId}`); // Also clear the new all-comments cache!
};
exports.clearCommentsCache = clearCommentsCache;
// clear followers and following list cache
const clearFollowCache = async (userId, followerId) => {
    await (0, exports.clearByPattern)(`followers:${userId}:*`);
    await (0, exports.clearByPattern)(`following:${followerId}:*`);
};
exports.clearFollowCache = clearFollowCache;
// clear saved posts list cache
const clearSavesCache = async (userId) => {
    await (0, exports.clearByPattern)(`saves:${userId}:*`);
};
exports.clearSavesCache = clearSavesCache;
// clear user posts cache
const clearUserPostsCache = async (userId) => {
    await (0, exports.clearByPattern)(`user:${userId}:posts:*`);
};
exports.clearUserPostsCache = clearUserPostsCache;
// clear user by username cache
const clearUserByUsernameCache = async (username) => {
    await (0, exports.clearByPattern)(`user:username:${username}`);
};
exports.clearUserByUsernameCache = clearUserByUsernameCache;
// clear user by id cache
const clearUserByIdCache = async (userId) => {
    await (0, exports.clearByPattern)(`user:${userId}`);
};
exports.clearUserByIdCache = clearUserByIdCache;
// clear hashtag cache
const clearHashtagCache = async () => {
    await (0, exports.clearByPattern)("hashtag:*");
};
exports.clearHashtagCache = clearHashtagCache;
// clear chat conversations and messages list cache
const clearChatCache = async (conversationId, participantIds) => {
    await (0, exports.clearByPattern)(`chat:messages:${conversationId}:*`);
    for (const userId of participantIds) {
        await (0, exports.deleteCache)(`chat:conversations:${userId}`);
    }
};
exports.clearChatCache = clearChatCache;
//# sourceMappingURL=cache.js.map