import { redis } from "./redis";
import { logger } from "../utilities/logger";

// SCAN-based pattern deletion — avoids O(N) blocking of KEYS
export const clearByPattern = async (pattern: string) => {
  try {
    let cursor: string | number = 0;
    const batchSize = 100;
    do {
      const result: [string, string[]] = await redis.scan(cursor, { match: pattern, count: batchSize });
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err: any) {
    logger.error("Error clearing cache by pattern", { pattern, error: err.message });
  }
};

// get data from cache
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get<T>(key);
    return data ?? null;
  } catch (err: any) {
    logger.error("Error getting cache", { key, error: err.message });
    return null;
  }
};

// store data in cache
export const setCache = async (
  key: string,
  value: unknown,
  ttl: number = 1800,
) => {
  try {
    await redis.set(key, value, {
      ex: ttl,
    });
  } catch (err: any) {
    logger.error("Error setting cache", { key, error: err.message });
  }
};

// delete single item from cache
export const deleteCache = async (key: string) => {
  try {
    await redis.del(key);
  } catch (err: any) {
    logger.error("Error deleting cache", { key, error: err.message });
  }
};

// clear posts list cache
export const clearFeedCache = async () => {
  await clearByPattern("posts:*");
  await clearByPattern("api:*:*posts*");
};

// clear users list cache
export const clearUsersCache = async () => {
  await clearByPattern("users:*");
  await clearByPattern("api:*:*users*");
};

// clear comments list cache for a post
export const clearCommentsCache = async (postId: string) => {
  await clearByPattern(`comments:${postId}:*`);
  await deleteCache(`comments:all:${postId}`); // Also clear the new all-comments cache!
  await clearByPattern("api:*:*comments*");
};

// clear followers and following list cache
export const clearFollowCache = async (userId: string, followerId: string) => {
  await clearByPattern(`followers:${userId}:*`);
  await clearByPattern(`following:${followerId}:*`);
};

// clear saved posts list cache
export const clearSavesCache = async (userId: string) => {
  await clearByPattern(`saves:${userId}:*`);
};

// clear user posts cache
export const clearUserPostsCache = async (userId: string) => {
  await clearByPattern(`user:${userId}:posts:*`);
};

// clear user by username cache
export const clearUserByUsernameCache = async (username: string) => {
  await clearByPattern(`user:username:${username}`);
};

// clear user by id cache
export const clearUserByIdCache = async (userId: string) => {
  await clearByPattern(`user:${userId}`);
};

// clear hashtag cache
export const clearHashtagCache = async () => {
  await clearByPattern("hashtag:*");
};

// clear chat conversations and messages list cache
export const clearChatCache = async (conversationId: string, participantIds: string[]) => {
  await clearByPattern(`chat:messages:${conversationId}:*`);
  for (const userId of participantIds) {
    await deleteCache(`chat:conversations:${userId}`);
  }
};
