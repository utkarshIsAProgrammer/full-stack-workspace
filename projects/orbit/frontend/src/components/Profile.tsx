import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	Calendar,
	Share2,
	Edit3,
	Camera,
	AlertCircle,
	X,
	Heart,
	MessageSquare,
	Bookmark,
	Repeat2,
	FileText,
	ArrowLeft,
} from "lucide-react";
import { User as UserType, Post } from "../types";
import GlassCard from "./GlassCard";
import ImageCropModal from "./ImageCropModal";
import Skeleton from "./Skeleton";
import ConfirmDialog from "./ConfirmDialog";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface ProfileProps {
	user: UserType | null; // Auth User
	targetUsername: string; // The username of the profile to view
	onUserUpdate: (newUser: UserType) => void;
	onPostClick: (slug: string, openComments?: boolean) => void;
	onUserClick: (username: string) => void;
	followingStates: Record<string, boolean>;
	onToggleFollow: (userId: string) => Promise<void>;
	onProfileLoaded?: (profileId: string, followingByMe: boolean) => void;
	onBack?: () => void;
}

export default function Profile({
	user,
	targetUsername,
	onUserUpdate,
	onPostClick,
	onUserClick,
	followingStates,
	onToggleFollow,
	onProfileLoaded,
	onBack,
}: ProfileProps) {
	const [profile, setProfile] = useState<UserType | null>(null);
	const [posts, setPosts] = useState<Post[]>([]);
	const [loading, setLoading] = useState(true);
	const [editOpen, setEditOpen] = useState(false);
	const [, setEditType] = useState<"profile" | "banner">("profile");

	// Crop Modal States
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [cropImageSrc, setCropImageSrc] = useState("");
	const [cropType, setCropType] = useState<"profile" | "banner">("profile");

	// Interaction List Modal State
	const [activeList, setActiveList] = useState<
		"followers" | "following" | "reposts" | null
	>(null);
	const [listItems, setListItems] = useState<any[]>([]);
	const [listLoading, setListLoading] = useState(false);

	// Profile content tab
	const [profileTab, setProfileTab] = useState<"posts" | "saved" | "reposts">(
		"posts",
	);
	const [savedPosts, setSavedPosts] = useState<Post[]>([]);
	const [repostedPosts, setRepostedPosts] = useState<Post[]>([]);
	const [loadingSaved, setLoadingSaved] = useState(false);
	const [loadingReposts, setLoadingReposts] = useState(false);

	// Pagination states for posts
	const [postsCursor, setPostsCursor] = useState<string | null>(null);
	const [postsHasMore, setPostsHasMore] = useState(false);
	const [loadingMorePosts, setLoadingMorePosts] = useState(false);
	const postsSentinelRef = useRef<HTMLDivElement>(null);

	// Pagination states for saved
	const [savedCursor, setSavedCursor] = useState<string | null>(null);
	const [savedHasMore, setSavedHasMore] = useState(false);
	const [loadingMoreSaved, setLoadingMoreSaved] = useState(false);
	const savedSentinelRef = useRef<HTMLDivElement>(null);

	// Pagination states for reposts
	const [repostsCursor, setRepostsCursor] = useState<string | null>(null);
	const [repostsHasMore, setRepostsHasMore] = useState(false);
	const [loadingMoreReposts, setLoadingMoreReposts] = useState(false);
	const repostsSentinelRef = useRef<HTMLDivElement>(null);

	// Edit Forms State
	const [fullName, setFullName] = useState("");
	const [bio, setBio] = useState("");
	const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
	const [bannerPicFile, setBannerPicFile] = useState<File | null>(null);

	const [profilePicPreview, setProfilePicPreview] = useState("");
	const [bannerPicPreview, setBannerPicPreview] = useState("");

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [, setSuccess] = useState<string | null>(null);

	const [editPostId, setEditPostId] = useState<string | null>(null);

	const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
	const [editPostTitle, setEditPostTitle] = useState("");
	const [editPostContent, setEditPostContent] = useState("");

	// Pull-to-refresh state
	const [pullDistance, setPullDistance] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const touchStartRef = useRef(0);
	const isPullingRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const getRelativeDate = (iso: string) => {
		const minDiff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
		const hrDiff = Math.floor(minDiff / 60);
		if (minDiff < 1) return "Now";
		if (minDiff < 60) return `${minDiff}m`;
		if (hrDiff < 24) return `${hrDiff}h`;
		return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
	};

	// Handle touch pull-to-refresh
	const handleTouchStart = (e: React.TouchEvent) => {
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
			loadProfile().finally(() => {
				setIsRefreshing(false);
			});
		} else {
			setPullDistance(0);
		}
	};

	const loadProfile = async () => {
		setLoading(true);
		try {
			// 1. Fetch profile user
			const res = await apiFetch(`/api/users/username/${targetUsername}`);
			const data = await res.json();
			if (!res.ok || !data.success) {
				setLoading(false);
				return;
			}

			setProfile(data.user);
			setFullName(data.user.fullName || "");
			setBio(data.user.bio || "");
			setProfilePicPreview(data.user.profilePic?.url || "");
			setBannerPicPreview(data.user.bannerImage?.url || "");

			// Sync following state with server
			if (onProfileLoaded && data.user._id) {
				onProfileLoaded(data.user._id, !!data.user.followingByMe);
			}

			// Trigger view count increment (if not self view) — fire-and-forget
			if (user?._id !== data.user._id) {
				apiFetch(`/api/users/${data.user._id}/view`, { method: "POST" });
			}

			const targetId = data.user._id;

			// 2. Fetch posts + saved/reposted in parallel
			const promises: Promise<void>[] = [
				apiFetch(`/api/users/${targetId}/posts?limit=10`).then(async (postRes) => {
					const postData = await postRes.json();
					if (postRes.ok && postData.success) {
						setPosts(postData.posts || []);
						setPostsCursor(postData.nextCursor || null);
						setPostsHasMore(postData.hasMore || false);
					}
				}),
			];

			// 3. Fetch saved/reposted if viewing own profile (in parallel with posts)
			if (user && user.username === targetUsername) {
				promises.push(fetchSavedPosts());
				promises.push(fetchRepostedPosts());
			}

			await Promise.all(promises);
		} catch (e) {
			logger.error(e);
		} finally {
			setLoading(false);
		}
	};

	const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
		e.stopPropagation();
		setDeleteConfirmPostId(postId);
	};

	const confirmDeletePost = async () => {
		const postId = deleteConfirmPostId;
		setDeleteConfirmPostId(null);
		if (!postId) return;
		// Optimistic removal
		setPosts((prev) => prev.filter((p) => p._id !== postId));
		setSavedPosts((prev) => prev.filter((p) => p._id !== postId));
		setRepostedPosts((prev) => prev.filter((p) => p._id !== postId));
		try {
			const res = await apiFetch(`/api/posts/${postId}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				// Re-fetch to restore correct state on failure
				loadProfile();
			}
		} catch (e) {
			logger.error(e);
			// Re-fetch to restore correct state on error
			loadProfile();
		}
	};

	const handleUpdatePost = async (e: React.FormEvent, postId: string) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			const res = await apiFetch(`/api/posts/${postId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: editPostTitle,
					content: editPostContent,
				}),
			});
			if (res.ok) {
				setPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? {
								...p,
								title: editPostTitle,
								content: editPostContent,
							}
							: p,
					),
				);
				setEditPostId(null);
			}
		} catch (e) {
			logger.error(e);
		}
	};

	// Listen for realtime comment count updates from other users
	useEffect(() => {
		const handleCommentAdded = (e: CustomEvent<{ postId: string; commentsCount: number }>) => {
			const { postId, commentsCount } = e.detail;
			setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
			setSavedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
			setRepostedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
		};
		window.addEventListener("postCommentAdded", handleCommentAdded as EventListener);
		return () => window.removeEventListener("postCommentAdded", handleCommentAdded as EventListener);
	}, []);

	// Listen for realtime post deletion
	useEffect(() => {
		const handlePostDeleted = (e: CustomEvent<{ postId: string }>) => {
			const { postId } = e.detail;
			setPosts((prev) => prev.filter((p) => p._id !== postId));
			setSavedPosts((prev) => prev.filter((p) => p._id !== postId));
			setRepostedPosts((prev) => prev.filter((p) => p._id !== postId));
		};
		window.addEventListener("postDeleted", handlePostDeleted as EventListener);
		return () => window.removeEventListener("postDeleted", handlePostDeleted as EventListener);
	}, []);

	// Listen for realtime post edits (preserve interaction status for current user)
	useEffect(() => {
		const handlePostUpdated = (e: CustomEvent<{ post: Post }>) => {
			const { post } = e.detail;
			const updateFn = (p: Post) =>
				p._id === post._id
					? { ...p, ...post, likedByMe: p.likedByMe, savedByMe: p.savedByMe, repostedByMe: p.repostedByMe }
					: p;
			setPosts((prev) => prev.map(updateFn));
			setSavedPosts((prev) => prev.map(updateFn));
			setRepostedPosts((prev) => prev.map(updateFn));
		};
		window.addEventListener("postUpdated", handlePostUpdated as EventListener);
		return () => window.removeEventListener("postUpdated", handlePostUpdated as EventListener);
	}, []);

	// Listen for realtime comment deletion (update commentsCount from authoritative server value)
	useEffect(() => {
		const handleCommentDeleted = (e: CustomEvent<{ postId: string; commentsCount: number }>) => {
			const { postId, commentsCount } = e.detail;
			setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
			setSavedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
			setRepostedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, commentsCount } : p)));
		};
		window.addEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
		return () => window.removeEventListener("postCommentDeleted", handleCommentDeleted as EventListener);
	}, []);

	// Listen for realtime post view updates
	useEffect(() => {
		const handlePostViewUpdated = (e: CustomEvent<{ postId: string; viewsCount: number }>) => {
			const { postId, viewsCount } = e.detail;
			setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p)));
			setSavedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p)));
			setRepostedPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, viewsCount } : p)));
		};
		window.addEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
		return () => window.removeEventListener("postViewUpdated", handlePostViewUpdated as EventListener);
	}, []);

	// Listen for realtime user profile view updates
	useEffect(() => {
		const handleUserViewUpdated = (e: CustomEvent<{ userId: string; viewsCount: number }>) => {
			const { userId, viewsCount } = e.detail;
			setProfile((prev) =>
				prev && prev._id === userId ? { ...prev, viewsCount } : prev
			);
		};
		window.addEventListener("userViewUpdated", handleUserViewUpdated as EventListener);
		return () => window.removeEventListener("userViewUpdated", handleUserViewUpdated as EventListener);
	}, []);

	// Listen for realtime user followers count updates
	useEffect(() => {
		const handleFollowersCountChanged = (e: CustomEvent<{ targetUserId: string; followerId: string; followersCount: number }>) => {
			const { targetUserId, followersCount } = e.detail;
			setProfile((prev) =>
				prev && prev._id === targetUserId ? { ...prev, followersCount } : prev
			);
		};
		window.addEventListener("userFollowersCountChanged", handleFollowersCountChanged as EventListener);
		return () => window.removeEventListener("userFollowersCountChanged", handleFollowersCountChanged as EventListener);
	}, []);

	// Listen for post interaction changes from other components
	useEffect(() => {
		const handleInteraction = (e: CustomEvent<{ postId: string; type: string; value: boolean; source?: string; count?: number }>) => {
			const { postId, type, value, source, count } = e.detail;
			// Skip local dispatches — Profile already has its own optimistic handling
			if (source === "local") return;
			if (!source) return; // Events without source prevent double-counting
			// Socket events only update counts using authoritative count from server
			const isSocketSource = source === "socket";
			
			// Helper: use absolute count from server when available
			const getCount = (currentCount: number) => {
				if (count !== undefined) return count;
				return Math.max(0, currentCount + (value ? 1 : -1));
			};
			
			const updateFn = (p: Post) => {
				if (p._id !== postId) return p;
				const interactiveTypes = ["like", "save", "repost"];
				if (interactiveTypes.includes(type)) {
					const statusField = type === "like" ? "likedByMe" : type === "save" ? "savedByMe" : "repostedByMe";
					const countField = type === "like" ? "likesCount" : type === "save" ? "savesCount" : "repostsCount";
					if (isSocketSource) {
						// Socket: only update count using authoritative server value, leave status untouched
						return {
							...p,
							[countField]: getCount(p[countField as keyof Post] as number || 0),
						};
					}
					// Not socket, not local — update both status and count
					return {
						...p,
						[statusField]: value,
						[countField]: getCount(p[countField as keyof Post] as number || 0),
					};
				}
				if (type === "share") {
					return { ...p, sharesCount: count !== undefined ? count : Math.max(0, (p.sharesCount || 0) + 1) };
				}
				return p;
			};
			// Update all three state arrays
			setPosts((prev) => prev.map(updateFn));
			setSavedPosts((prev) => prev.map(updateFn));
			setRepostedPosts((prev) => prev.map(updateFn));
		};

		window.addEventListener("postInteractionChanged", handleInteraction as EventListener);
		return () => window.removeEventListener("postInteractionChanged", handleInteraction as EventListener);
	}, []);

	// Toggle like from profile cards
	const handleProfileLikeToggle = async (postId: string, likedByMe: boolean) => {
		const prevLiked = likedByMe;
		const prevCount = (() => { const p = posts.find(x => x._id === postId); return p?.likesCount ?? 0; })();

		setPosts((prev) =>
			prev.map((p) =>
				p._id === postId
					? { ...p, likedByMe: !prevLiked, likesCount: Math.max(0, (p.likesCount || 0) + (prevLiked ? -1 : 1)) }
					: p,
			),
		);
		setSavedPosts((prev) =>
			prev.map((p) =>
				p._id === postId
					? { ...p, likedByMe: !prevLiked, likesCount: Math.max(0, (p.likesCount || 0) + (prevLiked ? -1 : 1)) }
					: p,
			),
		);
		setRepostedPosts((prev) =>
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
				// Rollback to previous state
				setPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, likedByMe: prevLiked, likesCount: prevCount }
							: p,
					),
				);
				setSavedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, likedByMe: prevLiked, likesCount: prevCount }
							: p,
					),
				);
				setRepostedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, likedByMe: prevLiked, likesCount: prevCount }
							: p,
					),
				);
			}
		} catch (e) {
			logger.error(e);
			// Rollback
			setPosts((prev) =>
				prev.map((p) =>
					p._id === postId
						? { ...p, likedByMe: prevLiked, likesCount: prevCount }
						: p,
				),
			);
			setSavedPosts((prev) =>
				prev.map((p) =>
					p._id === postId
						? { ...p, likedByMe: prevLiked, likesCount: prevCount }
						: p,
				),
			);
			setRepostedPosts((prev) =>
				prev.map((p) =>
					p._id === postId
						? { ...p, likedByMe: prevLiked, likesCount: prevCount }
						: p,
				),
			);
		}
	};

	// Toggle save from profile cards
	const handleProfileSaveToggle = async (postId: string, savedByMe: boolean) => {
		const prevSaved = savedByMe;
		const prevCount = (() => { const p = savedPosts.find(x => x._id === postId) ?? posts.find(x => x._id === postId); return p?.savesCount ?? 0; })();

		// If unsaving and on the saved tab, remove immediately
		if (profileTab === "saved" && prevSaved) {
			setSavedPosts((prev) => prev.filter((p) => p._id !== postId));
		} else {
			setSavedPosts((prev) =>
				prev.map((p) =>
					p._id === postId
						? { ...p, savedByMe: !prevSaved, savesCount: Math.max(0, (p.savesCount || 0) + (prevSaved ? -1 : 1)) }
						: p,
				),
			);
		}

		setPosts((prev) =>
			prev.map((p) =>
				p._id === postId
					? { ...p, savedByMe: !prevSaved, savesCount: Math.max(0, (p.savesCount || 0) + (prevSaved ? -1 : 1)) }
					: p,
			),
		);
		setRepostedPosts((prev) =>
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
				// Rollback: re-fetch to get correct state
				if (profileTab === "saved") fetchSavedPosts();
				else {
					setPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, savedByMe: prevSaved, savesCount: prevCount }
								: p,
						),
					);
					setSavedPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, savedByMe: prevSaved, savesCount: prevCount }
								: p,
						),
					);
					setRepostedPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, savedByMe: prevSaved, savesCount: prevCount }
								: p,
						),
					);
				}
			}
		} catch (e) {
			logger.error(e);
			if (profileTab === "saved") fetchSavedPosts();
			else {
				setPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, savedByMe: prevSaved, savesCount: prevCount }
							: p,
					),
				);
				setSavedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, savedByMe: prevSaved, savesCount: prevCount }
							: p,
					),
				);
				setRepostedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, savedByMe: prevSaved, savesCount: prevCount }
							: p,
					),
				);
			}
		}
	};



	// Toggle repost from profile cards
	const handleProfileRepostToggle = async (postId: string, repostedByMe: boolean) => {
		const prevReposted = repostedByMe;
		const prevCount = (() => { const p = repostedPosts.find(x => x._id === postId) ?? posts.find(x => x._id === postId); return p?.repostsCount ?? 0; })();

		// If un-reposting and on the reposts tab, remove immediately
		if (profileTab === "reposts" && prevReposted) {
			setRepostedPosts((prev) => prev.filter((p) => p._id !== postId));
		} else {
			setRepostedPosts((prev) =>
				prev.map((p) =>
					p._id === postId
						? { ...p, repostedByMe: !prevReposted, repostsCount: Math.max(0, (p.repostsCount || 0) + (prevReposted ? -1 : 1)) }
						: p,
				),
			);
		}

		setPosts((prev) =>
			prev.map((p) =>
				p._id === postId
					? { ...p, repostedByMe: !prevReposted, repostsCount: Math.max(0, (p.repostsCount || 0) + (prevReposted ? -1 : 1)) }
					: p,
			),
		);
		setSavedPosts((prev) =>
			prev.map((p) =>
				p._id === postId
					? { ...p, repostedByMe: !prevReposted, repostsCount: Math.max(0, (p.repostsCount || 0) + (prevReposted ? -1 : 1)) }
					: p,
			),
		);
		try {
			const res = await apiFetch(`/api/reposts/${postId}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok || !data.success) {
				// Rollback: re-fetch on reposts tab, map on others
				if (profileTab === "reposts") fetchRepostedPosts();
				else {
					setPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
								: p,
						),
					);
					setSavedPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
								: p,
						),
					);
					setRepostedPosts((prev) =>
						prev.map((p) =>
							p._id === postId
								? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
								: p,
						),
					);
				}
			}
		} catch (e) {
			logger.error(e);
			if (profileTab === "reposts") fetchRepostedPosts();
			else {
				setPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
							: p,
					),
				);
				setSavedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
							: p,
					),
				);
				setRepostedPosts((prev) =>
					prev.map((p) =>
						p._id === postId
							? { ...p, repostedByMe: prevReposted, repostsCount: prevCount }
							: p,
					),
				);
			}
		}
	};

	useEffect(() => {
		// Clear previous profile to prevent flash when switching users
		setProfile(null);
		setLoading(true);
		loadProfile();
	}, [targetUsername, user?._id]);

	// Load saved & reposted when switching to those tabs (self only)
	useEffect(() => {
		if (
			profileTab === "saved" &&
			isSelf !== undefined &&
			savedPosts.length === 0
		) {
			fetchSavedPosts();
		}
		if (
			profileTab === "reposts" &&
			isSelf !== undefined &&
			repostedPosts.length === 0
		) {
			fetchRepostedPosts();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profileTab]);

	const fetchMorePosts = async () => {
		if (!postsCursor || loadingMorePosts) return;
		setLoadingMorePosts(true);
		try {
			const targetId = profile?._id;
			if (!targetId) return;
			const res = await apiFetch(`/api/users/${targetId}/posts?limit=10&cursor=${postsCursor}`);
			const data = await res.json();
			if (res.ok && data.success) {
				setPosts((prev) => {
					const keys = new Set(prev.map((p) => p._id));
					const newOnes = (data.posts || []).filter((p: any) => !keys.has(p._id));
					return [...prev, ...newOnes];
				});
				setPostsCursor(data.nextCursor || null);
				setPostsHasMore(data.hasMore || false);
			}
		} catch (e) {
			logger.error(e);
		} finally {
			setLoadingMorePosts(false);
		}
	};

	// Infinite scroll sentinel observer for posts
	useEffect(() => {
		if (!postsHasMore || loadingMorePosts || !profile) return;
		const sentinel = postsSentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) fetchMorePosts();
			},
			{ rootMargin: "200px", threshold: 0 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [postsHasMore, loadingMorePosts, postsCursor, profile]);

	// Infinite scroll sentinel observer for saved
	useEffect(() => {
		if (!savedHasMore || loadingMoreSaved || !profile) return;
		const sentinel = savedSentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) fetchSavedPosts(savedCursor);
			},
			{ rootMargin: "200px", threshold: 0 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [savedHasMore, loadingMoreSaved, savedCursor, profile]);

	// Infinite scroll sentinel observer for reposts
	useEffect(() => {
		if (!repostsHasMore || loadingMoreReposts || !profile) return;
		const sentinel = repostsSentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) fetchRepostedPosts(repostsCursor);
			},
			{ rootMargin: "200px", threshold: 0 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [repostsHasMore, loadingMoreReposts, repostsCursor, profile]);

	const loadList = async (type: "followers" | "following" | "reposts") => {
		if (!profile) return;
		setActiveList(type);
		setListLoading(true);
		try {
			// followers and following come from /api/follows/:userId/...
			const endpoint =
				type === "reposts"
					? `/api/users/${profile._id}/reposts`
					: `/api/follows/${profile._id}/${type}`;
			const res = await apiFetch(endpoint);
			const data = await res.json();
			if (res.ok && data.success) {
				if (type === "reposts") {
					setListItems(data.posts || []);
				} else if (type === "followers") {
					// Extract the actual user objects from the follower objects
					const users = (data.followers || [])
						.map((f: any) => {
							return f.follower || f;
						})
						.filter(Boolean);
					setListItems(users);
				} else {
					// Extract the actual user objects from the following objects
					const users = (data.following || [])
						.map((f: any) => {
							return f.following || f;
						})
						.filter(Boolean);
					setListItems(users);
				}
			}
		} catch (e) {
			logger.error(`Error loading ${type}:`, e);
		} finally {
			setListLoading(false);
		}
	};

	const fetchSavedPosts = async (cursor?: string | null) => {
		if (cursor) {
			setLoadingMoreSaved(true);
		} else {
			setLoadingSaved(true);
		}
		try {
			let endpoint = "/api/saves?limit=10";
			if (cursor) {
				endpoint += `&cursor=${cursor}`;
			}
			const res = await apiFetch(endpoint);
			const data = await res.json();
			if (res.ok && data.success) {
				if (cursor) {
					setSavedPosts((prev) => {
						const keys = new Set(prev.map((p) => p._id));
						const newOnes = (data.posts || []).filter((p: any) => !keys.has(p._id));
						return [...prev, ...newOnes];
					});
				} else {
					setSavedPosts(data.posts || []);
				}
				setSavedCursor(data.nextCursor || null);
				setSavedHasMore(data.hasMore || false);
			}
		} catch (e) {
			logger.error(e);
		} finally {
			if (cursor) {
				setLoadingMoreSaved(false);
			} else {
				setLoadingSaved(false);
			}
		}
	};

	const fetchRepostedPosts = async (cursor?: string | null) => {
		if (cursor) {
			setLoadingMoreReposts(true);
		} else {
			setLoadingReposts(true);
		}
		try {
			let endpoint = "/api/reposts?limit=10";
			if (cursor) {
				endpoint += `&cursor=${cursor}`;
			}
			const res = await apiFetch(endpoint);
			const data = await res.json();
			if (res.ok && data.success) {
				if (cursor) {
					setRepostedPosts((prev) => {
						const keys = new Set(prev.map((p) => p._id));
						const newOnes = (data.posts || []).filter((p: any) => !keys.has(p._id));
						return [...prev, ...newOnes];
					});
				} else {
					setRepostedPosts(data.posts || []);
				}
				setRepostsCursor(data.nextCursor || null);
				setRepostsHasMore(data.hasMore || false);
			}
		} catch (e) {
			logger.error(e);
		} finally {
			if (cursor) {
				setLoadingMoreReposts(false);
			} else {
				setLoadingReposts(false);
			}
		}
	};

	const handleFollowToggle = async () => {
		if (!profile) return;
		const amIFollowing =
			followingStates[profile._id] ??
			(profile as any).followingByMe ??
			(profile as any).isFollowing ??
			false;

		// 1. Optimistic Update local profile state instantly
		setProfile((prev) =>
			prev
				? ({
					...prev,
					isFollowing: !amIFollowing,
					followingByMe: !amIFollowing,
					followersCount: amIFollowing
						? Math.max(0, (prev.followersCount || 0) - 1)
						: (prev.followersCount || 0) + 1,
				} as any)
				: null
		);

		try {
			// Call the global toggle function (handles global optimistic state + rollback + toast)
			await onToggleFollow(profile._id);
		} catch (err) {
			// 2. Rollback local profile state if server failed
			setProfile((prev) =>
				prev
					? ({
						...prev,
						isFollowing: amIFollowing,
						followingByMe: amIFollowing,
						followersCount: !amIFollowing
							? Math.max(0, (prev.followersCount || 0) - 1)
							: (prev.followersCount || 0) + 1,
					} as any)
					: null
			);
		}
	};

	const handleShareProfile = async () => {
		if (!profile) return;
		try {
			const res = await apiFetch(`/api/users/${profile._id}/share`, {
				method: "POST",
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setProfile((prev) =>
					prev ? { ...prev, sharesCount: data.count } : null,
				);

				// Copy profile landing page URL to system clipboard
				const url_link = `${window.location.origin}/u/${profile.username}`;
				navigator.clipboard.writeText(url_link);
				window.dispatchEvent(new CustomEvent("showToast", {
					detail: { message: "Profile share link copied to clipboard!", type: "success" },
				}));
			}
		} catch (e) {
			logger.error(e);
		}
	};

	const handleUpdateSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError(null);
		setSuccess(null);

		const formData = new FormData();
		formData.append("fullName", fullName);
		formData.append("bio", bio);

		if (profilePicFile) formData.append("profilePic", profilePicFile);
		if (bannerPicFile) formData.append("bannerImage", bannerPicFile);

		try {
			const res = await apiFetch("/api/users/update-profile", {
				method: "PUT",
				body: formData,
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setProfile(data.user);
				onUserUpdate(data.user); // Synchronize active session user
				window.dispatchEvent(new CustomEvent("showToast", {
					detail: { message: "Profile settings successfully refreshed.", type: "success" },
				}));
				setTimeout(() => {
					setEditOpen(false);
				}, 1500);
			} else {
				setError(data.message || "Failed to save settings.");
			}
		} catch (err) {
			setError("Lost connection to server during upload.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="w-full space-y-6 pt-10 px-4">
				<Skeleton variant="banner" />
				<div className="flex items-center gap-4 px-2">
					<Skeleton variant="circle" className="h-18 w-18 shrink-0" />
					<div className="space-y-2">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-4 w-20" />
					</div>
				</div>
				<div className="grid grid-cols-4 gap-3">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-20" />
					))}
				</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="flex h-96 flex-col items-center justify-center text-center">
				<p className="text-sm text-zinc-400">
					This profile does not exist.
				</p>
			</div>
		);
	}

	const isSelf = user?._id === profile._id;

	return (
		<>
			{onBack && (
				<button
					onClick={onBack}
					className="fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm backdrop-blur-md"
					title="Back"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
			)}
			<div
				ref={containerRef}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				className="w-full px-2 pb-24 pt-6"
				style={{ transform: `translateY(${pullDistance}px)`, transition: isPullingRef.current ? 'none' : 'transform 0.3s ease-out' }}
			>
				{/* Banner */}
				<div
					className="group relative h-40 overflow-hidden rounded-3xl border border-white/20 bg-zinc-900 md:h-48 cursor-pointer"
					onClick={() => {
						window.dispatchEvent(
							new CustomEvent("openImagePreview", {
								detail:
									bannerPicPreview ||
									"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800",
							}),
						);
					}}>
					<img loading="lazy" 
						src={
							bannerPicPreview ||
							"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800"
						}
						alt="User banner"
						className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-102"
					/>
					<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
				</div>

				{/* Profile Header Block */}
				<div className="relative -mt-12 px-6 font-sans">
					<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
						<div className="relative">
							<img loading="lazy"
								src={
									profilePicPreview ||
									"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"
								}
								alt={profile.fullName}
								className="h-24 w-24 rounded-full border-4 border-white dark:border-zinc-900 object-cover shadow-md cursor-pointer hover:opacity-90 transition-opacity"
								onClick={() => {
									window.dispatchEvent(
										new CustomEvent("openImagePreview", {
											detail:
												profilePicPreview ||
												"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
										}),
									);
								}}
							/>
						</div>

						<div className="flex items-center gap-2.5">
							<button
								onClick={handleShareProfile}
								className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-150 transition-colors shadow-sm cursor-pointer">
								<Share2 className="h-4.5 w-4.5" />
							</button>

							{isSelf ? (
								<button
									onClick={() => {
										setEditType("profile");
										setEditOpen(true);
									}}
									className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-800 bg-white dark:bg-zinc-900 px-5 text-sm font-medium text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm cursor-pointer">
									<Edit3 className="h-4 w-4" /> Edit Profile
								</button>
							) : (
								(() => {
									const amIFollowing =
										followingStates[profile._id] ??
										(profile as any).followingByMe ??
										(profile as any).isFollowing ??
										false;
									return (
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleFollowToggle();
											}}
											className={`text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${amIFollowing ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white border border-zinc-300 dark:border-zinc-600 shadow-md" : "bg-black text-white hover:bg-zinc-800 shadow-lg"}`}>
											{amIFollowing ? "Following" : "Follow"}
										</button>
									);
								})()
							)}
						</div>
					</div>
				</div>

				{/* User details: name, username, bio, join date, stats */}
				<div className="mt-4 px-1.5 space-y-3">
					<div>
						<h1 className="text-xl font-bold text-white">{profile.fullName}</h1>
						<p className="text-sm text-zinc-400">@{profile.username}</p>
					</div>

					{profile.bio && (
						<p className="text-sm text-zinc-300 leading-relaxed max-w-lg">{profile.bio}</p>
					)}

					{profile.createdAt && (
						<div className="flex items-center gap-1.5 text-xs text-zinc-500">
							<Calendar className="h-3.5 w-3.5" />
							<span>Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
						</div>
					)}


				</div>

				<div className="mt-5 flex items-center gap-6 px-1.5 text-sm">
					<button
						onClick={() => loadList("following")}
						className="flex items-center gap-1.5 hover:underline cursor-pointer group">
						<span className="font-bold text-white">
							{(profile.followingCount ?? 0).toLocaleString()}
						</span>
						<span className="text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-300">
							Following
						</span>
					</button>
					<button
						onClick={() => loadList("followers")}
						className="flex items-center gap-1.5 hover:underline cursor-pointer group">
						<span className="font-bold text-white">
							{(profile.followersCount ?? 0).toLocaleString()}
						</span>
						<span className="text-zinc-400 group-hover:text-slate-700 dark:group-hover:text-zinc-300">
							Followers
						</span>
					</button>
				</div>

				{/* Profile Content Tabs */}
				<div className="mt-7">
					<div className="flex items-center gap-1 mb-5">
						{[
							{
								id: "posts" as const,
								label: "Posts",
								icon: FileText,
								count: posts.length,
							},
							...(isSelf
								? [
									{
										id: "saved" as const,
										label: "Saved",
										icon: Bookmark,
										count: savedPosts.length,
									},
									{
										id: "reposts" as const,
										label: "Reposts",
										icon: Repeat2,
										count: repostedPosts.length,
									},
								]
								: []),
						].map((tab) => {
							const Icon = tab.icon;
							const active = profileTab === tab.id;
							return (
								<button
									key={tab.id}
									onClick={() => setProfileTab(tab.id)}
									className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all cursor-pointer rounded-t-lg ${active
											? "text-black dark:text-white"
											: "text-zinc-500"
										}`}>
									<Icon className="h-3.5 w-3.5" />
									{tab.label}
									<span
										className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${active
												? "bg-white text-black"
												: "bg-slate-100 dark:bg-zinc-800 text-zinc-400"
											}`}>
										{tab.count}
									</span>
								</button>
							);
						})}
					</div>

					{/* Posts Tab */}
					{profileTab === "posts" && (
						<>
							{posts.length === 0 ? (
								<GlassCard className="flex flex-col items-center justify-center py-12 text-center shadow-sm">
									<h4 className="text-sm font-bold text-white">
										No posts yet
									</h4>
									<p className="mt-1 text-xs text-zinc-500 max-w-xs">
										When this account posts, it will appear
										here.
									</p>
								</GlassCard>
							) : (
								<div className="space-y-5 max-w-2xl mx-auto w-full">
									<AnimatePresence>
										{posts.map((post) => (
											<GlassCard
												key={post._id}
												animate={true}
												className="group relative flex flex-col justify-between overflow-hidden p-6 text-left rounded-4xl border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all"
												showMacControls={false}>
												{editPostId === post._id ? (
													<form
														onSubmit={(e) =>
															handleUpdatePost(
																e,
																post._id,
															)
														}
														className="space-y-3 z-10 block w-full relative">
														<input
															type="text"
															value={editPostTitle}
															onChange={(e) =>
																setEditPostTitle(
																	e.target.value,
																)
															}
															onClick={(e) =>
																e.stopPropagation()
															}
															className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-2.5 px-4 text-sm text-white outline-none focus:border-zinc-600"
														/>
														<textarea
															value={editPostContent}
															onChange={(e) =>
																setEditPostContent(
																	e.target.value,
																)
															}
															onClick={(e) =>
																e.stopPropagation()
															}
															rows={3}
															className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl py-3 px-4 text-xs text-white outline-none focus:border-zinc-600 resize-none"
														/>
														<div className="flex items-center gap-2">
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	setEditPostId(
																		null,
																	);
																}}
																className="px-4 py-1.5 rounded-full border border-zinc-700 text-xs font-bold text-zinc-400">
																Cancel
															</button>
															<button
																type="submit"
																onClick={(e) =>
																	e.stopPropagation()
																}
																className="px-4 py-1.5 rounded-full bg-white dark:text-black text-white text-xs font-bold">
																Save
															</button>
														</div>
													</form>
												) : (
													<>
														{user?._id ===
															profile?._id && (
																<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-20">
																	<button
																		onClick={(
																			e,
																		) => {
																			e.stopPropagation();
																			setEditPostTitle(
																				post.title,
																			);
																			setEditPostContent(
																				post.content,
																			);
																			setEditPostId(
																				post._id,
																			);
																		}}
																		className="p-1.5 bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-white shadow-sm cursor-pointer">
																		<Edit3 className="h-3 w-3" />
																	</button>
																	<button
																		onClick={(e) =>
																			handleDeletePost(
																				e,
																				post._id,
																			)
																		}
																		className="p-1.5 bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 hover:text-red-500 shadow-sm cursor-pointer">
																		<X className="h-3 w-3" />
																	</button>
																</div>
															)}
														
														{/* Author Context Line */}
														<div className="mb-4 flex items-center justify-between">
															<div className="flex items-center gap-3">
																<img loading="lazy"
																	src={profile.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
																	alt={profile.fullName}
																	className="h-10 w-10 rounded-full object-cover border border-zinc-800 shadow-sm shrink-0"
																/>
																<div className="text-left">
																	<h4 className="text-sm font-semibold text-white">
																		{profile.fullName}
																	</h4>
																	<p className="text-xs text-zinc-400 font-medium">@{profile.username} • {getRelativeDate(post.createdAt)}</p>
																</div>
															</div>
														</div>

														<div onClick={() => onPostClick(post.slug)} className="cursor-pointer space-y-3">									<h4 className="font-sans text-lg md:text-xl font-bold text-white leading-tight text-left">
									{post.title}
								</h4>
								<p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap text-left select-text">
									{post.content}
								</p>
															{post.image && (
																<div className="mt-3.5 overflow-hidden rounded-3xl border border-zinc-800">
																	<img loading="lazy" 
																		src={
																			post.image
																				.url
																		}
																		alt="attachment"
																		className="w-full h-auto max-h-120 object-cover"
																	/>
																</div>
															)}
														</div>

														<div
															className="mt-4 flex items-center justify-between pt-3 text-sm text-zinc-400 border-t border-zinc-800/50"
															onClick={(e) =>
																e.stopPropagation()
															}>
															<button
																onClick={() => handleProfileLikeToggle(post._id, !!post.likedByMe)}
																className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-red-500 transition-colors"
															>
																<Heart className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : "text-zinc-550"}`} /> {post.likesCount || 0}
															</button>
															<button
																onClick={() => onPostClick(post.slug, true)}
																className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-white transition-colors"
															>
																<MessageSquare className="h-4 w-4 text-zinc-550" /> {post.commentsCount || 0}
															</button>
															<button
																onClick={() => handleProfileSaveToggle(post._id, !!post.savedByMe)}
																className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-yellow-500 transition-colors"
															>
																<Bookmark className={`h-4 w-4 ${post.savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-550"}`} /> {post.savesCount || 0}
															</button>
															<button
																onClick={() => handleProfileRepostToggle(post._id, !!post.repostedByMe)}
																className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-green-500 transition-colors"
															>
																<Repeat2 className={`h-4 w-4 ${post.repostedByMe ? "text-green-500" : "text-zinc-550"}`} /> {post.repostsCount || 0}
															</button>
														</div>
													</>
												)}
											</GlassCard>
										))}
									</AnimatePresence>
									{/* Pagination sentinel + skeleton for posts */}
									{postsHasMore && (
										<div ref={postsSentinelRef}>
											{loadingMorePosts && (
												<div className="grid gap-3.5 sm:grid-cols-2">
													<div className="space-y-4">
														<Skeleton variant="card" />
														<Skeleton variant="card" />
													</div>
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</>
					)}

					{/* Saved Tab (self only) */}
					{profileTab === "saved" && isSelf && (
						<>
							{loadingSaved ? (
								<div className="grid gap-3.5 sm:grid-cols-2">
									{[1, 2].map((n) => (
										<div key={n} className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4.5 space-y-3">
											<div className="flex items-center gap-2">
												<div className="h-6 w-6 rounded-full bg-zinc-800" />
												<div className="h-3 w-20 rounded bg-zinc-800" />
											</div>
											<div className="h-4 w-3/4 rounded bg-zinc-800" />
											<div className="space-y-2">
												<div className="h-3 w-full rounded bg-zinc-800" />
												<div className="h-3 w-2/3 rounded bg-zinc-800" />
											</div>
										</div>
									))}
								</div>
							) : savedPosts.length === 0 ? (
								<GlassCard className="flex flex-col items-center justify-center py-12 text-center shadow-sm">
									<Bookmark className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
									<h4 className="text-sm font-bold text-white">
										No saved posts
									</h4>
									<p className="mt-1 text-xs text-zinc-500 max-w-xs">
										Posts you save will appear here.
									</p>
								</GlassCard>
							) : (
								<div className="space-y-5 max-w-2xl mx-auto w-full">
									{savedPosts.map((post) => (
										<GlassCard
											key={post._id}
											animate={true}
											className="group relative flex flex-col justify-between overflow-hidden p-6 text-left rounded-4xl border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all"
											showMacControls={false}>
											
											{/* Author Context Line */}
											<div className="mb-4 flex items-center justify-between">
												<div className="flex items-center gap-3">
													<img loading="lazy"
														src={(post as any).author?.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
														alt=""
														className="h-10 w-10 rounded-full object-cover border border-zinc-800 shadow-sm shrink-0 cursor-pointer"
														onClick={() => onUserClick((post as any).author?.username)}
													/>
													<div className="text-left">
														<h4
															className="text-sm font-semibold text-white hover:underline cursor-pointer"
															onClick={() => onUserClick((post as any).author?.username)}
														>
															{(post as any).author?.fullName}
														</h4>
														<p className="text-xs text-zinc-400 font-medium">@{(post as any).author?.username} • {getRelativeDate(post.createdAt)}</p>
													</div>
												</div>
											</div>

											<div onClick={() => onPostClick(post.slug)} className="cursor-pointer space-y-3">
							<h4 className="font-sans text-lg md:text-xl font-bold text-white leading-tight text-left">
								{post.title}
							</h4>
							<p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap text-left select-text">
								{post.content}
							</p>
												{post.image && (
													<div className="mt-3.5 overflow-hidden rounded-3xl border border-zinc-800">
														<img loading="lazy" 
															src={post.image.url}
															alt=""
															className="w-full h-auto max-h-120 object-cover"
														/>
													</div>
												)}
											</div>

											<div
												className="mt-4 flex items-center justify-between pt-3 text-sm text-zinc-400 border-t border-zinc-800/50"
												onClick={(e) =>
													e.stopPropagation()
												}>
												<button
													onClick={() => {
														handleProfileLikeToggle(post._id, !!post.likedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-red-500 transition-colors">
													<Heart
														className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : "text-zinc-550"}`}
													/>{" "}
													{post.likesCount || 0}
												</button>
												<button
													onClick={() => onPostClick(post.slug, true)}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-white transition-colors">
													<MessageSquare className="h-4 w-4 text-zinc-550" />{" "}
													{post.commentsCount || 0}
												</button>
												<button
													onClick={() => {
														handleProfileSaveToggle(post._id, !!post.savedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-yellow-500 transition-colors">
													<Bookmark
														className={`h-4 w-4 ${post.savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-550"}`}
													/>{" "}
													{post.savesCount || 0}
												</button>
												<button
													onClick={() => {
														handleProfileRepostToggle(post._id, !!post.repostedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-green-500 transition-colors">
													<Repeat2
														className={`h-4 w-4 ${post.repostedByMe ? "text-green-500" : "text-zinc-550"}`}
													/>{" "}
													{post.repostsCount || 0}
												</button>
											</div>
										</GlassCard>
									))}
								</div>
							)}
							{/* Pagination sentinel + skeleton for saved */}
							{savedHasMore && (
								<div ref={savedSentinelRef}>
									{loadingMoreSaved && (
										<div className="grid gap-3.5 sm:grid-cols-2">
											<div className="space-y-4">
												<Skeleton variant="card" />
												<Skeleton variant="card" />
											</div>
										</div>
									)}
								</div>
							)}
						</>
					)}

					{/* Reposts Tab (self only) */}
					{profileTab === "reposts" && isSelf && (
						<>
							{loadingReposts ? (
								<div className="grid gap-3.5 sm:grid-cols-2">
									{[1, 2].map((n) => (
										<div key={n} className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/40 p-4.5 space-y-3">
											<div className="flex items-center gap-2">
												<div className="h-3 w-3 rounded bg-zinc-800" />
												<div className="h-6 w-6 rounded-full bg-zinc-800" />
												<div className="h-3 w-20 rounded bg-zinc-800" />
											</div>
											<div className="h-4 w-3/4 rounded bg-zinc-800" />
											<div className="space-y-2">
												<div className="h-3 w-full rounded bg-zinc-800" />
												<div className="h-3 w-2/3 rounded bg-zinc-800" />
											</div>
										</div>
									))}
								</div>
							) : repostedPosts.length === 0 ? (
								<GlassCard className="flex flex-col items-center justify-center py-12 text-center shadow-sm">
									<Repeat2 className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
									<h4 className="text-sm font-bold text-white">
										No reposts yet
									</h4>
									<p className="mt-1 text-xs text-zinc-500 max-w-xs">
										Posts you repost will appear here.
									</p>
								</GlassCard>
							) : (
								<div className="space-y-5 max-w-2xl mx-auto w-full">
									{repostedPosts.map((post) => (
										<GlassCard
											key={post._id}
											animate={true}
											className="group relative flex flex-col justify-between overflow-hidden p-6 text-left rounded-4xl border-white/5 bg-zinc-950/20 hover:border-white/10 transition-all"
											showMacControls={false}>
											
											{/* Author Context Line */}
											<div className="mb-4 flex items-center justify-between">
												<div className="flex items-center gap-3">
													<img loading="lazy"
														src={(post as any).author?.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
														alt=""
														className="h-10 w-10 rounded-full object-cover border border-zinc-800 shadow-sm shrink-0 cursor-pointer"
														onClick={() => onUserClick((post as any).author?.username)}
													/>
													<div className="text-left">
														<h4
															className="text-sm font-semibold text-white hover:underline cursor-pointer"
															onClick={() => onUserClick((post as any).author?.username)}
														>
															{(post as any).author?.fullName}
														</h4>
														<p className="text-xs text-zinc-400 font-medium">@{(post as any).author?.username} • {getRelativeDate(post.createdAt)}</p>
													</div>
												</div>
											</div>

											<div onClick={() => onPostClick(post.slug)} className="cursor-pointer space-y-3">
							<h4 className="font-sans text-lg md:text-xl font-bold text-white leading-tight text-left">
								{post.title}
							</h4>
							<p className="text-sm md:text-base text-zinc-300 leading-relaxed whitespace-pre-wrap text-left select-text">
								{post.content}
							</p>
												{post.image && (
													<div className="mt-3.5 overflow-hidden rounded-3xl border border-zinc-800">
														<img loading="lazy" 
															src={post.image.url}
															alt=""
															className="w-full h-auto max-h-120 object-cover"
														/>
													</div>
												)}
											</div>

											<div
												className="mt-4 flex items-center justify-between pt-3 text-sm text-zinc-400 border-t border-zinc-800/50"
												onClick={(e) =>
													e.stopPropagation()
												}>
												<button
													onClick={() => {
														handleProfileLikeToggle(post._id, !!post.likedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-red-500 transition-colors">
													<Heart
														className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : "text-zinc-550"}`}
													/>{" "}
													{post.likesCount || 0}
												</button>
												<button
													onClick={() => onPostClick(post.slug, true)}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-white transition-colors">
													<MessageSquare className="h-4 w-4 text-zinc-550" />{" "}
													{post.commentsCount || 0}
												</button>
												<button
													onClick={() => {
														handleProfileSaveToggle(post._id, !!post.savedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-yellow-500 transition-colors">
													<Bookmark
														className={`h-4 w-4 ${post.savedByMe ? "fill-yellow-500 text-yellow-500" : "text-zinc-550"}`}
													/>{" "}
													{post.savesCount || 0}
												</button>
												<button
													onClick={() => {
														handleProfileRepostToggle(post._id, !!post.repostedByMe);
													}}
													className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-green-500 transition-colors">
													<Repeat2
														className={`h-4 w-4 ${post.repostedByMe ? "text-green-500" : "text-zinc-550"}`}
													/>{" "}
													{post.repostsCount || 0}
												</button>
											</div>
										</GlassCard>
									))}
								</div>
							)}
							{/* Pagination sentinel + skeleton for reposts */}
							{repostsHasMore && (
								<div ref={repostsSentinelRef}>
									{loadingMoreReposts && (
										<div className="grid gap-3.5 sm:grid-cols-2">
											<div className="space-y-4">
												<Skeleton variant="card" />
												<Skeleton variant="card" />
											</div>
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>

				{/* Slide-Up macOS Panel for Profile Settings Edit */}
				<AnimatePresence>
					{editOpen && (
						<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
							{/* Click-out backdrop */}
							<div
								className="absolute inset-0"
								onClick={() => setEditOpen(false)}
							/>

							<motion.div
								initial={{ y: "100%" }}
								animate={{ y: 0 }}
								exit={{ y: "100%" }}
								transition={{
									type: "spring",
									damping: 28,
									stiffness: 220,
								}}
								className="relative z-10 w-full max-w-xl rounded-4xl border border-white/10 bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.9),0_25px_60px_-15px_rgba(0,0,0,0.5)]">
								{/* Drag handle bar */}
								<div className="absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-white/20" />
								<div className="mb-5 pb-5 flex items-center justify-between">
									<div>
										<h3 className="text-xl font-semibold text-white">
											Edit Profile
										</h3>
										<p className="text-sm text-zinc-400 mt-1">
											Update your profile information
										</p>
									</div>
									<button
										onClick={() => setEditOpen(false)}
										className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
										<X className="h-4 w-4" />
									</button>
								</div>

								{error && (
									<div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
										<AlertCircle className="h-4 w-4 shrink-0" />
										<span>{error}</span>
									</div>
								)}

								<form
									onSubmit={handleUpdateSubmit}
									className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										{/* Avatar Upload */}
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-zinc-400 pl-3">
												Avatar
											</label>
											<div className="relative flex h-24 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors">
												<input
													type="file"
													accept="image/*"
													onChange={(e) => {
														const file =
															e.target.files?.[0];
														if (file) {
															setCropImageSrc(
																URL.createObjectURL(
																	file,
																),
															);
															setCropType("profile");
															setCropModalOpen(true);
														}
														e.target.value = "";
													}}
													className="absolute inset-0 opacity-0 cursor-pointer animate-none"
												/>
												<div className="text-center space-y-1">
													<Camera className="mx-auto h-5 w-5 text-zinc-500" />
												</div>
											</div>
										</div>

										{/* Banner Upload */}
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-zinc-400 pl-3">
												Banner
											</label>
											<div className="relative flex h-24 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors">
												<input
													type="file"
													accept="image/*"
													onChange={(e) => {
														const file =
															e.target.files?.[0];
														if (file) {
															setCropImageSrc(
																URL.createObjectURL(
																	file,
																),
															);
															setCropType("banner");
															setCropModalOpen(true);
														}
														e.target.value = "";
													}}
													className="absolute inset-0 opacity-0 cursor-pointer animate-none"
												/>
												<div className="text-center space-y-1">
													<Camera className="mx-auto h-5 w-5 text-zinc-500" />
												</div>
											</div>
										</div>
									</div>

									<div className="space-y-4">
										<div className="space-y-1.5 font-sans">
											<label className="text-sm font-medium text-zinc-400 pl-4">
												Name
											</label>
											<input
												type="text"
												required
												value={fullName}
												onChange={(e) =>
													setFullName(e.target.value)
												}
												className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3.5 px-5 text-sm text-white focus:outline-none focus:border-zinc-600 focus:bg-zinc-900 transition-all font-medium"
											/>
										</div>

										<div className="space-y-1.5 font-sans">
											<label className="text-sm font-medium text-zinc-400 pl-4">
												About
											</label>
											<textarea
												rows={3}
												value={bio}
												onChange={(e) =>
													setBio(e.target.value)
												}
												placeholder="Write something about yourself..."
												className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-3.5 px-5 text-sm text-white focus:outline-none focus:border-zinc-600 focus:bg-zinc-900 transition-all resize-none font-medium"
												maxLength={150}
											/>
										</div>
									</div>

									<div className="flex gap-3.5 pt-2 font-sans">
										<button
											type="button"
											onClick={() => setEditOpen(false)}
											className="flex-1 rounded-full border border-zinc-800 py-3.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white shadow-sm cursor-pointer">
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="flex-1 rounded-full bg-white py-3.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-md cursor-pointer">
											{saving ? "Saving..." : "Save"}
										</button>
									</div>
								</form>
							</motion.div>
						</div>
					)}
				</AnimatePresence>

				<ImageCropModal
					isOpen={cropModalOpen}
					onClose={() => setCropModalOpen(false)}
					imageSrc={cropImageSrc}
					aspectRatio={cropType === "profile" ? 1 : 16 / 9}
					title={`Adjust ${cropType === "profile" ? "Avatar" : "Banner"} crop`}
					onCropComplete={(blob) => {
						const file = new File([blob], `${cropType}_cropped.jpg`, {
							type: "image/jpeg",
						});
						if (cropType === "profile") {
							setProfilePicFile(file);
							setProfilePicPreview(URL.createObjectURL(blob));
						} else {
							setBannerPicFile(file);
							setBannerPicPreview(URL.createObjectURL(blob));
						}
					}}
				/>

				<ConfirmDialog
					isOpen={deleteConfirmPostId !== null}
					title="Delete Post"
					message="Are you sure you want to delete this post? This action cannot be undone."
					confirmLabel="Delete"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={confirmDeletePost}
					onCancel={() => setDeleteConfirmPostId(null)}
				/>

				<AnimatePresence>
					{activeList && (
						<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								onClick={() => setActiveList(null)}
								className="absolute inset-0 bg-black/60 backdrop-blur-sm"
							/>
							<motion.div
								initial={{ opacity: 0, scale: 0.95, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 20 }}
								className="relative w-full max-w-sm bg-zinc-950 rounded-4xl shadow-2xl overflow-hidden border border-zinc-800/50 flex flex-col max-h-[80vh]">
								<div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-10">
									<h3 className="font-bold text-white capitalize">
										{activeList}
									</h3>
									<button
										onClick={() => setActiveList(null)}
										className="rounded-full p-2 text-slate-400 hover:bg-zinc-800 transition">
										<X className="h-4 w-4" />
									</button>
								</div>

								<div className="overflow-y-auto p-4 space-y-4">
									{listLoading ? (
										<div className="py-8 text-center text-zinc-500 text-sm">
											Loading...
										</div>
									) : listItems.length === 0 ? (
										<div className="py-8 text-center text-zinc-500 text-sm">
											No {activeList} found.
										</div>
									) : activeList === "reposts" ? (
										listItems.map((post) => (
											<div
												key={post._id}
												className="cursor-pointer group flex gap-3 text-left p-3.5 rounded-3xl hover:bg-zinc-900 shadow-sm transition-all border border-zinc-800/40 mb-2 last:mb-0"
												onClick={() => {
													setActiveList(null);
													onPostClick(post.slug);
												}}>
												<img loading="lazy" 
													src={
														post.author?.profilePic
															?.url ||
														"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"
													}
													className="w-10 h-10 rounded-full object-cover shrink-0"
												/>
												<div>
													<div className="font-bold text-sm text-white">
														{post.author?.fullName}
													</div>
													<div className="text-xs font-semibold text-zinc-500">
														@{post.author?.username}
													</div>
													<p className="text-sm mt-1 text-zinc-400 line-clamp-2">
														{post.title}
													</p>
												</div>
											</div>
										))
									) : (
										listItems.map((u) => (
											<div
												key={u._id}
												className="cursor-pointer flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-900 border border-zinc-800/30 transition-colors mb-2 last:mb-0"
												onClick={() => {
													setActiveList(null);
													onUserClick(u.username);
												}}>
												<img loading="lazy" 
													src={
														u.profilePic?.url ||
														"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"
													}
													className="w-10 h-10 rounded-full object-cover shrink-0"
												/>
												<div className="flex flex-col text-left flex-1">
													<span className="font-bold text-sm text-white">
														{u.fullName}
													</span>
													<span className="text-xs font-semibold text-zinc-500">
														@{u.username}
													</span>
												</div>
												{user &&
													user._id !== u._id &&
													(() => {
														const isUserFollowing =
															followingStates[
															u._id
															] ??
															u.isFollowing ??
															false;
														return (
															<button
																onClick={async (
																	e,
																) => {
																	e.stopPropagation();
																	await onToggleFollow(
																		u._id,
																	);
																}}
																className={`ml-auto text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${isUserFollowing ? "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200"
																		: "bg-black text-white dark:bg-white dark:text-black border-transparent hover:bg-zinc-200"
																	}`}>
																{isUserFollowing
																	? "Following"
																	: "Follow"}
															</button>
														);
													})()}
											</div>
										))
									)}
								</div>
							</motion.div>
						</div>
					)}
				</AnimatePresence>
			</div>

			{/* Pull-to-refresh indicator */}
			{(pullDistance > 0 || isRefreshing) && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
					<div className={`flex items-center gap-2 text-[10px] text-zinc-400 ${isRefreshing ? "" : ""}`}>
						<svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} style={!isRefreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9" />
						</svg>
						<span>{isRefreshing ? "Refreshing..." : "Pull to refresh"}</span>
					</div>
				</div>
			)}
		</>
	);
}
