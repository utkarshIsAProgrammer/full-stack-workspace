import { useEffect, useRef } from "react";

/**
 * Auto-grows a textarea so the typed content always stays visible instead of
 * scrolling out of view (the app hides scrollbars globally, which made long
 * posts look like their opening words vanished behind a dark background).
 *
 * Usage:
 *   const contentRef = useAutoGrow<HTMLTextAreaElement>(content);
 *   <textarea ref={contentRef} value={content} ... />
 */
export function useAutoGrow<T extends HTMLTextAreaElement>(
  value: string,
  maxHeight = 260,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    // Only allow internal scrolling once the max height is reached
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  return ref;
}
