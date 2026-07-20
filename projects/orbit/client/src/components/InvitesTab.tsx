import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Gift, Copy, Check, Share2, Users, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import GlassCard from "./GlassCard";

export default function InvitesTab() {
	const [inviteCode, setInviteCode] = useState("");
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [copied, setCopied] = useState(false);
	const [stats, setStats] = useState({ totalInvites: 0, acceptedInvites: 0 });

	const fetchInviteCode = async () => {
		setLoading(true);
		try {
			const res = await apiFetch("/api/invites/code");
			const data = await res.json();
			if (res.ok && data.success) {
				setInviteCode(data.inviteCode);
			}
		} catch (err) {
			logger.error("Failed to fetch invite code", err);
		} finally {
			setLoading(false);
		}
	};

	const fetchStats = async () => {
		try {
			const res = await apiFetch("/api/invites/stats");
			const data = await res.json();
			if (res.ok && data.success) {
				setStats(data.stats);
			}
		} catch (err) {
			logger.error("Failed to fetch invite stats", err);
		}
	};

	useEffect(() => {
		fetchInviteCode();
		fetchStats();
	}, []);

	const handleGenerate = async () => {
		setGenerating(true);
		try {
			const res = await apiFetch("/api/invites/code");
			const data = await res.json();
			if (res.ok && data.success) {
				setInviteCode(data.inviteCode);
			}
		} catch (err) {
			logger.error("Failed to generate invite code", err);
		} finally {
			setGenerating(false);
		}
	};

	const handleCopy = () => {
		const link = `${window.location.origin}/invite/${inviteCode}`;
		navigator.clipboard.writeText(link).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const handleShare = async () => {
		const link = `${window.location.origin}/invite/${inviteCode}`;
		const shareData = {
			title: "Join me on Orbit!",
			text: `Come join me on Orbit! Use my invite link: ${link}`,
		};
		if (navigator.share) {
			try {
				await navigator.share(shareData);
			} catch {
				// User cancelled
			}
		} else {
			handleCopy();
		}
	};

	if (loading) {
		return (
			<GlassCard className="p-6 text-center">
				<Loader2 className="h-5 w-5 animate-spin text-zinc-500 mx-auto" />
			</GlassCard>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="space-y-4"
		>
			<GlassCard className="p-6">
				<div className="flex items-center gap-2 mb-4">
					<Gift className="h-4 w-4 text-emerald-400" />
					<h3 className="text-sm font-bold text-white uppercase tracking-wider">
						Invite Friends
					</h3>
				</div>

				<p className="text-[11px] text-zinc-400 mb-5 leading-relaxed">
					Share your invite link with friends and earn rewards when they join Orbit!
				</p>

				{/* Invite Code Display */}
				{inviteCode ? (
					<div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4">
						<div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
							Your Invite Code
						</div>
						<div className="text-lg font-black tracking-widest text-white font-mono">
							{inviteCode}
						</div>
					</div>
				) : (
					<button
						type="button"
						onClick={handleGenerate}
						disabled={generating}
						className="w-full rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 py-3 text-[11px] font-bold text-emerald-300 transition-all cursor-pointer flex items-center justify-center gap-2 mb-4"
					>
						{generating ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<><Gift className="h-3.5 w-3.5" /> Generate Invite Code</>
						)}
					</button>
				)}

				{/* Action Buttons */}
				{inviteCode && (
					<div className="flex gap-2 mb-5">
						<button
							type="button"
							onClick={handleCopy}
							className="flex-1 rounded-full bg-zinc-800 hover:bg-zinc-700 py-2.5 text-[10px] font-bold text-zinc-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
						>
							{copied ? (
								<><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!</>
							) : (
								<><Copy className="h-3.5 w-3.5" /> Copy Link</>
							)}
						</button>
						<button
							type="button"
							onClick={handleShare}
							className="flex-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 py-2.5 text-[10px] font-bold text-emerald-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
						>
							<Share2 className="h-3.5 w-3.5" /> Share
						</button>
					</div>
				)}

				{/* Stats */}
				<div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800/50">
					<div className="text-center">
						<div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
							<Users className="h-3.5 w-3.5" />
						</div>
						<div className="text-lg font-black text-white">{stats.totalInvites}</div>
						<div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
							Total Sent
						</div>
					</div>
					<div className="text-center">
						<div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
							<Check className="h-3.5 w-3.5" />
						</div>
						<div className="text-lg font-black text-white">{stats.acceptedInvites}</div>
						<div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
							Accepted
						</div>
					</div>
				</div>
			</GlassCard>
		</motion.div>
	);
}
