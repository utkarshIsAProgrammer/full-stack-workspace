import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required!"],
      trim: true,
      maxlength: [100, "Group name cannot exceed 100 characters!"],
    },
    avatar: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
  },
  { timestamps: true }
);

groupSchema.index({ members: 1 });
groupSchema.index({ admin: 1 });
groupSchema.index({ updatedAt: -1 });

type GroupType = InferSchemaType<typeof groupSchema>;
export type GroupDocument = HydratedDocument<GroupType>;

export const Group = mongoose.model<GroupDocument>("Group", groupSchema);
