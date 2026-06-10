import React, { useState, useEffect } from "react";
import { User, Comment, CommentReaction } from "../types";
import { Reply, Smile, Heart, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";

interface CommentNodeProps {
  key?: React.Key;
  comment: Comment;
  user: User | null;
  onUserSelected: (username: string) => void;
  onReply: (commentId: string) => void;
  depth?: number;
  getRelativeDate: (date: string) => string;
  renderFormattedContent: (content: string) => React.ReactNode;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😠"];

export default function CommentNode({
  comment,
  user,
  onUserSelected,
  onReply,
  depth = 0,
  getRelativeDate,
  renderFormattedContent,
}: CommentNodeProps) {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [repliesFetched, setRepliesFetched] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState<number>(comment.repliesCount ?? 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local mirror of comment fields for realtime updates without parent re-render
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [likedByMe, setLikedByMe] = useState(!!comment.likedByMe);
  const [reactions, setReactions] = useState<CommentReaction[]>(comment.reactions || []);

  // Sync when comment prop changes (e.g. drawer re-opens)
  useEffect(() => {
    setLikesCount(comment.likesCount);
    setLikedByMe(!!comment.likedByMe);
    setReactions(comment.reactions || []);
    setRepliesFetched(false);
    setLocalRepliesCount(comment.repliesCount ?? 0);
    setEditText(comment.content);
    setIsEditing(false);
    setShowDeleteConfirm(false);
  }, [comment._id, comment.likesCount, comment.likedByMe, comment.reactions, comment.repliesCount, comment.content]);

  // Auto load replies when showing replies or when the comment changes
  useEffect(() => {
    if (showReplies && replies.length === 0) {
      loadReplies();
    }
  }, [showReplies, comment._id]);

  // Direct listener for realtime comment like/unlike updates
  useEffect(() => {
    const handleLikeChanged = (e: CustomEvent<{ commentId: string; likesCount: number }>) => {
      const { commentId: cid, likesCount: lc } = e.detail;
      if (cid === comment._id) {
        setLikesCount(lc);
      }
    };
    window.addEventListener("postCommentLikeChanged", handleLikeChanged as EventListener);
    return () => window.removeEventListener("postCommentLikeChanged", handleLikeChanged as EventListener);
  }, [comment._id]);

  // Listen for realtime comment edits (if this comment is updated remotely)
  useEffect(() => {
    const handleCommentUpdated = (e: CustomEvent<{ comment: Comment }>) => {
      const { comment: updatedComment } = e.detail;
      if (updatedComment._id === comment._id) {
        setEditText(updatedComment.content);
      }
    };
    window.addEventListener("commentUpdated", handleCommentUpdated as EventListener);
    return () => window.removeEventListener("commentUpdated", handleCommentUpdated as EventListener);
  }, [comment._id]);

  // Listen for realtime comment deletion (remove from replies list)
  useEffect(() => {
    const handleCommentDeleted = (e: CustomEvent<{ commentId: string }>) => {
      const { commentId } = e.detail;
      if (commentId === comment._id) {
        // The parent will handle removal via re-render with updated comments list
        // For replies, we just mark locally
      }
    };
    window.addEventListener("commentDeleted", handleCommentDeleted as EventListener);
    return () => window.removeEventListener("commentDeleted", handleCommentDeleted as EventListener);
  }, [comment._id]);

  // Direct listener for realtime comment emoji reaction updates
  useEffect(() => {
    const handleReactionChanged = (e: CustomEvent<{ commentId: string; reaction: any; type: "add" | "remove" }>) => {
      const { commentId: cid, reaction, type } = e.detail;
      if (cid !== comment._id) return;
      setReactions((prev) => {
        if (type === "add" && reaction) {
          // Remove ALL previous reactions by this sender, then add new one
          const senderId = typeof reaction.sender === "string" ? reaction.sender : reaction.sender?._id;
          const filtered = prev.filter((r) => {
            const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
            return sId !== senderId;
          });
          return [...filtered, reaction];
        } else if (type === "remove" && reaction) {
          // Remove only the reaction matching this sender + emoji
          const senderId = typeof reaction.sender === "string" ? reaction.sender : reaction.sender?._id;
          const filtered = prev.filter((r) => {
            const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
            return !(sId === senderId && r.emoji === reaction.emoji);
          });
          return filtered;
        }
        return prev;
      });
    };
    window.addEventListener("commentReactionChanged", handleReactionChanged as EventListener);
    return () => window.removeEventListener("commentReactionChanged", handleReactionChanged as EventListener);
  }, [comment._id]);

  const loadReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await apiFetch(`/api/comments/replies/${comment._id}`);
      if (!res.ok) throw new Error(`Failed to load replies: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setReplies(data.replies || []);
        setRepliesFetched(true);
        setLocalRepliesCount((data.replies || []).length);
      }
    } catch (e) {
      logger.error(e);
      setReplies([]);
      setRepliesFetched(true);
    } finally {
      setLoadingReplies(false);
    }
  };

  // Determine if replies button should be shown
  // Don't show if we already fetched and found nothing
  // Use actual loaded count after fetch, otherwise use prop
  const effectiveRepliesCount = repliesFetched ? localRepliesCount : (comment.repliesCount ?? 0);
  const hasReplies = replies.length > 0 || (!repliesFetched && effectiveRepliesCount > 0);

  const handleLikeToggle = async () => {
    if (!user) return;
    const prevLiked = likedByMe;
    const prevCount = likesCount;

    // Optimistic update
    setLikedByMe(!prevLiked);
    setLikesCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    try {
      const res = await apiFetch(`/api/likes/comment/${comment._id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback
        setLikedByMe(prevLiked);
        setLikesCount(prevCount);
      }
    } catch (e) {
      logger.error("Failed to toggle comment like", e);
      setLikedByMe(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    // 1. Optimistic UI update
    const userId = user._id;
    const existingIndex = (reactions || []).findIndex((r) => {
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      return sId === userId && r.emoji === emoji;
    });

    let nextReactions = [...(reactions || [])];
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
        createdAt: new Date().toISOString()
      } as any);
    }

    setReactions(nextReactions);
    setShowEmojiPicker(false);

    try {
      const res = await apiFetch(`/api/comments/${comment._id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.reactions) {
        // 2. Sync with backend source of truth
        setReactions(data.reactions);
      } else {
        logger.error("Failed to react to comment");
        // Revert
        setReactions(reactions);
      }
    } catch (e) {
      logger.error("Failed to react to comment", e);
      // Revert
      setReactions(reactions);
    }
  };

  const handleEdit = async () => {
    if (!user || !editText.trim()) return;
    try {
      const res = await apiFetch(`/api/comments/${comment._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsEditing(false);
      }
    } catch (e) {
      logger.error("Failed to edit comment", e);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/comments/${comment._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowDeleteConfirm(false);
      }
    } catch (e) {
      logger.error("Failed to delete comment", e);
    }
  };

  // Group reactions by emoji
  const getGroupedReactions = (reacts?: CommentReaction[]) => {
    if (!reacts || reacts.length === 0) return {};
    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    reacts.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, hasReacted: false };
      }
      grouped[r.emoji].count++;
      const sId = typeof r.sender === "string" ? r.sender : r.sender?._id;
      if (sId === user?._id) {
        grouped[r.emoji].hasReacted = true;
      }
    });
    return grouped;
  };

  const groupedReactions = getGroupedReactions(reactions);

  return (
    <div className={`space-y-3 ${depth > 0 ? "ml-8 border-l-2 pl-4 border-zinc-700/50" : ""}`}>
      <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-3 space-y-2 relative backdrop-blur-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:border-white/20 hover:bg-zinc-950/50 transition-all duration-300">
        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-950/90 backdrop-blur-sm">
            <div className="text-center space-y-3 px-4">
              <p className="text-xs font-semibold text-zinc-200">Delete this comment?</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleDelete}
                  className="rounded-full bg-red-500 px-4 py-1.5 text-[10px] font-semibold text-white hover:bg-red-400 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-full bg-zinc-800 px-4 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img loading="lazy"
              src={comment.author.profilePic?.url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
              alt={comment.author.fullName}
              onClick={() => onUserSelected(comment.author.username)}
              className="h-6 w-6 rounded-full object-cover border border-zinc-800 cursor-pointer shadow-sm"
            />
            <div>
              <h5
                onClick={() => onUserSelected(comment.author.username)}
                className="font-sans text-xs font-semibold text-slate-900 dark:text-zinc-100 leading-none cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {comment.author.fullName}
              </h5>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium">@{comment.author.username}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user && comment.author._id === user._id && !isEditing && (
              <>
                <button
                  onClick={() => { setIsEditing(true); setEditText(comment.content); }}
                  className="hover:text-indigo-400 text-zinc-500 transition-colors"
                  title="Edit comment"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="hover:text-red-400 text-zinc-500 transition-colors"
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
              {getRelativeDate(comment.createdAt)}
              {comment.isEdited && (
                <span className="ml-1 italic opacity-60">(edited)</span>
              )}
            </span>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/50 focus:bg-zinc-900 resize-none transition-all"
              rows={3}
              maxLength={1000}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-indigo-400 transition-colors"
              >
                <Check className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditText(comment.content); }}
                className="flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <XIcon className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-800 dark:text-zinc-200 select-text leading-relaxed">
            {renderFormattedContent(comment.content)}
          </p>
        )}

        {/* Emoji Reactions Row */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${data.hasReacted
                  ? "bg-indigo-500/20 border-indigo-400/30 text-indigo-300"
                  : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50"
                  }`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-medium">{data.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-3 pt-1">
          {user && (
            <button
              onClick={handleLikeToggle}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors group"
            >
              <Heart
                className={`h-3.5 w-3.5 transition-colors ${likedByMe
                  ? "fill-red-500 text-red-500"
                  : "text-slate-500 dark:text-zinc-400 group-hover:text-red-400"
                  }`}
              />
              <span className={`${likedByMe ? "text-red-400 font-semibold" : "text-slate-500 dark:text-zinc-400 group-hover:text-red-400"}`}>
                {likesCount}
              </span>
            </button>
          )}

          {user && (
            <button
              onClick={() => onReply(comment._id)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}

          {user && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-indigo-400 transition-colors"
              >
                <Smile className="h-3 w-3" /> React
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl z-50">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-sm hover:bg-zinc-700 transition-all hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(showReplies || hasReplies) && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className={`text-xs font-medium transition-colors ${showReplies
                ? "text-indigo-400"
                : "text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
            >
              {showReplies ? "Hide Replies" : `View ${effectiveRepliesCount} ${effectiveRepliesCount === 1 ? "Reply" : "Replies"}`}
            </button>
          )}
        </div>
      </div>

      {showReplies && (
        <div className="space-y-2 mt-2">
          {loadingReplies ? (
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 ml-6">
              <span className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300"></span>
              Loading replies...
            </div>
          ) : replies.length === 0 ? (
            <div className="text-[10px] text-zinc-500 ml-6 italic">
              No replies yet.
            </div>
          ) : (
            replies.map(reply => (
              <CommentNode
                key={reply._id}
                comment={reply}
                user={user}
                onUserSelected={onUserSelected}
                onReply={onReply}
                depth={depth + 1}
                getRelativeDate={getRelativeDate}
                renderFormattedContent={renderFormattedContent}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
