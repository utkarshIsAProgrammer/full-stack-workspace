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
  const userId = req.user?._id?.toString() || (req.user as any)?.id || 'anonymous';
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
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        // @upstash/redis already parses JSON, so cached is an object or string
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
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
