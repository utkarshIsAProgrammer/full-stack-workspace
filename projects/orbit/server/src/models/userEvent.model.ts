import mongoose from "mongoose";

const userEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for anonymous events
      index: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
    },
    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sessionId: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index — auto-delete events older than 90 days
userEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
userEventSchema.index({ event: 1, createdAt: -1 });
userEventSchema.index({ user: 1, event: 1, createdAt: -1 });

const UserEvent = mongoose.model("UserEvent", userEventSchema);
export default UserEvent;
