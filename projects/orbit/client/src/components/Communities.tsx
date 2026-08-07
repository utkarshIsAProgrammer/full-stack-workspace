import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Hash,
  Users,
  Plus,
  ArrowLeft,
  ArrowRight,
  Send,
  Image,
  CornerDownLeft,
  X,
  Trash2,
  Edit3,
  Loader2,
  MessageSquare,
  AlertCircle,
  Pin,
  PinOff,
  Search,
  Copy,
  Share2,
  Mic,
  Play,
  Pause,
  Square,
  ChevronDown,
  Phone,
  Video,
  MoreVertical,
  LogOut,
  Bell,
  BellOff,
} from "lucide-react";
import type { Community, CommunityMessage, Conversation } from "../types";
import { apiFetch } from "../utils/api";
import { getCachedResponse, evictCachedResponse } from "../utils/apiCache";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { useKeyboardOpen } from "../hooks/useKeyboardOpen";
import { logger } from "../utils/logger";
import { downscaleImageFile } from "../utils/imageCompression";
import { optimizeImageUrl } from "../utils/imageUrls";

// Stable RegExp for matching community cache refresh events
// — module-level to prevent React effect re-attachment on every render.
const MATCHER_COMMUNITIES = /\/api\/communities/;
import MessageBubble from "./MessageBubble";
import EmojiReactionMenu from "./EmojiReactionMenu";
import CommunityLastActivity from "./CommunityLastActivity";
import GlassCard from "./GlassCard";
import ChatGallery from "./ChatGallery";
import CreateCommunityModal from "./CreateCommunityModal";
import CommunitySettingsPage from "./CommunitySettingsPage";
import CommunityProfileOverlay from "./CommunityProfileOverlay";
import ConfirmDialog from "./ConfirmDialog";
import ImageCropModal from "./ImageCropModal";
import GroupCallFloor from "./GroupCallFloor";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — matches uploadChatMedia backend limit

interface CommunitiesProps {
  user: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: { url: string; public_id?: string };
  };
  socket: any;
  onUserSelected?: (username: string) => void;
  onCommunityChatChange?: (isOpen: boolean) => void;
}

export default function Communities({ user, socket, onUserSelected, onCommunityChatChange }: CommunitiesProps) {
  const userId = user._id;
  const [view, setView] = useState<"list" | "chat" | "profile" | "settings">("list");
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityTab, setCommunityTab] = useState<"mine" | "browse">("mine");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<CommunityMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<CommunityMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: CommunityMessage;
  } | null>(null);
  const [sendingError, setSendingError] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmClearForMeOpen, setConfirmClearForMeOpen] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  // Community being left from the "My Communities" list row (header leave uses selectedCommunity)
  const [pendingLeaveCommunityId, setPendingLeaveCommunityId] = useState<string | null>(null);
  // Long-press / right-click context menu for "My Communities" list rows (mute / leave)
  const [communityMenu, setCommunityMenu] = useState<{
    x: number;
    y: number;
    community: Community;
  } | null>(null);

  // Voice note retry infrastructure (matching personal Chat.tsx)
  const activeUploadsRef = useRef<Record<string, AbortController>>({});
  const unsentPayloadsRef = useRef<Record<
    string,
    { type: "voice_note"; blob: Blob; url: string; duration: number; replyToId?: string }
  >>({});

  // Voice note recording state
  const [isRecording, setIsRecording] = useState(false);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldSendAfterRecordRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [leavingCommunity, setLeavingCommunity] = useState(false);
  const [joiningCommunities, setJoiningCommunities] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<CommunityMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CommunityMessage[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);


  // Group call state (LiveKit)
  const [showGroupCall, setShowGroupCall] = useState(false);
  const [groupCallToken, setGroupCallToken] = useState<string | null>(null);
  const [groupCallRoomName, setGroupCallRoomName] = useState<string>("");
  const [groupCallUrl, setGroupCallUrl] = useState<string>("");
  const [groupCallType, setGroupCallType] = useState<"audio" | "video">("video");
  const [startingCall, setStartingCall] = useState(false);
  // Active call announced by another member of the currently-open community
  const [activeCommunityCall, setActiveCommunityCall] = useState<{
    roomName: string;
    type: "audio" | "video";
    startedBy: string;
  } | null>(null);

  // Forward modal state
  const [forwardModal, setForwardModal] = useState<{
    message: CommunityMessage;
  } | null>(null);
  const [selectedForwardConvIds, setSelectedForwardConvIds] = useState<string[]>([]);
  const [forwardConversations, setForwardConversations] = useState<Conversation[]>([]);
  const [loadingForwardConvs, setLoadingForwardConvs] = useState(false);
  const [, setOnlineUsers] = useState<Set<string>>(new Set());
  const onlineUsersRef = useRef<Set<string>>(new Set());



  // Camera capture state
  const [showCamera, setShowCamera] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Image crop state
	// Drag-and-drop state
	const [isDragActive, setIsDragActive] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropQueueFiles, setCropQueueFiles] = useState<{ file: File; preview: string }[]>([]);
  const cropPendingQueueRef = useRef<{ file: File; preview: string }[]>([]);

  // Scroll to bottom
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 614);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isKeyboardOpen = useKeyboardOpen();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const communityMenuRef = useRef<HTMLDivElement>(null);
  const communityLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const communitySuppressClickRef = useRef(false);
  const messageSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic counter so only the LATEST search query's response is applied
  // — prevents out-of-order responses from older keystrokes overwriting newer
  // results when the free-tier backend answers slowly.
  const messageSearchSeqRef = useRef(0);

  // ─── Fetch communities ─────────────────────────────────────────	// `bypass` forces a network fetch — used after community mutations so the
	// lists always reflect the server's fresh flags (audio/video calls, messaging)
	// instead of a stale cached response with the old toggle values.
	const fetchMyCommunities = useCallback(async (bypass = false) => {
		try {
			const res = await apiFetch("/api/communities/mine", {
				...(bypass ? { bypassCache: true } : {}),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setMyCommunities(data.communities || []);
			}
		} catch (err) {
			logger.error("Failed to fetch my communities", err);
		}
	}, []);

	const fetchAllCommunities = useCallback(async (bypass = false) => {
		try {
			const res = await apiFetch("/api/communities?limit=50", {
				...(bypass ? { bypassCache: true } : {}),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setAllCommunities(data.communities || []);
			}
		} catch (err) {
			logger.error("Failed to fetch all communities", err);
		}
	}, []);

  // Cache-first: display cached community list instantly
  useEffect(() => {
    (async () => {
      try {
        const [cachedMine, cachedAll] = await Promise.all([
          getCachedResponse<{ communities: Community[] }>("/api/communities/mine"),
          getCachedResponse<{ communities: Community[] }>("/api/communities?limit=50"),
        ]);
        if (cachedMine?.communities?.length || cachedAll?.communities?.length) {
          if (cachedMine?.communities?.length) {
            setMyCommunities(cachedMine.communities);
          }
          if (cachedAll?.communities?.length) {
            setAllCommunities(cachedAll.communities);
          }
          setLoading(false);
        }
      } catch {
        // Cache miss or error — fall through to network fetch
      }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyCommunities(), fetchAllCommunities()]).finally(() =>
      setLoading(false)
    );
  }, [fetchMyCommunities, fetchAllCommunities]);

  // ─── Mobile detection ────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 614);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Fetch pinned messages ────────────────────────────────────
  const fetchPinnedMessages = useCallback(async (communityId: string) => {
    try {
      const res = await apiFetch(
        `/api/communities/${communityId}/pinned-messages`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setPinnedMessages(data.pinnedMessages || []);
      }
    } catch (err) {
      logger.error("Failed to fetch pinned messages", err);
    }
  }, []);

  // ─── Fetch messages for selected community ─────────────────────
  // When the background cache timer refreshes community data, re-fetch
  // so the list stays up-to-date without manual refresh.
  useCacheRefresh(MATCHER_COMMUNITIES, () => {
    fetchMyCommunities();
    fetchAllCommunities();
  });

  const fetchMessages = useCallback(
    async (communityId: string, cursorVal?: string | null) => {
      setLoadingMessages(true);
      try {
        const url = cursorVal
          ? `/api/communities/${communityId}/messages?cursor=${cursorVal}&limit=30`
          : `/api/communities/${communityId}/messages?limit=30`;
        const res = await apiFetch(url);
        const data = await res.json();
        if (res.ok && data.success) {
          if (cursorVal) {
            setMessages((prev) => [...data.messages, ...prev]);
          } else {
            setMessages(data.messages || []);
          }
          setHasMore(data.hasMore);
          setCursor(data.nextCursor);
        }
      } catch (err) {
        logger.error("Failed to fetch community messages", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  const handleSelectCommunity = useCallback(
    (community: Community) => {
      setSelectedCommunity(community);
      setView("chat");
      setMessages([]);
      setHasMore(true);
      setCursor(null);
      setReplyTo(null);
      setEditingMessage(null);
      setPinnedMessages([]);
      setShowMessageSearch(false);
      setMessageSearchQuery("");
      setSearchResults([]);
      // Cache-first: display cached messages instantly
      (async () => {
        try {
          const cached = await getCachedResponse<{ messages: CommunityMessage[]; hasMore: boolean; nextCursor: string | null }>(
            `/api/communities/${community._id}/messages?limit=30`
          );
          if (cached?.messages?.length) {
            setMessages(cached.messages);
            setHasMore(cached.hasMore);
            setCursor(cached.nextCursor);
            setLoadingMessages(false);
          }
        } catch {
          // Cache miss — fall through to network fetch
        }
      })();
      fetchMessages(community._id);
      fetchPinnedMessages(community._id);
    },
    [fetchMessages, fetchPinnedMessages]
  );

  // ─── Notify parent when a community chat is opened/closed ─────
  useEffect(() => {
    onCommunityChatChange?.(selectedCommunity !== null);
    return () => onCommunityChatChange?.(false);
  }, [selectedCommunity, onCommunityChatChange]);

  // Tracks the community id the active-call banner belongs to (set when the
  // banner appears), so a live banner isn't wiped by a re-run of the socket
  // effect — which happens on every selectedCommunity identity change
  // (member count, presence, toggle events all create a new object). The
  // banner is only cleared when the user switches to a different community
  // or the call actually ends.
  const activeCallBannerCommunityRef = useRef<string | null>(null);
  // Always-current community id, updated during render so effect cleanups
  // can tell whether the selected community changed between effect runs.
  const selectedCommunityIdRef = useRef<string | null>(selectedCommunity?._id ?? null);
  selectedCommunityIdRef.current = selectedCommunity?._id ?? null;
  // Tracks which community already requested a call-status check, so the
  // "community:call-status" request (and its toast) fires only once per
  // community open instead of on every effect re-run.
  const callStatusRequestedRef = useRef<string | null>(null);

  // ─── Socket events ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedCommunity) return;

    const communityId = selectedCommunity._id;

    // Join the community room
    socket.emit("community:join", { communityId });
    // Mark messages as seen when opening the chat
    socket.emit("community:seen", { communityId });
    if (callStatusRequestedRef.current !== communityId) {
      callStatusRequestedRef.current = communityId;
      socket.emit("community:call-status", { communityId });
    }

    // Listen for seen updates (other members reading messages)
    const handleSeenUpdate = (data: {
      communityId: string;
      messageIds: string[];
      seenByUserId: string;
    }) => {
      if (data.communityId === communityId) {
        setMessages((prev) =>
          prev.map((m) =>
            data.messageIds.includes(m._id)
              ? {
                  ...m,
                  seenBy: [...(m.seenBy || []), data.seenByUserId as any],
                }
              : m
          )
        );
      }
    };

    const handleNewMessage = (message: CommunityMessage) => {
      if (message.community === communityId) {
        // Dedup: don't add messages that already exist (prevents voice note optimistic dupes)
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          // When our own message comes back over the socket, strip its
          // optimistic pending copy ("pending-..." ids never match the server
          // id, so it would otherwise be appended alongside the optimistic one
          // → the sender sees the same voice note / message twice). Only do
          // this for OUR messages so other members' traffic never removes a
          // failed/retry pending bubble.
          const isOwnMessage = message.sender?._id === userId;
          const filtered = isOwnMessage
            ? prev.filter(
                (m) =>
                  !m._id.startsWith("pending-") ||
                  (m as any).community !== message.community,
              )
            : prev;
          return [...filtered, message];
        });
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    };

    const handleEditMessage = (message: CommunityMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? message : m))
      );
    };

    const handleDeleteMessage = ({
      messageId,
    }: {
      messageId: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, text: "This message was deleted", attachments: [] }
            : m
        )
      );
    };

    // Realtime delete-for-me: only the deleting user renders the placeholder;
    // other members keep seeing the original message.
    const handleDeleteForMeSocket = ({
      messageId,
      deletedByUserId,
    }: {
      messageId: string;
      deletedByUserId: string;
    }) => {
      if (deletedByUserId !== userId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                isDeleted: true,
                text: "This message was deleted",
                attachments: [],
                deletedFor: [...(m.deletedFor || []), deletedByUserId],
              }
            : m
        )
      );
    };

    const handleReaction = ({
      messageId,
      message,
    }: {
      messageId: string;
      message: CommunityMessage;
    }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? message : m))
      );
    };

    const handleTyping = ({
      userId: typingUserId,
      isTyping,
    }: {
      userId: string;
      isTyping: boolean;
    }) => {
      if (typingUserId === userId) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          return { ...prev, [typingUserId]: typingUserId };
        } else {
          const next = { ...prev };
          delete next[typingUserId];
          return next;
        }
      });
    };

    const handlePinUpdate = (data: {
      communityId: string;
      pinnedMessages: CommunityMessage[];
    }) => {
      if (data.communityId === communityId) {
        setPinnedMessages(data.pinnedMessages || []);
      }
    };

    socket.on("community:message:new", handleNewMessage);
    socket.on("community:message:edit", handleEditMessage);
    socket.on("community:message:delete", handleDeleteMessage);
    socket.on("community:message:delete-for-me", handleDeleteForMeSocket);
    socket.on("community:message:reaction", handleReaction);
    socket.on("community:message:pinned", handlePinUpdate);
    socket.on("community:message:unpinned", handlePinUpdate);
    socket.on("community:typing", handleTyping);
    socket.on("community:seen-update", handleSeenUpdate);

    // Handle presence sync for community members (green dots)
    const handlePresenceSync = (data: { communityId: string; onlineUserIds: string[] }) => {
      if (data.communityId === communityId) {
        const newSet = new Set(data.onlineUserIds);
        onlineUsersRef.current = newSet;
        setOnlineUsers(newSet);
      }
    };
    socket.on("community:presence:sync", handlePresenceSync);

    // Live presence changes: a member connected/disconnected while we're
    // viewing this community — update their green dot in realtime (mirrors
    // the personal-chat `user:presence` behavior for community members).
    const handleCommunityPresence = (data: {
      communityId: string;
      userId: string;
      status: "online" | "offline";
    }) => {
      if (data.communityId !== communityId) return;
      if (data.userId === userId) return;
      const next = new Set(onlineUsersRef.current);
      if (data.status === "online") {
        next.add(data.userId);
      } else {
        next.delete(data.userId);
      }
      onlineUsersRef.current = next;
      setOnlineUsers(next);
    };
    socket.on("community:presence", handleCommunityPresence);

    // Handle group call announcements from other members
    const handleCallStarted = (data: {
      communityId: string;
      roomName: string;
      type: "audio" | "video";
      startedBy: string;
    }) => {
      if (data.communityId !== communityId) return;
      if (data.startedBy === userId) return; // own call already tracked
      activeCallBannerCommunityRef.current = data.communityId;
      setActiveCommunityCall({
        roomName: data.roomName,
        type: data.type,
        startedBy: data.startedBy,
      });
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message:
              data.type === "video"
                ? "A member started a group video call — tap to join!"
                : "A member started a group audio call — tap to join!",
            type: "success",
          },
        }),
      );
    };
    const handleCallEnded = (data: { communityId: string }) => {
      if (data.communityId !== communityId) return;
      activeCallBannerCommunityRef.current = null;
      setActiveCommunityCall(null);
    };
    socket.on("community:call-started", handleCallStarted);
    socket.on("community:call-ended", handleCallEnded);

    return () => {
      socket.emit("community:leave", { communityId });
      socket.off("community:message:new", handleNewMessage);
      socket.off("community:message:edit", handleEditMessage);
      socket.off("community:message:delete", handleDeleteMessage);
      socket.off("community:message:delete-for-me", handleDeleteForMeSocket);
      socket.off("community:message:reaction", handleReaction);
      socket.off("community:message:pinned", handlePinUpdate);
      socket.off("community:message:unpinned", handlePinUpdate);
      socket.off("community:typing", handleTyping);
      socket.off("community:seen-update", handleSeenUpdate);
      socket.off("community:presence:sync", handlePresenceSync);
      socket.off("community:presence", handleCommunityPresence);
      socket.off("community:call-started", handleCallStarted);
      socket.off("community:call-ended", handleCallEnded);
      // Clear the banner only when the user is no longer viewing the
      // community the banner belongs to (e.g. switched to a different
      // community). The effect itself re-runs on every selectedCommunity
      // identity change, and wiping the banner there would flash the
      // "join call" button off the moment it appears.
      if (selectedCommunityIdRef.current !== activeCallBannerCommunityRef.current) {
        activeCallBannerCommunityRef.current = null;
        setActiveCommunityCall(null);
      }
    };
  }, [socket, selectedCommunity, userId]);

  // ─── Real-time member count updates (global, not tied to selectedCommunity) ─
  useEffect(() => {
    if (!socket) return;

    const handleMemberUpdate = (data: {
      communityId: string;
      memberCount: number;
    }) => {
      setMyCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, memberCount: data.memberCount } : c
        )
      );
      setAllCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, memberCount: data.memberCount } : c
        )
      );
      // Also update selectedCommunity so the chat header shows live count
      setSelectedCommunity((prev) =>
        prev?._id === data.communityId
          ? { ...prev, memberCount: data.memberCount }
          : prev
      );
    };

    const handleCommunityUpdate = (data: {
      communityId: string;
      community: Community;
    }) => {
      setMyCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? data.community : c
        )
      );
      setAllCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...data.community, isMember: c.isMember ?? data.community.isMember } : c
        )
      );
      setSelectedCommunity((prev) =>
        prev?._id === data.communityId ? data.community : prev
      );
    };

    // ─── Keep community list previews live (last message / last action) ──
    // These listeners run for ALL joined communities (not just the open chat)
    // so "My Communities" shows the latest activity even without opening a chat.
    const updateAllCommunityLists = (
      updater: (c: Community) => Community
    ) => {
      setMyCommunities((prev) => prev.map(updater));
      setAllCommunities((prev) => prev.map(updater));
      setSelectedCommunity((prev) => (prev ? updater(prev) : prev));
    };

    const buildLastMessageSnapshot = (message: CommunityMessage) => ({
      messageId: message._id,
      text: message.text || "",
      attachmentType: message.attachments?.[0]?.type || "",
      sender: {
        _id: message.sender?._id,
        fullName: message.sender?.fullName,
        username: message.sender?.username,
      },
      createdAt: message.createdAt,
      isDeleted: false,
    });

    const handlePreviewNewMessage = (message: CommunityMessage) => {
      const cId = message.community;
      updateAllCommunityLists((c) =>
        c._id === cId
          ? {
              ...c,
              lastMessage: buildLastMessageSnapshot(message),
              lastAction: null,
            }
          : c
      );
      // A reload must not serve a stale cached list without the new preview
      evictCachedResponse("/api/communities/mine");
      evictCachedResponse("/api/communities?limit=50");
    };

    const handlePreviewEditMessage = (message: CommunityMessage) => {
      const cId = message.community;
      updateAllCommunityLists((c) => {
        if (c._id !== cId || c.lastMessage?.messageId !== message._id) {
          return c;
        }
        return {
          ...c,
          lastMessage: {
            ...c.lastMessage,
            text: message.text || "",
            attachmentType: message.attachments?.[0]?.type || "",
          },
          // Mirror the server: editing the newest message surfaces an action
          lastAction: {
            type: "message_edit",
            messageId: message._id,
            messageSenderId: message.sender?._id,
            actor: message.sender
              ? {
                  _id: message.sender._id,
                  fullName: message.sender.fullName,
                  username: message.sender.username,
                }
              : null,
            createdAt: new Date().toISOString(),
          },
        };
      });
    };

    const handlePreviewReaction = ({
      messageId,
      type,
      emoji,
      actor,
      message,
    }: {
      messageId: string;
      type: "add" | "remove";
      emoji?: string;
      actor?: { _id: string; fullName?: string; username?: string } | null;
      message: CommunityMessage;
    }) => {
      const cId = message.community;
      updateAllCommunityLists((c) => {
        if (c._id !== cId) return c;
        const isLast = c.lastMessage?.messageId === messageId;
        if (type === "add" && isLast) {
          return {
            ...c,
            lastAction: {
              type: "reaction",
              emoji: emoji || "",
              messageId,
              messageSenderId: message.sender?._id,
              actor: actor
                ? { _id: actor._id, fullName: actor.fullName, username: actor.username }
                : null,
              createdAt: new Date().toISOString(),
            },
          };
        }
        if (type === "remove" && c.lastAction?.messageId === messageId) {
          return { ...c, lastAction: null };
        }
        return c;
      });
    };

    const handlePreviewPin = ({
      communityId,
      messageId,
      messageSenderId,
      actor,
    }: {
      communityId: string;
      messageId: string;
      messageSenderId?: string;
      actor?: { _id: string; fullName?: string; username?: string } | null;
    }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId
          ? {
              ...c,
              lastAction: {
                type: "pin",
                messageId,
                messageSenderId,
                actor: actor || null,
                createdAt: new Date().toISOString(),
              },
            }
          : c
      );
    };

    const handlePreviewUnpin = ({
      communityId,
      messageId,
      actor,
    }: {
      communityId: string;
      messageId: string;
      actor?: { _id: string; fullName?: string; username?: string } | null;
    }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId
          ? {
              ...c,
              lastAction: {
                type: "unpin",
                messageId,
                actor: actor || null,
                createdAt: new Date().toISOString(),
              },
            }
          : c
      );
    };

    const handlePreviewCallStarted = ({
      communityId,
      type,
      actor,
    }: {
      communityId: string;
      type: "audio" | "video";
      actor?: { _id: string; fullName?: string; username?: string } | null;
    }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId
          ? {
              ...c,
              lastAction: {
                type: "call",
                callType: type,
                callStatus: "started",
                actor: actor || null,
                createdAt: new Date().toISOString(),
              },
            }
          : c
      );
    };

    const handlePreviewCallEnded = ({
      communityId,
      type,
      actor,
    }: {
      communityId: string;
      type?: "audio" | "video";
      actor?: { _id: string; fullName?: string; username?: string } | null;
    }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId
          ? {
              ...c,
              lastAction: {
                type: "call",
                callType: type || c.lastAction?.callType || "audio",
                callStatus: "ended",
                actor: actor || c.lastAction?.actor || null,
                createdAt: new Date().toISOString(),
              },
            }
          : c
      );
    };

    const handlePreviewDeleteMessage = ({
      messageId,
      communityId,
    }: {
      messageId: string;
      communityId: string;
    }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId && c.lastMessage?.messageId === messageId
          ? {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                text: "This message was deleted",
                attachmentType: "",
                isDeleted: true,
              },
              lastAction: null,
            }
          : c
      );
    };

    const handlePreviewChatCleared = ({ communityId }: { communityId: string }) => {
      updateAllCommunityLists((c) =>
        c._id === communityId ? { ...c, lastMessage: null, lastAction: null } : c
      );
    };

    socket.on("community:message:new", handlePreviewNewMessage);
    socket.on("community:message:edit", handlePreviewEditMessage);
    socket.on("community:message:reaction", handlePreviewReaction);
    socket.on("community:message:pinned", handlePreviewPin);
    socket.on("community:message:unpinned", handlePreviewUnpin);
    socket.on("community:call-started", handlePreviewCallStarted);
    socket.on("community:call-ended", handlePreviewCallEnded);
    socket.on("community:message:delete", handlePreviewDeleteMessage);
    socket.on("community:chat-cleared", handlePreviewChatCleared);

    socket.on("community:member-joined", handleMemberUpdate);
    socket.on("community:member-left", handleMemberUpdate);
    const handleCommunityDeletedEvent = (data: { communityId: string }) => {
      handleCommunityDeleted(data.communityId);
    };

    socket.on("community:updated", handleCommunityUpdate);
    socket.on("community:deleted", handleCommunityDeletedEvent);

    // Listen for messaging/calls toggle events
    socket.on("community:messaging-toggled", (data: { communityId: string; messagingEnabled: boolean }) => {
      setSelectedCommunity((prev) =>
        prev?._id === data.communityId
          ? { ...prev, messagingEnabled: data.messagingEnabled }
          : prev
      );
      setMyCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, messagingEnabled: data.messagingEnabled } : c
        )
      );
      setAllCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, messagingEnabled: data.messagingEnabled } : c
        )
      );
    });

    socket.on("community:calls-toggled", (data: { communityId: string; audioCallEnabled?: boolean; videoCallEnabled?: boolean }) => {
      setSelectedCommunity((prev) =>
        prev?._id === data.communityId
          ? { ...prev, audioCallEnabled: data.audioCallEnabled ?? prev?.audioCallEnabled, videoCallEnabled: data.videoCallEnabled ?? prev?.videoCallEnabled }
          : prev
      );
      setMyCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, audioCallEnabled: data.audioCallEnabled ?? c.audioCallEnabled, videoCallEnabled: data.videoCallEnabled ?? c.videoCallEnabled } : c
        )
      );
      setAllCommunities((prev) =>
        prev.map((c) =>
          c._id === data.communityId ? { ...c, audioCallEnabled: data.audioCallEnabled ?? c.audioCallEnabled, videoCallEnabled: data.videoCallEnabled ?? c.videoCallEnabled } : c
        )
      );
    });

    // ─── Track online users via presence events ─────
    const handlePresence = ({
      userId: presenceUserId,
      status,
    }: {
      userId: string;
      status: "online" | "offline";
    }) => {
      if (status === "online") {
        onlineUsersRef.current.add(presenceUserId);
      } else {
        onlineUsersRef.current.delete(presenceUserId);
      }
      setOnlineUsers(new Set(onlineUsersRef.current));
    };
    socket.on("user:presence", handlePresence);

    return () => {
      socket.off("community:message:new", handlePreviewNewMessage);
      socket.off("community:message:edit", handlePreviewEditMessage);
      socket.off("community:message:reaction", handlePreviewReaction);
      socket.off("community:message:pinned", handlePreviewPin);
      socket.off("community:message:unpinned", handlePreviewUnpin);
      socket.off("community:call-started", handlePreviewCallStarted);
      socket.off("community:call-ended", handlePreviewCallEnded);
      socket.off("community:message:delete", handlePreviewDeleteMessage);
      socket.off("community:chat-cleared", handlePreviewChatCleared);
      socket.off("community:member-joined", handleMemberUpdate);
      socket.off("community:member-left", handleMemberUpdate);
      socket.off("community:updated", handleCommunityUpdate);
      socket.off("community:deleted", handleCommunityDeletedEvent);
      socket.off("user:presence", handlePresence);
    };
  }, [socket]);

  // ─── Join all community rooms so we receive live member count updates ──
  useEffect(() => {
    if (!socket) return;
    myCommunities.forEach((c) => {
      socket.emit("community:join", { communityId: c._id });
    });
    return () => {
      myCommunities.forEach((c) => {
        socket.emit("community:leave", { communityId: c._id });
      });
    };
  }, [socket, myCommunities]);

  // Inject waveform animation keyframes
  useEffect(() => {
    const styleId = "community-waveform-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes waveform {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        .waveform-bar {
          transform-origin: center bottom;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [view]);
  // ─── Typing indicator ──────────────────────────────────────────
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !selectedCommunity) return;
      socket.emit("community:typing", {
        communityId: selectedCommunity._id,
        isTyping,
      });
    },
    [socket, selectedCommunity]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);

    // Emit typing
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000);

    // Auto-resize
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // ─── Voice Note Recording ─────────────────────────────────────────
  const getAudioMimeType = (): { mimeType: string; extension: string } => {
    const candidates = [
      { mimeType: "audio/webm;codecs=opus", extension: "webm" },
      { mimeType: "audio/webm", extension: "webm" },
      { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "mp4" },
      { mimeType: "audio/mp4", extension: "mp4" },
      { mimeType: "audio/aac", extension: "aac" },
      { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
      { mimeType: "audio/wav", extension: "wav" },
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    }
    return { mimeType: "", extension: "webm" };
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        audioChunksRef.current = [];
        setRecordingDuration(0);

        const { mimeType } = getAudioMimeType();
        const recorderOptions: any = { audioBitsPerSecond: 128000 };
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(stream, recorderOptions);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const actualMimeType = mimeType || recorder.mimeType || "audio/webm";
          const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
          stream.getTracks().forEach((track) => track.stop());

          if (shouldSendAfterRecordRef.current) {
            shouldSendAfterRecordRef.current = false;
            handleSendVoiceNote(blob, recordingDurationRef.current);
          } else {
            setRecordedBlob(blob);
            setRecordedUrl(URL.createObjectURL(blob));
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);

        recordingDurationRef.current = 0;
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => {
            const next = prev + 1;
            recordingDurationRef.current = next;
            return next;
          });
        }, 1000);
      } catch (err) {
        logger.error("Failed to start recording", err);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: "Microphone access denied. Please allow microphone permissions.",
              type: "error",
            },
          })
        );
      }
    }
  };

  const handleMicClick = (_e: React.MouseEvent) => {
    handleMicToggle();
  };

  const handleSendVoiceNote = async (overrideBlob?: Blob, overrideDuration?: number) => {
    const targetBlob = overrideBlob || recordedBlob;
    const targetUrl = overrideBlob ? URL.createObjectURL(overrideBlob) : recordedUrl;
    const targetDuration = overrideDuration !== undefined ? overrideDuration : recordingDuration;

    if (!selectedCommunity || !targetBlob || !targetUrl) return;

    // Guard against double-sends (e.g. the mic-toggle flow firing twice)
    if (sending) return;

    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Snapshot replyTo BEFORE clearing state
    const replyToSnapshot = replyTo ? { ...replyTo } : null;

    const optimisticMessage: any = {
      _id: pendingId,
      _pending: true,
      community: selectedCommunity._id,
      sender: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePic: user.profilePic,
      },
      text: "",
      replyTo: replyToSnapshot
        ? {
            _id: replyToSnapshot._id,
            sender: replyToSnapshot.sender,
            text: replyToSnapshot.text,
            attachments: replyToSnapshot.attachments,
            createdAt: replyToSnapshot.createdAt,
          }
        : null,
      attachments: [
        {
          url: targetUrl,
          type: "voice_note",
          duration: targetDuration,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save payload for retry before clearing UI
    unsentPayloadsRef.current[pendingId] = {
      type: "voice_note",
      blob: targetBlob,
      url: targetUrl,
      duration: targetDuration,
      replyToId: replyToSnapshot?._id,
    };

    const controller = new AbortController();
    activeUploadsRef.current[pendingId] = controller;

    setMessages((prev) => [...prev, optimisticMessage]);
    setSending(true);

    // Clear recording UI immediately
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setIsPlayingPreview(false);
    setReplyTo(null);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const formData = new FormData();
      formData.append("text", "");
      const blobMime = targetBlob.type || "audio/webm";
      const ext =
        blobMime.includes("mp4") || blobMime.includes("aac")
          ? "mp4"
          : blobMime.includes("ogg")
            ? "ogg"
            : blobMime.includes("wav")
              ? "wav"
              : "webm";
      const audioFile = new File([targetBlob], `voice-${Date.now()}.${ext}`, { type: blobMime });
      formData.append("files", audioFile);
      formData.append("duration", String(targetDuration));

      if (replyToSnapshot) {
        formData.append("replyTo", replyToSnapshot._id);
      }

      const res = await apiFetch(`/api/communities/${selectedCommunity._id}/messages`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        delete unsentPayloadsRef.current[pendingId];
        delete activeUploadsRef.current[pendingId];
        setMessages((prev) =>
          prev.map((m) => (m._id === pendingId ? (data.sentMessage || data.message || data.editedMessage) : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m._id === pendingId ? { ...m, _pending: false, _failed: true } : m))
        );
        logger.error("Voice note send failed", data?.message);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.info("Voice note upload aborted by user");
        return;
      }
      logger.error("Failed to send voice note", err);
      setMessages((prev) =>
        prev.map((m) => (m._id === pendingId ? { ...m, _pending: false, _failed: true } : m))
      );
    } finally {
      setSending(false);
    }
  };

  // ─── File selection ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Enforce file count limit (max 5 total, matching backend route)
    const maxAllowed = 5 - selectedFiles.length;
    if (maxAllowed <= 0) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Maximum 5 files allowed.", type: "error" },
        }),
      );
      if (e.target) e.target.value = "";
      return;
    }
    const validFiles = files.slice(0, maxAllowed);

    // Filter out oversized files (50MB per file limit matching backend)
    const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE);
    oversized.forEach((f) => {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: `"${f.name}" exceeds the 50MB size limit.`, type: "error" },
        }),
      );
    });
    const okFiles = validFiles.filter((f) => f.size <= MAX_FILE_SIZE);
    if (okFiles.length === 0) {
      if (e.target) e.target.value = "";
      return;
    }

    const images: { file: File; preview: string }[] = [];
    const otherFiles: File[] = [];

    okFiles.forEach((f) => {
      if (f.type.startsWith("image/")) {
        images.push({ file: f, preview: URL.createObjectURL(f) });
      } else if (f.type.startsWith("video/") || f.type.startsWith("audio/") || f.type.startsWith("application/") || f.type.startsWith("text/")) {
        otherFiles.push(f);
      }
    });

    if (images.length > 0) {
      // Store images in the crop queue and open the crop modal for the first one
      const queue = images.map((img) => ({ file: img.file, preview: img.preview }));
      cropPendingQueueRef.current = queue;
      setCropQueueFiles(queue);
      setCropSrc(queue[0].preview);
      setCropModalOpen(true);
    }

    if (otherFiles.length > 0) {
      const previews = otherFiles.map((f) => URL.createObjectURL(f));
      setSelectedFiles((prev) => [...prev, ...otherFiles]);
      setFilePreviews((prev) => [...prev, ...previews]);
    }

    if (e.target) e.target.value = "";
  };

  // Handle crop completion
  const handleCropComplete = (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(croppedBlob);

    setSelectedFiles((prev) => [...prev, croppedFile]);
    setFilePreviews((prev) => [...prev, previewUrl]);

    // Advance to next queued image (the modal is about to close via ImageCropModal's internal onClose call)
    // We schedule the next open AFTER the current frame so onClose doesn't clobber it
    const remaining = cropQueueFiles.slice(1);
    if (remaining.length > 0) {
      cropPendingQueueRef.current = remaining;
      setCropQueueFiles(remaining);
      setCropSrc(remaining[0].preview);
      // Open the modal on the next frame AFTER ImageCropModal calls onClose
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCropModalOpen(true);
        });
      });
    } else {
      cropPendingQueueRef.current = [];
      setCropQueueFiles([]);
      setCropSrc(null);
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(filePreviews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Cleanup file previews on unmount
  useEffect(() => {
    return () => {
      filePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Camera capture ─────────────────────────────────────────────
  const handleCapturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      const preview = URL.createObjectURL(blob);
      setSelectedFiles((prev) => [...prev, file]);
      setFilePreviews((prev) => [...prev, preview]);
      handleCloseCamera();
    }, "image/jpeg", 0.9);
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  };

  // ─── Send message ──────────────────────────────────────────────
  const handleSendMessage = async () => {
    // If currently recording, stop and send the voice note instead
    if (isRecording) {
      shouldSendAfterRecordRef.current = true;
      handleMicToggle();
      return;
    }
    if ((!messageInput.trim() && selectedFiles.length === 0) || sending) return;
    if (!selectedCommunity) return;

    // Snapshot the text/attachments/reply before any state changes
    const textToSend = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const previewsToClear = [...filePreviews];
    const replyToSend = replyTo ? { ...replyTo } : null;

    // ─── Optimistic: show message immediately ───────────────────
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Build attachments array from selected files for the optimistic preview
    const optimisticAttachments: any[] = [];
    filesToSend.forEach((file, idx) => {
      const previewUrl = previewsToClear[idx] || URL.createObjectURL(file);
      const fileType = file.type;
      let attType: string = "file";
      if (fileType.startsWith("image/") && fileType !== "image/gif") attType = "image";
      else if (fileType === "image/gif") attType = "gif";
      else if (fileType.startsWith("video/")) attType = "video";
      else if (fileType.startsWith("audio/")) attType = "voice_note";
      optimisticAttachments.push({ url: previewUrl, type: attType });
    });

    const optimisticMessage: any = {
      _id: pendingId,
      _pending: true,
      community: selectedCommunity._id,
      sender: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePic: user.profilePic,
      },
      text: textToSend,
      replyTo: replyToSend
        ? {
            _id: replyToSend._id,
            sender: replyToSend.sender,
            text: replyToSend.text,
            attachments: replyToSend.attachments,
            createdAt: replyToSend.createdAt,
          }
        : null,
      attachments: optimisticAttachments,
      reactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      isEdited: false,
    };

    // Add optimistic message and clear input immediately
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageInput("");
    setSelectedFiles([]);
    setFilePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setReplyTo(null);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    setSending(true);
    setSendingError(null);
    emitTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const formData = new FormData();
      formData.append("text", textToSend);
      if (replyToSend) {
        formData.append("replyTo", replyToSend._id);
      }
      for (const file of filesToSend) {
        // Downscale photos before upload (shared util) — keeps sends fast.
        // Non-images (video / audio / docs / GIFs) pass through untouched.
        formData.append(
          "files",
          file.type.startsWith("image/") ? await downscaleImageFile(file) : file
        );
      }

      const res = await apiFetch(
        `/api/communities/${selectedCommunity._id}/messages`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        // Replace pending message with the real one from the server
        setMessages((prev) =>
          prev.map((m) => (m._id === pendingId ? (data.sentMessage || data.message || data.editedMessage) : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m._id === pendingId ? { ...m, _pending: false, _failed: true } : m))
        );
        setSendingError(data.message || "Failed to send message");
      }
    } catch (err) {
      logger.error("Failed to send message", err);
      setMessages((prev) =>
        prev.map((m) => (m._id === pendingId ? { ...m, _pending: false, _failed: true } : m))
      );
      setSendingError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // ─── Message actions (reply, edit, delete) ─────────────────────
  const handleReply = (message: CommunityMessage) => {
    setReplyTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const handleEdit = (message: CommunityMessage) => {
    setEditingMessage(message);
    setReplyTo(null);
    setMessageInput(message.text);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessageInput("");
  };

  const handleDeleteForMe = async (messageId: string) => {
    try {
      const res = await apiFetch(
        `/api/communities/messages/${messageId}/delete-for-me`,
        { method: "DELETE" }
      );
      if (res.ok) {
        // Mark as deleted (placeholder) for me only — others still see it.
        // Matches personal-chat behavior; the server keeps the message with
        // our id in deletedFor so the placeholder survives reloads.
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  text: "This message was deleted",
                  attachments: [],
                  deletedFor: [...(m.deletedFor || []), userId],
                }
              : m
          )
        );
      }
    } catch (err) {
      logger.error("Failed to delete message for me", err);
    }
    setContextMenu(null);
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await apiFetch(
        `/api/communities/messages/${messageId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, isDeleted: true, text: "This message was deleted", attachments: [] }
              : m
          )
        );
      }
    } catch (err) {
      logger.error("Failed to delete message", err);
    }
    setContextMenu(null);
  };

	// ─── Drag-and-Drop Handlers ─────────────────────────────────
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragActive(false);
		}
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);
		const droppedFiles = Array.from(e.dataTransfer.files || []);
		if (droppedFiles.length === 0) return;
		const syntheticEvent = {
			target: { files: droppedFiles as any, value: "" },
		} as React.ChangeEvent<HTMLInputElement>;
		handleFileSelect(syntheticEvent);
	}, [handleFileSelect]);

  const handleEditSubmit = async () => {
    if (!editingMessage || !messageInput.trim()) return;
    try {
      const res = await apiFetch(
        `/api/communities/messages/${editingMessage._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageInput.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === editingMessage._id ? data.editedMessage : m
          )
        );
        setEditingMessage(null);
        setMessageInput("");
      }
    } catch (err) {
      logger.error("Failed to edit message", err);
    }
  };

  const handleReaction = async (message: CommunityMessage, emoji: string) => {
    const trimmedEmoji = emoji.trim();
    const optimisticReactions = [...(message.reactions || [])];
    const existingIndex = optimisticReactions.findIndex((r) => {
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      return sId === userId && r.emoji === trimmedEmoji;
    });

    // Optimistic toggle/replace — ONE reaction per user. Clicking the same
    // emoji removes it; clicking a different one replaces the previous.
    let nextReactions = optimisticReactions.filter((r) => {
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      return sId !== userId;
    });
    if (existingIndex < 0) {
      nextReactions = [
        ...nextReactions,
        {
          _id: Date.now().toString(), // temp ID
          emoji: trimmedEmoji,
          sender: {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            profilePic: user.profilePic,
          },
          createdAt: new Date().toISOString(),
        } as any,
      ];
    }
    setMessages((prev) =>
      prev.map((m) =>
        m._id === message._id ? { ...m, reactions: nextReactions } : m,
      ),
    );

    try {
      const res = await apiFetch(
        `/api/communities/messages/${message._id}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji: trimmedEmoji }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        // Sync with the exact backend response (server returns the full list)
        if (data.reactions) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === message._id
                ? { ...m, reactions: data.reactions }
                : m,
            ),
          );
        }
        // A reload must not serve the stale cached message list (which would
        // make the reaction appear "removed" — the cache holds the pre-reaction
        // snapshot). Evict the open community's message cache so the next load
        // re-fetches fresh data.
        evictCachedResponse(
          `/api/communities/${message.community}/messages?limit=30`,
        );
      } else {
        logger.error("Reaction failed", data?.message);
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? message : m)),
        );
      }
    } catch (err) {
      logger.error("Failed to toggle reaction", err);
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? message : m)),
      );
    }
  };

  // Viewport-safe positioning: after the context menu mounts, measure its
// actual dimensions and adjust position to keep it fully within the viewport.
useLayoutEffect(() => {
  if (!contextMenu || !contextMenuRef.current) return;
  const menu = contextMenuRef.current;
  const rect = menu.getBoundingClientRect();
  let adjX = rect.left;
  let adjY = rect.top;
  if (rect.right > window.innerWidth) adjX = window.innerWidth - rect.width - 12;
  if (rect.left < 12) adjX = 12;
  if (rect.bottom > window.innerHeight) adjY = window.innerHeight - rect.height - 12;
  if (rect.top < 12) adjY = 12;
  if (adjX !== rect.left || adjY !== rect.top) {
    menu.style.left = adjX + "px";
    menu.style.top = adjY + "px";
  }
}, [contextMenu]);

// Viewport-safe positioning for the "My Communities" row context menu
useLayoutEffect(() => {
  if (!communityMenu || !communityMenuRef.current) return;
  const menu = communityMenuRef.current;
  const rect = menu.getBoundingClientRect();
  let adjX = rect.left;
  let adjY = rect.top;
  if (rect.right > window.innerWidth) adjX = window.innerWidth - rect.width - 12;
  if (rect.left < 12) adjX = 12;
  if (rect.bottom > window.innerHeight) adjY = window.innerHeight - rect.height - 12;
  if (rect.top < 12) adjY = 12;
  if (adjX !== rect.left || adjY !== rect.top) {
    menu.style.left = adjX + "px";
    menu.style.top = adjY + "px";
  }
}, [communityMenu]);

// ─── Context menu handlers ─────────────────────────────────────
  // ─── Pin/Unpin handlers ──────────────────────────────────────
  const handlePinMessage = async (messageId: string) => {
    try {
      await apiFetch(`/api/communities/messages/${messageId}/pin`, {
        method: "POST",
      });
    } catch (err) {
      logger.error("Failed to pin message", err);
    }
    setContextMenu(null);
  };

  const handleUnpinMessage = async (messageId: string) => {
    try {
      await apiFetch(`/api/communities/messages/${messageId}/unpin`, {
        method: "POST",
      });
    } catch (err) {
      logger.error("Failed to unpin message", err);
    }
    setContextMenu(null);
  };

  // Check if a message is currently pinned
  const isMessagePinned = (messageId: string) =>
    pinnedMessages.some((m) => m._id === messageId);

  // Timestamp ref to prevent synthetic click events on mobile from closing the
  // context menu immediately after a long-press (browsers fire click after touchend).
  const contextMenuOpenedAtRef = useRef(0);

  // Close context menu when clicking outside.
  // Uses a timestamp guard to ignore synthetic click events that mobile browsers
  // fire after touchend — these race with the long-press handler (500ms in MessageBubble)
  // and cause the menu to open and immediately close. Clicks more than 300ms after the
  // menu opened are real user clicks (e.g. tapping outside) and should close the menu.
  useEffect(() => {
    const handleClick = () => {
      if (Date.now() - contextMenuOpenedAtRef.current > 300) {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleContextMenu = (
    e: React.MouseEvent | { clientX: number; clientY: number; preventDefault: () => void },
    message: any
  ) => {
    e.preventDefault();
    // Calculate safe position to prevent menu from being cut off
    const x = Math.min(Math.max(10, e.clientX), window.innerWidth - 10);
    const y = Math.min(Math.max(10, e.clientY), window.innerHeight - 10);
    // Record timestamp so the click-to-close handler can ignore synthetic
    // click events that mobile browsers fire immediately after touchend
    contextMenuOpenedAtRef.current = Date.now();
    setContextMenu({ x, y, message });
  };

  // ─── Formatting helpers ────────────────────────────────────────
  const formatMessageTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const shouldShowDateSeparator = (msg: CommunityMessage, index: number): boolean => {
    if (index === 0) return true;
    const prevMsg = messages[index - 1];
    if (!prevMsg) return true;
    const currDate = new Date(msg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currDate !== prevDate;
  };

  const getGroupedReactions = (msg: CommunityMessage) => {
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    (msg.reactions || []).forEach((r: any) => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, hasReacted: false };
      }
      grouped[r.emoji].count++;
      const senderId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      if (senderId === userId) {
        grouped[r.emoji].hasReacted = true;
      }
    });
    return grouped;
  };

  // ─── Copy message to clipboard ─────────────────────────────
  const handleCopyMessage = async (message: CommunityMessage) => {
    if (message.text) {
      await navigator.clipboard.writeText(message.text);
    }
    setContextMenu(null);
  };

  // ─── Forward message ──────────────────────────────────────────────
  const fetchForwardConversations = useCallback(async () => {
    setLoadingForwardConvs(true);
    try {
      const res = await apiFetch("/api/chats/conversations");
      const data = await res.json();
      if (res.ok && data.success) {
        setForwardConversations(data.conversations || []);
      }
    } catch (err) {
      logger.error("Failed to fetch conversations for forward", err);
    } finally {
      setLoadingForwardConvs(false);
    }
  }, []);

  const handleToggleForwardSelection = (targetConversationId: string) => {
    setSelectedForwardConvIds((prev) => {
      if (prev.includes(targetConversationId)) {
        return prev.filter((id) => id !== targetConversationId);
      }
      if (prev.length >= 5) {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: "You can forward to a maximum of 5 conversations.",
              type: "error",
            },
          })
        );
        return prev;
      }
      return [...prev, targetConversationId];
    });
  };

  const handleExecuteForward = async () => {
    if (!forwardModal || selectedForwardConvIds.length === 0) return;
    try {
      const originalMessage = forwardModal.message;
      const senderName = originalMessage.sender.fullName || originalMessage.sender.username;
      const originalText = originalMessage.text;

      await Promise.all(
        selectedForwardConvIds.map(async (targetConvId) => {
          const formData = new FormData();
          const forwardedText = originalText
            ? `Forwarded from @${senderName}: ${originalText}`
            : `Forwarded from @${senderName}`;
          formData.append("text", forwardedText);
          formData.append("forwardedFrom", originalMessage._id);

          if (originalMessage.attachments && originalMessage.attachments.length > 0) {
            formData.append("forwardedAttachments", JSON.stringify(originalMessage.attachments));
          }

          await apiFetch(`/api/chats/conversations/${targetConvId}/messages`, {
            method: "POST",
            body: formData,
          });
        })
      );

      setForwardModal(null);
      setSelectedForwardConvIds([]);
      setForwardConversations([]);
    } catch (err) {
      logger.error("Failed to forward message", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: { message: "Failed to forward message. Please try again.", type: "error" },
        })
      );
    }
  };

  // ─── Join/Leave community ──────────────────────────────────────
  const handleJoinCommunity = async (communityId: string) => {
    if (joiningCommunities.has(communityId)) return;

    setJoiningCommunities((prev) => new Set(prev).add(communityId));
    try {
      const res = await apiFetch(`/api/communities/${communityId}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Find the community in allCommunities to get its full data
        const joinedCommunity = allCommunities.find((c) => c._id === communityId);
        const updatedCommunity = joinedCommunity
          ? { ...joinedCommunity, isMember: true, memberCount: data.memberCount }
          : null;

        setAllCommunities((prev) =>
          prev.map((c) =>
            c._id === communityId
              ? { ...c, isMember: true, memberCount: data.memberCount }
              : c
          )
        );

        // Join the community room immediately for live member count updates
        if (socket) {
          socket.emit("community:join", { communityId });
        }

        // Evict stale caches so the joined community appears in
        // "My Communities" instantly (apiFetch is cache-first and would
        // otherwise serve the old list without the new membership).
        await Promise.all([
          evictCachedResponse("/api/communities/mine"),
          evictCachedResponse("/api/communities?limit=50"),
          evictCachedResponse(`/api/communities/${communityId}/messages?limit=30`),
        ]);

        // Refresh my communities
        await fetchMyCommunities();

        // Auto-open the community chat after joining
        if (updatedCommunity) {
          handleSelectCommunity(updatedCommunity);
        }
      }
    } catch (err) {
      logger.error("Failed to join community", err);
    } finally {
      setJoiningCommunities((prev) => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });
    }
  };

  const handleLeaveCommunity = async (communityId: string) => {
    try {
      const res = await apiFetch(`/api/communities/${communityId}/leave`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMyCommunities((prev) => prev.filter((c) => c._id !== communityId));
        setAllCommunities((prev) =>
          prev.map((c) =>
            c._id === communityId ? { ...c, isMember: false, memberCount: data.memberCount } : c
          )
        );
        if (selectedCommunity?._id === communityId) {
          setView("list");
          setSelectedCommunity(null);
          setMessages([]);
          setCursor(null);
          setHasMore(true);
        }
        // Evict stale caches so the left community disappears from
        // "My Communities" and its cached messages can't be re-shown
        // if the user rejoins (server hides pre-rejoin history anyway).
        await Promise.all([
          evictCachedResponse("/api/communities/mine"),
          evictCachedResponse("/api/communities?limit=50"),
          evictCachedResponse(`/api/communities/${communityId}/messages?limit=30`),
        ]);
        // Refresh from server to ensure consistency (e.g. stale cache edge cases)
        await fetchMyCommunities();
      }
    } catch (err) {
      logger.error("Failed to leave community", err);
    }
  };

  // ─── Leave community (chat header OR "My Communities" list row) ───
  const handleLeaveCurrentCommunity = async () => {
    const targetId = pendingLeaveCommunityId || selectedCommunity?._id;
    if (!targetId || leavingCommunity) return;
    setLeavingCommunity(true);
    await handleLeaveCommunity(targetId);
    setLeavingCommunity(false);
    setConfirmLeaveOpen(false);
    setPendingLeaveCommunityId(null);
  };

  const promptLeaveCommunity = () => {
    // Header leave always targets the currently-open community
    setPendingLeaveCommunityId(null);
    setConfirmLeaveOpen(true);
  };

  const cancelLeaveCommunity = () => {
    setConfirmLeaveOpen(false);
    setPendingLeaveCommunityId(null);
  };

  // ─── "My Communities" row context menu (long-press / right-click) ───
  const openCommunityMenu = (
    e: { clientX: number; clientY: number },
    community: Community
  ) => {
    setCommunityMenu({ x: e.clientX, y: e.clientY, community });
  };

  // 500ms hold opens the menu (same feel as chat messages); scroll cancels.
  const handleCommunityTouchStart = (
    e: React.TouchEvent,
    community: Community
  ) => {
    if (communityLongPressTimerRef.current) {
      clearTimeout(communityLongPressTimerRef.current);
      communityLongPressTimerRef.current = null;
    }
    communitySuppressClickRef.current = false;
    const touch = e.touches[0];
    if (!touch) return;
    communityLongPressTimerRef.current = setTimeout(() => {
      communitySuppressClickRef.current = true;
      openCommunityMenu(
        { clientX: touch.clientX, clientY: touch.clientY },
        community
      );
    }, 500);
  };

  const handleCommunityTouchMove = () => {
    if (communityLongPressTimerRef.current) {
      clearTimeout(communityLongPressTimerRef.current);
      communityLongPressTimerRef.current = null;
    }
  };

  const handleCommunityTouchEnd = () => {
    if (communityLongPressTimerRef.current) {
      clearTimeout(communityLongPressTimerRef.current);
      communityLongPressTimerRef.current = null;
    }
  };

  const handleToggleCommunityMute = async (community: Community) => {
    const next = !community.muted;
    // Optimistic flip — instant, then reconciled with the server response.
    const patch = (c: Community) =>
      c._id === community._id ? { ...c, muted: next } : c;
    setMyCommunities((prev) => prev.map(patch));
    setAllCommunities((prev) => prev.map(patch));
    setCommunityMenu(null);
    try {
      const res = await apiFetch(
        `/api/communities/${community._id}/${next ? "mute" : "unmute"}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: next
                ? "Community notifications muted"
                : "Community notifications unmuted",
              type: "success",
            },
          })
        );
        // A reload must not serve the stale cached list without the new flag
        evictCachedResponse("/api/communities/mine");
      } else {
        setMyCommunities((prev) =>
          prev.map((c) => (c._id === community._id ? community : c))
        );
        setAllCommunities((prev) =>
          prev.map((c) => (c._id === community._id ? community : c))
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data?.message || "Couldn't update mute setting.",
              type: "error",
            },
          })
        );
      }
    } catch (err) {
      logger.error("Failed to toggle community mute", err);
      setMyCommunities((prev) =>
        prev.map((c) => (c._id === community._id ? community : c))
      );
      setAllCommunities((prev) =>
        prev.map((c) => (c._id === community._id ? community : c))
      );
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Couldn't update mute setting. Try again.",
            type: "error",
          },
        })
      );
    }
  };

  // ─── Cancel/Retry handlers for voice notes ────────────────────
  const handleCancelUpload = (pendingId: string) => {
    const controller = activeUploadsRef.current[pendingId];
    if (controller) {
      controller.abort();
      delete activeUploadsRef.current[pendingId];
    }
    delete unsentPayloadsRef.current[pendingId];
    setMessages((prev) => prev.filter((m) => m._id !== pendingId));
  };

  const handleRetrySend = async (pendingId: string) => {
    const payload = unsentPayloadsRef.current[pendingId];
    if (!payload) return;

    setMessages((prev) =>
      prev.map((m) =>
        m._id === pendingId ? { ...m, _pending: true, _failed: false } : m
      )
    );

    const controller = new AbortController();
    activeUploadsRef.current[pendingId] = controller;

    try {
      const formData = new FormData();
      formData.append("text", "");
      const blobMime = payload.blob.type || "audio/webm";
      const ext =
        blobMime.includes("mp4") || blobMime.includes("aac")
          ? "mp4"
          : blobMime.includes("ogg")
            ? "ogg"
            : blobMime.includes("wav")
              ? "wav"
              : "webm";
      const audioFile = new File(
        [payload.blob],
        `voice-${Date.now()}.${ext}`,
        { type: blobMime }
      );
      formData.append("files", audioFile);
      formData.append("duration", String(payload.duration));
      if (payload.replyToId) {
        formData.append("replyTo", payload.replyToId);
      }

      const res = await apiFetch(
        `/api/communities/${selectedCommunity?._id}/messages`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        delete unsentPayloadsRef.current[pendingId];
        delete activeUploadsRef.current[pendingId];
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== pendingId);
          if (filtered.some((m) => m._id === data.sentMessage?._id)) return filtered;
          return [...filtered, data.sentMessage];
        });
      } else {
        throw new Error(data?.message || "Failed to send");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === pendingId ? { ...m, _pending: false, _failed: true } : m
        )
      );
    } finally {
      delete activeUploadsRef.current[pendingId];
    }
  };

  // ─── Handle community created ──────────────────────────────────
  const handleCommunityCreated = (community: Community) => {
    setMyCommunities((prev) => [community, ...prev]);
    setAllCommunities((prev) => [community, ...prev]);
    // Evict cached lists so the new community shows everywhere immediately
    evictCachedResponse("/api/communities/mine");
    evictCachedResponse("/api/communities?limit=50");
  };

  // ─── Handle community updated ──────────────────────────────────
  const handleCommunityUpdated = (updated: Community) => {
    setMyCommunities((prev) =>
      prev.map((c) => (c._id === updated._id ? updated : c))
    );
    setAllCommunities((prev) =>
      prev.map((c) => (c._id === updated._id ? updated : c))
    );
    setSelectedCommunity((prev) =>
      prev?._id === updated._id ? updated : prev
    );	// Refresh both lists from server to ensure data consistency (e.g. image URL).
	// Bypass the cache: the mutation just changed community flags (audio/video
	// calls, messaging) and a cache-first read could serve the OLD values,
	// making the toggle look like it "reverted" after reopening the community.
	fetchMyCommunities(true);
	fetchAllCommunities(true);
  };

  // ─── Handle community deleted ──────────────────────────────────
  // ─── Group Call (LiveKit) ────────────────────────────────────────
  const handleGroupCall = async (callType: "audio" | "video") => {
    if (!selectedCommunity || startingCall) return;
    setStartingCall(true);
    setGroupCallType(callType);
    try {
      const res = await apiFetch(
        `/api/communities/${selectedCommunity._id}/livekit-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: callType }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setGroupCallToken(data.token);
        setGroupCallRoomName(data.roomName);
        setGroupCallUrl(data.livekitUrl);
        setShowGroupCall(true);
        // Announce the call to the community room so other members see a
        // "Join call" banner and can connect to the SAME LiveKit room.
        socket?.emit("community:call-started", {
          communityId: selectedCommunity._id,
          roomName: data.roomName,
          type: callType,
        });
        setActiveCommunityCall({
          roomName: data.roomName,
          type: callType,
          startedBy: userId,
        });
      } else {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data?.message || "Failed to start group call. LiveKit may not be configured.",
              type: "error",
            },
          }),
        );
      }
    } catch (err) {
      logger.error("Failed to start group call", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Failed to start group call. Please try again.",
            type: "error",
          },
        }),
      );
    } finally {
      setStartingCall(false);
    }
  };

  const handleCommunityDeleted = (communityId: string) => {
    setMyCommunities((prev) => prev.filter((c) => c._id !== communityId));
    setAllCommunities((prev) => prev.filter((c) => c._id !== communityId));
    if (selectedCommunity?._id === communityId) {
      setView("list");
      setSelectedCommunity(null);
    }
  };

  // ─── Load more messages (scroll up) ────────────────────────────
  const handleLoadMore = () => {
    if (selectedCommunity && hasMore && !loadingMessages) {
      fetchMessages(selectedCommunity._id, cursor);
    }
  };

  // ─── Render Community List ─────────────────────────────────────
  const renderCommunityList = () => {
    const filteredCommunities =
      (communityTab === "mine" ? myCommunities : allCommunities).filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.description &&
            c.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-zinc-400" />
            <h2 className="text-display-xs text-white">Communities</h2>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Create Community"
          >
            <Plus className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800/50 shrink-0">
          <button
            onClick={() => {
              setCommunityTab("mine");
              setSearchQuery("");
            }}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              communityTab === "mine"
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            My Communities
          </button>
          <button
            onClick={() => {
              setCommunityTab("browse");
              setSearchQuery("");
            }}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              communityTab === "browse"
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Browse All
          </button>
        </div>

        {/* Search */}
        <div className="px-3 sm:px-4 py-2 shrink-0">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-zinc-800 bg-zinc-950/50 py-2 pl-9 pr-4 text-[12px] font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Hash className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm font-semibold text-zinc-400 mb-1">
                {communityTab === "mine"
                  ? "No communities yet"
                  : "No communities found"}
              </p>
              <p className="text-[11px] text-zinc-400 mb-4">
                {communityTab === "mine"
                  ? "Create or join a community to get started"
                  : "Be the first to create one!"}
              </p>
              {communityTab === "mine" && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="rounded-full bg-white hover:bg-zinc-200 px-4 py-2 text-xs font-bold text-black transition-all cursor-pointer"
                >
                  Create Community
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredCommunities.map((community) => (
                <div
                  key={community._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    // A long-press fires a synthetic click on release — swallow it
                    // so the menu doesn't instantly open the chat.
                    if (communitySuppressClickRef.current) {
                      communitySuppressClickRef.current = false;
                      return;
                    }
                    if (community.isMember) {
                      handleSelectCommunity(community);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (community.isMember) {
                        handleSelectCommunity(community);
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    if (!community.isMember) return;
                    e.preventDefault();
                    openCommunityMenu(
                      { clientX: e.clientX, clientY: e.clientY },
                      community
                    );
                  }}
                  onTouchStart={(e) => {
                    if (community.isMember)
                      handleCommunityTouchStart(e, community);
                  }}
                  onTouchMove={handleCommunityTouchMove}
                  onTouchEnd={handleCommunityTouchEnd}					  className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 transition-all text-left group ${
					    community.isMember
					      ? "hover:bg-zinc-900/50 cursor-pointer"
					      : "cursor-default opacity-80"
					  }`}
					  >
					  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50 overflow-hidden">
                    {community.image?.url ? (
                      <img
                        src={community.image.url}
                        alt={community.name}
                        className="h-full w-full rounded-full object-cover cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("openImagePreview", { detail: community.image!.url }));
                        }}
                      />
                    ) : (
                      <Hash className="h-5 w-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {community.name}
                    </h3>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {community.lastMessage || community.lastAction ? (
                        <CommunityLastActivity
                          lastMessage={community.lastMessage}
                          lastAction={community.lastAction}
                          currentUserId={userId}
                        />
                      ) : (
                        <>
                          {community.memberCount} member{community.memberCount !== 1 ? "s" : ""}
                          {community.description ? ` · ${community.description}` : ""}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {community.isMember ? (
                      communityTab === "mine" ? (
                        community.muted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-800/60 px-2.5 py-1 rounded-full">
                            <BellOff className="h-3 w-3" />
                            Muted
                          </span>
                        ) : null
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-300 bg-white/10 px-2.5 py-1 rounded-full">
                          Open
                        </span>
                      )
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinCommunity(community._id);
                        }}
                        disabled={joiningCommunities.has(community._id)}
                        className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full hover:bg-emerald-500/20 transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {joiningCommunities.has(community._id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {joiningCommunities.has(community._id) ? "Joining..." : "Join"}
                      </button>
                    )}
                  </div>                </div>
              ))}
            </div>
          )
        }
        </div>
      </div>
    );
  };

  // ─── Render Community Chat ─────────────────────────────────────
  const renderCommunityChat = () => {
    if (!selectedCommunity) return null;

    const isInCommunity = selectedCommunity.isMember ?? 
      myCommunities.some((c) => c._id === selectedCommunity._id);

    // Members currently online (excludes self) — drives the green-dot
    // "active now" indicator in the chat header, like personal chat presence.
    const onlineMembers = (selectedCommunity.members || []).filter(
      (m) =>
        m.user?._id &&
        m.user._id !== userId &&
        onlineUsersRef.current.has(m.user._id),
    );

    // If not a member, show join prompt
    if (!isInCommunity) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 shrink-0">
            <button
              onClick={() => setView("list")}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-zinc-400" />
            </button>
            <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center">
              <Hash className="h-5 w-5 text-zinc-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedCommunity.name}</h3>
              <p className="text-[10px] text-zinc-500">{selectedCommunity.memberCount} members</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Users className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm font-semibold text-zinc-400 mb-1">
              You're not a member of this community
            </p>
            <p className="text-[11px] text-zinc-400 mb-4">
              Join to see messages and participate in the conversation
            </p>              <button
              onClick={() => handleJoinCommunity(selectedCommunity._id)}
              disabled={joiningCommunities.has(selectedCommunity._id)}
              className="rounded-full bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 px-5 py-2.5 text-xs font-bold text-black transition-all cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {joiningCommunities.has(selectedCommunity._id) ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Community"
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 shrink-0">
          <button
            onClick={() => {
              setView("list");
              setSelectedCommunity(null);
            }}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-400" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50">
            {selectedCommunity.image?.url ? (
              <img
                src={selectedCommunity.image.url}
                alt={selectedCommunity.name}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <Hash className="h-5 w-5 text-zinc-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <button
              onClick={() => setView("profile")}
              className="text-sm font-semibold text-white truncate text-left hover:underline cursor-pointer"
            >
              {selectedCommunity.name}
            </button>
            <p className="text-[10px] text-zinc-500">
              {selectedCommunity.memberCount} member{selectedCommunity.memberCount !== 1 ? "s" : ""}
              {onlineMembers.length > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-400/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineMembers.length} active now
                </span>
              )}
              {Object.keys(typingUsers).length > 0 && (
                <span className="text-zinc-300 ml-2">
                  · {Object.keys(typingUsers).length} typing...
                </span>
              )}
            </p>
            {onlineMembers.length > 0 && (
              <div className="flex items-center -space-x-1.5 mt-1">
                {onlineMembers.slice(0, 4).map((m) => (
                  <div
                    key={m.user._id}
                    className="relative h-6 w-6 rounded-full border-2 border-zinc-900 overflow-hidden shrink-0"
                    title={`${m.user.fullName} — active now`}
                  >
                    {m.user.profilePic?.url ? (
                      <img
                        src={m.user.profilePic.url}
                        alt={m.user.fullName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-white">
                        {(m.user.fullName || m.user.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-400 border border-zinc-900" />
                  </div>
                ))}
                {onlineMembers.length > 4 && (
                  <span className="h-6 w-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-emerald-300">
                    +{onlineMembers.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Group Audio call button - only when enabled */}
          {selectedCommunity.audioCallEnabled && (
            <button
              onClick={() => handleGroupCall("audio")}
              disabled={startingCall}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              title="Start group audio call"
            >
              <Phone className="h-3.5 w-3.5 text-zinc-500 hover:text-white" />
            </button>
          )}
          {/* Group Video call button - only when enabled */}
          {selectedCommunity.videoCallEnabled && (
            <button
              onClick={() => handleGroupCall("video")}
              disabled={startingCall}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              title="Start group video call"
            >
              <Video className="h-3.5 w-3.5 text-zinc-500 hover:text-white" />
            </button>
          )}
          {/* Community options — search, clear chat + leave live in a three-dot menu to keep the header clean */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-zinc-700/50 transition-colors cursor-pointer shrink-0"
              title="Community options"
            >
              <MoreVertical className="h-3.5 w-3.5 text-zinc-500 hover:text-white" />
            </button>
            {showHeaderMenu && (
              <>
                <div
                  className="fixed inset-0 z-[85]"
                  onClick={() => setShowHeaderMenu(false)}
                />
                <div className="absolute right-0 top-9 z-[90] w-48 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl">
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setShowMessageSearch((prev) => !prev);
                      // Drop any in-flight search response when opening/closing.
                      messageSearchSeqRef.current++;
                      setMessageSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer text-left"
                  >
                    <Search className="h-3.5 w-3.5 text-zinc-400" />
                    Search messages
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setConfirmClearForMeOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors cursor-pointer text-left"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear chat for me
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      promptLeaveCommunity();
                    }}
                    disabled={leavingCommunity}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {leavingCommunity ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" />
                    )}
                    Leave community
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active group call banner — join the call started by another member */}
        {activeCommunityCall && !showGroupCall && (
          <button
            onClick={() => handleGroupCall(activeCommunityCall.type)}
            disabled={startingCall}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 w-full border-b border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors cursor-pointer disabled:opacity-50"
            title="Join the active group call"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              {activeCommunityCall.type === "video"
                ? "Live group video call — tap to join"
                : "Live group audio call — tap to join"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          </button>
        )}

        {/* Message search bar */}
        {showMessageSearch && (
          <div className="shrink-0 border-b border-zinc-800/50 bg-zinc-950/60 px-4 py-2.5">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search messages..."
                value={messageSearchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setMessageSearchQuery(val);
                  // Invalidate any in-flight response from the previous query.
                  messageSearchSeqRef.current++;

                  // Clear previous debounce timer
                  if (messageSearchTimerRef.current) {
                    clearTimeout(messageSearchTimerRef.current);
                  }


                  if (!val.trim() || !selectedCommunity) {
                    setSearchResults([]);
                    setSearchingMessages(false);
                    return;
                  }

                  setSearchingMessages(true);
                  // Clear stale results from the previous query while the new
                  // search is in flight — otherwise old matches linger during
                  // the debounce and look wrong for the new query.
                  setSearchResults([]);

                  // Debounce: wait 350ms after last keystroke before searching
                  messageSearchTimerRef.current = setTimeout(async () => {
                    const seq = messageSearchSeqRef.current;
                    try {
                      const res = await apiFetch(
                        `/api/communities/${selectedCommunity._id}/messages/search?q=${encodeURIComponent(val)}`
                      );
                      const data = await res.json();
                      // Drop responses from superseded keystrokes — only the
                      // latest query wins.
                      if (seq !== messageSearchSeqRef.current) return;
                      if (res.ok && data.success) {
                        setSearchResults(data.messages || []);
                      }
                    } catch (err) {
                      if (seq !== messageSearchSeqRef.current) return;
                      logger.error("Failed to search messages", err);
                    } finally {
                      if (seq === messageSearchSeqRef.current) {
                        setSearchingMessages(false);
                      }
                    }
                  }, 350);
                }}
                className="w-full rounded-full border border-zinc-800 bg-zinc-950/50 py-2 pl-9 pr-9 text-[12px] font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
              />
              {messageSearchQuery && (
                <button
                  onClick={() => {
                    setMessageSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {!messageSearchQuery && (
                <button
                  onClick={() => {
                    setShowMessageSearch(false);
                    // Drop any in-flight search response when the bar closes.
                    messageSearchSeqRef.current++;
                    setMessageSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  title="Close search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}



        {/* Pinned messages banner — WhatsApp-style slim bar */}
        {pinnedMessages.length > 0 && (
          <div className="shrink-0 border-b border-zinc-700/30 bg-zinc-950/60 px-3 py-1.5 flex items-center gap-2">
            <button
              type="button"
              title="View all pinned messages"
              onClick={() => setShowPinnedPanel(true)}
              className="flex items-center justify-center h-6 w-6 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-all cursor-pointer shrink-0"
            >
              <Pin className="h-3 w-3" />
            </button>
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scrollbar-thin">
              {pinnedMessages.map((pinned) => (
                <button
                  key={pinned._id}
                  type="button"
                  title="Jump to message"
                  onClick={() => {
                    const el = document.getElementById(`msg-${pinned._id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add(
                        "ring-2", "ring-white/50", "rounded-2xl",
                        "transition-all", "duration-500",
                      );
                      setTimeout(() => {
                        el.classList.remove(
                          "ring-2", "ring-white/50", "rounded-2xl",
                          "transition-all", "duration-500",
                        );
                      }, 2000);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent("showToast", {
                          detail: {
                            message: "Pinned message not loaded yet — scroll up to find it.",
                            type: "error",
                          },
                        }),
                      );
                    }
                  }}
                  className="shrink-0 max-w-[220px] flex items-center gap-1.5 rounded-md bg-zinc-950/80 border border-zinc-700/40 px-2 py-1 hover:bg-zinc-900/90 hover:border-zinc-600/50 transition-colors cursor-pointer text-left"
                >
                  <span className="h-3.5 w-3.5 rounded-full bg-zinc-700 shrink-0 flex items-center justify-center overflow-hidden text-[7px] font-bold text-zinc-200">
                    {pinned.sender.profilePic?.url ? (
                      <img
                        src={pinned.sender.profilePic.url}
                        alt={pinned.sender.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      pinned.sender.fullName?.charAt(0) || "?"
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-[9px] leading-tight text-zinc-300 truncate">
                    <span className="font-semibold text-white">{pinned.sender.fullName}: </span>
                    {pinned.text || (pinned.attachments?.length ? "Attachment" : "")}
                  </span>
                </button>
              ))}
            </div>
            {pinnedMessages.length > 1 && (
              <span className="shrink-0 text-[9px] font-semibold text-zinc-400">
                {pinnedMessages.length}
              </span>
            )}
          </div>
        )}

        {/* View all pinned messages panel */}
        {showPinnedPanel &&
          createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
              onClick={() => setShowPinnedPanel(false)}
            >
              <motion.div
                initial={{ y: 40, scale: 0.97, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 40, scale: 0.97, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-md max-h-[75vh] rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70 shrink-0">
                  <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-amber-200/90" />
                    <h3 className="text-sm font-bold text-white">Pinned messages</h3>
                  </div>
                  <button
                    onClick={() => setShowPinnedPanel(false)}
                    className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {pinnedMessages.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-8">No pinned messages</p>
                  ) : (
                    pinnedMessages.map((pinned) => (
                      <div
                        key={pinned._id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-zinc-900/70 transition-colors group"
                      >
                        <span className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center overflow-hidden text-[9px] font-bold text-zinc-300">
                          {pinned.sender?.profilePic?.url ? (
                            <img
                              src={pinned.sender.profilePic.url}
                              alt={pinned.sender.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            pinned.sender?.fullName?.charAt(0) || "?"
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">
                            {pinned.sender?.fullName}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {pinned.text ||
                              (pinned.attachments?.length ? "Attachment" : "")}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            handleUnpinMessage(pinned._id);
                            setShowPinnedPanel(false);
                          }}
                          className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:text-white hover:border-red-400/60 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Unpin message"
                        >
                          Unpin
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}

        {/* Messages area — regular or search results */}
        {/* When a search query is active, ALWAYS show the search view (results,
            loading or the empty state) instead of silently falling back to the
            normal chat — falling back made it look like search "did nothing". */}
        {messageSearchQuery.trim() ? (
          searchResults.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
            <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-sm py-2 mb-2 flex items-center gap-2 border-b border-zinc-800/40">
              <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Search results for "{messageSearchQuery}"
              </span>
              <span className="text-[10px] text-zinc-400 ml-auto">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</span>
            </div>
            {searchResults.map((msg, index) => {
              const isMe = msg.sender._id === userId;
              const adaptedMsg = {
                ...msg,
                conversation: msg.community,
                recipient: msg.sender._id,
                seen: (msg.seenBy?.length || 0) > 0,
              } as any;

              return (
                <MessageBubble
                  key={msg._id}
                  msg={adaptedMsg}
                  isMe={isMe}
                  userId={userId}
                  groupedReactions={getGroupedReactions(msg)}
                  handleContextMenu={handleContextMenu as any}
                  handleReaction={handleReaction as any}
                  formatMessageTime={formatMessageTime}
                  onSwipeToReply={handleReply as any}
                  onCancelUpload={handleCancelUpload}
                  onRetrySend={handleRetrySend}
                  showDateSeparator={index === 0}
                  dateSeparatorText={formatDateSeparator(msg.createdAt)}
                  showTimeHeader={false}
                  isFirstInGroup={index === 0 || searchResults[index - 1]?.sender._id !== msg.sender._id}
                  isLastInGroup={index === searchResults.length - 1 || searchResults[index + 1]?.sender._id !== msg.sender._id}
                />
              );
            })}
          </div>
          ) : searchingMessages ? (
            <div className="flex-1 overflow-y-auto px-4 py-2 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-2 flex items-center justify-center">
              <p className="text-[10px] font-medium text-zinc-500 text-center">No messages found</p>
            </div>
          )
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 relative"
            onScroll={(e) => {
              const el = e.currentTarget;
              setShowScrollToBottom(
                el.scrollHeight - el.scrollTop - el.clientHeight > 400,
              );
              if (el.scrollTop < 50 && hasMore && !loadingMessages) {
                handleLoadMore();
              }
            }}
          >
            {loadingMessages && messages.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            )}

            {!loadingMessages && messages.length === 0 && !searchingMessages && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="h-10 w-10 text-zinc-700 mb-3" />
                <p className="text-sm font-semibold text-zinc-400 mb-1">
                  No messages yet
                </p>
                <p className="text-[11px] text-zinc-400">
                  Be the first to send a message in {selectedCommunity.name}
                </p>
              </div>
            )}

            {loadingMessages && messages.length > 0 && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
              </div>
            )}

            {/* Scroll to bottom button */}
            {showScrollToBottom && (
              <div className="absolute bottom-4 right-4 z-20">
                <button
                  onClick={() =>
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  className="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 flex items-center justify-center shadow-lg transition-all cursor-pointer animate-bounce"
                  title="Scroll to bottom"
                  type="button"
                >
                  <ChevronDown className="h-4 w-4 text-zinc-300" />
                </button>
              </div>
            )}

            {searchingMessages && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
              </div>
            )}

            {messages.map((msg, index) => {
              const isMe = msg.sender._id === userId;
              // Convert CommunityMessage fields to match MessageBubble expectations
              const adaptedMsg = {
                ...msg,
                conversation: msg.community,
                recipient: msg.sender._id,
                // Show blue tick when other members have seen this message
                seen: (msg.seenBy?.length || 0) > 0,
                _pending: (msg as any)._pending,
                _failed: (msg as any)._failed,
              } as any;

              return (
                <MessageBubble
                  key={msg._id}
                  msg={adaptedMsg}
                  isMe={isMe}
                  userId={userId}
                  groupedReactions={getGroupedReactions(msg)}
                  handleContextMenu={handleContextMenu as any}
                  handleReaction={handleReaction as any}
                  formatMessageTime={formatMessageTime}
                  onSwipeToReply={handleReply as any}
                  onCancelUpload={handleCancelUpload}
                  onRetrySend={handleRetrySend}
                  showDateSeparator={shouldShowDateSeparator(msg, index)}
                  dateSeparatorText={formatDateSeparator(msg.createdAt)}
                  showTimeHeader={false}
                  isFirstInGroup={
                    index === 0 ||
                    messages[index - 1]?.sender._id !== msg.sender._id
                  }
                  isLastInGroup={
                    index === messages.length - 1 ||
                    messages[index + 1]?.sender._id !== msg.sender._id
                  }
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Reply/Edit indicator */}
        {replyTo && (
          <div className="px-2 py-2 bg-zinc-950/60 border-t border-zinc-800/50 flex items-center gap-2 shrink-0">
            <CornerDownLeft className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-zinc-300">
                Replying to {replyTo.sender.fullName}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">
                {replyTo.text || "Attachment"}
              </p>
            </div>
            <button
              onClick={cancelReply}
              className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-3 w-3 text-zinc-500" />
            </button>
          </div>
        )}

        {editingMessage && (
          <div className="px-2 py-2 bg-zinc-950/60 border-t border-zinc-800/50 flex items-center gap-2 shrink-0">
            <Edit3 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-400">Editing message</p>
            </div>
            <button
              onClick={cancelEdit}
              className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-3 w-3 text-zinc-500" />
            </button>
          </div>
        )}

        {/* File previews - using ChatGallery like personal chat */}
        {filePreviews.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800/50 shrink-0">
            <ChatGallery
              attachmentPreviews={filePreviews}
              attachments={selectedFiles}
              removeAttachment={removeFile}
            />
          </div>
        )}

        {/* Messaging disabled banner */}
        {selectedCommunity.messagingEnabled === false && selectedCommunity.creator?._id !== userId && (
          <div className="px-4 py-3 border-t border-zinc-800/50 shrink-0 bg-zinc-950/60">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span>Messaging is disabled in this community.</span>
            </div>
          </div>
        )}

        {/* Input area - hidden for non-creator members when messaging is disabled */}
        {(selectedCommunity.messagingEnabled !== false || selectedCommunity.creator?._id === userId) && (
        <div className={`px-2 ${isMobile ? "pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] pt-3" : "py-3"} border-t border-zinc-800/50 shrink-0 relative`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {isDragActive && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/5 border-2 border-dashed border-white/25 backdrop-blur-sm">
              <div className="text-center">
                <Image className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-200">Drop files here</p>
              </div>
            </div>
          )}
          {sendingError && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5 border border-red-500/20">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{sendingError}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex-1 min-w-0 relative flex items-end">
              {!recordedUrl && (
                <>
                  <div className="relative w-full">
                    <textarea
                      ref={inputRef}
                      value={messageInput}
                    wrap="soft"
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editingMessage) {
                          handleEditSubmit();
                        } else {
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={
                      editingMessage
                        ? "Edit message..."
                        : `Message ${selectedCommunity.name}...`
                    }
                    rows={1}
                    className={`w-full !rounded-2xl border border-zinc-800 bg-zinc-950/40 text-[12px] md:text-sm placeholder:text-[12px] md:placeholder:text-sm text-slate-100 placeholder-zinc-500 outline-none focus:border-white focus:bg-zinc-900/80 transition-all focus:ring-1 focus:ring-zinc-700 pl-[52px] resize-none max-h-[120px] overflow-y-auto leading-relaxed ${
                      isKeyboardOpen ? "py-2 pr-3" : "py-2.5 pr-10"
                    }`}
                  />
                  {/* Media icon — inside the input box, vertically centered */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute left-2 inset-y-0 my-auto flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                    title="Attach file"
                    type="button"
                  >
                    <Image className="h-4.5 w-4.5" />
                  </button>
                  {!isKeyboardOpen && !messageInput && (
                    <span className="absolute right-3.5 top-3.5 text-[9px] text-zinc-650 hidden md:flex items-center gap-0.5 border border-zinc-800 px-1 rounded bg-zinc-950 select-none">
                      <CornerDownLeft className="h-2 w-2" />{" "}
                      Enter
                    </span>
                  )}
                  </div>
                </>
              )}
              

              {/* Recording indicator — animated waveform bars (matches personal chat) */}
              {isRecording && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Animated waveform bars */}
                  <span className="flex items-center gap-[3px] h-5">
                    {[3, 6, 10, 14, 18, 14, 10, 6, 3].map((h, i) => (
                      <span
                        key={i}
                        className="waveform-bar w-[3px] bg-red-500 rounded-full"
                        style={{
                          height: `${h}px`,
                          animation: `waveform 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-[12px] font-mono text-red-400 tabular-nums font-bold">
                    {recordingDuration}s
                  </span>
                </div>
              )}

              {/* Recorded audio preview — exact copy of personal chat (Chat.tsx) */}
              {recordedUrl && !isRecording && (
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (audioPreviewRef.current) {
                        if (isPlayingPreview) {
                          audioPreviewRef.current.pause();
                          audioPreviewRef.current.currentTime = 0;
                        }
                        setIsPlayingPreview(!isPlayingPreview);
                        if (!isPlayingPreview) {
                          audioPreviewRef.current.play();
                        }
                      }
                    }}
                    className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-zinc-200 hover:bg-white/20 transition-all cursor-pointer shrink-0"
                  >
                    {isPlayingPreview ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/60 rounded-full w-0"
                        id="voice-preview-progress"
                      />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                      {recordingDuration}s
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordedBlob(null);
                      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                      setRecordedUrl(null);
                      setRecordingDuration(0);
                      setIsPlayingPreview(false);
                    }}
                    className="h-7 w-7 rounded-full border border-zinc-700 bg-zinc-800/60 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all cursor-pointer shrink-0"
                    title="Discard recording"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendVoiceNote()}
                    className="flex shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-250 cursor-pointer shadow-md transition-all duration-200 h-9 w-9"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                  <audio
                    ref={audioPreviewRef}
                    src={recordedUrl}
                    onEnded={() => setIsPlayingPreview(false)}
                    onTimeUpdate={() => {
                      if (audioPreviewRef.current) {
                        const progress = document.getElementById("voice-preview-progress");
                        if (progress) {
                          progress.style.width = `${(audioPreviewRef.current.currentTime / (audioPreviewRef.current.duration || 1)) * 100}%`;
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Right side buttons — exact copy of personal chat (Chat.tsx) */}
            {!recordedUrl && (
              <>
                {/* Mic toggle — red square while recording (stop) */}
                {(!messageInput.trim() && selectedFiles.length === 0) || isRecording ? (
                  <button
                    type="button"
                    onClick={(e) => { handleMicClick(e); }}
                    className={`flex shrink-0 items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                      isRecording
                        ? "h-9 w-9 bg-red-500 text-white hover:bg-red-600"
                        : "h-9 w-9 bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
                    }`}
                    title={isRecording ? "Stop recording" : "Record voice note"}
                  >
                    {isRecording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4.5 w-4.5" />
                    )}
                  </button>
                ) : null}
                {/* Send button — shown while recording too (sends immediately, stops recording) */}
                {(messageInput.trim() || selectedFiles.length > 0 || isRecording) && (
                  <button
                    type="button"
                    onClick={editingMessage ? handleEditSubmit : handleSendMessage}
                    className="flex shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-250 cursor-pointer shadow-md transition-all duration-200 h-9 w-9"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        )}

        {/* Context menu — rendered via portal to avoid motion.div transform stacking context */}
        {/* Camera capture portal */}
        {showCamera && createPortal(
          <div className="fixed inset-0 z-[500] bg-black flex flex-col">
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="flex-1 w-full object-cover"
            />
            <div className="flex items-center justify-between px-8 py-6 bg-black/80">
              <button
                type="button"
                onClick={handleCloseCamera}
                className="h-10 w-20 rounded-full border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="h-16 w-16 rounded-full bg-white border-4 border-zinc-300 hover:border-white transition-all cursor-pointer flex items-center justify-center"
              >
                <div className="h-12 w-12 rounded-full bg-white border-2 border-zinc-900" />
              </button>
              <div className="w-20" />
            </div>
          </div>,
          document.body
        )}

        {contextMenu && createPortal(
          <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300]"
                onClick={() => setContextMenu(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-[310] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[180px]"
                ref={contextMenuRef}
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >

                {/* Quick-reaction pill — same options as the emoji menu; reacts
                    straight from the long-press menu. Hidden for deleted msgs. */}
                {!contextMenu.message.isDeleted && (
                  <div className="border-b border-zinc-800 px-1 py-1">
                    <EmojiReactionMenu
                      inline
                      onReact={(emoji) => {
                        handleReaction(contextMenu.message, emoji);
                        setContextMenu(null);
                      }}
                      ariaLabel="React to this message"
                      title="React"
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    handleReply(contextMenu.message);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  Reply
                </button>
                {contextMenu.message.sender._id === userId && (
                  <>
                    <button
                      onClick={() => {
                        handleEdit(contextMenu.message);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contextMenu.message._id)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete for everyone
                    </button>
                  </>
                )}
                {/* Delete for me — available for ALL messages, not just own */}
                {!contextMenu.message.isDeleted && (
                  <button
                    onClick={() => handleDeleteForMe(contextMenu.message._id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Delete for me
                  </button>
                )}
                {/* Copy Message */}
                {!contextMenu.message.isDeleted && (
                  <button
                    onClick={() => handleCopyMessage(contextMenu.message)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Message
                  </button>
                )}
                {/* Forward Message */}
                {!contextMenu.message.isDeleted && (
                  <button
                    onClick={() => {
                      setForwardModal({ message: contextMenu.message });
                      setContextMenu(null);
                      fetchForwardConversations();
                      setSelectedForwardConvIds([]);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Forward Message
                  </button>
                )}
                {/* Pin/Unpin — available to all members */}
                {isMessagePinned(contextMenu.message._id) ? (
                  <button
                    onClick={() => handleUnpinMessage(contextMenu.message._id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                    Unpin
                  </button>
                ) : (
                  <button
                    onClick={() => handlePinMessage(contextMenu.message._id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Pin className="h-3.5 w-3.5" />
                    Pin
                  </button>
                )}
              </motion.div>
            </>,
          document.body
        )}
      </div>
    );
  };

  return (
    <>
      {/* "My Communities" row context menu — long-press / right-click (mounted
          at root so it works in BOTH the list and chat views) */}
      {communityMenu && createPortal(
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300]"
            onClick={() => setCommunityMenu(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[310] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[190px]"
            ref={communityMenuRef}
            style={{ left: communityMenu.x, top: communityMenu.y }}
          >
            <button
              onClick={() => handleToggleCommunityMute(communityMenu.community)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {communityMenu.community.muted ? (
                <>
                  <Bell className="h-3.5 w-3.5" />
                  Unmute notifications
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5" />
                  Mute notifications
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPendingLeaveCommunityId(communityMenu.community._id);
                setConfirmLeaveOpen(true);
                setCommunityMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave community
            </button>
          </motion.div>
        </>,
        document.body
      )}

      <GlassCard
        className="w-full h-full pt-0 sm:pt-4 lg:pt-4 xl:pt-5 pb-0 px-0 flex !rounded-none sm:!rounded-3xl lg:!rounded-4xl sm:border sm:border-white/10"
      >
        {view === "list" && renderCommunityList()}
        {view === "chat" && renderCommunityChat()}
        {view === "profile" && selectedCommunity && (
          <CommunityProfileOverlay
            community={selectedCommunity}
            isAdmin={selectedCommunity.creator?._id === userId}
            onClose={() => setView("chat")}
    onOpenSettings={() => setView("settings")}
    onUserSelected={onUserSelected}
  />
)}
{view === "settings" && selectedCommunity && (
  <CommunitySettingsPage
    community={selectedCommunity}
    isAdmin={selectedCommunity.creator?._id === userId}            onClose={() => setView("chat")}
    onUpdated={handleCommunityUpdated}
    onDeleted={handleCommunityDeleted}
  />
)}
      </GlassCard>
      <CreateCommunityModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCommunityCreated}
      />
      <ConfirmDialog
        isOpen={confirmLeaveOpen}
        title="Leave community?"
        message={`Are you sure you want to leave "${
          (pendingLeaveCommunityId
            ? myCommunities.find((c) => c._id === pendingLeaveCommunityId) ||
              allCommunities.find((c) => c._id === pendingLeaveCommunityId)
            : selectedCommunity)?.name || "this community"
        }"? You'll need to rejoin to see messages again.`}
        confirmLabel={leavingCommunity ? "Leaving..." : "Leave"}
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleLeaveCurrentCommunity}
        onCancel={cancelLeaveCommunity}
      />
      <ConfirmDialog
        isOpen={confirmClearForMeOpen}
        title="Clear chat for me?"
        message={`This will clear all messages in "${selectedCommunity?.name || "this community"}" for you only. Other members will still see their messages.`}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setMessages([]);
          setConfirmClearForMeOpen(false);
        }}
        onCancel={() => setConfirmClearForMeOpen(false)}
      />

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          // Only clean up queue if there are no remaining items (otherwise handleCropComplete manages it)
          if (cropPendingQueueRef.current.length === 0) {
            setCropQueueFiles([]);
            setCropSrc(null);
          }
        }}
        imageSrc={cropSrc || ""}
        onCropComplete={handleCropComplete}
      />

      {/* Group call floor — LiveKit-powered multi-participant audio/video */}
      {showGroupCall && groupCallToken && groupCallUrl && selectedCommunity && (
        <GroupCallFloor
          livekitUrl={groupCallUrl}
          token={groupCallToken}
          roomName={groupCallRoomName}
          callType={groupCallType}
          onLeave={() => {
            setShowGroupCall(false);
            setGroupCallToken(null);
            socket?.emit("community:call-ended", {
              communityId: selectedCommunity._id,
            });
          }}
        />
      )}

      {/* Forward Message Modal */}
      {forwardModal && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setForwardModal(null);
                setSelectedForwardConvIds([]);
                setForwardConversations([]);
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative z-10 w-full max-w-md mx-4 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 shrink-0">
                <h3 className="text-label text-base font-semibold text-white">Forward Message</h3>
                <button
                  onClick={() => {
                    setForwardModal(null);
                    setSelectedForwardConvIds([]);
                    setForwardConversations([]);
                  }}
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 text-zinc-500" />
                </button>
              </div>

              {/* Message preview */}
              <div className="px-4 py-3 border-b border-zinc-800/30 bg-zinc-900/60 shrink-0">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Message
                </p>
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center overflow-hidden">
                    {forwardModal.message.sender.profilePic?.url ? (
                      <img src={optimizeImageUrl(forwardModal.message.sender.profilePic?.url)!} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span className="text-[8px] font-bold text-zinc-500">
                        {forwardModal.message.sender.fullName?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-300 line-clamp-2 leading-snug">
                      {forwardModal.message.text || (forwardModal.message.attachments?.length ? "Attachment" : "")}
                    </p>
                    <p className="text-[9px] text-zinc-400 mt-0.5">
                      {forwardModal.message.sender.fullName} · {formatMessageTime(forwardModal.message.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {loadingForwardConvs ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
                  </div>
                ) : forwardConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="h-8 w-8 text-zinc-700 mb-2" />
                    <p className="text-sm font-semibold text-zinc-400">No conversations yet</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Start a chat to forward messages
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 py-1">
                    {forwardConversations.map((conv) => {
                      const partner = conv.participants?.find((p: any) => p._id !== user._id);
                      const isSelected = selectedForwardConvIds.includes(conv._id);
                      return (
                        <button
                          key={conv._id}
                          onClick={() => handleToggleForwardSelection(conv._id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-white/10 border border-white/20"
                              : "hover:bg-zinc-800/50 border border-transparent"
                          }`}
                        >
                          <div className="h-9 w-9 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center overflow-hidden border border-zinc-700/50">
                            {partner?.profilePic?.url ? (
                              <img src={optimizeImageUrl(partner.profilePic?.url)!} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <span className="text-[10px] font-bold text-zinc-500">
                                {partner?.fullName?.charAt(0) || "?"}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-200 truncate">
                              {partner?.fullName || "Unknown"}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              @{partner?.username || "unknown"}
                            </p>
                          </div>
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? "bg-white border-white" : "border-zinc-600"
                          }`}>
                            {isSelected && (
                              <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-zinc-800/50 shrink-0">
                <button
                  onClick={handleExecuteForward}
                  disabled={selectedForwardConvIds.length === 0}
                  className="w-full rounded-full bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-sm font-bold py-2.5 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {selectedForwardConvIds.length > 0
                    ? `Send (${selectedForwardConvIds.length}/5)`
                    : "Select conversations"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

    </>
  );
}
