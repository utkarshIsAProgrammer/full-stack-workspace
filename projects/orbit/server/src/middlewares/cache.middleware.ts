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
 * Generate a unique cache key from the FULL request path + query + user ID.
 *
 * IMPORTANT: `req.path` alone is WRONG for keys here. Inside a router mounted
 * at e.g. `/api/posts` (app.use("/api/posts", postRoutes)), `req.path` is the
 * ROUTER-RELATIVE path ("/" for GET /api/posts, and ALSO "/" for GET
 * /api/reposts, /api/saves, /api/feed...). Every root-level endpoint with the
 * same query string would share ONE cache key and serve each other's cached
 * responses — the home feed could literally return the reposts list. Use
 * `req.baseUrl + req.path` so each mounted endpoint gets its own key, and
 * fall back to the full originalUrl path for app-level middleware.
 */
const generateCacheKey = (req: Request, prefix: string = ''): string => {
  const userId = req.user?._id?.toString() || (req.user as any)?.id || 'anonymous';
  const fullPath =
    `${req.baseUrl || ''}${req.path}` || req.originalUrl.split('?')[0];
  const query = JSON.stringify(req.query);
  return `${prefix}:${userId}:${fullPath}:${query}`;
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
        const raw = typeof cached === 'string' ? JSON.parse(cached) : cached;
        // New format: { statusCode, data } — restore the original status so a
        // cached 404/403 is never served as a 200 (pre-existing bug that let
        // blocked-user responses leak through as "ok" on repeat requests).
        if (
          raw &&
          typeof raw === 'object' &&
          typeof raw.statusCode === 'number' &&
          'data' in raw
        ) {
          return res.status(raw.statusCode).json(raw.data);
        }
        // Legacy format: raw body (defaults to 200)
        return res.json(raw);
      }

      // Intercept res.json() to capture and cache the response.
      // ONLY successful (2xx) responses are cached — error responses must
      // never be cached, or a transient 404/500 would be replayed as a
      // success to every subsequent caller until the TTL expires.
      const originalJson = res.json.bind(res);

      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis
            .set(cacheKey, JSON.stringify({ statusCode: res.statusCode, data }), {
              ex: ttl,
            })
            .catch((_err: unknown) => {
              logger.error('Cache middleware set error', {
                error: (_err as any)?.message,
              });
            });
        }

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
