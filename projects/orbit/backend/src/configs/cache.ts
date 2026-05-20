import { redis } from "./redis";

// get data from cache
export const getCache = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get<T>(key);

  return data ?? null;
};

// store data in cache
export const setCache = async (
  key: string,
  value: unknown,
  ttl: number = 300,
) => {
  await redis.set(key, value, {
    ex: ttl,
  });
};

// delete single item from cache
export const deleteCache = async (key: string) => {
  await redis.del(key);
};

// clear posts list cache
export const clearFeedCache = async () => {
  const keys = await redis.keys("posts:*");
  if (keys.length > 0) await redis.del(...keys);
};

// clear users list cache
export const clearUsersCache = async () => {
  const keys = await redis.keys("users:*");
  if (keys.length > 0) await redis.del(...keys);
};

// clear comments list cache for a post
export const clearCommentsCache = async (postId: string) => {
  const keys = await redis.keys(`comments:${postId}:*`);
  if (keys.length > 0) await redis.del(...keys);
};

// clear followers and following list cache
export const clearFollowCache = async (userId: string, followerId: string) => {
  const keys1 = await redis.keys(`followers:${userId}:*`);
  const keys2 = await redis.keys(`following:${followerId}:*`);

  if (keys1.length > 0) await redis.del(...keys1);
  if (keys2.length > 0) await redis.del(...keys2);
};

// clear saved posts list cache
export const clearSavesCache = async (userId: string) => {
  const keys = await redis.keys(`saves:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
};

// clear all saved-posts list caches (e.g. after a post is deleted)
export const clearAllSavesCache = async () => {
  const keys = await redis.keys("saves:*");
  if (keys.length > 0) await redis.del(...keys);
};
