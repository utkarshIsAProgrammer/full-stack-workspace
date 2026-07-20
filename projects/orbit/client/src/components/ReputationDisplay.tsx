import { useState, useEffect } from "react";
import { Award, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface ReputationInfo {
  totalRep: number;
  tier: number;
  badges: string[];
  nextTierRep: number;
  currentTierRep: number;
  tierMinRep: number;
}

interface ReputationDisplayProps {
  userId?: string;
  compact?: boolean;
}

export default function ReputationDisplay({ userId, compact = false }: ReputationDisplayProps) {
  const [repInfo, setRepInfo] = useState<ReputationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRep = async () => {
      try {
        const endpoint = userId ? `/api/xp/${userId}` : "/api/xp";
        const res = await apiFetch(endpoint);
        const data = await res.json();
        if (res.ok && data.success) {
          setRepInfo({
            totalRep: data.totalXP ?? 0,
            tier: data.level ?? 1,
            badges: data.badges ?? [],
            nextTierRep: data.nextLevelXP ?? 100,
            currentTierRep: data.currentLevelXP ?? 0,
            tierMinRep: data.levelMinXP ?? 0,
          });
        }
      } catch (err) {
        logger.error("Failed to fetch reputation info", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRep();
  }, [userId]);

  const getTierLabel = (tier: number): string => {
    const labels = ["Newcomer", "Regular", "Contributor", "Influencer", "Icon", "Legend"];
    return labels[Math.min(tier - 1, labels.length - 1)] || `Tier ${tier}`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Rep...
      </div>
    );
  }

  if (!repInfo) return null;

  const progress = repInfo.nextTierRep > repInfo.tierMinRep
    ? Math.min(100, Math.round(((repInfo.totalRep - repInfo.tierMinRep) / (repInfo.nextTierRep - repInfo.tierMinRep)) * 100))
    : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-zinc-400">
        <Award className="h-3 w-3 text-amber-400" />
        <span className="font-bold">{getTierLabel(repInfo.tier)}</span>
        <span className="text-zinc-600">{repInfo.totalRep} rep</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Award className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-white">{getTierLabel(repInfo.tier)}</span>
        </div>
        <span className="text-[11px] text-zinc-400">
          {repInfo.totalRep.toLocaleString()} reputation
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-zinc-500">
          {repInfo.totalRep.toLocaleString()} rep
        </span>
        <span className="text-[9px] text-zinc-500">
          {repInfo.nextTierRep.toLocaleString()} rep
        </span>
      </div>
      {repInfo.badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {repInfo.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-400"
            >
              {badge.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
