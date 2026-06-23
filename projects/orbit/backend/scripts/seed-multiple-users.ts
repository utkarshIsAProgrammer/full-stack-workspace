/**
 * Seed script: creates 3 test users and some posts for users 1 & 2 with Unsplash images.
 *
 * Usage (from project root):
 *   npx tsx backend/scripts/seed-multiple-users.ts
 *
 * OR (from backend/ directory):
 *   npx tsx scripts/seed-multiple-users.ts
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
import { config } from "dotenv";
import { resolve } from "path";

// Try loading .env — script can be run from project root or backend/
const possiblePaths = [
  resolve(process.cwd(), "backend/.env"),
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
];
for (const p of possiblePaths) {
  config({ path: p });
}

// Unsplash random image URLs for quick testing
const randomProfilePics = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
];

const randomBannerImages = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=400&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&h=400&fit=crop",
];

const randomPostImages = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&h=600&fit=crop",
];

async function seed() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set — ensure .env exists at project root");
    console.error("CWD:", process.cwd());
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const usersCol = db.collection("users");
  const postsCol = db.collection("posts");

  const users = [
    {
      username: "alice",
      fullName: "Alice Smith",
      email: "alice@orbit.app",
      password: await bcrypt.hash("Test1234!", 10),
      gender: "female",
      bio: "Alice's bio here!",
      profilePic: { url: randomProfilePics[0], public_id: "alice_profile" },
      bannerImage: { url: randomBannerImages[0], public_id: "alice_banner" },
      followersCount: 0,
      followingCount: 0,
      sharesCount: 0,
      viewsCount: 0,
      pinnedPosts: [],
      loginAttempts: 0,
      lockUntil: null,
      createdAt: new Date(),
    },
    {
      username: "bob",
      fullName: "Bob Johnson",
      email: "bob@orbit.app",
      password: await bcrypt.hash("Test1234!", 10),
      gender: "male",
      bio: "Bob's bio here!",
      profilePic: { url: randomProfilePics[1], public_id: "bob_profile" },
      bannerImage: { url: randomBannerImages[1], public_id: "bob_banner" },
      followersCount: 0,
      followingCount: 0,
      sharesCount: 0,
      viewsCount: 0,
      pinnedPosts: [],
      loginAttempts: 0,
      lockUntil: null,
      createdAt: new Date(),
    },
    {
      username: "charlie",
      fullName: "Charlie Brown",
      email: "charlie@orbit.app",
      password: await bcrypt.hash("Test1234!", 10),
      gender: "male",
      bio: "Charlie's bio here!",
      profilePic: { url: randomProfilePics[2], public_id: "charlie_profile" },
      bannerImage: { url: randomBannerImages[2], public_id: "charlie_banner" },
      followersCount: 0,
      followingCount: 0,
      sharesCount: 0,
      viewsCount: 0,
      pinnedPosts: [],
      loginAttempts: 0,
      lockUntil: null,
      createdAt: new Date(),
    },
  ];

  const createdUsers: any[] = [];

  for (const user of users) {
    // First check if user exists
    const existingUser = await usersCol.findOne({ email: user.email });

    if (existingUser) {
      // Update existing user
      await usersCol.updateOne(
        { email: user.email },
        { $set: { profilePic: user.profilePic, bannerImage: user.bannerImage } }
      );
      console.log(`Updated existing user: ${user.email}`);
      createdUsers.push(existingUser);
    } else {
      // Insert new user
      const result = await usersCol.insertOne(user);
      console.log(`Created user: ${user.email} / Test1234!`);
      createdUsers.push({ ...user, _id: result.insertedId });
    }
  }

  console.log("Created/Retrieved users:", createdUsers.map(u => u.username));

  // Create posts for user 0 and user 1
  const [alice, bob, charlie] = createdUsers;

  const posts = [
    {
      title: "Hello from Alice!",
      content: "This is my first post on Orbit! #firstpost #orbit",
      hashtags: ["firstpost", "orbit"],
      author: alice._id,
      images: [{ url: randomPostImages[0], public_id: "alice_post1" }],
      image: { url: randomPostImages[0], public_id: "alice_post1" },
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      savesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      likedBy: [],
      savedBy: [],
      repostedBy: [],
      slug: "hello-from-alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      title: "Another post!",
      content: "Here's another post from me! #hello #orbit",
      hashtags: ["hello", "orbit"],
      author: alice._id,
      images: [{ url: randomPostImages[1], public_id: "alice_post2" }],
      image: { url: randomPostImages[1], public_id: "alice_post2" },
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      savesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      likedBy: [],
      savedBy: [],
      repostedBy: [],
      slug: "another-post",
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      updatedAt: new Date(Date.now() - 3600000),
    },
    {
      title: "Bob's first post!",
      content: "Hi everyone! I'm Bob! #newuser #orbit",
      hashtags: ["newuser", "orbit"],
      author: bob._id,
      images: [{ url: randomPostImages[2], public_id: "bob_post1" }],
      image: { url: randomPostImages[2], public_id: "bob_post1" },
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      savesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      likedBy: [],
      savedBy: [],
      repostedBy: [],
      slug: "bobs-first-post",
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      updatedAt: new Date(Date.now() - 7200000),
    },
  ];

  for (const post of posts) {
    const existingPost = await postsCol.findOne({ slug: post.slug });
    if (existingPost) {
      await postsCol.updateOne(
        { slug: post.slug },
        { $set: { images: post.images, image: post.image } }
      );
      console.log(`Updated existing post: ${post.title}`);
    } else {
      await postsCol.insertOne(post);
      console.log(`Created post: ${post.title}`);
    }
  }

  // Update user's post counts
  const alicePostCount = await postsCol.countDocuments({ author: alice._id });
  const bobPostCount = await postsCol.countDocuments({ author: bob._id });
  const charliePostCount = await postsCol.countDocuments({ author: charlie._id });

  await usersCol.updateOne({ _id: alice._id }, { $set: { postsCount: alicePostCount } });
  await usersCol.updateOne({ _id: bob._id }, { $set: { postsCount: bobPostCount } });
  await usersCol.updateOne({ _id: charlie._id }, { $set: { postsCount: charliePostCount } });

  await mongoose.disconnect();
  console.log("Done!");
  console.log("\nUsers created/updated:");
  console.log("  Alice: alice@orbit.app / Test1234!");
  console.log("  Bob: bob@orbit.app / Test1234!");
  console.log("  Charlie: charlie@orbit.app / Test1234!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
