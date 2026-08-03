import React, { useState, useEffect } from "react";
import { ArrowLeft, Users, Settings, Image, Video, Music, FileText, Hash, Loader2, Play } from "lucide-react";
import type { Community, CommunityMessage } from "../types";
import { apiFetch } from "../utils/api";

interface CommunityProfileOverlayProps {
  community: Community;
  isAdmin: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onUserSelected?: (username: string) => void;
}

type MediaTab = "members" | "photos" | "videos" | "audio" | "docs";

export default function CommunityProfileOverlay({
  community,
  isAdmin,
  onClose,
  onOpenSettings,
  onUserSelected,
}: CommunityProfileOverlayProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("members");
  const [memberList, setMemberList] = useState<
    { user: { _id: string; username: string; fullName: string; profilePic?: { url: string; public_id?: string } }; joinedAt: string }[]
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Media data (fetched by type)
  const [mediaItems, setMediaItems] = useState<CommunityMessage[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());



  // Parse online users from presence events
  useEffect(() => {
    const handlePresence = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.userId && detail?.status) {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (detail.status === "online") {
            next.add(detail.userId);
          } else {
            next.delete(detail.userId);
          }
          return next;
        });
      }
    };
    window.addEventListener("user:presence", handlePresence as EventListener);
    return () => {
      window.removeEventListener("user:presence", handlePresence as EventListener);
    };
  }, []);

  // Fetch members
  useEffect(() => {
    if (activeTab !== "members") return;
    setLoadingMembers(true);
    apiFetch(`/api/communities/${community._id}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMemberList(data.members || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [activeTab, community._id]);

  // Fetch media by type
  useEffect(() => {
    if (activeTab === "members") return;
    setLoadingMedia(true);
    const mediaTypeMap: Record<MediaTab, string> = {
      photos: "image",
      videos: "video",
      audio: "voice_note",
      docs: "file",
      members: "",
    };
    const mediaType = mediaTypeMap[activeTab];
    apiFetch(`/api/communities/${community._id}/media?type=${mediaType}&limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMediaItems(data.messages || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMedia(false));
  }, [activeTab, community._id]);

  const tabs: { key: MediaTab; label: string; icon: React.ReactNode }[] = [
    { key: "members", label: "Members", icon: <Users className="h-3 w-3" /> },
    { key: "photos", label: "Photos", icon: <Image className="h-3 w-3" /> },
    { key: "videos", label: "Videos", icon: <Video className="h-3 w-3" /> },
    { key: "audio", label: "Audio", icon: <Music className="h-3 w-3" /> },
    { key: "docs", label: "Docs", icon: <FileText className="h-3 w-3" /> },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-black">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 shrink-0">
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-zinc-400" />
        </button>
        <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700/50 shrink-0">
          {community.image?.url ? (
            <img src={community.image.url} alt={community.name} className="h-full w-full rounded-full object-cover" loading="lazy" />
          ) : (
            <Hash className="h-5 w-5 text-zinc-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{community.name}</h3>
          <p className="text-[10px] text-zinc-500">
            {community.memberCount} member{community.memberCount !== 1 ? "s" : ""}
            {community.description ? ` · ${community.description}` : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              onOpenSettings();
            }}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Community settings"
          >
            <Settings className="h-4 w-4 text-zinc-400 hover:text-zinc-200" />
          </button>
        )}
      </div>

      {/* Tabs — icon + label, fits without scrolling */}
      <div className="flex border-b border-zinc-800/60 shrink-0 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1 px-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
              activeTab === tab.key
                ? "text-white border-white"
                : "text-zinc-500 hover:text-zinc-300 border-transparent"
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Members tab */}
        {activeTab === "members" && (
          <div className="space-y-1">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            ) : memberList.length === 0 ? (
              <p className="text-[11px] text-zinc-600 text-center py-8">No members data available</p>
            ) : (
              memberList.map((member) => {
                const isCreator = community.creator?._id === member.user._id;
                const isOnline = onlineUsers.has(member.user._id);
                return (
                  <button
                    key={member.user._id}
                    onClick={() => {
                      if (member.user.username && onUserSelected) {
                        onUserSelected(member.user.username);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer text-left group"
                  >
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {member.user.profilePic?.url ? (
                          <img
                            src={member.user.profilePic.url}
                            alt={member.user.fullName}
                            className="h-full w-full object-cover cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(new CustomEvent("openImagePreview", { detail: member.user.profilePic!.url }));
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = document.createElement('span');
                              fallback.className = 'text-[10px] font-bold text-zinc-500';
                              fallback.textContent = member.user.fullName?.charAt(0) || '?';
                              target.parentElement?.appendChild(fallback);
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-500">
                            {member.user.fullName?.charAt(0) || "?"}
                          </span>
                        )}
                      </div>
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-zinc-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                          {member.user.fullName}
                        </span>
                        {isCreator && (
                          <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        @{member.user.username}
                        {isOnline && <span className="text-green-500 ml-1.5">• Online</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Media tabs (photos, videos, audio, docs) */}
        {activeTab !== "members" && (
          <div className="grid grid-cols-3 gap-2">
            {loadingMedia ? (
              <div className="col-span-3 flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                  {activeTab === "photos" && <Image className="h-5 w-5 text-zinc-600" />}
                  {activeTab === "videos" && <Video className="h-5 w-5 text-zinc-600" />}
                  {activeTab === "audio" && <Music className="h-5 w-5 text-zinc-600" />}
                  {activeTab === "docs" && <FileText className="h-5 w-5 text-zinc-600" />}
                </div>
                <p className="text-[11px] text-zinc-600 font-medium">
                  No {activeTab} shared yet
                </p>
              </div>
            ) : (
              mediaItems.map((item) => {
                const attachment = item.attachments?.[0];
                if (!attachment) return null;

                // Photos: show image thumbnails
                if (activeTab === "photos" && attachment.type === "image") {
                  return (
                    <div
                      key={item._id}
                      className="aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/40"
                    >
                      <img
                        src={attachment.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  );
                }

                // Videos: show video thumbnails
                if (activeTab === "videos" && attachment.type === "video") {
                  return (
                    <div
                      key={item._id}
                      className="aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/40 flex items-center justify-center relative group"
                    >
                      {attachment.url ? (
                        <video
                          src={attachment.url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                      ) : (
                        <Video className="h-6 w-6 text-zinc-600" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  );
                }

                // Audio: show audio items
                if (activeTab === "audio" && attachment.type === "voice_note") {
                  return (
                    <div
                      key={item._id}
                      className="col-span-3 flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/40"
                    >
                      <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                        <Music className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-zinc-300 truncate">
                          Voice note by {typeof item.sender === "object" ? item.sender.fullName : "Unknown"}
                        </p>
                        <p className="text-[9px] text-zinc-600">
                          {attachment.duration ? `${attachment.duration}s` : ""} · {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <audio src={attachment.url} controls className="h-8 w-32" preload="none" />
                    </div>
                  );
                }

                // Docs: show document items
                if (activeTab === "docs" && (attachment.type === "file" || attachment.type === "image")) {
                  return (
                    <div
                      key={item._id}
                      className="col-span-3 flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/40"
                    >
                      <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-zinc-300 truncate">
                          {attachment.url?.split("/").pop() || "File"}
                        </p>
                        <p className="text-[9px] text-zinc-600">
                          {new Date(item.createdAt).toLocaleDateString()} · by{" "}
                          {typeof item.sender === "object" ? item.sender.fullName : "Unknown"}
                        </p>
                      </div>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-zinc-400 hover:text-white transition-colors shrink-0"
                      >
                        Open
                      </a>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}
