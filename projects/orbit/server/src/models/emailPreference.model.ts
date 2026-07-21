import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const emailPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    digestFrequency: {
      type: String,
      enum: ["daily", "weekly", "never"],
      default: "daily",
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
    emailTypes: {
      type: [{
        type: String,
        enum: ["like", "comment", "follow", "mention", "message", "weekly_digest"],
      }],
      default: ["like", "comment", "follow", "mention", "message", "weekly_digest"],
    },
    lastDigestSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

type EmailPreferenceType = InferSchemaType<typeof emailPreferenceSchema>;
export type EmailPreferenceDocument = HydratedDocument<EmailPreferenceType>;

export const EmailPreference = mongoose.model<EmailPreferenceDocument>("EmailPreference", emailPreferenceSchema);
