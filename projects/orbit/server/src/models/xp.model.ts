import mongoose from "mongoose";

export interface IXP {
  userId: mongoose.Types.ObjectId;
  totalXP: number;
  level: number;
  badges: string[];
  lastActivity: Date;
}

const xpSchema = new mongoose.Schema<IXP>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    totalXP: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [{ type: String }],
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500,
  10000, 13000, 17000, 22000, 28000, 35000, 43000, 52000, 63000, 75000,
];

export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (threshold !== undefined && xp >= threshold) return i + 1;
  }
  return 1;
}

export default mongoose.model<IXP>("XP", xpSchema);
