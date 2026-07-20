import UserMission, { DAILY_MISSIONS } from "../models/dailyMission.model";
import { awardXP } from "./xpService";
import { logger } from "../utilities/logger";

/**
 * Get the current date as YYYY-MM-DD.
 */
function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Initialize missions for today for a user if not already initialized.
 */
async function initTodayMissions(userId: string) {
  const today = getToday();
  let record = await UserMission.findOne({ userId, date: today });
  if (!record) {
    record = await UserMission.create({
      userId,
      date: today,
      missions: DAILY_MISSIONS.map((m) => ({
        type: m.type,
        current: 0,
        target: m.target,
        completed: false,
        claimed: false,
      })),
    });
  }
  return record;
}

/**
 * Progress a mission type for a user.
 */
export async function progressMission(userId: string, type: string, amount: number = 1) {
  try {
    const record = await initTodayMissions(userId);
    const mission = record.missions.find((m) => m.type === type);
    if (!mission || mission.completed) return;

    mission.current = Math.min(mission.current + amount, mission.target);
    if (mission.current >= mission.target) {
      mission.completed = true;
    }

    // Check if all missions are completed
    record.allCompleted = record.missions.every((m) => m.completed);

    await record.save();
  } catch (err) {
    logger.error("Failed to progress mission", { userId, type, error: (err as Error).message });
  }
}

/**
 * Claim rewards for a completed mission.
 */
export async function claimMissionReward(userId: string, missionType: string) {
  try {
    const today = getToday();
    const record = await UserMission.findOne({ userId, date: today });
    if (!record) return { success: false, message: "No missions found for today" };

    const mission = record.missions.find((m) => m.type === missionType);
    if (!mission) return { success: false, message: "Mission not found" };
    if (!mission.completed) return { success: false, message: "Mission not completed yet" };
    if (mission.claimed) return { success: false, message: "Reward already claimed" };

    // Atomic update to prevent duplicate XP claim race conditions
    const updatedRecord = await UserMission.findOneAndUpdate(
      {
        _id: record._id,
        "missions.type": missionType,
        "missions.claimed": false,
      },
      {
        $set: { "missions.$.claimed": true },
      },
      { new: true }
    );

    if (!updatedRecord) {
      return { success: false, message: "Reward already claimed" };
    }

    // Check if all claimed and update flag
    if (updatedRecord.missions.every((m) => m.claimed)) {
      await UserMission.findByIdAndUpdate(record._id, { $set: { allClaimed: true } });
    }

    // Award XP
    const missionDef = DAILY_MISSIONS.find((m) => m.type === missionType);
    const xpResult = await awardXP(userId, "COMPLETE_MISSION");

    return {
      success: true,
      message: `Claimed ${missionDef?.xpReward || 25} XP!`,
      xp: xpResult,
    };
  } catch (err) {
    logger.error("Failed to claim mission reward", { userId, missionType, error: (err as Error).message });
    return { success: false, message: "Failed to claim reward" };
  }
}

/**
 * Get today's missions for a user.
 */
export async function getTodayMissions(userId: string) {
  try {
    const record = await initTodayMissions(userId);
    return {
      date: record.date,
      missions: record.missions,
      allCompleted: record.allCompleted,
      allClaimed: record.allClaimed,
    };
  } catch (err) {
    logger.error("Failed to get missions", { userId, error: (err as Error).message });
    return { date: getToday(), missions: DAILY_MISSIONS.map((m) => ({ ...m, current: 0, completed: false, claimed: false })), allCompleted: false, allClaimed: false };
  }
}
