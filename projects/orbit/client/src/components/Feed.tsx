import React, { useState, useEffect, useRef, useCallback } from "react";
import { useKeyboardOpen } from "../hooks/useKeyboardOpen";
import { useAutoGrow } from "../hooks/useAutoGrow";
import { createPortal } from "react-dom";
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
  Pencil,
  RotateCcw,
  Play,
  Volume2,
  VolumeX,
  Lock,
  Globe,
  ChevronDown,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Post, Comment, User } from "../types";
import GlassCard from "./GlassCard";
import PinchZoom from "./PinchZoom";
import ImageCarousel from "./ImageCarousel";
import UserAvatar from "./UserAvatar";
import ImageCropModal from "./ImageCropModal";
import CommentNode from "./CommentNode";
import Skeleton from "./Skeleton";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";
import GlancesFeed from "./GlancesFeed";
import MissionsPanel from "./MissionsPanel";
import TranslateInline from "./TranslateInline";
import LinkPreviewCard from "./LinkPreviewCard";
import ReportButton from "./ReportButton";
import QuoteRepostModal from "./QuoteRepostModal";
import PollCard from "./PollCard";
import ShareMenu from "./ShareMenu";
import ForwardModal, { ForwardPartner } from "./ForwardModal";
import { apiFetch } from "../utils/api";
import { getCachedResponse, evictCachedResponse } from "../utils/apiCache";
import { downscaleImageFile } from "../utils/imageCompression";
import { extractFirstUrl } from "../utils/links";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import {
	usePostViewTracking,
	registerPostView,
} from "../hooks/usePostViewTracking";
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
  onCommentsOpenChange?: (open: boolean) => void;
  readOnly?: boolean;
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
  onCommentsOpenChange,
  readOnly = false,
}: FeedProps) {
  const isKeyboardOpen = useKeyboardOpen();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches
    );
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          window.matchMedia("(pointer: coarse)").matches,
      );
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Feed mode: "home" = chronological feed, "forYou" = affinity-scored For You feed
  const [feedMode, setFeedMode] = useState<"home" | "forYou">("home");
  const [forYouPage, setForYouPage] = useState(1);

  // New Post Composer State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const contentRef = useAutoGrow<HTMLTextAreaElement>(content);
  const [postImageFiles, setPostImageFiles] = useState<File[]>([]);
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
  const [postVideoFile, setPostVideoFile] = useState<File | null>(null);
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Post visibility toggle: "public" | "closeFriends"
  const [postVisibility, setPostVisibility] = useState<
    "public" | "closeFriends"
  >("public");

  // Crop queue for sequential multi-image cropping
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [cropQueueNames, setCropQueueNames] = useState<string[]>([]);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [currentCropSrc, setCurrentCropSrc] = useState("");

  // Re-crop/replace state for individual images in the preview
  const [reCropIndex, setReCropIndex] = useState<number>(-1);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Process next image in crop queue
  const processNextCrop = useCallback(() => {
    setCropQueue((prev) => {
      if (prev.length === 0) return prev;
      const [nextSrc, ...rest] = prev;
      setCurrentCropSrc(nextSrc);
      setCropModalOpen(true);
      setCropQueueNames((names) => {
        // Keep names in sync — take the first off
        const [, ...restNames] = names;
        return restNames;
      });
      return rest;
    });
  }, []);

  // Handle crop complete — either replace at index (re-crop/replace) or append (new image)
  const handleCropComplete = useCallback(
    (blob: Blob) => {
      if (reCropIndex >= 0) {
        // Replacing an existing image (re-crop or replace)
        const fileName = cropQueueNames[0] || `cropped_image_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        setPostImageFiles((prev) => {
          const next = [...prev];
          next[reCropIndex] = file;
          return next;
        });
        // Revoke the old preview URL
        setPostImagePreviews((prev) => {
          const next = [...prev];
          if (next[reCropIndex]) URL.revokeObjectURL(next[reCropIndex]);
          next[reCropIndex] = URL.createObjectURL(file);
          return next;
        });
        if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
        // Clear queue state to prevent stale names affecting future sequential crops
        setCropQueue([]);
        setCropQueueNames([]);
        setReCropIndex(-1);
        setCropModalOpen(false);
      } else {
        // Adding a new image (normal sequential crop flow)
        const fileName = cropQueueNames[0] || `cropped_image_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        setPostImageFiles((prev) => [...prev, file]);
        if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
        setCropModalOpen(false);
        setTimeout(() => processNextCrop(), 100);
      }
    },
    [cropQueueNames, processNextCrop, currentCropSrc, reCropIndex],
  );

  // When crop queue finishes, generate previews
  useEffect(() => {
    if (cropQueue.length === 0 && !cropModalOpen && postImageFiles.length > 0) {
      // All crops done — generate previews from actual file list
      const previews = postImageFiles.map((f) => URL.createObjectURL(f));
      setPostImagePreviews(previews);
    }
  }, [cropQueue, cropModalOpen, postImageFiles]);

  // Re-crop an existing image from the preview — re-opens the crop modal
  const handleReCrop = (idx: number) => {
    const file = postImageFiles[idx];
    if (!file) return;
    // Store the original file name for the cropped result
    setCropQueueNames([file.name]);
    const url = URL.createObjectURL(file);
    setCurrentCropSrc(url);
    setReCropIndex(idx);
    setCropModalOpen(true);
  };

  // Trigger file picker for replacing an existing image
  const handleReplaceTrigger = (idx: number) => {
    setReCropIndex(idx);
    replaceFileInputRef.current?.click();
  };

  // Revoke all preview object URLs on unmount to prevent memory leaks
  const postImagePreviewsRef = useRef<string[]>([]);
  postImagePreviewsRef.current = postImagePreviews;
  useEffect(() => {
    return () => {
      postImagePreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Mentions autocomplete dropdown state
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);
  const [mentionCharIndex, setMentionCharIndex] = useState(-1);

  // Active expanded Post for comments Modal/Drawer
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Quote Repost modal state
  const [quoteRepostPost, setQuoteRepostPost] = useState<Post | null>(null);
  const [forwardPost, setForwardPost] = useState<Post | null>(null);
  // Save-to-collection modal state
  const [collectionPost, setCollectionPost] = useState<Post | null>(null);
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  const [creatingColl, setCreatingColl] = useState(false);

  // Notify parent when comments open/close
  useEffect(() => {
    onCommentsOpenChange?.(selectedPost !== null);
  }, [selectedPost, onCommentsOpenChange]);

  // Listen for closeComments event from App.tsx back button
  useEffect(() => {
    const handleCloseComments = () => setSelectedPost(null);
    window.addEventListener("closeComments", handleCloseComments);
    return () =>
      window.removeEventListener("closeComments", handleCloseComments);
  }, []);

  // Escape closes the comments drawer — desktop users expect keyboard parity
  // with every other modal/drawer in the app (backdrop click & X already work).
  useEffect(() => {
    if (!selectedPost) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPost(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedPost]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  // Pagination for the comments drawer. The server's getComment endpoint
  // returns nextCursor/hasMore per page (newest-first, cursor = oldest _id
  // seen so far); these track the live state so "Load more" appends older
  // comments without losing the already-rendered thread.
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentHasMore, setCommentHasMore] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  // In-memory cache of the last-known comment threads per post, so reopening a
  // drawer renders instantly (stale-while-revalidate) instead of waiting on a
  // full network round-trip. Stores the loaded thread AND its pagination state
  // so a partially-scrolled thread reopens exactly where it was. Bounded to the
  // 20 most recent posts.
  const commentCacheRef = useRef<
    Map<string, { comments: Comment[]; cursor: string | null; hasMore: boolean }>
  >(new Map());
  // Posts whose thread has been successfully fetched at least once — used to
  // avoid persisting a transient/never-confirmed empty list into the cache.
  const commentsFetchedRef = useRef<Set<string>>(new Set());
  const [newCommentText, setNewCommentText] = useState("");
  // WhatsApp-style comment composer: auto-grows as you type, wraps text
  // instead of scrolling sideways, and caps at 120px like the chat input.
  const commentRef = useAutoGrow<HTMLTextAreaElement>(newCommentText, 120);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>(
    {},
  );

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

  // Video playback state per post
  const [videoEnded, setVideoEnded] = useState<Record<string, boolean>>({});
  const [videoMuted, setVideoMuted] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const handleVideoEnded = (postId: string) => {
    setVideoEnded((prev) => ({ ...prev, [postId]: true }));
  };

  const handleReplayVideo = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRefs.current[postId];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setVideoEnded((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleToggleMute = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRefs.current[postId];
    if (video) {
      video.muted = !video.muted;
      setVideoMuted((prev) => ({ ...prev, [postId]: !prev[postId] }));
    }
  };

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const isPullingRef = useRef(false);

  // Post card swipe-to-like/repost state (one card at a time)
  const [swipingPostId, setSwipingPostId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartXRef = useRef(0);
  const swipeStartYRef = useRef(0);
  const isSwipingCardRef = useRef(false);

  // Handle touch pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable if scrolled to top
    const scrollContainer =
      containerRef.current?.closest('[class*="overflow-y-auto"]') ||
      containerRef.current;
    if (
      scrollContainer &&
      scrollContainer.scrollTop <= 0 &&
      e.touches[0].clientY < 150
    ) {
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

  // Post card swipe handlers (per-card, triggered from each post element)
  const handleCardTouchStart = (e: React.TouchEvent, _postId: string) => {
    const touch = e.touches[0];
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
    isSwipingCardRef.current = false;
    setSwipingPostId(null);
    setSwipeOffset(0);
  };

  const handleCardTouchMove = (e: React.TouchEvent, postId: string) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipeStartXRef.current;
    const deltaY = touch.clientY - swipeStartYRef.current;

    if (
      !isSwipingCardRef.current &&
      Math.abs(deltaX) > 15 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.5
    ) {
      isSwipingCardRef.current = true;
      setSwipingPostId(postId);
    }

    if (isSwipingCardRef.current) {
      const offset = Math.min(Math.max(-80, deltaX), 80);
      setSwipeOffset(offset);
    }
  };

  const handleCardTouchEnd = (_e: React.TouchEvent, post: Post) => {
    if (!isSwipingCardRef.current) return;
    isSwipingCardRef.current = false;
    const absOffset = Math.abs(swipeOffset);

    if (absOffset > 40) {
      if (swipeOffset > 0) {
        // Swipe right → like
        handleLikeToggle(post._id, !!post.likedByMe);
      } else {
        // Swipe left → repost
        handleRepostToggle(post._id, !!post.repostedByMe);
      }
    }

    setSwipingPostId(null);
    setSwipeOffset(0);
    swipeStartXRef.current = 0;
    swipeStartYRef.current = 0;
  };

  // Fetch posts (with support for optional search query or singular slug view)
  const fetchPosts = async (
    reset: boolean = false,
    feedModeOverride?: "home" | "forYou",
    silent: boolean = false,
  ) => {
    // Resolve the active mode here (the override exists because state updates
    // are async — a fresh click must fetch the NEW feed, not the stale one)
    const activeMode = feedModeOverride ?? feedMode;
    // Background refreshes (the 30s cache timer, socket syncs) must NOT swap
    // the visible feed to skeletons — that was causing a visible 1s blink
    // every refresh. Only user-initiated loads show the loading state.
    if (reset && !silent) setLoading(true);
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

      // If For You mode is active, hit the affinity-scored feed (page-based)
      if (activeMode === "forYou") {
        endpoint = `/api/feed/for-you?limit=10&page=${reset ? 1 : forYouPage}`;
      }
      const res = await apiFetch(
        endpoint,
        reset ? { bypassCache: true } : undefined,
      );
      const data = await res.json();

      if (res.ok && data.success) {
        if (reset || searchQuery) {
          setPosts(data.posts || []);
        } else {
          // Filter duplicates on cursor pagination
          setPosts((prev) => {
            const keys = new Set(prev.map((p) => p._id));
            const newOnes = (data.posts || []).filter(
              (p: any) => !keys.has(p._id),
            );
            return [...prev, ...newOnes];
          });
        }
        // For You feed paginates by page number, not cursor
        if (activeMode === "forYou" && !reset) {
          setForYouPage((p) => p + 1);
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

  // Switch between the main feed and the For You (affinity-scored) feed
  const handleFeedModeChange = (mode: "home" | "forYou") => {
    if (mode === feedMode) return;
    setFeedMode(mode);
    setForYouPage(1);
    setPosts([]);
    setNextCursor(null);
    setHasMore(false);
    // Pass the target mode explicitly so the very first fetch hits the right
    // endpoint even though the state hasn't re-rendered yet
    void fetchPosts(true, mode);
  };

  // When the background cache timer refreshes /api/posts data, re-fetch
  // so the feed stays up-to-date without the user lifting a finger.
  useCacheRefresh("/api/posts", () => fetchPosts(true, undefined, true));
  useCacheRefresh("/api/saves", () => fetchPosts(true, undefined, true));
  useCacheRefresh("/api/reposts", () => fetchPosts(true, undefined, true));

  // On mount, try to display cached posts instantly (stale-while-revalidate)
  // This makes repeat visits feel instant — cached data shows immediately,
  // then `fetchPosts(true)` below refreshes in the background.
  const cachedShownRef = useRef(false);
  useEffect(() => {
    if (
      singlePostSlug ||
      searchQuery ||
      showSavesOnly ||
      showRepostsOnly ||
      feedMode !== "home"
    )
      return;

    (async () => {
      try {
        const cached = await getCachedResponse<{
          posts: Post[];
          success: boolean;
          nextCursor: string | null;
          hasMore: boolean;
        }>("/api/posts?limit=10");
        if (cached?.posts?.length && cached.success) {
          setPosts(cached.posts);
          setNextCursor(cached.nextCursor || null);
          setHasMore(cached.hasMore || false);
          setLoading(false);
          cachedShownRef.current = true;
        }
      } catch {
        // Cache read failures are non-critical
      }
    })();
  }, [singlePostSlug, searchQuery, showSavesOnly, showRepostsOnly, feedMode]);

  // Manage deep-linking into specific single post when specified
  const loadSinglePost = async (slug: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/posts/slug/${slug}`, {
        bypassCache: true,
      });
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
      // If cached posts were shown above, refresh in the background so the
      // visible feed never swaps to skeletons (no blink on revisit).
      fetchPosts(true, undefined, cachedShownRef.current);
    }
  }, [
    singlePostSlug,
    searchQuery,
    user,
    showSavesOnly,
    showRepostsOnly,
    autoOpenComments,
  ]);

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

  // Listen for realtime new posts from other users AND own posts from PostModal
  useEffect(() => {
    const handleNewPost = (e: CustomEvent<{ post: Post }>) => {
      const { post } = e.detail;
      // Only prepend on the main home feed (not search, saves-only, reposts-only, or single post)
      if (searchQuery || showSavesOnly || showRepostsOnly || singlePostSlug)
        return;
      setPosts((prev) => {
        if (prev.some((p) => p._id === post._id)) return prev; // deduplicate
        return [post, ...prev];
      });
    };
    window.addEventListener("newPostCreated", handleNewPost as EventListener);
    return () =>
      window.removeEventListener(
        "newPostCreated",
        handleNewPost as EventListener,
      );
  }, [searchQuery, showSavesOnly, showRepostsOnly, singlePostSlug]); // Use a ref for selectedPost to avoid re-registering the event listener every time it changes.
  // The ref is always current, so the listener closure always has the latest value.
  const selectedPostRef = useRef(selectedPost);
  selectedPostRef.current = selectedPost;

  // Listen for realtime comment count updates from other users
  useEffect(() => {
    const handleCommentAdded = (
      e: CustomEvent<{
        postId: string;
        commentsCount: number;
        comment?: Comment;
        parentCommentId?: string;
      }>,
    ) => {
      const { postId, commentsCount, comment, parentCommentId } = e.detail;
      // Update the post's commentsCount
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)),
      );
      // Keep the open comments drawer's post count live too (previously the
      // drawer kept showing a stale count while the feed card updated).
      setSelectedPost((prev) =>
        prev && prev._id === postId ? { ...prev, commentsCount } : prev,
      );
      // Read the latest selectedPost from the ref
      const currentSelectedPost = selectedPostRef.current;
      // If we have the full comment data and the comments drawer is open for this post, add the comment
      if (
        comment &&
        currentSelectedPost &&
        currentSelectedPost._id === postId
      ) {
        setComments((prev) => {
          // Deduplicate
          if (prev.some((c) => c._id === comment._id)) return prev;
          // If parentCommentId is set, add as a reply under that parent; otherwise add as top-level
          if (parentCommentId) {
            // Increment the parent's repliesCount and also add the reply to the flat list
            // so it shows up when the user expands replies on that parent
            const replyWithParent = {
              ...comment,
              parent: parentCommentId,
            };
            const updated = prev.map((c) => {
              if (c._id === parentCommentId) {
                return {
                  ...c,
                  repliesCount: (c.repliesCount || 0) + 1,
                };
              }
              return c;
            });
            // Dispatch to the parent CommentNode instead of adding to top-level list
            window.dispatchEvent(
              new CustomEvent("commentReplyAdded", {
                detail: {
                  parentCommentId,
                  reply: replyWithParent,
                },
              }),
            );
            return updated;
          }
          return [comment, ...prev];
        });
      }
    };
    window.addEventListener(
      "postCommentAdded",
      handleCommentAdded as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postCommentAdded",
        handleCommentAdded as EventListener,
      );
  }, []);

  // Listen for realtime post deletion
  useEffect(() => {
    const handlePostDeleted = (e: CustomEvent<{ postId: string }>) => {
      const { postId } = e.detail;
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    };
    window.addEventListener("postDeleted", handlePostDeleted as EventListener);
    return () =>
      window.removeEventListener(
        "postDeleted",
        handlePostDeleted as EventListener,
      );
  }, []);

  // Listen for realtime post edits (preserve interaction status for current user)
  useEffect(() => {
    const handlePostUpdated = (e: CustomEvent<{ post: Post }>) => {
      const { post } = e.detail;
      setPosts((prev) =>
        prev.map((p) =>
          p._id === post._id
            ? {
                ...p,
                ...post,
                likedByMe: p.likedByMe,
                savedByMe: p.savedByMe,
                repostedByMe: p.repostedByMe,
              }
            : p,
        ),
      );
    };
    window.addEventListener("postUpdated", handlePostUpdated as EventListener);
    return () =>
      window.removeEventListener(
        "postUpdated",
        handlePostUpdated as EventListener,
      );
  }, []);

  // Listen for realtime poll votes — merge aggregate counts into feed + drawer
  // post. The broadcast poll carries no per-user data, so preserve the viewer's
  // own myVote from the existing post state.
  useEffect(() => {
    const handlePollUpdated = (
      e: CustomEvent<{ postId: string; poll: Post["poll"] }>,
    ) => {
      const { postId, poll } = e.detail;
      if (!poll) return;
      const mergePoll = (existing: Post["poll"]) => ({
        ...poll,
        myVote: existing?.myVote ?? poll.myVote ?? null,
      });
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, poll: mergePoll(p.poll) } : p)),
      );
      setSelectedPost((prev) =>
        prev && prev._id === postId
          ? { ...prev, poll: mergePoll(prev.poll) }
          : prev,
      );
    };
    window.addEventListener(
      "postPollUpdated",
      handlePollUpdated as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postPollUpdated",
        handlePollUpdated as EventListener,
      );
  }, []);

  // Listen for realtime comment deletion (update commentsCount from authoritative server value)
  useEffect(() => {
    const handleCommentDeleted = (
      e: CustomEvent<{ postId: string; commentsCount: number }>,
    ) => {
      const { postId, commentsCount } = e.detail;
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)),
      );
      // Keep the open comments drawer's post count in sync with deletions
      setSelectedPost((prev) =>
        prev && prev._id === postId ? { ...prev, commentsCount } : prev,
      );
    };
    window.addEventListener(
      "postCommentDeleted",
      handleCommentDeleted as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postCommentDeleted",
        handleCommentDeleted as EventListener,
      );
  }, []);

  // Listen for realtime comment like/unlike updates (update likesCount on comments in the open drawer)
  useEffect(() => {
    const handleCommentLikeChanged = (
      e: CustomEvent<{ commentId: string; likesCount: number }>,
    ) => {
      const { commentId, likesCount } = e.detail;
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, likesCount } : c)),
      );
    };
    window.addEventListener(
      "postCommentLikeChanged",
      handleCommentLikeChanged as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postCommentLikeChanged",
        handleCommentLikeChanged as EventListener,
      );
  }, []);

  // Listen for realtime post view updates
  useEffect(() => {
    const handlePostViewUpdated = (
      e: CustomEvent<{ postId: string; viewsCount: number }>,
    ) => {
      const { postId, viewsCount } = e.detail;
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p)),
      );
    };
    window.addEventListener(
      "postViewUpdated",
      handlePostViewUpdated as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postViewUpdated",
        handlePostViewUpdated as EventListener,
      );
  }, []);

  // Listen for realtime comment edits
  useEffect(() => {
    const handleCommentUpdated = (e: CustomEvent<{ comment: Comment }>) => {
      const { comment: updatedComment } = e.detail;
      setComments((prev) =>
        prev.map((c) =>
          c._id === updatedComment._id ? { ...c, ...updatedComment } : c,
        ),
      );
    };
    window.addEventListener(
      "commentUpdated",
      handleCommentUpdated as EventListener,
    );
    return () =>
      window.removeEventListener(
        "commentUpdated",
        handleCommentUpdated as EventListener,
      );
  }, []);

  // Listen for realtime comment deletion in replies
  useEffect(() => {
    const handleCommentDeleted = (e: CustomEvent<{ commentId: string }>) => {
      const { commentId } = e.detail;
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    };
    window.addEventListener(
      "commentDeleted",
      handleCommentDeleted as EventListener,
    );
    return () =>
      window.removeEventListener(
        "commentDeleted",
        handleCommentDeleted as EventListener,
      );
  }, []);

  // Listen for realtime comment emoji reactions
  useEffect(() => {
    const handleReactionChanged = (
      e: CustomEvent<{
        commentId: string;
        reaction: any;
        type: "add" | "remove";
      }>,
    ) => {
      const { commentId, reaction, type } = e.detail;
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          const existingReactions = c.reactions || [];
          if (type === "add" && reaction) {
            // Remove existing reaction from same sender with same emoji, then add new one
            const filtered = existingReactions.filter(
              (r) =>
                r.sender._id !== reaction.sender._id ||
                r.emoji !== reaction.emoji,
            );
            return { ...c, reactions: [...filtered, reaction] };
          } else if (type === "remove" && reaction) {
            const filtered = existingReactions.filter(
              (r) =>
                r.sender._id !== reaction.sender._id ||
                r.emoji !== reaction.emoji,
            );
            return { ...c, reactions: filtered };
          }
          return c;
        }),
      );
    };
    window.addEventListener(
      "commentReactionChanged",
      handleReactionChanged as EventListener,
    );
    return () =>
      window.removeEventListener(
        "commentReactionChanged",
        handleReactionChanged as EventListener,
      );
  }, []); // Listen for post interaction changes from socket (likes, saves, reposts from other users)
  useEffect(() => {
    const handleInteractionChanged = (
      e: CustomEvent<{
        postId: string;
        type: string;
        value: boolean;
        source?: string;
        count?: number;
      }>,
    ) => {
      const { postId, type, value, source, count } = e.detail;

      // Socket events carry ANOTHER user's action (they liked/saved/reposted).
      // Their action must only move the count — never color MY like/save/repost
      // buttons. Only `source === "local"` (or no source, i.e. a broadcast of
      // MY OWN action from another component like Explore/Profile) may toggle
      // the current user's *ByMe flags.
      const isSocketSource = source === "socket";

      // Sync across components
      if (source === "local") {
        // Let's still process it to synchronize other Feeds, but we should not double update the same component.
        // We can differentiate components by checking if the post already has the correct state, or by using a feed-specific instance ID.
        // However, mapping it conditionally is completely safe since React state updates are idempotent.
      }

      // Use absolute count from server when available (socket events carry the authoritative count)
      const getCount = (p: any, field: string, alreadyUpdated: boolean) => {
        if (count !== undefined) return count;
        if (alreadyUpdated) return p[field] || 0; // Already updated in this feed, don't increment/decrement again
        return Math.max(
          0,
          ((p[field as keyof Post] as number) || 0) + (value ? 1 : -1),
        );
      };

      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p;

          switch (type) {
            case "like":
              return {
                ...p,
                // Remote actions never touch my own like state
                likedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : p.likedByMe,
                likesCount: getCount(p, "likesCount", p.likedByMe === value),
              };
            case "save":
              return {
                ...p,
                savedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : p.savedByMe,
                savesCount: getCount(p, "savesCount", p.savedByMe === value),
              };
            case "repost":
              return {
                ...p,
                repostedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : p.repostedByMe,
                repostsCount: getCount(
                  p,
                  "repostsCount",
                  p.repostedByMe === value,
                ),
              };
            case "share":
              return {
                ...p,
                sharesCount:
                  count !== undefined
                    ? count
                    : Math.max(0, (p.sharesCount || 0) + 1),
              };
            default:
              return p;
          }
        }),
      );

      // Also update selected post if open
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost((prev) => {
          if (!prev) return null;
          switch (type) {
            case "like":
              return {
                ...prev,
                // Remote actions never touch my own like state
                likedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : prev.likedByMe,
                likesCount:
                  count !== undefined
                    ? count
                    : Math.max(0, (prev.likesCount || 0) + (value ? 1 : -1)),
              };
            case "save":
              return {
                ...prev,
                savedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : prev.savedByMe,
                savesCount:
                  count !== undefined
                    ? count
                    : Math.max(0, (prev.savesCount || 0) + (value ? 1 : -1)),
              };
            case "repost":
              return {
                ...prev,
                repostedByMe:
                  !isSocketSource && value !== undefined
                    ? value
                    : prev.repostedByMe,
                repostsCount:
                  count !== undefined
                    ? count
                    : Math.max(0, (prev.repostsCount || 0) + (value ? 1 : -1)),
              };
            case "share":
              return {
                ...prev,
                sharesCount:
                  count !== undefined
                    ? count
                    : Math.max(0, (prev.sharesCount || 0) + 1),
              };
            default:
              return prev;
          }
        });
      }
    };
    window.addEventListener(
      "postInteractionChanged",
      handleInteractionChanged as EventListener,
    );
    return () =>
      window.removeEventListener(
        "postInteractionChanged",
        handleInteractionChanged as EventListener,
      );
  }, [selectedPost]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Use viewport as the intersection root (root: null) instead of walking up
    // the DOM looking for a scrollable parent. The DOM-walk approach is unreliable
    // across different device layouts — on mobile the scroll container may have
    // overflow: hidden, on desktop it may be the <html> element, etc.
    // Viewport-based observation works universally.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Guard: don't fire if already loading
          if (loading) return;
          fetchPosts(false);
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, nextCursor]);

  // Mentions Autocomplete trigger checking inside the text area on typing
  const handleContentChange = async (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
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
        const queryRes = await apiFetch(
          `/api/search/users?q=${encodeURIComponent(q)}`,
        );
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
    const textAfter = content.slice(
      content.indexOf("@", mentionCharIndex) + mentionQuery.length + 1,
    );

    setContent(`${textBefore}@${username} ${textAfter}`);
    setShowMentionDropdown(false);
  };

  // Submit Post
  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePost({
      title,
      content,
      hasImages: postImageFiles.length > 0,
    });
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
    formData.append("visibility", postVisibility);
    for (const file of postImageFiles) {
      formData.append("images", await downscaleImageFile(file));
    }
    if (postVideoFile) {
      formData.append("video", postVideoFile);
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
        setPostImageFiles([]);
        setPostImagePreviews([]);
        setPostVideoFile(null);
        setPostVideoPreview(null);
        setPostVisibility("public");

        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: "Your post was successfully published!",
              type: "success",
            },
          }),
        );
      } else {
        setError(data.message || "Failed to register post.");
      }
    } catch (err) {
      setError("Failed to save post.");
    } finally {
      setSubmittingPost(false);
    }
  };

  // Poll vote update — merges the server-returned poll state into the feed
  // and the open comments drawer post so results show instantly.
  const handlePollUpdated = useCallback(
    (postId: string, poll: Post["poll"]) => {
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, poll } : p)),
      );
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost((prev) => (prev ? { ...prev, poll } : prev));
      }
    },
    [selectedPost],
  );

  // Accept a collaboration invite on a post
  const handleAcceptCollab = useCallback(
    async (postId: string) => {
      try {
        const res = await apiFetch(`/api/posts/${postId}/collab-accept`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to accept collaboration.");
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, collabAccepted: true } : p,
          ),
        );
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost((prev) => (prev ? { ...prev, collabAccepted: true } : prev));
        }
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: "Collaboration accepted! You're now a co-author of this post.",
              type: "success",
            },
          }),
        );
      } catch (err: any) {
        logger.error("Collab accept failed", err);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: err.message || "Failed to accept collaboration.",
              type: "error",
            },
          }),
        );
      }
    },
    [selectedPost],
  );

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
      }),
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
          : null,
      );
    }

    try {
      const res = await apiFetch(`/api/likes/post/${postId}`, {
        method: "POST",
      });
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
          }),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to like post",
              type: "error",
            },
          }),
        );
      } else {
        // Broadcast to all open components with source="local" so listeners can skip
        window.dispatchEvent(
          new CustomEvent("postInteractionChanged", {
            detail: {
              postId,
              type: "like",
              value: !likedByMe,
              source: "local",
            },
          }),
        );
      }
    } catch (err) {
      logger.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Network connection error",
            type: "error",
          },
        }),
      );
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
        }),
      );
    }

    try {
      const res = await apiFetch(`/api/saves/${postId}`, {
        method: "POST",
      });
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
            }),
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
              : null,
          );
        }
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to save post",
              type: "error",
            },
          }),
        );
      } else {
        // Broadcast to other components with source="local" so listeners can skip
        window.dispatchEvent(
          new CustomEvent("postInteractionChanged", {
            detail: {
              postId,
              type: "save",
              value: !savedByMe,
              source: "local",
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.savedByMe
                ? "Post saved!"
                : "Post removed from saved.",
              type: "success",
            },
          }),
        );
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
          }),
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
            : null,
        );
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Network connection error",
            type: "error",
          },
        }),
      );
    }
  };	// ─── Save to collection (organize saved posts into folders) ─────────
	const openSaveToCollection = async (post: Post) => {
		setCollectionPost(post);
		setLoadingCollections(true);
		try {
			const res = await apiFetch("/api/collections");
			const data = await res.json();
			if (res.ok && data.success) {
				setMyCollections(data.collections || []);
			}
		} catch (e) {
			logger.error("Failed to load collections", e);
		} finally {
			setLoadingCollections(false);
		}
	};

	const handleAddToCollection = async (collectionId: string) => {
		if (!collectionPost) return;
		try {
			const res = await apiFetch(
				`/api/collections/${collectionId}/posts/${collectionPost._id}`,
				{ method: "POST" },
			);
			if (res.ok) {
				void evictCachedResponse("/api/collections");
				void evictCachedResponse(
					`/api/collections/${collectionId}`,
				);
				setCollectionPost(null);
				window.dispatchEvent(
					new CustomEvent("showToast", {
						detail: {
							message: "Added to collection!",
							type: "success",
						},
					}),
				);
			}
		} catch (e) {
			logger.error("Add to collection failed", e);
		}
	};

	const handleCreateAndAddCollection = async () => {
		if (!collectionPost || !newCollName.trim() || creatingColl) return;
		setCreatingColl(true);
		try {
			const res = await apiFetch("/api/collections", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newCollName.trim() }),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.message || "Failed to create collection.");
			// Keep the open picker list in sync so the new collection shows
			// immediately (plus evict the stale cached list).
			setMyCollections((prev) => [data.collection, ...prev]);
			void evictCachedResponse("/api/collections");
			await handleAddToCollection(data.collection._id);
		} catch (err: any) {
			logger.error("Create collection failed", err);
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: {
						message: err.message || "Failed to create collection.",
						type: "error",
					},
				}),
			);
		} finally {
			setCreatingColl(false);
			setNewCollName("");
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
        }),
      );
    }

    try {
      const res = await apiFetch(`/api/reposts/${postId}`, {
        method: "POST",
      });
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
            }),
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
              : null,
          );
        }
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to repost",
              type: "error",
            },
          }),
        );
      } else {
        // Broadcast to other components with source="local" so listeners can skip
        window.dispatchEvent(
          new CustomEvent("postInteractionChanged", {
            detail: {
              postId,
              type: "repost",
              value: !repostedByMe,
              source: "local",
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: !repostedByMe ? "Reposted!" : "Repost removed.",
              type: "success",
            },
          }),
        );
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
          }),
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
            : null,
        );
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Network connection error",
            type: "error",
          },
        }),
      );
    }
  };

  // Quote Repost — open modal then create quote-repost
  const handleQuoteRepost = async (postId: string) => {
    const post = posts.find((p) => p._id === postId);
    if (post) {
      setQuoteRepostPost(post);
    }
  };

  // Submit quote repost from modal
  const handleSubmitQuoteRepost = async (quoteContent: string) => {
    const postId = quoteRepostPost?._id;
    if (!postId) return;

    const trimmed = quoteContent.trim().slice(0, 1000);

    try {
      const res = await apiFetch(`/api/posts/${postId}/quote-repost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteContent: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Increment repost count optimistically
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? {
                  ...p,
                  repostedByMe: true,
                  repostsCount: (p.repostsCount || 0) + 1,
                }
              : p,
          ),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: "Quote reposted!", type: "success" },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to quote repost",
              type: "error",
            },
          }),
        );
      }
    } catch (e) {
      logger.error(e);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Network connection error",
            type: "error",
          },
        }),
      );
    }
  };

  // Copy a post link to the clipboard (counts the share server-side)
  const copyPostLink = async (post: Post) => {
    try {
      const res = await apiFetch(`/api/posts/${post._id}/share`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === post._id
              ? { ...p, sharesCount: data.shares ?? data.count }
              : p,
          ),
        );
      }
    } catch (e) {
      logger.error(e);
    }

    const link = `${window.location.origin}/post/${post.slug}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch (e) {
      // Fallback for browsers without the async clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (clipErr) {
        logger.error("Clipboard copy failed", clipErr);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: "Could not copy link", type: "error" },
          }),
        );
        return;
      }
    }
    window.dispatchEvent(
      new CustomEvent("showToast", {
        detail: { message: "Post link copied!", type: "success" },
      }),
    );
  };

  // Forward a post to one or more chat partners (notifies each recipient)
  const handleForwardPost = async (
    partners: ForwardPartner[],
  ): Promise<boolean> => {
    if (!forwardPost || partners.length === 0) return false;
    try {
      const results = await Promise.all(
        partners.map(async (partner) => {
          try {
            const res = await apiFetch(
              `/api/posts/${forwardPost._id}/forward`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientId: partner._id }),
              },
            );
            const data = await res.json();
            return res.ok && data.success;
          } catch {
            return false;
          }
        }),
      );
      const okCount = results.filter(Boolean).length;
      if (okCount > 0) {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === forwardPost._id
              ? { ...p, sharesCount: (p.sharesCount || 0) + okCount }
              : p,
          ),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message:
                okCount === partners.length
                  ? "Post forwarded!"
                  : `Post forwarded to ${okCount} of ${partners.length} chats.`,
              type: "success",
            },
          }),
        );
        return true;
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Failed to forward post", type: "error" },
        }),
      );
      return false;
    } catch (e) {
      logger.error("Failed to forward post", e);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Failed to forward post", type: "error" },
        }),
      );
      return false;
    }
  };

  // Keep the in-memory comment cache bounded to the 20 most recent posts.
  // Shared by the persist effect and prefetchComments so the two writers can
  // never drift apart in eviction behavior.
  const trimCommentCache = () => {
    const keys = [...commentCacheRef.current.keys()];
    while (commentCacheRef.current.size > 20) {
      commentCacheRef.current.delete(keys[0]);
      keys.shift();
    }
  };

  // Warm a post's comment thread BEFORE the drawer opens so the first open
  // feels instant. Fired when a card scrolls into view and on hover/focus of
  // the comments button. Idempotent: skips posts already cached or already
  // being prefetched, and honors readOnly (no usable drawer there). The
  // response is written into commentCacheRef in the exact shape loadComments
  // expects, so when the user taps the button the drawer renders immediately
  // (stale-while-revalidate) instead of showing a skeleton while page 1 loads.
  const commentPrefetchingRef = useRef<Set<string>>(new Set());
  const prefetchComments = (postId: string) => {
    if (readOnly) return;
    if (commentCacheRef.current.has(postId)) return;
    if (commentPrefetchingRef.current.has(postId)) return;
    commentPrefetchingRef.current.add(postId);
    apiFetch(`/api/comments/${postId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success) return;
        commentsFetchedRef.current.add(postId);
        commentCacheRef.current.set(postId, {
          comments: (data.comments || []) as Comment[],
          cursor: (data.nextCursor as string) || null,
          hasMore: !!data.hasMore,
        });
        trimCommentCache();
      })
      .catch(() => {
        /* best-effort prefetch — a failure here only means the drawer will
           fetch on open; never log noise for cards users may not open */
      })
      .finally(() => {
        commentPrefetchingRef.current.delete(postId);
      });
  };

  // Post view tracking (3s visibility → POST /view, deduped per post). Also
  // prefetches the comment thread as cards scroll into view for an instant
  // first drawer open.
  usePostViewTracking({
    enabled: !loading && posts.length > 0,
    onIntersect: prefetchComments,
    deps: [posts, loading],
  });

  // Media onPlay/onLoad count a view instantly (shared app-wide dedup).

  // Comments Loading mechanics for expanded threads drawer
  const loadComments = async (postId: string) => {
    // Stale-while-revalidate: if we already have this thread in memory, show it
    // INSTANTLY (zero spinner) while the fresh fetch runs in the background.
    // The fetch still bypasses the HTTP cache so the drawer always converges on
    // the freshest server state — other users' comments arrive via socket while
    // it's open anyway.
    // `.has()` (not truthiness) so a cached EMPTY thread (a post with zero
    // comments) is treated as a valid cached thread, not as a cache miss.
    const cached = commentCacheRef.current.get(postId);
    if (cached) {
      setComments(cached.comments);
      setCommentCursor(cached.cursor);
      setCommentHasMore(cached.hasMore);
      setCommentsLoading(false);
    } else {
      // Clear any thread from a previously opened post, then show a skeleton.
      setComments([]);
      setCommentCursor(null);
      setCommentHasMore(false);
      setCommentsLoading(true);
    }
    try {
      const res = await apiFetch(`/api/comments/${postId}`, {
        bypassCache: true,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        commentsFetchedRef.current.add(postId);
        const fresh: Comment[] = data.comments || [];
        if (cached && cached.comments.length > 0 && fresh.length > 0) {
          // We previously loaded deeper than one page (Load more) — MERGE the
          // fresh first page into the LIVE thread (functional update, so any
          // socket-driven adds/deletes/reactions that landed while this fetch
          // was in flight are preserved) instead of replacing it. Newest first,
          // older loaded pages stay. Sorted by _id (desc) so a brand-new socket
          // comment always sits at the top.
          const freshIds = new Set(fresh.map((c) => c._id));
          setComments((prev) =>
            [...fresh, ...prev.filter((c) => !freshIds.has(c._id))].sort(
              (a, b) => (a._id < b._id ? 1 : -1),
            ),
          );
          // If the cached thread reached deeper than the fresh first page,
          // keep ITS pagination (cursor = oldest loaded, hasMore from the last
          // page fetched); otherwise adopt the server's page-1 pagination.
          const hasOlderPages = cached.comments.some(
            (c) => !freshIds.has(c._id),
          );
          if (hasOlderPages) {
            setCommentCursor(cached.cursor);
            setCommentHasMore(cached.hasMore);
          } else {
            setCommentCursor(data.nextCursor || null);
            setCommentHasMore(!!data.hasMore);
          }
        } else if (fresh.length === 0) {
          // Server reports zero comments — the whole thread is gone (e.g. all
          // comments deleted while the app was closed). Adopt the empty state
          // so stale cached comments are never resurrected.
          setComments([]);
          setCommentCursor(null);
          setCommentHasMore(false);
        } else {
          setComments(fresh);
          setCommentCursor(data.nextCursor || null);
          setCommentHasMore(!!data.hasMore);
        }
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Append the next older page of comments when the user taps "Load more".
  // Merges server comments into the existing list (deduping by _id so socket
  // additions during the fetch never duplicate), updates the cursor, and hides
  // the button once the server reports no more pages.
  const loadMoreComments = async () => {
    if (!selectedPost || !commentCursor || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const res = await apiFetch(
        `/api/comments/${selectedPost._id}?cursor=${encodeURIComponent(commentCursor)}`,
        { bypassCache: true },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setComments((prev) => {
          const seen = new Set(prev.map((c) => c._id));
          const merged = [...prev];
          for (const c of data.comments || []) {
            if (!seen.has(c._id)) {
              merged.push(c);
              seen.add(c._id);
            }
          }
          return merged;
        });
        setCommentCursor(data.nextCursor || null);
        setCommentHasMore(!!data.hasMore);
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setCommentsLoadingMore(false);
    }
  };

  // Persist the open drawer's thread (comments + pagination state) to the
  // in-memory cache on EVERY change (socket adds/deletes, optimistic adds,
  // reactions, likes, load-more) so reopens are instant and resume exactly
  // where the user left off. Bounded to the 20 most recent posts.
  useEffect(() => {
    if (!selectedPost) return;
    // Never persist an empty thread that hasn't been SUCCESSFULLY fetched yet:
    // the cache-miss branch clears comments before its fetch resolves, and a
    // failed fetch would otherwise permanently cache an empty thread for a post
    // that may have comments. A server-confirmed empty thread IS cached.
    if (
      comments.length === 0 &&
      !commentsFetchedRef.current.has(selectedPost._id)
    ) {
      return;
    }
    commentCacheRef.current.set(selectedPost._id, {
      comments,
      cursor: commentCursor,
      hasMore: commentHasMore,
    });
    trimCommentCache();
  }, [comments, selectedPost, commentCursor, commentHasMore]);

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
      prev.map((p) =>
        p._id === selectedPost._id
          ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
          : p,
      ),
    );
    setSelectedPost((prev) =>
      prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : null,
    );

    setSubmittingComment(true);
    try {
      const res = await apiFetch(`/api/comments/${selectedPost._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newCommentText,
          ...(replyToCommentId ? { parent: replyToCommentId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewCommentText("");
        setReplyToCommentId(null);
        // Directly prepend the returned comment for instant feedback
        if (data.comment) {
          // If it's a reply, dispatch to the parent CommentNode
          if (data.comment.parent) {
            const parentId =
              typeof data.comment.parent === "object"
                ? data.comment.parent._id || data.comment.parent
                : data.comment.parent;
            window.dispatchEvent(
              new CustomEvent("commentReplyAdded", {
                detail: {
                  parentCommentId: parentId,
                  reply: data.comment,
                },
              }),
            );
          } else {
            // Top-level comment — prepend
            setComments((prev) => {
              if (prev.some((c) => c._id === data.comment._id)) return prev;
              return [data.comment, ...prev];
            });
          }
        }
      } else {
        // Rollback on failure
        setPosts((prev) =>
          prev.map((p) =>
            p._id === selectedPost._id
              ? {
                  ...p,
                  commentsCount: Math.max(0, (p.commentsCount || 0) - 1),
                }
              : p,
          ),
        );
        setSelectedPost((prev) =>
          prev
            ? {
                ...prev,
                commentsCount: Math.max(0, (prev.commentsCount || 0) - 1),
              }
            : null,
        );
      }
    } catch (err) {
      logger.error(err);
      // Rollback on error
      setPosts((prev) =>
        prev.map((p) =>
          p._id === selectedPost._id
            ? {
                ...p,
                commentsCount: Math.max(0, (p.commentsCount || 0) - 1),
              }
            : p,
        ),
      );
      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              commentsCount: Math.max(0, (prev.commentsCount || 0) - 1),
            }
          : null,
      );
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
          <span
            key={idx}
            className="font-bold text-black dark:text-white underline cursor-pointer hover:opacity-80"
          >
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
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full px-1 pt-4 sm:px-2 sm:pt-6 content-visibility-auto"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPullingRef.current ? "none" : "transform 0.3s ease-out",
        }}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || isRefreshing) && (
          <div
            className="flex items-center justify-center py-3"
            style={{
              marginTop: isRefreshing ? 0 : -pullDistance / 2,
            }}
          >
            <div
              className={`flex items-center gap-2 text-[11px] text-zinc-400 ${isRefreshing ? "" : ""}`}
            >
              <svg
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                style={
                  !isRefreshing
                    ? {
                        transform: `rotate(${pullDistance * 3}deg)`,
                      }
                    : undefined
                }
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9" />
              </svg>
              <span>{isRefreshing ? "Refreshing..." : "Pull to refresh"}</span>
            </div>
          </div>
        )}
        {/* Title — shares the same max-w-2xl column as the posts below so
				    the heading/glances never stretch wider than the feed cards,
				    even when the right sidebar is hidden. */}
        <div className="mb-4 max-w-2xl mx-auto w-full flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {" "}
            <h2 className="text-display text-slate-900 dark:text-zinc-100">
              {searchQuery
                ? `Search Results: "${searchQuery}"`
                : showSavesOnly
                  ? "Saved Posts"
                  : showRepostsOnly
                    ? "Your Reposts"
                    : "Home Feed"}
            </h2>
            <p className="text-base text-slate-500 dark:text-zinc-400">
              {searchQuery
                ? "Relevant posts matching your search."
                : showSavesOnly
                  ? "Access your curated collection of saved content."
                  : showRepostsOnly
                    ? "Content you've shared with your followers."
                    : "Stay updated with your network's latest activity."}
            </p>

            {/* Feed mode toggle: Home vs For You (affinity-scored) */}
            {!searchQuery &&
              !showSavesOnly &&
              !showRepostsOnly &&
              !singlePostSlug && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
                  <button
                    onClick={() => handleFeedModeChange("home")}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      feedMode === "home"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => handleFeedModeChange("forYou")}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      feedMode === "forYou"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    For You
                  </button>
                </div>
              )}
          </div>

          {singlePostSlug && (
            <button
              onClick={() => {
                if (onClearSinglePost) onClearSinglePost();
                setSelectedPost(null);
              }}
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-[12px] md:text-sm font-bold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white hover:border-zinc-500/25 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Close Filter
            </button>
          )}
        </div>

        {/* Glances Feed — squarish cards with curved edges, below the title.
				    Constrained to the same column as the posts so the glance
				    strip aligns with the feed cards at every viewport width. */}
        {user &&
          !searchQuery &&
          !showSavesOnly &&
          !showRepostsOnly &&
          !singlePostSlug && (
            <div className="mb-8 max-w-2xl mx-auto w-full">
              <GlancesFeed user={user} />
            </div>
          )}

        {error && (
          <div className="mb-5 max-w-2xl mx-auto w-full flex items-start gap-2 rounded-3xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Feed Layout - Reverted to single-column */}
        {!singlePostSlug && !searchQuery ? (
          <div className="space-y-6 max-w-2xl mx-auto w-full px-0">
            <div className="space-y-6">
              {" "}
              {/* Daily Missions Panel — only on main feed for logged-in users */}
              {user && !showSavesOnly && !showRepostsOnly && <MissionsPanel />}
              {/* Post Composer Card — hidden on mobile per user request */}
              {user && !isMobile && !showSavesOnly && !showRepostsOnly && (
                <GlassCard className="shadow-sm rounded-4xl border-white/5 bg-zinc-950/20 backdrop-blur-xl">
                  <form
                    onSubmit={handleCreatePostSubmit}
                    noValidate
                    className={`transition-all duration-200 ${
                      isKeyboardOpen ? "space-y-2.5" : "space-y-4"
                    }`}
                  >
                    <div className="flex gap-4">
                      <UserAvatar
                        src={user.profilePic?.url}
                        alt="user avatar"
                        onClick={() => onUserSelected(user.username)}
                        className="h-9 w-9 shrink-0 self-start rounded-full object-cover border border-zinc-800 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                      />					      <div className="flex-1 min-w-0 space-y-3">
					        {/* Post Title input — error shown just above the field */}
					        <ValidationMessage
					          message={fieldErrors.title}
					          className="-mx-4"
					        />
					        <div className="flex items-center gap-2">
					          <input
					            type="text"
					            maxLength={500}
					            placeholder="Add a title... (optional)"
					            value={title}
					            onChange={(e) => {
					              setTitle(e.target.value);
					              clearFieldError("title");
					            }}
					            className="flex-1 bg-transparent text-[12px] md:text-sm font-bold text-white placeholder-zinc-500 outline-none focus:placeholder-zinc-400 rounded-none"
					          />
					          <CharCounter current={title.length} max={500} />
					        </div>

					        {/* Post Content input — error shown just above the field */}
					        <ValidationMessage
					          message={fieldErrors.content}
					          className="-mx-4 px-1"
					        />
					        <div className="relative">
					          <textarea
					            ref={contentRef}
					            rows={3}
					            placeholder="Share your thoughts... Use #hashtags and @mentions (optional)"
					            value={content}
					            onChange={handleContentChange}
					            className="w-full bg-transparent text-[12px] md:text-sm text-zinc-300 placeholder-zinc-500 outline-none resize-none leading-relaxed focus:placeholder-zinc-400 relative rounded-none px-1"
					          />
					          <div className="flex items-center justify-end">
					            <CharCounter current={content.length} max={5000} />
					          </div>

                          {/* Autocomplete suggestions box */}
                          {showMentionDropdown && candidateUsers.length > 0 && (
                            <div className="absolute top-full left-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-3xl border border-zinc-800 bg-zinc-900 p-2.5 shadow-xl">
                              <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                People to Mention
                              </p>
                              <div className="max-h-36 overflow-y-auto space-y-0.5">
                                {candidateUsers.map((u) => (
                                  <div
                                    key={u._id}
                                    onClick={() =>
                                      selectMentionCandidate(u.username)
                                    }
                                    className="flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                                  >
                                    <UserAvatar
                                      src={u.profilePic?.url}
                                      alt=""
                                      className="h-5.5 w-5.5 rounded-full object-cover border border-zinc-800"
                                    />
                                    <div>
                                      <p className="font-bold text-zinc-200 text-[12px]">
                                        {u.fullName}
                                      </p>
                                      <p className="text-[11px] text-zinc-500">
                                        @{u.username}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Upload preview image display — multiple images */}
                    {postImagePreviews.length > 0 && (
                      <div className="mt-2 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        {postImagePreviews.map((preview, idx) => (
                          <div
                            key={idx}
                            className="relative shrink-0 overflow-hidden rounded-2xl border border-zinc-800 w-28 h-28"
                          >
                            <img
                              loading="lazy"
                              decoding="async"
                              src={preview}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {/* Overlay actions on hover */}
                            <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReCrop(idx);
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-all"
                                title="Re-crop image"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplaceTrigger(idx);
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-all"
                                title="Replace image"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                // Revoke the preview URL to prevent leaks
                                URL.revokeObjectURL(preview);
                                setPostImageFiles((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                                setPostImagePreviews((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                              }}
                              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black z-20"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Video preview in composer */}
                    {postVideoPreview && (
                      <div className="mt-2 relative overflow-hidden rounded-2xl border border-zinc-800 bg-black/60 max-w-md">
                        <video
                          src={postVideoPreview}
                          className="w-full max-h-48"
                          preload="metadata"
                          playsInline
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(postVideoPreview);
                            setPostVideoFile(null);
                            setPostVideoPreview(null);
                          }}
                          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black z-20"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[9px] font-bold text-white">
                          Video
                        </div>
                      </div>
                    )}

                    {/* Bottom Actions of Composer */}
                    <div
                      className={`flex items-center justify-between border-t border-zinc-800 transition-all duration-200 ${
                        isKeyboardOpen ? "pt-2.5" : "pt-3.5"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            disabled={
                              postImageFiles.length >= 5 || !!postVideoFile
                            }
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length === 0) return;

                              // Check if there is any video in the selected files
                              const videoFile = files.find((f) =>
                                f.type.startsWith("video/"),
                              );
                              if (videoFile) {
                                // Clear any image files/previews
                                postImagePreviews.forEach((url) =>
                                  URL.revokeObjectURL(url),
                                );
                                setPostImageFiles([]);
                                setPostImagePreviews([]);
                                setCropQueue([]);
                                setCropQueueNames([]);

                                // Set video
                                const preview = URL.createObjectURL(videoFile);
                                setPostVideoFile(videoFile);
                                setPostVideoPreview(preview);
                              } else {
                                // It's all images/gifs
                                // Clear video if any existed
                                if (postVideoPreview) {
                                  URL.revokeObjectURL(postVideoPreview);
                                }
                                setPostVideoFile(null);
                                setPostVideoPreview(null);

                                const remaining = 5 - postImageFiles.length;
                                const toAdd = files.slice(0, remaining);

                                setReCropIndex(-1);
                                const gifFiles = toAdd.filter(
                                  (f) => f.type === "image/gif",
                                );
                                const cropFiles = toAdd.filter(
                                  (f) => f.type !== "image/gif",
                                );

                                if (gifFiles.length > 0) {
                                  setPostImageFiles((prev) => [
                                    ...prev,
                                    ...gifFiles,
                                  ]);
                                  const gifPreviews = gifFiles.map((f) =>
                                    URL.createObjectURL(f),
                                  );
                                  setPostImagePreviews((prev) => [
                                    ...prev,
                                    ...gifPreviews,
                                  ]);
                                }

                                const newUrls = cropFiles.map((f) =>
                                  URL.createObjectURL(f),
                                );
                                const newNames = cropFiles.map((f) => f.name);
                                setCropQueue((prev) => [...prev, ...newUrls]);
                                setCropQueueNames((prev) => [
                                  ...prev,
                                  ...newNames,
                                ]);

                                if (
                                  cropQueue.length === 0 &&
                                  !cropModalOpen &&
                                  newUrls.length > 0
                                ) {
                                  setCurrentCropSrc(newUrls[0]);
                                  setCropModalOpen(true);
                                  setCropQueue((prev) => {
                                    const [, ...rest] = prev;
                                    return rest;
                                  });
                                }
                              }
                              e.target.value = "";
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <button
                            type="button"
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all pointer-events-none ${
                              postImageFiles.length > 0 || postVideoFile
                                ? "bg-violet-600/30 text-violet-400 border border-violet-500/30"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                            }`}
                          >
                            <Image className="h-4.5 w-4.5" />
                          </button>
                        </div>
                        {(postImageFiles.length > 0 || postVideoFile) &&
                          !isKeyboardOpen && (
                            <span className="text-[9px] text-zinc-500 ml-1">
                              {postVideoFile
                                ? "1/1 Video"
                                : `${postImageFiles.length}/5 Images`}
                            </span>
                          )}
                      </div>

                      {/* Visibility toggle: public / close friends */}
                      <button
                        type="button"
                        onClick={() =>
                          setPostVisibility(
                            postVisibility === "public"
                              ? "closeFriends"
                              : "public",
                          )
                        }
                        title={
                          postVisibility === "public"
                            ? "Public post"
                            : "Close friends only"
                        }
                        className={`flex items-center gap-1.5 rounded-full text-[12px] md:text-sm font-bold transition-all cursor-pointer border px-3 py-1.5 ${
                          postVisibility === "closeFriends"
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400/80"
                            : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-300"
                        }`}
                      >
                        {postVisibility === "closeFriends" ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Globe className="h-3.5 w-3.5" />
                        )}
                        {postVisibility === "closeFriends"
                          ? "Close Friends"
                          : "Public"}
                      </button>
                      <button
                        type="submit"
                        disabled={submittingPost}
                        className={`flex items-center gap-1.5 rounded-full bg-white text-[12px] md:text-sm font-bold text-black hover:bg-zinc-100 transition-all disabled:opacity-40 cursor-pointer shadow-sm animate-none ${
                          isKeyboardOpen ? "px-4 py-2" : "px-5 py-2.5"
                        }`}
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
                  <h3 className="mt-4 text-lg font-bold text-zinc-200">
                    {showSavesOnly
                      ? "No Saved Posts"
                      : showRepostsOnly
                        ? "No Reposts Yet"
                        : "No Posts Available"}
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400 leading-relaxed">
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
                        whileHover={
                          isMobile
                            ? undefined
                            : {
                                y: -3,
                                transition: {
                                  duration: 0.2,
                                  ease: "easeOut",
                                },
                              }
                        }
                        transition={
                          isMobile ? { duration: 0 } : { duration: 0.3 }
                        }
                        onTouchStart={(e) => handleCardTouchStart(e, post._id)}
                        onTouchMove={(e) => handleCardTouchMove(e, post._id)}
                        onTouchEnd={(e) => handleCardTouchEnd(e, post)}
                        className="relative overflow-hidden"
                      >
                        {/* Swipe indicator bar */}
                        {swipingPostId === post._id && swipeOffset !== 0 && (
                          <motion.div
                            initial={{
                              opacity: 0,
                            }}
                            animate={{
                              opacity: 1,
                            }}
                            className={`absolute inset-y-0 w-1 z-10 pointer-events-none ${swipeOffset > 0 ? "left-0 bg-gradient-to-r from-red-500/60 to-transparent" : "right-0 bg-gradient-to-l from-green-500/60 to-transparent"}`}
                          >
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${swipeOffset > 0 ? "left-2" : "right-2"}`}
                            >
                              {swipeOffset > 0 ? (
                                <Heart className="h-5 w-5 text-red-400 fill-red-400/80" />
                              ) : (
                                <Repeat2 className="h-5 w-5 text-green-400" />
                              )}
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${swipeOffset > 0 ? "text-red-400" : "text-green-400"}`}
                              >
                                {swipeOffset > 0 ? "Like" : "Repost"}
                              </span>
                            </div>
                          </motion.div>
                        )}
                        {/* Translate the card content on swipe */}
                        <div
                          style={
                            swipingPostId === post._id
                              ? {
                                  transform: `translateX(${swipeOffset * 0.3}px)`,
                                  transition: "none",
                                }
                              : {}
                          }
                        >
                          <GlassCard
                            className="shadow-sm border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all rounded-4xl"
                            animate={false}
                            showMacControls={false}
                          >
                            {/* Author context line */}
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  src={post.author.profilePic?.url}
                                  alt={post.author.fullName}
                                  onClick={() =>
                                    onUserSelected(post.author.username)
                                  }
                                  className="h-9 w-9 cursor-pointer rounded-full object-cover border border-zinc-800 shadow-sm"
                                  role="button"
                                  tabIndex={0}
                                  onKeyPress={(e) =>
                                    e.key === "Enter" &&
                                    onUserSelected(post.author.username)
                                  }
                                />
                                <div>
                                  <h4
                                    onClick={() =>
                                      onUserSelected(post.author.username)
                                    }
                                    className="font-sans text-sm font-bold text-white cursor-pointer hover:underline"
                                    role="button"
                                    tabIndex={0}
                                    onKeyPress={(e) =>
                                      e.key === "Enter" &&
                                      onUserSelected(post.author.username)
                                    }
                                  >
                                    {post.author.fullName}
                                  </h4>
                                  <p className="text-[11px] text-zinc-400 font-bold">
                                    @{post.author.username}
                                  </p>
                                  {post.visibility === "closeFriends" && (
                                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[9px] font-bold text-emerald-400/80">
                                      <Lock className="h-2.5 w-2.5" /> Close Friends
                                    </span>
                                  )}
                                  {post.collaborator && (
                                    <p className="text-[10px] text-green-400/80 font-semibold">
                                      {post.collabAccepted
                                        ? `✦ with @${post.collaborator.username}`
                                        : `✦ inviting @${post.collaborator.username}`}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {post.collaborator &&
                                  user &&
                                  !post.collabAccepted &&
                                  post.collaborator._id === user._id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcceptCollab(post._id);
                                      }}
                                      className="rounded-full border border-green-500/30 bg-green-500/5 px-3 py-1 text-[10px] font-bold text-green-400/90 hover:bg-green-500/15 transition-all cursor-pointer"
                                    >
                                      Accept collaboration
                                    </button>
                                  )}
                                <span
                                  className="text-[9px] font-medium text-zinc-500"
                                  aria-label={`Posted ${getRelativeDate(post.createdAt)}`}
                                >
                                  {getRelativeDate(post.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Content block */}
                            <div className="space-y-2.5">
                              <h3 className="font-sans text-lg md:text-xl font-bold text-zinc-100 tracking-tight leading-snug">
                                {post.title}
                              </h3>
                              <div className="space-y-1">
                                <TranslateInline
                                  text={
                                    post.content &&
                                    post.content.length > 300 &&
                                    !expandedPosts[post._id]
                                      ? post.content.slice(0, 300) + "..."
                                      : post.content
                                  }
                                  render={(t) => (
                                    <p className="text-base md:text-lg text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                                      {renderFormattedContent(t)}
                                    </p>
                                  )}
                                />
                                {post.content && post.content.length > 300 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedPosts((prev) => ({
                                        ...prev,
                                        [post._id]: !prev[post._id],
                                      }));
                                    }}
                                    className="text-sm font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer block mt-1"
                                  >
                                    {expandedPosts[post._id]
                                      ? "See less"
                                      : "See more"}
                                  </button>
                                )}
                                {post.content && extractFirstUrl(post.content) && (
                                  <LinkPreviewCard
                                    url={extractFirstUrl(post.content)!}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Poll attachment */}
                            {post.poll && (
                              <PollCard
                                postId={post._id}
                                poll={post.poll}
                                readOnly={readOnly}
                                onPollUpdated={handlePollUpdated}
                              />
                            )}

                            {/* Video attachment */}
                            {post.video?.url ? (
                              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-black/60">
                                <div className="relative">
                                  <video
                                    ref={(el) => {
                                      videoRefs.current[post._id] = el;
                                    }}
                                    src={post.video.url}
                                    className="w-full max-h-96"
                                    preload="metadata"
                                    autoPlay
                                    muted={videoMuted[post._id] ?? true}
                                    playsInline
                                    loop={false}
                                    onEnded={() => handleVideoEnded(post._id)}
                                  />
                                  {/* Mute toggle button */}
                                  <button
                                    onClick={(e) =>
                                      handleToggleMute(post._id, e)
                                    }
                                    className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all cursor-pointer"
                                    title={
                                      videoMuted[post._id] ? "Unmute" : "Mute"
                                    }
                                  >
                                    {videoMuted[post._id] ? (
                                      <VolumeX className="h-4 w-4" />
                                    ) : (
                                      <Volume2 className="h-4 w-4" />
                                    )}
                                  </button>
                                  {/* Replay overlay */}
                                  {videoEnded[post._id] && (
                                    <div
                                      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-10"
                                      onClick={(e) =>
                                        handleReplayVideo(post._id, e)
                                      }
                                    >
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm hover:bg-white/30 transition-all">
                                          <Play className="h-7 w-7 text-white fill-white" />
                                        </div>
                                        <span className="text-xs font-bold text-white/80">
                                          Replay
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {/* Context Image media attachment — single or multi-image carousel */}
                            {post.images && post.images.length > 0 ? (
                              <div className="mt-4 group/image">
                                <PinchZoom>
                                  <ImageCarousel
                                    images={post.images}
                                    onImageClick={(url) => {
                                      window.dispatchEvent(
                                        new CustomEvent("openImagePreview", {
                                          detail: url,
                                        }),
                                      );
                                    }}
                                  />
                                </PinchZoom>
                              </div>
                            ) : post.image?.url ? (
                              <div
                                className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/20 cursor-pointer group/image"
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent("openImagePreview", {
                                      detail: post.image!.url,
                                    }),
                                  );
                                }}
                              >
                                <img
                                  loading="lazy"
                                  decoding="async"
                                  src={post.image.url}
                                  alt="attachment media"
                                  className="w-full h-auto max-h-200 transition-transform duration-500 group-hover/image:scale-[1.02]"
                                />
                              </div>
                            ) : null}

                            {/* Bottom stats rail / Interactivity buttons with spring pops */}
                            <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3.5 text-zinc-400">
                              {/* Likes button */}
                              <button
                                onClick={() =>
                                  !readOnly &&
                                  handleLikeToggle(post._id, !!post.likedByMe)
                                }
                                className={`flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                                aria-label={`${post.likedByMe ? "Unlike" : "Like"} post (${post.likesCount} likes)`}
                              >
                                <motion.span
                                  whileTap={
                                    !readOnly
                                      ? {
                                          scale: 1.4,
                                        }
                                      : undefined
                                  }
                                  whileHover={
                                    !readOnly
                                      ? {
                                          scale: 1.1,
                                        }
                                      : undefined
                                  }
                                  className="flex"
                                >
                                  <Heart
                                    className={`h-4 w-4 transition-colors ${readOnly ? "text-zinc-500" : "group-hover:text-red-500"} ${
                                      post.likedByMe
                                        ? "fill-red-500 text-red-500"
                                        : "text-zinc-500"
                                    }`}
                                  />
                                </motion.span>
                                <span
                                  className={
                                    post.likedByMe
                                      ? "text-red-400 font-bold"
                                      : "text-zinc-400"
                                  }
                                >
                                  {post.likesCount}
                                </span>
                              </button>

                              {/* Comment trigger */}
                              <button
                                onClick={() => {
                                  if (readOnly) return;
                                  setSelectedPost(post);
                                  loadComments(post._id);
                                }}
                                onMouseEnter={() => prefetchComments(post._id)}
                                onFocus={() => prefetchComments(post._id)}
                                className={`flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                                aria-label={`View comments (${post.commentsCount} comments)`}
                              >
                                <motion.span
                                  whileHover={
                                    !readOnly
                                      ? {
                                          scale: 1.1,
                                        }
                                      : undefined
                                  }
                                >
                                  <MessageSquare
                                    className={`h-4 w-4 ${readOnly ? "text-zinc-500" : "text-zinc-500 group-hover:text-white"}`}
                                  />
                                </motion.span>
                                <span className="text-zinc-400">
                                  {post.commentsCount}
                                </span>
                              </button>

                              {/* Repost trigger */}
                              <button
                                onClick={() =>
                                  !readOnly &&
                                  handleRepostToggle(
                                    post._id,
                                    !!post.repostedByMe,
                                  )
                                }
                                className={`flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                                aria-label={`${post.repostedByMe ? "Undo repost" : "Repost"} post (${post.repostsCount} reposts)`}
                              >
                                <motion.span
                                  whileTap={
                                    !readOnly
                                      ? {
                                          rotate: 180,
                                        }
                                      : undefined
                                  }
                                  whileHover={
                                    !readOnly
                                      ? {
                                          scale: 1.1,
                                        }
                                      : undefined
                                  }
                                  className="flex"
                                >
                                  <Repeat2
                                    className={`h-4 w-4 ${readOnly ? "text-zinc-500" : ""} ${
                                      post.repostedByMe
                                        ? "text-green-500 font-bold"
                                        : readOnly
                                          ? "text-zinc-500"
                                          : "text-zinc-500 group-hover:text-white"
                                    }`}
                                  />
                                </motion.span>
                                <span
                                  className={
                                    post.repostedByMe
                                      ? "text-green-500 font-bold"
                                      : "text-zinc-400"
                                  }
                                >
                                  {post.repostsCount}
                                </span>
                              </button>

                              {/* Quote repost trigger */}
                              <button
                                onClick={() =>
                                  !readOnly && handleQuoteRepost(post._id)
                                }
                                title="Quote Repost (repost with comment)"
                                aria-label={`Quote repost post (${post.repostsCount} reposts)`}
                                className={`flex items-center gap-1.5 text-xs font-semibold select-none group focus:outline-none transition-colors ${readOnly ? "cursor-default text-zinc-500" : "cursor-pointer text-zinc-500 hover:text-zinc-300"}`}
                              >
                                Quote
                              </button>

                              {/* Save trigger */}
                              <button
                                onClick={() =>
                                  !readOnly &&
                                  handleSaveToggle(post._id, !!post.savedByMe)
                                }
                                className={`flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                                aria-label={`${post.savedByMe ? "Remove from saved" : "Save post"} (${post.savesCount} saves)`}
                              >
                                <motion.span
                                  whileTap={
                                    !readOnly
                                      ? {
                                          scale: 1.3,
                                        }
                                      : undefined
                                  }
                                  whileHover={
                                    !readOnly
                                      ? {
                                          scale: 1.1,
                                        }
                                      : undefined
                                  }
                                  className="flex"
                                >
                                  <Bookmark
                                    className={`h-4 w-4 transition-colors ${readOnly ? "text-zinc-500" : ""} ${
                                      post.savedByMe
                                        ? "fill-yellow-500 text-yellow-500"
                                        : "text-zinc-500"
                                    }`}
                                  />
                                </motion.span>
                                <span
                                  className={
                                    post.savedByMe
                                      ? "text-yellow-500 font-medium"
                                      : "text-zinc-400"
                                  }
                                >
                                  {post.savesCount}
                                </span>
                              </button>

                              {/* Viewer / Reach stats */}
                              <span
                                className="flex items-center gap-1 text-[11px] text-zinc-500 select-none"
                                aria-label={`${post.viewsCount || 0} views`}
                              >
                                <Eye className="h-3 w-3" aria-hidden="true" />
                                {post.viewsCount || 0}
                              </span>

                              {/* Share trigger icon */}												<ShareMenu
														onForward={() => setForwardPost(post)}
														onCopyLink={() => copyPostLink(post)}
														onSaveToCollection={() =>
															void openSaveToCollection(post)
														}
                                triggerContent={
                                  <Share2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                }
                                triggerClassName={`flex h-7.5 w-7.5 items-center justify-center rounded-full transition-colors ${
                                  readOnly
                                    ? "cursor-default text-zinc-500"
                                    : "cursor-pointer hover:bg-zinc-800 text-zinc-500 hover:text-white"
                                }`}
                                ariaLabel="Share post"
                              />
                            </div>
                          </GlassCard>
                        </div>
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
          <div className="space-y-6 max-w-2xl mx-auto w-full px-0">
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
                <h3 className="mt-4 text-lg font-bold text-zinc-200">
                  No posts found
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400 leading-relaxed">
                  No posts are available in this feed.
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-5">
                <AnimatePresence>
                  {posts.map((post) => (
                    <motion.div
                      key={post._id}
                      data-post-id={post._id}
                      initial={isMobile ? undefined : { opacity: 0, y: 15 }}
                      animate={isMobile ? undefined : { opacity: 1, y: 0 }}
                      exit={isMobile ? undefined : { opacity: 0, y: -15 }}
                      whileHover={
                        isMobile
                          ? undefined
                          : {
                              y: -3,
                              transition: {
                                duration: 0.2,
                                ease: "easeOut",
                              },
                            }
                      }
                      transition={
                        isMobile ? { duration: 0 } : { duration: 0.3 }
                      }
                      onTouchStart={(e) => handleCardTouchStart(e, post._id)}
                      onTouchMove={(e) => handleCardTouchMove(e, post._id)}
                      onTouchEnd={(e) => handleCardTouchEnd(e, post)}
                      className="relative overflow-hidden"
                    >
                      {/* Swipe indicator bar */}
                      {swipingPostId === post._id && swipeOffset !== 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`absolute inset-y-0 w-1 z-10 pointer-events-none ${swipeOffset > 0 ? "left-0 bg-gradient-to-r from-red-500/60 to-transparent" : "right-0 bg-gradient-to-l from-green-500/60 to-transparent"}`}
                        >
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${swipeOffset > 0 ? "left-2" : "right-2"}`}
                          >
                            {swipeOffset > 0 ? (
                              <Heart className="h-5 w-5 text-red-400 fill-red-400/80" />
                            ) : (
                              <Repeat2 className="h-5 w-5 text-green-400" />
                            )}
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${swipeOffset > 0 ? "text-red-400" : "text-green-400"}`}
                            >
                              {swipeOffset > 0 ? "Like" : "Repost"}
                            </span>
                          </div>
                        </motion.div>
                      )}
                      {/* Translate the card content on swipe */}
                      <div
                        style={
                          swipingPostId === post._id
                            ? {
                                transform: `translateX(${swipeOffset * 0.3}px)`,
                                transition: "none",
                              }
                            : {}
                        }
                      >
                        <GlassCard
                          className="shadow-sm border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all rounded-4xl"
                          animate={false}
                          showMacControls={false}
                        >
                          {/* Author context line */}
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                src={post.author.profilePic?.url}
                                alt={post.author.fullName}
                                onClick={() =>
                                  onUserSelected(post.author.username)
                                }
                                className="h-9 w-9 cursor-pointer rounded-full object-cover border border-zinc-800 shadow-sm"
                              />
                              <div>
                                <h4
                                  onClick={() =>
                                    onUserSelected(post.author.username)
                                  }
                                  className="font-sans text-sm font-bold text-white cursor-pointer hover:underline"
                                >
                                  {post.author.fullName}
                                </h4>
                                <p className="text-[11px] text-zinc-400 font-bold">
                                  @{post.author.username}
                                </p>
                                {post.collaborator && (
                                  <p className="text-[10px] text-green-400/80 font-semibold">
                                    {post.collabAccepted
                                      ? `✦ with @${post.collaborator.username}`
                                      : `✦ inviting @${post.collaborator.username}`}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {post.collaborator &&
                                user &&
                                !post.collabAccepted &&
                                post.collaborator._id === user._id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptCollab(post._id);
                                    }}
                                    className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-[10px] font-bold text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"
                                  >
                                    Accept collaboration
                                  </button>
                                )}
                              <span className="text-[11px] font-medium text-zinc-500">
                                {getRelativeDate(post.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Content block */}
                          <div className="space-y-2.5">
                            <h3 className="font-sans text-lg md:text-xl font-bold text-zinc-100 tracking-tight leading-snug">
                              {post.title}
                            </h3>
                            <TranslateInline
                              text={post.content}
                              render={(t) => (
                                <p className="text-base md:text-lg text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                                  {renderFormattedContent(t)}
                                </p>
                              )}
                            />
                            {post.content && extractFirstUrl(post.content) && (
                              <LinkPreviewCard url={extractFirstUrl(post.content)!} />
                            )}
                          </div>

                          {/* Poll attachment */}
                          {post.poll && (
                            <PollCard
                              postId={post._id}
                              poll={post.poll}
                              readOnly={readOnly}
                              onPollUpdated={handlePollUpdated}
                            />
                          )}

                          {/* Video attachment */}
                          {post.video?.url ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-black/60">
                              <div className="relative">
                                <video
                                  ref={(el) => {
                                    videoRefs.current[post._id] = el;
                                  }}
                                  src={post.video.url}
                                  className="w-full max-h-96"
                                  preload="metadata"
                                  autoPlay
                                  muted={videoMuted[post._id] ?? true}
                                  playsInline
                                  loop={false}
                                  onPlay={() => registerPostView(post._id)}
                                  onEnded={() => handleVideoEnded(post._id)}
                                />
                                {/* Mute toggle button */}
                                <button
                                  onClick={(e) => handleToggleMute(post._id, e)}
                                  className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all cursor-pointer"
                                  title={
                                    videoMuted[post._id] ? "Unmute" : "Mute"
                                  }
                                >
                                  {videoMuted[post._id] ? (
                                    <VolumeX className="h-4 w-4" />
                                  ) : (
                                    <Volume2 className="h-4 w-4" />
                                  )}
                                </button>
                                {/* Replay overlay */}
                                {videoEnded[post._id] && (
                                  <div
                                    className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-10"
                                    onClick={(e) =>
                                      handleReplayVideo(post._id, e)
                                    }
                                  >
                                    <div className="flex flex-col items-center gap-2">
                                      <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm hover:bg-white/30 transition-all">
                                        <Play className="h-7 w-7 text-white fill-white" />
                                      </div>
                                      <span className="text-xs font-bold text-white/80">
                                        Replay
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {/* Context Image media attachment — single or multi-image carousel */}
                          {post.images && post.images.length > 0 ? (
                            <div className="mt-4 group/image">
                              <PinchZoom>
                                <ImageCarousel
                                  images={post.images}
                                  onImageLoad={() =>
                                    registerPostView(post._id)
                                  }
                                  onImageClick={(url) => {
                                    window.dispatchEvent(
                                      new CustomEvent("openImagePreview", {
                                        detail: url,
                                      }),
                                    );
                                  }}
                                />
                              </PinchZoom>
                            </div>
                          ) : post.image?.url ? (
                            <div
                              className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/20 cursor-pointer group/image"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("openImagePreview", {
                                    detail: post.image!.url,
                                  }),
                                );
                              }}
                            >
                              <PinchZoom>
                                <img
                                  loading="lazy"
                                  decoding="async"
                                  src={post.image.url}
                                  alt="attachment media"									  onLoad={() => registerPostView(post._id)}
									  className="w-full h-auto max-h-200 transition-transform duration-500 group-hover/image:scale-[1.02]"
									/>
                              </PinchZoom>
                            </div>
                          ) : null}

                          {/* Bottom stats rail / Interactivity buttons with spring pops */}
                          <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3.5 text-zinc-400">
                            {/* Likes button */}
                            <button
                              onClick={() =>
                                handleLikeToggle(post._id, !!post.likedByMe)
                              }
                              className="flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none cursor-pointer"
                            >
                              <motion.span
                                whileTap={{
                                  scale: 1.4,
                                }}
                                whileHover={{
                                  scale: 1.1,
                                }}
                                className="flex"
                              >
                                <Heart
                                  className={`h-4 w-4 transition-colors group-hover:text-red-500 ${
                                    post.likedByMe
                                      ? "fill-red-500 text-red-500"
                                      : "text-zinc-500"
                                  }`}
                                />
                              </motion.span>
                              <span
                                className={
                                  post.likedByMe
                                    ? "text-red-400 font-bold"
                                    : "group-hover:text-red-400 text-zinc-400"
                                }
                              >
                                {post.likesCount}
                              </span>
                            </button>

                            {/* Comment trigger */}
                            <button
                              onClick={() => {
                                setSelectedPost(post);
                                loadComments(post._id);
                              }}
                              className="flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none cursor-pointer"
                            >
                              <motion.span
                                whileHover={{
                                  scale: 1.1,
                                }}
                              >
                                <MessageSquare className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                              </motion.span>
                              <span className="group-hover:text-white text-zinc-400">
                                {post.commentsCount}
                              </span>
                            </button>

                            {/* Repost trigger */}
                            <button
                              onClick={() =>
                                handleRepostToggle(
                                  post._id,
                                  !!post.repostedByMe,
                                )
                              }
                              className="flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none cursor-pointer"
                            >
                              <motion.span
                                whileTap={{
                                  rotate: 180,
                                }}
                                whileHover={{
                                  scale: 1.1,
                                }}
                                className="flex"
                              >
                                <Repeat2
                                  className={`h-4 w-4 ${
                                    post.repostedByMe
                                      ? "text-green-500 font-bold"
                                      : "text-zinc-500 group-hover:text-white"
                                  }`}
                                />
                              </motion.span>
                              <span
                                className={
                                  post.repostedByMe
                                    ? "text-green-500 font-bold"
                                    : "group-hover:text-white text-zinc-400"
                                }
                              >
                                {post.repostsCount}
                              </span>
                            </button>

                            {/* Quote repost trigger */}
                            <button
                              onClick={() => handleQuoteRepost(post._id)}
                              title="Quote Repost (repost with comment)"
                              aria-label={`Quote repost post (${post.repostsCount} reposts)`}
                              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 select-none group focus:outline-none cursor-pointer transition-colors"
                            >
                              Quote
                            </button>

                            {/* Save trigger */}
                            <button
                              onClick={() =>
                                handleSaveToggle(post._id, !!post.savedByMe)
                              }
                              className="flex items-center gap-1.5 text-sm font-semibold select-none group focus:outline-none cursor-pointer"
                            >
                              <motion.span
                                whileTap={{
                                  scale: 1.3,
                                }}
                                whileHover={{
                                  scale: 1.1,
                                }}
                                className="flex"
                              >
                                <Bookmark
                                  className={`h-4 w-4 transition-colors ${
                                    post.savedByMe
                                      ? "fill-yellow-500 text-yellow-500"
                                      : "text-zinc-500 group-hover:text-white"
                                  }`}
                                />
                              </motion.span>
                              <span
                                className={
                                  post.savedByMe
                                    ? "text-yellow-500 font-medium"
                                    : "text-zinc-400 group-hover:text-white"
                                }
                              >
                                {post.savesCount}
                              </span>
                            </button>

                            {/* Viewer / Reach stats */}
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500 select-none">
                              <Eye className="h-3 w-3" />
                              {post.viewsCount || 0}
                            </span>

                            {/* Share trigger icon */}
                            <ShareMenu
                              onForward={() => setForwardPost(post)}
                              onCopyLink={() => copyPostLink(post)}
                              triggerContent={
                                <Share2 className="h-3.5 w-3.5" />
                              }
                              triggerClassName="flex h-7.5 w-7.5 items-center justify-center rounded-full hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-500 hover:text-white"
                              ariaLabel="Share post"
                            />
                            <ReportButton
                              contentType="post"
                              contentId={post._id}
                              iconOnly
                            />
                          </div>
                        </GlassCard>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating sliding drawer for Comments Thread details - rendered at document.body via portal to avoid stacking context issues with motion transforms */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedPost && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
              >
                <div
                  className="absolute inset-0"
                  onClick={() => setSelectedPost(null)}
                />

                <motion.div
                  initial={
                    isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95 }
                  }
                  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
                  exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95 }}
                  transition={
                    isMobile
                      ? {
                          type: "spring" as const,
                          damping: 28,
                          stiffness: 220,
                        }
                      : {
                          ease: "easeOut" as const,
                        }
                  }
                  className="relative z-10 w-full max-w-4xl h-[85vh] md:h-[70vh] rounded-4xl border border-white/5 bg-zinc-950/95 backdrop-blur-3xl p-5 md:p-7 shadow-[0_-30px_70px_-10px_rgba(0,0,0,0.95)] flex flex-col justify-between"
                >
                  <div className="mb-4 flex items-center justify-between shrink-0 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-label text-base font-semibold text-white">
                        Comments
                      </h3>
                      <p className="text-[12px] text-zinc-500 mt-0.5">
                        Share your thoughts on this status
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPost(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/5 bg-white/3 hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>				  {/* Comment Thread Content Container */}
				  <div className="grow overflow-y-auto space-y-1.5 pb-4 scrollbar-none">
                    {commentsLoading ? (
                      <div className="space-y-3 py-1" aria-busy="true">
                        {[0, 1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="flex items-start gap-2.5 rounded-2xl border border-white/5 bg-zinc-900/15 px-3 py-2.5"
                            style={
                              {
                                "--shimmer-delay": `${n * 0.08}s`,
                              } as React.CSSProperties
                            }
                          >
                            <div className="h-5.5 w-5.5 shrink-0 rounded-full shimmer-bg" />
                            <div className="flex-1 space-y-2 pt-0.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-24 rounded shimmer-bg" />
                                <div className="h-2 w-10 rounded shimmer-bg" />
                              </div>
                              <div className="h-3 w-full rounded shimmer-bg" />
                              <div className="h-3 w-2/3 rounded shimmer-bg" />
                              <div className="h-2.5 w-32 rounded shimmer-bg" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="py-16 text-center text-xs text-zinc-500">
                        <MessageCircle className="mx-auto h-8 w-8 text-zinc-650 mb-3 animate-pulse" />
                        No comments yet. Start the conversation!
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
                          }}
                          getRelativeDate={getRelativeDate}
                          renderFormattedContent={renderFormattedContent}
                          postSlug={selectedPost?.slug}
                        />
                      ))
                    )}
                    {/* Load-more pagination: server returns nextCursor/hasMore,
                        so busy threads can be scrolled through completely. */}
                    {!commentsLoading &&
                      !commentsLoadingMore &&
                      commentHasMore && (
                        <div className="flex justify-center pt-2">
                          <button
                            onClick={loadMoreComments}
                            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                            Load more comments
                          </button>
                        </div>
                      )}
                    {commentsLoadingMore && (
                      <div className="flex justify-center pt-2 pb-1">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      </div>
                    )}
                  </div>

                  {/* Composer input inside thread */}
                  {user && (
                    <form
                      onSubmit={handleAddCommentSubmit}
                      noValidate
                      className="mt-2 border-t border-white/3 pt-4 shrink-0"
                    >
                      {replyToCommentId && (
                        <div className="flex items-center justify-between mb-3 px-4 text-[12px] text-zinc-400 bg-white/3 py-2 rounded-full border border-white/5">
                          <span>Replying to thread</span>
                          <button
                            type="button"
                            onClick={() => setReplyToCommentId(null)}
                            className="hover:text-white cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}					      {/* "Comment cannot be empty" etc. — shown just above the input */}
					      {fieldErrors.comment && (
					        <div className="mb-1.5">
					          <ValidationMessage message={fieldErrors.comment} />
					        </div>
					      )}
					      <div className="flex items-end gap-3">
					        <div className="relative flex-1">
					          <textarea
					            ref={commentRef}
					            rows={1}
					            wrap="soft"
					            required
					            maxLength={1000}
					            spellCheck={false}
					            placeholder="Write a comment..."
					            value={newCommentText}
					            onChange={(e) => {
					              setNewCommentText(e.target.value);
					              clearFieldError("comment");
					            }}
					            onKeyDown={(e) => {
					              // WhatsApp-style: Enter sends, Shift+Enter inserts a
					              // real line break that is preserved in the comment.
					              if (e.key === "Enter" && !e.shiftKey) {
					                if (!newCommentText.trim()) return;
					                e.preventDefault();
					                e.currentTarget.form?.requestSubmit();
					              }
					            }}
					            className="w-full !rounded-2xl border border-zinc-800 bg-zinc-950/40 text-[12px] md:text-sm placeholder:text-[12px] md:placeholder:text-sm text-slate-100 placeholder-zinc-500 outline-none focus:border-white focus:bg-zinc-900/80 transition-all focus:ring-1 focus:ring-zinc-700 px-4 py-2.5 pr-16 resize-none max-h-[120px] overflow-y-auto leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					          />
					          <div className="absolute right-3.5 top-2.5">
					            <CharCounter
					              current={newCommentText.length}
					              max={1000}
					            />
					          </div>
					        </div>
					        <button
                          type="submit"
                          disabled={submittingComment || !newCommentText.trim()}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-150 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Hidden file input for replacing an existing image */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;
          const file = files[0];
          setCropQueueNames([file.name]);
          const url = URL.createObjectURL(file);
          setCurrentCropSrc(url);
          setCropModalOpen(true);
          e.target.value = "";
        }}
        className="hidden"
      />

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setReCropIndex(-1);
          // Clear remaining queue on cancel
          setCropQueue([]);
          setCropQueueNames([]);
          cropQueue.forEach((url) => URL.revokeObjectURL(url));
          if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
          setCurrentCropSrc("");
        }}		imageSrc={currentCropSrc}
		aspectRatio={1}
		title="Crop Photo"
		onCropComplete={handleCropComplete}
      />

      {/* Quote Repost Modal */}
      {quoteRepostPost && (
        <QuoteRepostModal
          post={quoteRepostPost}
          isOpen={true}
          onClose={() => setQuoteRepostPost(null)}
          onSubmit={handleSubmitQuoteRepost}
        />
      )}		{/* Forward post modal */}
		<ForwardModal
			open={!!forwardPost}
			onClose={() => setForwardPost(null)}
			title="Forward post"
			subtitle={forwardPost?.title || forwardPost?.content?.slice(0, 60)}
			myUserId={user?._id}
			onForward={handleForwardPost}
		/>

		{/* Save to collection modal */}
		{collectionPost &&
			createPortal(
				<div
					className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4"
					onClick={() => setCollectionPost(null)}>
					<div
						className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
						onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
							<div>
								<h3 className="text-sm font-bold text-white">
									Save to collection
								</h3>
								<p className="mt-0.5 text-[11px] text-zinc-500">
									{collectionPost.title ||
										collectionPost.content?.slice(0, 60)}
								</p>
							</div>
							<button
								onClick={() => setCollectionPost(null)}
								className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer">
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="max-h-64 overflow-y-auto p-3">
							{loadingCollections ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
								</div>
							) : myCollections.length === 0 ? (
								<div className="px-2 py-6 text-center">
									<FolderOpen className="mx-auto h-7 w-7 text-zinc-600 mb-2" />
									<p className="text-xs text-zinc-500">
										No collections yet — create one below.
									</p>
								</div>
							) : (
								<div className="space-y-1">
									{myCollections.map((c) => (
										<button
											key={c._id}
											onClick={() =>
												void handleAddToCollection(c._id)
											}
											className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all cursor-pointer">
											<FolderOpen className="h-4 w-4 shrink-0 text-zinc-500" />
											<span className="min-w-0 flex-1 truncate">
												{c.name}
											</span>
											<span className="text-[10px] text-zinc-500">
												{(c.posts || []).length}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
						<div className="border-t border-white/5 p-3">
							<div className="flex items-center gap-2">
								<input
									value={newCollName}
									onChange={(e) => setNewCollName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter")
											void handleCreateAndAddCollection();
									}}
									placeholder="New collection name..."
									maxLength={100}
									className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-white/40 transition-colors"
								/>
								<button
									onClick={() =>
										void handleCreateAndAddCollection()
									}
									disabled={
										!newCollName.trim() || creatingColl
									}
									className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[10px] font-bold text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer">
									{creatingColl ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<Plus className="h-3.5 w-3.5" />
									)}
									Create
								</button>
							</div>
						</div>
					</div>
				</div>,
				document.body,
			)}
	</>
  );
}
