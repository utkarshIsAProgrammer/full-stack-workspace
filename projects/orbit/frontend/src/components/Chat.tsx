import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Search,
  Smile,
  Trash2,
  Edit2,
  X,
  Loader2,
  CornerDownLeft,
  ArrowLeft,
  Copy,
  Share2,
  User,
} from "lucide-react";
import { Socket } from "socket.io-client";
import { User as UserType, Conversation, Message, MessageReaction } from "../types";
import GlassCard from "./GlassCard";
import Skeleton from "./Skeleton";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import ValidationMessage from "./ValidationMessage";
import MessageBubble from "./MessageBubble";
import { validateChatMessage } from "../utils/validation";

interface ChatProps {
  user: UserType;
  socket: Socket | null;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onUserSelected: (username: string) => void;
  onBack: () => void;
}

export default function Chat({ user, socket, conversations, setConversations, onUserSelected, onBack }: ChatProps) {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [inputText, setInputText] = useState("");

  // New conversation / User Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserType[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Media attachments upload
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Typing indicator states
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Message edit state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    message: Message;
    x: number;
    y: number;
  } | null>(null);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [customEmoji, setCustomEmoji] = useState("");

  // Forward modal state
  const [forwardModal, setForwardModal] = useState<{
    message: Message;
    x: number;
    y: number;
  } | null>(null);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Messages pagination
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const messagesTopSentinelRef = useRef<HTMLDivElement>(null);  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Refs for socket listener closures — prevents listener re-registration on conversation/user change
  const selectedConvRef = useRef(selectedConv);
  selectedConvRef.current = selectedConv;
  const userRef = useRef(user);
  userRef.current = user;
  const socketRef = useRef(socket);
  socketRef.current = socket;

  // Pending message IDs (optimistic messages not yet confirmed by server)
  const [, setPendingMessageIds] = useState<Set<string>>(new Set());

  // Fetch messages when conversation is selected or socket becomes available
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      setPartnerTyping(false);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMsgs(true);
      setMessagesCursor(null);
      setMessagesHasMore(false);
      try {
        const res = await apiFetch(`/api/chats/conversations/${selectedConv._id}/messages?limit=20`);
        const data = await res.json();
        if (res.ok && data.success) {
          setMessages(data.messages || []);
          setMessagesCursor(data.nextCursor || null);
          setMessagesHasMore(data.hasMore || false);
          scrollToBottom();
        }
      } catch (err) {
        logger.error("Failed to fetch messages", err);
      } finally {
        setLoadingMsgs(false);
      }
    };

    fetchMessages();

    // Clear unread count for this conversation when opening it
    setConversations((prev) =>
      prev.map((c) =>
        c._id === selectedConv._id
          ? { ...c, unreadCounts: { ...c.unreadCounts, [user._id]: 0 } }
          : c
      )
    );

    // Socket: Join room
    if (socket) {
      socket.emit("chat:join", { conversationId: selectedConv._id });
    }

    return () => {
      // Socket: Leave room
      if (socket && selectedConv) {
        socket.emit("chat:leave", { conversationId: selectedConv._id });
      }
    };
  }, [selectedConv, socket]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // Handle Socket Events — reads from refs to avoid re-registering listeners on conv/user change
  useEffect(() => {
    const s = socket;
    if (!s) return;

    // Listen for presence updates
    s.on("user:presence", ({ userId: presenceUserId, status }: { userId: string; status: "online" | "offline" }) => {
      logger.info("Chat: Received user:presence event", { presenceUserId, status });
      setConversations((prev) =>
        prev.map((c) => {
          const other = c.participants.find((p) => p && p._id === presenceUserId);
          if (other) {
            return {
              ...c,
              presence: status as "online" | "offline",
            };
          }
          return c;
        })
      );
    });

    // Listen for new messages
    s.on("message:new", (message: Message) => {
      logger.info("Chat: Received message:new event", { messageId: message._id, conversationId: message.conversation });
      const currentConv = selectedConvRef.current;
      const currentUser = userRef.current;
      if (!currentUser) return;
      // If message is for the current conversation, append it
      if (currentConv && message.conversation === currentConv._id) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id === message._id)) return prev;
          // Remove pending version if present
          const filtered = prev.filter((m) => !m._id.startsWith("pending-") || (m as any)._pendingConv !== message.conversation);
          return [...filtered, message];
        });
      }

      // Update conversations list to show last message
      setConversations((prev) => {
        return prev.map((c) => {
          if (c._id === message.conversation) {
            const isMeRecipient = message.recipient === currentUser._id;
            const updatedUnread = (currentConv && currentConv._id === c._id)
              ? 0
              : isMeRecipient
                ? (c.unreadCounts?.[currentUser._id] || 0) + 1
                : (c.unreadCounts?.[currentUser._id] || 0);

            return {
              ...c,
              lastMessage: message,
              unreadCounts: {
                ...c.unreadCounts,
                [currentUser._id]: updatedUnread
              }
            };
          }
          return c;
        }).sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());
      });
    });

    // Listen for message edits
    s.on("message:edit", (message: Message) => {
      logger.info("Chat: Received message:edit event", { messageId: message._id, conversationId: message.conversation });
      const currentConv = selectedConvRef.current;
      if (currentConv && message.conversation === currentConv._id) {
        setMessages((prev) => prev.map((m) => (m._id === message._id ? message : m)));
      }
      setConversations((prev) =>
        prev.map((c) => (c._id === message.conversation ? { ...c, lastMessage: message } : c))
      );
    });

    // Listen for message deletions
    s.on("message:delete", ({ messageId }: { messageId: string }) => {
      logger.info("Chat: Received message:delete event", { messageId });
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, text: "This message was deleted", attachments: [] }
            : m
        )
      );
      const currentConv = selectedConvRef.current;
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === currentConv?._id && c.lastMessage?._id === messageId) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                isDeleted: true,
                text: "This message was deleted",
                attachments: []
              }
            };
          }
          return c;
        })
      );
    });

    // Listen for message reactions
    s.on("message:reaction", (payload: { messageId: string; reaction: MessageReaction | null; type: "add" | "remove" }) => {
      logger.info("Chat: Received message:reaction event", payload);
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== payload.messageId) return m;
          const reaction = payload.reaction;
          if (payload.type === "add" && reaction) {
            const existingReactions = m.reactions || [];
            const senderId = typeof reaction.sender === "string" ? reaction.sender : reaction.sender._id;
            const filtered = existingReactions.filter((r) => {
              const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
              return sId !== senderId;
            });
            return { ...m, reactions: [...filtered, reaction] };
          } else if (payload.type === "remove" && reaction) {
            const existingReactions = m.reactions || [];
            const senderId = typeof reaction.sender === "string" ? reaction.sender : reaction.sender._id;
            const filtered = existingReactions.filter((r) => {
              const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
              return !(sId === senderId && r.emoji === reaction.emoji);
            });
            return { ...m, reactions: filtered };
          }
          return m;
        })
      );
    });

    // Listen for conversation deletions
    s.on("conversation:delete", ({ conversationId }: { conversationId: string }) => {
      logger.info("Chat: Received conversation:delete event", { conversationId });
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      setSelectedConv((currentSelected) => {
        if (currentSelected?._id === conversationId) {
          return null;
        }
        return currentSelected;
      });
    });

    // Listen for conversation clearing (conversation room)
    s.on("conversation:clear", ({ conversationId }: { conversationId: string }) => {
      logger.info("Chat: Received conversation:clear event", { conversationId });
      const currentConv = selectedConvRef.current;
      if (currentConv && currentConv._id === conversationId) {
        setMessages([]);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId ? { ...c, lastMessage: undefined } : c
        )
      );
    });

    // Listen for conversation cleared (personal room — when user is not in the conversation)
    s.on("conversation:cleared", ({ conversationId }: { conversationId: string }) => {
      logger.info("Chat: Received conversation:cleared event", { conversationId });
      const currentConv = selectedConvRef.current;
      if (currentConv && currentConv._id === conversationId) {
        setMessages([]);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId ? { ...c, lastMessage: undefined } : c
        )
      );
    });


    // Listen for read receipts
    s.on("messages:seen", ({ conversationId, seenBy, seenAt }: { conversationId: string; seenBy: string; seenAt?: Date }) => {
      logger.info("Chat: Received messages:seen event", { conversationId, seenBy, seenAt });
      const currentConv = selectedConvRef.current;
      const currentUser = userRef.current;
      
      // Update messages in the active conversation (double tick)
      if (currentConv && currentConv._id === conversationId && seenBy !== currentUser?._id) {
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = typeof m.sender === "string" ? m.sender : m.sender?._id;
            if (senderId === currentUser?._id) {
              return { ...m, seen: true, seenAt: seenAt ? new Date(seenAt).toISOString() : new Date().toISOString() };
            }
            return m;
          })
        );
      }
      
      // Update the conversation's unreadCounts so the app-level chatBadgeCount recalculates
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === conversationId && currentUser) {
            return {
              ...c,
              unreadCounts: {
                ...c.unreadCounts,
                [currentUser._id]: 0
              }
            };
          }
          return c;
        })
      );
    });

    // Listen for typing indicators
    s.on("chat:typing", ({ conversationId, userId: typingUserId, isTyping: partnerIsTyping }: any) => {
      logger.info("Chat: Received chat:typing event", { conversationId, typingUserId, isTyping: partnerIsTyping });
      const currentConv = selectedConvRef.current;
      const currentUser = userRef.current;
      if (currentConv && currentConv._id === conversationId && typingUserId !== currentUser?._id) {
        setPartnerTyping(partnerIsTyping);
      }
    });

    return () => {
      s.off("user:presence");
      s.off("message:new");
      s.off("message:edit");
      s.off("message:delete");
      s.off("message:reaction");
      s.off("conversation:delete");
      s.off("conversation:clear");
      s.off("conversation:cleared");
      s.off("messages:seen");
      s.off("chat:typing");
    };
  }, [socket]);

  // Fetch older messages (infinite scroll up)
  const fetchOlderMessages = async () => {
    if (!messagesCursor || loadingOlderMessages || !selectedConv) return;
    setLoadingOlderMessages(true);
    // Preserve scroll position: record the height before loading
    const container = document.querySelector('[class*="overflow-y-auto"][class*="scrollbar-thin"]');
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const res = await apiFetch(`/api/chats/conversations/${selectedConv._id}/messages?limit=20&cursor=${messagesCursor}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const newOnes = (data.messages || []).filter((m: any) => !messages.some((existing) => existing._id === m._id));
        setMessages((prev) => [...newOnes, ...prev]);
        setMessagesCursor(data.nextCursor || null);
        setMessagesHasMore(data.hasMore || false);
        // Restore scroll position after new messages are prepended
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      logger.error("Failed to fetch older messages", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  // IntersectionObserver for loading older messages
  useEffect(() => {
    if (!messagesHasMore || loadingOlderMessages || !selectedConv) return;
    const sentinel = messagesTopSentinelRef.current;
    if (!sentinel) return;

    // Find the scrollable parent
    let scrollParent: Element | null = null;
    let el: Element | null = sentinel.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflow === "auto" || style.overflow === "scroll") {
        scrollParent = el;
        break;
      }
      el = el.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchOlderMessages();
        }
      },
      { root: scrollParent, rootMargin: "100px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [messagesHasMore, loadingOlderMessages, messagesCursor, selectedConv]);

  // Scroll to bottom — reset scroll position first to prevent mobile jump
  const scrollToBottom = () => {
    // First, scroll the container to the very bottom instantly (no smooth behavior)
    // to prevent the 'scrolled up' look on mobile when a conversation is opened
    const container = document.querySelector('[class*="overflow-y-auto"][class*="scrollbar-thin"]');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Trigger typing notification — use refs to avoid stale closure in setTimeout
  const handleTyping = () => {
    const s = socketRef.current;
    const conv = selectedConvRef.current;
    if (!s || !conv) return;

    if (!isTyping) {
      setIsTyping(true);
      s.emit("chat:typing", { conversationId: conv._id, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const s2 = socketRef.current;
      const conv2 = selectedConvRef.current;
      if (s2 && conv2) {
        s2.emit("chat:typing", { conversationId: conv2._id, isTyping: false });
      }
    }, 2000);
  };

  // User search to start a new chat
  const handleUserSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearching(true);
    setShowSearchDropdown(true);
    try {
      const res = await apiFetch(`/api/search/users?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Exclude current user
        setSearchResults((data.users || []).filter((u: UserType) => u._id !== user._id));
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setSearching(false);
    }
  };

  // Start chat with user
  const startConversation = async (recipientId: string) => {
    setShowSearchDropdown(false);
    setSearchQuery("");

    try {
      const res = await apiFetch("/api/chats/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.conversation) {
        // Select this conversation immediately
        setSelectedConv(data.conversation);
        // Add to list
        setConversations(prev => [data.conversation, ...prev]);
      }
    } catch (err) {
      logger.error("Failed to create conversation", err);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateChatMessage({ text: inputText, hasAttachments: attachments.length > 0 });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (!selectedConv || sendingMessage) return;

    setSendingMessage(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);

    if (socket) {
      socket.emit("chat:typing", { conversationId: selectedConv._id, isTyping: false });
    }

    // Optimistic: insert pending message immediately for tick feedback
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage: any = {
      _id: pendingId,
      conversation: selectedConv._id,
      sender: { _id: user._id, username: user.username, fullName: user.fullName, profilePic: user.profilePic },
      recipient: getPartner(selectedConv)._id,
      text: inputText.trim(),
      attachments: [],
      seen: false,
      _pending: true,
      _pendingConv: selectedConv._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Only show pending for text messages (attachments complicate optimistic)
    const showOptimistic = inputText.trim().length > 0 && attachments.length === 0;
    if (showOptimistic) {
      setPendingMessageIds((prev) => new Set(prev).add(pendingId));
      setMessages((prev) => [...prev, optimisticMessage]);
      scrollToBottom();
      // Clear input immediately for optimistic send
      setInputText("");
    }

    // Save input for rollback on failure (declared here so catch block can access it)
    const savedInput = inputText;
    const savedAttachments = [...attachments];
    const savedPreviews = [...attachmentPreviews];

    try {
      const formData = new FormData();
      formData.append("text", inputText.trim());
      attachments.forEach((file) => {
        formData.append("files", file);
      });

      const res = await apiFetch(`/api/chats/conversations/${selectedConv._id}/messages`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success && data.sentMessage) {
        // Replace pending message with confirmed one
        setPendingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(pendingId);
          return next;
        });
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== pendingId);
          // Prevent duplicates in case the socket event is also received
          if (filtered.some((m) => m._id === data.sentMessage._id)) return filtered;
          return [...filtered, data.sentMessage];
        });
        scrollToBottom();

        if (!showOptimistic) {
          // Clear input only after successful send (for attachment messages)
          setInputText("");
          setAttachments([]);
          setAttachmentPreviews([]);
        }
      } else {
        // Rollback on failure — remove pending message
        setPendingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(pendingId);
          return next;
        });
        setMessages((prev) => prev.filter((m) => m._id !== pendingId));
        if (!showOptimistic) {
          setInputText(savedInput);
          setAttachments(savedAttachments);
          setAttachmentPreviews(savedPreviews);
        }
        logger.error("Message send failed", data.message);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to send message. Please try again.",
              type: "error",
            },
          })
        );
      }
    } catch (err) {
      logger.error(err);
      // Rollback on error — restore saved input
      setPendingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingId);
        return next;
      });
      setMessages((prev) => prev.filter((m) => m._id !== pendingId));
      setInputText(savedInput);
      if (!showOptimistic) {
        setAttachments(savedAttachments);
        setAttachmentPreviews(savedPreviews);
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Failed to send message. Please try again.",
            type: "error",
          },
        })
      );
    } finally {
      setSendingMessage(false);
    }
  };

  // Edit message
  const handleEditMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateChatMessage({ text: editText, hasAttachments: false });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    if (!editingMessage) return;

    const msgId = editingMessage._id;
    const txt = editText;

    setEditingMessage(null);
    setEditText("");

    try {
      const res = await apiFetch(`/api/chats/messages/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: txt }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        logger.error("Message edit failed");
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    // 1. Optimistic UI update
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: "This message was deleted", attachments: [] }
          : m
      )
    );

    try {
      const res = await apiFetch(`/api/chats/messages/${messageId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        logger.error("Message deletion failed");
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: data.message || "Failed to delete message.",
              type: "error",
            },
          })
        );
      }
    } catch (e) {
      logger.error(e);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Error deleting message.",
            type: "error",
          },
        })
      );
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent deletion if there are unread messages
    const conversation = conversations.find(c => c._id === conversationId);
    const unreadCount = conversation?.unreadCounts?.[user._id] || 0;
    if (unreadCount > 0) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: "Cannot delete conversation with unread messages",
            type: "error",
          },
        })
      );
      return;
    }

    try {
      const res = await apiFetch(`/api/chats/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConversations((prev) => prev.filter((c) => c._id !== conversationId));
        if (selectedConv?._id === conversationId) {
          setSelectedConv(null);
        }
      } else {
        logger.error("Failed to delete conversation", data.message);
      }
    } catch (err) {
      logger.error("Failed to delete conversation", err);
    }
  };

  // Clear chat history
  const handleClearChat = async () => {
    if (!selectedConv) return;
    try {
      const res = await apiFetch(`/api/chats/conversations/${selectedConv._id}/messages`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages([]);
        // Update local conversations list to reset lastMessage
        setConversations((prev) =>
          prev.map((c) =>
            c._id === selectedConv._id ? { ...c, lastMessage: undefined } : c
          )
        );
      } else {
        logger.error("Failed to clear chat", data.message);
      }
    } catch (err) {
      logger.error("Failed to clear chat", err);
    }
  };

  // Handle reaction
  const handleReaction = async (message: Message, emoji: string) => {
    // 1. Optimistic UI update
    const userId = user._id;
    const existingIndex = (message.reactions || []).findIndex((r) => {
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      return sId === userId && r.emoji === emoji;
    });

    let nextReactions = [...(message.reactions || [])];
    if (existingIndex >= 0) {
      // Toggle off
      nextReactions.splice(existingIndex, 1);
    } else {
      // Toggle off any other reaction by this sender first
      nextReactions = nextReactions.filter((r) => {
        const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
        return sId !== userId;
      });
      // Add new reaction
      nextReactions.push({
        _id: Date.now().toString(), // temp ID
        emoji,
        sender: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          profilePic: user.profilePic
        },
        createdAt: new Date()
      } as any);
    }

    setMessages((prev) =>
      prev.map((m) => (m._id === message._id ? { ...m, reactions: nextReactions } : m))
    );

    try {
      const res = await apiFetch(`/api/chats/messages/${message._id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.reactions) {
        // 2. Synchronize with exact backend response
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? { ...m, reactions: data.reactions } : m))
        );
      } else {
        logger.error("Reaction failed");
        // Revert to original
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? message : m))
        );
      }
    } catch (err) {
      logger.error(err);
      // Revert to original
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? message : m))
      );
    }
  };

  // Handle custom emoji submission
  const handleCustomEmoji = async (message: Message) => {
    if (customEmoji.trim()) {
      await handleReaction(message, customEmoji.trim());
      setShowEmojiPicker(null);
      setCustomEmoji("");
    }
  };

  // Handle copy message
  const handleCopyMessage = async (message: Message) => {
    if (message.text) {
      await navigator.clipboard.writeText(message.text);
    }
    setContextMenu(null);
  };

  // Handle forward message
  const handleForwardMessage = async (targetConversationId: string) => {
    if (!forwardModal) return;
    try {
      const formData = new FormData();
      formData.append("text", `Forwarded: ${forwardModal.message.text}`);
      if (forwardModal.message.attachments && forwardModal.message.attachments.length > 0) {
        // We don't have the original files, so just forward text
      }
      const res = await apiFetch(`/api/chats/conversations/${targetConversationId}/messages`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForwardModal(null);
      }
    } catch (err) {
      logger.error(err);
    }
  };

  // Context menu handlers
  const isEditable = (createdAtStr: string) => {
    const diffMs = Date.now() - new Date(createdAtStr).getTime();
    return diffMs <= 5 * 60 * 1000; // 5 minutes
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    // Calculate safe position for mobile to prevent menu from being cut off
    const x = e.clientX;
    const y = e.clientY;
    const safeX = Math.min(Math.max(10, x), window.innerWidth - 10);
    const safeY = Math.min(Math.max(10, y), window.innerHeight - 10);
    setContextMenu({ message, x: safeX, y: safeY });
  };

  // Attachments handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const validFiles = files.slice(0, 5 - attachments.length);
    setAttachments((prev) => [...prev, ...validFiles]);

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    setAttachmentPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setAttachmentPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const getPartner = (conv: Conversation) => {
    return conv.participants.find((p) => p && p._id !== user._id) || user;
  };

  const getPartnerPresence = (conv: Conversation) => {
    return conv.presence || "offline";
  };

  const formatMessageTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Group reactions by emoji and count them
  const getGroupedReactions = (reactions?: MessageReaction[]) => {
    if (!reactions || reactions.length === 0) return {};
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, hasReacted: false };
      }
      grouped[r.emoji].count++;
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      if (sId === user._id) {
        grouped[r.emoji].hasReacted = true;
      }
    });
    return grouped;
  };

  return (
    <div className="w-full px-2 pb-24 pt-6 h-[calc(100vh-7rem)] h-screen-force relative select-text chat-container">
      <GlassCard animate={true} className="w-full h-full p-0 flex rounded-4xl overflow-hidden border-white/5 bg-zinc-950/20 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {!selectedConv ? (
            <motion.div
              key="conversations-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full h-full flex flex-col"
            >
              <div className="p-4 pb-0 flex items-center gap-3 shrink-0">
                <button
                  onClick={onBack}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
                  title="Go Back to Home Feed"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <h3 className="font-sans text-xs font-black text-white uppercase tracking-widest">
                  Messages
                </h3>
              </div>

              <div className="p-4 border-b border-zinc-800/30 relative z-20 shrink-0">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search usernames..."
                    value={searchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-950/50 py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:bg-zinc-900 transition-all"
                  />
                </div>

                <AnimatePresence>
                  {showSearchDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-4 right-4 mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-2xl p-2 shadow-2xl max-h-60 overflow-y-auto z-50"
                    >
                      <div className="flex items-center justify-between px-2 pb-1.5 border-b border-zinc-800">
                        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-550">
                          Find Users
                        </span>
                        <button onClick={() => setShowSearchDropdown(false)}>
                          <X className="h-3 w-3 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                      {searching ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-550" />
                        </div>
                      ) : searchResults.length === 0 ? (
                        <p className="text-[10px] text-zinc-550 text-center py-6 font-mono uppercase">
                          No users found
                        </p>
                      ) : (
                        <div className="space-y-0.5 mt-1.5">
                          {searchResults.map((usr) => (
                            <div
                              key={usr._id}
                              onClick={() => startConversation(usr._id)}
                              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-zinc-800/60 cursor-pointer transition-colors"
                            >
                              <img loading="lazy" 
                                src={usr.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                                alt={usr.fullName}
                                className="h-7 w-7 rounded-full object-cover border border-zinc-800"
                              />
                              <div className="text-left">
                                <p className="text-xs font-bold text-zinc-200 leading-tight">
                                  {usr.fullName}
                                </p>
                                <p className="text-[9px] text-zinc-500 font-bold">@{usr.username}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 p-3 scrollbar-thin">
                {loadingConvs ? (
                  <div className="space-y-3 p-2">
                    <Skeleton variant="profile-row" />
                    <Skeleton variant="profile-row" />
                    <Skeleton variant="profile-row" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-20 px-4">
                    <MessageSquare className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest leading-relaxed">
                      No conversations yet
                    </h4>
                    <p className="text-[10px] text-zinc-550 mt-1 font-mono uppercase">
                      Search for a user to start chatting
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const partner = getPartner(conv);
                    const presence = getPartnerPresence(conv);
                    const unread = conv.unreadCounts?.[user._id] || 0;

                    return (
                      <div
                        key={conv._id}
                        onClick={() => setSelectedConv(conv)}
                        className="flex items-center gap-3 rounded-2xl p-3 cursor-pointer transition-all border hover:bg-zinc-900/30 text-zinc-300 border-transparent"
                      >
                        <div className="relative shrink-0">
                          <img loading="lazy" 
                            src={partner.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                            alt={partner.fullName}
                            className="h-10 w-10 rounded-full object-cover border border-zinc-800"
                          />
                          {presence === "online" && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-zinc-950 shadow-md" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-black leading-tight truncate text-zinc-100 uppercase tracking-wide">
                              {partner.fullName}
                            </span>
                            {conv.lastMessage && (
                              <span className="text-[8.5px] font-mono text-zinc-500 shrink-0 mt-0.5">
                                {formatMessageTime(conv.lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center gap-2 mt-1">
                            <p className="text-[10.5px] truncate leading-tight flex-1 text-zinc-400">
                              {conv.lastMessage?.isDeleted ? (
                                <span className="italic">deleted message</span>
                              ) : conv.lastMessage?.text ? (
                                conv.lastMessage.text
                              ) : conv.lastMessage?.attachments && conv.lastMessage.attachments.length > 0 ? (
                                <span className="font-semibold text-zinc-300">sent attachment</span>
                              ) : (
                                <span className="italic">Start a conversation</span>
                              )}
                            </p>

                            {unread > 0 && (
                              <span className="h-4.5 min-w-4.5 px-1 rounded-full bg-white text-[9px] font-extrabold text-black flex items-center justify-center shadow-sm border border-zinc-200 shrink-0">
                                {unread}
                              </span>
                            )}

                            <button
                              onClick={(e) => handleDeleteConversation(conv._id, e)}
                              className="h-6 w-6 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-450 hover:bg-white/5 transition-all cursor-pointer shrink-0 ml-1"
                              title="Delete Conversation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="conversation-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full flex flex-col"
            >
              <div className="p-4 border-b border-zinc-800/30 flex items-center justify-between shrink-0 bg-zinc-950/20 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConv(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
                    title="Back to Conversations List"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div
                    className="relative cursor-pointer hover:opacity-85"
                    onClick={() => onUserSelected(getPartner(selectedConv).username)}
                  >
                    <img loading="lazy" 
                      src={getPartner(selectedConv).profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                      alt={getPartner(selectedConv).fullName}
                      className="h-9 w-9 rounded-full object-cover border border-zinc-800"
                    />
                    {getPartnerPresence(selectedConv) === "online" && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-zinc-950" />
                    )}
                  </div>
                  <div className="text-left">
                    <h4
                      className="text-xs font-black text-white hover:underline cursor-pointer uppercase tracking-wider"
                      onClick={() => onUserSelected(getPartner(selectedConv).username)}
                    >
                      {getPartner(selectedConv).fullName}
                    </h4>
                    <p className="text-[9px] text-zinc-500 font-bold leading-none mt-0.5">
                      {getPartnerPresence(selectedConv) === "online" ? "Active now" : "Offline"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearChat}
                    className="flex h-8 px-3 items-center gap-1.5 rounded-full border border-zinc-200/10 hover:border-red-500/20 bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-all cursor-pointer shadow-sm text-[10px] font-black uppercase tracking-wider"
                    title="Clear All Chat History"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                {loadingMsgs ? (
                  <div className="space-y-4 p-2">
                    {/* First batch loading — show 4 message bubble skeletons */}
                    <Skeleton variant="message-received" />
                    <Skeleton variant="message-sent" />
                    <Skeleton variant="message-received" />
                    <Skeleton variant="message-sent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <MessageSquare className="h-8 w-8 text-zinc-700 animate-bounce mb-3" />
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest">
                      Say hello!
                    </h4>
                    <p className="text-[10px] text-zinc-550 mt-1 font-mono uppercase max-w-xs leading-relaxed">
                      Send the first message to start the conversation
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Top sentinel for infinite scroll (load older messages) */}
                    {messagesHasMore && (
                      <div ref={messagesTopSentinelRef} className="flex justify-center py-3">
                        {loadingOlderMessages ? (
                          <div className="space-y-3 w-full">
                            <Skeleton variant="message-received" />
                            <Skeleton variant="message-sent" />
                          </div>
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin text-zinc-550" />
                        )}
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isMe = msg.sender._id === user._id;
                      const groupedReactions = getGroupedReactions(msg.reactions);

                      return (
                        <MessageBubble
                          key={msg._id}
                          msg={msg}
                          isMe={isMe}
                          groupedReactions={groupedReactions}
                          handleContextMenu={handleContextMenu}
                          handleReaction={handleReaction}
                          formatMessageTime={formatMessageTime}
                        />
                      );
                    })
                    }
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              <AnimatePresence>
                {partnerTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="px-4 py-1 text-[9.5px] font-black text-zinc-500 font-mono text-left tracking-wide select-none"
                  >
                    {getPartner(selectedConv).fullName} is typing...
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-4 border-t border-zinc-800/30 shrink-0 bg-zinc-950/20 backdrop-blur-md relative z-10 chat-input-area">
                {attachmentPreviews.length > 0 && (
                  <div className="flex gap-2 mb-3 bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-800 max-w-sm">
                    {attachmentPreviews.map((url, idx) => (
                      <div key={idx} className="relative h-14 w-14 rounded-lg overflow-hidden border border-zinc-800">
                        <img loading="lazy" src={url} alt="Attachment preview" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="absolute top-0.5 right-0.5 h-4 w-4 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-full flex items-center justify-center scale-90"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editingMessage ? (
                  <form onSubmit={handleEditMessageSubmit} className="flex gap-2 items-center">
                    <div className="grow relative">
                      <input
                        type="text"
                        required
                        value={editText}
                        onChange={(e) => { setEditText(e.target.value); clearFieldError("edit"); }}
                        className="w-full rounded-full border border-white/20 bg-zinc-900 px-4.5 py-3 text-xs text-white outline-none"
                      />
                      <span className="absolute right-4.5 top-3.5 text-[8.5px] font-mono text-zinc-550 uppercase">
                        Editing
                      </span>
                      <ValidationMessage message={fieldErrors.edit} />
                    </div>
                    <button
                      type="submit"
                      className="bg-white text-black text-xs font-bold px-4 py-2.5 rounded-full hover:bg-zinc-250 cursor-pointer shadow-md"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMessage(null)}
                      className="bg-zinc-800 text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-zinc-750 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-2.5 items-center">
                    <div className="relative shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={attachments.length >= 5}
                        onChange={handleFileChange}
                        title="Select images (multiple allowed)"
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer pointer-events-none"
                      >
                        <ImageIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>                    <div className="grow relative">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={inputText}
                        onChange={(e) => {
                          setInputText(e.target.value);
                          clearFieldError("message");
                          handleTyping();
                        }}
                        className="w-full rounded-full border border-zinc-800 bg-zinc-950/40 py-3 px-5 text-xs text-slate-100 placeholder-zinc-500 outline-none focus:border-white focus:bg-zinc-900/80 transition-all focus:ring-1 focus:ring-zinc-700"
                      />
                      <ValidationMessage message={fieldErrors.message} />

                      <span className="absolute right-4 top-3 text-[9px] text-zinc-650 hidden md:flex items-center gap-0.5 border border-zinc-800 px-1 rounded bg-zinc-950 select-none">
                        <CornerDownLeft className="h-2 w-2" /> Enter
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={sendingMessage || (!inputText.trim() && attachments.length === 0)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-250 cursor-pointer shadow-md disabled:opacity-30 disabled:hover:bg-white"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {contextMenu && (
        <>
          {isMobile ? (
            <>
              {/* Mobile Backdrop */}
              <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 pointer-events-auto" 
                onClick={() => setContextMenu(null)} 
              />
              {/* Mobile Bottom Sheet Menu */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 250 }}
                className="fixed bottom-0 inset-x-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden pb-8 max-w-md mx-auto pointer-events-auto"
              >
                {/* Drag Handle */}
                <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-3" />
                
                {/* Emoji reactions row */}
                <div className="flex justify-between px-6 py-2 border-b border-zinc-800/60 overflow-x-auto gap-2 scrollbar-none">
                  {["👍", "❤️", "😂", "😮", "😢", "😠"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        handleReaction(contextMenu.message, emoji);
                        setContextMenu(null);
                      }}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl hover:bg-zinc-800 active:scale-90 transition-all shrink-0 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowEmojiPicker(contextMenu.message._id);
                      setContextMenu(null);
                    }}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl hover:bg-zinc-800 active:scale-90 transition-all shrink-0 bg-zinc-800/40 border border-zinc-700/30 cursor-pointer"
                  >
                    <Smile className="h-5 w-5 text-zinc-300" />
                  </button>
                </div>

                {/* Actions list */}
                <div className="p-4 space-y-1">
                  {!contextMenu.message.isDeleted && (
                    <>
                      <button
                        onClick={() => {
                          handleCopyMessage(contextMenu.message);
                          setContextMenu(null);
                        }}
                        className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-3 cursor-pointer"
                      >
                        <Copy className="h-4 w-4 text-zinc-400" />
                        Copy Message
                      </button>
                      <button
                        onClick={() => {
                          setForwardModal({
                            message: contextMenu.message,
                            x: window.innerWidth / 2,
                            y: window.innerHeight / 2,
                          });
                          setContextMenu(null);
                        }}
                        className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-3 cursor-pointer"
                      >
                        <Share2 className="h-4 w-4 text-zinc-400" />
                        Forward Message
                      </button>
                      {contextMenu.message.sender._id === user._id && isEditable(contextMenu.message.createdAt) && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(contextMenu.message);
                              setEditText(contextMenu.message.text);
                              setContextMenu(null);
                            }}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-850 rounded-xl flex items-center gap-3 cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4 text-zinc-400" />
                            Edit Message
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteMessage(contextMenu.message._id);
                              setContextMenu(null);
                            }}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-3 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                            Delete Message
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setContextMenu(null)}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-850 rounded-xl flex items-center gap-3 border border-zinc-800/50 mt-2 cursor-pointer"
                  >
                    <X className="h-4 w-4 text-zinc-400" />
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          ) : (
            /* Desktop Context Menu with Bounded Position to prevent off-screen cuts */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: "fixed",
                left: Math.min(Math.max(20, contextMenu.x), window.innerWidth - 340),
                top: Math.min(Math.max(20, contextMenu.y - 120), window.innerHeight - 260),
                zIndex: 1000,
              }}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-800">
                {["👍", "❤️", "😂", "😮", "😢", "😠"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleReaction(contextMenu.message, emoji);
                      setContextMenu(null);
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowEmojiPicker(contextMenu.message._id);
                    setContextMenu(null);
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </div>

              <div className="p-1">
                {!contextMenu.message.isDeleted && (
                  <>
                    <button
                      onClick={() => handleCopyMessage(contextMenu.message)}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Message
                    </button>
                    <button
                      onClick={() => {
                        setForwardModal({
                          message: contextMenu.message,
                          x: contextMenu.x,
                          y: contextMenu.y,
                        });
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Forward Message
                    </button>
                    {contextMenu.message.sender._id === user._id && isEditable(contextMenu.message.createdAt) && (
                      <>
                        <button
                          onClick={() => {
                            setEditingMessage(contextMenu.message);
                            setEditText(contextMenu.message.text);
                            setContextMenu(null);
                          }}
                          className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-200 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit Message
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteMessage(contextMenu.message._id);
                            setContextMenu(null);
                          }}
                          className="w-full px-3 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Message
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  onClick={() => setContextMenu(null)}
                  className="w-full px-3 py-2.5 text-left text-xs font-bold text-zinc-400 hover:bg-zinc-800/60 rounded-xl flex items-center gap-2 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Custom Emoji Picker Modal */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => {
              setShowEmojiPicker(null);
              setCustomEmoji("");
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Add Emoji</h4>
                <button
                  onClick={() => {
                    setShowEmojiPicker(null);
                    setCustomEmoji("");
                  }}
                >
                  <X className="h-3.5 w-3.5 text-zinc-500 hover:text-white" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const msg = messages.find((m) => m._id === showEmojiPicker);
                  if (msg) handleCustomEmoji(msg);
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  placeholder="Type any emoji..."
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-white"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!customEmoji.trim()}
                  className="w-full rounded-xl bg-white text-black font-bold px-4 py-2.5 text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Add Reaction
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forward Message Modal */}
      <AnimatePresence>
        {forwardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setForwardModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Forward Message</h4>
                <button
                  onClick={() => setForwardModal(null)}
                >
                  <X className="h-3.5 w-3.5 text-zinc-500 hover:text-white" />
                </button>
              </div>

              <div className="mb-4 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
                <p className="text-xs text-zinc-300 leading-relaxed">{forwardModal.message.text}</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5">
                {conversations.length === 0 ? (
                  <p className="text-center text-[10px] text-zinc-500 font-mono uppercase py-4">No conversations yet</p>
                ) : (
                  conversations.map((conv) => {
                    const partner = getPartner(conv);
                    return (
                      <button
                        key={conv._id}
                        onClick={() => handleForwardMessage(conv._id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/60 text-left transition-colors"
                      >
                        <img loading="lazy" 
                          src={partner.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                          alt={partner.fullName}
                          className="h-8 w-8 rounded-full object-cover border border-zinc-800"
                        />
                        <div>
                          <p className="text-xs font-bold text-zinc-200">{partner.fullName}</p>
                          <p className="text-[9px] text-zinc-500 font-bold">@{partner.username}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800">
                <div className="text-[9px] font-mono text-zinc-500 uppercase mb-2">Or</div>
                <button
                  onClick={() => {
                    setForwardModal(null);
                    setSelectedConv(null);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-zinc-800/60"
                >
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-200">Start a new conversation</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
