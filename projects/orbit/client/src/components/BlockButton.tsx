import { useState, useEffect } from "react";
import { Shield, ShieldOff, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface BlockButtonProps {
  targetUserId: string;
  onBlockChange?: (blocked: boolean) => void;
}

export default function BlockButton({ targetUserId, onBlockChange }: BlockButtonProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check block status on mount
  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const res = await apiFetch(`/api/blocks/${targetUserId}/check`);
        const data = await res.json();
        if (!cancelled && res.ok && data.success) {
          setIsBlocked(data.iBlocked);
        }
      } catch (err) {
        logger.error("Failed to check block status", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    checkStatus();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const handleToggleBlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      if (isBlocked) {
        const res = await apiFetch(`/api/blocks/${targetUserId}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsBlocked(false);
          onBlockChange?.(false);
          window.dispatchEvent(new CustomEvent("showToast", {
            detail: { message: "User unblocked", type: "success" },
          }));
        }
      } else {
        const res = await apiFetch(`/api/blocks/${targetUserId}`, { method: "POST" });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsBlocked(true);
          onBlockChange?.(true);
          window.dispatchEvent(new CustomEvent("showToast", {
            detail: { message: "User blocked", type: "success" },
          }));
        }
      }
    } catch (err) {
      logger.error("Failed to toggle block", err);
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: { message: "Failed to update block status", type: "error" },
      }));
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <button
      onClick={handleToggleBlock}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
        isBlocked
          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
      }`}
      title={isBlocked ? "Unblock user" : "Block user"}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isBlocked ? (
        <ShieldOff className="h-3.5 w-3.5" />
      ) : (
        <Shield className="h-3.5 w-3.5" />
      )}
      {isBlocked ? "Blocked" : "Block"}
    </button>
  );
}
