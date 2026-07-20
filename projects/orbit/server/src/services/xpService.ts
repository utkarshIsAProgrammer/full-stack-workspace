import XP, { calculateLevel, LEVEL_THRESHOLDS } from "../models/xp.model";
import { logger } from "../utilities/logger";

const XP_REWARDS = {
  CREATE_POST: 10,
  COMMENT: 3,
  LIKE: 1,
  RECEIVE_LIKE: 2,
  DAILY_LOGIN: 5,
  SHARE_POST: 3,
  SAVE_POST: 1,
  FOLLOW: 2,
  COMPLETE_MISSION: 25,
  STREAK_BONUS: 15,
};

/**
 * Award XP to a user for an action.
 */
export async function awardXP(
  userId: string,
  action: keyof typeof XP_REWARDS,
  metadata?: Record<string, any>
): Promise<{ totalXP: number; level: number; leveledUp: boolean; newBadges: string[] }> {
  try {
    const amount = XP_REWARDS[action] || 0;
    if (amount === 0) return { totalXP: 0, level: 1, leveledUp: false, newBadges: [] };

    let xpRecord = await XP.findOne({ userId });
    if (!xpRecord) {
      xpRecord = await XP.create({ userId, totalXP: 0, level: 1 });
    }

    const oldLevel = xpRecord.level;
    const newTotal = xpRecord.totalXP + amount;
    const newLevel = calculateLevel(newTotal);

    const oldBadges = xpRecord.badges || [];
    const newBadges: string[] = [];

    // Check for milestone badges
    if (newTotal >= 100 && !oldBadges.includes("first_100")) newBadges.push("first_100");
    if (newTotal >= 1000 && !oldBadges.includes("first_1k")) newBadges.push("first_1k");
    if (newTotal >= 10000 && !oldBadges.includes("first_10k")) newBadges.push("first_10k");
    if (newLevel >= 5 && !oldBadges.includes("level_5")) newBadges.push("level_5");
    if (newLevel >= 10 && !oldBadges.includes("level_10")) newBadges.push("level_10");
    if (newLevel >= 20 && !oldBadges.includes("level_20")) newBadges.push("level_20");

    xpRecord.totalXP = newTotal;
    xpRecord.level = newLevel;
    xpRecord.lastActivity = new Date();
    if (newBadges.length > 0) {
      xpRecord.badges = [...oldBadges, ...newBadges];
    }
    await xpRecord.save();

    return {
      totalXP: newTotal,
      level: newLevel,
      leveledUp: newLevel > oldLevel,
      newBadges,
    };
  } catch (err) {
    logger.error("Failed to award XP", { userId, action, error: (err as Error).message });
    return { totalXP: 0, level: 1, leveledUp: false, newBadges: [] };
  }
}

/**
 * Get XP info for a user.
 */
export async function getXPInfo(userId: string) {
  const xpRecord = await XP.findOne({ userId });
  if (!xpRecord) {
    return { totalXP: 0, level: 1, badges: [], nextLevelXP: LEVEL_THRESHOLDS[1] || 100, currentLevelXP: 0 };
  }

  const currentLevelIndex = xpRecord.level - 1;
  const nextLevelXP = LEVEL_THRESHOLDS[currentLevelIndex + 1] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const currentLevelMin = LEVEL_THRESHOLDS[currentLevelIndex] || 0;

  return {
    totalXP: xpRecord.totalXP,
    level: xpRecord.level,
    badges: xpRecord.badges || [],
    nextLevelXP,
    currentLevelXP: xpRecord.totalXP - currentLevelMin,
    levelMinXP: currentLevelMin,
  };
}

export { XP_REWARDS };
