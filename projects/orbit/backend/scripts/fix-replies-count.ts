/**
 * One-time script to recalculate repliesCount for all comments
 * based on actual Comment documents where parent === comment._id.
 *
 * Usage: npx tsx scripts/fix-replies-count.ts
 */

import mongoose from "mongoose";
import Comment from "../src/models/comment.model";
import { env } from "../src/configs/env";

async function fixRepliesCount() {
  console.log("Connecting to database...");
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected!\n");

  const comments = await Comment.find({
    $or: [
      { repliesCount: { $exists: true } },
      { parent: { $exists: true } },
    ],
  }).select("_id repliesCount");

  console.log(`Checking ${comments.length} comments for stale repliesCount...\n`);

  let fixedCount = 0;

  for (const comment of comments) {
    const actualReplies = await Comment.countDocuments({ parent: comment._id });

    if (comment.repliesCount !== actualReplies) {
      console.log(
        `  Comment ${comment._id}: repliesCount ${comment.repliesCount} → ${actualReplies}`
      );
      await Comment.updateOne(
        { _id: comment._id },
        { $set: { repliesCount: actualReplies } }
      );
      fixedCount++;
    }
  }

  console.log(`\nDone! Fixed ${fixedCount} comment(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

fixRepliesCount().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
