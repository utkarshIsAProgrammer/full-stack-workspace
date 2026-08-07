import React, { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { translateText } from "../utils/links";

interface TranslateInlineProps {
  text: string;
  /** Renders the displayed text (keeps hashtag/mention formatting). */
  render: (displayText: string) => React.ReactNode;
  /** Extra classes for the toggle button row. */
  className?: string;
}

/**
 * Adds a "Translate" toggle under text content (posts, comments).
 * Translates to English via the server proxy and caches the result,
 * so toggling back and forth is instant.
 */
export default function TranslateInline({
  text,
  render,
  className = "",
}: TranslateInlineProps) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [detected, setDetected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

  const handleToggle = async () => {
    if (translated) {
      setShowTranslated((v) => !v);
      return;
    }
    setLoading(true);
    const result = await translateText(text);
    setLoading(false);
    if (result) {
      setTranslated(result.translatedText);
      setDetected(result.detectedLanguage);
      setShowTranslated(true);
    }
  };

  // Hide the button entirely for trivial texts that don't need translation.
  if (!text || text.trim().length < 3) return null;

  const shownText = showTranslated && translated ? translated : text;

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <div className="w-full">{render(shownText)}</div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-zinc-400 transition-colors hover:border-white/20 hover:text-white cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Translating…
          </>
        ) : (
          <>
            <Languages className="h-2.5 w-2.5" />
            {showTranslated && translated
              ? "Show original"
              : "Translate"}
          </>
        )}
      </button>
      {showTranslated && translated && detected && detected !== "en" && (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
          Translated from {detected}
        </span>
      )}
    </div>
  );
}
