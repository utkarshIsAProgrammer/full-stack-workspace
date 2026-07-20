import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const reactionSchema = new mongoose.Schema({
  emoji: {
    type: String,
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    enum: ["image", "gif", "sticker", "meme", "voice_note", "video", "file"],
    required: true,
  },
  duration: {
    type: Number,
    default: 0,
  },
});

const communityMessageSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityMessage",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
  },
  { timestamps: true }
);

// Indexes for optimal query performance
communityMessageSchema.index({ replyTo: 1 });
communityMessageSchema.index({ community: 1, createdAt: -1 });
communityMessageSchema.index({ sender: 1, createdAt: -1 });
communityMessageSchema.index({ community: 1, isDeleted: 1, createdAt: -1 });

type CommunityMessageType = InferSchemaType<typeof communityMessageSchema>;

export interface PopulatedCommunityReaction {
  _id: string;
  emoji: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: { url: string; public_id?: string };
  };
  createdAt: Date;
}

export type CommunityMessageDocument = HydratedDocument<CommunityMessageType>;

export const CommunityMessage = mongoose.model<CommunityMessageDocument>("CommunityMessage", communityMessageSchema);
