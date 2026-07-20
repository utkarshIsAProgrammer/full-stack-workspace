import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Hash,
  Users,
  Plus,
  ArrowLeft,
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
  Settings,
} from "lucide-react";
import type { Community, CommunityMessage } from "../types";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import MessageBubble from "./MessageBubble";
import CreateCommunityModal from "./CreateCommunityModal";
import CommunitySettingsModal from "./CommunitySettingsModal";
import ConfirmDialog from "./ConfirmDialog";

interface CommunitiesProps {
  user: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: { url: string; public_id?: string };
  };
  socket: any;
}

export default function Communities({ user, socket }: CommunitiesProps) {
  const userId = user._id;
  const [view, setView] = useState<"list" | "chat">("list");
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityTab, setCommunityTab] = useState<"mine" | "browse">("mine");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
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
  const [leavingCommunity, setLeavingCommunity] = useState(false);
  const [joiningCommunities, setJoiningCommunities] = useState<Set<string>>(new Set());
  const [pinnedMessages, setPinnedMessages] = useState<CommunityMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [memberList, setMemberList] = useState<
    { user: { _id: string; username: string; fullName: string; profilePic?: { url: string; public_id?: string } }; joinedAt: string }[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Fetch communities ─────────────────────────────────────────
  const fetchMyCommunities = useCallback(async () => {
    try {
      const res = await apiFetch("/api/communities/mine");
      const data = await res.json();
      if (res.ok && data.success) {
        setMyCommunities(data.communities || []);
      }
    } catch (err) {
      logger.error("Failed to fetch my communities", err);
    }
  }, []);

  const fetchAllCommunities = useCallback(async () => {
    try {
      const res = await apiFetch("/api/communities?limit=50");
      const data = await res.json();
      if (res.ok && data.success) {
        setAllCommunities(data.communities || []);
      }
    } catch (err) {
      logger.error("Failed to fetch all communities", err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyCommunities(), fetchAllCommunities()]).finally(() =>
      setLoading(false)
    );
  }, [fetchMyCommunities, fetchAllCommunities]);

  // ─── Fetch community members ─────────────────────────────────
  const fetchMembers = useCallback(async (communityId: string) => {
    try {
      const res = await apiFetch(`/api/communities/${communityId}/members`);
      const data = await res.json();
      if (res.ok && data.success) {
        setMemberList(data.members || []);
      }
    } catch (err) {
      logger.error("Failed to fetch community members", err);
    }
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
      setShowMembers(false);
      setMemberList([]);
      fetchMessages(community._id);
      fetchPinnedMessages(community._id);
      fetchMembers(community._id);
    },
    [fetchMessages, fetchPinnedMessages, fetchMembers]
  );

  // ─── Socket events ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedCommunity) return;

    const communityId = selectedCommunity._id;

    // Join the community room
    socket.emit("community:join", { communityId });

    const handleNewMessage = (message: CommunityMessage) => {
      if (message.community === communityId) {
        setMessages((prev) => [...prev, message]);
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
    socket.on("community:message:reaction", handleReaction);
    socket.on("community:message:pinned", handlePinUpdate);
    socket.on("community:message:unpinned", handlePinUpdate);
    socket.on("community:typing", handleTyping);

    return () => {
      socket.emit("community:leave", { communityId });
      socket.off("community:message:new", handleNewMessage);
      socket.off("community:message:edit", handleEditMessage);
      socket.off("community:message:delete", handleDeleteMessage);
      socket.off("community:message:reaction", handleReaction);
      socket.off("community:message:pinned", handlePinUpdate);
      socket.off("community:message:unpinned", handlePinUpdate);
      socket.off("community:typing", handleTyping);
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

    socket.on("community:member-joined", handleMemberUpdate);
    socket.on("community:member-left", handleMemberUpdate);
    const handleCommunityDeletedEvent = (data: { communityId: string }) => {
      handleCommunityDeleted(data.communityId);
    };

    socket.on("community:updated", handleCommunityUpdate);
    socket.on("community:deleted", handleCommunityDeletedEvent);

    return () => {
      socket.off("community:member-joined", handleMemberUpdate);
      socket.off("community:member-left", handleMemberUpdate);
      socket.off("community:updated", handleCommunityUpdate);
      socket.off("community:deleted", handleCommunityDeletedEvent);
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

  // ─── File selection ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    const previews = validFiles.map((f) => URL.createObjectURL(f));
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFilePreviews((prev) => [...prev, ...previews]);
    if (e.target) e.target.value = "";
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

  // ─── Send message ──────────────────────────────────────────────
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && selectedFiles.length === 0) || sending) return;
    if (!selectedCommunity) return;

    setSending(true);
    setSendingError(null);
    emitTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    try {
      const formData = new FormData();
      formData.append("text", messageInput.trim());
      if (replyTo) {
        formData.append("replyTo", replyTo._id);
      }
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await apiFetch(
        `/api/communities/${selectedCommunity._id}/messages`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setMessageInput("");
        setSelectedFiles([]);
        setFilePreviews((prev) => {
          prev.forEach((url) => URL.revokeObjectURL(url));
          return [];
        });
        setReplyTo(null);

        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
        }
      } else {
        setSendingError(data.message || "Failed to send message");
      }
    } catch (err) {
      logger.error("Failed to send message", err);
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
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
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
    try {
      await apiFetch(`/api/communities/messages/${message._id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } catch (err) {
      logger.error("Failed to toggle reaction", err);
    }
  };

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

  const handleContextMenu = (
    e: React.MouseEvent | { clientX: number; clientY: number; preventDefault: () => void },
    message: any
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
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
        setAllCommunities((prev) =>
          prev.map((c) =>
            c._id === communityId ? { ...c, isMember: true, memberCount: data.memberCount } : c
          )
        );
        // Join the community room immediately for live member count updates
        if (socket) {
          socket.emit("community:join", { communityId });
        }
        // Refresh my communities
        fetchMyCommunities();
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
        }
      }
    } catch (err) {
      logger.error("Failed to leave community", err);
    }
  };

  // ─── Leave community from chat header ─────────────────────────
  const handleLeaveCurrentCommunity = async () => {
    if (!selectedCommunity || leavingCommunity) return;
    setLeavingCommunity(true);
    await handleLeaveCommunity(selectedCommunity._id);
    setLeavingCommunity(false);
    setConfirmLeaveOpen(false);
  };

  const promptLeaveCommunity = () => {
    setConfirmLeaveOpen(true);
  };

  const cancelLeaveCommunity = () => {
    setConfirmLeaveOpen(false);
  };

  // ─── Handle community created ──────────────────────────────────
  const handleCommunityCreated = (community: Community) => {
    setMyCommunities((prev) => [community, ...prev]);
    setAllCommunities((prev) => [community, ...prev]);
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
    );
  };

  // ─── Handle community deleted ──────────────────────────────────
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
    const displayCommunities =
      communityTab === "mine" ? myCommunities : allCommunities;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-bold text-white">Communities</h2>
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
            onClick={() => setCommunityTab("mine")}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              communityTab === "mine"
                ? "text-white border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            My Communities
          </button>
          <button
            onClick={() => setCommunityTab("browse")}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              communityTab === "browse"
                ? "text-white border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Browse All
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
            </div>
          ) : displayCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Hash className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm font-semibold text-zinc-400 mb-1">
                {communityTab === "mine"
                  ? "No communities yet"
                  : "No communities found"}
              </p>
              <p className="text-[11px] text-zinc-600 mb-4">
                {communityTab === "mine"
                  ? "Create or join a community to get started"
                  : "Be the first to create one!"}
              </p>
              {communityTab === "mine" && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="rounded-full bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  Create Community
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {displayCommunities.map((community) => (
                <button
                  key={community._id}
                  onClick={() => {
                    if (community.isMember) {
                      handleSelectCommunity(community);
                    } else {
                      handleJoinCommunity(community._id);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-zinc-900/50 transition-all cursor-pointer text-left group"
                >
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50">
                    {community.image?.url ? (
                      <img
                        src={community.image.url}
                        alt={community.name}
                        className="h-full w-full rounded-xl object-cover"
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
                      {community.memberCount} member{community.memberCount !== 1 ? "s" : ""}
                      {community.description ? ` · ${community.description}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {community.isMember ? (
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                        Open
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full group-hover:bg-emerald-500/20 transition-all inline-flex items-center gap-1.5">
                        {joiningCommunities.has(community._id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {joiningCommunities.has(community._id) ? "Joining..." : "Join"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render Community Chat ─────────────────────────────────────
  const renderCommunityChat = () => {
    if (!selectedCommunity) return null;

    const isInCommunity = selectedCommunity.isMember ?? 
      myCommunities.some((c) => c._id === selectedCommunity._id);

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
            <p className="text-[11px] text-zinc-600 mb-4">
              Join to see messages and participate in the conversation
            </p>              <button
              onClick={() => handleJoinCommunity(selectedCommunity._id)}
              disabled={joiningCommunities.has(selectedCommunity._id)}
              className="rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-5 py-2.5 text-xs font-bold text-white transition-all cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
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
            <h3 className="text-sm font-semibold text-white truncate">
              {selectedCommunity.name}
            </h3>
            <p className="text-[10px] text-zinc-500">
              {selectedCommunity.memberCount} member{selectedCommunity.memberCount !== 1 ? "s" : ""}
              {Object.keys(typingUsers).length > 0 && (
                <span className="text-indigo-400 ml-2">
                  · {Object.keys(typingUsers).length} typing...
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              setShowMembers((prev) => !prev);
              if (!showMembers && memberList.length === 0 && selectedCommunity) {
                fetchMembers(selectedCommunity._id);
              }
            }}
            className={`h-7 w-7 rounded-full flex items-center justify-center hover:bg-zinc-700/50 transition-colors cursor-pointer shrink-0 ${showMembers ? "bg-indigo-500/20 text-indigo-400" : ""}`}
            title="Members"
          >
            <Users className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
          </button>
          {selectedCommunity.creator?._id === userId && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-zinc-700/50 transition-colors cursor-pointer shrink-0"
              title="Community settings"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
            </button>
          )}
          <button
            onClick={promptLeaveCommunity}
            disabled={leavingCommunity}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Leave community"
          >
            {leavingCommunity ? (
              <Loader2 className="h-3.5 w-3.5 text-red-400 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" />
            )}
          </button>
        </div>

        {/* Member list panel */}
        {showMembers && (
          <div className="shrink-0 border-b border-zinc-800/50 bg-zinc-900/80 px-4 py-3 max-h-[280px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {memberList.length} Member{memberList.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {memberList.map((member) => {
                const isCreator = selectedCommunity?.creator?._id === member.user._id;
                return (
                  <div
                    key={member.user._id}
                    className="flex items-center gap-2.5"
                  >
                    <div className="h-7 w-7 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center overflow-hidden">
                      {member.user.profilePic?.url ? (
                        <img
                          src={member.user.profilePic.url}
                          alt={member.user.fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-zinc-500">
                          {member.user.fullName?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-zinc-200 truncate">
                          {member.user.fullName}
                        </span>
                        {isCreator && (
                          <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {memberList.length === 0 && (
                <p className="text-[11px] text-zinc-600 text-center py-2">
                  No members data available
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pinned messages banner */}
        {pinnedMessages.length > 0 && (
          <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <Pin className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Pinned {pinnedMessages.length > 1 ? `${pinnedMessages.length} messages` : "message"}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {pinnedMessages.map((pinned) => (
                <div
                  key={pinned._id}
                  className="shrink-0 max-w-[220px] bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-2.5 flex items-start gap-2"
                >
                  <div className="h-6 w-6 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center overflow-hidden">
                    {pinned.sender.profilePic?.url ? (
                      <img
                        src={pinned.sender.profilePic.url}
                        alt={pinned.sender.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[9px] font-bold text-zinc-500">
                        {pinned.sender.fullName?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-zinc-300 truncate leading-tight">
                      {pinned.text || (pinned.attachments?.length ? "📎 Attachment" : "")}
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">
                      {pinned.sender.fullName} · {formatMessageTime(pinned.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5"
          onScroll={(e) => {
            const el = e.currentTarget;
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

          {!loadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm font-semibold text-zinc-400 mb-1">
                No messages yet
              </p>
              <p className="text-[11px] text-zinc-600">
                Be the first to send a message in {selectedCommunity.name}
              </p>
            </div>
          )}

          {loadingMessages && messages.length > 0 && (
            <div className="flex justify-center py-3">
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
              seen: true,
              _pending: undefined,
              _failed: undefined,
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

        {/* Reply/Edit indicator */}
        {replyTo && (
          <div className="px-4 py-2 bg-zinc-900/80 border-t border-zinc-800/50 flex items-center gap-2 shrink-0">
            <CornerDownLeft className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-indigo-400">
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
          <div className="px-4 py-2 bg-zinc-900/80 border-t border-zinc-800/50 flex items-center gap-2 shrink-0">
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

        {/* File previews */}
        {filePreviews.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-800/50 flex gap-2 overflow-x-auto shrink-0">
            {filePreviews.map((url, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={url}
                  alt="Preview"
                  className="h-14 w-14 rounded-lg object-cover border border-zinc-700/50"
                />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-4 py-3 border-t border-zinc-800/50 shrink-0">
          {sendingError && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5 border border-red-500/20">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{sendingError}</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Attach image"
            >
              <Image className="h-4 w-4 text-zinc-500 hover:text-zinc-300" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex-1 min-w-0">
              <textarea
                ref={inputRef}
                value={messageInput}
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
                className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none max-h-[120px]"
              />
            </div>
            <button
              onClick={editingMessage ? handleEditSubmit : handleSendMessage}
              disabled={
                (!messageInput.trim() && selectedFiles.length === 0) || sending
              }
              className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Context menu */}
        <AnimatePresence>
          {contextMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100]"
                onClick={() => setContextMenu(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-[101] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden py-1 min-w-[160px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
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
                    <button
                      onClick={() => handleDeleteForMe(contextMenu.message._id)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      Delete for me
                    </button>
                  </>
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
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      <div className="h-full w-full overflow-hidden">
        {view === "list" ? renderCommunityList() : renderCommunityChat()}
      </div>
      <CreateCommunityModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCommunityCreated}
      />
      <ConfirmDialog
        isOpen={confirmLeaveOpen}
        title="Leave community?"
        message={`Are you sure you want to leave "${selectedCommunity?.name || "this community"}"? You'll need to rejoin to see messages again.`}
        confirmLabel={leavingCommunity ? "Leaving..." : "Leave"}
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleLeaveCurrentCommunity}
        onCancel={cancelLeaveCommunity}
      />
      {selectedCommunity && (
        <CommunitySettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          community={selectedCommunity}
          onUpdated={handleCommunityUpdated}
          onDeleted={handleCommunityDeleted}
        />
      )}
    </>
  );
}
