import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	Bell,
	Heart,
	MessageSquare,
	UserPlus,
	Repeat2,
	Bookmark,
	AtSign,
	SmilePlus,
	AlertCircle,
	Clock,
	X,
	Eye,
	EyeOff,
	ExternalLink,
	Copy,
	Trash2,
} from "lucide-react";
import { Socket } from "socket.io-client";
import { Notification, User } from "../types";
import GlassCard from "./GlassCard";
import UserAvatar from "./UserAvatar";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface NotificationsProps {
	user: User | null;
	socket: Socket | null;
	onPostClick: (slug: string) => void;
	onUserClick: (username: string) => void;
	onBadgeReset: () => void;
}

export default function Notifications({
	user,
	socket,
	onPostClick,
	onUserClick,
	onBadgeReset,
}: NotificationsProps) {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchNotifications = async () => {
		setLoading(true);
		try {
			const res = await apiFetch("/api/notifications");
			const data = await res.json();
			if (res.ok && data.success) {
				setNotifications(data.notifications || []);
				onBadgeReset(); // Mark badge alerts read on load
			} else {
				setError(data.message || "Failed to load alerts.");
			}
		} catch (e) {
			setError("Lost connection to server.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchNotifications();
	}, [user]);

	// Listen for real-time notifications via socket
	useEffect(() => {
		if (!socket) return;

		const handleNewNotification = (notification: Notification) => {
			setNotifications((prev) => {
				// Prevent duplicates
				if (prev.some((n) => n._id === notification._id)) return prev;
				return [notification, ...prev];
			});
		};

		socket.on("notification", handleNewNotification);

		return () => {
			socket.off("notification", handleNewNotification);
		};
	}, [socket]);

	// Mark all notifications as read
	const handleMarkAllRead = async () => {
		try {
			const res = await apiFetch("/api/notifications/read", {
				method: "PUT",
			});
			if (res.ok) {
				setNotifications((prev) =>
					prev.map((n) => ({ ...n, isRead: true })),
				);
			}
		} catch (e) {
			logger.error(e);
		}
	};

	// Mark single as read
	const handleMarkSingleRead = async (id: string) => {
		try {
			const res = await apiFetch(`/api/notifications/${id}/read`, {
				method: "PUT",
			});
			if (res.ok) {
				setNotifications((prev) =>
					prev.map((n) =>
						n._id === id ? { ...n, isRead: true } : n,
					),
				);
			}
		} catch (e) {
			logger.error(e);
		}
	};

	const handleClearAll = async () => {
		try {
			const res = await apiFetch("/api/notifications", {
				method: "DELETE",
			});
			if (res.ok) {
				setNotifications([]);
			}
		} catch (e) {
			logger.error(e);
		}
	};

	const handleDeleteSingle = async (id: string) => {
		try {
			const res = await apiFetch(`/api/notifications/${id}`, {
				method: "DELETE",
			});
			if (res.ok) {
				setNotifications((prev) => prev.filter((n) => n._id !== id));
				setContextMenu(null);
			}
		} catch (e) {
			// console.error(e);
		}
	};

	// Context menu state (like CommentNode & Chat)
	const [contextMenu, setContextMenu] = useState<{
		notif: Notification;
		x: number;
		y: number;
	} | null>(null);

	// Mobile detection
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

	// Long-press timer ref
	const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Swipe-to-open-post gesture state (ref-based for 60fps)
	const [showSwipeBadge, setShowSwipeBadge] = useState(false);
	const swipeBarRef = useRef<HTMLDivElement>(null);
	const swipeOffsetRef = useRef(0);
	const swipeTouchStartXRef = useRef(0);
	const swipeTouchStartYRef = useRef(0);
	const isSwipingNotifRef = useRef(false);

	const handleContextMenuOpen = (
		e:
			| React.MouseEvent
			| {
					clientX: number;
					clientY: number;
					preventDefault: () => void;
					stopPropagation?: () => void;
			  },
		notif: Notification,
	) => {
		e.preventDefault();
		if (e.stopPropagation) e.stopPropagation();
		const x = Math.min(
			Math.max(10, (e as any).clientX || 0),
			window.innerWidth - 10,
		);
		const y = Math.min(
			Math.max(10, (e as any).clientY || 0),
			window.innerHeight - 10,
		);
		setContextMenu({ notif, x, y });
	};

	// Integrated touch handler — handles swipe-to-open AND long-press context menu
	let touchNotifRef: Notification | null = null;

	const handleTouchStart = (e: React.TouchEvent, notif: Notification) => {
		const touch = e.touches[0];
		touchNotifRef = notif;
		swipeTouchStartXRef.current = touch.clientX;
		swipeTouchStartYRef.current = touch.clientY;
		isSwipingNotifRef.current = false;
		swipeOffsetRef.current = 0;
		setShowSwipeBadge(false);
		if (swipeBarRef.current) {
			swipeBarRef.current.style.transform = "translateX(-6px)";
			swipeBarRef.current.style.opacity = "0";
		}

		touchTimerRef.current = setTimeout(() => {
			if (!isSwipingNotifRef.current && touch) {
				handleContextMenuOpen(
					{
						clientX: touch.clientX,
						clientY: touch.clientY,
						preventDefault: () => {},
						stopPropagation: () => {},
					} as any,
					notif,
				);
			}
		}, 500);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		if (!touch) return;
		const deltaX = touch.clientX - swipeTouchStartXRef.current;
		const deltaY = touch.clientY - swipeTouchStartYRef.current;

		// Check if horizontal swipe
		if (
			!isSwipingNotifRef.current &&
			Math.abs(deltaX) > 15 &&
			Math.abs(deltaX) > Math.abs(deltaY) * 1.5
		) {
			isSwipingNotifRef.current = true;
			if (touchTimerRef.current) {
				clearTimeout(touchTimerRef.current);
				touchTimerRef.current = null;
			}
		}

		if (isSwipingNotifRef.current) {
			const offset = Math.min(Math.max(0, deltaX), 80);
			swipeOffsetRef.current = offset;
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

		if (
			isSwipingNotifRef.current &&
			swipeOffsetRef.current > 50 &&
			touchNotifRef
		) {
			const notif = touchNotifRef;
			if (notif.post) {
				onPostClick(notif.post.slug);
			} else if (notif.sender) {
				onUserClick(notif.sender.username);
			}
		}

		swipeOffsetRef.current = 0;
		setShowSwipeBadge(false);
		if (swipeBarRef.current) {
			swipeBarRef.current.style.transition = "";
			swipeBarRef.current.style.transform = "translateX(-6px)";
			swipeBarRef.current.style.opacity = "0";
		}
		isSwipingNotifRef.current = false;
		swipeTouchStartXRef.current = 0;
		swipeTouchStartYRef.current = 0;
		touchNotifRef = null;
	};

	// Copy notification text
	const handleCopyNotifText = (notif: Notification) => {
		let text = notif.sender?.fullName || "";
		const details = getNotifDetails(notif.type);
		text += ` ${details.text}`;
		if (notif.post?.title) text += `: ${notif.post.title}`;
		if (notif.comment?.content) text += `: "${notif.comment.content}"`;
		navigator.clipboard.writeText(text).catch(() => {});
		setContextMenu(null);
	};

	// Icon type mapping

	// Icon type mapping
	const getNotifDetails = (type: string) => {
		switch (type) {
			case "like":
				return {
					icon: Heart,
					color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30",
					text: "liked your post",
				};
			case "comment":
				return {
					icon: MessageSquare,
					color: "text-zinc-600 bg-zinc-800/20 border-zinc-800",
					text: "commented on your post",
				};
			case "follow":
				return {
					icon: UserPlus,
					color: "text-zinc-400 bg-zinc-900/20 border-zinc-800",
					text: "started following you",
				};
			case "repost":
				return {
					icon: Repeat2,
					color: "text-zinc-400 bg-zinc-900/20 border-zinc-800",
					text: "reposted your post",
				};
			case "save":
				return {
					icon: Bookmark,
					color: "text-zinc-400 bg-zinc-900/20 border-zinc-800",
					text: "bookmarked your post",
				};
			case "mention":
				return {
					icon: AtSign,
					color: "text-zinc-600 bg-zinc-800/20 border-zinc-800",
					text: "mentioned you inside a post thread",
				};
			case "reaction":
				return {
					icon: SmilePlus,
					color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30",
					text: "reacted to your comment",
				};
			case "message_reply":
				return {
					icon: MessageSquare,
					color: "text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/30",
					text: "replied to your message",
				};
			default:
				return {
					icon: Bell,
					color: "text-zinc-500 bg-zinc-800 border-zinc-700",
					text: "interacted with you",
				};
		}
	};

	const getRelativeTime = (isoString: string) => {
		const stamp = new Date(isoString).getTime();
		const diff = Date.now() - stamp;
		const mins = Math.floor(diff / 60000);
		const hrs = Math.floor(mins / 60);

		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		if (hrs < 24) return `${hrs}h ago`;
		return new Date(isoString).toLocaleDateString([], {
			month: "short",
			day: "numeric",
		});
	};

	if (loading) {
		return (
			<div className="w-full px-2 pt-6 space-y-4">
				{[1, 2, 3].map((n) => (
					<div
						key={n}
						className="flex h-20 w-full animate-pulse rounded-3xl border border-zinc-800 bg-zinc-800/40"
					/>
				))}
			</div>
		);
	}

	return (
		<div className="w-full px-2 pt-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="font-sans text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 md:text-2xl">
						Notifications
					</h2>
					<p className="text-sm text-slate-500 dark:text-zinc-400">
						Keep track of updates and interactions
					</p>
				</div>

				{notifications.length > 0 && (
					<div className="flex items-center gap-2">
						<button
							onClick={handleMarkAllRead}
							className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer">
							Mark all read
						</button>
						<button
							onClick={handleClearAll}
							className="rounded-full border border-red-900/30 bg-red-950/20 px-4 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-all hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer">
							Clear all
						</button>
					</div>
				)}
			</div>

			{error && (
				<div className="mb-6 flex items-start gap-2.5 rounded-3xl border border-red-900/30 bg-red-950/25 p-4.5 text-xs text-red-800 dark:text-red-400">
					<AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600" />
					<span>{error}</span>
				</div>
			)}

			{notifications.length === 0 ? (
				<GlassCard className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-1 bg-zinc-800 border border-zinc-700 text-black dark:text-white shadow-sm animate-pulse font-sans">
						<Bell className="h-6 w-6" />
					</div>
					<h3 className="mt-4 text-base font-bold text-slate-800 dark:text-zinc-200">
						All quiet here
					</h3>
					<p className="mx-auto mt-2 max-w-sm text-xs text-slate-400 dark:text-zinc-400 leading-relaxed">
						When someone likes, comments, follows, or mentions you,
						you'll see it here.
					</p>
				</GlassCard>
			) : (
				<div className="space-y-3.5">
					<AnimatePresence initial={false}>
						{notifications.map((notif) => {
							const details = getNotifDetails(notif.type);
							const NotifIcon = details.icon;

							return (
								<div
									key={notif._id}
									className="relative overflow-hidden"
									onContextMenu={(e) =>
										handleContextMenuOpen(e, notif)
									}
									onTouchStart={(e) =>
										handleTouchStart(e, notif)
									}
									onTouchEnd={handleTouchEnd}
									onTouchMove={handleTouchMove}>
									{/* Swipe-to-open-post indicator — ref-based CSS transform */}
									<div
										ref={swipeBarRef}
										className="absolute inset-y-0 left-0 w-1.5 bg-indigo-500/50 rounded-r-full pointer-events-none z-10"
										style={{
											transform: "translateX(-6px)",
											opacity: 0,
											transition:
												"transform 200ms ease-out, opacity 200ms ease-out",
										}}
									/>
									{showSwipeBadge && (
										<div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
											<div className="flex items-center gap-1.5 bg-indigo-500/20 backdrop-blur-sm rounded-full px-2.5 py-1 border border-indigo-400/30">
												<ExternalLink className="h-3 w-3 text-indigo-300" />
												<span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider">
													Open
												</span>
											</div>
										</div>
									)}
									<GlassCard
										animate={true}
										onClick={() => {
											if (!notif.isRead)
												handleMarkSingleRead(notif._id);
										}}
										className={`group relative flex items-start justify-between gap-4 p-4.5 transition-all cursor-pointer ${
											notif.isRead
												? "opacity-85 hover:opacity-100"
												: "ring-1 ring-zinc-500/10 border-indigo-400/40 dark:border-indigo-800/40"
										}`}
										showMacControls={false}>
										<div className="flex gap-4.5">
											{/* Floating Bubble Type Indicator */}
											<div className="relative shrink-0">
												<UserAvatar
													src={
														notif.sender?.profilePic
															?.url
													}
													alt={notif.sender?.fullName}
													className="h-11 w-11 cursor-pointer rounded-full object-cover border border-zinc-800"
													onClick={() =>
														onUserClick(
															notif.sender!
																.username,
														)
													}
												/>
												<span
													className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${details.color}`}>
													<NotifIcon className="h-3 w-3" />
												</span>
											</div>

											<div className="space-y-1">
												<p className="text-sm text-slate-700 dark:text-zinc-200">
													<span
														onClick={() =>
															onUserClick(
																notif.sender!
																	.username,
															)
														}
														className="font-bold text-slate-900 dark:text-zinc-100 cursor-pointer hover:underline hover:text-black dark:hover:text-white">
														{notif.sender
															?.fullName ||
															"Anonymous User"}
													</span>{" "}
													<span className="text-slate-500 dark:text-zinc-400">
														{details.text}
													</span>
												</p>

												{/* Brief text contents of contextual items (comment content or post title) */}
												{notif.post && (
													<div
														onClick={() =>
															onPostClick(
																notif.post!
																	.slug,
															)
														}
														className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 border border-zinc-750 hover:bg-zinc-700 hover:text-white font-sans whitespace-nowrap shadow-sm">
														{notif.post.title
															.length > 50
															? notif.post.title.slice(
																	0,
																	50,
																) + "..."
															: notif.post.title}
													</div>
												)}

												{notif.comment && (
													<p className="mt-1.5 border-l-2 border-zinc-700 pl-2 text-xs italic text-zinc-400 leading-relaxed line-clamp-2">
														"{notif.comment.content}
														"
													</p>
												)}

												<div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500 pt-1">
													<Clock className="h-3.5 w-3.5" />
													<span>
														{getRelativeTime(
															notif.createdAt,
														)}
													</span>
												</div>
											</div>
										</div>

										{/* Actions / Read Indicator */}
										<div className="flex flex-col items-end gap-2 shrink-0">
											<button
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteSingle(
														notif._id,
													);
												}}
												className="p-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-all focus:outline-none">
												<X className="h-4 w-4" />
											</button>
											{!notif.isRead && (
												<span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
											)}
										</div>
									</GlassCard>
								</div>
							);
						})}
					</AnimatePresence>
				</div>
			)}

			{/* Context Menu — mobile bottom sheet or desktop popover */}
			<AnimatePresence>
				{contextMenu && (
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

									{/* Notification preview */}
									<div className="px-6 py-3 border-b border-zinc-800/60">
										<div className="flex items-center gap-3">
											<UserAvatar
												src={
													contextMenu.notif.sender
														?.profilePic?.url
												}
												alt={
													contextMenu.notif.sender
														?.fullName
												}
												className="h-8 w-8 rounded-full object-cover border border-zinc-800"
											/>
											<div className="text-left">
												<p className="text-xs font-bold text-zinc-200">
													{contextMenu.notif.sender
														?.fullName ||
														"Anonymous"}
												</p>
												<p className="text-[10px] text-zinc-500">
													{
														getNotifDetails(
															contextMenu.notif
																.type,
														).text
													}
												</p>
											</div>
										</div>
									</div>

									{/* Actions */}
									<div className="p-3 space-y-0.5">
										{contextMenu.notif.post && (
											<button
												onClick={() => {
													onPostClick(
														contextMenu.notif.post!
															.slug,
													);
													setContextMenu(null);
												}}
												className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
												<ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
												Go to post
											</button>
										)}
										{contextMenu.notif.sender && (
											<button
												onClick={() => {
													onUserClick(
														contextMenu.notif
															.sender!.username,
													);
													setContextMenu(null);
												}}
												className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
												<ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
												View profile
											</button>
										)}
										{!contextMenu.notif.isRead ? (
											<button
												onClick={() => {
													handleMarkSingleRead(
														contextMenu.notif._id,
													);
													setContextMenu(null);
												}}
												className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
												<Eye className="h-3.5 w-3.5 text-zinc-400" />
												Mark as read
											</button>
										) : (
											<button
												onClick={() => {
													setContextMenu(null);
												}}
												className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
												<EyeOff className="h-3.5 w-3.5 text-zinc-400" />
												Already read
											</button>
										)}
										<button
											onClick={() =>
												handleCopyNotifText(
													contextMenu.notif,
												)
											}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 cursor-pointer">
											<Copy className="h-3.5 w-3.5 text-zinc-400" />
											Copy text
										</button>
										<button
											onClick={() => {
												handleDeleteSingle(
													contextMenu.notif._id,
												);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 cursor-pointer">
											<Trash2 className="h-3.5 w-3.5 text-red-400" />
											Delete
										</button>
										<button
											onClick={() => setContextMenu(null)}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-850 rounded-xl flex items-center gap-2.5 border border-zinc-800/50 mt-1.5 cursor-pointer">
											<X className="h-3.5 w-3.5 text-zinc-400" />
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
										window.innerWidth - 220,
									),
									top: Math.min(
										Math.max(20, contextMenu.y),
										window.innerHeight - 280,
									),
									zIndex: 1000,
								}}
								className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto w-52"
								onClick={(e) => e.stopPropagation()}>
								<div className="p-1">
									{contextMenu.notif.post && (
										<button
											onClick={() => {
												onPostClick(
													contextMenu.notif.post!
														.slug,
												);
												setContextMenu(null);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
											<ExternalLink className="h-3.5 w-3.5" />
											Go to post
										</button>
									)}
									{contextMenu.notif.sender && (
										<button
											onClick={() => {
												onUserClick(
													contextMenu.notif.sender!
														.username,
												);
												setContextMenu(null);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
											<ExternalLink className="h-3.5 w-3.5" />
											View profile
										</button>
									)}
									{!contextMenu.notif.isRead ? (
										<button
											onClick={() => {
												handleMarkSingleRead(
													contextMenu.notif._id,
												);
												setContextMenu(null);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
											<Eye className="h-3.5 w-3.5" />
											Mark as read
										</button>
									) : (
										<button
											onClick={() => {
												setContextMenu(null);
											}}
											className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
											<EyeOff className="h-3.5 w-3.5" />
											Already read
										</button>
									)}
									<button
										onClick={() =>
											handleCopyNotifText(
												contextMenu.notif,
											)
										}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
										<Copy className="h-3.5 w-3.5" />
										Copy text
									</button>
									<button
										onClick={() => {
											handleDeleteSingle(
												contextMenu.notif._id,
											);
										}}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 cursor-pointer">
										<Trash2 className="h-3.5 w-3.5" />
										Delete
									</button>
									<button
										onClick={() => setContextMenu(null)}
										className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer">
										<X className="h-3.5 w-3.5" />
										Cancel
									</button>
								</div>
							</motion.div>
						)}
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
