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
	Image,
} from "lucide-react";
import { User as UserType, Post } from "../types";
import GlassCard from "./GlassCard";
import ImageCropModal from "./ImageCropModal";
import UserAvatar from "./UserAvatar";
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
	onBack: _onBack,
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

	// Responsive drawer animation: use fade+scale on desktop, slide-up on mobile
	const [isDesktop, setIsDesktop] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 768px)");
		setIsDesktop(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const drawerInitial = isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" };
	const drawerAnimate = isDesktop ? { opacity: 1, scale: 1 } : { y: 0 };
	const drawerExit = isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" };
	const drawerTransition = isDesktop
		? { type: "tween" as const, duration: 0.2, ease: "easeOut" as const }
		: { type: "spring" as const, damping: 28, stiffness: 220 };

	const [editPostDrawerOpen, setEditPostDrawerOpen] = useState(false);
	const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
	const [editPostTitle, setEditPostTitle] = useState("");
	const [editPostContent, setEditPostContent] = useState("");
	const [editPostExistingImages, setEditPostExistingImages] = useState<{ public_id: string; url: string }[]>([]);
	const [editPostNewFiles, setEditPostNewFiles] = useState<File[]>([]);
	const [editPostNewPreviews, setEditPostNewPreviews] = useState<string[]>([]);

	// Edit post image crop
	const [editPostCropOpen, setEditPostCropOpen] = useState(false);
	const [editPostCropSrc, setEditPostCropSrc] = useState("");

	const handleEditPostDrawerSave = async () => {
		if (!editPostId) return;
		try {
			const formData = new FormData();
			formData.append("title", editPostTitle);
			formData.append("content", editPostContent);

			// Send existing image public_ids to keep
			if (editPostExistingImages.length > 0) {
				editPostExistingImages.forEach((img) => {
					formData.append("existingImages", img.public_id);
				});
			}

			// Append new image files
			editPostNewFiles.forEach((file) => {
				formData.append("images", file);
			});

			const res = await apiFetch(`/api/posts/${editPostId}`, {
				method: "PUT",
				body: formData,
			});
			if (res.ok) {
				// Revoke old preview URLs
				editPostNewPreviews.forEach((url) => URL.revokeObjectURL(url));

				// Re-fetch to get updated post with all fields
				const fetchRes = await apiFetch(`/api/posts/${editPostId}`);
				if (fetchRes.ok) {
					const data = await fetchRes.json();
					if (data.success && data.post) {
						const updatedPost = data.post;
						const updateFn = (p: any) =>
							p._id === editPostId ? { ...p, ...updatedPost, likedByMe: p.likedByMe, savedByMe: p.savedByMe, repostedByMe: p.repostedByMe } : p;
						setPosts((prev) => prev.map(updateFn));
						setSavedPosts((prev) => prev.map(updateFn));
						setRepostedPosts((prev) => prev.map(updateFn));
					}
				}

				setEditPostDrawerOpen(false);
				setEditPostId(null);
				setEditPostExistingImages([]);
				setEditPostNewFiles([]);
				setEditPostNewPreviews([]);
				window.dispatchEvent(new CustomEvent("showToast", {
					detail: { message: "Post updated!", type: "success" },
				}));
			}
		} catch (e) {
			logger.error(e);
		}
	};

	const handleEditPostRemoveExistingImage = (publicId: string) => {
		setEditPostExistingImages((prev) => prev.filter((img) => img.public_id !== publicId));
	};

	const handleEditPostRemoveNewImage = (idx: number) => {
		setEditPostNewFiles((prev) => prev.filter((_, i) => i !== idx));
		setEditPostNewPreviews((prev) => {
			URL.revokeObjectURL(prev[idx]);
			return prev.filter((_, i) => i !== idx);
		});
	};

	const handleEditPostAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0) return;
		const file = files[0];
		// Revoke previous crop src to prevent memory leak
		if (editPostCropSrc) URL.revokeObjectURL(editPostCropSrc);
		const src = URL.createObjectURL(file);
		setEditPostCropSrc(src);
		setEditPostCropOpen(true);
		e.target.value = "";
	};

	const handleEditPostCropComplete = (blob: Blob) => {
		const file = new File([blob], `edit_image_${Date.now()}.jpg`, { type: "image/jpeg" });
		const preview = URL.createObjectURL(blob);
		setEditPostNewFiles((prev) => [...prev, file]);
		setEditPostNewPreviews((prev) => [...prev, preview]);
		setEditPostCropOpen(false);
		if (editPostCropSrc) URL.revokeObjectURL(editPostCropSrc);
		setEditPostCropSrc("");
	};

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
			const { post } = e.detail;													const updateFn = (p: Post) =>
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

	// Auto-clear error and success messages after timeout
	useEffect(() => {
		if (!error) return;
		const timer = setTimeout(() => setError(null), 6000);
		return () => clearTimeout(timer);
	}, [error]);

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

		if (profilePicFile) {
			formData.append("profilePic", profilePicFile);
		} else if (!profilePicPreview && profile?.profilePic?.url) {
			formData.append("removeProfilePic", "true");
		}
		if (bannerPicFile) {
			formData.append("bannerImage", bannerPicFile);
		} else if (!bannerPicPreview && profile?.bannerImage?.url) {
			formData.append("removeBannerImage", "true");
		}

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

			<div
				ref={containerRef}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				className="w-full px-2 pt-6"
				style={{ transform: `translateY(${pullDistance}px)`, transition: isPullingRef.current ? 'none' : 'transform 0.3s ease-out' }}
			>
				{/* Banner */}
				{bannerPicPreview ? (
					<div
						className="group relative h-40 overflow-hidden rounded-3xl border border-white/20 bg-zinc-900 md:h-48 cursor-pointer"
						onClick={() => {
							window.dispatchEvent(
								new CustomEvent("openImagePreview", {
									detail: bannerPicPreview,
								}),
							);
						}}>
						<img loading="lazy"
							src={bannerPicPreview}
							alt="User banner"
							className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-102"
						/>
						<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
					</div>
				) : (
					<div className="relative flex h-40 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/50 md:h-48 overflow-hidden">
						{/* Subtle dots pattern */}
						<div className="absolute inset-0 opacity-[0.04]" style={{
							backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
							backgroundSize: '20px 20px'
						}} />
						<div className="relative flex flex-col items-center gap-2">
							<Image className="h-8 w-8 text-zinc-600" />
							<span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">No banner</span>
						</div>
					</div>
				)}

				{/* Profile Header Block */}
				<div className="relative -mt-12 px-6 font-sans">
					<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
						<div className="relative">
						<UserAvatar
							src={
								profilePicPreview ||
								""
							}
							alt={profile.fullName}
							className="h-20 w-20 rounded-full border-4 border-white dark:border-zinc-900 object-cover shadow-md cursor-pointer hover:opacity-90 transition-opacity"							onClick={() => {
								if (profilePicPreview) {
									window.dispatchEvent(
										new CustomEvent("openImagePreview", {
											detail: profilePicPreview,
										}),
									);
								}
							}}
						/>
						</div>

						<div className="flex items-center gap-2.5 self-end sm:self-auto">
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
												showMacControls={false}>																	<>
														{user?._id ===
															profile?._id && (
																<div className="absolute top-4 right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-20">
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
																		// Store existing images for the edit draw
																		const existingImgs: { public_id: string; url: string }[] = [];
																		if (post.image?.public_id) {
																			existingImgs.push({ public_id: post.image.public_id, url: post.image.url });
																		}
																		(post.images || []).forEach((img: any) => {
																			if (img.public_id && !existingImgs.some((e) => e.public_id === img.public_id)) {
																				existingImgs.push({ public_id: img.public_id, url: img.url });
																			}
																		});
																		setEditPostExistingImages(existingImgs);
																		setEditPostNewFiles([]);
																		setEditPostNewPreviews([]);
																		setEditPostDrawerOpen(true);
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
															<UserAvatar
																src={profile.profilePic?.url}
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

														<div onClick={() => onPostClick(post.slug)} className="cursor-pointer space-y-3">									<h4 className="font-sans text-sm md:text-base font-bold text-white leading-tight text-left">
									{post.title}
								</h4>
								<p className="text-xs md:text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap text-left select-text">
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
															</button>																					</div>
																	</>
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
													<UserAvatar
														src={(post as any).author?.profilePic?.url}
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
													<UserAvatar
														src={(post as any).author?.profilePic?.url}
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

				{/* Slide-Up macOS Panel for Profile Settings Edit — centered on large screens */}
				<AnimatePresence>
					{editOpen && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm">
							{/* Click-out backdrop */}
							<div
								className="absolute inset-0"
								onClick={() => setEditOpen(false)}
							/>

							<motion.div
								initial={drawerInitial}
								animate={drawerAnimate}
								exit={drawerExit}
								transition={drawerTransition}
								className="relative z-10 w-full max-w-xl rounded-4xl border border-white/10 bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.9),0_25px_60px_-15px_rgba(0,0,0,0.5)] md:max-h-[85vh] md:overflow-y-auto">
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
									<div className="space-y-1.5 text-center">
										<label className="text-xs font-medium text-zinc-400">
											Profile Pic
										</label>											<div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors group mx-auto overflow-hidden">
												<input
													type="file"
													accept="image/*"
													onChange={(e) => {													const file =
														e.target.files?.[0];
												if (file) {
													if (file.type === "image/gif") {
														setProfilePicFile(file);
														setProfilePicPreview(URL.createObjectURL(file));
													} else {
														setCropImageSrc(
															URL.createObjectURL(
																file,
															),
														);
														setCropType("profile");
														setCropModalOpen(true);
													}
												}
												e.target.value = "";
												}}
												className="absolute inset-0 opacity-0 cursor-pointer animate-none z-10"
											/>
												{profilePicPreview ? (
													<>
													<img loading="lazy" src={profilePicPreview} alt="Avatar preview" className="absolute inset-0 h-full w-full rounded-full object-cover pointer-events-none" />
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setProfilePicFile(null);
															setProfilePicPreview("");
														}}className="absolute top-3 right-3 h-4 w-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md cursor-pointer transition-colors z-20"
															title="Remove avatar"
														>
															<X className="h-2.5 w-2.5 text-white" />
												</button>
												</>
												) : (
													<div className="text-center space-y-1">
														<Camera className="mx-auto h-5 w-5 text-zinc-500" />
													</div>
												)}
											</div>
										</div>

										{/* Banner Upload */}
									<div className="space-y-1.5 text-center">
										<label className="text-xs font-medium text-zinc-400">
											Banner
										</label>
											<div className="relative flex h-20 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors group mx-auto overflow-hidden">
												<input
													type="file"
													accept="image/*"
													onChange={(e) => {													const file =
														e.target.files?.[0];
												if (file) {
													if (file.type === "image/gif") {
														setBannerPicFile(file);
														setBannerPicPreview(URL.createObjectURL(file));
													} else {
														setCropImageSrc(
															URL.createObjectURL(
																file,
															),
														);
														setCropType("banner");
														setCropModalOpen(true);
													}
												}
												e.target.value = "";
													}}
													className="absolute inset-0 opacity-0 cursor-pointer animate-none z-10"
												/>
												{bannerPicPreview ? (
													<>
													<img loading="lazy" src={bannerPicPreview} alt="Banner preview" className="absolute inset-0 h-full w-full object-cover" />
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setBannerPicFile(null);
															setBannerPicPreview("");
														}}className="absolute top-3 right-3 h-4 w-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md cursor-pointer transition-colors z-20"
															title="Remove banner"
														>
															<X className="h-2.5 w-2.5 text-white" />
													</button>
												</>
												) : (
													<div className="text-center space-y-1">
														<Camera className="mx-auto h-5 w-5 text-zinc-500" />
													</div>
												)}
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
						</motion.div>
					)}
				</AnimatePresence>

				{/* Slide-Up Edit Post Drawer — centered on large screens */}
				<AnimatePresence>
					{editPostDrawerOpen && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm">
							<div className="absolute inset-0" onClick={() => { setEditPostDrawerOpen(false); setEditPostId(null); setEditPostNewPreviews((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return []; }); setEditPostNewFiles([]); setEditPostExistingImages([]); }} />
							<motion.div
								initial={drawerInitial}
								animate={drawerAnimate}
								exit={drawerExit}
								transition={drawerTransition}
								className="relative z-10 w-full max-w-xl rounded-4xl border border-white/10 bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.9)] md:max-h-[85vh] md:overflow-y-auto">
								<div className="mb-5 flex items-center justify-between">
									<div>
										<h3 className="text-xl font-semibold text-white">Edit Post</h3>
									</div>
									<button onClick={() => { setEditPostDrawerOpen(false); setEditPostId(null); setEditPostNewPreviews((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return []; }); setEditPostNewFiles([]); setEditPostExistingImages([]); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer">
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="space-y-4">
									<input
										type="text"
										value={editPostTitle}
										onChange={(e) => setEditPostTitle(e.target.value)}
										placeholder="Post title"
										className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3.5 px-5 text-sm text-white outline-none focus:border-zinc-600 transition-all"
									/>
									<textarea
										value={editPostContent}
										onChange={(e) => setEditPostContent(e.target.value)}
										placeholder="Post content"
										rows={5}
										className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 py-3.5 px-5 text-sm text-white outline-none focus:border-zinc-600 transition-all resize-none"
									/>

									{/* Existing images — show with remove button */}
									{editPostExistingImages.length > 0 && (
										<div>
											<label className="text-xs font-medium text-zinc-400 pl-3 mb-2 block">Current Images</label>
											<div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
												{editPostExistingImages.map((img) => (
													<div key={img.public_id} className="relative shrink-0 overflow-hidden rounded-xl border border-zinc-800 w-20 h-20 group">
														<img loading="lazy" src={img.url} alt="" className="w-full h-full object-cover" />
														<button
															type="button"
															onClick={() => handleEditPostRemoveExistingImage(img.public_id)}
															className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black transition-all z-20"
														>
															<X className="h-2.5 w-2.5" />
														</button>
													</div>
												))}
											</div>
										</div>
									)}

									{/* New image previews */}
									{editPostNewPreviews.length > 0 && (
										<div>
											<label className="text-xs font-medium text-zinc-400 pl-3 mb-2 block">New Images</label>
											<div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
												{editPostNewPreviews.map((preview, idx) => (
													<div key={idx} className="relative shrink-0 overflow-hidden rounded-xl border border-zinc-800 w-20 h-20 group">
														<img loading="lazy" src={preview} alt="" className="w-full h-full object-cover" />
														<button
															type="button"
															onClick={() => handleEditPostRemoveNewImage(idx)}
															className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-black transition-all z-20"
														>
															<X className="h-2.5 w-2.5" />
														</button>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Add image button */}
									<div className="relative">
										<input
											type="file"
											accept="image/*"
											onChange={handleEditPostAddImages}
											className="absolute inset-0 opacity-0 cursor-pointer"
										/>
										<button
											type="button"
											className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-all pointer-events-none"
										>
											<Image className="h-4 w-4" /> Add Image
										</button>
									</div>
								</div>
								<div className="flex gap-3.5 pt-4">
									<button onClick={() => { setEditPostDrawerOpen(false); setEditPostId(null); setEditPostNewPreviews((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return []; }); setEditPostNewFiles([]); setEditPostExistingImages([]); }} className="flex-1 rounded-full border border-zinc-800 py-3.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer">
										Cancel
									</button>
									<button onClick={handleEditPostDrawerSave} className="flex-1 rounded-full bg-white py-3.5 text-sm font-semibold text-black hover:bg-zinc-200 cursor-pointer">
										Save
									</button>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Edit post image crop modal */}
				<ImageCropModal
					isOpen={editPostCropOpen}
					onClose={() => { setEditPostCropOpen(false); if (editPostCropSrc) { URL.revokeObjectURL(editPostCropSrc); setEditPostCropSrc(""); } }}
					imageSrc={editPostCropSrc}
					aspectRatio={undefined}
					title="Crop Image"
					onCropComplete={handleEditPostCropComplete}
				/>

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
												}}><UserAvatar
														src={
															post.author?.profilePic
																?.url
														}
														alt=""
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
												}}><UserAvatar
														src={
															u.profilePic?.url
														}
														alt=""
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
