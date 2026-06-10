import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Heart,
  MessageSquare,
  Repeat2,
  Bookmark,
  Send,
  Image,
  Loader2,
  Eye,
  Share2,
  AlertCircle,
  X,
  MessageCircle,
} from "lucide-react";
import { Post, Comment, User } from "../types";
import GlassCard from "./GlassCard";
import ImageCropModal from "./ImageCropModal";
import CommentNode from "./CommentNode";
import Skeleton from "./Skeleton";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import { validatePost, validateComment } from "../utils/validation";

interface FeedProps {
  user: User | null;
  onUserSelected: (username: string) => void;
  singlePostSlug?: string | null;
  onClearSinglePost?: () => void;
  searchQuery?: string;
  showSavesOnly?: boolean;
  showRepostsOnly?: boolean;
  followingStates: Record<string, boolean>;
  autoOpenComments?: boolean;
  onClearAutoOpenComments?: () => void;
}

export default function Feed({
  user,
  onUserSelected,
  singlePostSlug,
  onClearSinglePost,
  searchQuery = "",
  showSavesOnly = false,
  showRepostsOnly = false,
  followingStates,
  autoOpenComments = false,
  onClearAutoOpenComments,
}: FeedProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches);
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // New Post Composer State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);

  // Crop states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

  // Mentions autocomplete dropdown state
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);
  const [mentionCharIndex, setMentionCharIndex] = useState(-1);

  // Active expanded Post for comments Modal/Drawer
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const isPullingRef = useRef(false);

  // Handle touch pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable if scrolled to top
    const scrollContainer = containerRef.current?.closest('[class*="overflow-y-auto"]') || containerRef.current;
    if (scrollContainer && scrollContainer.scrollTop <= 0 && e.touches[0].clientY < 150) {
      touchStartRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  };

  const handleTouchEnd = () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistance > 60) {
      setIsRefreshing(true);
      setPullDistance(0);
      fetchPosts(true).finally(() => {
        setIsRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
  };

  // Fetch posts (with support for optional search query or singular slug view)
  const fetchPosts = async (reset: boolean = false) => {
    if (reset) setLoading(true);
    try {
      let endpoint = "/api/posts?limit=10";
      if (!reset && nextCursor) {
        endpoint += `&cursor=${nextCursor}`;
      }

      // If search query is applied, redirect to search route
      if (searchQuery) {
        endpoint = `/api/search/posts?q=${encodeURIComponent(searchQuery)}&limit=10`;
        if (!reset && nextCursor) {
          endpoint += `&cursor=${nextCursor}`;
        }
      }

      // If showSavesOnly is applied, hit the saves API
      if (showSavesOnly) {
        endpoint = "/api/saves?limit=10";
        if (!reset && nextCursor) {
          endpoint += `&cursor=${nextCursor}`;
        }
      }

      // If showRepostsOnly is applied, hit the reposts API
      if (showRepostsOnly) {
        endpoint = "/api/reposts?limit=10";
        if (!reset && nextCursor) {
          endpoint += `&cursor=${nextCursor}`;
        }
      }

      const res = await apiFetch(endpoint);
      const data = await res.json();

      if (res.ok && data.success) {
        if (reset || searchQuery) {
          setPosts(data.posts || []);
        } else {
          // Filter duplicates on cursor pagination
          setPosts((prev) => {
            const keys = new Set(prev.map((p) => p._id));
            const newOnes = (data.posts || []).filter((p: any) => !keys.has(p._id));
            return [...prev, ...newOnes];
          });
        }
        setNextCursor(data.nextCursor || null);
        setHasMore(data.hasMore || false);
      } else {
        setError(data.message || "Failed to load posts.");
      }
    } catch (e) {
      setError("Database connection error.");
    } finally {
      setLoading(false);
    }
  };

  // Manage deep-linking into specific single post when specified
  const loadSinglePost = async (slug: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/posts/slug/${slug}`);
      const data = await res.json();
      if (res.ok && data.success && data.post) {
        setPosts([data.post]);
        if (autoOpenComments) {
          // Open comments thread drawer instantly
          setSelectedPost(data.post);
          loadComments(data.post._id);
          if (onClearAutoOpenComments) onClearAutoOpenComments();
        }
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (singlePostSlug) {
      loadSinglePost(singlePostSlug);
    } else {
      fetchPosts(true);
    }
  }, [singlePostSlug, searchQuery, user, showSavesOnly, showRepostsOnly, autoOpenComments]);

  useEffect(() => {
    const handleRefresh = () => {
      if (!singlePostSlug) fetchPosts(true);
    };
    window.addEventListener("forceFeedRefresh", handleRefresh);
    return () => window.removeEventListener("forceFeedRefresh", handleRefresh);
  }, [singlePostSlug]);

  // Use a ref for frequently-changing followingStates to avoid re-registering the listener
  const followingStatesRef = useRef(followingStates);
  followingStatesRef.current = followingStates;

  // Listen for realtime new posts from followed users
  useEffect(() => {
    const handleNewPost = (e: CustomEvent<{ post: Post }>) => {
      const { post } = e.detail;
      // Only prepend on the main home feed (not search, saves-only, reposts-only, or single post)
      if (searchQuery || showSavesOnly || showRepostsOnly || singlePostSlug) return;
      // Only show posts from users we follow
      if (user && followingStatesRef.current[post.author?._id]) {
        setPosts((prev) => {
          if (prev.some((p) => p._id === post._id)) return prev; // deduplicate
          return [{ ...post, likedByMe: false, savedByMe: false, repostedByMe: false } as Post, ...prev];
        });
      }
    };
    window.addEventListener("newPostCreated", handleNewPost as EventListener);
    return () => window.removeEventListener("newPostCreated", handleNewPost as EventListener);
  }, [searchQuery, showSavesOnly, showRepostsOnly, singlePostSlug, user]);	// Use a ref for selectedPost to avoid re-registering the event listener every time it changes.
	// The ref is always current, so the listener closure always has the latest value.
	const selectedPostRef = useRef(selectedPost);
	selectedPostRef.current = selectedPost;

	// Listen for realtime comment count updates from other users
	useEffect(() => {
		const handleCommentAdded = (e: CustomEvent<{ postId: string; commentsCount: number; comment?: Comment; parentCommentId?: string }>) => {
			const { postId, commentsCount, comment, parentCommentId } = e.detail;
			// Update the post's commentsCount
			setPosts((prev) =>
				prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p))
			);
			// Read the latest selectedPost from the ref
			const currentSelectedPost = selectedPostRef.current;
			// If we have the full comment data and the comments drawer is open for this post, add the comment
			if (comment && currentSelectedPost && currentSelectedPost._id === postId) {
				setComments((prev) => {
					// Deduplicate
					if (prev.some((c) => c._id === comment._id)) return prev;
					// If parentCommentId is set, add as a reply under that parent; otherwise add as top-level
					if (parentCommentId) {
						// Increment the parent's repliesCount and also add the reply to the flat list
						// so it shows up when the user expands replies on that parent
						const replyWithParent = { ...comment, parent: parentCommentId };
						const updated = prev.map((c) => {
							if (c._id === parentCommentId) {
								return {
									...c,
									repliesCount: (c.repliesCount || 0) + 1,
								};
							}
							return c;
						});
						// Also add the reply to the comments list so CommentNode's reply fetching finds it
						if (!updated.some((c) => c._id === replyWithParent._id)) {
							return [replyWithParent, ...updated];
						}
						return updated;
					}
					return [comment, ...prev];
				});
			}
		};
		window.addEventListener("postCommentAdded", handleCommentAdded as EventListener);
		return () => window.removeEventListener("postCommentAdded", handleCommentAdded as EventListener);
	}, []);

  // Listen for realtime post deletion
  useEffect(() => {
    const handlePostDeleted = (e: CustomEvent<{ postId: string }>) => {
      const { postId } = e.detail;
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    };
    window.addEventListener("postDeleted", handlePostDeleted as EventListener);
    return () => window.removeEventListener("postDeleted", handlePostDeleted as EventListener);
  }, []);

  // Listen for realtime post edits (preserve interaction status for current user)
  useEffect(() => {
    const handlePostUpdated = (e: CustomEvent<{ post: Post }>) => {
      const { post } = e.detail;
      setPosts((prev) =>
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
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p))
      );
    };
    window.addEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
    return () => window.removeEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
  }, []);

  // Listen for realtime comment like/unlike updates (update likesCount on comments in the open drawer)
  useEffect(() => {
    const handleCommentLikeChanged = (e: CustomEvent<{ commentId: string; likesCount: number }>) => {
      const { commentId, likesCount } = e.detail;
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, likesCount } : c))
      );
    };
    window.addEventListener("postCommentLikeChanged", handleCommentLikeChanged as EventListener);
    return () => window.removeEventListener("postCommentLikeChanged", handleCommentLikeChanged as EventListener);
  }, []);

  // Listen for realtime post view updates
  useEffect(() => {
    const handlePostViewUpdated = (e: CustomEvent<{ postId: string; viewsCount: number }>) => {
      const { postId, viewsCount } = e.detail;
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p))
      );
    };
    window.addEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
    return () => window.removeEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
  }, []);

  // Listen for realtime comment edits
  useEffect(() => {
    const handleCommentUpdated = (e: CustomEvent<{ comment: Comment }>) => {
      const { comment: updatedComment } = e.detail;
      setComments((prev) =>
        prev.map((c) => (c._id === updatedComment._id ? { ...c, ...updatedComment } : c))
      );
    };
    window.addEventListener("commentUpdated", handleCommentUpdated as EventListener);
    return () => window.removeEventListener("commentUpdated", handleCommentUpdated as EventListener);
  }, []);

  // Listen for realtime comment deletion in replies
  useEffect(() => {
    const handleCommentDeleted = (e: CustomEvent<{ commentId: string }>) => {
      const { commentId } = e.detail;
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    };
    window.addEventListener("commentDeleted", handleCommentDeleted as EventListener);
    return () => window.removeEventListener("commentDeleted", handleCommentDeleted as EventListener);
  }, []);

  // Listen for realtime comment emoji reactions
  useEffect(() => {
    const handleReactionChanged = (e: CustomEvent<{ commentId: string; reaction: any; type: "add" | "remove" }>) => {
      const { commentId, reaction, type } = e.detail;
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          const existingReactions = c.reactions || [];
          if (type === "add" && reaction) {
            // Remove existing reaction from same sender with same emoji, then add new one
            const filtered = existingReactions.filter(
              (r) => r.sender._id !== reaction.sender._id || r.emoji !== reaction.emoji
            );
            return { ...c, reactions: [...filtered, reaction] };
          } else if (type === "remove" && reaction) {
            const filtered = existingReactions.filter(
              (r) => r.sender._id !== reaction.sender._id || r.emoji !== reaction.emoji
            );
            return { ...c, reactions: filtered };
          }
          return c;
        })
      );
    };
    window.addEventListener("commentReactionChanged", handleReactionChanged as EventListener);
    return () => window.removeEventListener("commentReactionChanged", handleReactionChanged as EventListener);
  }, []);	// Listen for post interaction changes from socket (likes, saves, reposts from other users)
	useEffect(() => {
		const handleInteractionChanged = (e: CustomEvent<{ postId: string; type: string; value: boolean; source?: string; count?: number }>) => {
			const { postId, type, value, source, count } = e.detail;
			
			// Only update counts from socket events, not from local optimistic updates
			if (source === "local") return;
			if (!source) return; // Events without a source come from Feed's own dispatch — skip to prevent double-counting
			
			// Use absolute count from server when available (socket events carry the authoritative count)
			const getCount = (p: any, field: string) => {
				if (count !== undefined) return count;
				return Math.max(0, (p[field as keyof Post] as number || 0) + (value ? 1 : -1));
			};
			
			setPosts((prev) =>
				prev.map((p) => {
					if (p._id !== postId) return p;
					
					switch (type) {
						case "like":
							return { ...p, likesCount: getCount(p, "likesCount") };
						case "save":
							return { ...p, savesCount: getCount(p, "savesCount") };
						case "repost":
							return { ...p, repostsCount: getCount(p, "repostsCount") };
						case "share":
							return { ...p, sharesCount: count !== undefined ? count : Math.max(0, (p.sharesCount || 0) + 1) };
						default:
							return p;
					}
				})
			);

			// Also update selected post if open
			if (selectedPost && selectedPost._id === postId) {
				setSelectedPost((prev) => {
					if (!prev) return null;
					switch (type) {
						case "like":
							return { ...prev, likesCount: count !== undefined ? count : Math.max(0, (prev.likesCount || 0) + (value ? 1 : -1)) };
						case "save":
							return { ...prev, savesCount: count !== undefined ? count : Math.max(0, (prev.savesCount || 0) + (value ? 1 : -1)) };
						case "repost":
							return { ...prev, repostsCount: count !== undefined ? count : Math.max(0, (prev.repostsCount || 0) + (value ? 1 : -1)) };
						case "share":
							return { ...prev, sharesCount: count !== undefined ? count : Math.max(0, (prev.sharesCount || 0) + 1) };
						default:
							return prev;
					}
				});
			}
		};
    window.addEventListener("postInteractionChanged", handleInteractionChanged as EventListener);
    return () => window.removeEventListener("postInteractionChanged", handleInteractionChanged as EventListener);
  }, [selectedPost]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;

    // Find the scrollable parent container
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Walk up the DOM to find the first scrollable parent
    let scrollParent: Element | null = null;
    let el: Element | null = sentinel.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflow === "auto" || style.overflow === "scroll") {
        scrollParent = el;
        break;
      }
      el = el.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPosts(false);
        }
      },
      {
        root: scrollParent,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, nextCursor]);

  // Mentions Autocomplete trigger checking inside the text area on typing
  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    clearFieldError("content");

    // Look for "@" character index immediately preceding current caret position
    const cursorCoord = e.target.selectionStart;
    const wordBeforeCursor = text.slice(0, cursorCoord).split(/\s/).pop() || "";

    if (wordBeforeCursor.startsWith("@")) {
      const q = wordBeforeCursor.slice(1);
      setMentionQuery(q);
      setMentionCharIndex(cursorCoord - wordBeforeCursor.length); // Record tag position
      setShowMentionDropdown(true);

      // Call search users endpoint to get matching candidates on the fly!
      try {
        const queryRes = await apiFetch(`/api/search/users?q=${encodeURIComponent(q)}`);
        const queryData = await queryRes.json();
        if (queryRes.ok && queryData.success) {
          setCandidateUsers(queryData.users || []);
        }
      } catch (err) {
        logger.error(err);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Insert autocompleted username into content
  const selectMentionCandidate = (username: string) => {
    const textBefore = content.slice(0, mentionCharIndex);
    const textAfter = content.slice(content.indexOf("@", mentionCharIndex) + mentionQuery.length + 1);

    setContent(`${textBefore}@${username} ${textAfter}`);
    setShowMentionDropdown(false);
  };

  // Submit Post
  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePost({ title, content });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(null);
      return;
    }
    setFieldErrors({});

    setSubmittingPost(true);
    setError(null);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    if (postImageFile) {
      formData.append("image", postImageFile);
    }

    try {
      const res = await apiFetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Prepend new post dynamically to local list
        setPosts((prev) => [data.post, ...prev]);

        // Reset inputs
        setTitle("");
        setContent("");
        setPostImageFile(null);
        setPostImagePreview("");

        window.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Your post was successfully published!", type: "success" } }));
      } else {
        setError(data.message || "Failed to register post.");
      }
    } catch (err) {
      setError("Failed to save post.");
    } finally {
      setSubmittingPost(false);
    }
  };

  // Like Toggle Optimistically
  const handleLikeToggle = async (postId: string, likedByMe: boolean) => {
    // 1. Optimistic Updates inside client state instantly
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === postId) {
          const shift = likedByMe ? -1 : 1;
          return {
            ...p,
            likedByMe: !likedByMe,
            likesCount: Math.max(0, (p.likesCount || 0) + shift),
          };
        }
        return p;
      })
    );

    // Also update current active comments drawer title if open
    if (selectedPost && selectedPost._id === postId) {
      const shift = likedByMe ? -1 : 1;
      setSelectedPost((prev) =>
        prev
          ? {
            ...prev,
            likedByMe: !likedByMe,
            likesCount: Math.max(0, (prev.likesCount || 0) + shift),
          }
          : null
      );
    }

    try {
      const res = await apiFetch(`/api/likes/post/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback state on failure
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === postId) {
              const shift = likedByMe ? 1 : -1;
              return {
                ...p,
                likedByMe: likedByMe,
                likesCount: Math.max(0, p.likesCount + shift),
              };
            }
            return p;
          })
        );
      } else {
        // Broadcast to all open components with source="local" so listeners can skip
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "like", value: !likedByMe, source: "local" } }));
      }
    } catch (err) {
      logger.error(err);
    }
  };

  // Saved / Bookmark Toggle Optimistically
  const handleSaveToggle = async (postId: string, savedByMe: boolean) => {
    if (showSavesOnly && savedByMe) {
      // If we're in saves-only mode and unsaving, remove it immediately
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } else {
      // Normal update
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const shift = savedByMe ? -1 : 1;
            return {
              ...p,
              savedByMe: !savedByMe,
              savesCount: Math.max(0, (p.savesCount || 0) + shift),
            };
          }
          return p;
        })
      );
    }

    try {
      const res = await apiFetch(`/api/saves/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        if (showSavesOnly && savedByMe) {
          fetchPosts(true);
        } else {
          setPosts((prev) =>
            prev.map((p) => {
              if (p._id === postId) {
                const shift = savedByMe ? 1 : -1;
                return {
                  ...p,
                  savedByMe: savedByMe,
                  savesCount: Math.max(0, (p.savesCount || 0) + shift),
                };
              }
              return p;
            })
          );
        }
        if (selectedPost && selectedPost._id === postId) {
          const shift = savedByMe ? 1 : -1;
          setSelectedPost((prev) =>
            prev
              ? {
                  ...prev,
                  savedByMe: savedByMe,
                  savesCount: Math.max(0, (prev.savesCount || 0) + shift),
                }
              : null
          );
        }
        window.dispatchEvent(new CustomEvent("showToast", { detail: { message: data.message || "Failed to save post", type: "error" } }));
      } else {
        // Broadcast to other components with source="local" so listeners can skip
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "save", value: !savedByMe, source: "local" } }));
        window.dispatchEvent(new CustomEvent("showToast", { detail: { message: data.savedByMe ? "Post saved!" : "Post removed from saved.", type: "success" } }));
      }
    } catch (e) {
      logger.error(e);
      // Rollback on error
      if (showSavesOnly && savedByMe) {
        fetchPosts(true);
      } else {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === postId) {
              const shift = savedByMe ? 1 : -1;
              return {
                ...p,
                savedByMe: savedByMe,
                savesCount: Math.max(0, (p.savesCount || 0) + shift),
              };
            }
            return p;
          })
        );
      }
      if (selectedPost && selectedPost._id === postId) {
        const shift = savedByMe ? 1 : -1;
        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                savedByMe: savedByMe,
                savesCount: Math.max(0, (prev.savesCount || 0) + shift),
              }
            : null
        );
      }
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Network connection error", type: "error" } }));
    }
  };

  // Repost Toggle Optimistically
  const handleRepostToggle = async (postId: string, repostedByMe: boolean) => {
    if (showRepostsOnly && repostedByMe) {
      // If we're in reposts-only mode and unreposting, remove it immediately
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } else {
      // Normal update
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const shift = repostedByMe ? -1 : 1;
            return {
              ...p,
              repostedByMe: !repostedByMe,
              repostsCount: Math.max(0, (p.repostsCount || 0) + shift),
            };
          }
          return p;
        })
      );
    }

    try {
      const res = await apiFetch(`/api/reposts/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        if (showRepostsOnly && repostedByMe) {
          fetchPosts(true);
        } else {
          setPosts((prev) =>
            prev.map((p) => {
              if (p._id === postId) {
                const shift = repostedByMe ? 1 : -1;
                return {
                  ...p,
                  repostedByMe: repostedByMe,
                  repostsCount: Math.max(0, (p.repostsCount || 0) + shift),
                };
              }
              return p;
            })
          );
        }
        if (selectedPost && selectedPost._id === postId) {
          const shift = repostedByMe ? 1 : -1;
          setSelectedPost((prev) =>
            prev
              ? {
                  ...prev,
                  repostedByMe: repostedByMe,
                  repostsCount: Math.max(0, (prev.repostsCount || 0) + shift),
                }
              : null
          );
        }
        window.dispatchEvent(new CustomEvent("showToast", { detail: { message: data.message || "Failed to repost", type: "error" } }));
      } else {
        // Broadcast to other components with source="local" so listeners can skip
        window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type: "repost", value: !repostedByMe, source: "local" } }));
      }
    } catch (e) {
      logger.error(e);
      // Rollback on error
      if (showRepostsOnly && repostedByMe) {
        fetchPosts(true);
      } else {
        setPosts((prev) =>
          prev.map((p) => {
            if (p._id === postId) {
              const shift = repostedByMe ? 1 : -1;
              return {
                ...p,
                repostedByMe: repostedByMe,
                repostsCount: Math.max(0, (p.repostsCount || 0) + shift),
              };
            }
            return p;
          })
        );
      }
      if (selectedPost && selectedPost._id === postId) {
        const shift = repostedByMe ? 1 : -1;
        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                repostedByMe: repostedByMe,
                repostsCount: Math.max(0, (prev.repostsCount || 0) + shift),
              }
            : null
        );
      }
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Network connection error", type: "error" } }));
    }
  };



  // Increment Share click
  const handleSharePost = async (postId: string) => {
    try {
      const res = await apiFetch(`/api/posts/${postId}/share`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, sharesCount: data.count } : p))
        );

        // Copy landing URL
        const link = `${window.location.origin}/post/${postId}`;
        navigator.clipboard.writeText(link);
        window.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Orbit link copied to clipboard!", type: "success" } }));
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Trigger post view registration after 2 seconds
  const registerViewCount = (postId: string) => {
    apiFetch(`/api/posts/${postId}/view`, { method: "POST" });
  };

  // Comments Loading mechanics for expanded threads drawer
  const loadComments = async (postId: string) => {
    setCommentsLoading(true);
    try {
      const res = await apiFetch(`/api/comments/${postId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setComments(data.comments || []);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Submit dynamic comments inside the drawer
  const handleAddCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateComment({ content: newCommentText });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (!selectedPost) return;

    // Optimistic update: increment comment count immediately
    setPosts((prev) =>
      prev.map((p) => (p._id === selectedPost._id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
    );
    setSelectedPost((prev) => (prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : null));

    setSubmittingComment(true);
    try {
      const res = await apiFetch(`/api/comments/${selectedPost._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newCommentText,
          parent: replyToCommentId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewCommentText("");
        setReplyToCommentId(null);
        loadComments(selectedPost._id); // Reload replies
      } else {
        // Rollback on failure
        setPosts((prev) =>
          prev.map((p) => (p._id === selectedPost._id ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) } : p))
        );
        setSelectedPost((prev) => (prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) } : null));
      }
    } catch (err) {
      logger.error(err);
      // Rollback on error
      setPosts((prev) =>
        prev.map((p) => (p._id === selectedPost._id ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) } : p))
      );
      setSelectedPost((prev) => (prev ? { ...prev, commentsCount: Math.max(0, (prev.commentsCount || 0) - 1) } : null));
    } finally {
      setSubmittingComment(false);
    }
  };

  // Render text content and parsing hashtags/mentions to stylize them dynamically
  const renderFormattedContent = (contentString: string) => {
    if (!contentString) return null;
    const parts = contentString.split(/(\s+)/);
    return parts.map((part, idx) => {
      if (part.startsWith("#")) {
        return (
          <span key={idx} className="font-bold text-black dark:text-white underline cursor-pointer hover:opacity-80">
            {part}
          </span>
        );
      }
      if (part.startsWith("@")) {
        const username = part.replace(/[^\w]/g, ""); // strip punctuation
        return (
          <span
            key={idx}
            onClick={() => onUserSelected(username)}
            className="font-bold text-black dark:text-white underline decoration-dashed cursor-pointer hover:opacity-80"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Date parsing
  const getRelativeDate = (iso: string) => {
    const minDiff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    const hrDiff = Math.floor(minDiff / 60);
    if (minDiff < 1) return "Now";
    if (minDiff < 60) return `${minDiff}m`;
    if (hrDiff < 24) return `${hrDiff}h`;
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <>
      <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full px-2 pb-24 pt-6 content-visibility-auto"
      style={{ transform: `translateY(${pullDistance}px)`, transition: isPullingRef.current ? 'none' : 'transform 0.3s ease-out' }}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex items-center justify-center py-3" style={{ marginTop: isRefreshing ? 0 : -pullDistance / 2 }}>
          <div className={`flex items-center gap-2 text-[10px] text-zinc-400 ${isRefreshing ? "" : ""}`}>
            <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} style={!isRefreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9" />
            </svg>
            <span>{isRefreshing ? "Refreshing..." : "Pull to refresh"}</span>
          </div>
        </div>
      )}
      {/* Title */}
      <div className="mb-6 px-1.5 flex items-center justify-between">
        <div>                  <h2 className="font-sans text-2xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            {searchQuery ? `Search Results: "${searchQuery}"` : showSavesOnly ? "Saved Posts" : showRepostsOnly ? "Your Reposts" : "Home Feed"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {searchQuery ? "Relevant posts matching your search." : showSavesOnly ? "Access your curated collection of saved content." : showRepostsOnly ? "Content you've shared with your followers." : "Stay updated with your network's latest activity."}
          </p>
        </div>

        {singlePostSlug && (
          <button
            onClick={() => {
              if (onClearSinglePost) onClearSinglePost();
              setSelectedPost(null);
            }}
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white hover:border-zinc-500/25 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Close Filter
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-3xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Feed Layout - Reverted to single-column */}
      {!singlePostSlug && !searchQuery ? (
        <div className="space-y-6 max-w-2xl mx-auto w-full">
          <div className="space-y-6">

            {/* Post Composer Card */}
            {user && (
              <GlassCard className="shadow-sm rounded-4xl border-white/5 bg-zinc-950/20 backdrop-blur-xl">
                <form onSubmit={handleCreatePostSubmit} noValidate className="space-y-4">
                  <div className="flex gap-4">
                    <img loading="lazy"
                      src={user.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                      alt="user avatar"
                      onClick={() => onUserSelected(user.username)}
                      className="h-10 w-10 shrink-0 rounded-full object-cover border border-zinc-800 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                    />

                    <div className="w-full space-y-3">
                      {/* Post Title input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          maxLength={500}
                          placeholder="Add a title..."
                          value={title}
                          onChange={(e) => { setTitle(e.target.value); clearFieldError("title"); }}
                          className="flex-1 bg-transparent text-sm font-bold text-white placeholder-zinc-500 outline-none focus:placeholder-zinc-400"
                        />
                        <CharCounter current={title.length} max={500} />
                      </div>
                      <ValidationMessage message={fieldErrors.title} />

                      {/* Post Content input */}
                      <div className="relative">
                        <textarea
                          rows={3}
                          required
                          placeholder="Share your thoughts... Use #hashtags and @mentions"
                          value={content}
                          onChange={handleContentChange}
                          className="w-full bg-transparent text-xs text-zinc-300 placeholder-zinc-500 outline-none resize-none leading-relaxed focus:placeholder-zinc-400 relative"
                        />
                        <div className="flex items-center justify-end">
                          <CharCounter current={content.length} max={5000} />
                        </div>
                        <ValidationMessage message={fieldErrors.content} />

                        {/* Autocomplete suggestions box */}
                        {showMentionDropdown && candidateUsers.length > 0 && (
                          <div className="absolute top-full left-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-3xl border border-zinc-800 bg-zinc-900 p-2.5 shadow-xl">
                            <p className="px-2.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                              People to Mention
                            </p>
                            <div className="max-h-36 overflow-y-auto space-y-0.5">
                              {candidateUsers.map((u) => (
                                <div
                                  key={u._id}
                                  onClick={() => selectMentionCandidate(u.username)}
                                  className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                  <img loading="lazy"
                                    src={u.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                                    alt=""
                                    className="h-5.5 w-5.5 rounded-full object-cover border border-zinc-800"
                                  />
                                  <div>
                                    <p className="font-bold text-zinc-200 text-[11px]">{u.fullName}</p>
                                    <p className="text-[10px] text-zinc-500">@{u.username}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload preview image display */}
                  {postImagePreview && (
                    <div className="relative mt-2 overflow-hidden rounded-3xl border border-zinc-800">
                      <img loading="lazy" src={postImagePreview} alt="upload preview" className="w-full h-auto max-h-125 object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPostImageFile(null);
                          setPostImagePreview("");
                        }}
                        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Bottom Actions of Composer */}
                  <div className="flex items-center justify-between border-t border-zinc-800 pt-3.5">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            const file = files[0];
                            setCropImageSrc(URL.createObjectURL(file));
                            setCropModalOpen(true);
                          }
                          e.target.value = '';
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 pointer-events-none"
                      >
                        <Image className="h-4.5 w-4.5" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingPost}
                      className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black hover:bg-zinc-100 transition-all disabled:opacity-40 cursor-pointer shadow-sm animate-none"
                    >
                      {submittingPost ? "Posting..." : "Post"}{" "}
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              </GlassCard>
            )}

            {/* Main Feed Map */}
            {loading ? (
              <div className="space-y-4">
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </div>
            ) : posts.length === 0 ? (
              <GlassCard className="flex flex-col items-center justify-center py-16 text-center shadow-sm rounded-4xl">
                {showSavesOnly ? (
                  <Bookmark className="h-14 w-14 text-zinc-500/40 animate-pulse" />
                ) : showRepostsOnly ? (
                  <Repeat2 className="h-14 w-14 text-zinc-500/40 animate-pulse" />
                ) : (
                  <Sparkles className="h-8 w-8 text-zinc-500/40 animate-pulse" />
                )}
                <h3 className="mt-4 text-base font-bold text-zinc-200">
                  {showSavesOnly ? "No Saved Posts" : showRepostsOnly ? "No Reposts Yet" : "No Posts Available"}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-xs text-zinc-400 leading-relaxed">
                  {showSavesOnly
                    ? "Save posts to curate your personal collection—they will appear here for quick access."
                    : showRepostsOnly
                      ? "Share content with your network by reposting—your reposts will display here."
                      : "Create the first post to kickstart the conversation in your feed."}
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-5">
                <AnimatePresence>
                  {posts.map((post) => (
                    <motion.div
                      key={post._id}
                      initial={isMobile ? undefined : { opacity: 0, y: 15 }}
                      animate={isMobile ? undefined : { opacity: 1, y: 0 }}
                      exit={isMobile ? undefined : { opacity: 0, y: -15 }}
                      whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
                      transition={isMobile ? { duration: 0 } : { duration: 0.3 }}
                    >
                      <GlassCard
                        className="shadow-sm border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all rounded-4xl"
                        animate={false}
                        showMacControls={false}
                      >
                        {/* Author context line */}
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img loading="lazy" 
                              src={post.author.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                              alt={post.author.fullName}
                              onClick={() => onUserSelected(post.author.username)}
                              className="h-10 w-10 cursor-pointer rounded-full object-cover border border-zinc-800 shadow-sm"
                              role="button"
                              tabIndex={0}
                              onKeyPress={(e) => e.key === 'Enter' && onUserSelected(post.author.username)}
                            />
                            <div>
                              <h4
                                onClick={() => onUserSelected(post.author.username)}
                                className="font-sans text-sm font-bold text-white cursor-pointer hover:underline"
                                role="button"
                                tabIndex={0}
                                onKeyPress={(e) => e.key === 'Enter' && onUserSelected(post.author.username)}
                              >
                                {post.author.fullName}
                              </h4>
                              <p className="text-[10px] text-zinc-400 font-bold">@{post.author.username}</p>
                            </div>
                          </div>

                          <span className="text-[10px] font-medium text-zinc-500" aria-label={`Posted ${getRelativeDate(post.createdAt)}`}>
                            {getRelativeDate(post.createdAt)}
                          </span>
                        </div>

                        {/* Content block */}
                        <div className="space-y-2.5">
                          <h3 className="font-sans text-base md:text-lg font-bold text-zinc-100 tracking-tight leading-snug">
                            {post.title}
                          </h3>
                          <p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                            {renderFormattedContent(post.content)}
                          </p>
                        </div>

                        {/* Context Image media attachment */}
                        {post.image?.url && (
                          <div
                            className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/20 cursor-pointer group/image"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent("openImagePreview", { detail: post.image!.url }));
                            }}
                          >
                            <img loading="lazy" 
                              src={post.image.url}
                              alt="attachment media"
                              onLoad={() => registerViewCount(post._id)}
                              className="w-full object-cover aspect-4/5 max-h-200 transition-transform duration-500 group-hover/image:scale-[1.02]"
                            />
                          </div>
                        )}

                        {/* Bottom stats rail / Interactivity buttons with spring pops */}
                        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3.5 text-zinc-400">
                          {/* Likes button */}
                          <button
                            onClick={() => handleLikeToggle(post._id, !!post.likedByMe)}
                            className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                            aria-label={`${post.likedByMe ? 'Unlike' : 'Like'} post (${post.likesCount} likes)`}
                          >
                            <motion.span whileTap={{ scale: 1.4 }} whileHover={{ scale: 1.1 }} className="flex">
                              <Heart
                                className={`h-4 w-4 transition-colors group-hover:text-red-500 ${post.likedByMe ? "fill-red-500 text-red-500" : "text-zinc-500"
                                  }`}
                              />
                            </motion.span>
                            <span className={post.likedByMe ? "text-red-400 font-bold" : "group-hover:text-red-400 text-zinc-400"}>
                              {post.likesCount}
                            </span>
                          </button>

                          {/* Comment trigger */}
                          <button
                            onClick={() => {
                              setSelectedPost(post);
                              loadComments(post._id);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                            aria-label={`View comments (${post.commentsCount} comments)`}
                          >
                            <motion.span whileHover={{ scale: 1.1 }}>
                              <MessageSquare className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                            </motion.span>
                            <span className="group-hover:text-white text-zinc-400">{post.commentsCount}</span>
                          </button>

                          {/* Repost trigger */}
                          <button
                            onClick={() => handleRepostToggle(post._id, !!post.repostedByMe)}
                            className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                            aria-label={`${post.repostedByMe ? 'Undo repost' : 'Repost'} post (${post.repostsCount} reposts)`}
                          >
                            <motion.span whileTap={{ rotate: 180 }} whileHover={{ scale: 1.1 }} className="flex">
                              <Repeat2
                                className={`h-4 w-4 ${post.repostedByMe ? "text-green-500 font-bold" : "text-zinc-500 group-hover:text-white"
                                  }`}
                              />
                            </motion.span>
                            <span className={post.repostedByMe ? "text-green-500 font-bold" : "group-hover:text-white text-zinc-400"}>
                              {post.repostsCount}
                            </span>
                          </button>

                          {/* Save trigger */}
                          <button
                            onClick={() => handleSaveToggle(post._id, !!post.savedByMe)}
                            className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                            aria-label={`${post.savedByMe ? 'Remove from saved' : 'Save post'} (${post.savesCount} saves)`}
                          >
                            <motion.span whileTap={{ scale: 1.3 }} whileHover={{ scale: 1.1 }} className="flex">
                              <Bookmark
                                className={`h-4 w-4 transition-colors ${post.savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-500 group-hover:text-white"
                                  }`}
                              />
                            </motion.span>
                            <span className={post.savedByMe ? "text-yellow-500 font-medium" : "text-zinc-400 group-hover:text-white"}>
                              {post.savesCount}
                            </span>
                          </button>

                          {/* Viewer / Reach stats */}
                          <span className="flex items-center gap-1 text-[10px] text-zinc-500 select-none" aria-label={`${post.viewsCount || 0} views`}>
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            {post.viewsCount || 0}
                          </span>

                          {/* Share trigger icon */}
                          <button
                            onClick={() => handleSharePost(post._id)}
                            className="flex h-7.5 w-7.5 items-center justify-center rounded-full hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-500 hover:text-white"
                            aria-label="Share post"
                          >
                            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div ref={sentinelRef} className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Regular content when filtered (searched, or viewed via notification slug) */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Main Feed Map */}
          {loading ? (
            <div className="space-y-4">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : posts.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center shadow-sm rounded-4xl">
              <Sparkles className="h-8 w-8 text-zinc-500/40 animate-pulse" />
              <h3 className="mt-4 text-base font-bold text-zinc-200">No posts found</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs text-zinc-400 leading-relaxed">
                No posts are available in this feed.
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-5">
              <AnimatePresence>
                {posts.map((post) => (
                  <motion.div
                    key={post._id}
                    initial={isMobile ? undefined : { opacity: 0, y: 15 }}
                    animate={isMobile ? undefined : { opacity: 1, y: 0 }}
                    exit={isMobile ? undefined : { opacity: 0, y: -15 }}
                    whileHover={isMobile ? undefined : { y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
                    transition={isMobile ? { duration: 0 } : { duration: 0.3 }}
                  >
                    <GlassCard
                      className="shadow-sm border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all rounded-4xl"
                      animate={false}
                      showMacControls={false}
                    >
                      {/* Author context line */}
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img loading="lazy"
                            src={post.author.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                            alt={post.author.fullName}
                            onClick={() => onUserSelected(post.author.username)}
                            className="h-10 w-10 cursor-pointer rounded-full object-cover border border-zinc-800 shadow-sm"
                          />
                          <div>
                            <h4
                              onClick={() => onUserSelected(post.author.username)}
                              className="font-sans text-sm font-bold text-white cursor-pointer hover:underline"
                            >
                              {post.author.fullName}
                            </h4>
                            <p className="text-[10px] text-zinc-400 font-bold">@{post.author.username}</p>
                          </div>
                        </div>

                        <span className="text-[10px] font-medium text-zinc-500">
                          {getRelativeDate(post.createdAt)}
                        </span>
                      </div>

                      {/* Content block */}
                      <div className="space-y-2.5">
                        <h3 className="font-sans text-base md:text-lg font-bold text-zinc-100 tracking-tight leading-snug">
                          {post.title}
                        </h3>
                        <p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                          {renderFormattedContent(post.content)}
                        </p>
                      </div>

                      {/* Context Image media attachment */}
                      {post.image?.url && (
                        <div
                          className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/20 cursor-pointer group/image"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("openImagePreview", { detail: post.image!.url }));
                          }}
                        >
                          <img loading="lazy"
                            src={post.image.url}
                            alt="attachment media"
                            onLoad={() => registerViewCount(post._id)}
                            className="w-full object-cover aspect-4/5 max-h-200 transition-transform duration-500 group-hover/image:scale-[1.02]"
                          />
                        </div>
                      )}

                      {/* Bottom stats rail / Interactivity buttons with spring pops */}
                      <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3.5 text-zinc-400">
                        {/* Likes button */}
                        <button
                          onClick={() => handleLikeToggle(post._id, !!post.likedByMe)}
                          className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                        >
                          <motion.span whileTap={{ scale: 1.4 }} whileHover={{ scale: 1.1 }} className="flex">
                            <Heart
                              className={`h-4 w-4 transition-colors group-hover:text-red-500 ${post.likedByMe ? "fill-red-500 text-red-500" : "text-zinc-500"
                                }`}
                            />
                          </motion.span>
                          <span className={post.likedByMe ? "text-red-400 font-bold" : "group-hover:text-red-400 text-zinc-400"}>
                            {post.likesCount}
                          </span>
                        </button>

                        {/* Comment trigger */}
                        <button
                          onClick={() => {
                            setSelectedPost(post);
                            loadComments(post._id);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                        >
                          <motion.span whileHover={{ scale: 1.1 }}>
                            <MessageSquare className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                          </motion.span>
                          <span className="group-hover:text-white text-zinc-400">{post.commentsCount}</span>
                        </button>

                        {/* Repost trigger */}
                        <button
                          onClick={() => handleRepostToggle(post._id, !!post.repostedByMe)}
                          className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                        >
                          <motion.span whileTap={{ rotate: 180 }} whileHover={{ scale: 1.1 }} className="flex">
                            <Repeat2
                              className={`h-4 w-4 ${post.repostedByMe ? "text-green-500 font-bold" : "text-zinc-500 group-hover:text-white"
                                }`}
                            />
                          </motion.span>
                          <span className={post.repostedByMe ? "text-green-500 font-bold" : "group-hover:text-white text-zinc-400"}>
                            {post.repostsCount}
                          </span>
                        </button>

                        {/* Save trigger */}
                        <button
                          onClick={() => handleSaveToggle(post._id, !!post.savedByMe)}
                          className="flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none cursor-pointer"
                        >
                          <motion.span whileTap={{ scale: 1.3 }} whileHover={{ scale: 1.1 }} className="flex">
                            <Bookmark
                              className={`h-4 w-4 transition-colors ${post.savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-500 group-hover:text-white"
                                }`}
                            />
                          </motion.span>
                          <span className={post.savedByMe ? "text-yellow-500 font-medium" : "text-zinc-400 group-hover:text-white"}>
                            {post.savesCount}
                          </span>
                        </button>

                        {/* Viewer / Reach stats */}
                        <span className="flex items-center gap-1 text-[10px] text-zinc-500 select-none">
                          <Eye className="h-3 w-3" />
                          {post.viewsCount || 0}
                        </span>

                        {/* Share trigger icon */}
                        <button
                          onClick={() => handleSharePost(post._id)}
                          className="flex h-7.5 w-7.5 items-center justify-center rounded-full hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-500 hover:text-white"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>

      {/* Floating sliding drawer for Comments Thread details - outside transform container */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setSelectedPost(null)} />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="relative z-10 w-full max-w-4xl h-[85vh] md:h-[70vh] rounded-4xl border border-white/10 bg-zinc-950/90 backdrop-blur-2xl p-5 md:p-7 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col justify-between"
            >
              {/* Drag handle bar */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-6 flex items-center justify-between shrink-0 border-b border-white/10 pb-5">
                <div>
                  <h3 className="font-sans text-lg font-semibold text-zinc-100">Comments</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    Join the conversation
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Comment Thread Content Container */}
              <div className="grow overflow-y-auto space-y-4 pb-4 pr-2 scrollbar-thin">
                {commentsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-7 w-7 animate-spin text-white" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="py-16 text-center text-sm text-zinc-500">
                    <MessageCircle className="mx-auto h-9 w-9 text-zinc-500 mb-3 animate-bounce" />
                    No status comments. Be the first to add one!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <CommentNode
                      key={comment._id}
                      comment={comment}
                      user={user}
                      onUserSelected={(u) => {
                        onUserSelected(u);
                        setSelectedPost(null);
                      }}
                      onReply={(commentId) => {
                        setReplyToCommentId(commentId);
                        // Optional: focus input
                      }}
                      getRelativeDate={getRelativeDate}
                      renderFormattedContent={renderFormattedContent}
                    />
                  ))
                )}
              </div>

              {/* Composer input inside thread */}
              {user && (
                <form onSubmit={handleAddCommentSubmit} noValidate className="mt-4 border-t border-white/10 pt-6 shrink-0">
                  {replyToCommentId && (
                    <div className="flex items-center justify-between mb-3.5 px-4 text-xs text-zinc-400 bg-white/5 py-2.5 rounded-full border border-white/5">
                      <span>Replying to thread</span>
                      <button type="button" onClick={() => setReplyToCommentId(null)} className="hover:text-white">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3.5">
                    <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      maxLength={1000}
                      placeholder="Write a comment... (use @username)"
                      value={newCommentText}
                      onChange={(e) => { setNewCommentText(e.target.value); clearFieldError("comment"); }}
                      className="w-full rounded-full border border-white/10 bg-zinc-950/60 px-5.5 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-white/20 focus:bg-zinc-950/80 transition-all pr-16"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CharCounter current={newCommentText.length} max={1000} />
                    </div>
                  </div>
                  <ValidationMessage message={fieldErrors.comment} />
                    <button
                      type="submit"
                      disabled={submittingComment}
                      className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md shadow-black/10"
                    >
                      <Send className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropImageSrc}
        aspectRatio={undefined}
        title="Crop Photo Layout"
        onCropComplete={(blob) => {
          const file = new File([blob], `post_cropped.jpg`, { type: "image/jpeg" });
          setPostImageFile(file);
          setPostImagePreview(URL.createObjectURL(blob));
        }}
      />
    </>
  );
}
