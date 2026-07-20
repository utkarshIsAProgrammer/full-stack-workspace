import { Request, Response } from "express";
import { getLeaderboard } from "../services/leaderboardService";
import { logger } from "../utilities/logger";

export const leaderboard = async (req: Request, res: Response) => {
  try {
    const rawType = req.query.type as string;
    const validTypes = ["weekly", "monthly", "alltime"];
    const type = (validTypes.includes(rawType) ? rawType : "weekly") as "weekly" | "monthly" | "alltime";
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const data = await getLeaderboard(type, limit);
    return res.status(200).json({ success: true, ...data });
  } catch (err: any) {
    logger.error("Leaderboard error", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to get leaderboard" });
  }
};
