import React, { useState } from "react";
import { User } from "../types";
import {
	Home,
	Compass,
	Bell,
	Bookmark,
	Feather,
	Repeat,
	MessageSquare,
	Settings,
	Hash,
	Shield,
} from "lucide-react";
import UserAvatar from "./UserAvatar";
import PostModal from "./PostModal";
import GlassCard from "./GlassCard";
import { warmCache, getEndpointsForTab } from "../utils/api";

interface LeftSidebarProps {
	user: User | null;
	currentTab: string;
	setTab: (tab: string) => void;
	setSelectedUserUsername: (username: string) => void;
	badgeCount: number;
	chatBadgeCount: number;
}

export default React.memo(function LeftSidebar({
	user,
	currentTab,
	setTab,
	setSelectedUserUsername,
	badgeCount,
	chatBadgeCount,
}: LeftSidebarProps) {
	const [postModalOpen, setPostModalOpen] = useState(false);

	const tabs = [
		{ id: "home", label: "Home", icon: Home },
		{ id: "explore", label: "Explore", icon: Compass },
		{
			id: "notifications",
			label: "Notifications",
			icon: Bell,
			badge: badgeCount,
		},
		{
			id: "chat",
			label: "Messages",
			icon: MessageSquare,
			badge: chatBadgeCount,
		},
		{ id: "communities", label: "Communities", icon: Hash },
		{ id: "saved", label: "Saved", icon: Bookmark },
		{ id: "reposts", label: "Reposts", icon: Repeat },
		{ id: "settings", label: "Settings", icon: Settings },
		...(user?.isAdmin
			? [{ id: "admin" as const, label: "Admin", icon: Shield }]
			: []),
	];

	return (
		<>
			<div className="flex flex-col h-full min-h-0">
				<GlassCard
					animate={true}
					className="flex-1 flex flex-col justify-between h-full px-2 md:px-3 pt-4 pb-0 lg:px-4 xl:px-5 xl:pt-5">
					<div className="space-y-5 pb-5">
						{/* Logo — script wordmark, always visible */}
						<div
							className="cursor-pointer pt-1 group flex justify-start"
							onClick={() => setTab("home")}>
							<div className="flex flex-col items-start">
								<h1 className="text-logo text-slate-900 dark:text-zinc-50 text-left">
									Orbit
								</h1>
								<p className="font-display-italic text-[12px] text-zinc-400 dark:text-zinc-400 tracking-wide">
									your inner circle
								</p>
							</div>
						</div>

						{/* Navigation Options — icon + label always visible */}
						<nav
							className="space-y-1 pt-3 flex flex-col"
							aria-label="Main navigation">
							{tabs.map((tab) => {
								const active = currentTab === tab.id;
								const Icon = tab.icon;
								return (
									<button
										key={tab.id}
										onClick={() => setTab(tab.id)}
										onMouseEnter={() => {
											// Warm cache for this tab on hover — data loads instantly when user clicks
											const endpoints = getEndpointsForTab(tab.id);
											if (endpoints.length > 0) {
												warmCache(endpoints);
											}
										}}
										aria-label={tab.label}
										aria-current={
											active ? "page" : undefined
										}
										className={`flex w-full items-center justify-start gap-2.5 rounded-2xl px-3 py-2.5 text-[12px] md:text-sm font-semibold transition-all cursor-pointer ${
											active
												? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white shadow-md"
												: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
										}`}>
										<div className="relative">												<Icon
													className={`h-5.5 w-5.5 lg:h-4.5 lg:w-4.5 ${active ? "opacity-100" : "opacity-70"}`}
													aria-hidden="true"
												/>
											{tab.badge ? (
												<span
													className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white dark:bg-white dark:text-black shadow-sm"
													aria-label={`${tab.badge} new ${tab.label}`}>
													{tab.badge > 99
														? "99"
														: tab.badge}
												</span>
											) : null}
										</div>
										<span className="truncate min-w-0">
											{tab.label}
										</span>
									</button>
								);
							})}
						</nav>

						{/* Create Post Action — pill button, always with label */}
						<button
							onClick={() => setPostModalOpen(true)}
							aria-label="Create new post"
							className="w-full bg-white text-black font-semibold text-sm rounded-full py-2.5 px-4 flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-95 cursor-pointer hover:bg-zinc-100 hover:shadow-xl">
							<Feather
								className="h-4 w-4 shrink-0"
								aria-hidden="true"
							/>
							<span>Post</span>
						</button>
					</div>						{/* Profile at Bottom — avatar + details always visible */}
						<div className="mt-auto pt-5 border-t border-white/10">
							<button
								onClick={() => {
									setSelectedUserUsername(user?.username || "");
									setTab("profile");
								}}
								aria-label="View your profile"
								className="flex w-full items-center justify-start gap-3 rounded-2xl p-3 transition-all group hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
								<UserAvatar
									src={user?.profilePic?.url}
									alt={`${user?.fullName || "User"} profile picture`}
									className="h-9 w-9 shrink-0 rounded-full object-cover border border-zinc-800"
								/>
								<div className="flex-1 min-w-0 flex flex-col items-start overflow-hidden text-left">
									<span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 line-clamp-1">
										{user?.fullName}
									</span>
									<span className="text-xs text-zinc-500 line-clamp-1">
										@{user?.username}
									</span>
								</div>
							</button>
						</div>
				</GlassCard>
			</div>

			<PostModal
				isOpen={postModalOpen}
				onClose={() => setPostModalOpen(false)}
				onPostCreated={() => {
					setPostModalOpen(false);
					setTab("home");
					window.dispatchEvent(new Event("forceFeedRefresh"));
				}}
			/>
		</>
	);
});
