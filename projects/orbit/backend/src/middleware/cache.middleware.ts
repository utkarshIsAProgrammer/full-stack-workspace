/**
 * Redis Caching Middleware for API Responses
 * 
 * This middleware provides Redis-based caching for API responses
 * to improve performance and reduce database load.
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../configs/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: boolean;
}

/**
 * Generate cache key from request
 */
const generateCacheKey = (req: Request, prefix: string = ''): string => {
  const userId = req.user?.id || 'anonymous';
  const path = req.path;
  const query = JSON.stringify(req.query);
  return `${prefix}:${userId}:${path}:${query}`;
};

/**
 * Cache middleware factory
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'api', skipCache = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET' || skipCache) {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req, keyPrefix);

      // Try to get cached response
      const cached = await redis.get(cacheKey) as string | null;
      
      if (cached) {
        const data = JSON.parse(cached);
        return res.json(data);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response
        redis.setex(cacheKey, ttl, JSON.stringify(data)).catch((err: any) => {
          console.error('Cache set error:', err);
        });

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching if Redis fails
      next();
    }
  };
};

/**
 * Invalidate cache for a specific pattern
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

/**
 * Cache invalidation middleware for POST/PUT/DELETE
 */
export const cacheInvalidationMiddleware = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      // Invalidate cache after successful mutation
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(async (pattern) => {
          await invalidateCache(pattern);
        });
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * Clear all cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    await redis.flushdb();
  } catch (error) {
    console.error('Clear cache error:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{ keys: number }> => {
  try {
    const keys = await redis.dbsize();
    
    return {
      keys,
    };
  } catch (error) {
    console.error('Get cache stats error:', error);
    return { keys: 0 };
  }
};
