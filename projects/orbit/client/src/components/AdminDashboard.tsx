import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	Shield,
	Flag,
	ToggleLeft,
	ToggleRight,
	CheckCircle,
	X,
	Loader2,
	Search,
	Users,
	FileText,
	MessageSquare,
	Image,
	Hash,
	AlertTriangle,
	Clock,
	Activity,
	Ban,
	VolumeX,
} from "lucide-react";
import { apiFetch } from "../utils/api";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { logger } from "../utils/logger";

// Stable RegExp for matching admin reports cache refresh events
// — module-level to prevent React effect re-attachment on every render.
const MATCHER_REPORTS = /\/api\/reports/;
import GlassCard from "./GlassCard";
import UserAvatar from "./UserAvatar";

interface Report {
	_id: string;
	reporter: { _id: string; username: string; fullName: string; profilePic?: { url: string } };
	contentType: string;
	contentId: string;
	reason: string;
	description: string;
	status: string;
	action?: string;
	createdAt: string;
}

interface FeatureFlag {
	_id: string;
	key: string;
	description: string;
	enabled: boolean;
	percentage: number;
	adminOverride: boolean;
	createdAt: string;
}

type Tab = "stats" | "reports" | "users" | "flags";

type AdminStats = {
	totalUsers: number;
	totalPosts: number;
	totalComments: number;
	totalGlances: number;
	totalCommunities: number;
	pendingReports: number;
	pendingModeration: number;
	activeUsers: number;
	mutedUsers: number;
	bannedUsers: number;
};

export default function AdminDashboard() {
	const [activeTab, setActiveTab] = useState<Tab>("stats");
	const [reports, setReports] = useState<Report[]>([]);
	const [flags, setFlags] = useState<FeatureFlag[]>([]);
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [loadingReports, setLoadingReports] = useState(false);
	const [loadingFlags, setLoadingFlags] = useState(false);
	const [loadingStats, setLoadingStats] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [reviewingId, setReviewingId] = useState<string | null>(null);
	const [mutatingId, setMutatingId] = useState<string | null>(null);
	const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const fetchReports = useCallback(async (status = "pending") => {
		setLoadingReports(true);
		try {
			const res = await apiFetch(`/api/reports?status=${status}&limit=20`);
			const data = await res.json();
			if (res.ok && data.success) {
				setReports(data.reports || []);
			}
		} catch (err) {
			logger.error("Failed to fetch reports", err);
		} finally {
			setLoadingReports(false);
		}
	}, []);

	const fetchFlags = useCallback(async () => {
		setLoadingFlags(true);
		try {
			const res = await apiFetch("/api/admin/flags");
			const data = await res.json();
			if (res.ok && data.success) {
				setFlags(data.flags || []);
			}
		} catch (err) {
			logger.error("Failed to fetch feature flags", err);
		} finally {
			setLoadingFlags(false);
		}
	}, []);

	// When the background cache timer refreshes reports or flags data,
	// re-fetch so the admin dashboard stays up-to-date automatically.
	// Note: these calls must come AFTER the callback definitions above
	// to avoid Temporal Dead Zone (TDZ) issues with the const declarations.
	const fetchStats = useCallback(async () => {
		setLoadingStats(true);
		try {
			const res = await apiFetch("/api/admin/stats");
			const data = await res.json();
			if (res.ok && data.success) {
				setStats(data.stats || null);
			}
		} catch (err) {
			logger.error("Failed to fetch admin stats", err);
		} finally {
			setLoadingStats(false);
		}
	}, []);

	useCacheRefresh(MATCHER_REPORTS, () => fetchReports());
	useCacheRefresh("/api/admin/flags", () => fetchFlags());
	useCacheRefresh("/api/admin/stats", () => fetchStats());

	useEffect(() => {
		if (activeTab === "reports") fetchReports();
		if (activeTab === "flags") fetchFlags();
		if (activeTab === "stats") fetchStats();
	}, [activeTab, fetchReports, fetchFlags, fetchStats]);

	// Debounced user search for the moderation tab
	const searchUsers = useCallback(async (q: string) => {
		if (!q.trim()) {
			setSearchResults([]);
			setSearchError("");
			return;
		}
		setSearching(true);
		setSearchError("");
		try {
			const res = await apiFetch(`/api/search/users?q=${encodeURIComponent(q.trim())}&limit=10`);
			const data = await res.json();
			if (res.ok && data.success) {
				setSearchResults(data.users || []);
				if ((data.users || []).length === 0) {
					setSearchError("No users found.");
				}
			} else {
				setSearchError(data.message || "Search failed.");
			}
		} catch (err) {
			logger.error("Failed to search users", err);
			setSearchError("Search failed.");
		} finally {
			setSearching(false);
		}
	}, []);

	useEffect(() => {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchTimerRef.current = setTimeout(() => {
			void searchUsers(searchTerm);
		}, 350);
		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, [searchTerm, searchUsers]);

	const handleToggleUserMute = async (userId: string, currentlyMuted: boolean) => {
		setMutatingId(userId);
		try {
			const res = await apiFetch(`/api/admin/users/${userId}/mute`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ muted: !currentlyMuted }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setSearchResults((prev) =>
					prev.map((u) => (u._id === userId ? { ...u, isMuted: !currentlyMuted } : u)),
				);
			}
		} catch (err) {
			logger.error("Failed to toggle user mute", err);
		} finally {
			setMutatingId(null);
		}
	};

	const handleToggleUserBan = async (userId: string, currentlyBanned: boolean) => {
		setMutatingId(userId);
		try {
			const res = await apiFetch(`/api/admin/users/${userId}/ban`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ banned: !currentlyBanned }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setSearchResults((prev) =>
					prev.map((u) => (u._id === userId ? { ...u, isBanned: !currentlyBanned } : u)),
				);
			}
		} catch (err) {
			logger.error("Failed to toggle user ban", err);
		} finally {
			setMutatingId(null);
		}
	};

	// Cleanup search timer on unmount
	useEffect(() => {
		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, []);

	const handleReviewReport = async (reportId: string, status: string) => {
		setReviewingId(reportId);
		try {
			const res = await apiFetch(`/api/reports/${reportId}/review`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status,											action: status === "action_taken" ? "warning" : "none",
				}),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setReports((prev) => prev.filter((r) => r._id !== reportId));
			}
		} catch (err) {
			logger.error("Failed to review report", err);
		} finally {
			setReviewingId(null);
		}
	};

	const handleToggleFlag = async (flagId: string, currentEnabled: boolean) => {
		try {
			const res = await apiFetch(`/api/admin/flags/${flagId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !currentEnabled }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setFlags((prev) =>
					prev.map((f) =>
						f._id === flagId ? { ...f, enabled: !currentEnabled } : f,
					),
				);
			}
		} catch (err) {
			logger.error("Failed to toggle flag", err);
		}
	};



	const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
		{ id: "stats", label: "Stats", icon: <Activity className="h-3.5 w-3.5" /> },
		{ id: "reports", label: "Reports", icon: <Flag className="h-3.5 w-3.5" /> },
		{ id: "users", label: "Users", icon: <Search className="h-3.5 w-3.5" /> },
		{ id: "flags", label: "Feature Flags", icon: <ToggleLeft className="h-3.5 w-3.5" /> },
	];

	return (
		<div className="w-full px-0 pb-24 mt-2 sm:px-4 sm:pb-28 sm:mt-4">
			<div className="mb-6">
				<div className="flex items-center gap-2 mb-1">
					<Shield className="h-5 w-5 text-amber-400" />
					<h2 className="text-display-sm text-zinc-100">Admin Dashboard</h2>
				</div>
				<p className="text-xs text-zinc-500">Moderate content, manage users, and control feature flags.</p>
			</div>

			{/* Tab bar */}
			<div className="flex gap-1 mb-6 rounded-full border border-zinc-800/60 bg-zinc-950/55 backdrop-blur-xl p-1 max-w-md">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
							activeTab === tab.id
								? "bg-white text-black shadow-sm"
								: "text-zinc-500 hover:text-zinc-300"
						}`}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "stats" && (
				<div className="max-w-2xl">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-label-sm font-semibold text-zinc-300">Platform Overview</h3>
						<button
							type="button"
							onClick={() => fetchStats()}
							className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
						>
							Refresh
						</button>
					</div>

					{loadingStats && !stats ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
						</div>
					) : !stats ? (
						<GlassCard className="p-8 text-center">
							<Activity className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
							<p className="text-sm font-bold text-zinc-500">Stats unavailable</p>
						</GlassCard>
					) : (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
							{[
								{ label: "Total Users", value: stats.totalUsers, icon: <Users className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Total Posts", value: stats.totalPosts, icon: <FileText className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Comments", value: stats.totalComments, icon: <MessageSquare className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Glances", value: stats.totalGlances, icon: <Image className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Communities", value: stats.totalCommunities, icon: <Hash className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Online Now", value: stats.activeUsers, icon: <Activity className="h-3.5 w-3.5 text-emerald-400" /> },
								{ label: "Pending Reports", value: stats.pendingReports, icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> },
								{ label: "Moderation Queue", value: stats.pendingModeration, icon: <Clock className="h-3.5 w-3.5 text-amber-400" /> },
								{ label: "Muted Users", value: stats.mutedUsers, icon: <VolumeX className="h-3.5 w-3.5 text-zinc-400" /> },
								{ label: "Banned Users", value: stats.bannedUsers, icon: <Ban className="h-3.5 w-3.5 text-red-400" /> },
							].map((s) => (
								<div
									key={s.label}
									className="rounded-2xl border border-zinc-800/50 bg-zinc-950/40 p-3.5"
								>
									<div className="flex items-center gap-1.5 mb-1.5">{s.icon}<span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{s.label}</span></div>
									<p className="text-display-sm text-white">{s.value ?? 0}</p>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{activeTab === "reports" && (
				<div className="space-y-3 max-w-2xl">
					<div className="flex items-center justify-between">
						<h3 className="text-label-sm font-semibold text-zinc-300">
							Pending Reports ({reports.length})
						</h3>
						<button
							type="button"
							onClick={() => fetchReports()}
							className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
						>
							Refresh
						</button>
					</div>

					{loadingReports ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
						</div>
					) : reports.length === 0 ? (
						<GlassCard className="p-8 text-center">
							<CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
							<p className="text-sm font-bold text-zinc-400">No pending reports</p>
							<p className="text-[11px] text-zinc-600 mt-1">All reports have been reviewed.</p>
						</GlassCard>
					) : (
						<AnimatePresence>
							{reports.map((report) => (
								<motion.div
									key={report._id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, x: -20 }}
									className="rounded-2xl border border-zinc-800/50 bg-zinc-950/40 p-4"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2.5 min-w-0">
											<UserAvatar
												src={report.reporter?.profilePic?.url}
												alt={report.reporter?.username || "User"}
												className="h-7 w-7 rounded-full object-cover border border-zinc-800 shrink-0"
											/>
											<div className="min-w-0">
												<p className="text-[12px] font-bold text-white truncate">
													@{report.reporter?.username}
												</p>
												<p className="text-[10px] text-zinc-500">
													Reported {report.contentType} — {report.reason.replace(/_/g, " ")}
												</p>
											</div>
										</div>
										<span className="text-[9px] text-zinc-600 shrink-0">
											{new Date(report.createdAt).toLocaleDateString()}
										</span>
									</div>

									{report.description && (
										<p className="mt-2 text-[11px] text-zinc-400 pl-9.5">
											{report.description}
										</p>
									)}

									<div className="mt-3 flex gap-2 pl-9.5">
										<button
											type="button"
											onClick={() => handleReviewReport(report._id, "action_taken")}
											disabled={reviewingId === report._id}
											className="rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-3 py-1.5 text-[10px] font-bold text-emerald-300 transition-all cursor-pointer flex items-center gap-1"
										>
											{reviewingId === report._id ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<><CheckCircle className="h-3 w-3" /> Approve</>
											)}
										</button>
										<button
											type="button"
											onClick={() => handleReviewReport(report._id, "dismissed")}
											disabled={reviewingId === report._id}
											className="rounded-full bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-[10px] font-bold text-zinc-400 transition-all cursor-pointer flex items-center gap-1"
										>
											<X className="h-3 w-3" /> Dismiss
										</button>
									</div>
								</motion.div>
							))}
						</AnimatePresence>
					)}
				</div>
			)}

			{activeTab === "users" && (
				<div className="max-w-2xl">
					<div className="relative mb-4">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Search users by username..."
							className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-2.5 pl-10 pr-4 text-[12px] text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
						/>
					</div>

					{searching ? (
						<div className="flex items-center justify-center py-10">
							<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
						</div>
					) : searchError && searchResults.length === 0 ? (
						<GlassCard className="p-8 text-center">
							<Search className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
							<p className="text-sm font-bold text-zinc-500">{searchError}</p>
							<p className="text-[11px] text-zinc-600 mt-1">
								Type a username above to find and manage users (mute/ban).
							</p>
						</GlassCard>
					) : searchResults.length === 0 ? (
						<GlassCard className="p-8 text-center">
							<Users className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
							<p className="text-sm font-bold text-zinc-500">Search users to moderate</p>
							<p className="text-[11px] text-zinc-600 mt-1">
								Type a username above to find and manage users (mute/ban).
							</p>
						</GlassCard>
					) : (
						<div className="space-y-2">
							{searchResults.map((u) => (
								<div
									key={u._id}
									className="rounded-2xl border border-zinc-800/50 bg-zinc-950/40 p-3 flex items-center justify-between gap-3"
								>
									<div className="flex items-center gap-2.5 min-w-0">
										<UserAvatar
											src={u.profilePic?.url}
											alt={u.username || "User"}
											className="h-8 w-8 rounded-full object-cover border border-zinc-800 shrink-0"
										/>
										<div className="min-w-0">
											<p className="text-[12px] font-bold text-white truncate">
												@{u.username}
											</p>
											<p className="text-[10px] text-zinc-500 truncate">
												{u.fullName}
												{u.isMuted ? " • Muted" : ""}
												{u.isBanned ? " • Banned" : ""}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-1.5 shrink-0">
										<button
											type="button"
											onClick={() => handleToggleUserMute(u._id, !!u.isMuted)}
											disabled={mutatingId === u._id}
											className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold transition-all cursor-pointer border ${
												u.isMuted
													? "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
													: "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
											}`}
											title={u.isMuted ? "Unmute user" : "Mute user"}
										>
											<VolumeX className="h-3 w-3" />
											{u.isMuted ? "Unmute" : "Mute"}
										</button>
										<button
											type="button"
											onClick={() => handleToggleUserBan(u._id, !!u.isBanned)}
											disabled={mutatingId === u._id}
											className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold transition-all cursor-pointer border ${
												u.isBanned
													? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
													: "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
											}`}
											title={u.isBanned ? "Unban user" : "Ban user"}
										>
											{mutatingId === u._id ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<><Ban className="h-3 w-3" /> {u.isBanned ? "Unban" : "Ban"}</>
											)}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{activeTab === "flags" && (
				<div className="space-y-2 max-w-2xl">
					{loadingFlags ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
						</div>
					) : flags.length === 0 ? (
						<GlassCard className="p-8 text-center">
							<ToggleLeft className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
							<p className="text-sm font-bold text-zinc-500">No feature flags</p>
							<p className="text-[11px] text-zinc-600 mt-1">
								Create feature flags via the API to start A/B testing.
							</p>
						</GlassCard>
					) : (
						flags.map((flag) => (
							<div
								key={flag._id}
								className="rounded-2xl border border-zinc-800/50 bg-zinc-950/40 p-4 flex items-center justify-between gap-3"
							>
								<div className="min-w-0">
									<p className="text-[12px] font-bold text-white font-mono">{flag.key}</p>
									<p className="text-[10px] text-zinc-500 truncate">{flag.description}</p>
									<p className="text-[9px] text-zinc-600 mt-0.5">
										Rollout: {flag.percentage}% | {flag.adminOverride ? "Admin override" : "User-based"}
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleToggleFlag(flag._id, flag.enabled)}
									className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
										flag.enabled
											? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
											: "bg-zinc-800 text-zinc-500 border border-zinc-700"
									}`}
								>
									{flag.enabled ? (
										<><ToggleRight className="h-3.5 w-3.5" /> Enabled</>
									) : (
										<><ToggleLeft className="h-3.5 w-3.5" /> Disabled</>
									)}
								</button>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
