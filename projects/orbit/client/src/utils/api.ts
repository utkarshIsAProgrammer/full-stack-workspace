// ── Request deduplication store (shares parsed JSON, not raw Response bodies) ──
interface FetchResult {
	ok: boolean;
	status: number;
	data: unknown;
}

const pendingRequests = new Map<string, Promise<FetchResult>>();

import {
	getCachedResponse,
	setCachedResponse,
	clearApiCache,
	addToRefreshSchedule,
	stopCacheRefreshTimer,
} from "./apiCache";

// Offline-first: Dexie structured storage + sync queue
import {
	cacheConversations,
	cacheCommunityMessages,
	cachePosts,
	cacheNotifications,
	cacheUsers,
	getCachedConversationMessages,
	getCachedCommunityMessages,
	getCachedNotifications,
	getCachedPosts,
	clearOfflineDB,
} from "./offlineDB";
import {
	addToSyncQueue,
} from "./syncQueue";
import { logger } from "./logger";

function toJsonResponse(result: FetchResult): Response {
	return new Response(JSON.stringify(result.data), {
		status: result.status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Read the CSRF token from the non-httpOnly cookie set by the server.
 */
function getCsrfToken(): string | null {
	const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
	return match ? match[1]! : null;
}

/**
 * Evict cache entries that may have been invalidated by a mutation.
 * Called automatically after successful POST/PUT/PATCH/DELETE.
 */
function evictAffectedCaches(url: string): void {
	// Normalise the URL to an absolute URL with origin so it matches
	// how the browser stores cached requests (always with origin).
	// The `url` parameter here comes from a mutation (POST/PUT/DELETE)
	// and may be a relative path like "/api/chats/conversations/abc/messages"
	// while cached GET requests are stored with full origin like
	// "http://localhost:5173/api/chats/conversations/abc/messages?limit=20".
	const cacheKey = new URL(url, window.location.origin).pathname;

	// Special-case: membership-changing community mutations (create, update,
	// delete, join, leave) invalidate the "/api/communities/mine" list.
	// Without this, a stale cached list (without the new membership) was
	// served, so newly joined communities didn't appear in "My Communities".
	// NOTE: deliberately narrow — message/media sub-resource mutations
	// (e.g. POST /api/communities/:id/messages) do NOT affect membership,
	// so they must NOT evict the "mine" list on every message sent.
	const segments = cacheKey.split("/").filter(Boolean); // e.g. ["api","communities","<id>","join"]
	const isCommunityMembershipMutation =
		(segments.length === 2 && segments[0] === "api" && segments[1] === "communities") ||
		(segments.length === 3 && segments[0] === "api" && segments[1] === "communities") ||
		(segments.length === 4 &&
			segments[0] === "api" &&
			segments[1] === "communities" &&
			(segments[3] === "join" || segments[3] === "leave"));

	// Post-interaction mutations (like / save / repost / share / view) change
	// the interaction flags (likedByMe / savedByMe / repostedByMe / counts)
	// embedded INSIDE every cached post object — so they must invalidate the
	// feed/list caches too, not just their own path. Without this, a stale
	// cached /api/posts response (with likedByMe:false) is served after a
	// page refresh, making the like/save/repost appear to "revert".
	// NOTE: deliberately excludes the `view` mutation — views increment on
	// EVERY post open, so evicting all cached feeds on each view would
	// defeat cache-first entirely. Views are low-stakes for staleness.
	const isPostInteractionMutation =
		(segments[0] === "api" && segments[1] === "likes" && segments[2] === "post") ||
		(segments[0] === "api" && segments[1] === "saves") ||
		(segments[0] === "api" && segments[1] === "reposts") ||
		(segments[0] === "api" && segments[1] === "posts" && segments.length >= 4 &&
			(segments[3] === "like" || segments[3] === "unlike" || segments[3] === "share" ||
				segments[3] === "quote-repost" || segments[3] === "vote"));

	// A cached URL is a post list/feed/single-post that embeds interaction state.
	const isPostCache = (cachedPath: string) =>
		cachedPath === "/api/posts" ||
		cachedPath.startsWith("/api/posts/") ||
		cachedPath.startsWith("/api/feed") ||
		cachedPath === "/api/saves" ||
		cachedPath.startsWith("/api/saves/") ||
		cachedPath === "/api/reposts" ||
		cachedPath.startsWith("/api/reposts/") ||
		cachedPath.startsWith("/api/search/posts");

	// Chat message mutations (send/delete/clear) change lastMessage + unreadCounts,
	// so the cached conversation LIST must be invalidated too — otherwise a stale
	// list (with outdated unread badge counts) is served on the next read, causing
	// the "unread count is off by one" / "badge doesn't show" bugs.
	// Covers both POST/DELETE /api/chats/conversations/:id/messages (send/clear)
	// AND DELETE /api/chats/messages/:id and /messages/:id/delete-for-me.
	const isChatMessageMutation =
		segments[0] === "api" &&
		segments[1] === "chats" &&
		((segments[2] === "conversations" &&
			segments.length >= 5 &&
			segments[4] === "messages") ||
			(segments[2] === "messages" && segments.length >= 4));

	// A cached URL that embeds conversation unread badge state.
	const isConversationCache = (cachedPath: string) =>
		cachedPath === "/api/chats/conversations";

	// Fire-and-forget: clear caches that might be stale
	Promise.resolve().then(async () => {
		const cache = await caches.open("orbit-api-v1");
		const requests = await cache.keys();

		const urlsToDelete: Request[] = [];

		for (const req of requests) {
			// Strip origin + query params from the cached URL for comparison
			// e.g. "http://localhost:5173/api/chats/conversations/abc/messages?limit=20"
			//      → "/api/chats/conversations/abc/messages"
			const cachedPath = new URL(req.url).pathname;

			// Match exact path or parent collections:
			// e.g. POST /api/posts → evict GET /api/posts and /api/posts?page=2
			// e.g. DELETE /api/posts/abc → evict /api/posts/abc and /api/posts (list)
			if (
				cachedPath === cacheKey ||
				cachedPath.startsWith(cacheKey + "/") ||
				cacheKey.startsWith(cachedPath + "/") ||
				// Community membership mutations always invalidate the "mine" list
				(isCommunityMembershipMutation && cachedPath === "/api/communities/mine") ||
				// Post interactions (like/save/repost/share) invalidate ALL cached
				// post lists/feeds because they embed interaction state
				(isPostInteractionMutation && isPostCache(cachedPath)) ||
				// Chat message mutations invalidate the cached conversation list
				(isChatMessageMutation && isConversationCache(cachedPath))
			) {
				urlsToDelete.push(req);
			}
		}

		await Promise.all(urlsToDelete.map((r) => cache.delete(r)));
	});
}

// Extended options: `bypassCache` forces a network fetch on GET requests,
// skipping the cache-first path. Used by hard refreshes (pull-to-refresh,
// tab switches, opening a single post) so fresh data is always shown.
export interface ApiFetchOptions extends RequestInit {
	bypassCache?: boolean;
}

export async function apiFetch(
	url: string,
	options: ApiFetchOptions = {},
): Promise<Response> {
	const method = (options.method || "GET").toUpperCase();

	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	if (method !== "GET") {
		const csrfToken = getCsrfToken();
		if (csrfToken) {
			headers["x-csrf-token"] = csrfToken;
		}

		try {
			// Clone Response to prevent "body already consumed" errors from multiple readers
			const res = await fetch(url, {
				...options,
				method,
				headers,
				credentials: "include",
			});

			if (res.status === 401) {
				window.dispatchEvent(new CustomEvent("auth:expired"));
			}

			// Evict caches on successful mutations
			if (res.ok) {
				evictAffectedCaches(url);
			}

			return res.clone();
		} catch (err) {
			// Network error — queue the mutation for later if offline
			if (!navigator.onLine) {
				logger.warn("apiFetch: Offline, queueing mutation", { url, method });
				const body = options.body instanceof FormData
					? undefined  // FormData can't be easily queued
					: options.body instanceof ReadableStream
						? undefined
						: options.body as string | undefined;
				await addToSyncQueue(url, method as "POST" | "PUT" | "DELETE", body ? JSON.parse(body) : undefined, headers);
				// Return a fake success response so the UI doesn't break
				return new Response(JSON.stringify({ success: true, queued: true }), {
					status: 202,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw err;
		}
	}

	// ── GET: stale-while-revalidate + deduplication ─────────────────

	// `bypassCache` forces a network fetch (used for hard refreshes like
	// fetchPosts(true) and tab switches) so new data always shows up
	// immediately instead of serving a stale cached response.
	const bypassCache = options.bypassCache === true;

	// 1. Check cache for instant response (CacheStorage first, then Dexie)
	let cachedData = bypassCache ? null : await getCachedResponse(url);

	// If offline and no CacheStorage hit, try Dexie for structured queries
	if (cachedData === null && !navigator.onLine) {
		cachedData = await getOfflineFallback(url);
	}

	// 2. Check if there's already an in-flight request
	const pending = pendingRequests.get(url);
	if (pending) {
		// If cached data exists, return it immediately — don't trigger an
		// additional background refresh here because the periodic timer
		// (every 30s) already handles stale-while-revalidate. Calling
		// refreshCache from this path creates a re-render cycle:
		//   apiFetch → refreshCache → dispatch event → useCacheRefresh callback → apiFetch → ...
		if (cachedData !== null && !bypassCache) {
			return toJsonResponse({ ok: true, status: 200, data: cachedData });
		}
		// No cache — wait for the in-flight request
		const result = await pending;
		return toJsonResponse(result);
	}

	// 3. If cached data exists, return instantly — periodic timer handles refresh
	if (cachedData !== null && !bypassCache) {
		return toJsonResponse({ ok: true, status: 200, data: cachedData });
	}

	// 4. First-time fetch — wait for network and cache the result
	const requestPromise = (async (): Promise<FetchResult> => {
		const res = await fetch(url, {
			...options,
			method: "GET",
			headers,
			credentials: "include",
		});
		if (res.status === 401) {
			window.dispatchEvent(new CustomEvent("auth:expired"));
		}

		let data: unknown = null;
		if (res.headers.get("content-type")?.includes("application/json")) {
			try {
				data = await res.json();
			} catch {
				data = null;
			}
		}

		return { ok: res.ok, status: res.status, data };
	})();

	pendingRequests.set(url, requestPromise);

	try {
		const result = await requestPromise;

		// Cache the result in both CacheStorage and Dexie
		if (result.ok && result.data !== null) {
			await setCachedResponse(url, result.data);
			// Also cache into Dexie for offline structured queries
			await cacheIntoDexie(url, result.data);
		}

		return toJsonResponse(result);
	} finally {
		pendingRequests.delete(url);
	}
}

/**
 * Clear all cached API data — useful after logout or when switching accounts.
 */
export async function clearAllCaches(): Promise<void> {
	await clearApiCache();
	await clearOfflineDB();
}

// Re-export cache lifecycle helpers so App.tsx can manage the refresh timer
export { stopCacheRefreshTimer };

/**
 * Tab-to-endpoint map for cache warming.
 * Each tab maps to the API endpoints that should be pre-fetched
 * so the user sees data INSTANTLY when they navigate there.
 */
const TAB_ENDPOINTS: Record<string, string[]> = {
	home: ["/api/posts", "/api/glimpses/feed"],
	explore: ["/api/posts/trending/hashtags", "/api/posts?limit=5&sort=likesCount"],
	notifications: ["/api/notifications", "/api/notifications/unread-count"],
	chat: ["/api/chats/conversations"],
	communities: ["/api/communities?limit=50"],
	profile: [] as string[],
	settings: [] as string[],
	saved: ["/api/saves"],
	reposts: ["/api/reposts"],
	admin: ["/api/reports?status=pending&limit=20", "/api/admin/flags"],
};

/**
 * Get the API endpoints to prefetch for a given tab.
 */
export function getEndpointsForTab(tabId: string): string[] {
	return TAB_ENDPOINTS[tabId] || [];
}

/**
 * Pre-fetch API data in the background to warm the cache.
 * Uses requestIdleCallback to avoid competing with critical rendering.
 * Fires-and-forgets — errors are silently ignored.
 */
// ── Offline-first: Dexie helpers ─────────────────────────────────────────

/**
 * Intelligently cache API response data into Dexie based on the URL pattern.
 * This enables offline structured querying (search, filter, sort) that
 * CacheStorage alone cannot provide.
 */
async function cacheIntoDexie(url: string, data: unknown): Promise<void> {
	try {
		const path = url.split("?")[0];

		if (path.includes("/api/posts") && Array.isArray(data)) {
			await cachePosts(data as any);
		} else if (path.includes("/api/notifications") && Array.isArray(data)) {
			await cacheNotifications(data as any);
		} else if (path.includes("/api/chats/conversations") && Array.isArray(data)) {
			await cacheConversations(data as any);
		} else if (path.includes("/api/communities/") && path.includes("/messages") && Array.isArray(data)) {
			await cacheCommunityMessages(data as any);
		} else if (path.includes("/api/users/") && !Array.isArray(data)) {
			// Single user profile
			const userData = (data as any)?.user || data;
			if (userData?._id) {
				await cacheUsers([userData]);
			}
		} else if (path.includes("/api/search/users") && Array.isArray(data)) {
			await cacheUsers(data as any);
		}
	} catch {
		// Non-critical — silently ignore Dexie cache errors
	}
}

/**
 * When offline and CacheStorage has no hit, attempt to serve
 * structured data from Dexie IndexedDB.
 */
async function getOfflineFallback(url: string): Promise<unknown> {
	try {
		const path = url.split("?")[0];
		const urlObj = new URL(url, window.location.origin);
		const limit = parseInt(urlObj.searchParams.get("limit") || "20", 10);

		// Messages for a conversation
		const msgMatch = path.match(
			/\/api\/chats\/conversations\/([^/]+)\/messages/,
		);
		if (msgMatch) {
			const convId = msgMatch[1];
			const messages = await getCachedConversationMessages(convId, limit);
			return { success: true, messages };
		}

		// Community messages
		const commMsgMatch = path.match(
			/\/api\/communities\/([^/]+)\/messages/,
		);
		if (commMsgMatch) {
			const commId = commMsgMatch[1];
			const messages = await getCachedCommunityMessages(commId, limit);
			return { success: true, messages };
		}

		// Notifications
		if (path.includes("/api/notifications")) {
			const notifications = await getCachedNotifications("", limit);
			return { success: true, notifications };
		}

		// Posts / Feed — only match list endpoints, not trending/hashtag/etc
		if (/^\/api\/posts$|^\/api\/posts\?/.test(path)) {
			const posts = await getCachedPosts(limit);
			return { success: true, posts };
		}

		return null;
	} catch {
		return null;
	}
}

export function warmCache(urls: string[], registerForRefresh = true): void {
	if (urls.length === 0) return;

	const doFetch = () => {
		urls.forEach((url) => {
			apiFetch(url).catch(() => {
				// Silently ignore — prefetching is non-critical
			});
			// Register each URL for periodic background refreshes
			// so the cache stays warm even without user navigation
			if (registerForRefresh) {
				addToRefreshSchedule(url);
			}
		});
	};

	if (
		typeof window !== "undefined" &&
		"requestIdleCallback" in window
	) {
		(window as any).requestIdleCallback(() => doFetch(), {
			timeout: 3000,
		});
	} else {
		setTimeout(doFetch, 500);
	}
}
