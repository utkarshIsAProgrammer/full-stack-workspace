/**
 * Query Result Caching for Complex Queries
 * 
 * This utility provides caching for complex database queries
 * to reduce database load and improve response times.
 */

import { redis } from './redis';

interface QueryCacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

/**
 * Generate cache key for query
 */
const generateQueryKey = (collection: string, query: any, options?: QueryCacheOptions): string => {
  const prefix = options?.keyPrefix || 'query';
  const queryStr = JSON.stringify(query);
  return `${prefix}:${collection}:${Buffer.from(queryStr).toString('base64')}`;
};

/**
 * Cache query result
 */
export const cacheQueryResult = async (
  collection: string,
  query: any,
  result: any,
  options: QueryCacheOptions = {}
): Promise<void> => {
  try {
    const key = generateQueryKey(collection, query, options);
    const ttl = options.ttl || 300; // Default 5 minutes
    await redis.setex(key, ttl, JSON.stringify(result));
  } catch (error) {
    console.error('Query cache set error:', error);
  }
};

/**
 * Get cached query result
 */
export const getCachedQueryResult = async <T>(
  collection: string,
  query: any,
  options: QueryCacheOptions = {}
): Promise<T | null> => {
  try {
    const key = generateQueryKey(collection, query, options);
    const cached = await redis.get(key) as string | null;
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Query cache get error:', error);
    return null;
  }
};

/**
 * Invalidate query cache for collection
 */
export const invalidateQueryCache = async (collection: string): Promise<void> => {
  try {
    const pattern = `query:${collection}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Query cache invalidation error:', error);
  }
};

/**
 * Cache invalidation helper for specific operations
 */
export const invalidateCacheForOperation = async (operation: string, data: any): Promise<void> => {
  try {
    switch (operation) {
      case 'post':
        await invalidateQueryCache('posts');
        await invalidateQueryCache('users');
        break;
      case 'user':
        await invalidateQueryCache('users');
        await invalidateQueryCache('posts');
        break;
      case 'comment':
        await invalidateQueryCache('comments');
        await invalidateQueryCache('posts');
        break;
      case 'like':
        await invalidateQueryCache('likes');
        await invalidateQueryCache('posts');
        break;
      case 'follow':
        await invalidateQueryCache('users');
        await invalidateQueryCache('follows');
        break;
      case 'notification':
        await invalidateQueryCache('notifications');
        break;
      case 'message':
        await invalidateQueryCache('messages');
        await invalidateQueryCache('conversations');
        break;
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};
