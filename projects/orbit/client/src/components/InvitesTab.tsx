import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Gift, Copy, Check, Users, Loader2, TicketCheck } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import GlassCard from "./GlassCard";

export default function InvitesTab() {
	const [inviteCode, setInviteCode] = useState("");
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [copied, setCopied] = useState(false);
	const [stats, setStats] = useState({ totalInvites: 0, acceptedInvites: 0 });
	const [redeemCode, setRedeemCode] = useState("");
	const [redeeming, setRedeeming] = useState(false);
	const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
	// Guards against concurrent double-redeem (button + deep-link transports).
	const redeemInFlightRef = useRef(false);

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

	// Pre-fill + auto-redeem when arriving via a shared /invite/<code> link.
	// Two transports: a window event (tab already mounted) and sessionStorage
	// (cold load where this component mounts after the deep-link ran).
	useEffect(() => {
		const onInviteDeepLink = (e: Event) => {
			const code = ((e as CustomEvent).detail?.code || "").toUpperCase();
			if (!code) return;
			setRedeemCode(code);
			setTimeout(() => handleRedeemWithCode(code), 250);
		};
		window.addEventListener("orbit:redeem-invite", onInviteDeepLink);
		try {
			const pending = sessionStorage.getItem("orbit_pending_invite");
			if (pending) {
				sessionStorage.removeItem("orbit_pending_invite");
				const code = pending.toUpperCase();
				setRedeemCode(code);
				setTimeout(() => handleRedeemWithCode(code), 250);
			}
		} catch { /* private mode */ }
		return () => window.removeEventListener("orbit:redeem-invite", onInviteDeepLink);
	}, []);

	// Redeem a specific code (used by the button + deep-link path).
	// The ref guard makes double-fire impossible even if the deep-link event
	// and the sessionStorage path both run (or the user double-clicks).
	const handleRedeemWithCode = async (code: string) => {
		if (redeemInFlightRef.current) return;
		redeemInFlightRef.current = true;
		setRedeeming(true);
		setRedeemMsg(null);
		try {
			const res = await apiFetch(`/api/invites/redeem/${encodeURIComponent(code)}`, { method: "POST" });
			const data = await res.json();
			if (res.ok && data.success) {
				setRedeemMsg({ ok: true, text: "Invite redeemed successfully!" });
				setRedeemCode("");
				fetchStats();
			} else {
				setRedeemMsg({ ok: false, text: data.message || "Could not redeem this code." });
			}
		} catch (err) {
			logger.error("Failed to redeem invite code", err);
			setRedeemMsg({ ok: false, text: "Could not redeem this code." });
		} finally {
			redeemInFlightRef.current = false;
			setRedeeming(false);
		}
	};

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
		// Copy just the invite code — the recipient redeems it in the
		// "Have an invite code?" field. Falls back to a hidden textarea for
		// browsers/contexts without the async clipboard API.
		const fallbackCopy = () => {
			try {
				const ta = document.createElement("textarea");
				ta.value = inviteCode;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				document.body.removeChild(ta);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			} catch {
				logger.error("Failed to copy invite code");
			}
		};
		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(inviteCode).then(
				() => {
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				},
				() => fallbackCopy(),
			);
		} else {
			fallbackCopy();
		}
	};

	const handleRedeem = () => {
		const code = redeemCode.trim().toUpperCase();
		if (!code) {
			setRedeemMsg({ ok: false, text: "Enter an invite code first." });
			return;
		}
		handleRedeemWithCode(code);
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
					<h3 className="text-label text-base font-semibold text-white">
						Invite Friends
					</h3>
				</div>

				<p className="text-[11px] text-zinc-400 mb-5 leading-relaxed">
					Share your invite code with friends and earn rewards when they join Orbit!
				</p>

				{/* Invite Code Display */}
				{inviteCode ? (
					<div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4">
						<div className="flex items-center justify-between mb-1.5">
							<div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
								Your Invite Code
							</div>
							<button
								type="button"
								onClick={handleCopy}
								title={copied ? "Copied!" : "Copy invite code"}
								aria-label="Copy invite code"
								className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-all cursor-pointer"
							>
								{copied ? (
									<><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</>
								) : (
									<><Copy className="h-3.5 w-3.5" /> Copy</>
								)}
							</button>
						</div>
						<button
							type="button"
								onClick={handleCopy}
								title="Copy invite code"
								className="group w-full text-left cursor-pointer"
							>
							<span className="inline-flex items-center gap-2.5 text-lg font-black tracking-widest text-white font-mono group-hover:text-emerald-300 transition-colors">
								{inviteCode}
								<Copy className="h-4 w-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
							</span>
						</button>
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

				{/* Redeem a friend's code */}
				<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 mb-4">
					<div className="flex items-center gap-2 mb-2">
						<TicketCheck className="h-4 w-4 text-emerald-400" />
						<div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
							Have an invite code?
						</div>
					</div>
					<div className="flex gap-2">
						<input
							value={redeemCode}
							onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
							placeholder="ABC12345"
							maxLength={12}
							className="min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-[12px] font-mono font-bold tracking-widest text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors uppercase"
						/>
						<button
							type="button"
							onClick={handleRedeem}
							disabled={redeeming}
							className="shrink-0 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-4 py-2 text-[10px] font-bold text-emerald-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
						>
							{redeeming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
							Redeem
						</button>
					</div>
					{redeemMsg && (
						<div
							className={`mt-2 text-[11px] font-semibold ${redeemMsg.ok ? "text-emerald-400" : "text-red-400"}`}
						>
							{redeemMsg.text}
						</div>
					)}
				</div>

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
