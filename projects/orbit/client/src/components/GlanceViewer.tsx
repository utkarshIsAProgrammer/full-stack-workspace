import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Eye } from "lucide-react";
import type { Glance, User } from "../types";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface GlanceViewerProps {
	glimpses: Glance[]; // Prop name glimpses remains for compatibility with existing lists, or we can use glimpses/glances
	initialIndex: number;
	onClose: () => void;
	onView: (glanceId: string) => void;
	onIndexChange?: (index: number) => void;
	currentUser?: User | null;
}

export default function GlanceViewer({
	glimpses,
	initialIndex,
	onClose,
	onView,
	onIndexChange,
	currentUser,
}: GlanceViewerProps) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [progress, setProgress] = useState(0);
	const [showViewersList, setShowViewersList] = useState(false);
	const viewedIdsRef = useRef<Set<string>>(new Set());
	const [isPaused, setIsPaused] = useState(false);
	const progressRef = useRef(0);

	// Sync current index back to parent feed component
	useEffect(() => {
		if (onIndexChange) {
			onIndexChange(currentIndex);
		}
	}, [currentIndex, onIndexChange]);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
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

	// Duration each glance is shown (ms)
	const DURATION = currentGlance?.viewsRemaining === 1 ? 3000 : 5000;

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

	// Auto-advance progress
	useEffect(() => {
		if (isPaused || !currentGlance || showViewersList) return;

		progressRef.current = 0;
		setProgress(0);

		const interval = 30; // update every 30ms for smooth progress
		const step = (interval / DURATION) * 100;

		timerRef.current = setInterval(() => {
			progressRef.current += step;
			setProgress(Math.min(progressRef.current, 100));

			if (progressRef.current >= 100) {
				clearInterval(timerRef.current!);
				// Advance to next glance
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

	// Handle tap left/right to navigate
	const handleContainerClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const third = rect.width / 3;

		if (x < third) {
			if (currentIndex > 0) {
				setCurrentIndex((prev) => prev - 1);
			}
		} else if (x > third * 2) {
			if (currentIndex < glimpses.length - 1) {
				setCurrentIndex((prev) => prev + 1);
			} else {
				handleClose();
			}
		} else {
			setIsPaused((prev) => !prev);
		}
	};

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
				setIsPaused((prev) => !prev);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [currentIndex, glimpses.length, handleClose, isAuthor]);

	const filteredViewers = (currentGlance?.viewers || []).filter((v) => {
		const viewerId = typeof v.user === "object" && v.user ? v.user._id : v.user;
		return viewerId && currentUserId && viewerId.toString() !== currentUserId.toString();
	});

	if (!currentGlance) return null;



	const isBlinking =
		currentGlance.viewsRemaining === 1 && !currentGlance.viewedByMe;

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
									backgroundColor:
										idx === currentIndex && isBlinking
											? "#fbbf24"
											: "white",
								}}
							/>
						</div>
					))}
				</div>

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
						<p className="text-[10px] text-white/80 drop-shadow-lg">
							@{currentGlance.author.username}
						</p>
					</div>

					</div>

				{/* The glance media (image or video) */}
				<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl">
					{currentGlance.mediaType === "video" ? (
						<video
							src={currentGlance.media.url}
							className="w-full max-h-[80vh]"
							controls
							autoPlay
							muted
							playsInline
							draggable={false}
						/>
					) : (
						<img
							src={currentGlance.media.url}
							alt=""
							className="w-full object-contain max-h-[80vh]"
							draggable={false}
						/>
					)}

					{/* Pause overlay */}
					{isPaused && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/30">
							<div className="rounded-full bg-white/20 px-6 py-3 backdrop-blur-sm">
								<p className="text-sm font-bold text-white">
									Paused
								</p>
							</div>
						</div>
					)}

					{/* Tap hints on first load */}
					{progress < 5 && !isPaused && (
						<div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/40">
							Tap sides to navigate · Tap center to pause
						</div>
					)}
				</div>

				{/* Views stats button for the creator */}
				{isAuthor && (
					<button
						onClick={() => setShowViewersList(true)}
						className="mt-4 mx-auto flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-900 transition-all cursor-pointer shadow-lg w-fit"
					>
						<Eye className="h-4 w-4 text-violet-400" />
						<span>{filteredViewers.length} {filteredViewers.length === 1 ? "view" : "views"}</span>
					</button>
				)}

				{/* Centered viewers list popup */}
				{showViewersList && (
					<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-[320]" onClick={() => setShowViewersList(false)}>
						<div className="w-full max-w-xs bg-zinc-950 border border-white/10 rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
							<div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
								<h4 className="font-bold text-sm text-white">Viewed by</h4>
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
										return (
											<div key={idx} className="flex items-center gap-2.5">
												<img
													src={viewerUser.profilePic?.url || ""}
													alt={viewerUser.fullName}
													className="h-8 w-8 rounded-full object-cover border border-zinc-800"
												/>
												<div className="text-left min-w-0 flex-1">
													<p className="text-xs font-bold text-white truncate">{viewerUser.fullName}</p>
													<p className="text-[10px] text-zinc-500 truncate">@{viewerUser.username}</p>
												</div>
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
