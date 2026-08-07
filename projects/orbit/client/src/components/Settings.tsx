import React, { useState, useEffect } from "react";
import { useKeyboardOpen } from "../hooks/useKeyboardOpen";
import {
	LogOut,
	CheckCircle,
	AlertCircle,
	Eye,
	EyeOff,
	UserCog,
	Lock,
	Users,
	Mail,
	Ban,
	Shield,
	Bell,
} from "lucide-react";
import { User as UserType } from "../types";
import GlassCard from "./GlassCard";
import ValidationMessage from "./ValidationMessage";
import BlockedUsersList from "./BlockedUsersList";
import CloseFriendsTab from "./CloseFriendsTab";
import InvitesTab from "./InvitesTab";
import NotificationSettings from "./NotificationSettings";
import PrivacySettings from "./PrivacySettings";
import { apiFetch } from "../utils/api";
import {
	validatePasswordChange,
	validateDeleteAccount,
} from "../utils/validation";

interface SettingsProps {
	user: UserType;
	onLogout: () => void;
}
export default function Settings({
	user,
	onLogout,
}: SettingsProps) {
	// Navigation Tabs for settings sections
	const [activeSubTab, setActiveSubTab] = useState<
		| "password"
		| "account"
		| "privacy"
		| "notifications"
		| "blocked"
		| "close-friends"
		| "invites"
		| "logout"
	>("password");

	const switchSubTab = (
		tab:
			| "password"
			| "account"
			| "privacy"
			| "notifications"
			| "blocked"
			| "close-friends"
			| "invites"
			| "logout",
	) => {
		setActiveSubTab(tab);
		setFieldErrors({});
	};

	// Shared settings navigation config — rendered as a desktop sidebar
	// (icon + label) and as a single horizontal pill row on non-desktop
	// devices (icons only, except the active section which also shows its
	// label so it's always obvious what's selected).
	const settingsNav: {
		id:
			| "password"
			| "account"
			| "privacy"
			| "notifications"
			| "blocked"
			| "close-friends"
			| "invites"
			| "logout";
		label: string;
		icon: React.ComponentType<{ className?: string }>;
	}[] = [
		{ id: "password", label: "Password", icon: Lock },
		{ id: "account", label: "Account", icon: UserCog },
		{ id: "privacy", label: "Privacy", icon: Shield },
		{ id: "notifications", label: "Notifications", icon: Bell },
		{ id: "close-friends", label: "Close Friends", icon: Users },
		{ id: "invites", label: "Invites", icon: Mail },
		{ id: "blocked", label: "Blocked", icon: Ban },
		{ id: "logout", label: "Log Out", icon: LogOut },
	];

	// Field-level validation errors
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const clearFieldError = (field: string) => {
		setFieldErrors((prev) => {
			if (!prev[field]) return prev;
			const next = { ...prev };
			delete next[field];
			return next;
		});
	};

	// Password fields
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

	// Account actions
	const [deleteEmail, setDeleteEmail] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const [showDeletePassword, setShowDeletePassword] = useState(false);
	const [deletingAccount, setDeletingAccount] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	// Auto-clear error messages after 6 seconds
	useEffect(() => {
		if (!passwordError) return;
		const timer = setTimeout(() => setPasswordError(null), 6000);
		return () => clearTimeout(timer);
	}, [passwordError]);

	// A shared /invite/<code> deep link lands here — jump to the Invites tab.
	// Handles both the already-mounted event and a cold load via sessionStorage.
	useEffect(() => {
		const onInviteDeepLink = () => setActiveSubTab("invites");
		window.addEventListener("orbit:redeem-invite", onInviteDeepLink);
		try {
			if (sessionStorage.getItem("orbit_pending_invite")) {
				setActiveSubTab("invites");
			}
		} catch { /* private mode */ }
		return () => window.removeEventListener("orbit:redeem-invite", onInviteDeepLink);
	}, []);

	// Password Submit handler
	const handlePasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError(null);
		setPasswordSuccess(null);

		const errs = validatePasswordChange({
			currentPassword,
			newPassword,
			confirmPassword,
		});
		if (Object.keys(errs).length > 0) {
			setFieldErrors(errs);
			setPasswordError(null);
			return;
		}
		setFieldErrors({});

		setSavingPassword(true);
		try {
			const res = await apiFetch("/api/users/update-password", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					currentPassword,
					newPassword,
					confirmPassword,
					email: user.email,
				}),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.message || "Could not update password.");
			}

			setPasswordSuccess("Password updated successfully.");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err: any) {
			setPasswordError(
				err.message ||
					"Verification failed. Check your current password.",
			);
		} finally {
			setSavingPassword(false);
		}
	};

	// Delete Account handler
	const handleDeleteAccount = async () => {
		const errors = validateDeleteAccount({
			email: deleteEmail,
			password: deletePassword,
		});
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			setDeleteError(null);
			return;
		}
		setFieldErrors({});

		setDeletingAccount(true);
		setDeleteError(null);

		try {
			const res = await apiFetch("/api/users/delete-account", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: deleteEmail,
					password: deletePassword,
				}),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.message || "Could not delete account.");
			}

			// Success, perform complete log out and cleanup
			onLogout();
		} catch (err: any) {
			setDeleteError(err.message || "Failed to delete account.");
			setDeletingAccount(false);
		}
	};

	const isKeyboardOpen = useKeyboardOpen();

	return (
		<>
		<div className="w-full px-1.5 pb-24 mt-2 leading-normal font-sans sm:px-4 sm:pb-28 sm:mt-4">
			{" "}
			{!isKeyboardOpen && (
				<div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					<div>
						<h2 className="text-display-sm text-zinc-100">
							Account Settings
						</h2>
						<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
							Manage your password, account, and app
							preferences.
						</p>
					</div>
				</div>
			)}
			<div className="flex flex-col lg:flex-row gap-6 w-full mx-auto lg:items-start lg:gap-6">

				{/* Desktop sidebar nav (lg+) — text only, sticky */}
				<nav
					className="hidden lg:flex lg:flex-col lg:gap-1 lg:w-48 lg:shrink-0 lg:sticky lg:top-24"
					aria-label="Settings sections">
					<div className="flex flex-col gap-1 rounded-2xl border border-zinc-800/60 bg-zinc-950/55 backdrop-blur-xl p-1.5 shadow-xl">
						{settingsNav.map((item) => {
							const active = activeSubTab === item.id;
							const ItemIcon = item.icon;
							return (
								<button
									key={item.id}
									type="button"
									onClick={() => switchSubTab(item.id)}
									aria-current={active ? "page" : undefined}
									className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all cursor-pointer ${
										active
											? item.id === "logout"
												? "bg-red-600 text-white shadow-md"
												: "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm"
											: item.id === "logout"
												? "text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10"
												: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
									}`}>
									<ItemIcon className="h-4 w-4 shrink-0" />
									<span className="truncate">{item.label}</span>
								</button>
							);
						})}
					</div>
				</nav>

				{/* Content column — tablet tab bar + cards + mobile dock */}
				<div className="flex-1 min-w-0 w-full flex flex-col gap-6">					{/* Compact top nav — one horizontal line for all non-desktop
				    devices (mobile + tablet). Icons only, except the active section
				    which also shows its label (so tapping a different icon reveals
				    its name while the previous one collapses back to just the icon).
				    Single line, no scroll, no wrap. */}
					<div className="lg:hidden -mx-1 px-1">
						<div className="flex items-center justify-between gap-0.5 rounded-full border border-zinc-800/60 bg-zinc-950/55 backdrop-blur-xl px-1 py-1 shadow-xl">
							{settingsNav.map((item) => {
								const active = activeSubTab === item.id;
								const ItemIcon = item.icon;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => switchSubTab(item.id)}
										aria-current={active ? "page" : undefined}
										aria-label={item.label}
										title={item.label}
										className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1.5 text-[11px] font-semibold transition-all cursor-pointer sm:text-[12px] ${
											active
												? item.id === "logout"
													? "bg-red-600 text-white shadow-sm"
													: "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm"
												: item.id === "logout"
													? "text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10"
													: "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
										}`}>
										<ItemIcon className="h-4 w-4 shrink-0" />
										{active && (
											<span className="truncate whitespace-nowrap">{item.label}</span>
										)}
									</button>
								);
							})}
						</div>
					</div>

					{/* Main interactive cards area */}
					<div className="w-full min-h-75">
					{activeSubTab === "password" && (
						<GlassCard
							animate={true}
							className={`transition-all duration-200 ${
								isKeyboardOpen ? "!p-4" : "!p-6"
							}`}>
							<h3
							className={`font-bold text-white uppercase tracking-wider mb-4 border-b border-zinc-900 pb-2 transition-all duration-200 ${
								isKeyboardOpen ? "text-[11px]" : "text-sm"
							}`}>
								Modify Password
							</h3>

							{passwordSuccess && (
								<div className="mb-4 flex items-start gap-2.5 rounded-3xl border border-white/20 bg-white/5 p-4 text-xs text-zinc-300">
									<CheckCircle className="h-4 w-4 shrink-0 text-white" />
									<span>{passwordSuccess}</span>
								</div>
							)}

							{passwordError && (
								<div className="mb-4 flex items-start gap-2.5 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-500">
									<AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
									<span>{passwordError}</span>
								</div>
							)}

							<form
								onSubmit={handlePasswordSubmit}
								noValidate
								className={`transition-all duration-200 ${
									isKeyboardOpen ? "space-y-3" : "space-y-4"
								}`}>
								<div className="space-y-1.5 text-left">
									<label
										htmlFor="settings-current-password"
										className="text-[12px] md:text-sm font-semibold text-zinc-300 pl-4">
										Current Password
									</label>
									<div className="relative">
										<input
											id="settings-current-password"
											type={
												showCurrentPassword
													? "text"
													: "password"
											}
											autoComplete="current-password"
											required
											value={currentPassword}
											onChange={(e) => {
												setCurrentPassword(
													e.target.value,
												);
												clearFieldError(
													"currentPassword",
												);
											}}
											className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2.5 pl-4 pr-11 text-[12px] md:text-sm font-medium text-white focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
										/>
										<button
											type="button"
											onClick={() =>
												setShowCurrentPassword(
													!showCurrentPassword,
												)
											}
											className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer">
											{showCurrentPassword ? (
												<Eye className="h-4 w-4" />
											) : (
												<EyeOff className="h-4 w-4" />
											)}
										</button>
									</div>
									<ValidationMessage
										message={fieldErrors.currentPassword}
									/>
								</div>

								<div className="space-y-1.5 text-left">
									<label
										htmlFor="settings-new-password"
										className="text-[12px] md:text-sm font-semibold text-zinc-300 pl-4">
										New Password
									</label>
									<div className="relative">
										<input
											id="settings-new-password"
											type={
												showNewPassword
													? "text"
													: "password"
											}
											autoComplete="new-password"
											required
											value={newPassword}
											onChange={(e) => {
												setNewPassword(e.target.value);
												clearFieldError("newPassword");
											}}
											className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2.5 pl-4 pr-11 text-[12px] md:text-sm font-medium text-white focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
										/>
										<button
											type="button"
											onClick={() =>
												setShowNewPassword(
													!showNewPassword,
												)
											}
											className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer">
											{showNewPassword ? (
												<Eye className="h-4 w-4" />
											) : (
												<EyeOff className="h-4 w-4" />
											)}
										</button>
									</div>
									<ValidationMessage
										message={fieldErrors.newPassword}
									/>
								</div>

								<div className="space-y-1.5 text-left">
									<label
										htmlFor="settings-confirm-password"
										className="text-[12px] md:text-sm font-semibold text-zinc-300 pl-4">
										Confirm New Password
									</label>
									<input
										id="settings-confirm-password"
										type="password"
										required
										value={confirmPassword}
										onChange={(e) => {
											setConfirmPassword(e.target.value);
											clearFieldError("confirmPassword");
										}}
										className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-2.5 px-3.5 text-[12px] md:text-sm font-medium text-white focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
									/>
									<ValidationMessage
										message={fieldErrors.confirmPassword}
									/>
								</div>

								<button
									type="submit"
									disabled={savingPassword}
									className="w-full rounded-full bg-black py-3 text-[12px] md:text-sm font-bold tracking-widest uppercase text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 font-sans transition-all disabled:opacity-40 shadow-md cursor-pointer">
									{savingPassword
										? "Updating password..."
										: "Update Password"}
								</button>
							</form>
						</GlassCard>
					)}

					{activeSubTab === "account" && (
						<GlassCard
							animate={true}
							className={`border-rose-500/25 dark:border-rose-950/25 bg-red-950/10 dark:bg-red-950/10 shadow-none transition-all duration-200 ${
								isKeyboardOpen ? "!p-4" : "!p-6"
							}`}>
							<div className="flex items-center gap-2 mb-3 border-b border-rose-500/20 pb-2">
								<h3 className="text-sm font-bold text-rose-500 uppercase tracking-wider">
									Delete Account
								</h3>
							</div>

							<p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
								This process is completely{" "}
								<span className="font-bold text-rose-500 font-sans">
									irreversible
								</span>
								. Deleting your account will permanently delete
								your profile, comments, posts, and followers.
							</p>

							{deleteError && (
								<div className="my-4 flex items-start gap-2.5 rounded-3xl border border-rose-500/25 bg-rose-500/5 p-4 text-xs text-rose-500">
									<AlertCircle className="h-4 w-4 shrink-0" />
									<span>{deleteError}</span>
								</div>
							)}

							<div className="mt-5 space-y-4 text-left">
								<div className="space-y-1.5">
									<label
										htmlFor="settings-delete-email"
										className="text-[12px] md:text-sm font-semibold text-zinc-300 pl-4">
										To delete your account, enter your{" "}
										<span className="font-extrabold text-white">
											Email Address
										</span>
										:
									</label>
									<input
										id="settings-delete-email"
										type="text"
										inputMode="email"
										autoComplete="new-email"
										required
										placeholder="user@example.com"
										value={deleteEmail}
										onChange={(e) => {
											setDeleteEmail(e.target.value);
											clearFieldError("deleteEmail");
										}}
										className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2.5 px-3.5 text-[12px] md:text-sm font-medium text-white focus:outline-none focus:border-rose-500 focus:bg-zinc-900 transition-all"
									/>
									<ValidationMessage
										message={fieldErrors.deleteEmail}
									/>
								</div>

								<div className="space-y-1.5 text-left">
									<label
										htmlFor="settings-delete-password"
										className="text-[12px] md:text-sm font-semibold text-zinc-300 pl-4">
										And your current{" "}
										<span className="font-extrabold text-white">
											Password
										</span>
										:
									</label>
									<div className="relative">
										<input
											id="settings-delete-password"
											type={
												showDeletePassword
													? "text"
													: "password"
											}
											autoComplete="new-password"
											required
											placeholder="Enter password"
											value={deletePassword}
											onChange={(e) => {
												setDeletePassword(
													e.target.value,
												);
												clearFieldError(
													"deletePassword",
												);
											}}
											className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2.5 pl-4 pr-11 text-[12px] md:text-sm font-medium text-white focus:outline-none focus:border-rose-500 focus:bg-zinc-900 transition-all"
										/>
										<button
											type="button"
											onClick={() =>
												setShowDeletePassword(
													!showDeletePassword,
												)
											}
											className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer">
											{showDeletePassword ? (
												<Eye className="h-4 w-4" />
											) : (
												<EyeOff className="h-4 w-4" />
											)}
										</button>
									</div>
									<ValidationMessage
										message={fieldErrors.deletePassword}
									/>
								</div>

								<button
									type="button"
									onClick={handleDeleteAccount}
									disabled={
										deletingAccount ||
										!deleteEmail ||
										!deletePassword
									}
									className="w-full rounded-full bg-rose-600 hover:bg-rose-700 py-3 text-[12px] md:text-sm font-bold uppercase tracking-widest text-white transition-all disabled:opacity-30 disabled:hover:bg-rose-600">
									{deletingAccount
										? "Deleting account..."
										: "Permanently Delete Account"}
								</button>
							</div>
						</GlassCard>
					)}

					{activeSubTab === "privacy" && (
						<PrivacySettings user={user} />
					)}

					{activeSubTab === "notifications" && (
						<NotificationSettings />
					)}

					{activeSubTab === "close-friends" && (
						<CloseFriendsTab user={user} />
					)}

					{activeSubTab === "invites" && (
						<InvitesTab />
					)}

					{activeSubTab === "blocked" && (
						<BlockedUsersList />
					)}

					{activeSubTab === "logout" && (
						<GlassCard
							animate={true}
							className="p-6 text-center space-y-5 max-w-sm mx-auto my-6 border-red-500/20 dark:border-red-900/40">
							<div className="mx-auto h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/20 flex items-center justify-center text-red-600 dark:text-red-400 animate-pulse">
								<LogOut className="h-5 w-5" />
							</div>
							<div className="space-y-1.5">
								<h3 className="text-label font-semibold text-white">
									Sign Out of Orbit
								</h3>
								<p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 leading-normal max-w-xs mx-auto uppercase tracking-tight">
									Are you sure you want to sign out? You will
									need to sign back in to view your feeds and
									chat with friends.
								</p>
							</div>

							<div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
								<button
									type="button"
									onClick={() => switchSubTab("password")}
									className="rounded-full border border-zinc-800 bg-zinc-950/20 px-6 py-2.5 text-[12px] md:text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer uppercase tracking-wider">
									Cancel
								</button>
								<button
									type="button"
									onClick={onLogout}
									className="rounded-full bg-red-600 text-white hover:bg-red-500 dark:bg-red-700 dark:hover:bg-red-600 px-6 py-2.5 text-[12px] md:text-sm font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-red-500/15">
									Confirm Log Out
								</button>
							</div>
						</GlassCard>
					)}
				</div>
				</div>
			</div>
		</div>

	</>
	);
}
