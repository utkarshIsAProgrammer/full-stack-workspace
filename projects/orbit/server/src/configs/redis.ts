import { Redis } from "@upstash/redis";
import { env } from "./env";
import { logger } from "../utilities/logger";

/**
 * Upstash Redis client for caching.
 *
 * Uses HTTPS REST API (not TCP). When credentials are empty
 * (e.g. in development without Upstash), the client is a no-op
 * that gracefully catches all errors — cache ops silently fall
 * through so the server can run without external Redis.
 */
function createRedisClient(): Redis {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.info(
      "Upstash Redis not configured — caching will be disabled. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable."
    );
  }

  return new Redis({
    url: url || "https://placeholder.upstash.io",
    token: token || "placeholder",
  });
}

export const redis = createRedisClient();
