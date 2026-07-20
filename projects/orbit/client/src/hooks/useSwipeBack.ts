import { useEffect, useRef, useCallback } from "react";

interface SwipeBackOptions {
  /** Callback to fire when a swipe-back gesture is completed */
  onSwipeBack: () => void;
  /** Minimum horizontal swipe distance in px (default: 80) */
  threshold?: number;
  /** Only enable swipe-back when at the left edge (default: true) */
  edgeOnly?: boolean;
  /** Edge threshold in px from left (default: 30) */
  edgeThreshold?: number;
  /** Whether the swipe-back is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to detect swipe-back gestures for navigation.
 * Tracks touch start/move/end and fires onSwipeBack when the gesture threshold is met.
 */
export function useSwipeBack({
  onSwipeBack,
  threshold = 80,
  edgeOnly = true,
  edgeThreshold = 30,
  enabled = true,
}: SwipeBackOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;

      // Edge-only: only activate if starting near the left edge
      if (edgeOnly && touch.clientX > edgeThreshold) return;

      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      isSwiping.current = false;
    },
    [enabled, edgeOnly, edgeThreshold],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Only activate if horizontal movement dominates and exceeds min distance
      if (!isSwiping.current && deltaX > 20 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        isSwiping.current = true;
      }

      if (isSwiping.current) {
        // Optionally apply a visual transform via CSS custom property
        document.documentElement.style.setProperty(
          "--swipe-offset",
          `${Math.min(deltaX, 150)}px`,
        );
      }
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !isSwiping.current) {
        document.documentElement.style.removeProperty("--swipe-offset");
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX.current;

      document.documentElement.style.removeProperty("--swipe-offset");

      if (deltaX > threshold) {
        onSwipeBack();
      }

      isSwiping.current = false;
    },
    [enabled, threshold, onSwipeBack],
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.documentElement.style.removeProperty("--swipe-offset");
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
