import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Home, Search, Bell, User, MessageSquare, Plus, Settings } from "lucide-react";
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

// Liquid glass shimmer keyframe
const shimmerStyle = `
@keyframes liquidShimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
`;

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
    return () => window.visualViewport?.removeEventListener("resize", checkKeyboard);
  }, []);

  const leftItems: DockItem[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "explore", label: "Explore", icon: Search },
    { id: "notifications", label: "Notifications", icon: Bell, badge: badgeCount },
  ];

  const rightItems: DockItem[] = [
    { id: "chat", label: "Messages", icon: MessageSquare, badge: chatBadgeCount },
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
        className="group relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl text-zinc-500 dark:text-zinc-500 transition-colors hover:text-black dark:hover:text-white"
      >
        {/* Active indicator glow */}
        {isActive && (
          <motion.div
            layoutId="activeGlow"
            className="absolute inset-0 rounded-xl sm:rounded-2xl bg-zinc-800/80 border border-zinc-700"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
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
          className="relative z-10 flex items-center justify-center gpu-accelerated"
        >
          {item.specialPic && user?.profilePic?.url ? (
            <img loading="lazy"
              src={user.profilePic.url}
              alt={user.fullName}
              className={`h-5.5 w-5.5 sm:h-7 sm:w-7 rounded-lg sm:rounded-xl object-cover border ${isActive ? "border-white" : "border-zinc-700"} shadow-sm`}
            />
          ) : (
            <Icon className={`h-4 w-4 sm:h-5.5 sm:w-5.5 ${isActive ? "text-black dark:text-white" : "text-zinc-400 dark:text-zinc-450 group-hover:text-black dark:group-hover:text-white"}`} />
          )}

          {/* Badge */}
          {item.badge && item.badge > 0 ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-black text-white shadow-md border-2 border-white dark:border-zinc-900"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </motion.span>
          ) : null}
        </motion.div>

        {/* Active dot indicator */}
        {isActive && (
          <motion.div
            layoutId="activeDot"
            className="absolute bottom-0.5 h-1.5 w-4 rounded-full bg-black dark:bg-white shadow-sm"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        )}

        {/* Tooltip — macOS style */}
        <span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-900/90 backdrop-blur-xl px-2.5 py-1 text-[9px] font-semibold text-white opacity-0 blur-sm transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-0 whitespace-nowrap shadow-lg z-50">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <style>{shimmerStyle}</style>
      <div className={`fixed left-1/2 z-40 w-full max-w-90 -translate-x-1/2 px-3 sm:max-w-lg lg:hidden transition-all duration-200 ${isKeyboardOpen ? "bottom-2" : "bottom-4"}`}>
        <div
          className={`relative overflow-hidden flex items-center justify-between rounded-3xl sm:rounded-4xl border border-white/15 dark:border-zinc-800/50 bg-white/30 dark:bg-zinc-950/40 backdrop-blur-xl shadow-[0_20px_60px_-15px rgba(0,0,0,0.4)] transition-all duration-200 ${isKeyboardOpen ? "px-2 py-1.5 gap-0.5" : "px-3 py-2.5 gap-0.5 sm:gap-1.5"}`}
        >
          {/* Liquid glass shimmer overlay — slow animated gradient */}
          <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none z-0 animate-[liquidShimmer_8s_ease-in-out_infinite] bg-[length:200%_100%] bg-linear-to-r from-transparent via-white/20 to-transparent rounded-3xl sm:rounded-4xl" />

          {/* Cylindrical edge-light sheen */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-linear-to-r from-transparent via-white/40 dark:via-white/10 to-transparent pointer-events-none z-10" />

          {/* Top light ambient glare */}
          <div className="absolute inset-x-0 top-0 h-[35%] bg-linear-to-b from-white/25 dark:from-white/3 to-transparent pointer-events-none z-10 rounded-t-3xl sm:rounded-t-4xl" />

          {/* Left items */}
          <div className={`flex items-center z-20 transition-all duration-200 ${isKeyboardOpen ? "gap-0.5 sm:gap-0.5" : "gap-0.5 sm:gap-1"}`}>
            {leftItems.map((item, i) => renderDockItem(item, i))}
          </div>

          {/* Center: Create Post button — same size as other dock items, no hover animation */}
          <button
            onClick={() => setTab("compose")}
            className={`group relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl gpu-accelerated ${currentTab === "compose"
                ? "bg-linear-to-br from-zinc-700 to-black dark:from-white dark:to-zinc-300 shadow-xl shadow-black/40 dark:shadow-white/30 border border-white/40 dark:border-zinc-800"
                : "bg-linear-to-br from-zinc-800 to-black dark:from-white dark:to-zinc-200 shadow-xl shadow-black/30 dark:shadow-white/20 border border-zinc-700 dark:border-zinc-200"
              } transition-all duration-200 hover:shadow-2xl cursor-pointer shrink-0 z-20`}
            title="New Post"
          >
            <Plus className={`h-4.5 w-4.5 sm:h-6 sm:w-6 gpu-accelerated ${currentTab === "compose" ? "text-white scale-110 dark:text-black" : "text-white dark:text-black"
              } transition-transform duration-200`} />
            <span className="pointer-events-none absolute -top-11 scale-90 rounded-lg border border-zinc-700/30 bg-zinc-900/90 backdrop-blur-xl px-2.5 py-1 text-[9px] font-semibold text-white opacity-0 blur-sm transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:blur-0 whitespace-nowrap shadow-lg z-50">
              New Post
            </span>
          </button>

          {/* Right items */}
          <div className={`flex items-center z-20 transition-all duration-200 ${isKeyboardOpen ? "gap-0.5 sm:gap-0.5" : "gap-0.5 sm:gap-1"}`}>
            {rightItems.map((item, i) => renderDockItem(item, leftItems.length + 1 + i))}
          </div>
        </div>
      </div>
    </>
  );
});
