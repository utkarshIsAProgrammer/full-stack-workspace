import { useEffect, useRef } from "react";
import { apiFetch } from "../utils/api";

/**
 * Shared, app-wide dedup set for post views. Lives at module scope so that:
 *  - the IntersectionObserver hook and Feed's media onPlay/onLoad calls share
 *    ONE counter per post (no double-counting), and
 *  - two simultaneously-mounted view-tracking components (e.g. Feed/Profile
 *    with a QuoteRepostModal portal on top) can't both count the same post.
 * Reset on a full page reload, which is the expected "new visit" boundary.
 */
const registeredPostViews = new Set<string>();

/**
 * Register a view for a post (fire-and-forget). Deduped app-wide — each post
 * counts at most once per session/page-load. Exported so media handlers
 * (onPlay/onLoad) can count instantly through the same dedup as the hook.
 */
export const registerPostView = (postId: string) => {
	if (registeredPostViews.has(postId)) return;
	registeredPostViews.add(postId);
	apiFetch(`/api/posts/${postId}/view`, { method: "POST" }).catch(() => {
		// Allow a later re-visit to count this post.
		registeredPostViews.delete(postId);
	});
};

interface UsePostViewTrackingOptions {
	/** When false, tracking is disabled (e.g. still loading). */
	enabled?: boolean;
	/** Extra callback fired when a post card enters the viewport. */
	onIntersect?: (postId: string) => void;
	/** Re-run the observer when these change (e.g. [posts, loading]). */
	deps: unknown[];
}

/**
 * Reusable post-view tracking: any element with a `data-post-id` attribute
 * that stays visible (threshold 0.3) for 3+ consecutive seconds registers one
 * view via `registerPostView` — once per post per session, fire-and-forget.
 *
 * Shared by Feed (home), Profile (posts/saved/reposts tabs), Explore
 * (trending + search posts) and share surfaces, so views increase on every
 * screen that shows a post — matching the user's expectation that a post
 * "opened" anywhere counts a view.
 */
export function usePostViewTracking({
	enabled = true,
	onIntersect,
	deps,
}: UsePostViewTrackingOptions) {
	const viewTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const onIntersectRef = useRef(onIntersect);
	onIntersectRef.current = onIntersect;

	useEffect(() => {
		if (!enabled) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const postId = entry.target.getAttribute("data-post-id");
					if (!postId) return;

					if (entry.isIntersecting) {
						onIntersectRef.current?.(postId);
						// Start 3-second timer if not already pending or counted
						if (
							!registeredPostViews.has(postId) &&
							!viewTimersRef.current.has(postId)
						) {
							const timer = setTimeout(() => {
								viewTimersRef.current.delete(postId);
								registerPostView(postId);
							}, 3000);
							viewTimersRef.current.set(postId, timer);
						}
					} else {
						// Left viewport before 3 seconds — cancel timer
						const timer = viewTimersRef.current.get(postId);
						if (timer) {
							clearTimeout(timer);
							viewTimersRef.current.delete(postId);
						}
					}
				});
			},
			{ threshold: 0.3 },
		);

		const postCards = document.querySelectorAll("[data-post-id]");
		postCards.forEach((card) => observer.observe(card));

		return () => {
			observer.disconnect();
			viewTimersRef.current.forEach((timer) => clearTimeout(timer));
			viewTimersRef.current.clear();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}
