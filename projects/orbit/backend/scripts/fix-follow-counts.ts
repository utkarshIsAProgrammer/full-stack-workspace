/**
 * One-time script to recalculate followersCount and followingCount
 * for all users based on actual Follow records in the database.
 *
 * Usage: npx tsx scripts/fix-follow-counts.ts
 */

import mongoose from "mongoose";
import { User } from "../src/models/user.model";
import Follow from "../src/models/follow.model";
import { env } from "../src/configs/env";

async function fixFollowCounts() {
  console.log("Connecting to database...");
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected!\n");

  const users = await User.find({}).select("_id username followersCount followingCount");
  console.log(`Found ${users.length} users. Recalculating counts...\n`);

  let fixedCount = 0;

  for (const user of users) {
    const actualFollowers = await Follow.countDocuments({ following: user._id });
    const actualFollowing = await Follow.countDocuments({ follower: user._id });

    const needsFix =
      user.followersCount !== actualFollowers ||
      user.followingCount !== actualFollowing;

    if (needsFix) {
      console.log(
        `  @${user.username}: followers ${user.followersCount} → ${actualFollowers}, following ${user.followingCount} → ${actualFollowing}`
      );
      await User.updateOne(
        { _id: user._id },
        { $set: { followersCount: actualFollowers, followingCount: actualFollowing } }
      );
      fixedCount++;
    }
  }

  console.log(`\nDone! Fixed ${fixedCount} user(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

fixFollowCounts().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
