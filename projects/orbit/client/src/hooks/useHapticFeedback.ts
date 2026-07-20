import { useCallback } from "react";

type HapticPattern = "light" | "medium" | "heavy" | "success" | "error" | "selection";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [30, 50, 30],
  error: [50, 80, 50],
  selection: 5,
};

/**
 * Provides haptic feedback using the Vibration API.
 * Falls back silently if the API is not available.
 */
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: HapticPattern = "light") => {
    if (!("vibrate" in navigator)) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // Vibration API not supported or blocked — silently ignore
    }
  }, []);

  return { vibrate };
}
