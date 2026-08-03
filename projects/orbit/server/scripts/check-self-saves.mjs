import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.log("no MONGO_URI");
  process.exit(1);
}

await mongoose.connect(uri);

const db = mongoose.connection.db;
const users = db.collection("users");
const posts = db.collection("posts");
const saves = db.collection("saves");
const reposts = db.collection("reposts");

// Find users who have posts
const allUsers = await users
  .find({}, { projection: { username: 1, fullName: 1 } })
  .limit(10)
  .toArray();

console.log("users sample:", allUsers.map((u) => u.username));

for (const u of allUsers) {
  const userPostIds = (
    await posts
      .find({ author: u._id })
      .project({ _id: 1 })
      .toArray()
  ).map((p) => p._id);

  const mySaves = await saves.countDocuments({ user: u._id });
  const selfSaves = await saves.countDocuments({
    user: u._id,
    post: { $in: userPostIds },
  });
  const myReposts = await reposts.countDocuments({ user: u._id });
  const selfReposts = await reposts.countDocuments({
    user: u._id,
    post: { $in: userPostIds },
  });

  console.log(u.username, {
    posts: userPostIds.length,
    saves: mySaves,
    selfSaves,
    reposts: myReposts,
    selfReposts,
  });
}

process.exit(0);
