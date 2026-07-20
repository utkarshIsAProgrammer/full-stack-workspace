import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Comment, CommentReaction } from "../types";
import {
	Reply,
	Smile,
	Heart,
	Pencil,
	Trash2,
	Check,
	X as XIcon,
	Copy,
	CornerDownLeft,
} from "lucide-react";
import UserAvatar from "./UserAvatar";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import { extractEmoji } from "../utils/validation";

interface CommentNodeProps {
	key?: React.Key;
	comment: Comment;
	user: User | null;
	onUserSelected: (username: string) => void;
	onReply: (commentId: string) => void;
	depth?: number;
	getRelativeDate: (date: string) => string;
	renderFormattedContent: (content: string) => React.ReactNode;
}

const QUICK_EMOJIS = [
	"👍",
	"❤️",
	"😂",
	"😮",
	"😢",
	"😠",
	"🎉",
	"🔥",
	"💀",
	"🙏",
];

export default function CommentNode({
	comment,
	user,
	onUserSelected,
	onReply,
	depth = 0,
	getRelativeDate,
	renderFormattedContent,
}: CommentNodeProps) {
	const [replies, setReplies] = useState<Comment[]>([]);
	const [loadingReplies, setLoadingReplies] = useState(false);
	const [showReplies, setShowReplies] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [repliesFetched, setRepliesFetched] = useState(false);
	const [localRepliesCount, setLocalRepliesCount] = useState<number>(
		comment.repliesCount ?? 0,
	);
	const [isEditing, setIsEditing] = useState(false);
	const [editText, setEditText] = useState(comment.content);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	// Local mirror of comment fields for realtime updates without parent re-render
	const [likesCount, setLikesCount] = useState(comment.likesCount);
	const [likedByMe, setLikedByMe] = useState(!!comment.likedByMe);
	const [reactions, setReactions] = useState<CommentReaction[]>(
		comment.reactions || [],
	);

	// Sync when comment prop changes (e.g. drawer re-opens)
	useEffect(() => {
		setLikesCount(comment.likesCount);
		setLikedByMe(!!comment.likedByMe);
		setReactions(comment.reactions || []);
		setRepliesFetched(false);
		setLocalRepliesCount(comment.repliesCount ?? 0);
		setEditText(comment.content);
		setIsEditing(false);
		setShowDeleteConfirm(false);
	}, [
		comment._id,
		comment.likesCount,
		comment.likedByMe,
		comment.reactions,
		comment.repliesCount,
		comment.content,
	]);

	// Auto load replies when showing replies or when the comment changes
	useEffect(() => {
		if (showReplies && replies.length === 0) {
			loadReplies();
		}
	}, [showReplies, comment._id]);

	// Direct listener for realtime comment like/unlike updates
	useEffect(() => {
		const handleLikeChanged = (
			e: CustomEvent<{ commentId: string; likesCount: number }>,
		) => {
			const { commentId: cid, likesCount: lc } = e.detail;
			if (cid === comment._id) {
				setLikesCount(lc);
			}
		};
		window.addEventListener(
			"postCommentLikeChanged",
			handleLikeChanged as EventListener,
		);
		return () =>
			window.removeEventListener(
				"postCommentLikeChanged",
				handleLikeChanged as EventListener,
			);
	}, [comment._id]);

	// Listen for realtime comment edits (if this comment is updated remotely)
	useEffect(() => {
		const handleCommentUpdated = (e: CustomEvent<{ comment: Comment }>) => {
			const { comment: updatedComment } = e.detail;
			if (updatedComment._id === comment._id) {
				setEditText(updatedComment.content);
			}
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
	}, [comment._id]);

	// Keep a ref mirroring showReplies so the event handler can read the latest value
	const showRepliesRef = useRef(showReplies);
	showRepliesRef.current = showReplies;

	// Listen for realtime replies added to this comment
	useEffect(() => {
		const handleReplyAdded = (
			e: CustomEvent<{ parentCommentId: string; reply: Comment }>,
		) => {
			const { parentCommentId, reply } = e.detail;
			if (parentCommentId === comment._id) {
				setReplies((prev) => {
					if (prev.some((r) => r._id === reply._id)) return prev;
					return [...prev, reply];
				});
				setLocalRepliesCount((prev) => prev + 1);

				const wasShowing = showRepliesRef.current;
				// Auto-show replies so the user sees it right away
				setShowReplies(true);

				// If replies weren't already visible, fetch the full list from server
				// so pre-existing replies from other users also appear, not just this one
				if (!wasShowing) {
					loadReplies();
				}
			}
		};
		window.addEventListener(
			"commentReplyAdded",
			handleReplyAdded as EventListener,
		);
		return () =>
			window.removeEventListener(
				"commentReplyAdded",
				handleReplyAdded as EventListener,
			);
	}, [comment._id]);

	// Listen for realtime comment deletion (remove from replies list)
	useEffect(() => {
		const handleCommentDeleted = (
			e: CustomEvent<{ commentId: string }>,
		) => {
			const { commentId } = e.detail;
			if (commentId === comment._id) {
				// The parent will handle removal via re-render with updated comments list
				// For replies, we just mark locally
			}
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
	}, [comment._id]);

	// Direct listener for realtime comment emoji reaction updates
	useEffect(() => {
		const handleReactionChanged = (
			e: CustomEvent<{
				commentId: string;
				reaction: any;
				type: "add" | "remove";
			}>,
		) => {
			const { commentId: cid, reaction, type } = e.detail;
			if (cid !== comment._id) return;
			setReactions((prev) => {
				if (type === "add" && reaction) {
					// Remove ALL previous reactions by this sender, then add new one
					const senderId =
						typeof reaction.sender === "string"
							? reaction.sender
							: reaction.sender?._id;
					const filtered = prev.filter((r) => {
						const sId =
							typeof r.sender === "string"
								? r.sender
								: r.sender?._id;
						return sId !== senderId;
					});
					return [...filtered, reaction];
				} else if (type === "remove" && reaction) {
					// Remove only the reaction matching this sender + emoji
					const senderId =
						typeof reaction.sender === "string"
							? reaction.sender
							: reaction.sender?._id;
					const filtered = prev.filter((r) => {
						const sId =
							typeof r.sender === "string"
								? r.sender
								: r.sender?._id;
						return !(
							sId === senderId && r.emoji === reaction.emoji
						);
					});
					return filtered;
				}
				return prev;
			});
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
	}, [comment._id]);

	const loadReplies = async () => {
		setLoadingReplies(true);
		try {
			const res = await apiFetch(`/api/comments/replies/${comment._id}`);
			if (!res.ok)
				throw new Error(`Failed to load replies: ${res.status}`);
			const data = await res.json();
			if (data.success) {
				setReplies(data.replies || []);
				setRepliesFetched(true);
				setLocalRepliesCount((data.replies || []).length);
			}
		} catch (e) {
			logger.error(e);
			setReplies([]);
			setRepliesFetched(true);
		} finally {
			setLoadingReplies(false);
		}
	};

	// Determine if replies button should be shown
	// Don't show if we already fetched and found nothing
	// Use actual loaded count after fetch, otherwise use prop
	const effectiveRepliesCount = repliesFetched
		? localRepliesCount
		: (comment.repliesCount ?? 0);
	const hasReplies =
		replies.length > 0 || (!repliesFetched && effectiveRepliesCount > 0);

	const handleLikeToggle = async () => {
		if (!user) return;
		const prevLiked = likedByMe;
		const prevCount = likesCount;

		// Optimistic update
		setLikedByMe(!prevLiked);
		setLikesCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

		try {
			const res = await apiFetch(`/api/likes/comment/${comment._id}`, {
				method: "POST",
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				// Rollback
				setLikedByMe(prevLiked);
				setLikesCount(prevCount);
			}
		} catch (e) {
			logger.error("Failed to toggle comment like", e);
			setLikedByMe(prevLiked);
			setLikesCount(prevCount);
		}
	};

	const handleReaction = async (emoji: string) => {
		if (!user) return;

		// 1. Optimistic UI update
		const userId = user._id;
		const existingIndex = (reactions || []).findIndex((r) => {
			const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
			return sId === userId && r.emoji === emoji;
		});

		let nextReactions = [...(reactions || [])];
		if (existingIndex >= 0) {
			// Toggle off
			nextReactions.splice(existingIndex, 1);
		} else {
			// Toggle off any other reaction by this sender first
			nextReactions = nextReactions.filter((r) => {
				const sId =
					typeof r.sender === "string" ? r.sender : r.sender?._id;
				return sId !== userId;
			});
			// Add new reaction
			nextReactions.push({
				_id: Date.now().toString(), // temp ID
				emoji,
				sender: {
					_id: user._id,
					username: user.username,
					fullName: user.fullName,
					profilePic: user.profilePic,
				},
				createdAt: new Date().toISOString(),
			} as any);
		}

		setReactions(nextReactions);
		setShowEmojiPicker(false);

		try {
			const res = await apiFetch(
				`/api/comments/${comment._id}/reactions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ emoji }),
				},
			);
			const data = await res.json();
			if (res.ok && data.success && data.reactions) {
				// 2. Sync with backend source of truth
				setReactions(data.reactions);
			} else {
				logger.error("Failed to react to comment");
				// Revert
				setReactions(reactions);
			}
		} catch (e) {
			logger.error("Failed to react to comment", e);
			// Revert
			setReactions(reactions);
		}
	};

	const handleEdit = async () => {
		if (!user || !editText.trim()) return;
		try {
			const res = await apiFetch(`/api/comments/${comment._id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: editText.trim() }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setIsEditing(false);
			}
		} catch (e) {
			logger.error("Failed to edit comment", e);
		}
	};

	const handleDelete = async () => {
		if (!user) return;
		try {
			const res = await apiFetch(`/api/comments/${comment._id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setShowDeleteConfirm(false);
				setContextMenu(null);
				// Notify parent to remove this comment from the list
				window.dispatchEvent(
					new CustomEvent("commentDeleted", {
						detail: { commentId: comment._id },
					}),
				);
			}
		} catch (e) {
			logger.error("Failed to delete comment", e);
		}
	};

	// Context menu state (like Chat.tsx)
	const [contextMenu, setContextMenu] = useState<{
		comment: Comment;
		x: number;
		y: number;
	} | null>(null);

	// Mobile detection for responsive context menu
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia("(max-width: 767px)");
		setIsMobile(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	// Close context menu on outside click
	useEffect(() => {
		const handleClick = () => setContextMenu(null);
		window.addEventListener("click", handleClick);
		return () => window.removeEventListener("click", handleClick);
	}, []);

	// Swipe-to-reply state
	const [showSwipeBadge, setShowSwipeBadge] = useState(false);
	const swipeBarRef = useRef<HTMLDivElement>(null);
	const swipeBadgeRef = useRef<HTMLDivElement>(null);
	const swipeOffsetRef = useRef(0);
	const touchStartXRef = useRef(0);
	const touchStartYRef = useRef(0);
	const isSwipingRef = useRef(false);

	// Double-tap to like
	const lastTapTimeRef = useRef(0);

	// Long-press timer
	const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleContextMenu = (
		e:
			| React.MouseEvent
			| { clientX: number; clientY: number; preventDefault: () => void },
		c: Comment,
	) => {
		e.preventDefault();
		const x = Math.min(
			Math.max(10, (e as any).clientX || 0),
			window.innerWidth - 10,
		);
		const y = Math.min(
			Math.max(10, (e as any).clientY || 0),
			window.innerHeight - 10,
		);
		setContextMenu({ comment: c, x, y });
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		touchStartXRef.current = touch.clientX;
		touchStartYRef.current = touch.clientY;
		isSwipingRef.current = false;
		swipeOffsetRef.current = 0;
		setShowSwipeBadge(false);
		if (swipeBarRef.current)
			swipeBarRef.current.style.transform = "translateX(-6px)";

		// Double-tap detection
		const now = Date.now();
		if (lastTapTimeRef.current && now - lastTapTimeRef.current < 300) {
			// Double tap! Trigger like
			handleLikeToggle();
			lastTapTimeRef.current = 0;
			return;
		}
		lastTapTimeRef.current = now;

		touchTimerRef.current = setTimeout(() => {
			// Long press context menu (only if not swiping)
			if (!isSwipingRef.current) {
				if (touch) {
					const containerRect =
						containerRef.current?.getBoundingClientRect();
					const x = containerRect
						? containerRect.left
						: touch.clientX;
					const y = containerRect
						? containerRect.bottom + 4
						: touch.clientY;
					handleContextMenu(
						{
							clientX: x,
							clientY: y,
							preventDefault: () => {},
						} as any,
						comment,
					);
				}
			}
		}, 500);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		if (!touch) return;
		const deltaX = touch.clientX - touchStartXRef.current;
		const deltaY = touch.clientY - touchStartYRef.current;

		// Only start swipe if horizontal movement exceeds vertical by enough margin
		if (
			!isSwipingRef.current &&
			Math.abs(deltaX) > 15 &&
			Math.abs(deltaX) > Math.abs(deltaY) * 1.5
		) {
			isSwipingRef.current = true;
			if (touchTimerRef.current) {
				clearTimeout(touchTimerRef.current);
				touchTimerRef.current = null;
			}
		}

		if (isSwipingRef.current) {
			// Clamp swipe offset: rightwards only, max 100px
			const offset = Math.min(Math.max(0, deltaX), 100);
			swipeOffsetRef.current = offset;
			// Direct CSS transform for 60fps — no React re-render, no transition lag
			if (swipeBarRef.current) {
				swipeBarRef.current.style.transition = "none";
				swipeBarRef.current.style.transform = `translateX(${offset - 6}px)`;
				swipeBarRef.current.style.opacity = offset > 0 ? "1" : "0";
			}
			if (offset > 20 && !showSwipeBadge) {
				setShowSwipeBadge(true);
			} else if (offset <= 20 && showSwipeBadge) {
				setShowSwipeBadge(false);
			}
		}
	};

	const handleTouchEnd = () => {
		if (touchTimerRef.current) {
			clearTimeout(touchTimerRef.current);
			touchTimerRef.current = null;
		}

		if (isSwipingRef.current && swipeOffsetRef.current > 60) {
			// Trigger reply
			onReply(comment._id);
		}

		swipeOffsetRef.current = 0;
		setShowSwipeBadge(false);
		if (swipeBarRef.current) {
			// Restore transition for smooth snap-back animation
			swipeBarRef.current.style.transition = "";
			swipeBarRef.current.style.transform = "translateX(-6px)";
			swipeBarRef.current.style.opacity = "0";
		}
		isSwipingRef.current = false;
		touchStartXRef.current = 0;
		touchStartYRef.current = 0;
	};

	// Copy comment text
	const handleCopyText = async () => {
		const text = comment.content || (comment as any).text || "";
		if (text) {
			await navigator.clipboard.writeText(text);
		}
		setContextMenu(null);
	};

	// Native emoji input ref
	const emojiInputRef = useRef<HTMLInputElement>(null);
	const [customEmojiInput, setCustomEmojiInput] = useState("");

	// Group reactions by emoji (max 10 unique)
	const getGroupedReactions = (reacts?: CommentReaction[]) => {
		if (!reacts || reacts.length === 0) return {};
		const entries = Object.entries(
			reacts.reduce(
				(acc, r) => {
					if (!acc[r.emoji])
						acc[r.emoji] = { count: 0, hasReacted: false };
					acc[r.emoji].count++;
					const sId =
						typeof r.sender === "string" ? r.sender : r.sender?._id;
					if (sId === user?._id) acc[r.emoji].hasReacted = true;
					return acc;
				},
				{} as Record<string, { count: number; hasReacted: boolean }>,
			),
		);
		// Sort by most reacted first, limit to 10
		return Object.fromEntries(entries.slice(0, 10));
	};

	const groupedReactions = getGroupedReactions(reactions);

	return (
		<div
			ref={containerRef}
			className={`relative overflow-hidden space-y-2 ${depth > 0 ? "ml-6 pl-4 border-l border-zinc-800/80" : ""}`}
			onContextMenu={(e) => {
				const containerRect =
					containerRef.current?.getBoundingClientRect();
				const x = containerRect ? containerRect.left : e.clientX;
				const y = containerRect ? containerRect.bottom + 4 : e.clientY;
				handleContextMenu(
					{
						clientX: x,
						clientY: y,
						preventDefault: () => e.preventDefault(),
					} as any,
					comment,
				);
			}}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
			onTouchMove={handleTouchMove}>
			{/* Swipe-to-reply visual indicator */}
			<div
				ref={swipeBarRef}
				className="absolute inset-y-0 left-0 w-1 bg-white/20 rounded-r-full pointer-events-none"
				style={{
					transform: "translateX(-4px)",
					opacity: 0,
					transition:
						"transform 180ms ease-out, opacity 180ms ease-out",
				}}
			/>
			{/* Reply badge on swipe */}
			{showSwipeBadge && (
				<div
					ref={swipeBadgeRef}
					className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
					<div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
						<CornerDownLeft className="h-3 w-3 text-white" />
						<span className="text-[9px] font-bold text-white uppercase tracking-wider">
							Reply
						</span>
					</div>
				</div>
			)}
			<div className="rounded-2xl border border-white/5 bg-zinc-900/15 p-3.5 space-y-2 relative backdrop-blur-md hover:border-white/10 hover:bg-zinc-900/25 transition-all duration-350">
				{/* Delete Confirmation Overlay */}
				{showDeleteConfirm && (
					<div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-950/95 backdrop-blur-md">
						<div className="text-center space-y-3 px-4">
							<p className="text-[12px] font-semibold text-zinc-300">
								Delete this comment permanently?
							</p>
							<div className="flex items-center justify-center gap-2">
								<button
									onClick={handleDelete}
									className="rounded-full bg-red-500/90 px-3.5 py-1.5 text-[12px] md:text-sm font-bold text-white hover:bg-red-500 transition-colors cursor-pointer">
									Delete
								</button>
								<button
									onClick={() => setShowDeleteConfirm(false)}
									className="rounded-full bg-zinc-800 px-3.5 py-1.5 text-[12px] md:text-sm font-bold text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer">
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<UserAvatar
							src={comment.author.profilePic?.url}
							alt={comment.author.fullName}
							onClick={() =>
								onUserSelected(comment.author.username)
							}
							className="h-5.5 w-5.5 rounded-full object-cover border border-white/5 cursor-pointer shadow-sm"
						/>
						<div className="flex items-center gap-1.5 flex-wrap">
							<h5
								onClick={() =>
									onUserSelected(comment.author.username)
								}
								className="font-sans text-[12px] font-bold text-white leading-none cursor-pointer hover:text-white/80 transition-colors">
								{comment.author.fullName}
							</h5>
							<span className="text-[11px] text-zinc-500 font-medium">
								@{comment.author.username}
							</span>
							<span className="text-[9px] text-zinc-650 font-bold">•</span>
							<span className="text-[11px] text-zinc-500 font-medium">
								{getRelativeDate(comment.createdAt)}
								{comment.isEdited && (
									<span className="ml-1 italic opacity-60">
										(edited)
									</span>
								)}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{user &&
							comment.author._id === user._id &&
							!isEditing && (
								<>
									<button
										onClick={() => {
											setIsEditing(true);
											setEditText(comment.content);
										}}
										className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
										title="Edit comment">
										<Pencil className="h-3 w-3" />
									</button>
									<button
										onClick={() =>
											setShowDeleteConfirm(true)
										}
										className="text-zinc-500 hover:text-red-450 transition-colors cursor-pointer"
										title="Delete comment">
										<Trash2 className="h-3 w-3" />
									</button>
								</>
							)}
					</div>
				</div>

				{isEditing ? (
					<div className="space-y-2">
						<textarea
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							className="w-full rounded-full border border-white/5 bg-zinc-950/60 px-2.5 py-1.5 text-[12px] md:text-sm text-zinc-200 placeholder-zinc-550 outline-none focus:border-white/15 focus:bg-zinc-950/80 resize-none transition-all"
							rows={2}
							maxLength={1000}
							spellCheck={false}
							autoFocus
						/>
						<div className="flex items-center gap-2">
							<button
								onClick={handleEdit}
								className="flex items-center gap-1 rounded-full bg-white text-black px-3.5 py-1.5 text-[12px] md:text-sm font-bold hover:bg-zinc-200 transition-colors cursor-pointer">
								<Check className="h-3 w-3" /> Save
							</button>
							<button
								onClick={() => {
									setIsEditing(false);
									setEditText(comment.content);
								}}
								className="flex items-center gap-1 rounded-full bg-zinc-800 px-3.5 py-1.5 text-[12px] md:text-sm font-bold text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer">
								<XIcon className="h-3 w-3" /> Cancel
							</button>
						</div>
					</div>
				) : (
					<div className="space-y-1">
						<p className="text-[13px] text-zinc-300 select-text leading-relaxed font-sans pr-2">
							{renderFormattedContent(
								comment.content.length > 240 && !isExpanded
									? comment.content.slice(0, 240) + "..."
									: comment.content
							)}
						</p>
						{comment.content.length > 240 && (
							<button
								onClick={() => setIsExpanded(!isExpanded)}
								className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer block mt-0.5">
								{isExpanded ? "See less" : "See more"}
							</button>
						)}
					</div>
				)}

				{/* Emoji Reactions Row */}
				{Object.keys(groupedReactions).length > 0 && (
					<motion.div
						className="flex items-center gap-1.5 flex-wrap pt-0.5"
						layout>
						{Object.entries(groupedReactions).map(
							([emoji, data]) => (
								<motion.button
									key={emoji}
									layout
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{
										type: "spring",
										stiffness: 400,
										damping: 25,
									}}
									onClick={() => handleReaction(emoji)}
									className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] md:text-sm border transition-colors cursor-pointer ${
										data.hasReacted
											? "bg-white/10 border-white/20 text-white"
											: "bg-white/3 border-white/5 text-zinc-400 hover:bg-white/5"
									}`}>
									<span>{emoji}</span>
									<span className="text-[9px] font-bold">
										{data.count}
									</span>
								</motion.button>
							),
						)}
					</motion.div>
				)}

				{/* Action Bar */}
				<div className="flex items-center gap-4 pt-1 border-t border-white/3">
					{user && (
						<button
							onClick={handleLikeToggle}
							className="flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-red-450 transition-colors cursor-pointer group">
							<motion.span
								key={likedByMe ? "liked" : "unliked"}
								initial={{ scale: likedByMe ? 1.25 : 1 }}
								animate={{ scale: 1 }}
								transition={{
									type: "spring",
									stiffness: 400,
									damping: 15,
								}}>
								<Heart
									className={`h-3 w-3 transition-colors ${
										likedByMe
											? "fill-red-500 text-red-500"
											: "group-hover:text-red-400"
									}`}
								/>
							</motion.span>
							<span className={likedByMe ? "text-red-400 font-bold" : ""}>
								{likesCount}
							</span>
						</button>
					)}

					{user && (
						<button
							onClick={() => onReply(comment._id)}
							className="flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-white transition-colors cursor-pointer">
							<Reply className="h-3 w-3" /> Reply
						</button>
					)}

					{user && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								const btnRect = (
									e.currentTarget as HTMLElement
								).getBoundingClientRect();
								handleContextMenu(
									{
										clientX: btnRect.left,
										clientY: btnRect.bottom + 4,
										preventDefault: () => {},
									} as any,
									comment,
								);
							}}
							className="flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-white transition-colors cursor-pointer">
							<Smile className="h-3 w-3" /> React
						</button>
					)}

					{(showReplies || hasReplies) && (
						<button
							onClick={() => setShowReplies(!showReplies)}
							className={`text-[11px] font-semibold transition-colors cursor-pointer ml-auto ${
								showReplies
									? "text-white"
									: "text-zinc-400 hover:text-white"
							}`}>
							{showReplies
								? "Hide Replies"
								: `View ${effectiveRepliesCount} ${effectiveRepliesCount === 1 ? "Reply" : "Replies"}`}
						</button>
					)}
				</div>
			</div>

			{showReplies && (
				<div className="space-y-2 mt-2">
					{loadingReplies ? (
						<div className="flex items-center gap-2 text-[11px] text-zinc-500 ml-6">
							<span className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300"></span>
							Loading replies...
						</div>
					) : replies.length === 0 ? (
						<div className="text-[11px] text-zinc-500 ml-6 italic">
							No replies yet.
						</div>
					) : (
						replies.map((reply) => (
							<CommentNode
								key={reply._id}
								comment={reply}
								user={user}
								onUserSelected={onUserSelected}
								onReply={onReply}
								depth={depth + 1}
								getRelativeDate={getRelativeDate}
								renderFormattedContent={renderFormattedContent}
							/>
						))
					)}
				</div>
			)}

			{/* Context Menu — mobile bottom sheet or desktop popover */}
			<AnimatePresence>
				{contextMenu && contextMenu.comment._id === comment._id && (
					<>
						{isMobile ? (
							<>
								{/* Mobile Backdrop */}
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[300] pointer-events-auto"
									onClick={() => setContextMenu(null)}
								/>
								{/* Mobile Bottom Sheet */}
								<motion.div
									initial={{ y: "100%" }}
									animate={{ y: 0 }}
									exit={{ y: "100%" }}
									transition={{
										type: "spring",
										damping: 25,
										stiffness: 250,
									}}
									className="fixed bottom-0 inset-x-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[310] overflow-hidden pb-8 max-w-md mx-auto pointer-events-auto"
									onClick={(e) => e.stopPropagation()}>
									{/* Drag Handle */}
									<div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-3" />

									{/* Emoji reactions row */}
									<div className="flex justify-between px-4 py-1.5 border-b border-zinc-800/60 overflow-x-auto gap-2 scrollbar-none">
										{[
											"👍",
											"❤️",
											"😂",
											"😮",
											"😢",
											"😠",
										].map((emoji) => (
											<button
												key={emoji}
												onClick={() => {
													handleReaction(emoji);
													setContextMenu(null);
												}}
												className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl hover:bg-zinc-800 active:scale-90 transition-all shrink-0 cursor-pointer">
												{emoji}
											</button>
										))}
										<button
											onClick={() => {
												setShowEmojiPicker(true);
												setContextMenu(null);
											}}
											className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg hover:bg-zinc-800 active:scale-90 transition-all shrink-0 bg-zinc-800/40 border border-zinc-700/30 cursor-pointer">
											<Smile className="h-4.5 w-4.5 text-zinc-300" />
										</button>
									</div>

									{/* Actions */}
									<div className="p-3 space-y-0.5">
										<button
											onClick={() => {
												onReply(comment._id);
												setContextMenu(null);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
											<CornerDownLeft className="h-3.5 w-3.5 text-zinc-400" />
											Reply
										</button>
										<button
											onClick={handleCopyText}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
											<Copy className="h-3.5 w-3.5 text-zinc-400" />
											Copy Text
										</button>
										{user &&
											comment.author._id === user._id && (
												<>
													<button
														onClick={() => {
															setIsEditing(true);
															setEditText(
																comment.content,
															);
															setContextMenu(
																null,
															);
														}}
														className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
														<Pencil className="h-3.5 w-3.5 text-zinc-400" />
														Edit
													</button>
													<button
														onClick={() => {
															setShowDeleteConfirm(
																true,
															);
															setContextMenu(
																null,
															);
														}}
														className="w-full px-3 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 cursor-pointer">
														<Trash2 className="h-3.5 w-3.5 text-red-400" />
														Delete
													</button>
												</>
											)}
										<button
											onClick={() => setContextMenu(null)}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 border border-zinc-800/50 mt-1.5 cursor-pointer">
											<XIcon className="h-3.5 w-3.5 text-zinc-400" />
											Cancel
										</button>
									</div>
								</motion.div>
							</>
						) : (
							/* Desktop Context Menu */
							<motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.9 }}
								style={{
									position: "fixed",
									left: Math.min(
										Math.max(20, contextMenu.x),
										window.innerWidth - 340,
									),
									top: Math.min(
										Math.max(20, contextMenu.y - 120),
										window.innerHeight - 260,
									),
									zIndex: 1000,
								}}
								className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
								onClick={(e) => e.stopPropagation()}>
								<div className="flex flex-wrap gap-1 p-2 border-b border-zinc-800">
									{["👍", "❤️", "😂", "😮", "😢", "😠"].map(
										(emoji) => (
											<button
												key={emoji}
												onClick={() => {
													handleReaction(emoji);
													setContextMenu(null);
												}}
												className="w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-zinc-800 transition-all cursor-pointer">
												{emoji}
											</button>
										),
									)}
									<button
										onClick={() => {
											setShowEmojiPicker(true);
											setContextMenu(null);
										}}
										className="w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-zinc-800 transition-all cursor-pointer">
										<Smile className="h-4 w-4" />
									</button>
								</div>

								<div className="p-1">
									<button
										onClick={() => {
											onReply(comment._id);
											setContextMenu(null);
										}}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
										<CornerDownLeft className="h-3.5 w-3.5" />
										Reply
									</button>
									<button
										onClick={handleCopyText}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
										<Copy className="h-3.5 w-3.5" />
										Copy Text
									</button>
									{user &&
										comment.author._id === user._id && (
											<>
												<button
													onClick={() => {
														setIsEditing(true);
														setEditText(
															comment.content,
														);
														setContextMenu(null);
													}}
													className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
													<Pencil className="h-3.5 w-3.5" />
													Edit
												</button>
												<button
													onClick={() => {
														setShowDeleteConfirm(
															true,
														);
														setContextMenu(null);
													}}
													className="w-full px-3 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 cursor-pointer">
													<Trash2 className="h-3.5 w-3.5" />
													Delete
												</button>
											</>
										)}
									<button
										onClick={() => setContextMenu(null)}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
										<XIcon className="h-3.5 w-3.5" />
										Cancel
									</button>
								</div>
							</motion.div>
						)}
					</>
				)}
			</AnimatePresence>

			{/* Native Emoji Picker (for the "more emojis" button) */}
			<AnimatePresence>
				{showEmojiPicker && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4"
						onClick={() => {
							setShowEmojiPicker(false);
							setCustomEmojiInput("");
						}}>
						<motion.div
							initial={{ scale: 0.9, y: 20 }}
							animate={{ scale: 1, y: 0 }}
							exit={{ scale: 0.9, y: 20 }}
							onClick={(e) => e.stopPropagation()}
							className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-3 w-full max-w-xs shadow-2xl">
							<div className="flex items-center justify-between mb-2">
								<h4 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">
									Pick an Emoji
								</h4>
								<button
									onClick={() => {
										setShowEmojiPicker(false);
										setCustomEmojiInput("");
									}}>
									<XIcon className="h-3 w-3 text-zinc-500 hover:text-white" />
								</button>
							</div>
							<input
								ref={emojiInputRef}
								type="text"
								// inputMode={"emoji" as any} is valid HTML but React types don't include it yet
								inputMode={"emoji" as any}
								value={customEmojiInput}
								onChange={(e) => {
									const val = e.target.value;
									setCustomEmojiInput(val);
									if (val.trim()) {
										const emoji =
											extractEmoji(val) ||
											val.trim().charAt(0);
										handleReaction(emoji);
										setShowEmojiPicker(false);
										setCustomEmojiInput("");
									}
								}}
								className="w-full rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[12px] md:text-sm text-white outline-none focus:border-white text-center"
								autoFocus
								autoComplete="off"
								placeholder="Tap for emoji"
							/>
							<div className="mt-2">
								<p className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 text-center">
									Or pick one
								</p>
								<div className="flex flex-wrap gap-1 justify-center">
									{QUICK_EMOJIS.map((emoji) => (
										<button
											key={emoji}
											onClick={() => {
												handleReaction(emoji);
												setShowEmojiPicker(false);
											}}
											className="w-7 h-7 rounded-lg flex items-center justify-center text-base hover:bg-zinc-800 transition-all hover:scale-110 cursor-pointer">
											{emoji}
										</button>
									))}
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
