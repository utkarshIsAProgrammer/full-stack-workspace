import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Flame, Gift, Loader2, Check, Zap } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import GlassCard from "./GlassCard";

interface UserStreak {
	_id: string;
	userId: string;
	currentStreak: number;
	longestStreak: number;
	lastActiveDate: string;
	updatedAt: string;
}

interface StreaksProps {
	user: { _id: string };
}

export default function Streaks({ user: _user }: StreaksProps) {
	const [streak, setStreak] = useState<UserStreak | null>(null);
	const [loading, setLoading] = useState(true);
	const [claimed, setClaimed] = useState(false);
	const [claiming, setClaiming] = useState(false);
	const [claimMessage, setClaimMessage] = useState("");

	const fetchStreak = async () => {
		try {
			const res = await apiFetch("/api/streaks/my");
			const data = await res.json();
			if (res.ok && data.success) {
				setStreak(data.streak);
				setClaimed(data.streak?.dailyRewardClaimed || false);
			}
		} catch (err) {
			logger.error("Failed to fetch streak", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStreak();
	}, []);

	const handleClaim = async () => {
		if (claimed || claiming) return;
		setClaiming(true);
		try {
			const res = await apiFetch("/api/streaks/claim", { method: "POST" });
			const data = await res.json();
			if (res.ok && data.success) {
				setClaimed(true);
				setClaimMessage(data.message || "Reward claimed! 🎉");
				fetchStreak();
			} else {
				setClaimMessage(data.message || "Already claimed today");
			}
		} catch (err) {
			logger.error("Failed to claim reward", err);
			setClaimMessage("Failed to claim");
		} finally {
			setClaiming(false);
			if (!claimed) {
				setTimeout(() => setClaimMessage(""), 3000);
			}
		}
	};

	if (loading) {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="space-y-4"
			>
				<div className="rounded-3xl border border-zinc-800/30 bg-zinc-950/40 p-5">
					{/* Header: Streak title + Best badge */}
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<div className="h-4 w-4 rounded shimmer-bg" />
							<div className="h-3.5 w-14 rounded shimmer-bg" />
						</div>
						<div className="h-[10px] w-20 rounded shimmer-bg" />
					</div>

					{/* Center: Flame icon + streak count */}
					<div className="flex items-center justify-center py-4">
						<div className="text-center flex flex-col items-center gap-2">
							<div className="h-12 w-12 rounded-full shimmer-bg" />
							<div className="h-4 w-16 rounded shimmer-bg" />
						</div>
					</div>

					{/* Bottom: Daily reward section */}
					<div className="mt-4 pt-4 border-t border-zinc-800/50">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded shimmer-bg" />
								<div className="h-[11px] w-20 rounded shimmer-bg" />
							</div>
							<div className="h-7 w-16 rounded-full shimmer-bg" />
						</div>
					</div>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="space-y-4"
		>
			{/* Streak Display */}
			<GlassCard className="p-5">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-bold text-white flex items-center gap-2">
						<Flame className="h-4 w-4 text-orange-400" /> Streak
					</h2>
					<span className="text-[10px] text-zinc-500 font-mono">
						Best: {streak?.longestStreak || 0} days
					</span>
				</div>

				<div className="flex items-center justify-center py-4">
					<div className="text-center">
						<motion.div
							key={streak?.currentStreak || 0}
							initial={{ scale: 1.3 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", stiffness: 200 }}
							className="text-4xl font-black text-white flex items-center gap-2"
						>
							<Flame
								className={`h-8 w-8 ${
									(streak?.currentStreak || 0) > 0
										? "text-orange-400"
										: "text-zinc-600"
								}`}
							/>
							{streak?.currentStreak || 0}
						</motion.div>
						<p className="text-[11px] text-zinc-400 mt-1 font-medium">
							{streak?.currentStreak === 1
								? "day"
								: "days"}{" "}
							consecutive
						</p>
					</div>
				</div>

				{/* Daily Reward Claim */}
				<div className="mt-4 pt-4 border-t border-zinc-800/50">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Gift className="h-4 w-4 text-emerald-400" />
							<span className="text-[11px] text-zinc-400 font-medium">
								Daily Reward
							</span>
						</div>
						{claimed ? (
							<div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold">
								<Check className="h-3 w-3" /> Claimed
							</div>
						) : (
							<button
								onClick={handleClaim}
								disabled={claiming}
								className="rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-3 py-1 text-[10px] font-bold text-emerald-300 transition-all cursor-pointer flex items-center gap-1"
							>
								{claiming ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<><Zap className="h-3 w-3" /> Claim</>
								)}
							</button>
						)}
					</div>
					{claimMessage && (
						<motion.p
							initial={{ opacity: 0, y: 5 }}
							animate={{ opacity: 1, y: 0 }}
							className="text-[10px] text-zinc-500 mt-2"
						>
							{claimMessage}
						</motion.p>
					)}
				</div>
			</GlassCard>
		</motion.div>
	);
}
