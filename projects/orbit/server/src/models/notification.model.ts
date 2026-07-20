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
      enum: ["like", "comment", "follow", "repost", "save", "mention", "reaction", "message_reply", "glimpse_reaction", "glimpse_reply", "poll_vote", "collab_invite", "follow_request", "daily_reward", "streak_reminder", "room_invite", "invite_accepted"],
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

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AudioRoom",
      default: null,
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

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
