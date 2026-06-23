import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      required: true,
      validate: {
        validator: function (val: any[]) {
          return val.length === 2;
        },
        message: "A 1-on-1 conversation must have exactly 2 participants!",
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for optimal query performance
// Unique compound index on the sorted participants elements to enforce a single conversation between the same two users
// Note: To make this work correctly, participant IDs MUST be sorted alphabetically/lexicographically before saving.
conversationSchema.index({ "participants.0": 1, "participants.1": 1 }, { unique: true });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ lastMessage: 1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });

type ConversationType = InferSchemaType<typeof conversationSchema>;
export type ConversationDocument = HydratedDocument<ConversationType>;

export const Conversation = mongoose.model<ConversationDocument>("Conversation", conversationSchema);
