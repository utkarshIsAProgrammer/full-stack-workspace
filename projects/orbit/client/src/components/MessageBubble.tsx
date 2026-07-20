import React, { useRef, useState } from "react";
import { CornerDownLeft, Play, Pause, AlertCircle, FileText, Volume2, VolumeX } from "lucide-react";
import UserAvatar from "./UserAvatar";
import type { Message } from "../types";

const CustomCheck = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 4L9 17L4 12" />
  </svg>
);

const CustomCheckCheck = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 5L10 12L7 9" />
    <path d="M23 4L13 14L10 11" />
  </svg>
);

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  userId: string;
  groupedReactions: Record<string, { count: number; hasReacted: boolean }>;
  handleContextMenu: (e: React.MouseEvent | { clientX: number; clientY: number; preventDefault: () => void }, message: Message) => void;
  handleReaction: (message: Message, emoji: string) => void;
  formatMessageTime: (isoString: string) => string;
  onSwipeToReply?: (message: Message) => void;
  showDateSeparator?: boolean;
  dateSeparatorText?: string;
  showTimeHeader?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onCancelUpload?: (pendingId: string) => void;
  onRetrySend?: (pendingId: string) => void;
}

function arePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.msg._id !== next.msg._id) return false;
  if (prev.msg.text !== next.msg.text) return false;
  if (prev.msg.isDeleted !== next.msg.isDeleted) return false;
  if (prev.msg.seen !== next.msg.seen) return false;
  if (prev.msg.isEdited !== next.msg.isEdited) return false;
  if (prev.isMe !== next.isMe) return false;
  if (prev.showDateSeparator !== next.showDateSeparator) return false;
  if (prev.dateSeparatorText !== next.dateSeparatorText) return false;
  if (prev.showTimeHeader !== next.showTimeHeader) return false;
  if (prev.isFirstInGroup !== next.isFirstInGroup) return false;
  if (prev.isLastInGroup !== next.isLastInGroup) return false;
  if (prev.msg._failed !== next.msg._failed) return false;

  if (prev.msg.replyTo?._id !== next.msg.replyTo?._id) return false;
  if (prev.msg.replyTo?.text !== next.msg.replyTo?.text) return false;

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

  const prevKeys = Object.keys(prev.groupedReactions);
  const nextKeys = Object.keys(next.groupedReactions);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (!next.groupedReactions[key]) return false;
    if (prev.groupedReactions[key].count !== next.groupedReactions[key].count) return false;
    if (prev.groupedReactions[key].hasReacted !== next.groupedReactions[key].hasReacted) return false;
  }

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
  showDateSeparator = false,
  dateSeparatorText = "",
  showTimeHeader = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  onCancelUpload,
  onRetrySend,
}: MessageBubbleProps) {
  const [showSwipeBadge, setShowSwipeBadge] = useState(false);
  const swipeBarRef = useRef<HTMLDivElement>(null);
  const swipeOffsetRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video state (per video attachment)
  const [videoMuted, setVideoMuted] = useState<Record<number, boolean>>({});
  const [videoEnded, setVideoEnded] = useState<Record<number, boolean>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const handleToggleMute = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRefs.current[idx];
    if (video) {
      video.muted = !video.muted;
      setVideoMuted((prev) => ({ ...prev, [idx]: !prev[idx] }));
    }
  };

  const handleVideoEnded = (idx: number) => {
    setVideoEnded((prev) => ({ ...prev, [idx]: true }));
  };

  const handleReplayVideo = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRefs.current[idx];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setVideoEnded((prev) => ({ ...prev, [idx]: false }));
    }
  };

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

  const hasAttachments = msg.attachments && msg.attachments.length > 0;
  const hasOnlyAttachments = hasAttachments && !msg.text && !msg.replyTo;
  const deletedForMe = msg.deletedFor?.includes(userId);

  const bubbleRoundClass = isMe
    ? `${isFirstInGroup ? "rounded-tr-none" : "rounded-tr-md"} ${isLastInGroup ? "rounded-br-none" : "rounded-br-md"}`
    : `${isFirstInGroup ? "rounded-tl-none" : "rounded-tl-md"} ${isLastInGroup ? "rounded-bl-none" : "rounded-bl-md"}`;

  return (
    <div className="w-full flex flex-col select-none">
      {showDateSeparator && (
        <div className="flex justify-center my-3.5 select-none">
          <span className="bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wide">
            {dateSeparatorText}
          </span>
        </div>
      )}

      {showTimeHeader && !showDateSeparator && (
        <div className="flex justify-center mt-2.5 mb-1 select-none">
          <span className="text-zinc-550 text-[9px] font-bold tracking-widest uppercase">
            {formatMessageTime(msg.createdAt)}
          </span>
        </div>
      )}

      <div
        id={`msg-${msg._id}`}
        className={`relative flex gap-3 max-w-[85%] group/bubble ${
          isMe ? "ml-auto flex-row-reverse" : "mr-auto"
        } ${isFirstInGroup ? "mt-2.5" : "mt-0.5"}`}
        onContextMenu={(e) => handleContextMenu(e, msg)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <div
          ref={swipeBarRef}
          className={`absolute inset-y-0 w-1.5 bg-indigo-500/50 pointer-events-none ${isMe ? "right-0 rounded-l-full rounded-r-none" : "left-0 rounded-r-full"}`}
          style={{ transform: isMe ? 'translateX(6px)' : 'translateX(-6px)', opacity: 0, transition: 'transform 200ms ease-out, opacity 200ms ease-out' }}
        />
        {showSwipeBadge && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 z-10 pointer-events-none ${isMe ? "right-3" : "left-3"}`}
          >
            <div className="flex items-center gap-1.5 bg-indigo-500/20 backdrop-blur-sm rounded-full px-2.5 py-1 border border-indigo-400/30">
              <CornerDownLeft className="h-3 w-3 text-indigo-300" />
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Reply</span>
            </div>
          </div>
        )}
        {!isMe && (
          <div className="w-8 shrink-0 flex items-end">
            {isLastInGroup ? (
              <UserAvatar
                src={msg.sender.profilePic?.url}
                alt={msg.sender.fullName}
                className="h-7 w-7 rounded-full object-cover border border-zinc-800"
              />
            ) : (
              <div className="w-7" />
            )}
          </div>
        )}

        <div className={`space-y-0.5 text-left flex flex-col ${isMe ? "items-end" : "items-start"}`}>
          {!isMe && isFirstInGroup && (
            <span className="text-[9px] text-zinc-500 font-bold mb-0.5 pl-1 select-none">
              {msg.sender.fullName}
            </span>
          )}

          <div
            className={`rounded-2xl text-[12px] border relative select-text ${bubbleRoundClass} ${
              hasOnlyAttachments ? "p-1 pb-1" : "px-3 py-1.5"
            } ${
              isMe
                ? "bg-indigo-950/70 text-white border-indigo-800/40"
                : "bg-zinc-900/80 text-zinc-100 border-zinc-800"
            }`}
          >
            {msg.isDeleted || deletedForMe ? (
              <span className="italic text-zinc-500 text-[12px] md:text-sm">This message was deleted</span>
            ) : (
              <>
                {msg.forwardedFrom && (
                  <div className="mb-1.5 flex items-center gap-1">
                    <svg className="h-3 w-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 2l4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 014-4h14" />
                    </svg>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Forwarded
                    </span>
                  </div>
                )}
                {msg.replyTo && (
                  <div
                    className="flex items-start gap-2 mb-2 pb-2 border-l-2 border-blue-500/40 pl-2.5 cursor-pointer hover:bg-zinc-800/30 rounded-r-lg -ml-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = document.getElementById(`msg-${msg.replyTo?._id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-1", "ring-blue-500/30", "rounded-2xl");
                        setTimeout(() => el.classList.remove("ring-1", "ring-blue-500/30", "rounded-2xl"), 2000);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider leading-tight">
                        {msg.replyTo.sender.fullName}
                      </p>
                      <p className="text-[12px] md:text-sm text-zinc-400 truncate leading-relaxed mt-0.5">
                        {msg.replyTo.text || (msg.replyTo.attachments && msg.replyTo.attachments.length > 0 ? "📎 Attachment" : "")}
                      </p>
                    </div>
                    <CornerDownLeft className="h-3 w-3 text-zinc-500 shrink-0 mt-1" />
                  </div>
                )}
                {msg.text && <p className="leading-relaxed whitespace-pre-wrap select-text break-word pr-1.5">{msg.text}{msg.isEdited && <span className="text-[10px] text-zinc-400 italic ml-1">(edited)</span>}</p>}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`${msg.text ? "mt-1.5" : ""} space-y-1 max-w-sm rounded-xl overflow-hidden`}>
                    {msg.attachments.map((att, aIdx) => {
                      const isAttachmentDisabled = !!(msg._pending || msg._failed);
                      if (att.type === "voice_note") {
                        return (
                          <VoiceNotePlayer
                            key={aIdx}
                            url={att.url}
                            isMe={isMe}
                            initialDuration={att.duration}
                            disabled={isAttachmentDisabled}
                          />
                        );
                      } else if (att.type === "video") {
                        return (
                          <div
                            key={aIdx}
                            className={`relative overflow-hidden rounded-lg border border-zinc-800 bg-black ${
                              isAttachmentDisabled ? "pointer-events-none opacity-40 select-none" : ""
                            }`}
                          >
                            <div className="relative">
                              <video
                                ref={(el) => { videoRefs.current[aIdx] = el; }}
                                preload="metadata"
                                className="w-full h-auto max-h-60 object-contain"
                                src={att.url}
                                autoPlay
                                muted={videoMuted[aIdx] ?? true}
                                playsInline
                                loop={false}
                                onEnded={() => handleVideoEnded(aIdx)}
                              />
                              {/* Mute toggle */}
                              <button
                                onClick={(e) => handleToggleMute(aIdx, e)}
                                className="absolute bottom-3 left-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all cursor-pointer"
                                title={videoMuted[aIdx] ? "Unmute" : "Mute"}
                              >
                                {videoMuted[aIdx] ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                              </button>
                              {/* Replay overlay */}
                              {videoEnded[aIdx] && (
                                <div
                                  className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-10"
                                  onClick={(e) => handleReplayVideo(aIdx, e)}
                                >
                                  <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm hover:bg-white/30 transition-all">
                                    <Play className="h-6 w-6 text-white fill-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else if (att.type === "file") {
                        const fileName = att.public_id?.split("-").slice(1).join("-") || "Download Attachment";
                        return (
                          <a
                            key={aIdx}
                            href={!isAttachmentDisabled ? att.url : undefined}
                            onClick={(e) => {
                              if (isAttachmentDisabled) {
                                e.preventDefault();
                              }
                            }}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs max-w-xs shrink-0 select-none ${
                              isAttachmentDisabled
                                ? "opacity-40 cursor-not-allowed pointer-events-none text-zinc-550"
                                : "text-blue-400 hover:underline cursor-pointer"
                            }`}
                          >
                            <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                            <span className="truncate flex-1 min-w-0" title={fileName}>{fileName}</span>
                          </a>
                        );
                      } else {
                        // Images — open preview on click (original behavior)
                        return (
                          <div
                            key={aIdx}
                            className={`relative overflow-hidden rounded-lg border border-zinc-800/40 ${
                              isAttachmentDisabled
                                ? "opacity-40 cursor-not-allowed pointer-events-none select-none"
                                : "cursor-pointer"
                            }`}
                            onClick={(e) => {
                              if (isAttachmentDisabled) return;
                              e.stopPropagation();
                              window.dispatchEvent(
                                new CustomEvent("openImagePreview", {
                                  detail: att.url,
                                })
                              );
                            }}
                          >
                            <img loading="lazy"
                              src={att.url}
                              alt={`Attachment from ${msg.sender.fullName}`}
                              className="w-full h-auto max-h-60 object-cover"
                              draggable={false}
                            />
                          </div>
                        );
                      }
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
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[12px] md:text-sm border ${
                    data.hasReacted
                      ? "bg-indigo-500/20 border-indigo-400/30"
                      : "bg-zinc-800/50 border-zinc-700/50"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[12px] md:text-sm">{data.count}</span>
                </button>
              ))}
            </div>
          )}

          {isLastInGroup && (
            <div className="flex items-center gap-1 px-1 text-[9px] font-bold text-zinc-550 select-none">
              <span>{formatMessageTime(msg.createdAt)}</span>
              {isMe && (
                <span title={(msg as any)._pending ? 'Sending...' : msg.seen ? 'Seen' : 'Sent'}>
                  {(msg as any)._pending ? (
                    null
                  ) : msg.seen ? (
                    <CustomCheckCheck className="h-4 w-5 text-sky-400" />
                  ) : (
                    <CustomCheck className="h-4 w-4 text-zinc-550" />
                  )}
                </span>
              )}
            </div>
          )}

          {msg._pending && (
            <div className={`flex items-center gap-1 text-[10px] text-zinc-400 font-bold mt-1 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
              <span>Sending...</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelUpload?.(msg._id);
                }}
                className="text-[10px] underline hover:text-zinc-350 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {msg._failed && (
            <div className={`flex items-center gap-1.5 text-[10px] text-red-500 font-bold mt-1 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>Failed to send</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetrySend?.(msg._id);
                }}
                className="text-[10px] underline hover:text-red-400 cursor-pointer"
              >
                Retry
              </button>
              <span className="text-zinc-700 font-normal">•</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelUpload?.(msg._id);
                }}
                className="text-[10px] underline hover:text-red-400 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div
          className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-550 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 pointer-events-none select-none hidden md:block whitespace-nowrap ${
            isMe ? "left-[-60px]" : "right-[-60px]"
          }`}
        >
          {formatMessageTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

// ─── Voice Note Player ──────────────────────────────────────────

// Module-level manager that ensures only one voice note plays at a time.
// Intentionally module-scoped (not React state or ref) because it needs to
// synchronize across all VoiceNotePlayer instances without re-renders.
const voiceNoteManager = {
  player: null as { audio: HTMLAudioElement; reset: () => void; } | null,
  stopCurrent() {
    if (this.player) {
      this.player.audio.pause();
      this.player.reset();
      this.player = null;
    }
  },
  setPlayer(player: { audio: HTMLAudioElement; reset: () => void }) {
    if (this.player && this.player.audio !== player.audio) {
      this.stopCurrent();
    }
    this.player = player;
  },
  clear() {
    this.player = null;
  }
};

function getPlayableUrl(originalUrl: string): string {
  if (!originalUrl.includes("cloudinary.com")) return originalUrl;
  const pathname = originalUrl.split("?")[0];
  const ext = pathname.split(".").pop()?.toLowerCase() || "";
  const universallyPlayable = ["mp3", "m4a", "aac", "wav"];
  if (universallyPlayable.includes(ext)) return originalUrl;
  if (originalUrl.includes("/video/upload/f_")) return originalUrl;
  return originalUrl.replace(
    /(\/video\/upload\/)(.*)/,
    "$1f_mp3/$2"
  );
}

function VoiceNotePlayer({ url, isMe, initialDuration, disabled }: { url: string; isMe: boolean; initialDuration?: number; disabled?: boolean }) {
  const playableUrl = getPlayableUrl(url);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const safeDuration = duration && isFinite(duration) && duration > 0 
    ? duration 
    : (initialDuration && isFinite(initialDuration) && initialDuration > 0 ? initialDuration : 0);

  const togglePlay = () => {
    if (disabled) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (voiceNoteManager.player?.audio === audio) {
        voiceNoteManager.clear();
      }
    } else {
      voiceNoteManager.setPlayer({
        audio,
        reset: () => {
          setPlaying(false);
          setCurrentTime(0);
        },
      });
      if (audio.currentTime >= (audio.duration || safeDuration) || audio.currentTime === 0) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      if (duration === 0 && url.startsWith("blob:")) {
        audio.preload = "auto";
        audio.load();
      }
      audio.play().catch(() => {
        setHasError(true);
      });
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

  const handleRetry = () => {
    setHasError(false);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (safeDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercent = Math.max(0, Math.min(clickX / width, 1));
    const targetTime = clickPercent * safeDuration;
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
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
      <span className="text-[10px] text-red-400/60 font-mono">Failed to load</span>
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
        disabled={disabled}
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
          disabled
            ? "bg-white/5 opacity-30 cursor-not-allowed pointer-events-none"
            : playing
              ? "bg-indigo-500/30 cursor-pointer"
              : "bg-white/10 hover:bg-white/20 cursor-pointer"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {playing ? <Pause className="h-3.5 w-3.5 text-white" /> : <Play className="h-3.5 w-3.5 text-white ml-0.5" />}
      </button>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div 
          onClick={disabled ? undefined : handleProgressBarClick}
          className={`flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden relative ${disabled ? 'cursor-not-allowed pointer-events-none opacity-50' : 'cursor-pointer'}`}
        >
          <div
            ref={progressRef}
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${safeDuration > 0 ? Math.min((currentTime / safeDuration) * 100, 100) : 0}%`,
              backgroundColor: isMe ? "rgba(255,255,255,0.6)" : "rgba(99,102,241,0.6)",
            }}
          />
        </div>
        <span className="text-[10px] font-mono text-zinc-400 tabular-nums shrink-0">
          {safeDuration === 0 && !playing ? (
            <span className="text-zinc-600">--:--</span>
          ) : playing ? (
            formatTime(currentTime)
          ) : (
            formatTime(safeDuration)
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
          setCurrentTime(safeDuration);
          if (voiceNoteManager.player?.audio === audioRef.current) {
            voiceNoteManager.clear();
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
