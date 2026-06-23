import React, { useState, useEffect, useRef, Suspense, useCallback } from "react";
import LandingPage from "./components/LandingPage";
import Auth from "./components/Auth";
import ForgotPassword from "./components/ForgotPassword";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";
import {
	AlertCircle,
	X,
	UserPlus,
	Check,
	Users,
	ArrowRight,
	ArrowLeft,
	ShoppingBag,
} from "lucide-react";
import type { User, Notification, Conversation } from "./types";
import BackgroundGradients from "./components/BackgroundGradients";
import LeftSidebar from "./components/LeftSidebar";
import UserAvatar from "./components/UserAvatar";
import GlassCard from "./components/GlassCard";
import ErrorBoundary from "./components/ErrorBoundary";
import { apiFetch } from "./utils/api";
import { getNotificationText, getFloatingToastText } from "./utils/notificationText";
import { logger } from "./utils/logger";

// Lazy-loaded heavy components — only fetched when first rendered
const LiquidEther = React.lazy(() => import("./components/LiquidEther"));
const Feed = React.lazy(() => import("./components/Feed"));
const Explore = React.lazy(() => import("./components/Explore"));
const Notifications = React.lazy(() => import("./components/Notifications"));
const Profile = React.lazy(() => import("./components/Profile"));
const Settings = React.lazy(() => import("./components/Settings"));
const Chat = React.lazy(() => import("./components/Chat"));
const ImagePreviewRenderer = React.lazy(() => import("./components/ImagePreviewRenderer"));
const Dock = React.lazy(() => import("./components/Dock"));
const PostModal = React.lazy(() => import("./components/PostModal"));
const CallUI = React.lazy(() => import("./components/CallUI"));	export default function App() {
	const [user, setUser] = useState<User | null>(null);
	const [sessionChecked, setSessionChecked] = useState(false);
	const [showAuthForm] = useState(true);
	const [currentTab, setTab] = useState("home");
	const [badgeCount, setBadgeCount] = useState(0);
	const [chatBadgeCount, setChatBadgeCount] = useState(0);
	// Preload all lazy components after mount to prevent Suspense flash on navigation
	useEffect(() => {
		const preloadComponents = async () => {
			const imports = [
				import("./components/Settings"),
				import("./components/Profile"),
				import("./components/Feed"),
				import("./components/Explore"),
				import("./components/Notifications"),
				import("./components/Chat"),
			];
			await Promise.all(imports);
		};
		preloadComponents();
	}, []);

	// WebRTC peer connection refs (shared between Chat initiation and CallUI display)
	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
	const localStreamRef = useRef<MediaStream | null>(null);
	const remoteStreamRef = useRef<MediaStream | null>(null);
	const pendingCallOfferRef = useRef<{
		sdp: RTCSessionDescriptionInit;
		type: "audio" | "video";
		partnerId: string;
		partnerName: string;
	} | null>(null);

	// Memoize socket connection to prevent unnecessary reconnections
	const socketRef = useRef<ReturnType<typeof io> | null>(null);
	const socketUserIdRef = useRef<string | null>(null);
	const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [composeOpen, setComposeOpen] = useState(false);
	const [hasActiveConversation, setHasActiveConversation] = useState(false);
	const [commentsOpen, setCommentsOpen] = useState(false);
	const [settingsEditProfileOpen, setSettingsEditProfileOpen] = useState(false);
	const [isMobileDevice, setIsMobileDevice] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		const checkMobile = () => {
			setIsMobileDevice(window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches);
		};
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	useEffect(() => {
		let timer: NodeJS.Timeout;
		const handleShowToast = (e: any) => {
			const { message, type } = e.detail;
			setToastMessage(message);
			setToastType(type || "success");
			clearTimeout(timer);
			timer = setTimeout(() => {
				setToastMessage(null);
			}, 3000);
		};
		window.addEventListener("showToast", handleShowToast as EventListener);
		return () => {
			window.removeEventListener("showToast", handleShowToast as EventListener);
			clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
		document.documentElement.classList.add("dark");
		localStorage.setItem("orbit_theme", "dark");
	}, []);

	// Dynamic page title based on current tab — improves UX and browser history
	useEffect(() => {
		const tabTitles: Record<string, string> = {
			home: "Home Feed",
			explore: "Explore",
			notifications: "Notifications",
			chat: "Messages",
			profile: "Profile",
			settings: "Settings",
			saved: "Saved Posts",
			reposts: "Your Reposts",
		};
		const tabName = tabTitles[currentTab] || "Home Feed";
		document.title = user
			? `ORBIT | ${tabName} — @${user.username}`
			: currentTab === "home" ? "ORBIT | Your Inner Circle" : `ORBIT | ${tabName}`;
	}, [currentTab, user]);

	// Calculate total unread chat messages
	useEffect(() => {
		if (!user) {
			setChatBadgeCount(0);
			return;
		}
		const total = conversations.reduce((sum, conv) => {
			return sum + (conv.unreadCounts?.[user._id] || 0);
		}, 0);
		setChatBadgeCount(total);
	}, [conversations, user]);

	// Deep Link States
	const [selectedUserUsername, setSelectedUserUsername] = useState("");
	const [singlePostSlug, setSinglePostSlug] = useState<string | null>(null);
	const [autoOpenComments, setAutoOpenComments] = useState(false);

	// Security Form View Controller
	const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

	// Signup-first mode (from Get Started / Enter Social Hub)
	const [showSignupForm, setShowSignupForm] = useState(false);

	// Public read-only feed mode (from Explore Public Feed)
	const [publicFeedMode, setPublicFeedMode] = useState(false);

	// In-app floating macOS alert banner lists
	const [floatingAlerts, setFloatingAlerts] = useState<
		(Notification & { id: string })[]
	>([]);

	// Suggestion parameters
	const [suggestions, setSuggestions] = useState<User[]>([]);
	const [followingStates, setFollowingStates] = useState<
		Record<string, boolean>
	>({});
	const [loadingSuggestions, setLoadingSuggestions] = useState(false);

	// Call State (WebRTC audio/video calls)
	const [callState, setCallState] = useState<{
		type: "audio" | "video";
		status: "outgoing" | "incoming" | "active";
		partnerId: string;
		partnerName: string;
		partnerAvatar?: string;
		callerId?: string;
		calleeId?: string;
	} | null>(null);

	// ICE connection state for monitoring network handoffs (WiFi → cellular, etc.)
	const [iceConnectionState, setIceConnectionState] = useState<
		RTCIceConnectionState | "new"
	>("new");

	// Ref to track call partner ID for ICE restart signaling
	const callPartnerIdRef = useRef<string | null>(null);
	// Timer ref for delayed ICE restart on temporary disconnects
	const iceRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Global Toast Notification State
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [toastType, setToastType] = useState<"success" | "error">("success");

	// Navigation history tracker
	const [tabHistory, setTabHistory] = useState<string[]>([]);

	const navigateToTab = useCallback((newTab: string) => {
		setTab((prev) => {
			if (prev !== newTab) {
				setTabHistory((h) => [...h, prev]);
			}
			return newTab;
		});
	}, []);

	// Callback for Profile to sync followingStates from server data
	const handleProfileLoaded = (profileId: string, followingByMe: boolean) => {
		setFollowingStates((prev) => ({
			...prev,
			[profileId]: followingByMe,
		}));
	};

	// Auto session checker on mount
	const fetchConversations = async () => {
		try {
			const res = await apiFetch("/api/chats/conversations");
			const data = await res.json();
			if (res.ok && data.success) {
				setConversations(data.conversations || []);
			}
		} catch (err) {
			logger.error("Failed to load conversations", err);
		}
	};

	const checkSession = async () => {
		try {
			const res = await apiFetch("/api/auth/me");
			const data = await res.json();
			if (res.ok && data.success) {
				setUser(data.user);
				if (data.token) {
					localStorage.setItem("orbit_jwt_token", data.token);
				}
				const token = data.token || localStorage.getItem("orbit_jwt_token") || "";
				connectSockets(data.user._id, token);
				fetchBadgeCounts(); // fetch initial badge counts
				fetchConversations();
				fetchFollowing(data.user._id);
			}
		} catch (e) {
			logger.warn("Session check failed", e);
		} finally {
		}
	};

	// Fetch user's following list
	const fetchFollowing = async (userId: string) => {
		try {
			const res = await apiFetch(
				`/api/follows/${userId}/following?limit=100`,
			);
			const data = await res.json();
			if (res.ok && data.success) {
				const states: Record<string, boolean> = {};
				(data.following || []).forEach(
					(f: { following?: { _id: string }; _id?: string }) => {
						const followedUser = f.following || f;
						if (followedUser._id) states[followedUser._id] = true;
					},
				);
				setFollowingStates(states);
			}
		} catch (err) {
			logger.warn("Failed retrieving following list", err);
		}
	};

	const fetchSuggestions = async () => {
		setLoadingSuggestions(true);
		try {
			const res = await apiFetch("/api/users/suggestions");
			const data = await res.json();
			if (res.ok && data.success) {
				setSuggestions(data.users || []);
				// Update following states if any are already followed
				const states: Record<string, boolean> = {};
				(data.users || []).forEach((u: User) => {
					states[u._id] = false;
				});
				setFollowingStates((prev) => ({
					...states,
					...prev,
				}));
			}
		} catch (err) {
			logger.warn("Failed retrieving suggestions vectors", err);
		} finally {
			setLoadingSuggestions(false);
		}
	};

	// Toggle follow
	const onToggleFollow = async (userId: string) => {
		const isCurrentlyFollowing = !!followingStates[userId];

		// 1. Optimistic Update: Toggle state immediately
		setFollowingStates((prev) => ({
			...prev,
			[userId]: !isCurrentlyFollowing,
		}));
		setUser((prev) =>
			prev
				? {
					...prev,
					followingCount: !isCurrentlyFollowing
						? (prev.followingCount || 0) + 1
						: Math.max(0, (prev.followingCount || 0) - 1),
				}
				: null
		);

		try {
			const res = await apiFetch(`/api/follows/${userId}`, {
				method: "POST",
			});
			const data = await res.json();
			if (res.ok && data.success) {
				// 2. Synchronize with backend response
				setFollowingStates((prev) => ({
					...prev,
					[userId]: data.following,
				}));
				setUser((prev) =>
					prev
						? {
							...prev,
							followingCount: data.following
								? (prev.followingCount || 0) + 1
								: Math.max(0, (prev.followingCount || 0) - 1),
						}
						: null
				);
			} else {
				throw new Error(data.message || "Failed to update follow status");
			}
		} catch (err: any) {
			logger.error("Failed to toggle follow", err);

			// 3. Rollback on failure
			setFollowingStates((prev) => ({
				...prev,
				[userId]: isCurrentlyFollowing,
			}));
			setUser((prev) =>
				prev
					? {
						...prev,
						followingCount: isCurrentlyFollowing
							? (prev.followingCount || 0) + 1
							: Math.max(0, (prev.followingCount || 0) - 1),
					}
					: null
			);

			// 4. Dispatch showToast event
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: {
						message: err.message || "Follow request failed. Please try again.",
						type: "error",
					},
				})
			);
			throw err;
		}
	};

	// Get unread notification count from dedicated endpoint (cached server-side)
	const fetchBadgeCounts = async () => {
		try {
			const res = await apiFetch("/api/notifications/unread-count");
			const data = await res.json();
			if (res.ok && data.success) {
				setBadgeCount(data.unreadCount);
			}
		} catch (e) {
			logger.error(e);
		}
	};

	// Track previous user value to detect actual login/logout (not incremental followingCount changes)
	const prevUserRef = useRef(user);

	useEffect(() => {
		checkSession().finally(() => setSessionChecked(true));
		return () => {
			if (socketRef.current?.connected) {
				socketRef.current.disconnect();
				socketRef.current = null;
				setSocket(null);
			}
		};
	}, []);

	useEffect(() => {
		const prevUser = prevUserRef.current;
		// Update ref AFTER comparison so it holds the previous value during next render
		prevUserRef.current = user;
		
		// Only fetch on actual login/logout transitions, not incremental followingCount changes
		if (prevUser && !user) {
			// User logged out
			setSuggestions([]);
		} else if (user && !prevUser) {
			// User logged in — fetch suggestions
			fetchSuggestions();
		}
	}, [user]);

	// Set up socket connections
	const connectSockets = (userId: string, token: string = localStorage.getItem("orbit_jwt_token") || "") => {
		// Prevent multiple socket connections for the SAME user
		if (socketRef.current?.connected && socketUserIdRef.current === userId) {
			logger.info("Socket already connected for this user, skipping reconnection");
			return;
		}

		// Disconnect existing socket if any
		if (socketRef.current) {
			socketRef.current.disconnect();
			socketRef.current = null;
			setSocket(null);
		}

		socketUserIdRef.current = userId;

		// In production, connect directly to the backend server
		// In dev, connect to empty string (which Vite proxies)
		const socketUrl = import.meta.env.PROD
			? (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "")
			: "";

		// Skip socket connection if no socket URL configured (e.g. frontend-only Vercel deploy)
		if (!socketUrl) {
			logger.warn("[ORBIT SOCKET] No VITE_SOCKET_URL or VITE_API_URL configured — skipping connection. Real-time features disabled.");
			return;
		}

		logger.info("[ORBIT SOCKET] Connecting to:", { socketUrl });

		const socket = io(socketUrl, {
			auth: token ? { token } : undefined,
			transports: ["polling", "websocket"],
			withCredentials: true,
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 30000,
		});

		socketRef.current = socket;
		setSocket(socket);			socket.on("connect", () => {
			logger.info("[ORBIT SOCKET] Connected successfully", { socketId: socket.id, userId });

			// If we were in a call with a broken ICE connection, re-attempt ICE restart now
			// that the signaling channel is restored (network handoff recovery).
			// Read state directly from refs/PC to avoid stale closure captures.
			const currentPc = peerConnectionRef.current;
			const currentPartnerId = callPartnerIdRef.current;
			const pcIceState = currentPc?.iceConnectionState;
			if (
				currentPc &&
				currentPartnerId &&
				(pcIceState === "disconnected" || pcIceState === "failed")
			) {
				logger.info("Socket reconnected during call with broken ICE — initiating ICE restart");
				if (iceRestartTimeoutRef.current) {
					clearTimeout(iceRestartTimeoutRef.current);
					iceRestartTimeoutRef.current = null;
				}
				initiateIceRestart(currentPc, currentPartnerId);
			}

			// Mobile: when user returns to tab after phone was locked / app was backgrounded,
			// the WebSocket may have been killed. Visibility change forces proactive reconnect.
			const handleVisibility = () => {
				if (document.visibilityState === "visible" && socketRef.current && !socketRef.current.connected) {
					logger.info("[ORBIT SOCKET] Tab became visible — reconnecting socket");
					socketRef.current.connect();
				}
			};
			document.addEventListener("visibilitychange", handleVisibility);

			// Clean up the listener when socket disconnects
			socket.once("disconnect", () => {
				document.removeEventListener("visibilitychange", handleVisibility);
			});
		});

		socket.on("disconnect", (reason) => {
			logger.warn("[ORBIT SOCKET] Disconnected:", { reason, userId });
		});

		socket.on("reconnect_attempt", (attempt) => {
			logger.warn("[ORBIT SOCKET] Reconnection attempt #" + attempt, { userId });
		});

		socket.on("connect_error", (error) => {
			logger.error("[ORBIT SOCKET] Connection error:", error.message);
		});

		// ── Realtime message updates when Chat.tsx is not mounted ──
		// Keeps conversations list sorted with latest message even when user is on another tab
		socket.on("message:new", (message: any) => {
			logger.info("Received message:new in App.tsx", { messageId: message._id, conversationId: message.conversation });
			setConversations((prev) => {
				const existing = prev.find((c) => c._id === message.conversation);
				if (!existing) return prev;
				const isMeRecipient = message.recipient === userId;
				return prev.map((c) => {
					if (c._id === message.conversation) {
						const updatedUnread = isMeRecipient
							? (c.unreadCounts?.[userId] || 0) + 1
							: (c.unreadCounts?.[userId] || 0);
						return {
							...c,
							lastMessage: message,
							unreadCounts: {
								...c.unreadCounts,
								[userId]: updatedUnread
							}
						};
					}
					return c;
				}).sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());
			});
		});

		// Helper to show native OS notification
		const showNativeNotif = (title: string, body: string) => {
			if (!("Notification" in window)) return;
			if (Notification.permission === "granted") {
				new Notification(title, { body, icon: "/vite.svg" });
			}
		};

		// ── Realtime user presence status changes ──
		socket.on("user:presence", ({ userId: presenceUserId, status }: { userId: string; status: "online" | "offline" }) => {
			logger.info("[ORBIT DIAG] user:presence received", { presenceUserId, status, uid });
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

		// ── Realtime chat notifications & badge increments ──
		socket.on("chat:notification", (payload: { conversationId: string; message: any; unreadCount: number; conversation?: any }) => {
			logger.info("Received chat:notification event", payload);
			setConversations((prev) => {
				const existing = prev.find((c) => c._id === payload.conversationId);
				// If the conversation doesn't exist yet, add it from the payload data
				if (!existing && payload.conversation) {
					const newConv = {
						...payload.conversation,
						presence: "offline" as const,
						unreadCounts: { [userId]: payload.unreadCount },
						lastMessage: payload.message,
					};
					return [newConv, ...prev].sort((a, b) => 
						new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - 
						new Date(a.lastMessage?.createdAt || a.updatedAt).getTime()
					);
				}
				const updated = prev.map((c) => {
					if (c._id === payload.conversationId) {
						return {
							...c,
							lastMessage: payload.message,
							unreadCounts: {
								...c.unreadCounts,
								[userId]: payload.unreadCount
							}
						};
					}
					return c;
				});
				return updated.sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() - new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());
			});
		});

		// Listen for WebSocket events from server
		socket.on("notification", (payload: Notification) => {
			logger.info("Received notification event", payload);
			// 1. Increment inbox badge counter instantly
			setBadgeCount((prev) => prev + 1);

			// 2. Spawn a beautiful macOS-style push block inside the viewport
			const newAlert = {
				id: Date.now() + Math.random().toString(),
				...payload,
			};
			setFloatingAlerts((prev) => [newAlert, ...prev]);

			// 3. Show native OS notification
			showNativeNotif(payload.sender?.fullName || "Someone", getNotificationText(payload.type));

			// Automatic dismiss after 5 seconds
			setTimeout(() => {
				setFloatingAlerts((prev) =>
					prev.filter((a) => a.id !== newAlert.id),
				);
			}, 5000);

			// 4. Refresh unread count from server to ensure accuracy
			fetchBadgeCounts();
		});

		// ── Realtime post interaction sync (likes, saves, reposts) ──
		// Dispatch with source="socket" and the absolute count from server so listeners can use exact values
		// Use the `userId` parameter (stable in closure) instead of `user` state (stale at setup time)
		const uid = userId;
		const dispatchSocketInteraction = (postId: string, type: string, value: boolean, count?: number) => {
			logger.info("Dispatching socket interaction", { postId, type, value, count });
			window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId, type, value, count, source: "socket" } }));
		};

		socket.on("post:like", (data: { postId: string; userId: string; likesCount: number }) => {
			logger.info("Received post:like event", data);
			if (data.userId === uid) return; // own action, already handled via optimistic + local dispatch
			dispatchSocketInteraction(data.postId, "like", true, data.likesCount);
		});
		socket.on("post:unlike", (data: { postId: string; userId: string; likesCount: number }) => {
			logger.info("Received post:unlike event", data);
			if (data.userId === uid) return;
			dispatchSocketInteraction(data.postId, "like", false, data.likesCount);
		});

		socket.on("post:save", (data: { postId: string; userId: string; savesCount: number }) => {
			logger.info("Received post:save event", data);
			if (data.userId === uid) return;
			dispatchSocketInteraction(data.postId, "save", true, data.savesCount);
		});
		socket.on("post:unsave", (data: { postId: string; userId: string; savesCount: number }) => {
			logger.info("Received post:unsave event", data);
			if (data.userId === uid) return;
			dispatchSocketInteraction(data.postId, "save", false, data.savesCount);
		});

		socket.on("post:repost", (data: { postId: string; userId: string; repostsCount: number }) => {
			logger.info("Received post:repost event", data);
			if (data.userId === uid) return;
			dispatchSocketInteraction(data.postId, "repost", true, data.repostsCount);
		});
		socket.on("post:unrepost", (data: { postId: string; userId: string; repostsCount: number }) => {
			logger.info("Received post:unrepost event", data);
			if (data.userId === uid) return;
			dispatchSocketInteraction(data.postId, "repost", false, data.repostsCount);
		});

		// ── Realtime share count sync (use absolute count from server) ──
		socket.on("post:share", (data: { postId: string; sharesCount: number }) => {
			logger.info("Received post:share event", data);
			window.dispatchEvent(new CustomEvent("postInteractionChanged", { detail: { postId: data.postId, type: "share", value: true, count: data.sharesCount, source: "socket" } }));
		});

		// ── Realtime follow/unfollow sync ──
		socket.on("user:follow", (data: { targetUserId: string; followerId: string; followersCount: number }) => {
			logger.info("Received user:follow event", data);
			if (data.followerId === uid) {
				setFollowingStates((prev) => ({ ...prev, [data.targetUserId]: true }));
			}
			window.dispatchEvent(new CustomEvent("userFollowersCountChanged", { detail: data }));
		});
		socket.on("user:unfollow", (data: { targetUserId: string; followerId: string; followersCount: number }) => {
			logger.info("Received user:unfollow event", data);
			if (data.followerId === uid) {
				setFollowingStates((prev) => ({ ...prev, [data.targetUserId]: false }));
			}
			window.dispatchEvent(new CustomEvent("userFollowersCountChanged", { detail: data }));
		});

		// ── Realtime new posts in feed (prepend to home feed) ──
		// Skip own posts since they're already in the local state from createPost response
		socket.on("post:created", (post: any) => {
			logger.info("[ORBIT DIAG] post:created received", { postId: post._id, authorId: post.author?._id, uid });
			if (post.author?._id === uid) return;
			window.dispatchEvent(new CustomEvent("newPostCreated", { detail: { post } }));
		});

		// ── Realtime comment count sync & comment addition ──
		// Skip own comments (already incremented locally via the comment drawer)
		socket.on("post:comment", (data: { postId: string; comment: any; userId: string; commentsCount: number }) => {
			logger.info("Received post:comment event", data);
			if (data.userId === uid) return;
			window.dispatchEvent(new CustomEvent("postCommentAdded", { detail: { postId: data.postId, commentsCount: data.commentsCount, comment: data.comment } }));
		});

		// ── Realtime post deletion ──
		// Remove the post from all views when it's deleted by its author
		socket.on("post:deleted", (postId: string) => {
			logger.info("Received post:deleted event", postId);
			window.dispatchEvent(new CustomEvent("postDeleted", { detail: { postId } }));
		});

		// ── Realtime post edits ──
		// Update post content/title in all views when author edits it
		socket.on("post:updated", (post: any) => {
			logger.info("Received post:updated event", post);
			window.dispatchEvent(new CustomEvent("postUpdated", { detail: { post } }));
		});

		// ── Realtime comment reply sync ──
		// When someone replies to a comment, the post's commentsCount goes up too
		socket.on("comment:reply", (data: { postId: string; commentId: string; reply: any; userId: string; commentsCount: number; repliesCount: number }) => {
			logger.info("Received comment:reply event", data);
			if (data.userId === uid) return; // own reply, already handled locally
			window.dispatchEvent(new CustomEvent("postCommentAdded", { detail: { postId: data.postId, commentsCount: data.commentsCount, comment: data.reply, parentCommentId: data.commentId } }));
		});

		// ── Realtime comment edit sync ──
		socket.on("comment:updated", (comment: any) => {
			logger.info("Received comment:updated event", comment);
			window.dispatchEvent(new CustomEvent("commentUpdated", { detail: { comment } }));
		});

		// ── Realtime comment deletion sync ──
		// When a comment is deleted, update the post's commentsCount
		socket.on("comment:deleted", (data: { postId: string; commentId: string; commentsCount: number }) => {
			logger.info("Received comment:deleted event", data);
			window.dispatchEvent(new CustomEvent("postCommentDeleted", { detail: { postId: data.postId, commentsCount: data.commentsCount } }));
			window.dispatchEvent(new CustomEvent("commentDeleted", { detail: { commentId: data.commentId } }));
		});

		// ── Realtime comment emoji reactions ──
		socket.on("comment:reaction", (data: { commentId: string; reaction: any; type: "add" | "remove" }) => {
			logger.info("Received comment:reaction event", data);
			window.dispatchEvent(new CustomEvent("commentReactionChanged", { detail: data }));
		});

		// ── Realtime comment like/unlike sync ──
		socket.on("comment:like", (data: { commentId: string; userId: string; likesCount: number }) => {
			logger.info("Received comment:like event", data);
			if (data.userId === uid) return;
			window.dispatchEvent(new CustomEvent("postCommentLikeChanged", { detail: { commentId: data.commentId, likesCount: data.likesCount } }));
		});
		socket.on("comment:unlike", (data: { commentId: string; userId: string; likesCount: number }) => {
			logger.info("Received comment:unlike event", data);
			if (data.userId === uid) return;
			window.dispatchEvent(new CustomEvent("postCommentLikeChanged", { detail: { commentId: data.commentId, likesCount: data.likesCount } }));
		});

		// ── Realtime post view sync ──
		socket.on("post:view", (data: { postId: string; viewsCount: number }) => {
			logger.info("Received post:view event", data);
			window.dispatchEvent(new CustomEvent("postViewUpdated", { detail: { postId: data.postId, viewsCount: data.viewsCount } }));
		});

		// ── Realtime user profile view sync ──
		socket.on("user:view", (data: { userId: string; viewsCount: number }) => {
			logger.info("Received user:view event", data);
			window.dispatchEvent(new CustomEvent("userViewUpdated", { detail: { userId: data.userId, viewsCount: data.viewsCount } }));
		});

		// ── Realtime post pin sync ──
		socket.on("post:pin", (data: { postId: string; userId: string }) => {
			logger.info("Received post:pin event", data);
			window.dispatchEvent(new CustomEvent("postPinned", { detail: { postId: data.postId, userId: data.userId } }));
		});

		socket.on("post:unpin", (data: { postId: string; userId: string }) => {
			logger.info("Received post:unpin event", data);
			window.dispatchEvent(new CustomEvent("postUnpinned", { detail: { postId: data.postId, userId: data.userId } }));
		});

		// ── WebRTC Call Signaling ────────────────────────────────────────
		socket.on("call:offer", (data: { callerId: string; sdp: any; type: "audio" | "video" }) => {
			logger.info("Received call:offer", data);
			// Store the offer SDP for when the user accepts the call
			if (data.sdp) {
				pendingCallOfferRef.current = {
					sdp: data.sdp,
					type: data.type,
					partnerId: data.callerId,
					partnerName: "Calling...",
				};
			}
			setCallState({
				type: data.type,
				status: "incoming",
				partnerId: data.callerId,
				partnerName: "Calling...",
			});
		});

		socket.on("call:answer", async (data: { calleeId: string; sdp: any }) => {
			logger.info("Received call:answer", data);
			const pc = peerConnectionRef.current;
			if (pc && data.sdp) {
				try {
					await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				} catch (err) {
					logger.error("Failed to set remote description from answer", err);
				}
			}
			setCallState((prev) => prev ? { ...prev, status: "active" } : prev);
		});

		socket.on("call:ice-candidate", async (data: { senderId: string; candidate: any }) => {
			logger.info("Received call:ice-candidate", data);
			const pc = peerConnectionRef.current;
			if (pc && data.candidate) {
				try {
					await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
				} catch (err) {
					logger.error("Failed to add ICE candidate", err);
				}
			}
		});

		// Handle ICE restart offer from the remote peer (network handoff recovery)
		socket.on("call:ice-restart", async (data: { senderId: string; sdp: any }) => {
			logger.info("Received call:ice-restart", data);
			const pc = peerConnectionRef.current;
			if (!pc || !data.sdp) return;
			try {
				await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				socket.emit("call:answer", {
					targetUserId: data.senderId,
					sdp: pc.localDescription,
				});
				logger.info("ICE restart: sent answer back");
			} catch (err) {
				logger.error("ICE restart: failed to handle remote offer", err);
			}
		});			socket.on("call:end", (data: { endedBy: string }) => {
			logger.info("Received call:end", data);
			// Clean up bitrate monitor first (stops polling before PC is closed)
			cleanupBitrateMonitor(peerConnectionRef.current);
			// Clean up peer connection and local stream
			if (peerConnectionRef.current) {
				peerConnectionRef.current.close();
				peerConnectionRef.current = null;
			}
			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach((t) => t.stop());
				localStreamRef.current = null;
			}
			pendingCallOfferRef.current = null;
			callPartnerIdRef.current = null;
			if (iceRestartTimeoutRef.current) {
				clearTimeout(iceRestartTimeoutRef.current);
				iceRestartTimeoutRef.current = null;
			}
			setIceConnectionState("closed");
			setCallState(null);
		});

		socket.on("call:missed", (data: { callerId: string }) => {
			logger.info("Received call:missed", data);
			pendingCallOfferRef.current = null;
			setCallState(null);
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Missed call", type: "success" },
				})
			);
		});
	};

	const handleAuthSuccess = useCallback((authUser: User, token?: string) => {
		setUser(authUser);
		if (token) {
			localStorage.setItem("orbit_jwt_token", token);
		}
		const finalToken = token || localStorage.getItem("orbit_jwt_token") || "";
		connectSockets(authUser._id, finalToken);
		fetchBadgeCounts();
		fetchFollowing(authUser._id);
		setTab("home");

		// Request permission for native OS notifications
		if ("Notification" in window && Notification.permission === "default") {
			Notification.requestPermission();
		}
	}, []);

	// ─── OPUS Bitrate SDP Helper (Cross-Browser) ──────────────────────────
	// Overrides OPUS codec parameters in the SDP to request 64kbps mono voice.
	// Instead of hardcoding payload type 111 (Chrome), this looks up the OPUS
	// payload type number from the rtpmap line so it works on all browsers.
	const setOpusBitrate = (sdp: string): string => {
		// Find OPUS payload type from rtpmap (e.g. "a=rtpmap:111 opus/48000/2")
		const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
		if (!opusMatch) return sdp; // No OPUS codec — return unmodified
		const pt = opusMatch[1];
		// Replace the fmtp line for that specific payload type
		const regex = new RegExp(`a=fmtp:${pt} .*`, 'g');
		return sdp.replace(regex, `a=fmtp:${pt} maxaveragebitrate=64000;useinbandfec=1`);
	};

	// ─── Video Codec & SVC Helpers ────────────────────────────────────
	// Prioritises VP9 (which supports SVC for network adaptation) over H.264.
	// Falls back gracefully if the browser/hardware doesn't support VP9.
	const getPreferredVideoCodec = (): { mimeType: string } | null => {
		const caps = RTCRtpSender.getCapabilities('video');
		if (!caps) return null;
		// VP9 is preferred for its SVC (scalable video coding) support
		const vp9 = caps.codecs.find(c => c.mimeType === 'video/VP9');
		if (vp9) return vp9;
		// Fall back to VP8 (universal support)
		return caps.codecs.find(c => c.mimeType === 'video/VP8') || null;
	};

	// Reusable cleanup helper for bitrate monitor stored on peer connections.
	// Called before closing a PC to prevent the getStats polling interval from leaking.
	const cleanupBitrateMonitor = (pc: RTCPeerConnection | null) => {
		if (!pc) return;
		try {
			const cleanup = (pc as any).__bitrateMonitorCleanup;
			if (typeof cleanup === 'function') {
				cleanup();
			}
			delete (pc as any).__bitrateMonitorCleanup;
		} catch { /* best-effort cleanup */ }
	};

	// Attempts to configure VP9 SVC (scalabilityMode L3T3) on the video sender.
	// L3T3 = 3 temporal layers — allows the browser to drop frame rate
	// gracefully when network bandwidth drops, avoiding complete freeze.
	// Falls back silently on browsers/codecs that don't support it.
	const tryConfigureVideoSvc = async (pc: RTCPeerConnection) => {
		const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
		if (!videoSender) return;

		try {
			const params = videoSender.getParameters();
			if (!params.encodings || params.encodings.length === 0) {
				params.encodings = [{}];
			}
			// Set temporal scalability — the browser will auto-adjust frame rate
			// based on network congestion without needing manual bitrate tuning.
			(params.encodings[0] as any).scalabilityMode = 'L3T3';
			await videoSender.setParameters(params);
			logger.info('[SVC] VP9 L3T3 scalability configured');
		} catch (err) {
			// SVC not supported — this is expected on older browsers or
			// when the codec isn't VP9. The call will work with default settings.
			logger.info('[SVC] Not supported, using browser defaults');
		}
	};

	// Monitors video sender stats and adjusts maxBitrate based on the
	// available bandwidth reported by WebRTC's internal congestion control.
	// This provides an additional layer of adaptation beyond SVC temporal layers.
	const startBitrateMonitor = (pc: RTCPeerConnection, type: 'audio' | 'video'): (() => void) => {
		if (type !== 'video') return () => {};

		let lastMaxBitrate = 0;

		const timer = setInterval(async () => {
			try {
				const stats = await pc.getStats();
				let availableBitrate = 0;

				stats.forEach(report => {
					// Use the remote candidate-pair's available outgoing bitrate
					if (report.type === 'candidate-pair' && report.state === 'succeeded') {
						availableBitrate = report.availableOutgoingBitrate || 0;
					}
					// Also check for "bandwidth-estimation" type if available
					if (report.type === 'bandwidth-estimation' && report.availableBitrate) {
						availableBitrate = report.availableBitrate;
					}
				});

				if (availableBitrate > 0) {
					const sender = pc.getSenders().find(s => s.track?.kind === 'video');
					if (!sender) return;

					const params = sender.getParameters();
					if (!params.encodings || params.encodings.length === 0) return;

					// Set maxBitrate to 90% of estimated bandwidth (leaving headroom for audio/retransmits)
					const newMax = Math.floor(availableBitrate * 0.9);
					// Only update if changed by more than 10% to avoid churn
					if (Math.abs(newMax - lastMaxBitrate) > lastMaxBitrate * 0.1) {
						params.encodings[0].maxBitrate = newMax;
						await sender.setParameters(params);
						logger.info(`[Bitrate] Adjusted to ${Math.round(newMax / 1000)} kbps (available: ${Math.round(availableBitrate / 1000)} kbps)`);
						lastMaxBitrate = newMax;
					}
				}
			} catch {
				// Stats polling is best-effort
			}
		}, 3000);

		return () => {
			clearInterval(timer);
			lastMaxBitrate = 0;
		};
	};

	// ─── WebRTC Call Initiation ────────────────────────────────────────
	const ICE_SERVERS: RTCIceServer[] = [
		{ urls: "stun:stun.l.google.com:19302" },
		{ urls: "stun:stun1.l.google.com:19302" },
		{ urls: "stun:stun2.l.google.com:19302" },
		{ urls: "stun:stun3.l.google.com:19302" },
		{ urls: "stun:stun4.l.google.com:19302" },
		// Free TURN server for NAT traversal on mobile/cellular networks
		{
			urls: "turn:openrelay.metered.ca:80",
			username: "openrelayproject",
			credential: "openrelayproject",
		},
		{
			urls: "turn:openrelay.metered.ca:443",
			username: "openrelayproject",
			credential: "openrelayproject",
		},
	];

	const handleStartCall = useCallback(async (partnerId: string, partnerName: string, type: "audio" | "video") => {
		const sock = socketRef.current;
		if (!sock) return;

		// Clean up any previous call
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close();
		}
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach((t) => t.stop());
		}

		setCallState({ type, status: "outgoing", partnerId, partnerName });			try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					// ⚠️ Intentionally omitting sampleRate/channelCount.
					// Letting the browser use its native audio format prevents
					// AEC pipeline conflicts (resampling/downmixing) that cause echo.
				},
				video: type === "video",
			});
			localStreamRef.current = stream;

			const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
			peerConnectionRef.current = pc;

			// Add audio track (via addTrack — simple, no encodings needed)
			stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

			// Add video track via addTransceiver for SVC encoding configuration
			const videoTracks = stream.getVideoTracks();
			if (type === 'video' && videoTracks.length > 0) {
				const videoCodec = getPreferredVideoCodec();
				const videoTransceiver = pc.addTransceiver(videoTracks[0], {
					streams: [stream],
					direction: 'sendrecv',
					sendEncodings: [
						{
							rid: 'q',
							active: true,
							maxBitrate: 2_500_000, // 2.5 Mbps ceiling — plenty for HD
						},
					],
				});
				// Prefer VP9 (supports SVC) when available
				if (videoCodec) {
					try {
						(videoTransceiver as any).setCodecPreferences([videoCodec]);
					} catch { /* codec preference not supported */ }
				}
				// Also add any remaining video tracks (e.g. from secondary cameras)
				for (let i = 1; i < videoTracks.length; i++) {
					pc.addTrack(videoTracks[i], stream);
				}
			}

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					sock.emit("call:ice-candidate", {
						targetUserId: partnerId,
						candidate: e.candidate,
					});
				}
			};

			pc.ontrack = (e) => {
				logger.info("Call: received remote track", { kind: e.track.kind });
				// Store the remote stream immediately in the ref so CallUI can wire it
				// even if the component hasn't mounted its ontrack handler yet.
				const stream = e.streams[0];
				if (stream) {
					remoteStreamRef.current = stream;
				} else if (!remoteStreamRef.current) {
					remoteStreamRef.current = new MediaStream([e.track]);
				} else {
					remoteStreamRef.current.addTrack(e.track);
				}
			};

			// ── ICE connection state monitoring ───────────────────────
			callPartnerIdRef.current = partnerId;
			pc.oniceconnectionstatechange = () => {
				const state = pc.iceConnectionState;
				logger.info("ICE connection state changed", { state, partnerId });
				setIceConnectionState(state);

				// Trigger ICE restart on network handoff events (WiFi ↔ cellular)
				if (state === "disconnected") {
					// Give the connection a few seconds to recover naturally
					if (iceRestartTimeoutRef.current) clearTimeout(iceRestartTimeoutRef.current);
					iceRestartTimeoutRef.current = setTimeout(() => {
						initiateIceRestart(pc, partnerId);
					}, 3000);
				} else if (state === "failed") {
					// Immediate restart on failure
					if (iceRestartTimeoutRef.current) clearTimeout(iceRestartTimeoutRef.current);
					initiateIceRestart(pc, partnerId);
				} else if (state === "connected" || state === "completed") {
					// Clear any pending restart timer if connection recovered
					if (iceRestartTimeoutRef.current) {
						clearTimeout(iceRestartTimeoutRef.current);
						iceRestartTimeoutRef.current = null;
					}
				}
			};

			const offer = await pc.createOffer({
				offerToReceiveAudio: true,
				offerToReceiveVideo: type === "video",
			});
			offer.sdp = setOpusBitrate(offer.sdp || "");
			await pc.setLocalDescription(offer);

			// Configure VP9 SVC for adaptive video quality
			if (type === 'video') {
				tryConfigureVideoSvc(pc).catch(() => {});
			}

			sock.emit("call:offer", {
				targetUserId: partnerId,
				sdp: pc.localDescription,
				type,
			});

			// Start bandwidth-aware bitrate monitor for video calls
			// This polls getStats() every 3s and adjusts the video encoder's
			// max bitrate based on the available bandwidth reported by WebRTC's
			// internal congestion control (Google Congestion Control / GCC).
			// Cleans up automatically when the peer connection is closed.
			if (type === 'video') {
				const stopMonitor = startBitrateMonitor(pc, type);
				// Store the cleanup function on the pc for later disposal
				(pc as any).__bitrateMonitorCleanup = stopMonitor;
			}
		} catch (err) {
			logger.error("Failed to start call", err);
			setCallState(null);
			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach((t) => t.stop());
				localStreamRef.current = null;
			}
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: { message: "Failed to start call. Please check camera/microphone permissions.", type: "error" },
				})
			);
		}
	}, []);

	// ─── ICE Restart Helper ────────────────────────────────────────
	// Creates a new offer with iceRestart flag to re-establish the peer connection
	// after a network handoff (e.g., WiFi → cellular on mobile).
	const initiateIceRestart = useCallback(async (pc: RTCPeerConnection, partnerId: string) => {
		const sock = socketRef.current;
		if (!sock || !pc) return;
		logger.info("ICE restart: initiating", { partnerId });
		try {
			const offer = await pc.createOffer({
				iceRestart: true,
				offerToReceiveAudio: true,
				offerToReceiveVideo: callState?.type === "video",
			});
			await pc.setLocalDescription(offer);
			sock.emit("call:ice-restart", {
				targetUserId: partnerId,
				sdp: pc.localDescription,
			});
			logger.info("ICE restart: offer sent");
		} catch (err) {
			logger.error("ICE restart: failed", err);
		}
	}, [callState?.type]);

	const handleLogout = useCallback(async () => {
		try {
			await apiFetch("/api/auth/logout", { method: "POST" });
			setUser(null);
			setTab("home");
			setBadgeCount(0);
			setChatBadgeCount(0);
			setConversations([]);
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
			setSocket(null);
			socketUserIdRef.current = null;
			localStorage.removeItem("orbit_jwt_token");
		} catch (e) {
			logger.error(e);
		}
	}, []);

	// Mark all badge counts as read
	const handleBadgeReset = useCallback(() => {
		setBadgeCount(0);
	}, []);

	// Helper selectors
	const handleUserSelection = useCallback((username: string) => {
		setSelectedUserUsername(username);
		navigateToTab("profile");
	}, [navigateToTab]);

	// Intercept compose tab → open PostModal instead
	const handleTabChange = useCallback((tab: string) => {
		if (tab === "compose") {
			setComposeOpen(true);
			return;
		}
		if (tab === "profile") {
			setSelectedUserUsername(user?.username || "");
		}
		if (tab === "home") {
			setSinglePostSlug(null);
		}
		// Reset notification badge when navigating to notifications tab
		if (tab === "notifications") {
			setBadgeCount(0);
		}
		// Clear chat badge when navigating to chat tab — clear unread counts so badge stays clear
		if (tab === "chat") {
			setChatBadgeCount(0);
			setConversations((prev) =>
				prev.map((c) => ({
					...c,
					unreadCounts: {
						...c.unreadCounts,
						[user?._id || ""]: 0,
					},
				}))
			);
		}
		navigateToTab(tab);
	}, [user?.username, navigateToTab]);

	const handlePostSelectionBySlug = useCallback((slug: string, openComments?: boolean) => {
		setSinglePostSlug(slug);
		setAutoOpenComments(!!openComments);
		navigateToTab("home");
	}, [navigateToTab]);

	const handleFollowSuggestion = useCallback(async (userId: string) => {
		// Optimistic update
		const currentState = followingStates[userId];
		setFollowingStates((prev) => ({
			...prev,
			[userId]: !currentState,
		}));

		try {
			const res = await apiFetch(`/api/follows/${userId}`, {
				method: "POST",
			});
			const data = await res.json();
			if (res.ok && data.success) {
				// If following is true, remove user from suggestions
				if (data.following) {
					setSuggestions((prev) =>
						prev.filter((u) => u._id !== userId),
					);
				}
			} else {
				throw new Error(data.message || "Failed to follow suggestion");
			}
		} catch (e: any) {
			logger.error("Follow recommendation toggling difficulty", e);
			// Revert on error
			setFollowingStates((prev) => ({
				...prev,
				[userId]: currentState,
			}));
			// Show Toast
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: {
						message: e.message || "Follow suggestion failed. Please try again.",
						type: "error",
					},
				})
			);
		}
	}, [followingStates]);

	const canGoBack = tabHistory.length > 0 || !!singlePostSlug || !!selectedUserUsername;

	const handleGoBack = useCallback(() => {
		if (singlePostSlug) {
			setSinglePostSlug(null);
			setAutoOpenComments(false);
			return;
		}
		if (selectedUserUsername && selectedUserUsername !== user?.username) {
			setSelectedUserUsername("");
			return;
		}
		if (tabHistory.length > 0) {
			setTabHistory((prev) => {
				const nextHistory = [...prev];
				const lastTab = nextHistory.pop()!;
				setTab(lastTab);
				if (lastTab === "home") {
					setSinglePostSlug(null);
					setAutoOpenComments(false);
					setSelectedUserUsername("");
				}
				return nextHistory;
			});
		}
	}, [tabHistory, singlePostSlug, selectedUserUsername, user?.username]);

	const scrollToAuthSection = useCallback(() => {
		document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	const scrollToSignupSection = useCallback(() => {
		setShowSignupForm(true);
		requestAnimationFrame(scrollToAuthSection);
	}, []);

	return (
		<ErrorBoundary>
			<div className="relative min-h-screen text-slate-800 dark:text-zinc-100 selection:bg-zinc-800/10 dark:selection:bg-white/10 antialiased font-ui flex flex-col justify-start bg-transparent transition-colors duration-500 overflow-x-hidden">
				{/* Background Liquid Glob Dynamic Mesh Grid */}
				<BackgroundGradients />

				{/* Global Fullscreen Image Viewer Modal (lazy) */}
				<Suspense fallback={null}>
					<ImagePreviewRenderer />
				</Suspense>

				{/* Global Compose / Create Post Modal (lazy) */}
				<Suspense fallback={null}>
					<PostModal
						isOpen={composeOpen}
						onClose={() => setComposeOpen(false)}
						onPostCreated={() => {
							setComposeOpen(false);
							setTab("home");
							setSinglePostSlug(null);
							window.dispatchEvent(new Event("forceFeedRefresh"));
						}}
					/>
				</Suspense>

				<AnimatePresence mode="wait">
					{sessionChecked && !user && !publicFeedMode ? (
						<motion.div
								key="logged-out-section"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.5 }}
								className="w-full flex flex-col justify-start overflow-y-auto scroll-smooth">
								{/* Heavily Animated Landing Page with 3D components */}															<LandingPage
																onScrollToAuth={scrollToAuthSection}
																onScrollToSignup={scrollToSignupSection}
																onExplorePublicFeed={() => {
																	setPublicFeedMode(true);
																}}
															/>

								{/* Auth form area — only shown after user clicks "Get Started" or "Enter Social Hub" */}
								{showAuthForm && (
								<div
									id="auth-section"
									className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-20 relative z-10 bg-transparent overflow-hidden">
									<div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0 opacity-40 mix-blend-screen">
										{!isMobileDevice && (
											<Suspense fallback={null}>
												<LiquidEther
													colors={["#ffffff", "#a1a1aa", "#3f3f46"]}
													mouseForce={20}
													cursorSize={110}
													isViscous={false}
													viscous={30}
													iterationsViscous={32}
													iterationsPoisson={32}
													resolution={0.5}
													isBounce={false}
													autoDemo={true}
													autoSpeed={0.55}
													autoIntensity={2.2}
													takeoverDuration={0.25}
													autoResumeDelay={2500}
													autoRampDuration={0.6}
												/>
											</Suspense>
										)}
									</div>
									{/* Center Auth Card with super clean backplate */}
									<div className="w-full max-w-4xl my-6 relative z-10 shrink-0">
										<AnimatePresence mode="wait">
											{forgotPasswordOpen ? (
												<motion.div
													key="forgot"
													initial={{
														opacity: 0,
														scale: 0.96,
														y: 30,
													}}
													animate={{
														opacity: 1,
														scale: 1,
														y: 0,
													}}
													exit={{
														opacity: 0,
														scale: 0.96,
														y: -30,
													}}
													transition={{ duration: 0.25 }}>
													<ForgotPassword
														onBackToLogin={() =>
															setForgotPasswordOpen(false)
														}
														onSuccess={() => { }}
													/>
												</motion.div>
											) : (
												<motion.div
													key="auth"
													initial={{
														opacity: 0,
														scale: 0.96,
														y: 30,
													}}
													animate={{
														opacity: 1,
														scale: 1,
														y: 0,
													}}
													exit={{
														opacity: 0,
														scale: 0.96,
														y: -30,
													}}
													transition={{ duration: 0.25 }}>													<Auth
														initialShowSignup={showSignupForm}
															onAuthSuccess={
																handleAuthSuccess
															}
															onForgotPasswordClick={() =>
																setForgotPasswordOpen(true)
															}
														/>
												</motion.div>
											)}
										</AnimatePresence>
							</div>
						</div>
						)}
						</motion.div>
					) : (
						<motion.div
							key="logged-in-section"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
							className="w-full h-screen overflow-hidden flex flex-col justify-between relative">
							{/* Floating macOS notification stack (Top Right) */}
							<div className="fixed top-6 right-6 z-50 flex flex-col gap-3.5 max-w-sm w-full pointer-events-none">
								<AnimatePresence>
									{floatingAlerts.map((alert) => (
										<motion.div
											key={alert.id}
											initial={{
												opacity: 0,
												y: -20,
												scale: 0.95,
											}}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{
												opacity: 0,
												y: -10,
												scale: 0.95,
											}}
											className="pointer-events-auto flex items-start gap-3.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] min-w-80 relative overflow-hidden">
											{/* Reflected glow sweep inside alert box */}
											<div className="absolute inset-0 bg-linear-to-tr from-zinc-500/5 via-zinc-800/2 to-transparent -z-10" />

										<UserAvatar
											src={alert.sender?.profilePic?.url}
											alt=""
											className="h-10 w-10 rounded-full object-cover border border-zinc-800 shrink-0 cursor-pointer shadow-sm"
											onClick={() => {
												if (alert.sender?.username) {
													handleUserSelection(
														alert.sender.username,
													);
												}
											}}
										/>

											<div className="space-y-1">
												<span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
													⚡ INSTANT NOTIFICATION
												</span><p className="text-xs text-zinc-200 leading-snug">
													<span className="font-bold text-white">
														{alert.sender?.fullName}
													</span>{" "}
													{getFloatingToastText(alert.type)}
												</p>

												{alert.post && (
													<p className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-450 leading-none truncate max-w-50">
														"{alert.post?.title}"
													</p>
												)}
											</div>

											<button
												onClick={() =>
													setFloatingAlerts((prev) =>
														prev.filter(
															(a) =>
																a.id !== alert.id,
														),
													)
												}
												className="absolute top-2.5 right-2.5 h-6 w-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200">
												<X className="h-3 w-3" />
											</button>
										</motion.div>
									))}
								</AnimatePresence>
							</div>

							{/* Main Content Area Routing with Global Full Widescreen Grid */}
							{publicFeedMode && !user && (
								<div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
									<div>
										<h2 className="text-sm font-bold text-white">Explore Public Feed</h2>
										<p className="text-[10px] text-zinc-400 mt-0.5">Browsing posts — sign in to interact</p>
									</div>
									<div className="flex items-center gap-3">
										<button
											onClick={() => { setPublicFeedMode(false); setShowSignupForm(false); scrollToAuthSection(); }}
											className="rounded-full bg-white/10 hover:bg-white/20 border border-zinc-700/50 px-4 py-1.5 text-[10px] font-bold text-zinc-200 transition-all cursor-pointer"
										>
											Sign In
										</button>
										<button
											onClick={() => { setPublicFeedMode(false); setShowSignupForm(true); scrollToSignupSection(); }}
											className="rounded-full bg-white text-black hover:bg-zinc-200 px-4 py-1.5 text-[10px] font-bold transition-all cursor-pointer"
										>
											Create Account
										</button>
									</div>
								</div>
							)}
							<main className="grow h-[calc(100vh-7rem)] overflow-hidden flex items-start justify-center py-6 w-full">
								{(user || publicFeedMode) && (
									<div className="w-full h-full max-w-7xl px-4 sm:px-6 lg:px-8 mx-auto overflow-hidden">
										<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start w-full h-full">
											{user && (
												<div className="hidden lg:block lg:col-span-3 h-full overflow-hidden shrink-0 pb-12">
													<LeftSidebar
													user={user}
													currentTab={currentTab}
													setTab={(tab) => {
														if (tab === "home") {
															setSinglePostSlug(null);
														}
														if (tab === "compose") {
															setComposeOpen(true);
															return;
														}
														setTab(tab);
													}}
													setSelectedUserUsername={
														setSelectedUserUsername
													}
													badgeCount={badgeCount}
													chatBadgeCount={chatBadgeCount}
												/>
											</div>
											)}
											{/* Middle Main Content Pane: Tab content scales fluidly */}							<div
				className={`${currentTab === "chat"
										? "lg:col-span-9 overflow-hidden"
										: !user
											? "lg:col-span-9 xl:col-span-9 overflow-y-auto"
											: "lg:col-span-6 xl:col-span-6 overflow-y-auto"
									} w-full h-full ${currentTab === "chat" ? "pb-0" : "pb-28 sm:pb-28 xl:pb-0"}`}>
									{canGoBack && currentTab === "chat" && hasActiveConversation && (
										<motion.button
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -10 }}
											onClick={handleGoBack}
											className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
											title="Go back"
										>
											<ArrowLeft className="h-3.5 w-3.5" />
										</motion.button>
									)}
									{commentsOpen && (
										<motion.button
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -10 }}
											onClick={() => window.dispatchEvent(new CustomEvent("closeComments"))}
											className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
											title="Close comments"
										>
											<ArrowLeft className="h-3.5 w-3.5" />
										</motion.button>
									)}
									{currentTab === "settings" && (
										<motion.button
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: -10 }}
											onClick={() => {
												if (tabHistory.length > 0) {
													handleGoBack();
												} else {
													setTab("home");
												}
											}}
											className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
											title="Back to previous page"
										>
											<ArrowLeft className="h-3.5 w-3.5" />
										</motion.button>
									)}
												<ErrorBoundary>
													<Suspense fallback={<div className="h-32 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950/20" />}>
														<AnimatePresence mode="wait">
															{currentTab === "home" && (
																<motion.div
																	key="home"
																	className="relative min-h-[calc(100vh-2rem)]"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<div className="relative z-10 w-full h-full">
												<Feed
													user={user}
													readOnly={publicFeedMode && !user}
													onUserSelected={
														handleUserSelection
													}
													singlePostSlug={
														singlePostSlug
													}
													autoOpenComments={
														autoOpenComments
													}
													onClearAutoOpenComments={() => {
														setAutoOpenComments(
															false,
														);
													}}
													onClearSinglePost={() => {
														setSinglePostSlug(
															null,
														);
														setAutoOpenComments(
															false,
														);
													}}
													followingStates={
														followingStates
													}
													onCommentsOpenChange={setCommentsOpen}
												/>
																	</div>
																</motion.div>
															)}

															{currentTab === "explore" && (
																<motion.div
																	key="explore"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<Explore
																		onUserSelected={
																			handleUserSelection
																		}
																		onPostSelected={
																			handlePostSelectionBySlug
																		}
																		user={user}
																		followingStates={
																			followingStates
																		}
																		onToggleFollow={
																			onToggleFollow
																		}
																	/>
																</motion.div>
															)}

															{currentTab ===
																"notifications" && (
																	<motion.div
																		key="notifications"
																		initial={false}
																		animate={{ opacity: 1 }}
																		exit={{ opacity: 0, y: -15 }}
																		transition={{ duration: 0.15 }}>
																		<Notifications
																			user={user}
																			socket={socket}
																			onPostClick={
																				handlePostSelectionBySlug
																			}
																			onUserClick={
																				handleUserSelection
																			}
																			onBadgeReset={
																				handleBadgeReset
																			}
																		/>
																	</motion.div>
																)}

															{currentTab === "saved" && (
																<motion.div
																	key="saved"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<Feed
																		user={user}
																		onUserSelected={
																			handleUserSelection
																		}
																		searchQuery=""
																		onClearSinglePost={() => { }}
																		singlePostSlug={
																			null
																		}
																		showSavesOnly={true}
																		followingStates={
																			followingStates
																		}
																		onCommentsOpenChange={setCommentsOpen}
																	/>
																</motion.div>
															)}

															{currentTab === "reposts" && (
																<motion.div
																	key="reposts"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<Feed
																		user={user}
																		onUserSelected={
																			handleUserSelection
																		}
																		searchQuery=""
																		onClearSinglePost={() => { }}
																		singlePostSlug={
																			null
																		}
																		showRepostsOnly={
																			true
																		}
																		followingStates={
																			followingStates
																		}
																		onCommentsOpenChange={setCommentsOpen}
																	/>
																</motion.div>
															)}

															{user && currentTab === "profile" && (
																<motion.div
																	key="profile"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<Profile
																		user={user}
																		targetUsername={
																			selectedUserUsername ||
																			user.username
																		}
																		onUserUpdate={(u) =>
																			setUser(u)
																		}
																		onPostClick={
																			handlePostSelectionBySlug
																		}
																		onUserClick={
																			handleUserSelection
																		}
																		followingStates={
																			followingStates
																		}
																		onToggleFollow={
																			onToggleFollow
																		}
																		onProfileLoaded={
																			handleProfileLoaded
																		}
																		onBack={canGoBack ? handleGoBack : undefined}
																	/>
																</motion.div>
															)}

															{user && currentTab === "settings" && (
																<motion.div
																	key="settings"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: -15 }}
														transition={{ duration: 0.35, ease: "easeOut" }}>
																	<Settings
																		user={user}
																		onUserUpdate={(u) =>
																			setUser(u)
																		}
																		onLogout={
																			handleLogout
																		}																		onEditProfileOpenChange={setSettingsEditProfileOpen}
																	/>
																</motion.div>
															)}

									{user && currentTab === "chat" && (
										<motion.div
											key="chat"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -15 }}
								transition={{ duration: 0.35, ease: "easeOut" }}
							className="h-full">
																	<Chat
																		user={user}
																		socket={
																			socket
																		}
																		conversations={
																			conversations
																		}
																		setConversations={
																			setConversations
																		}
																		onUserSelected={
																			handleUserSelection
																		}
																	onBack={() =>
																		setTab("home")
																	}
																	onChatConversationChange={setHasActiveConversation}
																	onStartCall={handleStartCall}
																/>
																</motion.div>
															)}                        </AnimatePresence>											</Suspense>										</ErrorBoundary>
										</div>{" "}
											{/* Right Sidebar: Dual Liquid Glass Containers for Suggestions & Features */}
											{user && currentTab !== "chat" && (
												<div className="lg:col-span-3 w-full space-y-5 hidden lg:flex flex-col h-full overflow-hidden select-none shrink-0 pb-24">
													{/* 1. People Recommendations Box with macOS spring animations */}
													<GlassCard
														animate={true}
														className="p-6">
														<h3 className="text-[10px] font-black tracking-widest text-zinc-400 dark:text-zinc-550 uppercase mb-4 pr-0.5">
															RECOMMENDED USERS
														</h3>

														{loadingSuggestions ? (
															<div className="space-y-4 py-2">
																{[1, 2, 3].map(
																	(n) => (
																		<div
																			key={n}
																			className="flex items-center gap-3 animate-pulse">
																			<div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800/60" />
																			<div className="flex-1 space-y-1.5">
																				<div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800/60 rounded" />
																				<div className="h-2 w-1/3 bg-zinc-200 dark:bg-zinc-800/60 rounded" />
																			</div>
																		</div>
																	),
																)}
															</div>
														) : suggestions.length ===
															0 ? (
															<p className="text-[10px] text-zinc-400 dark:text-zinc-550 pl-0.5 py-4 leading-relaxed font-mono uppercase">
																No new
																recommendations at
																this time
															</p>
														) : (
															<div className="space-y-4">
																{suggestions.map(
																	(sugUser) => (
																		<div
																			key={
																				sugUser._id
																			}
																			className="flex items-center justify-between gap-3 group/item">
																			<div
																				onClick={() =>
																					handleUserSelection(
																						sugUser.username,
																					)
																				}
																				className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"><UserAvatar
																					src={sugUser.profilePic?.url}
																					alt=""
																					className="h-9 w-9 rounded-full object-cover border border-zinc-800/60 shadow-sm shrink-0"
																				/>
																				<div className="flex flex-col text-left">
																					<span className="text-xs font-extrabold text-black dark:text-white line-clamp-1 hover:underline">
																						{
																							sugUser.fullName
																						}
																					</span>
																					<span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550">
																						@
																						{
																							sugUser.username
																						}
																					</span>
																				</div>
																			</div>

																			<motion.button
																				whileHover={{
																					scale: 1.1,
																				}}
																				whileTap={{
																					scale: 0.9,
																				}}
																				onClick={() =>
																					handleFollowSuggestion(
																						sugUser._id,
																					)
																				}
																				className={`rounded-full h-9 w-9 flex items-center justify-center transition-all cursor-pointer ${followingStates[
																					sugUser
																						._id
																				]
																					? "bg-zinc-900 text-zinc-400 border border-zinc-800"
																					: "bg-zinc-900 text-white dark:bg-white dark:text-black hover:bg-zinc-850 dark:hover:bg-zinc-100"
																					}`}
																				title={
																					followingStates[
																						sugUser
																							._id
																					]
																						? "Unfollow"
																						: "Follow"
																				}>
																				{followingStates[
																					sugUser
																						._id
																				] ? (
																					<Check className="h-4 w-4" />
																				) : (
																					<UserPlus className="h-4 w-4" />
																				)}
																			</motion.button>
																		</div>
																	),
																)}
															</div>
														)}
														{suggestions.length > 0 && (
															<button
																onClick={() =>
																	setTab(
																		"explore",
																	)
																}
																className="w-full mt-4 py-2 text-xs font-bold text-black dark:text-zinc-200 hover:underline transition-all cursor-pointer flex items-center justify-center gap-1">
																Explore More{" "}
																<ArrowRight className="h-3 w-3" />
															</button>
														)}
													</GlassCard>

													{/* 2. Upcoming Features Preview Card */}
													<GlassCard
														animate={true}
														className="p-6">
														<h3 className="text-sm font-semibold text-zinc-400 dark:text-zinc-550 mb-4">
															Coming Soon
														</h3>

														<div className="space-y-4 text-left">
															{/* Communities */}
															<div className="p-3.5 rounded-xl border border-zinc-150/70 dark:border-zinc-800/50 bg-zinc-50/40 dark:bg-zinc-900/10 hover:bg-zinc-50/90 dark:hover:bg-zinc-900/30 transition-all duration-300">
																<div className="flex items-center gap-2.5 mb-1.5">
																	<div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-350 shrink-0">
																		<Users className="h-3.5 w-3.5" />
																	</div>
																	<span className="text-xs font-semibold text-black dark:text-white">
																		Communities
																	</span>
																</div>
																<p className="text-xs text-zinc-450 dark:text-zinc-400 leading-relaxed pl-1">
																	Join and create
																	communities
																	around shared
																	interests and
																	topics.
																</p>
															</div>

															{/* Marketplace */}
															<div className="p-3.5 rounded-xl border border-zinc-150/70 dark:border-zinc-800/50 bg-zinc-50/40 dark:bg-zinc-900/10 hover:bg-zinc-50/90 dark:hover:bg-zinc-900/30 transition-all duration-300">
																<div className="flex items-center gap-2.5 mb-1.5">
																	<div className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-350 shrink-0">
																		<ShoppingBag className="h-3.5 w-3.5" />
																	</div>
																	<span className="text-xs font-semibold text-black dark:text-white">
																		Marketplace
																	</span>
																</div>
																<p className="text-xs text-zinc-450 dark:text-zinc-400 leading-relaxed pl-1">
																	Securely buy,
																	sell, and
																	exchange digital
																	assets within
																	the platform.
																</p>
															</div>
														</div>
													</GlassCard>
												</div>
											)}
										</div>
									</div>
								)}
							</main>

			{/* Center Apple Dock — hidden when chat or comments are open */}
							{user && (
								<Suspense fallback={null}>								{!(currentTab === "chat" && hasActiveConversation) && !commentsOpen && !settingsEditProfileOpen && (
										<Dock
											currentTab={currentTab}
											setTab={handleTabChange}
											user={user}
											badgeCount={badgeCount}
											chatBadgeCount={chatBadgeCount}
										/>
									)}
							</Suspense>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{/* Global Toast Notification */}
				<AnimatePresence>
					{toastMessage && (
						<motion.div
							initial={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
							animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
							exit={{ opacity: 0, y: -20, scale: 0.9, x: "-50%" }}
							role="status" aria-live="polite"
							className="fixed top-8 left-1/2 z-50 flex items-center gap-2 bg-zinc-950/90 border border-white/10 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md text-xs text-white"
						>
							{toastType === "success" ? (
								<Check className="h-4 w-4 text-emerald-400" />
							) : (
								<AlertCircle className="h-4 w-4 text-rose-400" />
							)}
							<span>{toastMessage}</span>
						</motion.div>
					)}
				</AnimatePresence>

			{/* Call UI Overlay (outside main layout flow) */}
			{callState && socket && (
				<Suspense fallback={null}>
					<CallUI
						socket={socket}
						user={{
							_id: user?._id || "",
							fullName: user?.fullName || "",
							profilePic: user?.profilePic,
						}}
						callState={{
							type: callState.type,
							status: callState.status,
							partnerId: callState.partnerId,
							partnerName: callState.partnerName,
							partnerAvatar: callState.partnerAvatar,
						}}
						onEndCall={() => {
							socket.emit("call:end", { targetUserId: callState.partnerId });
							// Stop bitrate monitor before closing PC
							cleanupBitrateMonitor(peerConnectionRef.current);
							if (peerConnectionRef.current) {
								peerConnectionRef.current.close();
								peerConnectionRef.current = null;
							}
							if (localStreamRef.current) {
								localStreamRef.current.getTracks().forEach((t) => t.stop());
								localStreamRef.current = null;
							}
							pendingCallOfferRef.current = null;
							setCallState(null);
						}}
						onAcceptCall={async () => {
							try {
								// Clean up any existing PC/stream
								if (peerConnectionRef.current) {
									peerConnectionRef.current.close();
								}
								if (localStreamRef.current) {
									localStreamRef.current.getTracks().forEach((t) => t.stop());
								}							const stream = await navigator.mediaDevices.getUserMedia({
								audio: {
									echoCancellation: true,
									noiseSuppression: true,
									autoGainControl: true,
								},
								video: callState.type === "video",
							});
							localStreamRef.current = stream;

				const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
								peerConnectionRef.current = pc;

				// Add audio track
				stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

				// Add video track via addTransceiver for SVC (same as caller setup)
				const videoTracks = stream.getVideoTracks();
				if (callState.type === 'video' && videoTracks.length > 0) {
					const videoCodec = getPreferredVideoCodec();
					const videoTransceiver = pc.addTransceiver(videoTracks[0], {
						streams: [stream],
						direction: 'sendrecv',
						sendEncodings: [
							{
								rid: 'q',
								active: true,
								maxBitrate: 2_500_000,
							},
						],
					});
					if (videoCodec) {
						try {
							(videoTransceiver as any).setCodecPreferences([videoCodec]);
						} catch { /* codec preference not supported */ }
					}
					for (let i = 1; i < videoTracks.length; i++) {
						pc.addTrack(videoTracks[i], stream);
					}
				}

								pc.onicecandidate = (e) => {
									if (e.candidate) {
										socket.emit("call:ice-candidate", {
											targetUserId: callState.partnerId,
											candidate: e.candidate,
										});
									}
								};

				pc.ontrack = (e) => {
					logger.info("Call: received remote track (callee)", { kind: e.track.kind });
					// Store the remote stream immediately in the ref so CallUI can wire it
					const stream = e.streams[0];
					if (stream) {
						remoteStreamRef.current = stream;
					} else if (!remoteStreamRef.current) {
						remoteStreamRef.current = new MediaStream([e.track]);
					} else {
						remoteStreamRef.current.addTrack(e.track);
					}
				};

								// ── ICE connection state monitoring (callee) ─────
								callPartnerIdRef.current = callState.partnerId;
								pc.oniceconnectionstatechange = () => {
									const state = pc.iceConnectionState;
									logger.info("ICE connection state changed (callee)", { state, partnerId: callState.partnerId });
									setIceConnectionState(state);

									if (state === "disconnected") {
										if (iceRestartTimeoutRef.current) clearTimeout(iceRestartTimeoutRef.current);
										iceRestartTimeoutRef.current = setTimeout(() => {
											const currentPc = peerConnectionRef.current;
											if (currentPc && callPartnerIdRef.current) {
												initiateIceRestart(currentPc, callPartnerIdRef.current);
											}
										}, 3000);
									} else if (state === "failed") {
										if (iceRestartTimeoutRef.current) clearTimeout(iceRestartTimeoutRef.current);
										setTimeout(() => {
											const currentPc = peerConnectionRef.current;
											if (currentPc && callPartnerIdRef.current) {
												initiateIceRestart(currentPc, callPartnerIdRef.current);
											}
										}, 0);
									} else if (state === "connected" || state === "completed") {
										if (iceRestartTimeoutRef.current) {
											clearTimeout(iceRestartTimeoutRef.current);
											iceRestartTimeoutRef.current = null;
										}
									}
								};

								const offer = pendingCallOfferRef.current;
								if (offer?.sdp) {
									await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
									const answer = await pc.createAnswer();
									answer.sdp = setOpusBitrate(answer.sdp || "");
									await pc.setLocalDescription(answer);

									// Configure VP9 SVC for adaptive video quality (callee side)
									if (callState.type === 'video') {
										tryConfigureVideoSvc(pc).catch(() => {});
									}

									socket.emit("call:answer", {
										targetUserId: callState.partnerId,
										sdp: pc.localDescription,
									});
								}

								// Start bandwidth-aware bitrate monitor (callee side)
								if (callState.type === 'video') {
									const stopMonitor = startBitrateMonitor(pc, callState.type);
									(pc as any).__bitrateMonitorCleanup = stopMonitor;
								}

								pendingCallOfferRef.current = null;
								setCallState((prev) => prev ? { ...prev, status: "active" } : prev);
							} catch (err) {
								logger.error("Failed to accept call", err);
								if (localStreamRef.current) {
									localStreamRef.current.getTracks().forEach((t) => t.stop());
									localStreamRef.current = null;
								}
								pendingCallOfferRef.current = null;
								setCallState(null);
								window.dispatchEvent(
									new CustomEvent("showToast", {
										detail: { message: "Failed to accept call.", type: "error" },
									})
								);
							}
						}}										onRejectCall={() => {
							socket.emit("call:end", { targetUserId: callState.partnerId });
							pendingCallOfferRef.current = null;
							setCallState(null);
						}}
						localStreamRef={localStreamRef}
						peerConnectionRef={peerConnectionRef}
						remoteStreamRef={remoteStreamRef}
						iceConnectionState={iceConnectionState}
					/>
				</Suspense>
			)}
			</div>
		</ErrorBoundary>
	);
}
