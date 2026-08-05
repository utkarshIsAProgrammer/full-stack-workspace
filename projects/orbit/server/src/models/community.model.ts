import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required!"],
      trim: true,
      maxlength: [50, "Community name cannot exceed 50 characters!"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters!"],
    },
    image: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    memberCount: {
      type: Number,
      default: 1,
    },
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunityMessage",
      },
    ],
    // Admin features
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    messagingEnabled: {
      type: Boolean,
      default: true,
    },
    audioCallEnabled: {
      type: Boolean,
      default: false,
    },
    videoCallEnabled: {
      type: Boolean,
      default: false,
    },
    // Snapshot of the community's last message — lets the community list show a
    // live "last message" preview without having to query the messages table.
    // Reset to null by clear-chat. Updated on every new/edited message.
    lastMessage: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunityMessage",
        default: null,
      },
      text: { type: String, default: "" },
      attachmentType: { type: String, default: "" },
      sender: {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        fullName: { type: String, default: "" },
        username: { type: String, default: "" },
      },
      createdAt: { type: Date, default: null },
      isDeleted: { type: Boolean, default: false },
    },
    // Last NON-message action in the community (e.g. a reaction, pin, call).
    // Mirrors the 1-on-1 conversation model so the community list can show
    // "Name reacted ❤️ to your message", "Name pinned a message",
    // "Voice call ended" etc. instead of the stale last message. Reset to null
    // whenever a new message is sent.
    lastAction: {
      type: {
        type: String,
        enum: ["reaction", "pin", "unpin", "call", "message_edit"],
        default: null,
      },
      emoji: { type: String, default: "" },
      // For calls: "audio" | "video"
      callType: {
        type: String,
        enum: ["audio", "video", ""],
        default: "",
      },
      // For calls: "started" | "ended" — "ended" is what the list preview
      // shows ("Voice call ended"); "started" is only transient.
      callStatus: {
        type: String,
        enum: ["started", "ended", ""],
        default: "",
      },
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunityMessage",
        default: null,
      },
      messageSenderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      actor: {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        fullName: { type: String, default: "" },
        username: { type: String, default: "" },
      },
      createdAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Indexes for optimal query performance
communitySchema.index({ name: 1 });
communitySchema.index({ "members.user": 1 });
communitySchema.index({ creator: 1 });
communitySchema.index({ createdAt: -1 });
communitySchema.index({ "members.user": 1, updatedAt: -1 });
communitySchema.index({ memberCount: -1 });

type CommunityType = InferSchemaType<typeof communitySchema>;
export type CommunityDocument = HydratedDocument<CommunityType>;

export const Community = mongoose.model<CommunityDocument>("Community", communitySchema);
