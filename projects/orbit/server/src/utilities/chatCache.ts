/**
 * chatCache.ts — Tiny in-memory cache for the personal-chat hot path
 * (conversation list + message history).
 *
 * WHY: The free-tier stack pays ~100-200ms per Upstash Redis HTTPS round-trip
 * and ~200-400ms per shared-Atlas query. The conversations list and message
 * history are re-fetched constantly (tab switches, socket-triggered refresh,
 * app opens), so serving repeat loads straight from process memory cuts
 * perceived latency from hundreds of milliseconds to ~1ms.
 *
 * Eviction: every chat mutation (send / edit / delete / delete-for-me /
 * pin / unpin / reaction) already calls clearChatCache() with the affected
 * conversation + participants — that function now also purges the matching
 * in-memory entries, so the cache never goes stale on writes.
 *
 * NOTE: per-instance memory. On a single free-tier instance that covers all
 * users; on a horizontally-scaled deployment it degrades gracefully (each
 * instance caches independently, and the Redis layer still works).
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 600;

const store = new Map<string, CacheEntry>();

/** Read a cached payload for a key, or null if absent/expired. */
export function getMemCache<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

/** Store a payload under a key with the given TTL (seconds). */
export function setMemCache(key: string, value: unknown, ttlSeconds = 10): void {
  // Keep the map bounded — evict the oldest entry when full (Map preserves
  // insertion order, so the first key is the oldest).
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Evict every cached entry whose key starts with `prefix`. Called on chat
 * mutations so the very next read reflects the change instead of waiting
 * for the TTL.
 *
 * @param prefix  e.g. "chat:messages:<conversationId>" or
 *                "chat:conversations:<userId>"
 */
export function clearMemCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
