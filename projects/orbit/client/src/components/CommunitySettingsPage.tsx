import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Hash, Loader2, Camera, Settings, Trash2, MessageSquare, Phone, Video, Bell, BellOff, X } from "lucide-react";
import ImageCropModal from "./ImageCropModal";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import { downscaleImageFile } from "../utils/imageCompression";
import { useAutoGrow } from "../hooks/useAutoGrow";
import type { Community } from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface CommunitySettingsPageProps {
  community: Community;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (updated: Community) => void;
  onDeleted: (communityId: string) => void;
}

export default function CommunitySettingsPage({
  community,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted,
}: CommunitySettingsPageProps) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description || "");
  const descriptionRef = useAutoGrow<HTMLTextAreaElement>(description);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Guards the optimistic admin toggles against double-clicks / out-of-order
  // responses — one in-flight request per setting at a time.
  const pendingToggleRef = useRef<string | null>(null);

  // User notification settings — persisted server-side so the mute applies
  // to in-app + push notifications on every device. localStorage is only a
  // fast optimistic mirror; the server value is fetched on mount.
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(`orbit_community_muted_${community._id}`) === "true";
    } catch { return false; }
  });
  const [muting, setMuting] = useState(false);
  // Set once the user toggles locally — the mount-time GET /muted reconcile
  // must not overwrite a fast optimistic flip with the older server value.
  const mutedToggledRef = useRef(false);

  // Admin control local states
  const [localMessagingEnabled, setLocalMessagingEnabled] = useState(community.messagingEnabled !== false);
  const [localAudioCallsEnabled, setLocalAudioCallsEnabled] = useState(!!community.audioCallEnabled);
  const [localVideoCallsEnabled, setLocalVideoCallsEnabled] = useState(!!community.videoCallEnabled);

  // Reset form when community changes
  useEffect(() => {
    setName(community.name);
    setDescription(community.description || "");
    setImageFile(null);
    setImagePreview(null);
    setRemoveCurrentImage(false);
    setError(null);
    setConfirmDeleteOpen(false);
    setDeleting(false);
    setLocalMessagingEnabled(community.messagingEnabled !== false);
    setLocalAudioCallsEnabled(!!community.audioCallEnabled);
    setLocalVideoCallsEnabled(!!community.videoCallEnabled);
  }, [community._id, community.name, community.description, community.messagingEnabled, community.audioCallEnabled, community.videoCallEnabled]);

  // Sync the real mute state from the server (survives device changes / cache)
  useEffect(() => {
    let alive = true;
    mutedToggledRef.current = false;
    apiFetch(`/api/communities/${community._id}/muted`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.success) return;
        // If the user already toggled locally, the server response is stale
        // relative to their intent — don't stomp their optimistic flip.
        if (mutedToggledRef.current) return;
        setMuted(!!d.muted);
        try {
          localStorage.setItem(`orbit_community_muted_${community._id}`, d.muted ? "true" : "false");
        } catch {}
      })
      .catch(() => {/* keep the localStorage mirror on failure */});
    return () => {
      alive = false;
    };
  }, [community._id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed!");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be under 5MB!");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setCropSrc(URL.createObjectURL(file));
    setCropModalOpen(true);
    setRemoveCurrentImage(false);
    setError(null);
  };

  const handleCropComplete = useCallback((croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], "community_avatar.jpg", { type: "image/jpeg" });
    setImageFile(croppedFile);
    setImagePreview(URL.createObjectURL(croppedBlob));
    setRemoveCurrentImage(false);
  }, []);

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveCurrentImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Community name is required!");
      return;
    }
    if (name.trim().length > 50) {
      setError("Community name cannot exceed 50 characters!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      if (imageFile) {
        formData.append("image", await downscaleImageFile(imageFile, 800));
      }
      if (removeCurrentImage && !imageFile) {
        formData.append("removeImage", "true");
      }

      const res = await apiFetch(`/api/communities/${community._id}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onUpdated(data.community);
      } else {
        setError(data.message || "Failed to update community");
      }
    } catch (err: any) {
      logger.error("Failed to update community", err);
      setError("Failed to update community. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCommunity = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/communities/${community._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmDeleteOpen(false);
        onDeleted(community._id);
        onClose();
      } else {
        setError(data.message || "Failed to delete community");
        setDeleting(false);
        setConfirmDeleteOpen(false);
      }
    } catch (err: any) {
      logger.error("Failed to delete community", err);
      setError("Failed to delete community. Please try again.");
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const handleClearChat = async () => {
    if (!community || clearing) return;
    setClearing(true);
    try {
      const res = await apiFetch(`/api/communities/${community._id}/clear-chat`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Chat cleared — the UI updates immediately, no toast needed
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Failed to clear chat", type: "error" },
        })
      );
    } finally {
      setClearing(false);
      setConfirmClearOpen(false);
    }
  };

  const handleToggleMute = async () => {
    if (muting) return;
    const next = !muted;
    // Optimistic flip — instant, then reconciled with the server.
    setMuted(next);
    mutedToggledRef.current = true;
    setMuting(true);
    try {
      const res = await apiFetch(
        `/api/communities/${community._id}/${next ? "mute" : "unmute"}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          localStorage.setItem(`orbit_community_muted_${community._id}`, next ? "true" : "false");
        } catch {}
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: next ? "Community notifications muted" : "Community notifications unmuted", type: "success" },
          })
        );
      } else {
        setMuted(!next);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: { message: data?.message || "Couldn't update mute setting.", type: "error" },
          })
        );
      }
    } catch (err: any) {
      logger.error("Failed to toggle community mute", err);
      setMuted(!next);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Couldn't update mute setting. Try again.", type: "error" },
        })
      );
    } finally {
      setMuting(false);
    }
  };

  const currentImageUrl = removeCurrentImage
    ? null
    : imagePreview || community.image?.url || null;

  return (
    <div className="h-full w-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-zinc-400" />
        </button>
        <Settings className="h-4 w-4 text-zinc-400" />
        <h2 className="text-label text-lg font-semibold text-white">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 max-w-2xl mx-auto w-full">
        {/* Community info card */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/50">
          <div className="h-14 w-14 rounded-2xl bg-zinc-800 flex items-center justify-center border border-zinc-700/50 overflow-hidden shrink-0">
            {currentImageUrl ? (
              <img src={currentImageUrl} alt={community.name} className="h-full w-full object-cover" loading="lazy" />
            ) : community.image?.url ? (
              <img src={community.image.url} alt={community.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <Hash className="h-6 w-6 text-zinc-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white truncate">{name}</h3>
            <p className="text-[11px] text-zinc-500">{community.memberCount} member{community.memberCount !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* User Settings Section */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Notifications</h4>
          <div className="space-y-1">
            <button
              onClick={handleToggleMute}
              disabled={muting}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-zinc-900/80 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                {muted ? (
                  <BellOff className="h-4 w-4 text-zinc-400" />
                ) : (
                  <Bell className="h-4 w-4 text-zinc-400" />
                )}
                <div className="text-left">
                  <p className="text-xs font-semibold text-zinc-200">Mute Notifications</p>
                  <p className="text-[10px] text-zinc-500">
                    {muted ? "Notifications are muted" : "Receive notifications for this community"}
                  </p>
                </div>
              </div>
              <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${muted ? "bg-green-500" : "bg-zinc-700"}`}>
                {/* Knob animates on transform (GPU-friendly), matching the admin toggles */}
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${muted ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Admin Controls Section (only for creator) */}
        {isAdmin && (
          <div className="mb-6">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Admin Controls</h4>
            <div className="space-y-1 rounded-2xl border border-zinc-800/50 overflow-hidden">
              {/* Messaging toggle */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/60 transition-colors">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">Messaging</p>
                    <p className="text-[10px] text-zinc-500">
                      {localMessagingEnabled ? "Members can send messages" : "Messaging is disabled"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingToggleRef.current === "messaging") return;
                    pendingToggleRef.current = "messaging";
                    // Optimistic flip — the knob moves INSTANTLY, then the
                    // server response reconciles it (revert + toast on failure).
                    const nextMessaging = !localMessagingEnabled;
                    setLocalMessagingEnabled(nextMessaging);
                    try {
                      const res = await apiFetch(`/api/communities/${community._id}/toggle-messaging`, { method: "POST" });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setLocalMessagingEnabled(data.messagingEnabled);
                        onUpdated({ ...community, messagingEnabled: data.messagingEnabled } as Community);
                      } else {
                        setLocalMessagingEnabled(!nextMessaging);
                        window.dispatchEvent(
                          new CustomEvent("showToast", {
                            detail: { message: data?.message || "Couldn't update setting.", type: "error" },
                          }),
                        );
                      }
                    } catch (err: any) {
                      logger.error("Failed to toggle messaging", err);
                      setLocalMessagingEnabled(!nextMessaging);
                      window.dispatchEvent(
                        new CustomEvent("showToast", {
                          detail: { message: "Couldn't update setting. Try again.", type: "error" },
                        }),
                      );
                    } finally {
                      pendingToggleRef.current = null;
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${localMessagingEnabled ? "bg-green-500" : "bg-zinc-700"}`}
                  aria-pressed={localMessagingEnabled}
                >
                  {/* Knob animates on transform (GPU-friendly) instead of `left` */}
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${localMessagingEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Audio calls toggle */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/60 transition-colors border-t border-zinc-800/30">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">Audio Calls</p>
                    <p className="text-[10px] text-zinc-500">
                      {localAudioCallsEnabled ? "Members can start audio calls" : "Audio calls disabled"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingToggleRef.current === "audio-calls") return;
                    pendingToggleRef.current = "audio-calls";
                    // Optimistic flip — instant, then reconciled with the server.
                    const nextAudio = !localAudioCallsEnabled;
                    setLocalAudioCallsEnabled(nextAudio);
                    try {
                      const res = await apiFetch(`/api/communities/${community._id}/toggle-audio-calls`, { method: "POST" });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setLocalAudioCallsEnabled(data.audioCallEnabled);
                        onUpdated({ ...community, audioCallEnabled: data.audioCallEnabled } as Community);
                      } else {
                        setLocalAudioCallsEnabled(!nextAudio);
                        window.dispatchEvent(
                          new CustomEvent("showToast", {
                            detail: { message: data?.message || "Couldn't update setting.", type: "error" },
                          }),
                        );
                      }
                    } catch (err: any) {
                      logger.error("Failed to toggle audio calls", err);
                      setLocalAudioCallsEnabled(!nextAudio);
                      window.dispatchEvent(
                        new CustomEvent("showToast", {
                          detail: { message: "Couldn't update setting. Try again.", type: "error" },
                        }),
                      );
                    } finally {
                      pendingToggleRef.current = null;
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${localAudioCallsEnabled ? "bg-green-500" : "bg-zinc-700"}`}
                  aria-pressed={localAudioCallsEnabled}
                >
                  {/* Knob animates on transform (GPU-friendly) instead of `left` */}
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${localAudioCallsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Video calls toggle */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/60 transition-colors border-t border-zinc-800/30">
                <div className="flex items-center gap-3">
                  <Video className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">Video Calls</p>
                    <p className="text-[10px] text-zinc-500">
                      {localVideoCallsEnabled ? "Members can start video calls" : "Video calls disabled"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingToggleRef.current === "video-calls") return;
                    pendingToggleRef.current = "video-calls";
                    // Optimistic flip — instant, then reconciled with the server.
                    const nextVideo = !localVideoCallsEnabled;
                    setLocalVideoCallsEnabled(nextVideo);
                    try {
                      const res = await apiFetch(`/api/communities/${community._id}/toggle-video-calls`, { method: "POST" });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setLocalVideoCallsEnabled(data.videoCallEnabled);
                        onUpdated({ ...community, videoCallEnabled: data.videoCallEnabled } as Community);
                      } else {
                        setLocalVideoCallsEnabled(!nextVideo);
                        window.dispatchEvent(
                          new CustomEvent("showToast", {
                            detail: { message: data?.message || "Couldn't update setting.", type: "error" },
                          }),
                        );
                      }
                    } catch (err: any) {
                      logger.error("Failed to toggle video calls", err);
                      setLocalVideoCallsEnabled(!nextVideo);
                      window.dispatchEvent(
                        new CustomEvent("showToast", {
                          detail: { message: "Couldn't update setting. Try again.", type: "error" },
                        }),
                      );
                    } finally {
                      pendingToggleRef.current = null;
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${localVideoCallsEnabled ? "bg-green-500" : "bg-zinc-700"}`}
                  aria-pressed={localVideoCallsEnabled}
                >
                  {/* Knob animates on transform (GPU-friendly) instead of `left` */}
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${localVideoCallsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Community Info Section */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Community Info</h4>
          <div className="rounded-2xl border border-zinc-800/50 p-4 space-y-4">
            {/* Avatar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700/50 overflow-hidden shrink-0">
                  {currentImageUrl ? (
                    <img src={currentImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Hash className="h-5 w-5 text-zinc-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Community Avatar</p>
                  <p className="text-[10px] text-zinc-500">Tap to change</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {currentImageUrl && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <X className="h-3.5 w-3.5 text-zinc-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Upload image"
                >
                  <Camera className="h-3.5 w-3.5 text-zinc-400" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* Name */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Community name"
                maxLength={50}
                className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/40 transition-all"
              />
              <p className="text-[10px] text-zinc-600 mt-1 text-right">{name.length}/50</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                ref={descriptionRef} placeholder="What's this community about?"
                maxLength={500}
                rows={3}
                className="w-full bg-zinc-900/80 border border-zinc-800/60 !rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/40 transition-all resize-none"
              />
              <p className="text-[10px] text-zinc-600 mt-1 text-right">{description.length}/500</p>
            </div>

            {error && (
              <p className="text-[11px] font-semibold text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="w-full rounded-xl bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 py-2.5 text-xs font-bold text-black transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Danger Zone (admin only) */}
        {isAdmin && (
          <div className="mb-6">
            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-3">Danger Zone</h4>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                disabled={clearing}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="h-4 w-4 text-red-400" />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-zinc-200">Clear All Messages</p>
                    <p className="text-[10px] text-zinc-500">Remove all messages in this community</p>
                  </div>
                </div>
                {clearing ? <Loader2 className="h-4 w-4 text-red-400 animate-spin" /> : null}
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="h-4 w-4 text-red-400" />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-zinc-200">Delete Community</p>
                    <p className="text-[10px] text-zinc-500">Permanently delete this community and all messages</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete community?"
        message={`This will permanently delete "${community.name}" and all its messages. This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete forever"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteCommunity}
        onCancel={() => { if (!deleting) { setConfirmDeleteOpen(false); setError(null); } }}
      />

      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Clear all messages?"
        message="This will remove all messages in this community for everyone. This cannot be undone."
        confirmLabel={clearing ? "Clearing..." : "Clear all"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleClearChat}
        onCancel={() => { if (!clearing) setConfirmClearOpen(false); }}
      />

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => { setCropModalOpen(false); if (cropSrc) URL.revokeObjectURL(cropSrc); }}
        imageSrc={cropSrc}
        title="Community Avatar Crop"
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
