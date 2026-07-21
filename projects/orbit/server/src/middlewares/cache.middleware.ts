/**
 * Redis Caching Middleware for API Responses
 * 
 * Provides Redis-based caching for API GET responses to reduce DB load.
 * Uses SCAN-based pattern invalidation (safe for Upstash Redis REST).
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../configs/redis';
import { logger } from '../utilities/logger';
import { clearByPattern } from '../configs/cache';

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 min)
  keyPrefix?: string;
  skipCache?: boolean;
}

/**
 * Generate a unique cache key from the request path + query + user ID.
 */
const generateCacheKey = (req: Request, prefix: string = ''): string => {
  const userId = req.user?._id?.toString() || (req.user as any)?.id || 'anonymous';
  const path = req.path;
  const query = JSON.stringify(req.query);
  return `${prefix}:${userId}:${path}:${query}`;
};

/**
 * Cache middleware factory.
 * Intercepts GET responses and caches them in Redis.
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'api', skipCache = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET' || skipCache) {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req, keyPrefix);

      // Try cache hit first
      const cached = await redis.get<string>(cacheKey);
      
      if (cached) {
        // @upstash/redis stores strings, so parse it back
        const data = typeof cached === 'string'
          ? JSON.parse(cached)
          : cached;
        return res.json(data);
      }

      // Intercept res.json() to capture and cache the response
      const originalJson = res.json.bind(res);

      res.json = function(data: any) {
        // Fire-and-forget cache write
        redis.set(cacheKey, JSON.stringify(data), { ex: ttl })
          .catch((_err: unknown) => {
            logger.error('Cache middleware set error', { error: (_err as any)?.message });
          });

        return originalJson(data);
      };

      next();
    } catch (error: any) {
      logger.error('Cache middleware error', { error: error?.message });
      // Fall through without caching
      next();
    }
  };
};

/**
 * Invalidate cache entries matching a prefix pattern.
 * Uses the SCAN-based approach from configs/cache.ts (safe for production).
 */
export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    await clearByPattern(pattern);
  } catch (error: any) {
    logger.error('Cache invalidation error', { pattern, error: error?.message });
  }
};
