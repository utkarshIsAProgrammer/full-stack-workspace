import { useState, useEffect } from "react";
import { UserCheck, UserPlus, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface CloseFriendButtonProps {
  targetUserId: string;
}

export default function CloseFriendButton({
  targetUserId,
}: CloseFriendButtonProps) {
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check close-friend status on mount
  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const res = await apiFetch(
          `/api/users/close-friends/${targetUserId}/check`,
        );
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          setIsCloseFriend(!!data.isCloseFriend);
        }
      } catch (err) {
        logger.error("Failed to check close friend status", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (isCloseFriend) {
        const res = await apiFetch(
          `/api/users/close-friends/${targetUserId}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setIsCloseFriend(false);
          window.dispatchEvent(
            new CustomEvent("showToast", {
              detail: {
                message: "Removed from close friends",
                type: "success",
              },
            }),
          );
        } else {
          throw new Error(data.message || "Failed to remove close friend");
        }
      } else {
        const res = await apiFetch(
          `/api/users/close-friends/${targetUserId}`,
          { method: "POST" },
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setIsCloseFriend(true);
          window.dispatchEvent(
            new CustomEvent("showToast", {
              detail: {
                message: "Added to close friends",
                type: "success",
              },
            }),
          );
        } else {
          throw new Error(data.message || "Failed to add close friend");
        }
      }
    } catch (err: any) {
      logger.error("Failed to toggle close friend", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: err.message || "Failed to update close friends",
            type: "error",
          },
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${
        isCloseFriend
          ? "bg-emerald-500/8 border border-emerald-500/30 text-emerald-400/90 hover:bg-emerald-500/15"
          : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
      }`}
      title={
        isCloseFriend
          ? "Close friend — sees your private posts"
          : "Add to close friends"
      }
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isCloseFriend ? (
        <UserCheck className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {isCloseFriend ? "Close Friend" : "Add"}
    </button>
  );
}
