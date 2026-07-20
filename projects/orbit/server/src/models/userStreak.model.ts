import mongoose from "mongoose";

const userStreakSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastActiveDate: {
      type: Date,
      default: null,
    },
    // Partner streaks: map of partnerUserId -> { currentStreak, lastActiveDate }
    partnerStreaks: {
      type: Map,
      of: new mongoose.Schema(
        {
          currentStreak: { type: Number, default: 0 },
          lastActiveDate: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: new Map(),
    },
  },
  { timestamps: true }
);

userStreakSchema.index({ currentStreak: -1 });
userStreakSchema.index({ lastActiveDate: -1 });

export const UserStreak = mongoose.model("UserStreak", userStreakSchema);
