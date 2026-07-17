import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Loader2 } from "lucide-react";
import type { Glance, User } from "../types";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import GlanceViewer from "./GlanceViewer";

interface GlancesFeedProps {
  user: User | null;
}

export default function GlancesFeed({ user }: GlancesFeedProps) {
  const [glances, setGlances] = useState<Glance[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch glances feed
  const fetchGlances = async () => {
    try {
      const res = await apiFetch("/api/glimpses/feed");
      const data = await res.json();
      if (res.ok && data.success) {
        setGlances(data.glimpses || []);
      }
    } catch (err) {
      logger.error("Failed to load glances", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlances();
  }, []);

  // Listen for real-time glance events
  useEffect(() => {
    const handleGlanceCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setGlances((prev) => {
        if (prev.some((g) => g._id === detail._id)) return prev;
        return [detail, ...prev];
      });
    };

    const handleGlanceViewed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setGlances((prev) =>
        prev.map((g) => {
          if (g._id !== detail.glimpseId) return g;
          return {
            ...g,
            viewers: detail.viewers,
            viewedByMe: detail.viewedByMe ?? g.viewedByMe,
          };
        })
      );
    };

    const handleGlanceExpired = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setGlances((prev) => prev.filter((g) => g._id !== detail.glimpseId));
    };

    window.addEventListener("glimpse:created", handleGlanceCreated);
    window.addEventListener("glimpse:viewed", handleGlanceViewed);
    window.addEventListener("glimpse:expired", handleGlanceExpired);

    return () => {
      window.removeEventListener("glimpse:created", handleGlanceCreated);
      window.removeEventListener("glimpse:viewed", handleGlanceViewed);
      window.removeEventListener("glimpse:expired", handleGlanceExpired);
    };
  }, []);

  // Handle creating a new glance
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Validate video duration (max 1 minute)
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.src = url;
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.onerror = resolve; // Handle corrupt files gracefully
      });
      URL.revokeObjectURL(url);
      if (video.duration > 60) {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: "Video must be 1 minute or less.", type: "error" },
          })
        );
        return;
      }
    }

    setIsCreating(true);
    const formData = new FormData();
    formData.append("media", file);

    try {
      const res = await apiFetch("/api/glimpses", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlances((prev) => {
          if (prev.some((g) => g._id === data.glimpse._id)) return prev;
          return [data.glimpse, ...prev];
        });
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: "Glance created!", type: "success" },
          })
        );
        // Instantly re-fetch glances to ensure absolute consistency
        fetchGlances();
      } else {
        throw new Error(data.message || "Failed to create glance");
      }
    } catch (err) {
      logger.error("Failed to create glance", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Failed to create glance. Image may be too large or unsupported.", type: "error" },
        })
      );
    } finally {
      setIsCreating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Open viewer for a specific glance
  const handleOpenViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Mark a glance as viewed locally (optimistic update)
  const handleLocalView = (glanceId: string) => {
    setGlances((prev) =>
      prev.map((g) => {
        if (g._id !== glanceId) return g;
        return { ...g, viewedByMe: true };
      })
    );
  };

  // Handle delete glance (author only)
  const handleDeleteGlance = async (glanceId: string) => {
    try {
      await apiFetch(`/api/glimpses/${glanceId}`, {
        method: "DELETE",
      });
      setGlances((prev) => prev.filter((g) => g._id !== glanceId));
    } catch (err) {
      logger.error("Failed to delete glance", err);
    }
  };

  // Group glances by author
  const authorsMap = new Map<string, { user: typeof glances[0]["author"]; glimpses: Glance[] }>();
  glances.forEach((g) => {
    const authorId = typeof g.author === "object" && g.author
      ? (g.author._id || (g.author as any).id)
      : g.author;
    if (!authorId) return;
    const authorStr = authorId.toString();
    if (!authorsMap.has(authorStr)) {
      authorsMap.set(authorStr, { user: g.author, glimpses: [] });
    }
    authorsMap.get(authorStr)!.glimpses.push(g);
  });
  const authorGlances = Array.from(authorsMap.values());

  // Only show if there are glances or user can create one
  const hasGlances = glances.length > 0;

  if (!hasGlances && loading) {
    return (
      <div className="flex items-center gap-3 py-3 overflow-x-auto scrollbar-none">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col items-center gap-1 shrink-0">
            <div className="h-16 w-16 rounded-full bg-zinc-900 animate-pulse border border-zinc-800" />
            <div className="h-2 w-10 bg-zinc-900 animate-pulse rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full">
        <div
          ref={scrollRef}
          className="flex items-center gap-3 px-1 py-3 overflow-x-auto scrollbar-thin scroll-smooth"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Create glance button (only for authenticated users) */}
          {user && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCreating}
                className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-zinc-600 hover:border-white/50 bg-zinc-900/50 hover:bg-zinc-800/50 transition-all cursor-pointer disabled:opacity-50"
                title="Add a glance"
              >
                {isCreating ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                ) : (
                  <Plus className="h-5 w-5 text-zinc-400" />
                )}
              </button>
              <span className="text-[9px] font-bold text-zinc-500">Add</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Only show glances section if there are glances */}
          {hasGlances && (
            <>
              {/* Divider line */}
              {user && (
                <div className="h-12 w-px bg-zinc-800 shrink-0" />
              )}

              {/* Author rings */}
              <AnimatePresence mode="popLayout">
                {authorGlances.map(({ user: author, glimpses: authorG }) => {
                  const isOwnRing = author._id === user?._id;
                  const allViewed = isOwnRing ? true : authorG.every((g) => g.viewedByMe);

                  return (
                    <motion.button
                      key={author._id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      onClick={() => {
                        // Open the first unviewed glance, or the first one
                        const firstUnviewed = authorG.find((g) => !g.viewedByMe);
                        const targetG = firstUnviewed || authorG[0];
                        const idx = glances.findIndex(
                          (g) => g._id === targetG._id
                        );
                        if (idx >= 0) handleOpenViewer(idx);
                      }}
                      className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
                    >
                      <div
                        className={`relative h-16 w-16 rounded-full p-[2.5px] transition-all ${
                          allViewed
                            ? "bg-zinc-700"
                            : "bg-gradient-to-br from-violet-400 via-fuchsia-300 to-sky-400"
                        }`}
                      >
                        <img
                          src={author.profilePic?.url || ""}
                          alt={author.fullName}
                          className="relative h-full w-full rounded-full object-cover border-2 border-zinc-950 aspect-square"
                        />
                      </div>
                      <span
                        className={`text-[9px] font-bold truncate max-w-16 text-center ${
                          allViewed ? "text-zinc-500" : "text-zinc-300"
                        }`}
                      >
                        {author.fullName.split(" ")[0]}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {/* Empty state when no glances */}
          {!hasGlances && !loading && null}
        </div>
      </div>

      {/* Full-screen glance viewer */}
      {viewerOpen && glances.length > 0 && (
        <GlanceViewer
          glimpses={glances}
          initialIndex={viewerIndex}
          onIndexChange={(idx) => setViewerIndex(idx)}
          onClose={() => {
            setViewerOpen(false);
          }}
          onView={handleLocalView}
          currentUser={user}
          onDeleteGlance={handleDeleteGlance}
        />
      )}
    </>
  );
}
