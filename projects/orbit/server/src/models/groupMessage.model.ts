import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
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
    attachments: [{
      url: { type: String },
      public_id: { type: String, default: "" },
      type: { type: String, enum: ["image", "gif", "video", "file"], default: "file" },
    }],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

groupMessageSchema.index({ group: 1, createdAt: -1 });
groupMessageSchema.index({ sender: 1, createdAt: -1 });

type GroupMessageType = InferSchemaType<typeof groupMessageSchema>;
export type GroupMessageDocument = HydratedDocument<GroupMessageType>;

export const GroupMessage = mongoose.model<GroupMessageDocument>("GroupMessage", groupMessageSchema);
