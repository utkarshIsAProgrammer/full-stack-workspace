import UserAvatar from "./UserAvatar";
import React, { useState, useEffect } from "react";
import { useKeyboardOpen } from "../hooks/useKeyboardOpen";
import {
  User as UserIcon,
  Lock,
  Trash2,
  LogOut,
  Camera,
  CheckCircle,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  X,
  Volume2
} from "lucide-react";
import { User as UserType } from "../types";
import GlassCard from "./GlassCard";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";
import { apiFetch } from "../utils/api";
import { validateProfile, validatePasswordChange, validateDeleteAccount } from "../utils/validation";
import EchoTest from "./EchoTest";

interface SettingsProps {
  user: UserType;
  onUserUpdate: (newUser: UserType) => void;
  onLogout: () => void;
  onEditProfileOpenChange?: (open: boolean) => void;
}

export default function Settings({ user, onUserUpdate, onLogout, onEditProfileOpenChange }: SettingsProps) {
  // Navigation Tabs for settings sections
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "password" | "account" | "audio" | "logout">("profile");

  const switchSubTab = (tab: "profile" | "password" | "account" | "audio" | "logout") => {
    setActiveSubTab(tab);
    setFieldErrors({});
  };

  // Notify parent when edit profile tab opens/closes (for dock hiding)
  useEffect(() => {
    onEditProfileOpenChange?.(activeSubTab === "profile");
  }, [activeSubTab, onEditProfileOpenChange]);

  // Also notify on mount/unmount
  useEffect(() => {
    return () => onEditProfileOpenChange?.(false);
  }, [onEditProfileOpenChange]);

  // Profile Edit fields
  const [fullName, setFullName] = useState(user.fullName || "");
  const [bio, setBio] = useState(user.bio || "");
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [bannerPicFile, setBannerPicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState(user.profilePic?.url || "");
  const [bannerPicPreview, setBannerPicPreview] = useState(user.bannerImage?.url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

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
    if (!profileError) return;
    const timer = setTimeout(() => setProfileError(null), 6000);
    return () => clearTimeout(timer);
  }, [profileError]);

  useEffect(() => {
    if (!passwordError) return;
    const timer = setTimeout(() => setPasswordError(null), 6000);
    return () => clearTimeout(timer);
  }, [passwordError]);

  // Profile Submit handler
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const errs = validateProfile({ fullName, bio });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append("fullName", fullName.trim());
      formData.append("bio", bio.trim());

      if (profilePicFile) {
        formData.append("profilePic", profilePicFile);
      } else if (!profilePicPreview && user.profilePic?.url) {
        formData.append("removeProfilePic", "true");
      }
      if (bannerPicFile) {
        formData.append("bannerImage", bannerPicFile);
      } else if (!bannerPicPreview && user.bannerImage?.url) {
        formData.append("removeBannerImage", "true");
      }

      const res = await apiFetch("/api/users/update-profile", {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update profile.");
      }

      onUserUpdate(data.user);
      setProfileSuccess("Your profile details have been saved successfully.");
    } catch (err: any) {
      setProfileError(err.message || "An unexpected error occurred.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Submit handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const errs = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
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
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword, email: user.email }),
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
      setPasswordError(err.message || "Verification failed. Check your current password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Delete Account handler
  const handleDeleteAccount = async () => {
    const errors = validateDeleteAccount({ email: deleteEmail, password: deletePassword });
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
        body: JSON.stringify({ email: deleteEmail, password: deletePassword })
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
    <div className="w-full px-4 pb-28 mt-4 leading-normal font-sans">        {!isKeyboardOpen && (
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-900 dark:text-zinc-100 leading-normal tracking-tight">
            Account Settings
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your profile, password, and account preferences.
          </p>
        </div>
      </div>
        )}

      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Main interactive cards area */}
        <div className="w-full min-h-75">
          {activeSubTab === "profile" && (
            <GlassCard animate={true} className={`transition-all duration-200 ${
              isKeyboardOpen ? "p-4" : "p-6"
            }`}>
              <h3 className={`font-bold text-black dark:text-white uppercase tracking-wider mb-4 border-b border-zinc-900 pb-2 transition-all duration-200 ${
                isKeyboardOpen ? "text-[11px]" : "text-sm"
              }`}>
                Edit Profile
              </h3>

              {profileSuccess && (
                <div className="mb-4 flex items-start gap-2.5 rounded-3xl border border-white/20 bg-white/5 p-4 text-xs text-zinc-300">
                  <CheckCircle className="h-4 w-4 shrink-0 text-white" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-500">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} noValidate className={`transition-all duration-200 ${
                isKeyboardOpen ? "space-y-3" : "space-y-4"
              }`}>
                {/* Images Upload */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-1 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Profile Pic
                    </span>
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors group mx-auto overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProfilePicFile(file);
                            setProfilePicPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer rounded-full animate-none"
                      />
                      {profilePicPreview ? (
                        <>
                          <UserAvatar
                            key={profilePicPreview}
                            src={profilePicPreview}
                            alt="Profile preview"
                            className="absolute inset-0 h-full w-full rounded-full object-cover pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfilePicFile(null);
                              setProfilePicPreview("");
                            }}
                            className="absolute top-3 right-3 h-4 w-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md cursor-pointer transition-colors z-20"
                            title="Remove avatar"
                          >
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 dark:text-zinc-400 z-10 whitespace-nowrap pointer-events-none">
                            Tap to change
                          </span>
                        </>
                      ) : (
                        <div className="text-center space-y-1">
                          <Camera className="mx-auto h-5 w-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                          <span className="block text-[8px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Upload avatar
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 col-span-1 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Banner Image
                    </span>
                    <div className="relative flex h-16 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors group mx-auto overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBannerPicFile(file);
                            setBannerPicPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer rounded-full animate-none"
                      />
                      {bannerPicPreview ? (
                        <>
                          <UserAvatar
                            key={bannerPicPreview}
                            src={bannerPicPreview}
                            alt="Banner preview"
                            className="absolute inset-0 h-full w-full rounded-full object-cover pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBannerPicFile(null);
                              setBannerPicPreview("");
                            }}
                            className="absolute top-3 right-3 h-4 w-4 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md cursor-pointer transition-colors z-20"
                            title="Remove banner"
                          >
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 dark:text-zinc-400 z-10 whitespace-nowrap pointer-events-none">
                            Tap to change
                          </span>
                        </>
                      ) : (
                        <div className="text-center space-y-1">
                          <Camera className="mx-auto h-5 w-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                          <span className="block text-[8px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Upload banner
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 label text-left">
                  <label htmlFor="settings-fullname" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    Full Name
                  </label>
                  <input
                    id="settings-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
                    maxLength={50}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-900/55 py-3 max-sm:py-2 px-4.5 max-sm:px-3.5 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                  />
                  <div className="flex items-center justify-between px-1">
                    <ValidationMessage message={fieldErrors.fullName} />
                    <CharCounter current={fullName.length} max={50} />
                  </div>
                </div>

                <div className="space-y-1.5 label text-left">
                  <label htmlFor="settings-bio" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    Bio
                  </label>
                  <textarea
                    id="settings-bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A brief snippet about yourself..."
                    className="w-full rounded-3xl border border-zinc-800 bg-zinc-900/55 py-3 max-sm:py-2 px-4.5 max-sm:px-3.5 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all resize-none"
                    maxLength={300}
                  />
                  <div className="flex justify-end px-1">
                    <CharCounter current={bio.length} max={300} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full rounded-full bg-black py-3 max-sm:py-2 text-[11px] max-sm:text-[10px] font-bold tracking-widest uppercase text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 font-sans transition-all disabled:opacity-40 shadow-md cursor-pointer"
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </GlassCard>
          )}

          {activeSubTab === "password" && (
            <GlassCard animate={true} className={`transition-all duration-200 ${
              isKeyboardOpen ? "p-4" : "p-6"
            }`}>
              <h3 className={`font-bold text-black dark:text-white uppercase tracking-wider mb-4 border-b border-zinc-900 pb-2 transition-all duration-200 ${
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

              <form onSubmit={handlePasswordSubmit} noValidate className={`transition-all duration-200 ${
                isKeyboardOpen ? "space-y-3" : "space-y-4"
              }`}>
                <div className="space-y-1.5 text-left">
                  <label htmlFor="settings-current-password" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="settings-current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); clearFieldError("currentPassword"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3 max-sm:py-2 pl-4.5 max-sm:pl-3.5 pr-11 max-sm:pr-9 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showCurrentPassword ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.currentPassword} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="settings-new-password" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="settings-new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); clearFieldError("newPassword"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3 max-sm:py-2 pl-4.5 max-sm:pl-3.5 pr-11 max-sm:pr-9 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showNewPassword ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.newPassword} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="settings-confirm-password" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    Confirm New Password
                  </label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3 max-sm:py-2 px-4.5 max-sm:px-3.5 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black transition-all"
                  />
                  <ValidationMessage message={fieldErrors.confirmPassword} />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full rounded-full bg-black py-3 max-sm:py-2 text-[11px] max-sm:text-[10px] font-bold tracking-widest uppercase text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 font-sans transition-all disabled:opacity-40 shadow-md cursor-pointer"
                >
                  {savingPassword ? "Updating password..." : "Update Password"}
                </button>
              </form>
            </GlassCard>
          )}

          {activeSubTab === "account" && (
            <GlassCard animate={true} className={`border-rose-500/25 dark:border-rose-950/25 bg-red-950/10 dark:bg-red-950/10 shadow-none transition-all duration-200 ${
              isKeyboardOpen ? "p-4" : "p-6"
            }`}>
              <div className="flex items-center gap-2 mb-3 border-b border-rose-500/20 pb-2">
                <Trash2 className="h-4 w-4 text-rose-500 animate-bounce" />
                <h3 className="text-sm font-bold text-rose-500 uppercase tracking-wider">
                  Delete Account
                </h3>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                This process is completely <span className="font-bold text-rose-500 font-sans">irreversible</span>.
                Deleting your account will permanently delete your profile, comments, posts, and followers.
              </p>

              {deleteError && (
                <div className="my-4 flex items-start gap-2.5 rounded-3xl border border-rose-500/25 bg-rose-500/5 p-4 text-xs text-rose-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="mt-5 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label htmlFor="settings-delete-email" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    To delete your account, enter your <span className="font-extrabold text-black dark:text-white">Email Address</span>:
                  </label>
                  <input
                    id="settings-delete-email"
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    required
                    placeholder="user@example.com"
                    value={deleteEmail}
                    onChange={(e) => { setDeleteEmail(e.target.value); clearFieldError("deleteEmail"); }}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3 max-sm:py-2 px-4.5 max-sm:px-3.5 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-rose-500 focus:bg-white dark:focus:bg-black transition-all"
                  />
                  <ValidationMessage message={fieldErrors.deleteEmail} />
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="settings-delete-password" className="text-[10px] font-semibold text-zinc-300 pl-4">
                    And your current <span className="font-extrabold text-black dark:text-white">Password</span>:
                  </label>
                  <div className="relative">
                    <input
                      id="settings-delete-password"
                      type={showDeletePassword ? "text" : "password"}
                      autoComplete="off"
                      required
                      placeholder="Enter password"
                      value={deletePassword}
                      onChange={(e) => { setDeletePassword(e.target.value); clearFieldError("deletePassword"); }}
                      className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-3 max-sm:py-2 pl-4.5 max-sm:pl-3.5 pr-11 max-sm:pr-9 text-xs max-sm:text-[11px] font-medium text-black dark:text-white focus:outline-none focus:border-rose-500 focus:bg-white dark:focus:bg-black transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-4 top-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      {showDeletePassword ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <ValidationMessage message={fieldErrors.deletePassword} />
                </div>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || !deleteEmail || !deletePassword}
                  className="w-full rounded-full bg-rose-600 hover:bg-rose-700 py-3 max-sm:py-2 text-[11px] max-sm:text-[10px] font-bold uppercase tracking-widest text-white transition-all disabled:opacity-30 disabled:hover:bg-rose-600"
                >
                  {deletingAccount ? "Deleting account..." : "Permanently Delete Account"}
                </button>
              </div>
            </GlassCard>
          )}

          {activeSubTab === "audio" && (
            <EchoTest />
          )}

          {activeSubTab === "logout" && (
            <GlassCard animate={true} className="p-6 text-center space-y-5 max-w-sm mx-auto my-6 border-red-500/20 dark:border-red-900/40">
              <div className="mx-auto h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/20 flex items-center justify-center text-red-600 dark:text-red-400 animate-pulse">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-black dark:text-white">
                  Sign Out of Orbit
                </h3>
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-normal max-w-xs mx-auto uppercase tracking-tight">
                  Are you sure you want to sign out? You will need to sign back in to view your feeds and chat with friends.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => switchSubTab("profile")}
                  className="rounded-full border border-zinc-800 bg-zinc-950/20 px-6 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full bg-red-600 text-white hover:bg-red-500 dark:bg-red-700 dark:hover:bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-red-500/15"
                >
                  Confirm Log Out
                </button>
              </div>
            </GlassCard>
          )}
        </div>

        {/* BOTTOM ALIGNED SETTINGS MENU PANEL (SUB-DOCK) */}
        <div className="mt-8 flex justify-center w-full relative z-20 pb-4">
          <div className="flex flex-row items-center justify-center gap-1.5 rounded-full border border-zinc-800/60 bg-zinc-950/55 backdrop-blur-xl px-3 py-2 shadow-xl max-w-lg w-full">
            <button
              type="button"
              onClick={() => switchSubTab("profile")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${activeSubTab === "profile"
                ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm scale-102"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
                }`}
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              type="button"
              onClick={() => switchSubTab("password")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${activeSubTab === "password"
                ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm scale-102"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
                }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Password</span>
            </button>

            <button
              type="button"
              onClick={() => switchSubTab("account")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${activeSubTab === "account"
                ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm scale-102"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
                }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
            </button>

            <button
              type="button"
              onClick={() => switchSubTab("audio")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${activeSubTab === "audio"
                ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm scale-102"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
                }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audio</span>
            </button>

            <button
              type="button"
              onClick={() => switchSubTab("logout")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${activeSubTab === "logout"
                ? "bg-red-600 text-white dark:bg-red-650 dark:text-white"
                : "text-red-500 dark:text-red-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60"
                }`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
