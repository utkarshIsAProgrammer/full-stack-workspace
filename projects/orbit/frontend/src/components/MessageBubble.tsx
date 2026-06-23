import React, { useRef, useState } from "react";
import { Check, CheckCheck, Loader2, CornerDownLeft, Play, Pause } from "lucide-react";
import UserAvatar from "./UserAvatar";
import type { Message } from "../types";

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  userId: string;
  groupedReactions: Record<string, { count: number; hasReacted: boolean }>;
  handleContextMenu: (e: React.MouseEvent | { clientX: number; clientY: number; preventDefault: () => void }, message: Message) => void;
  handleReaction: (message: Message, emoji: string) => void;
  formatMessageTime: (isoString: string) => string;
  onSwipeToReply?: (message: Message) => void;
}

function arePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.msg._id !== next.msg._id) return false;
  if (prev.msg.text !== next.msg.text) return false;
  if (prev.msg.isDeleted !== next.msg.isDeleted) return false;
  if (prev.msg.seen !== next.msg.seen) return false;
  if (prev.msg.isEdited !== next.msg.isEdited) return false;
  if (prev.isMe !== next.isMe) return false;

  // Compare replyTo
  if (prev.msg.replyTo?._id !== next.msg.replyTo?._id) return false;
  if (prev.msg.replyTo?.text !== next.msg.replyTo?.text) return false;

  // Compare reactions deeply
  const prevReactions = prev.msg.reactions || [];
  const nextReactions = next.msg.reactions || [];
  if (prevReactions.length !== nextReactions.length) return false;
  for (let i = 0; i < prevReactions.length; i++) {
    const pr = prevReactions[i];
    const nr = nextReactions[i];
    if (pr.emoji !== nr.emoji) return false;
    const pSender = typeof pr.sender === "string" ? pr.sender : pr.sender?._id;
    const nSender = typeof nr.sender === "string" ? nr.sender : nr.sender?._id;
    if (pSender !== nSender) return false;
  }

  // Compare grouped reactions
  const prevKeys = Object.keys(prev.groupedReactions);
  const nextKeys = Object.keys(next.groupedReactions);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (!next.groupedReactions[key]) return false;
    if (prev.groupedReactions[key].count !== next.groupedReactions[key].count) return false;
    if (prev.groupedReactions[key].hasReacted !== next.groupedReactions[key].hasReacted) return false;
  }

  // Compare attachments
  const prevAttachments = prev.msg.attachments || [];
  const nextAttachments = next.msg.attachments || [];
  if (prevAttachments.length !== nextAttachments.length) return false;

  return true;
}

const MessageBubble = React.memo(function MessageBubble({
  msg,
  isMe,
  userId,
  groupedReactions,
  handleContextMenu,
  handleReaction,
  formatMessageTime,
  onSwipeToReply,
}: MessageBubbleProps) {
  // Swipe-to-reply state — ref-based for 60fps
  const [showSwipeBadge, setShowSwipeBadge] = useState(false);
  const swipeBarRef = useRef<HTMLDivElement>(null);
  const swipeOffsetRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Long-press timer
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isSwipingRef.current = false;
    swipeOffsetRef.current = 0;
    setShowSwipeBadge(false);
    if (swipeBarRef.current) {
      swipeBarRef.current.style.transition = '';
      swipeBarRef.current.style.transform = isMe ? 'translateX(6px)' : 'translateX(-6px)';
      swipeBarRef.current.style.opacity = '0';
    }

    touchTimerRef.current = setTimeout(() => {
      // Long press context menu (only if not swiping)
      if (!isSwipingRef.current && touch) {
        const msgEl = document.getElementById(`msg-${msg._id}`);
        const msgRect = msgEl?.getBoundingClientRect();
        const x = msgRect ? (isMe ? msgRect.right : msgRect.left) : touch.clientX;
        const y = msgRect ? msgRect.bottom + 4 : touch.clientY;
        handleContextMenu(
          { clientX: x, clientY: y, preventDefault: () => {} } as any,
          msg
        );
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Only start swipe if horizontal movement exceeds vertical by enough margin
    if (!isSwipingRef.current && Math.abs(deltaX) > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      isSwipingRef.current = true;
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }

    if (isSwipingRef.current) {
      const maxOffset = 100;
      const offset = isMe
        ? Math.min(Math.max(0, -deltaX), maxOffset)
        : Math.min(Math.max(0, deltaX), maxOffset);
      swipeOffsetRef.current = offset;

      // Direct CSS transform for 60fps
      if (swipeBarRef.current) {
        const barX = isMe ? -offset + (offset > 0 ? 6 : 0) : offset - 6;
        swipeBarRef.current.style.transition = 'none';
        swipeBarRef.current.style.transform = `translateX(${barX}px)`;
        swipeBarRef.current.style.opacity = offset > 0 ? '1' : '0';
      }

      if (offset > 20 && !showSwipeBadge) {
        setShowSwipeBadge(true);
      } else if (offset <= 20 && showSwipeBadge) {
        setShowSwipeBadge(false);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    if (isSwipingRef.current && swipeOffsetRef.current > 60 && onSwipeToReply) {
      onSwipeToReply(msg);
    }

    swipeOffsetRef.current = 0;
    setShowSwipeBadge(false);
    if (swipeBarRef.current) {
      swipeBarRef.current.style.transform = isMe ? 'translateX(6px)' : 'translateX(-6px)';
      swipeBarRef.current.style.opacity = '0';
    }
    isSwipingRef.current = false;
    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
  };

  // Check if message was deleted for current user
  const deletedForMe = msg.deletedFor?.includes(userId);

  return (
    <div
      id={`msg-${msg._id}`}
      className={`relative overflow-hidden flex gap-3 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
      onContextMenu={(e) => handleContextMenu(e, msg)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Swipe-to-reply visual indicator — CSS transform for 60fps */}
      <div
        ref={swipeBarRef}
        className={`absolute inset-y-0 w-1.5 bg-indigo-500/50 pointer-events-none ${isMe ? "right-0 rounded-l-full rounded-r-none" : "left-0 rounded-r-full"}`}
        style={{ transform: isMe ? 'translateX(6px)' : 'translateX(-6px)', opacity: 0, transition: 'transform 200ms ease-out, opacity 200ms ease-out' }}
      />
      {/* Reply icon that slides in on swipe */}
      {showSwipeBadge && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-10 pointer-events-none ${isMe ? "right-3" : "left-3"}`}
        >
          <div className="flex items-center gap-1.5 bg-indigo-500/20 backdrop-blur-sm rounded-full px-2.5 py-1 border border-indigo-400/30">
            <CornerDownLeft className="h-3 w-3 text-indigo-300" />
            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Reply</span>
          </div>
        </div>
      )}
      {!isMe && (
        <div className="w-8 shrink-0 flex items-end">
          <UserAvatar
            src={msg.sender.profilePic?.url}
            alt={msg.sender.fullName}
            className="h-7 w-7 rounded-full object-cover border border-zinc-800"
          />
        </div>
      )}

      <div className="space-y-1 text-left flex flex-col items-end">
        <div
          className={`rounded-2xl px-3 py-1.5 text-[11px] border relative group/bubble select-text ${
            isMe
              ? "bg-indigo-950/70 text-white border-indigo-800/40 rounded-tr-none"
              : "bg-zinc-900/80 text-zinc-100 border-zinc-800 rounded-tl-none"
          }`}
        >
          {msg.isDeleted || deletedForMe ? (
            <span className="italic text-zinc-500 text-[10px]">This message was deleted</span>
          ) : (
            <>
              {msg.replyTo && (
                <div
                  className="flex items-start gap-2 mb-2 pb-2 border-l-2 border-blue-500/40 pl-2.5 cursor-pointer hover:bg-zinc-800/30 rounded-r-lg -ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Scroll to the replied message if it's in view
                    const el = document.getElementById(`msg-${msg.replyTo?._id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("ring-1", "ring-blue-500/30", "rounded-2xl");
                      setTimeout(() => el.classList.remove("ring-1", "ring-blue-500/30", "rounded-2xl"), 2000);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider leading-tight">
                      {msg.replyTo.sender.fullName}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate leading-relaxed mt-0.5">
                      {msg.replyTo.text || (msg.replyTo.attachments && msg.replyTo.attachments.length > 0 ? "📎 Attachment" : "")}
                    </p>
                  </div>
                  <CornerDownLeft className="h-3 w-3 text-zinc-500 shrink-0 mt-1" />
                </div>
              )}
              <p className="leading-relaxed whitespace-pre-wrap select-text break-word pr-1.5">{msg.text}</p>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-1.5 max-w-sm rounded-xl overflow-hidden border border-zinc-800">
                  {msg.attachments.map((att, aIdx) => {
                    return att.type === "voice_note" ? (
                      <VoiceNotePlayer key={aIdx} url={att.url} isMe={isMe} initialDuration={att.duration} />
                    ) : (
                      <img loading="lazy"
                        key={aIdx}
                        src={att.url}
                        alt={`Attachment from ${msg.sender.fullName}`}
                        className="w-full h-auto max-h-60 object-cover cursor-pointer hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("openImagePreview", { detail: att.url }));
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && !msg.isDeleted && !deletedForMe && (
          <div className="flex gap-1 mt-0.5">
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(msg, emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border ${
                  data.hasReacted
                    ? "bg-indigo-500/20 border-indigo-400/30"
                    : "bg-zinc-800/50 border-zinc-700/50"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[10px]">{data.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 px-1.5 text-[8px] font-bold text-zinc-550 select-none">
          {msg.isEdited && !msg.isDeleted && !deletedForMe && !msg.attachments?.some(a => a.type === "voice_note") && <span>edited</span>}
          <span>{formatMessageTime(msg.createdAt)}</span>
          {isMe && (
            <span title={(msg as any)._pending ? 'Sending...' : msg.seen ? 'Seen' : 'Sent'}>
              {(msg as any)._pending ? (
                <Loader2 className="h-3 w-3 text-zinc-550 animate-spin" />
              ) : msg.seen ? (
                <CheckCheck className="h-3 w-3 text-sky-400" />
              ) : (
                <Check className="h-3 w-3 text-zinc-550" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

// ─── Voice Note Player (inline audio player for voice messages) ─────

// Module-level shared state: enforces that only one voice note plays at a time.
// When a new voice note starts playing, any previously-playing one is paused
// and its React state is reset so the UI reflects the stopped state.
let _activeVoiceNotePlayer: {
  audio: HTMLAudioElement;
  reset: () => void;
} | null = null;

/**
 * Transform a Cloudinary audio URL to transcode on-the-fly to a universally playable format.
 * iOS Safari cannot play audio/webm (Chrome's default recording format), but Cloudinary
 * can transcode to MP3 (supported everywhere) via its URL transformation API.
 *
 * Example:
 *   input:  https://res.cloudinary.com/demo/video/upload/v123/orbit/chats/voice_notes/rec.wav
 *   output: https://res.cloudinary.com/demo/video/upload/f_mp3/v123/orbit/chats/voice_notes/rec.wav
 */
function getPlayableUrl(originalUrl: string): string {
  // Only transform Cloudinary URLs that might not be universally playable
  if (!originalUrl.includes("cloudinary.com")) return originalUrl;

  // Extract the format from the URL (last segment before any query params)
  const pathname = originalUrl.split("?")[0];
  const ext = pathname.split(".").pop()?.toLowerCase() || "";

  // Formats that are universally playable on all devices (iOS Safari included)
  const universallyPlayable = ["mp3", "m4a", "aac", "wav"];
  if (universallyPlayable.includes(ext)) return originalUrl;

  // Skip URLs that already have transformation segments (prevent double-transformation)
  if (originalUrl.includes("/video/upload/f_")) return originalUrl;

  // For webm, ogg, or any other exotic format, inject f_mp3 transformation
  // to transcode on-the-fly via Cloudinary's API
  return originalUrl.replace(
    /(\/video\/upload\/)(.*)/,
    "$1f_mp3/$2"
  );
}

function VoiceNotePlayer({ url, isMe, initialDuration }: { url: string; isMe: boolean; initialDuration?: number }) {
  const playableUrl = getPlayableUrl(url);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      // Pause current
      audio.pause();
      setPlaying(false);
      // Clear active ref if it's us
      if (_activeVoiceNotePlayer?.audio === audio) {
        _activeVoiceNotePlayer = null;
      }
    } else {
      // Stop any other playing voice note first
      if (_activeVoiceNotePlayer && _activeVoiceNotePlayer.audio !== audio) {
        _activeVoiceNotePlayer.audio.pause();
        _activeVoiceNotePlayer.reset();
      }

      // If duration is still 0 (blob URL with no metadata), try preload="auto" first
      if (duration === 0 && url.startsWith("blob:")) {
        audio.preload = "auto";
        audio.load();
      }

      // Attempt to play — catch failures (e.g. unsupported format, network error)
      audio.play().catch(() => {
        setHasError(true);
      });

      _activeVoiceNotePlayer = {
        audio,
        reset: () => {
          setPlaying(false);
          setCurrentTime(0);
        },
      };
      setPlaying(true);
      setHasError(false);
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Retry loading if audio failed
  const handleRetry = () => {
    setHasError(false);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  };

  if (hasError) {
    return (
      <div className={`flex items-center gap-2 py-1.5 px-1 min-w-[160px] ${isMe ? "flex-row" : "flex-row"}`}>
      <button
        onClick={handleRetry}
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer bg-red-500/20 hover:bg-red-500/30"
        title="Retry loading"
      >
        <Play className="h-3.5 w-3.5 text-red-400 ml-0.5" />
      </button>
      <span className="text-[9px] text-red-400/60 font-mono">Failed to load</span>
      <audio
        ref={audioRef}
        src={playableUrl}
        preload="none"
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration);
            setHasError(false);
          }}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 py-1.5 px-1 min-w-[160px] ${isMe ? "flex-row" : "flex-row"}`}>
      <button
        onClick={togglePlay}
        disabled={false}
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
          playing
            ? "bg-indigo-500/30"
            : "bg-white/10 hover:bg-white/20"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {playing ? <Pause className="h-3.5 w-3.5 text-white" /> : <Play className="h-3.5 w-3.5 text-white ml-0.5" />}
      </button>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            ref={progressRef}
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : playing ? "100%" : "0%",
              backgroundColor: isMe ? "rgba(255,255,255,0.6)" : "rgba(99,102,241,0.6)",
            }}
          />
        </div>
        <span className="text-[9px] font-mono text-zinc-400 tabular-nums shrink-0">
          {duration === 0 && !playing ? (
            <span className="text-zinc-600">--:--</span>
          ) : playing ? (
            formatTime(currentTime)
          ) : (
            formatTime(duration)
          )}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={playableUrl}
        preload={url.startsWith("blob:") ? "auto" : "metadata"}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            if (isFinite(d) && d > 0) {
              setDuration(d);
              setHasError(false);
            }
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          if (_activeVoiceNotePlayer?.audio === audioRef.current) {
            _activeVoiceNotePlayer = null;
          }
        }}
        onError={() => {
          setHasError(true);
        }}
      />
    </div>
  );
}

export default MessageBubble;
