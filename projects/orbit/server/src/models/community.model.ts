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
