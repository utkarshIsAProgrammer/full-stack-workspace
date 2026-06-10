import React from "react";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import type { Message } from "../types";

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  groupedReactions: Record<string, { count: number; hasReacted: boolean }>;
  handleContextMenu: (e: React.MouseEvent, message: Message) => void;
  handleReaction: (message: Message, emoji: string) => void;
  formatMessageTime: (isoString: string) => string;
}

function arePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.msg._id !== next.msg._id) return false;
  if (prev.msg.text !== next.msg.text) return false;
  if (prev.msg.isDeleted !== next.msg.isDeleted) return false;
  if (prev.msg.seen !== next.msg.seen) return false;
  if (prev.msg.isEdited !== next.msg.isEdited) return false;
  if (prev.isMe !== next.isMe) return false;

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
  groupedReactions,
  handleContextMenu,
  handleReaction,
  formatMessageTime,
}: MessageBubbleProps) {
  return (
    <div
      className={`flex gap-3 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
      onContextMenu={(e) => handleContextMenu(e, msg)}
    >
      {!isMe && (
        <div className="w-8 shrink-0 flex items-end">
          <img loading="lazy"
            src={msg.sender.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
            alt={msg.sender.fullName}
            className="h-7 w-7 rounded-full object-cover border border-zinc-800"
          />
        </div>
      )}

      <div className="space-y-1 text-left flex flex-col items-end">
        <div
          className={`rounded-2xl px-3.5 py-2 text-xs border relative group/bubble select-text ${
            isMe
              ? "bg-zinc-800 text-white border-zinc-700 rounded-tr-none"
              : "bg-zinc-900/80 text-zinc-100 border-zinc-800 rounded-tl-none"
          }`}
        >
          {msg.isDeleted ? (
            <span className="italic text-zinc-500 text-[11px]">This message was deleted</span>
          ) : (
            <>
              <p className="leading-relaxed whitespace-pre-wrap select-text break-word pr-1.5">{msg.text}</p>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-1.5 max-w-sm rounded-xl overflow-hidden border border-zinc-800">
                  {msg.attachments.map((att, aIdx) => (
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
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex gap-1 mt-1">
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(msg, emoji)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                  data.hasReacted
                    ? "bg-blue-500/20 border-blue-400/30"
                    : "bg-zinc-800/50 border-zinc-700/50"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[10px]">{data.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-1.5 text-[9px] font-bold text-zinc-550 select-none">
          {msg.isEdited && !msg.isDeleted && <span>edited</span>}
          <span>{formatMessageTime(msg.createdAt)}</span>
          {isMe && (
            <span title={(msg as any)._pending ? 'Sending...' : msg.seen ? 'Seen' : 'Sent'}>
              {(msg as any)._pending ? (
                <Loader2 className="h-3 w-3 text-zinc-550 animate-spin" />
              ) : msg.seen ? (
                <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
              ) : (
                <Check className="h-3.5 w-3.5 text-zinc-550" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, arePropsEqual);

export default MessageBubble;
