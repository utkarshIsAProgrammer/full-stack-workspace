import React, { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
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
} from "lucide-react";
import { Socket } from "socket.io-client";
import { Notification, User } from "../types";
import GlassCard from "./GlassCard";
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
      const res = await apiFetch("/api/notifications/read", { method: "PUT" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Mark single as read
  const handleMarkSingleRead = async (id: string) => {
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await apiFetch("/api/notifications", { method: "DELETE" });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

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
    return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="w-full px-2 pb-24 pt-6 space-y-4">
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
    <div className="w-full px-2 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-sans text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 md:text-3xl">
            Notifications
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Keep track of updates and interactions</p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              Mark all read
            </button>
            <button
              onClick={handleClearAll}
              className="rounded-full border border-red-900/30 bg-red-950/20 px-4 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition-all hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer"
            >
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
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-zinc-200">All quiet here</h3>
          <p className="mx-auto mt-2 max-w-sm text-xs text-slate-400 dark:text-zinc-400 leading-relaxed">
            When someone likes, comments, follows, or mentions you, you'll see it here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence initial={false}>
            {notifications.map((notif) => {
              const details = getNotifDetails(notif.type);
              const NotifIcon = details.icon;

              return (
                <GlassCard
                  key={notif._id}
                  animate={true}
                  onClick={() => {
                    if (!notif.isRead) handleMarkSingleRead(notif._id);
                  }}
                  className={`group relative flex items-start justify-between gap-4 p-4.5 transition-all cursor-pointer ${notif.isRead
                    ? "opacity-85 hover:opacity-100"
                    : "ring-1 ring-zinc-500/10 border-indigo-400/40 dark:border-indigo-800/40"
                    }`}
                  showMacControls={false}
                >
                  <div className="flex gap-4.5">
                    {/* Floating Bubble Type Indicator */}
                    <div className="relative shrink-0">
                    <img loading="lazy"
                      src={
                          notif.sender?.profilePic?.url ||
                          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"
                        }
                        alt={notif.sender?.fullName}
                        className="h-11 w-11 cursor-pointer rounded-full object-cover border border-zinc-800"
                        onClick={() => onUserClick(notif.sender!.username)}
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${details.color}`}
                      >
                        <NotifIcon className="h-3 w-3" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-slate-700 dark:text-zinc-200">
                        <span
                          onClick={() => onUserClick(notif.sender!.username)}
                          className="font-bold text-slate-900 dark:text-zinc-100 cursor-pointer hover:underline hover:text-black dark:hover:text-white"
                        >
                          {notif.sender?.fullName || "Anonymous User"}
                        </span>{" "}
                        <span className="text-slate-500 dark:text-zinc-400">{details.text}</span>
                      </p>

                      {/* Brief text contents of contextual items (comment content or post title) */}
                      {notif.post && (
                        <div
                          onClick={() => onPostClick(notif.post!.slug)}
                          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 border border-zinc-750 hover:bg-zinc-700 hover:text-white font-sans whitespace-nowrap shadow-sm"
                        >
                          {notif.post.title.length > 50
                            ? notif.post.title.slice(0, 50) + "..."
                            : notif.post.title}
                        </div>
                      )}

                      {notif.comment && (
                        <p className="mt-1.5 border-l-2 border-zinc-700 pl-2 text-xs italic text-zinc-400 leading-relaxed line-clamp-2">
                          "{notif.comment.content}"
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500 pt-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{getRelativeTime(notif.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Read Indicator */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDeleteSingle(e, notif._id)}
                      className="p-1 rounded-full text-slate-400 dark:text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-all focus:outline-none"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
