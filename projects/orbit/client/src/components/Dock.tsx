import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
	Home,
	Search,
	Bell,
	User,
	MessageSquare,
	Plus,
	Settings,
	Hash,
} from "lucide-react";
import { warmCache, getEndpointsForTab } from "../utils/api";	interface DockItem {
		id: string;
		label: string;
		icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
		badge?: number;
		// Some icons (Hash, User, Settings) have thinner strokes or more empty space —
		// bump strokeWidth to make them visually match the others.
		strokeWidth?: number;
	}

interface DockProps {
	currentTab: string;
	setTab: (tab: string) => void;
	badgeCount: number;
	chatBadgeCount: number;
}



export default React.memo(function Dock({
	currentTab,
	setTab,
	badgeCount,
	chatBadgeCount,
}: Omit<DockProps, never>) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

	// Detect mobile keyboard via visualViewport height drop
	useEffect(() => {
		if (typeof window === "undefined" || !window.visualViewport) return;
		const checkKeyboard = () => {
			const vv = window.visualViewport!;
			// On iOS Safari, keyboard pushes up the viewport — height drops significantly
			// Threshold: if viewport height < 500px and the difference from full screen is > 150px
			const fullHeight = window.screen.height;
			const heightDiff = fullHeight - vv.height;
			setIsKeyboardOpen(heightDiff > 150 && vv.height < 600);
		};
		window.visualViewport.addEventListener("resize", checkKeyboard);
		checkKeyboard();
		return () =>
			window.visualViewport?.removeEventListener("resize", checkKeyboard);
	}, []);

	const leftItems: DockItem[] = [
		{ id: "home", label: "Home", icon: Home },
		{ id: "explore", label: "Explore", icon: Search },
		{
			id: "notifications",
			label: "Notifications",
			icon: Bell,
			badge: badgeCount,
		},
	];

	const rightItems: DockItem[] = [
		{
			id: "chat",
			label: "Messages",
			icon: MessageSquare,
			badge: chatBadgeCount,
		},
		{ id: "communities", label: "Communities", icon: Hash, strokeWidth: 3 },
		{ id: "profile", label: "Profile", icon: User, strokeWidth: 2.5 },
		{ id: "settings", label: "Settings", icon: Settings, strokeWidth: 2.5 },
	];

	// Note: composectr button is rendered inline, not via renderDockItem

	const renderDockItem = (item: DockItem, index: number) => {
		const Icon = item.icon;
		const isActive = currentTab === item.id;
		const isHovered = hoveredIndex === index;
		let scale = isHovered ? 1.35 : 1;
		let yOffset = isHovered ? -8 : 0;

		return (
			<button
				key={item.id}
				onClick={() => setTab(item.id)}
				onMouseEnter={() => {
					setHoveredIndex(index);
					// Warm cache for this tab on hover — data will be ready by the time user clicks
					const endpoints = getEndpointsForTab(item.id);
					if (endpoints.length > 0) {
						warmCache(endpoints);
					}
				}}
				onMouseLeave={() => setHoveredIndex(null)}
				aria-label={item.label}
				className="group relative flex h-9 w-8 min-[400px]:h-10 min-[400px]:w-9 min-[500px]:h-11 min-[500px]:w-10 items-center justify-center rounded-xl sm:rounded-2xl text-zinc-500 dark:text-zinc-500 transition-colors">
				{/* Active indicator glow */}
				{isActive && (
					<motion.div
						layoutId="activeGlow"
						className="absolute inset-[-2px] rounded-xl sm:rounded-2xl bg-zinc-800/80 border border-zinc-700"
						transition={{
							type: "spring",
							stiffness: 400,
							damping: 28,
						}}
					/>
				)}


				<motion.div
					animate={{ scale, y: yOffset }}
					transition={{ type: "spring", stiffness: 300, damping: 18 }}
					whileTap={{ scale: 0.85 }}
					className="relative z-10 flex items-center justify-center gpu-accelerated">
					<Icon
						strokeWidth={item.strokeWidth || 2}
						className={`h-4.5 w-4.5 min-[400px]:h-5 min-[400px]:w-5 min-[500px]:h-5.5 min-[500px]:w-5.5 ${isActive ? "text-black dark:text-white" : "text-zinc-400 dark:text-zinc-450"}`}
					/>

					{/* Badge */}
					{item.badge && item.badge > 0 ? (
						<motion.span
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 min-[500px]:h-4 min-[500px]:min-w-4 min-[500px]:text-[8px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-black text-white shadow-md border-2 border-white dark:border-zinc-900">
							{item.badge > 99 ? "99+" : item.badge}
						</motion.span>
					) : null}
				</motion.div>


				{/* Tooltip — macOS style */}
				<span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-900/90 backdrop-blur-xl px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 whitespace-nowrap shadow-lg z-50">
					{item.label}
				</span>
			</button>
		);
	};

	return (
		<>
			<div
				className={`fixed left-1/2 z-[120] w-[calc(100%-0.3rem)] max-w-[28rem] -translate-x-1/2 px-0.5 min-[480px]:max-w-[31rem] min-[560px]:max-w-[33rem] sm:hidden dock-force-hide transition-all duration-200 ${isKeyboardOpen ? "bottom-1" : "bottom-1.5 sm:bottom-2.5"}`}
				style={{
					bottom: `calc(${isKeyboardOpen ? "0.2rem" : "0.3rem"} + env(safe-area-inset-bottom, 0px))`,
				}}>
				<div
					className={`relative flex items-center justify-between rounded-3xl sm:rounded-4xl border border-white/15 bg-black/35 backdrop-blur-3xl backdrop-saturate-150 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ${isKeyboardOpen ? "px-2 py-1.5 gap-0.5" : "px-2.5 py-3.5 gap-1 min-[400px]:gap-1.5 min-[500px]:gap-2 min-[400px]:px-3 min-[500px]:py-4"}`}>


					{leftItems.map((item, i) => renderDockItem(item, i))}

					{/* Center: Create Post button — same size as other dock items, no hover animation */}
					<button
						onClick={() => setTab("compose")}
						className={`group relative flex h-9 w-8 min-[400px]:h-10 min-[400px]:w-9 min-[500px]:h-11 min-[500px]:w-10 items-center justify-center rounded-full gpu-accelerated ${
							currentTab === "compose"
								? "bg-linear-to-br from-zinc-700 to-black dark:from-white dark:to-zinc-300 shadow-xl shadow-black/40 dark:shadow-white/30 border border-white/40 dark:border-zinc-800"
								: "bg-linear-to-br from-zinc-800 to-black dark:from-white dark:to-zinc-200 shadow-xl shadow-black/30 dark:shadow-white/20 border border-zinc-700 dark:border-zinc-200"
						} transition-all duration-200 hover:shadow-2xl cursor-pointer shrink-0 z-20`}
						title="New Post">
						<Plus
							className={`h-4 w-4 min-[400px]:h-4.5 min-[400px]:w-4.5 min-[500px]:h-5 min-[500px]:w-5 gpu-accelerated ${
								currentTab === "compose"
									? "text-white scale-110 dark:text-black"
									: "text-white dark:text-black"
							} transition-transform duration-200`}
						/>
						<span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-950/90 backdrop-blur-xl px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 whitespace-nowrap shadow-lg z-50">
							New Post
						</span>
					</button>

					{rightItems.map((item, i) =>
						renderDockItem(item, leftItems.length + 1 + i),
					)}
				</div>
			</div>
		</>
	);
});
