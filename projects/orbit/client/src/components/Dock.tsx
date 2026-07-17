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
} from "lucide-react";
import { User as UserType } from "../types";

interface DockItem {
	id: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	badge?: number;
	specialPic?: boolean;
}

interface DockProps {
	currentTab: string;
	setTab: (tab: string) => void;
	user: UserType | null;
	badgeCount: number;
	chatBadgeCount: number;
}



export default React.memo(function Dock({
	currentTab,
	setTab,
	user,
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
		{ id: "profile", label: "Profile", icon: User, specialPic: true },
		{ id: "settings", label: "Settings", icon: Settings },
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
				onMouseEnter={() => setHoveredIndex(index)}
				onMouseLeave={() => setHoveredIndex(null)}
				aria-label={item.label}
				className="group relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl text-zinc-500 dark:text-zinc-500 transition-colors hover:text-black dark:hover:text-white">
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

				{/* macOS reflection glow beneath on hover */}
				{isHovered && (
					<motion.div
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						className="absolute -bottom-1 w-5 h-2 sm:w-7 sm:h-3 rounded-full bg-white/10 blur-md"
						transition={{ duration: 0.2 }}
					/>
				)}

				<motion.div
					animate={{ scale, y: yOffset }}
					transition={{ type: "spring", stiffness: 300, damping: 18 }}
					whileTap={{ scale: 0.85 }}
					className="relative z-10 flex items-center justify-center gpu-accelerated">
					{item.specialPic && user?.profilePic?.url ? (
						<img
							loading="lazy"
							src={user.profilePic.url}
							alt={user.fullName}
							className={`h-6.5 w-6.5 sm:h-7 sm:w-7 aspect-square rounded-full object-cover border ${isActive ? "border-white" : "border-zinc-700"} shadow-sm`}
						/>
					) : (
						<Icon
							className={`h-5 w-5 sm:h-5.5 sm:w-5.5 ${isActive ? "text-black dark:text-white" : "text-zinc-400 dark:text-zinc-450 group-hover:text-black dark:group-hover:text-white"}`}
						/>
					)}

					{/* Badge */}
					{item.badge && item.badge > 0 ? (
						<motion.span
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-black text-white shadow-md border-2 border-white dark:border-zinc-900">
							{item.badge > 99 ? "99+" : item.badge}
						</motion.span>
					) : null}
				</motion.div>


				{/* Tooltip — macOS style */}
				<span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-900/90 backdrop-blur-xl px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 blur-sm transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-0 whitespace-nowrap shadow-lg z-50">
					{item.label}
				</span>
			</button>
		);
	};

	return (
		<>
			<div
				className={`fixed left-1/2 z-[120] w-[calc(100%-0.3rem)] max-w-[28rem] -translate-x-1/2 px-0.5 sm:max-w-[32rem] md:hidden transition-all duration-200 ${isKeyboardOpen ? "bottom-1" : "bottom-1.5 sm:bottom-2.5"}`}
				style={{
					bottom: `calc(${isKeyboardOpen ? "0.2rem" : "0.3rem"} + env(safe-area-inset-bottom, 0px))`,
				}}>
				<div
					className={`relative flex items-center justify-between rounded-3xl sm:rounded-4xl border border-white/15 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-950/80 backdrop-blur-xl shadow-[0_20px_60px_-15px rgba(0,0,0,0.4)] transition-all duration-200 ${isKeyboardOpen ? "px-2 py-1.5 gap-0.5" : "px-2.5 py-3.5 gap-0.5 sm:gap-1.5 sm:px-3"}`}>
					{/* Liquid glass shimmer & ambient glare wrapped to contain overflow */}
					<div className="absolute inset-0 rounded-3xl sm:rounded-4xl overflow-hidden pointer-events-none z-0">

						{/* Cylindrical edge-light sheen */}
						<div className="absolute inset-x-0 top-0 h-[1.5px] bg-linear-to-r from-transparent via-white/40 dark:via-white/10 to-transparent z-10" />

						{/* Top light ambient glare */}
						<div className="absolute inset-x-0 top-0 h-[35%] bg-linear-to-b from-white/25 dark:from-white/3 to-transparent z-10 rounded-t-3xl sm:rounded-t-4xl" />
					</div>

					{leftItems.map((item, i) => renderDockItem(item, i))}

					{/* Center: Create Post button — same size as other dock items, no hover animation */}
					<button
						onClick={() => setTab("compose")}
						className={`group relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full gpu-accelerated ${
							currentTab === "compose"
								? "bg-linear-to-br from-zinc-700 to-black dark:from-white dark:to-zinc-300 shadow-xl shadow-black/40 dark:shadow-white/30 border border-white/40 dark:border-zinc-800"
								: "bg-linear-to-br from-zinc-800 to-black dark:from-white dark:to-zinc-200 shadow-xl shadow-black/30 dark:shadow-white/20 border border-zinc-700 dark:border-zinc-200"
						} transition-all duration-200 hover:shadow-2xl cursor-pointer shrink-0 z-20`}
						title="New Post">
						<Plus
							className={`h-4.5 w-4.5 sm:h-6 sm:w-6 gpu-accelerated ${
								currentTab === "compose"
									? "text-white scale-110 dark:text-black"
									: "text-white dark:text-black"
							} transition-transform duration-200`}
						/>
						<span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-950/90 backdrop-blur-xl px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 blur-sm transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-0 whitespace-nowrap shadow-lg z-50">
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
