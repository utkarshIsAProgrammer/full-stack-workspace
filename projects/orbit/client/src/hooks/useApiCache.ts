/**
 * useApiCache.ts — React hook for stale-while-revalidate API caching.
 *
 * Usage:
 *   const { data, isLoading } = useApiCache<User[]>("/api/users/recommended");
 *
 * On the first call the hook fetches from the network and caches the result.
 * On subsequent calls it returns the cached data INSTANTLY (zero loading)
 * and refreshes from the network in the background.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
	getCachedResponse,
	setCachedResponse,
} from "../utils/apiCache";

interface CacheState<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
}

/**
 * Fetch data with stale-while-revalidate caching.
 *
 * @param url  API endpoint URL (must be a GET endpoint)
 * @param options  Optional fetch options (e.g. headers)
 */
export function useApiCache<T = unknown>(
	url: string | null,
	options: RequestInit = {},
) {
	const [state, setState] = useState<CacheState<T>>({
		data: null,
		isLoading: true,
		error: null,
	});
	const mountedRef = useRef(true);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	// Track the latest URL so concurrent refreshes don't clash
	const urlRef = useRef(url);
	urlRef.current = url;

	const fetchAndCache = useCallback(async (currentUrl: string) => {
		let hadCache = false;

		try {
			// 1. Check cache first
			const cached = await getCachedResponse<T>(currentUrl);
			if (cached !== null && mountedRef.current) {
				hadCache = true;
				setState({ data: cached, isLoading: false, error: null });
			}

			// 2. Fetch from network (background if cached, blocking if not)
			const res = await fetch(currentUrl, {
				...optionsRef.current,
				method: "GET",
				credentials: "include",
			});

			if (!mountedRef.current) return;

			if (!res.ok) {
				if (res.status === 401) {
					window.dispatchEvent(new CustomEvent("auth:expired"));
				}
				// If we already have cached data, keep it silently
				if (hadCache) return;
				setState({ data: null, isLoading: false, error: `HTTP ${res.status}` });
				return;
			}

			let data: T | null = null;
			if (res.headers.get("content-type")?.includes("application/json")) {
				data = (await res.json()) as T;
			}

			if (data !== null && mountedRef.current) {
				// Store in cache for next time
				await setCachedResponse(currentUrl, data);
				setState({ data, isLoading: false, error: null });
			}
		} catch (err) {
			if (!mountedRef.current) return;
			// If we already have cached data, keep it silently
			if (hadCache) return;
			setState({
				data: null,
				isLoading: false,
				error: err instanceof Error ? err.message : "Network error",
			});
		}
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!url) {
			setState({ data: null, isLoading: false, error: null });
			return;
		}

		fetchAndCache(url);

		// Listen for background cache refreshes for this exact URL
		const handleRefresh = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				url: string;
				data: T;
			};
			if (detail.url === url && mountedRef.current) {
				setState({ data: detail.data, isLoading: false, error: null });
			}
		};

		window.addEventListener("api:cache-refreshed", handleRefresh);
		return () => {
			window.removeEventListener("api:cache-refreshed", handleRefresh);
		};
	}, [url, fetchAndCache]);

	return state;
}
