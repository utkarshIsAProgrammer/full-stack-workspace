import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Loader2, Lock, Globe } from "lucide-react";
import type { Glance, User } from "../types";
import { apiFetch } from "../utils/api";
import { evictCachedResponse } from "../utils/apiCache";
import { logger } from "../utils/logger";
import GlanceViewer from "./GlanceViewer";
import GlanceEditor from "./GlanceEditor";

interface GlancesFeedProps {
  user: User | null;
}

export default function GlancesFeed({ user }: GlancesFeedProps) {
  const [glances, setGlances] = useState<Glance[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [glanceVisibility, setGlanceVisibility] = useState<
    "public" | "closeFriends"
  >("public");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep latest user in a ref so the socket listeners (registered once) can
  // check authorship/close-friendship without stale closures.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Fetch glances feed. `bypass` forces a network fetch (skips the cache-first
  // path) — used right after creating a glance so the author's own new glance
  // is never wiped out by a stale cached feed that predates it.
  const fetchGlances = async (bypass: boolean = false) => {
    try {
      const res = await apiFetch(
        "/api/glimpses/feed",
        bypass ? { bypassCache: true } : undefined
      );
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
    // Clear cache for the feed endpoint on mount to ensure
    // fresh data is fetched from the network (not stale cached data).
    // The periodic refresh timer will keep the cache warm after that.
    // Evict cache first, then fetch — prevents race where apiFetch
    // reads stale cache before the eviction completes.
    evictCachedResponse("/api/glimpses/feed").catch(() => {}).then(() => {
      fetchGlances();
    });
  }, []);

  // Listen for real-time glance events
  useEffect(() => {
    const handleGlanceCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const uid = userRef.current?._id;
      // Defensive privacy check: never surface a close-friends glimpse we
      // aren't allowed to see, even if a socket payload slips through.
      if (detail?.visibility === "closeFriends") {
        const authorId = detail.author?._id?.toString();
        const isAuthor = !!uid && authorId === uid.toString();
        const isCloseFriend =
          !!uid &&
          Array.isArray(detail.author?.closeFriends) &&
          (detail.author.closeFriends as any[]).some(
            (id: any) => id?.toString() === uid.toString()
          );
        if (!isAuthor && !isCloseFriend) return;
      }
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

  // Upload a glance media blob/file to the server
  const uploadGlanceMedia = async (media: Blob, filename: string) => {
    setIsCreating(true);
    const formData = new FormData();
    formData.append("media", media, filename);
    formData.append("visibility", glanceVisibility);

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
        // Evict the feed cache then force a network refetch. The eviction in
        // apiFetch runs fire-and-forget, so a plain fetchGlances() could read
        // the still-stale cache and REMOVE the glance the author just created.
        await evictCachedResponse("/api/glimpses/feed").catch(() => {});
        await fetchGlances(true);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message:
                glanceVisibility === "closeFriends"
                  ? "Glance shared with close friends only"
                  : "Glance published to everyone",
              type: "success",
            },
          })
        );
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

    // Images go through the pre-publish editor (drag / zoom / rotate / free crop)
    if (file.type.startsWith("image/")) {
      setEditFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Videos upload directly (client-side video cropping isn't feasible)
    await uploadGlanceMedia(file, file.name);
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

  // Separate highlighted glances from regular ones
  const highlightedGlances = glances.filter((g) => g.highlighted);
  const regularGlances = glances.filter((g) => !g.highlighted);

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
  // For author grouping, use only non-highlighted glances (highlights shown separately)
  regularGlances.forEach((g) => {
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
  const hasHighlights = highlightedGlances.length > 0;

  if (!hasGlances && loading) {
    return (
      <div className="flex items-center gap-3 py-3 overflow-x-auto scrollbar-none">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col items-center gap-1 shrink-0">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 animate-pulse ring-1 ring-zinc-800 sm:h-20 sm:w-20" />
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
          className="flex items-center gap-3 px-1 py-2.5 overflow-x-auto scrollbar-thin scroll-smooth sm:py-3"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Create glance button (only for authenticated users) */}
          {user && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed transition-all cursor-pointer disabled:opacity-50 sm:h-20 sm:w-20 ${
                    glanceVisibility === "closeFriends"
                      ? "border-emerald-500/60 hover:border-emerald-400"
                      : "border-zinc-600 hover:border-white/50 bg-zinc-900/50 hover:bg-zinc-800/50"
                  }`}
                  title={
                    glanceVisibility === "closeFriends"
                      ? "Add a close-friends-only glance"
                      : "Add a public glance"
                  }
                >
                  {isCreating ? (
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  ) : glanceVisibility === "closeFriends" ? (
                    <Lock className="h-5 w-5 text-emerald-400/90" />
                  ) : (
                    <Plus className="h-5 w-5 text-zinc-400" />
                  )}
                </button>

                {/* Audience toggle — Globe (public) by default, tap to switch to
                    green Lock (close friends only). No dropdown, no overlap. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGlanceVisibility((v) =>
                      v === "public" ? "closeFriends" : "public"
                    );
                  }}
                  className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-all cursor-pointer ${
                    glanceVisibility === "closeFriends"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/25"
                      : "bg-zinc-800/90 text-zinc-300 border-zinc-600 hover:bg-zinc-700 hover:text-white"
                  }`}
                  title={
                    glanceVisibility === "closeFriends"
                      ? "Close Friends only — tap for public"
                      : "Public — tap for Close Friends only"
                  }
                  aria-label={
                    glanceVisibility === "closeFriends"
                      ? "Switch glance to public"
                      : "Switch glance to close friends"
                  }
                >
                  {glanceVisibility === "closeFriends" ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
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
                <div className="h-12 w-px bg-zinc-800 shrink-0 sm:h-16" />
              )}

                  {/* Story Highlights Header */}
              {hasHighlights && (
                <div className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer">
                  <div
                    onClick={() => {
                      const firstHighlight = highlightedGlances[0];
                      if (!firstHighlight) return;
                      const idx = glances.findIndex(
                        (g) => g._id === firstHighlight._id
                      );
                      if (idx >= 0) handleOpenViewer(idx);
                    }}
                    className="relative h-14 w-14 rounded-2xl transition-all bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-400 hover:scale-105 active:scale-95 sm:h-20 sm:w-20"
                  >
                    <div className="relative h-full w-full rounded-2xl border-2 border-zinc-950 bg-zinc-900 flex items-center justify-center">
                      <span className="text-lg">⭐</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-amber-400 truncate max-w-20 text-center">
                    Highlights
                  </span>
                </div>
              )}

              {/* Divider line */}
              {(hasHighlights || (user && hasGlances)) && (
                <div className="h-12 w-px bg-zinc-800 shrink-0 sm:h-16" />
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
                        className={`relative h-14 w-14 rounded-2xl p-[2.5px] transition-all sm:h-20 sm:w-20 ${
                          authorG.some((g) => g.visibility === "closeFriends")
                            ? "bg-gradient-to-br from-emerald-500/60 via-green-400/50 to-teal-500/60"
                            : allViewed
                              ? "bg-zinc-700"
                              : "bg-gradient-to-br from-violet-400 via-fuchsia-300 to-sky-400"
                        }`}
                      >
                        <div className="relative h-full w-full rounded-2xl overflow-hidden bg-zinc-900">
                        <img
                          src={author.profilePic?.url || ""}
                          alt={author.fullName}
                          className="relative h-full w-full object-cover"
                        />
                        {authorG.some((g) => g.visibility === "closeFriends") && (
                          <span className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/70 backdrop-blur-sm border border-emerald-500/40 shadow-md">
                            <Lock className="h-3 w-3 text-emerald-400/90" />
                          </span>
                        )}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold truncate max-w-20 text-center ${
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

      {/* Pre-publish glance editor */}
      {editFile && (
        <GlanceEditor
          file={editFile}
          onClose={() => setEditFile(null)}
          onApply={(blob) => {
            setEditFile(null);
            void uploadGlanceMedia(blob, "glance.jpg");
          }}
        />
      )}
    </>
  );
}
