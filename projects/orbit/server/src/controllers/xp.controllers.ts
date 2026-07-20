import { Request, Response } from "express";
import { getXPInfo } from "../services/xpService";
import { logger } from "../utilities/logger";

/**
 * GET /api/xp
 */
export const getMyXP = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id?.toString();
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const info = await getXPInfo(userId);
    return res.status(200).json({ success: true, ...info });
  } catch (err: any) {
    logger.error("Error getting XP info", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to get XP info" });
  }
};

/**
 * GET /api/xp/:userId
 */
export const getUserXP = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId || Array.isArray(userId)) return res.status(400).json({ success: false, message: "User ID required" });
    const info = await getXPInfo(userId);
    return res.status(200).json({ success: true, ...info });
  } catch (err: any) {
    logger.error("Error getting user XP", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to get user XP" });
  }
};
