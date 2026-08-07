import { useState, useEffect } from "react";
import { Crown, Heart, Loader2, Medal, TrendingUp, Trophy, Users } from "lucide-react";
import { apiFetch } from "../utils/api";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { logger } from "../utils/logger";
import GlassCard from "./GlassCard";
import UserAvatar from "./UserAvatar";

// Stable RegExp for matching leaderboard cache refresh events
const MATCHER_LEADERBOARD = /\/api\/leaderboard/;

interface LeaderboardCreator {
	_id: string;
	username: string;
	fullName: string;
	profilePic?: { url: string };
	followersCount: number;
}

interface LeaderboardPost {
	_id: string;
	title?: string;
	slug?: string;
	engagementScore: number;
	likesCount: number;
	commentsCount: number;
	author?: { _id: string; username: string; fullName: string; profilePic?: { url: string } };
}

type Period = "weekly" | "monthly" | "alltime";

const PERIOD_LABELS: { id: Period; label: string }[] = [
	{ id: "weekly", label: "Weekly" },
	{ id: "monthly", label: "Monthly" },
	{ id: "alltime", label: "All Time" },
];

const rankIcon = (idx: number) => {
	if (idx === 0) return <Crown className="h-3.5 w-3.5 text-amber-400" />;
	if (idx === 1) return <Medal className="h-3.5 w-3.5 text-zinc-300" />;
	if (idx === 2) return <Medal className="h-3.5 w-3.5 text-orange-700" />;
	return <span className="w-3.5 text-center text-[10px] font-bold text-zinc-600">{idx + 1}</span>;
};

export default function Leaderboard() {
	const [period, setPeriod] = useState<Period>("weekly");
	const [creators, setCreators] = useState<LeaderboardCreator[]>([]);
	const [posts, setPosts] = useState<LeaderboardPost[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchLeaderboard = async () => {
		try {
			const res = await apiFetch(`/api/leaderboard?type=${period}&limit=10`);
			const data = await res.json();
			if (res.ok && data.success) {
				setCreators(data.topCreators || []);
				setPosts(data.topPosts || []);
			}
		} catch (err) {
			logger.error("Failed to fetch leaderboard", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		setLoading(true);
		fetchLeaderboard();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [period]);

	useCacheRefresh(MATCHER_LEADERBOARD, () => fetchLeaderboard());

	return (
		<div className="space-y-4">
			<GlassCard className="p-5 rounded-3xl border border-zinc-800/40">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-label font-semibold text-zinc-300 flex items-center gap-2">
						<Trophy className="h-4 w-4 text-amber-400" /> Leaderboard
					</h3>
					<div className="flex items-center gap-1 rounded-full border border-zinc-800/60 bg-zinc-950/50 p-0.5">
						{PERIOD_LABELS.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => setPeriod(p.id)}
								className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
									period === p.id
										? "bg-white text-black"
										: "text-zinc-500 hover:text-zinc-300"
								}`}
							>
								{p.label}
							</button>
						))}
					</div>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
					</div>
				) : (
					<div className="space-y-5">
						{/* Top Creators */}
						<div>
							<div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
								<Users className="h-3.5 w-3.5" /> Top Creators
							</div>
							{creators.length === 0 ? (
								<p className="text-[11px] text-zinc-600">No creators yet.</p>
							) : (
								<div className="space-y-1.5">
									{creators.map((c, idx) => (
										<div
											key={c._id}
											className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-zinc-900/50 transition-colors"
										>
											{rankIcon(idx)}
											<UserAvatar
												src={c.profilePic?.url}
												alt={c.fullName}
												className="h-7 w-7 rounded-full object-cover border border-zinc-800 shrink-0"
											/>
											<div className="min-w-0 flex-1">
												<p className="text-[12px] font-bold text-white truncate">
													{c.fullName}
												</p>
												<p className="text-[9px] text-zinc-500 truncate">
													@{c.username} · {c.followersCount.toLocaleString()} followers
												</p>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Top Posts by engagement */}
						<div>
							<div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
								<TrendingUp className="h-3.5 w-3.5" /> Top Posts
							</div>
							{posts.length === 0 ? (
								<p className="text-[11px] text-zinc-600">No posts yet.</p>
							) : (
								<div className="space-y-1.5">
									{posts.map((p, idx) => (
										<div
											key={p._id}
											className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-zinc-900/50 transition-colors"
										>
											{rankIcon(idx)}
											<div className="min-w-0 flex-1">
												<p className="text-[12px] font-bold text-white truncate">
													{p.title || "Untitled post"}
												</p>
												<p className="text-[9px] text-zinc-500 truncate">
													@{p.author?.username || "unknown"} · {p.engagementScore.toLocaleString()} score
												</p>
											</div>
											<span className="shrink-0 flex items-center gap-0.5 text-[9px] text-zinc-500">
												<Heart className="h-3 w-3 text-red-400" /> {p.likesCount ?? 0}
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</GlassCard>
		</div>
	);
}
