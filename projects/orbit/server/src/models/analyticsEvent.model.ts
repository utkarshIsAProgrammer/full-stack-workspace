import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    event: {
      type: String,
      enum: ["view", "like", "comment", "share", "save", "follow", "profile_view", "post_view"],
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
      default: null,
    },
    targetModel: {
      type: String,
      enum: ["Post", "User", "Comment"],
      default: null,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date().toISOString().split("T")[0],
    },
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { timestamps: true }
);

// Compound index for daily aggregation queries
analyticsEventSchema.index({ user: 1, event: 1, date: -1 });
analyticsEventSchema.index({ user: 1, date: -1 });
analyticsEventSchema.index({ event: 1, date: -1 });
// Unique constraint to upsert daily counts
analyticsEventSchema.index({ user: 1, event: 1, target: 1, date: 1 }, { unique: true, sparse: true });

type AnalyticsEventType = InferSchemaType<typeof analyticsEventSchema>;
export type AnalyticsEventDocument = HydratedDocument<AnalyticsEventType>;

export const AnalyticsEvent = mongoose.model<AnalyticsEventDocument>("AnalyticsEvent", analyticsEventSchema);
