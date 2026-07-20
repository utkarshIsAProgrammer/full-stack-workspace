import { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface FeatureFlagsCache {
	[key: string]: boolean;
}

const cache = new Map<string, FeatureFlagsCache>();
const inflightRequests = new Map<string, Promise<FeatureFlagsCache>>();

/**
 * Hook to check if a feature flag is enabled for the current user.
 *
 * Fetches flags from GET /api/admin/flags/mine on first call and caches them.
 *
 * @param flagKey - The key of the feature flag to check (e.g. "new-composer")
 * @param defaultValue - Default value while loading or on error (default: false)
 * @returns { enabled: boolean; loading: boolean }
 */
export function useFeatureFlag(
	flagKey: string,
	defaultValue = false,
): { enabled: boolean; loading: boolean } {
	const [enabled, setEnabled] = useState(defaultValue);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const fetchFlags = async () => {
			// Check memory cache first
			const cachedFlags = cache.get("all");
			if (cachedFlags && flagKey in cachedFlags) {
				if (!cancelled) {
					setEnabled(cachedFlags[flagKey]);
					setLoading(false);
				}
				return;
			}

			// Deduplicate concurrent requests
			let requestPromise = inflightRequests.get("all");
			if (!requestPromise) {
				requestPromise = apiFetch("/api/admin/flags/mine")
					.then(async (res) => {
						if (!res.ok) return {};
						const data = await res.json();
						return data.flags || {};
					})
					.catch((err) => {
						logger.error("Failed to fetch feature flags", err);
						return {};
					});
				inflightRequests.set("all", requestPromise);
			}

			const flags = await requestPromise;
			if (!cancelled) {
				cache.set("all", flags);
				setEnabled(flagKey in flags ? flags[flagKey] : defaultValue);
				setLoading(false);
			}
		};

		fetchFlags();

		return () => {
			cancelled = true;
		};
	}, [flagKey, defaultValue]);

	return { enabled, loading };
}
