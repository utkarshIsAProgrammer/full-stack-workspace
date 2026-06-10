import React, { useState } from "react";
import { User } from "../types";
import { Home, Compass, Bell, Bookmark, Settings, Feather, Repeat, MessageSquare } from "lucide-react";
import PostModal from "./PostModal";
import GlassCard from "./GlassCard";

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
    { id: "notifications", label: "Notifications", icon: Bell, badge: badgeCount },
    { id: "chat", label: "Messages", icon: MessageSquare, badge: chatBadgeCount },
    { id: "saved", label: "Saved", icon: Bookmark },
    { id: "reposts", label: "Reposts", icon: Repeat },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      <div className="hidden lg:flex flex-col h-[calc(100vh-3rem)] sticky top-6">
        <GlassCard animate={true} className="flex-1 flex flex-col justify-between h-full px-5 pt-5 pb-0">
          <div className="space-y-5 pb-5">
            {/* Logo */}
            <div className="cursor-pointer pt-1 group" onClick={() => setTab("home")}>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight font-logo">
                  Orbit
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tracking-wide">your inner circle</p>
              </div>
            </div>

            {/* Navigation Options */}
            <nav className="space-y-1.5 pt-3" aria-label="Main navigation">
              {tabs.map((tab) => {
                const active = currentTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    aria-label={tab.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${active
                      ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white shadow-md"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                  >
                    <div className="relative">
                      <Icon className={`h-5 w-5 ${active ? "opacity-100" : "opacity-70"}`} aria-hidden="true" />
                      {tab.badge ? (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-semibold text-white dark:bg-white dark:text-black shadow-sm" aria-label={`${tab.badge} new ${tab.label}`}>
                          {tab.badge > 99 ? "99" : tab.badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="hidden lg:block">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Create Post Action */}
            <button
              onClick={() => setPostModalOpen(true)}
              aria-label="Create new post"
              className="w-full bg-white text-black font-semibold text-sm rounded-full py-3 px-6 flex items-center justify-center lg:justify-start gap-3 transition-all shadow-lg active:scale-95 cursor-pointer hover:bg-zinc-100 hover:shadow-xl"
            >
              <Feather className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:block">Post</span>
            </button>
          </div>

          {/* Profile at Bottom */}
          <div className="mt-auto pt-5 border-t border-white/10">
            <button
              onClick={() => {
                setSelectedUserUsername(user?.username || "");
                setTab("profile");
              }}
              aria-label="View your profile"
              className="flex w-full items-center gap-3 rounded-2xl p-3 transition-all group hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <img loading="lazy"
                src={user?.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                alt={`${user?.fullName || 'User'} profile picture`}
                className="h-9 w-9 shrink-0 rounded-full object-cover border border-zinc-800"
              />
              <div className="hidden flex-1 shrink-0 flex-col items-start lg:flex overflow-hidden text-left">
                <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 line-clamp-1">{user?.fullName}</span>
                <span className="text-xs text-zinc-500 line-clamp-1">@{user?.username}</span>
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
