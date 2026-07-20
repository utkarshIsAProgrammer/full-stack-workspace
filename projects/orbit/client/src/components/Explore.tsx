import React, { useState, useEffect } from "react";

import { Search, Hash, Users, Compass, Heart, MessageSquare, Bookmark, Repeat2, AlertCircle, TrendingUp, Flame } from "lucide-react";
import { User, Post } from "../types";
import GlassCard from "./GlassCard";
import Skeleton from "./Skeleton";
import UserAvatar from "./UserAvatar";
import { apiFetch } from "../utils/api";
import EmptyState from "./EmptyState";
import { logger } from "../utils/logger";

interface ExploreProps {
  onUserSelected: (username: string) => void;
  onPostSelected: (slug: string) => void;
  user: any;
  followingStates: Record<string, boolean>;
  onToggleFollow: (userId: string) => Promise<void>;
}

export default function Explore({
  onUserSelected,
  onPostSelected,
  user,
  followingStates,
  onToggleFollow,
}: ExploreProps) {
  const [q, setQ] = useState("");
  const [activeSegment, setActiveSegment] = useState<"users" | "posts" | "trending">("trending");
  const [candidates, setCandidates] = useState<User[]>([]);
  const [postCandidates, setPostCandidates] = useState<Post[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);


  // Listen for realtime comment count updates from other users
  useEffect(() => {
    const handleCommentAdded = (e: CustomEvent<{ postId: string; commentsCount: number }>) => {
      const { postId, commentsCount } = e.detail;
      setPostCandidates((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p))
      );
    };
    window.addEventListener("postCommentAdded", handleCommentAdded as EventListener);
    return () => window.removeEventListener("postCommentAdded", handleCommentAdded as EventListener);
  }, []);

  // Listen for realtime post deletion
  useEffect(() => {
    const handlePostDeleted = (e: CustomEvent<{ postId: string }>) => {
      const { postId } = e.detail;
      setPostCandidates((prev) => prev.filter((p) => p._id !== postId));
    };
    window.addEventListener("postDeleted", handlePostDeleted as EventListener);
    return () => window.removeEventListener("postDeleted", handlePostDeleted as EventListener);
  }, []);

  // Listen for realtime post edits (preserve interaction status for current user)
  useEffect(() => {
    const handlePostUpdated = (e: CustomEvent<{ post: Post }>) => {
      const { post } = e.detail;
      setPostCandidates((prev) =>
        prev.map((p) =>
          p._id === post._id
            ? { ...p, ...post, likedByMe: p.likedByMe, savedByMe: p.savedByMe, repostedByMe: p.repostedByMe }
            : p,
        ),
      );
    };
    window.addEventListener("postUpdated", handlePostUpdated as EventListener);
    return () => window.removeEventListener("postUpdated", handlePostUpdated as EventListener);
  }, []);

  // Listen for realtime comment deletion (update commentsCount from authoritative server value)
  useEffect(() => {
    const handleCommentDeleted = (e: CustomEvent<{ postId: string; commentsCount: number }>) => {
      const { postId, commentsCount } = e.detail;
      setPostCandidates((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p))
      );
    };
    window.addEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
    return () => window.removeEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
  }, []);

  // Listen for realtime post view updates
  useEffect(() => {
    const handlePostViewUpdated = (e: CustomEvent<{ postId: string; viewsCount: number }>) => {
      const { postId, viewsCount } = e.detail;
      setPostCandidates((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p))
      );
    };
    window.addEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
    return () => window.removeEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
  }, []);

  // Listen for post interaction changes from other components
  useEffect(() => {
    const handleInteraction = (e: CustomEvent<{ postId: string; type: string; value: boolean; source?: string }>) => {
      const { postId, type, value, source } = e.detail;
      const isSocketSource = source === "socket";
      setPostCandidates((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p;
          if (type === "like" || type === "save" || type === "repost") {
            const statusField = type === "like" ? "likedByMe" : type === "save" ? "savedByMe" : "repostedByMe";
            const countField = type === "like" ? "likesCount" : type === "save" ? "savesCount" : "repostsCount";
            const count = Math.max(0, (p[countField as keyof Post] as number || 0) + (value ? 1 : -1));
            if (isSocketSource) {
              // Socket: only update count, leave existing status untouched
              return { ...p, [countField]: count };
            }
            // Local: update both status and count
            return { ...p, [statusField]: value, [countField]: count };
          }
          if (type === "share") {
            return { ...p, sharesCount: Math.max(0, (p.sharesCount || 0) + 1) };
          }
          return p;
        }),
      );
    };
    window.addEventListener("postInteractionChanged", handleInteraction as EventListener);
    return () => window.removeEventListener("postInteractionChanged", handleInteraction as EventListener);
  }, []);

  // Toggle like from search results
  const handleLikeToggle = async (postId: string, likedByMe: boolean) => {
    const prevLiked = likedByMe;
    const prevCount = (() => { const p = postCandidates.find(x => x._id === postId); return p?.likesCount ?? 0; })();

    setPostCandidates((prev) =>
      prev.map((p) =>
        p._id === postId
          ? { ...p, likedByMe: !prevLiked, likesCount: Math.max(0, (p.likesCount || 0) + (prevLiked ? -1 : 1)) }
          : p,
      ),
    );
    try {
      const res = await apiFetch(`/api/likes/post/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPostCandidates((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, likedByMe: prevLiked, likesCount: prevCount } : p
          )
        );
      } else {
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "like", value: !likedByMe } }));
      }
    } catch (e) {
      logger.error(e);
      setPostCandidates((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, likedByMe: prevLiked, likesCount: prevCount } : p
        )
      );
    }
  };

  // Toggle save from search results
  const handleSaveToggle = async (postId: string, savedByMe: boolean) => {
    const prevSaved = savedByMe;
    const prevCount = (() => { const p = postCandidates.find(x => x._id === postId); return p?.savesCount ?? 0; })();

    setPostCandidates((prev) =>
      prev.map((p) =>
        p._id === postId
          ? { ...p, savedByMe: !prevSaved, savesCount: Math.max(0, (p.savesCount || 0) + (prevSaved ? -1 : 1)) }
          : p,
      ),
    );
    try {
      const res = await apiFetch(`/api/saves/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPostCandidates((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, savedByMe: prevSaved, savesCount: prevCount } : p
          )
        );
      } else {
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "save", value: !savedByMe } }));
      }
    } catch (e) {
      logger.error(e);
      setPostCandidates((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, savedByMe: prevSaved, savesCount: prevCount } : p
        )
      );
    }
  };

  // Toggle repost from search results
  const handleRepostToggle = async (postId: string, repostedByMe: boolean) => {
    const prevReposted = repostedByMe;
    const prevCount = (() => { const p = postCandidates.find(x => x._id === postId); return p?.repostsCount ?? 0; })();

    setPostCandidates((prev) =>
      prev.map((p) =>
        p._id === postId
          ? { ...p, repostedByMe: !prevReposted, repostsCount: Math.max(0, (p.repostsCount || 0) + (prevReposted ? -1 : 1)) }
          : p,
      ),
    );
    try {
      const res = await apiFetch(`/api/reposts/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {      setPostCandidates((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, repostedByMe: prevReposted, repostsCount: prevCount } : p
        )
      );
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: { message: data.message || "Failed to repost", type: "error" },
      }));
      } else {
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "repost", value: !repostedByMe } }));
      }
    } catch (e) {
      logger.error(e);
      setPostCandidates((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, repostedByMe: prevReposted, repostsCount: prevCount } : p
        )
      );
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: { message: "Network connection error", type: "error" },
      }));
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setCandidates([]);
      setPostCandidates([]);
      return;
    }

    setLoading(true);
    try {
      if (activeSegment === "users") {
        const res = await apiFetch(`/api/search/users?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setCandidates(data.users || []);
        }
      } else {
        const res = await apiFetch(`/api/search/posts?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setPostCandidates(data.posts || []);
        }
      }
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trending hashtags and popular posts
  const fetchTrending = async () => {
    setLoading(true);
    try {
      const [hashtagRes, postsRes] = await Promise.all([
        apiFetch("/api/posts/trending/hashtags"),
        apiFetch("/api/posts?limit=5&sort=likesCount"),
      ]);
      const hashtagData = await hashtagRes.json();
      const postsData = await postsRes.json();
      if (hashtagRes.ok && hashtagData.success) {
        setTrendingHashtags(hashtagData.hashtags || []);
      }
      if (postsRes.ok && postsData.success) {
        setTrendingPosts(postsData.posts || []);
      }
    } catch (err) {
      logger.error("Failed to fetch trending", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSegment === "trending" && !q) {
      fetchTrending();
    }
  }, [activeSegment]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, activeSegment]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(q);
  };

  return (
    <div className="w-full px-2 pt-6 content-visibility-auto">
      {/* Search Header */}
      <div className="mb-6 px-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-[0.25em] font-black text-zinc-400 uppercase flex items-center gap-1.5">
            <Compass className="h-6 w-6 text-white shrink-0" /> EXPLORE
          </span>
          <h2 className="font-sans text-xl font-black uppercase tracking-tight text-slate-900 dark:text-zinc-100 md:text-2xl mt-1">
            Discover
          </h2>
        </div>
      </div>

      {/* Modern Search bar */}
      <form onSubmit={handleSearch} className="mb-6 relative group/form">
        <input
          type="text"
          placeholder={`Search ${activeSegment === "users" ? "users" : "posts"}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-full border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl py-3.5 pl-14 pr-24 text-[12px] md:text-sm font-medium text-slate-850 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-550 outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all shadow-md relative z-10"
        />
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 z-10" />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white text-black px-5 py-2 text-[12px] md:text-sm font-semibold transition-all hover:bg-zinc-200 active:scale-95 cursor-pointer shadow-lg z-10"
        >
          Search
        </button>
      </form>

      {/* Tab select slider */}
      <div className="mb-6 flex items-center justify-start gap-2 px-1.5">
        <button
          onClick={() => {
            setActiveSegment("trending");
            setCandidates([]);
            setPostCandidates([]);
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] md:text-sm font-medium transition-all cursor-pointer ${activeSegment === "trending"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
        >
          <Flame className="h-4 w-4" /> Trending
        </button>
        <button
          onClick={() => {
            setActiveSegment("users");
            setCandidates([]);
            setPostCandidates([]);
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] md:text-sm font-medium transition-all cursor-pointer ${activeSegment === "users"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
        >
          <Users className="h-4 w-4" /> Users
        </button>

        <button
          onClick={() => {
            setActiveSegment("posts");
            setCandidates([]);
            setPostCandidates([]);
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[12px] md:text-sm font-medium transition-all cursor-pointer ${activeSegment === "posts"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
        >
          <Hash className="h-4 w-4" /> Posts
        </button>
      </div>

      <div className="space-y-4">
        {/* Results Stream column */}
        <div className="space-y-4">            {followError && (
              <div className="mb-4 flex items-start gap-2 rounded-3xl border border-red-500/20 bg-red-500/5 p-3.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{followError}</span>
              </div>
            )}
            {loading ? (
              <div className="space-y-3">
              <Skeleton variant="profile-row" />
              <Skeleton variant="profile-row" />
              <Skeleton variant="profile-row" />
            </div>
          ) : activeSegment === "users" ? (
            candidates.length === 0 ? (
              q ? (
                <EmptyState variant="search" title="No users found" description="Try a different search term." />
              ) : null
            ) : (
              <div className="space-y-3">
                {candidates.map((usr) => (
                  <GlassCard
                    key={usr._id}
                    className="p-3 rounded-2xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={usr.profilePic?.url}
                          alt={usr.fullName}
                          className="h-8 w-8 shrink-0 rounded-full object-cover border border-zinc-800 shadow-sm cursor-pointer"
                          onClick={() => onUserSelected(usr.username)}
                        />
                        <div className="text-left min-w-0">
                          <h4
                            onClick={() => onUserSelected(usr.username)}
                            className="text-sm font-semibold text-slate-900 dark:text-zinc-100 cursor-pointer hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                          >
                            {usr.fullName}
                          </h4>
                          <span className="text-sm text-slate-500 dark:text-zinc-500 block truncate">@{usr.username}</span>
                        </div>
                      </div>                          {user && user._id !== usr._id && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setFollowError(null);
                            try {
                              await onToggleFollow(usr._id);
                            } catch {
                              setFollowError("Follow action failed. Please try again.");
                            }
                          }}
                          className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${followingStates[usr._id]
                            ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border border-zinc-300 dark:border-zinc-600 shadow-md"
                            : "bg-black text-white hover:bg-zinc-800 shadow-lg"
                            }`}
                        >
                          {followingStates[usr._id] ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )
          ) : postCandidates.length === 0 ? (
            q ? (                <EmptyState variant="search" title="No posts found" description="Try a different search term or hashtag." />
            ) : null
          ) : (
            <div className="space-y-5">
              {postCandidates.map((pst) => (
                <GlassCard
                  key={pst._id}
                  className="shadow-sm border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all rounded-4xl"
                  animate={false}
                  showMacControls={false}
                >
                  {/* Author context line */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={(pst as any).author?.profilePic?.url}
                        alt={(pst as any).author?.fullName}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserSelected((pst as any).author?.username);
                        }}
                        className="h-10 w-10 cursor-pointer rounded-full object-cover border border-zinc-800 shadow-sm"
                      />
                      <div>
                        <h4
                          onClick={(e) => {
                            e.stopPropagation();
                            onUserSelected((pst as any).author?.username);
                          }}
                          className="text-sm font-semibold text-white cursor-pointer hover:underline"
                        >
                          {(pst as any).author?.fullName}
                        </h4>
                        <p className="text-sm text-zinc-400 font-medium">@{(pst as any).author?.username}</p>
                      </div>
                    </div>
                  </div>

                  <div onClick={() => onPostSelected(pst.slug)} className="cursor-pointer space-y-3">
                    <h4 className="font-sans text-lg font-bold text-white leading-tight">{pst.title}</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{pst.content}</p>
                    {pst.image && (
                      <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-800">
                        <img loading="lazy" 
                          src={pst.image.url}
                          alt=""
                          className="w-full h-auto max-h-125 object-cover"
                        />
                      </div>
                    )}
                    {/* Post stats like in feed */}
                    <div onClick={(e) => e.stopPropagation()} className="mt-4 flex items-center justify-between pt-3 text-sm text-zinc-400">
                      <button
                        onClick={() => handleLikeToggle(pst._id, !!(pst as any).likedByMe)}
                        className="flex items-center gap-1 font-medium cursor-pointer hover:text-red-500 transition-colors"
                      >
                        <Heart className={`h-4 w-4 ${(pst as any).likedByMe ? "fill-red-500 text-red-500" : "text-zinc-550"}`} /> {pst.likesCount || 0}
                      </button>
                      <button
                        onClick={() => onPostSelected(pst.slug)}
                        className="flex items-center gap-1 font-medium cursor-pointer hover:text-white transition-colors"
                      >
                        <MessageSquare className="h-4 w-4 text-zinc-550" /> {pst.commentsCount || 0}
                      </button>
                      <button
                        onClick={() => handleSaveToggle(pst._id, !!(pst as any).savedByMe)}
                        className="flex items-center gap-1 font-medium cursor-pointer hover:text-yellow-500 transition-colors"
                      >
                        <Bookmark className={`h-4 w-4 ${(pst as any).savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-550"}`} /> {pst.savesCount || 0}
                      </button>
                      <button
                        onClick={() => handleRepostToggle(pst._id, !!(pst as any).repostedByMe)}
                        className="flex items-center gap-1 font-medium cursor-pointer hover:text-green-500 transition-colors"
                      >
                        <Repeat2 className={`h-4 w-4 ${(pst as any).repostedByMe ? "text-green-500" : "text-zinc-550"}`} /> {pst.repostsCount || 0}
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Trending feed when no search query */}
          {!q && activeSegment === "trending" && (
            <div className="space-y-6">
              {/* Trending Hashtags */}
              {trendingHashtags.length > 0 && (
                <GlassCard className="p-5 rounded-3xl border border-zinc-800/40">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-orange-400" />
                    <h3 className="text-[11px] font-black tracking-widest text-zinc-400 uppercase">
                      TRENDING HASHTAGS
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingHashtags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("forceFeedRefresh")
                          );
                          window.dispatchEvent(
                            new CustomEvent("searchHashtag", {
                              detail: { hashtag: tag },
                            })
                          );
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-700/40 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-all cursor-pointer"
                      >
                        <Hash className="h-3 w-3 text-orange-400" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Trending Posts */}
              <div>
                <h3 className="text-[11px] font-black tracking-widest text-zinc-400 uppercase mb-4 px-1 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-400" /> POPULAR POSTS
                </h3>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                    <Skeleton variant="card" />
                  </div>
                ) : trendingPosts.length > 0 ? (
                  <div className="space-y-4">
                    {trendingPosts.map((pst, idx) => (
                      <GlassCard
                        key={pst._id}
                        className="p-4 rounded-3xl border border-zinc-800/30 hover:border-zinc-700/50 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-lg font-black text-zinc-500 shrink-0 mt-1 w-6 text-center">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <UserAvatar
                                src={(pst as any).author?.profilePic?.url}
                                alt={(pst as any).author?.fullName}
                                onClick={() =>
                                  onUserSelected(
                                    (pst as any).author?.username
                                  )
                                }
                                className="h-6 w-6 rounded-full object-cover border border-zinc-800 cursor-pointer shrink-0"
                              />
                              <span
                                onClick={() =>
                                  onUserSelected(
                                    (pst as any).author?.username
                                  )
                                }
                                className="text-xs font-bold text-zinc-400 cursor-pointer hover:text-white truncate"
                              >
                                @{(pst as any).author?.username}
                              </span>
                            </div>
                            <h4
                              onClick={() => onPostSelected(pst.slug)}
                              className="text-sm font-bold text-white cursor-pointer hover:underline leading-snug"
                            >
                              {pst.title}
                            </h4>
                            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                              {pst.content}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />{" "}
                                {pst.likesCount || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />{" "}
                                {pst.commentsCount || 0}
                              </span>
                            </div>
                          </div>
                          {pst.image && (
                            <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-zinc-800">
                              <img
                                src={pst.image.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                ) : (
                  <GlassCard className="py-10 text-center rounded-3xl border border-zinc-800/30">
                    <p className="text-sm text-zinc-500">
                      No trending content right now
                    </p>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {/* Prompt card on empty search input (users/posts tabs) */}
          {!q && activeSegment !== "trending" && (
            <GlassCard className="py-14 px-6 text-center flex flex-col items-center rounded-3xl border border-zinc-800/30 bg-zinc-950/40">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 mb-4 shadow-lg">
                <Compass className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-sm font-bold text-white">Start Exploring</h4>
              <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-500 leading-relaxed">
                Search for users to connect with, or posts to discover.
              </p>
            </GlassCard>
          )}
        </div>
      </div>


    </div>
  );
}
