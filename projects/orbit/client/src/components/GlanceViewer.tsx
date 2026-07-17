import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Eye, Heart, MessageSquare, Loader2, Trash2, MoreHorizontal, Send, Share2 } from "lucide-react";
import type { Glance, User } from "../types";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface GlanceViewerProps {
	glimpses: Glance[];
	initialIndex: number;
	onClose: () => void;
	onView: (glanceId: string) => void;
	onIndexChange?: (index: number) => void;
	onDeleteGlance?: (glanceId: string) => void;
	currentUser?: User | null;
}

export default function GlanceViewer({
	glimpses,
	initialIndex,
	onClose,
	onView,
	onIndexChange,
	onDeleteGlance,
	currentUser,
}: GlanceViewerProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [progress, setProgress] = useState(0);
	const [showViewersList, setShowViewersList] = useState(false);
	const viewedIdsRef = useRef<Set<string>>(new Set());
	const [isPaused, setIsPaused] = useState(false);
	const progressRef = useRef(0);

	// ── Instagram-style features ──
	const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
	// Initialize reactedByMe from the initial glance's reaction data (avoids flash on mount)
	const [reactedByMe, setReactedByMe] = useState(() => {
		const g = glimpses[initialIndex];
		const uid = currentUser?._id;
		return g?.reactions?.some((r) => {
			const rUserId = typeof r.user === "object" ? r.user._id : r.user;
			return rUserId && uid && rUserId.toString() === uid.toString();
		}) ?? false;
	});
	const [showHeartAnimation, setShowHeartAnimation] = useState(false);
	const [isReacting, setIsReacting] = useState(false);
	const [isReplying, setIsReplying] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const [showReplyInput, setShowReplyInput] = useState(false);
	const [replyText, setReplyText] = useState("");
	const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
	const isLongPressingRef = useRef(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const replyInputRef = useRef<HTMLInputElement>(null);

	// ── Local reactions (optimistically update for real-time heart in viewers list) ──
	const [localReactions, setLocalReactions] = useState<Required<Glance>["reactions"]>([]);

	// Hoisted before the sync useEffect to avoid Temporal Dead Zone
	const currentGlance = glimpses[currentIndex];

	const getAuthorId = () => {
		if (!currentGlance || !currentGlance.author) return null;
		if (typeof currentGlance.author === "string") return currentGlance.author;
		if (typeof currentGlance.author === "object") {
			return currentGlance.author._id || (currentGlance.author as any).id;
		}
		return null;
	};

	const getCurrentUserId = () => {
		if (!currentUser) return null;
		return currentUser._id || (currentUser as any).id;
	};

	const authorId = getAuthorId();
	const currentUserId = getCurrentUserId();

	const isAuthor = !!(authorId && currentUserId && authorId.toString() === currentUserId.toString());

	// Duration each glance is shown (ms) — videos handle their own timing
	const DURATION = currentGlance?.mediaType === "video" ? 999999 : 5000;

	// Sync localReactions when currentGlance changes
	useEffect(() => {
		setLocalReactions(currentGlance?.reactions || []);
		setReactedByMe(
			currentGlance?.reactions?.some((r) => {
				const rUserId = typeof r.user === "object" ? r.user._id : r.user;
				return rUserId && currentUserId && rUserId.toString() === currentUserId.toString();
			}) ?? false
		);
	}, [currentGlance?._id]);

	// ── Video ref ──
	const videoRef = useRef<HTMLVideoElement>(null);

	// Sync current index back to parent feed component
	useEffect(() => {
		if (onIndexChange) {
			onIndexChange(currentIndex);
		}
	}, [currentIndex, onIndexChange]);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	// Mark glance as viewed on the server
	const markViewed = useCallback(
		async (glanceId: string) => {
			if (viewedIdsRef.current.has(glanceId)) return;
			viewedIdsRef.current.add(glanceId);
			onView(glanceId);

			try {
				await apiFetch(`/api/glimpses/${glanceId}/view`, {
					method: "POST",
				});
			} catch (err) {
				logger.error("Failed to mark glance as viewed", err);
			}
		},
		[onView],
	);

	// Handle close
	const handleClose = useCallback(() => {
		onClose();
	}, [onClose]);

	// Mark as viewed immediately when shown to a non-author
	useEffect(() => {
		if (currentGlance && !isAuthor && !currentGlance.viewedByMe) {
			markViewed(currentGlance._id);
		}
	}, [currentGlance?._id, currentGlance?.viewedByMe, isAuthor, markViewed]);

	// Auto-advance progress (for images) — videos are handled by video end/loop
	useEffect(() => {
		if (isPaused || !currentGlance || showViewersList || showReplyInput || currentGlance?.mediaType === "video") return;

		progressRef.current = 0;
		setProgress(0);

		const interval = 30;
		const step = (interval / DURATION) * 100;

		timerRef.current = setInterval(() => {
			progressRef.current += step;
			setProgress(Math.min(progressRef.current, 100));

			if (progressRef.current >= 100) {
				clearInterval(timerRef.current!);
				if (currentIndex < glimpses.length - 1) {
					setCurrentIndex((prev) => prev + 1);
				} else {
					handleClose();
				}
			}
		}, interval);

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [
		currentIndex,
		currentGlance?._id,
		isPaused,
		DURATION,
		glimpses.length,
		handleClose,
		isAuthor,
		showViewersList,
	]);

	// Video progress tracking — updates progress bar based on video currentTime
	useEffect(() => {
		if (currentGlance?.mediaType !== "video" || !videoRef.current) return;

		setProgress(0);

		const video = videoRef.current;

		const handleTimeUpdate = () => {
			if (video.duration) {
				const videoProgress = (video.currentTime / video.duration) * 100;
				setProgress(Math.min(videoProgress, 100));
			}
		};

		video.addEventListener("timeupdate", handleTimeUpdate);
		return () => video.removeEventListener("timeupdate", handleTimeUpdate);
	}, [currentGlance?._id, currentGlance?.mediaType]);

	// Handle tap: left=previous, center=pause/play, right=next
	const handleContainerClick = (e: React.MouseEvent) => {
		// Ignore clicks that immediately follow a swipe gesture
		if (didSwipeRef.current) return;

		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const third = rect.width / 3;

		if (x < third) {
			// Left third: go to previous
			if (currentIndex > 0) {
				setSlideDirection("left");
				setCurrentIndex((prev) => prev - 1);
			}
		} else if (x < third * 2) {
			// Center third: pause/play
			if (currentGlance?.mediaType === "video") {
				if (videoRef.current) {
					if (videoRef.current.paused) {
						videoRef.current.play().catch(() => {});
						setIsPaused(false);
					} else {
						videoRef.current.pause();
						setIsPaused(true);
					}
				}
			} else {
				setIsPaused((prev) => !prev);
			}
		} else {
			// Right third: go to next or close
			if (currentIndex < glimpses.length - 1) {
				setSlideDirection("right");
				setCurrentIndex((prev) => prev + 1);
			} else {
				handleClose();
			}
		}
	};

	// Instagram-style long press to pause
	const handleLongPressStart = useCallback(() => {
		isLongPressingRef.current = false;
		if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
		longPressTimerRef.current = setTimeout(() => {
			isLongPressingRef.current = true;
			setIsPaused(true);
			// Also pause video if playing
			if (videoRef.current && !videoRef.current.paused) {
				videoRef.current.pause();
			}
		}, 200);
	}, []);

	const handleLongPressEnd = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		if (isLongPressingRef.current) {
			isLongPressingRef.current = false;
			setIsPaused(false);
			// Resume video if paused
			if (videoRef.current && videoRef.current.paused && !videoRef.current.ended) {
				videoRef.current.play().catch(() => {});
			}
		}
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest("button")) return;
		handleLongPressStart();
	};

	const handleMouseUp = () => {
		handleLongPressEnd();
	};

	// ── Swipe gesture state ──
	const swipeStartX = useRef(0);
	const swipeStartY = useRef(0);
	const isSwipingRef = useRef(false);
	const didSwipeRef = useRef(false);
	const SWIPE_THRESHOLD = 50;

	const handleTouchStart = (e: React.TouchEvent) => {
		if ((e.target as HTMLElement).closest("button")) return;
		const touch = e.touches[0];
		swipeStartX.current = touch.clientX;
		swipeStartY.current = touch.clientY;
		isSwipingRef.current = false;
		handleLongPressStart();
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!swipeStartX.current) return;
		const touch = e.touches[0];
		const deltaX = touch.clientX - swipeStartX.current;
		const deltaY = touch.clientY - swipeStartY.current;

		// If moved horizontally enough and more horizontal than vertical, treat as swipe
		if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
			isSwipingRef.current = true;
			// Cancel the long-press since user is swiping
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}
		}
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if ((e.target as HTMLElement).closest("button")) return;

		if (isSwipingRef.current) {
			const deltaX = (e.changedTouches[0]?.clientX ?? swipeStartX.current) - swipeStartX.current;
			if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
				didSwipeRef.current = true;
				setTimeout(() => { didSwipeRef.current = false; }, 500);
				if (deltaX > 0) {
					// Swipe right → previous
					if (currentIndex > 0) {
						setSlideDirection("left");
						setCurrentIndex((prev) => prev - 1);
					}
				} else {
					// Swipe left → next
					if (currentIndex < glimpses.length - 1) {
						setSlideDirection("right");
						setCurrentIndex((prev) => prev + 1);
					} else {
						handleClose();
					}
				}
			}
			isSwipingRef.current = false;
			return;
		}

		// Not a swipe, handle normally (long-press end)
		handleLongPressEnd();
	};

	// Handle reaction — toggle like with optimistic update to localReactions
	const handleReact = useCallback(async () => {
		if (!currentGlance || isAuthor || isReacting) return;
		setIsReacting(true);

		const wasReacted = reactedByMe;
		setReactedByMe(!wasReacted);
		setShowHeartAnimation(true);
		setTimeout(() => setShowHeartAnimation(false), 1000);

		// Optimistically update localReactions for real-time heart in viewers list
		setLocalReactions((prev) => {
			if (!wasReacted) {
				// Add current user's reaction
				return [...(prev || []), { user: currentUserId || "", emoji: "❤️" }];
			} else {
				// Remove current user's reaction
				return (prev || []).filter((r) => {
					const rUserId = typeof r.user === "object" ? r.user._id : r.user;
					return rUserId && currentUserId && rUserId.toString() !== currentUserId.toString();
				});
			}
		});

		try {
			await apiFetch(`/api/glimpses/${currentGlance._id}/reactions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emoji: "❤️" }),
			});
		} catch (err) {
			// Revert on error
			setReactedByMe(wasReacted);
			setLocalReactions((prev) => {
				if (wasReacted) {
					return [...(prev || []), { user: currentUserId || "", emoji: "❤️" }];
				} else {
					return (prev || []).filter((r) => {
						const rUserId = typeof r.user === "object" ? r.user._id : r.user;
						return rUserId && currentUserId && rUserId.toString() !== currentUserId.toString();
					});
				}
			});
			logger.error("Failed to react to glimpse", err);
		} finally {
			setIsReacting(false);
		}
	}, [currentGlance, isAuthor, isReacting, reactedByMe, currentUserId]);



	// Handle delete glance
	const handleDelete = useCallback(async () => {
		if (!currentGlance || !isAuthor) return;
		setShowMenu(false);
		try {
			await apiFetch(`/api/glimpses/${currentGlance._id}`, {
				method: "DELETE",
			});
			onDeleteGlance?.(currentGlance._id);
			handleClose();
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Glance deleted.", type: "success" },
				})
			);
		} catch (err) {
			logger.error("Failed to delete glance", err);
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Failed to delete.", type: "error" },
				})
			);
		}
	}, [currentGlance, isAuthor, onDeleteGlance, handleClose]);

	// Handle share
	const handleShare = useCallback(() => {
		setShowMenu(false);
		const url = `${window.location.origin}/glimpse/${currentGlance?._id}`;
		if (navigator.share) {
			navigator.share({ url }).catch(() => {});
		} else {
			navigator.clipboard?.writeText(url).catch(() => {});
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Link copied!", type: "success" },
				})
			);
		}
	}, [currentGlance]);

	// Send reply text
	const handleSendReply = useCallback(async () => {
		if (!currentGlance || isAuthor || isReplying || !replyText.trim()) return;
		setIsReplying(true);
		try {
			await apiFetch(`/api/glimpses/${currentGlance._id}/reply`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: replyText.trim() }),
			});
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Reply sent! Check your messages.", type: "success" },
				})
			);
			setShowReplyInput(false);
			setReplyText("");
			handleClose();
		} catch (err) {
			logger.error("Failed to reply to glimpse", err);
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Failed to send reply.", type: "error" },
				})
			);
		} finally {
			setIsReplying(false);
		}
	}, [currentGlance, isAuthor, isReplying, replyText, handleClose]);

	// Focus reply input when it appears
	useEffect(() => {
		if (showReplyInput && replyInputRef.current) {
			replyInputRef.current.focus();
		}
	}, [showReplyInput]);

	// Close menu on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setShowMenu(false);
			}
		};
		if (showMenu) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showMenu]);

	// When a video ends, auto-advance to the next glance (or close)
	const handleVideoEnded = useCallback(() => {
		// Don't auto-advance if reply input is open
		if (showReplyInput) return;

		if (currentIndex < glimpses.length - 1) {
			setSlideDirection("right");
			setCurrentIndex((prev) => prev + 1);
		} else {
			handleClose();
		}
	}, [currentIndex, glimpses.length, handleClose, showReplyInput]);



	// Listen for glimpse:reacted socket events — update localReactions for real-time heart in viewers list
	useEffect(() => {
		const handleReacted = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.glimpseId !== currentGlance?._id) return;

			if (detail.userId === getCurrentUserId()) {
				setReactedByMe(detail.action === "added");
			}

			// Update localReactions so viewers list hearts stay in sync via socket
			setLocalReactions((prev) => {
				if (detail.action === "added") {
					return [...prev, { user: detail.userId, emoji: detail.emoji }];
				} else {
					return prev.filter((r) => {
						const rUserId = typeof r.user === "object" ? r.user._id : r.user;
						return rUserId && rUserId.toString() !== detail.userId;
					});
				}
			});
		};
		window.addEventListener("glimpse:reacted", handleReacted);
		return () => window.removeEventListener("glimpse:reacted", handleReacted);
	}, [currentGlance?._id]);

	// Keyboard support
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();

			if (e.key === "ArrowRight") {
				if (currentIndex < glimpses.length - 1)
					setCurrentIndex((prev) => prev + 1);
				else handleClose();
			}
			if (e.key === "ArrowLeft") {
				if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
			}
			if (e.key === " ") {
				e.preventDefault();
				if (currentGlance?.mediaType === "video") {
					if (videoRef.current) {
						if (videoRef.current.paused) {
							videoRef.current.play().catch(() => {});
						} else {
							videoRef.current.pause();
						}
					}
				} else {
					setIsPaused((prev) => !prev);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [currentIndex, glimpses.length, handleClose, isAuthor, currentGlance]);

	// Helper: check if a viewer user ID exists in the reactions array
	const hasReacted = useCallback((viewerUserId: string) => {
		return (localReactions || []).some((r) => {
			const rUserId = typeof r.user === "object" ? r.user._id : r.user;
			return rUserId && rUserId.toString() === viewerUserId;
		});
	}, [localReactions]);

	// Build "Liked by X and Y others" text from reactions and viewers
	const getLikedByText = useCallback(() => {
		if (!localReactions || localReactions.length === 0) return null;

		// Separate current user from other reactors
		const otherReactorIds = new Set<string>();
		let currentUserReacted = false;

		localReactions.forEach((r) => {
			const rUserId = typeof r.user === "object" ? r.user._id : r.user;
			if (rUserId) {
				if (currentUserId && rUserId.toString() === currentUserId.toString()) {
					currentUserReacted = true;
				} else {
					otherReactorIds.add(rUserId.toString());
				}
			}
		});

		// Don't show anything if no one else reacted
		if (otherReactorIds.size === 0) return null;

		// Cross-reference with viewers to find display names
		const viewerNameMap = new Map<string, string>();
		(currentGlance?.viewers || []).forEach((v) => {
			const viewerUser = typeof v.user === "object" ? v.user : null;
			if (viewerUser && viewerUser._id && viewerUser.fullName) {
				viewerNameMap.set(viewerUser._id.toString(), viewerUser.fullName);
			}
		});

		// Find the first reactor with a known name
		let firstName: string | null = null;
		for (const id of otherReactorIds) {
			const name = viewerNameMap.get(id);
			if (name) {
				firstName = name;
				break;
			}
		}

		const othersCount = otherReactorIds.size;

		if (firstName) {
			return othersCount === 1
				? `Liked by ${firstName}`
				: `Liked by ${firstName} and ${othersCount - 1} other${othersCount - 1 > 1 ? "s" : ""}`;
		}

		// Fallback: just show count
		if (currentUserReacted) {
			return `Liked by you and ${othersCount} other${othersCount > 1 ? "s" : ""}`;
		}
		return `Liked by ${othersCount} people`;
	}, [localReactions, currentGlance?.viewers, currentUserId]);

	const filteredViewers = (currentGlance?.viewers || []).filter((v) => {
		const viewerId = typeof v.user === "object" && v.user ? v.user._id : v.user;
		return viewerId && currentUserId && viewerId.toString() !== currentUserId.toString();
	});

	if (!currentGlance) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-sm"
			onClick={handleContainerClick}>
			{/* Close button */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					handleClose();
				}}
				className="absolute top-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-all cursor-pointer">
				<X className="h-5 w-5" />
			</button>

			<div
				className="relative w-full max-w-2xl max-h-[90vh] mx-4"
				onClick={(e) => e.stopPropagation()}>
				{/* Progress bars row */}
				<div className="absolute -top-8 left-0 right-0 flex gap-1.5 z-10">
					{glimpses.map((g, idx) => (
						<div
							key={g._id}
							className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
							<div
								className="h-full rounded-full transition-all duration-100 ease-linear"
								style={{
									width:
										idx === currentIndex
											? `${progress}%`
											: idx < currentIndex
												? "100%"
												: "0%",
									backgroundColor: "white",
								}}
							/>
						</div>
					))}
				</div>

				{/* The glance media with slide animation */}
				<div
					className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl aspect-[9/16] max-h-[80vh]"
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseUp}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
					onTouchCancel={handleTouchEnd}
				>
					{/* Brightness gradient overlays for text contrast */}
					<div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none z-[5]" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-transparent pointer-events-none z-[5]" />

					{/* Author info overlay at top */}
					<div className="absolute top-4 left-4 z-10 flex items-center gap-3">
						<img
							src={currentGlance.author.profilePic?.url || ""}
							alt={currentGlance.author.fullName}
							className="h-10 w-10 rounded-full object-cover border-2 border-white/30 shadow-lg"
						/>
						<div>
							<p className="text-sm font-bold text-white drop-shadow-lg">
								{currentGlance.author.fullName}
							</p>
							<p className="text-[11px] text-white/80 drop-shadow-lg">
								@{currentGlance.author.username}
							</p>
						</div>
					</div>

					{/* Three-dots menu */}
					<div className="absolute top-4 right-4 z-10" ref={menuRef}>
						<button
							onClick={(e) => {
								e.stopPropagation();
								setShowMenu((prev) => !prev);
							}}
							className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-all cursor-pointer"
							title="More"
						>
							<MoreHorizontal className="h-5 w-5" />
						</button>

						{showMenu && (
							<div className="absolute top-10 right-0 min-w-[140px] bg-zinc-950 border border-white/10 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl">
								{/* Share option for everyone */}
								<button
									onClick={(e) => {
										e.stopPropagation();
										handleShare();
									}}
									className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
								>
									<Share2 className="h-4 w-4 text-zinc-400" />
									Share
								</button>
								{/* Delete option only for author */}
								{isAuthor && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleDelete();
										}}
										className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
									>
										<Trash2 className="h-4 w-4" />
										Delete
									</button>
								)}
							</div>
						)}
					</div>

					<AnimatePresence mode="popLayout" initial={false}>
						<motion.div
							key={currentGlance._id}
							initial={{
								opacity: 0,
								x: slideDirection === "right" ? 80 : -80,
								scale: 0.98,
							}}
							animate={{ opacity: 1, x: 0, scale: 1 }}
							exit={{
								opacity: 0,
								x: slideDirection === "right" ? -80 : 80,
								scale: 0.98,
							}}
							transition={{ duration: 0.2, ease: "easeOut" }}
						>
						{currentGlance.mediaType === "video" ? (
							<div className="relative">
								<video
									ref={videoRef}
									src={currentGlance.media.url}
									className="w-full h-full object-cover"
									autoPlay										muted
										playsInline
										draggable={false}
										onEnded={handleVideoEnded}
									/>
							</div>
						) : (
							<img
								src={currentGlance.media.url}
								alt=""
								className="w-full h-full object-cover"
								draggable={false}
							/>
						)}
						</motion.div>
					</AnimatePresence>

					{/* Pause overlay */}
					{isPaused && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
							<div className="rounded-full bg-white/20 px-6 py-3 backdrop-blur-sm">
								<p className="text-sm font-bold text-white">Paused</p>
							</div>
						</div>
					)}

					{/* Heart animation on reaction */}
					<AnimatePresence>
						{showHeartAnimation && (
							<motion.div
								initial={{ opacity: 0, scale: 0.3 }}
								animate={{ opacity: 1, scale: 1.2 }}
								exit={{ opacity: 0, scale: 1.5 }}
								transition={{ duration: 0.4, ease: "easeOut" }}
								className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
							>
								<Heart className="h-24 w-24 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" fill="#ef4444" />
							</motion.div>
						)}
					</AnimatePresence>

					{/* Tap hints on first load */}
					{progress < 5 && !isPaused && (
						<div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/40 z-10">
							Swipe or tap sides: navigate · Center: play/pause
						</div>
					)}
				</div>

				{/* Liked by text */}
				{(() => {
					const likedBy = getLikedByText();
					return likedBy ? (
						<div className="mt-3 text-center">
							<p className="text-[13px] text-white/60 font-medium">
								{likedBy}
							</p>
						</div>
					) : null;
				})()}

				{/* Bottom row: reactions & reply */}
				{!isAuthor && !showReplyInput && (
					<div className="flex items-center justify-center gap-4 mt-4">
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleReact();
							}}
							className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-4 py-2 text-[12px] md:text-sm font-bold text-white hover:bg-zinc-900 transition-all cursor-pointer shadow-lg"
							title={reactedByMe ? "Remove reaction" : "Like this glance"}
						>
							<Heart className={`h-4 w-4 ${reactedByMe ? "text-red-500" : "text-white/70"}`} fill={reactedByMe ? "#ef4444" : "none"} />
							<span>{reactedByMe ? "Liked" : "Like"}</span>
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								// Pause glance preview when opening reply
								setIsPaused(true);
								if (videoRef.current && !videoRef.current.paused) {
									videoRef.current.pause();
								}
								setShowReplyInput(true);
							}}
							className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-4 py-2 text-[12px] md:text-sm font-bold text-white hover:bg-zinc-900 transition-all cursor-pointer shadow-lg"
							title="Reply to this glance"
						>
							<MessageSquare className="h-4 w-4" />
							<span>Reply</span>
						</button>
					</div>
				)}

				{/* Reply input */}
				{!isAuthor && showReplyInput && (
					<div className="mt-4 w-full">
						<div className="flex items-center gap-2 rounded-full bg-black/60 border border-white/10 px-4 py-1.5 shadow-lg">
							<input
								ref={replyInputRef}
								type="text"
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && replyText.trim()) {
										handleSendReply();
									}
								}}
								placeholder="Send a message..."
								className="flex-1 bg-transparent text-white text-xs md:text-sm placeholder-zinc-500 outline-none py-2"
							/>
							<button
								onClick={(e) => {							e.stopPropagation();
							// Resume glance preview on cancel
							setIsPaused(false);
							if (videoRef.current && videoRef.current.paused && !videoRef.current.ended) {
								videoRef.current.play().catch(() => {});
							}
							setShowReplyInput(false);
							setReplyText("");
							}}
								className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer px-2"
							>
								Cancel
							</button>
							<button
								onClick={(e) => {
									e.stopPropagation();
									handleSendReply();
								}}
								disabled={isReplying || !replyText.trim()}
								className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
								title="Send reply"
							>
								{isReplying ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-3.5 w-3.5" />
								)}
							</button>
						</div>
					</div>
				)}

				{/* Views stats button for the creator */}
				{isAuthor && (
					<button
						onClick={() => setShowViewersList(true)}
						className="mt-4 mx-auto flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-4 py-2 text-[12px] md:text-sm font-bold text-white hover:bg-zinc-900 transition-all cursor-pointer shadow-lg w-fit"
					>
						<Eye className="h-4 w-4 text-violet-400" />
						<span>{currentGlance.viewers.length} {currentGlance.viewers.length === 1 ? "view" : "views"}</span>
					</button>
				)}

				{/* Viewers list popup */}
				{showViewersList && (
					<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-[320]" onClick={() => setShowViewersList(false)}>
						<div className="w-full max-w-xs bg-zinc-950 border border-white/10 rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
							<div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
								<h4 className="font-bold text-sm text-white">Viewed by <span className="text-violet-400">{currentGlance.viewers.length}</span></h4>
								<button onClick={() => setShowViewersList(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
								{filteredViewers.length === 0 ? (
									<p className="text-xs text-zinc-500 py-4 text-center">No views yet</p>
								) : (
									filteredViewers.map((v, idx) => {
										const viewerUser = typeof v.user === "object" ? v.user : null;
										if (!viewerUser) return null;
										const liked = hasReacted(viewerUser._id);
										return (
											<div key={idx} className="flex items-center gap-2.5">
												<img
													src={viewerUser.profilePic?.url || ""}
													alt={viewerUser.fullName}
													className="h-8 w-8 rounded-full object-cover border border-zinc-800"
												/>
												<div className="text-left min-w-0 flex-1">
													<p className="text-xs font-bold text-white truncate">{viewerUser.fullName}</p>
													<p className="text-[11px] text-zinc-500 truncate">@{viewerUser.username}</p>
												</div>
												{liked && (
													<Heart className="h-3.5 w-3.5 text-red-500 shrink-0" fill="#ef4444" />
												)}
											</div>
										);
									})
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body
	);
}
