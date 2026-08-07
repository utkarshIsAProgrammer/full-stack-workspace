import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["like", "comment", "follow", "repost", "save", "mention", "reaction", "message", "message_reply", "community_message", "glimpse_reaction", "glimpse_reply", "poll_vote", "collab_invite", "follow_request", "daily_reward", "streak_reminder", "invite_accepted", "profile_share", "post_share", "glimpse_share", "comment_share"],
      required: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    glimpse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Glimpse",
      default: null,
    },

    // The profile that was shared with this recipient (profile_share type)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },

    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityMessage",
      default: null,
    },

    messageType: {
      type: String,
      enum: ["text", "photo", "video", "voice_note", "file", "gif", "sticker"],
      default: "text",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, messageType: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
