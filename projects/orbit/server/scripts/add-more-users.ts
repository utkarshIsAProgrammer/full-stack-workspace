const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
import { config } from "dotenv";
import { resolve } from "path";

const possiblePaths = [
  resolve(process.cwd(), "backend/.env"),
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
];
for (const p of possiblePaths) {
  config({ path: p });
}

const random = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const IDENTITIES = [
  { name: "Tech & Design", tags: ["tech", "design", "ui", "ux", "coding", "webdev", "ai", "startup", "product"] },
  { name: "Food & Travel", tags: ["food", "travel", "wanderlust", "foodie", "cooking", "photography"] },
  { name: "Music & Art", tags: ["art", "music", "artist", "painting", "photography", "creative", "design"] },
  { name: "Fitness & Wellness", tags: ["fitness", "wellness", "yoga", "gym", "health", "workout"] },
  { name: "Gaming & Entertainment", tags: ["gaming", "entertainment", "anime", "movies", "streaming"] },
  { name: "Finance & Business", tags: ["finance", "business", "entrepreneur", "marketing", "crypto", "stockmarket"] },
  { name: "Science & Nature", tags: ["science", "nature", "environment", "sustainability", "animals", "space"] },
  { name: "Fashion & Lifestyle", tags: ["fashion", "lifestyle", "style", "aesthetic", "minimalist"] },
];

const INDIAN_NAMES = [
  { fullName: "Aarav Sharma", gender: "male" },
  { fullName: "Vihaan Patel", gender: "male" },
  { fullName: "Ananya Singh", gender: "female" },
  { fullName: "Diya Gupta", gender: "female" },
  { fullName: "Ishaan Mehta", gender: "male" },
  { fullName: "Aisha Khan", gender: "female" },
  { fullName: "Kabir Joshi", gender: "male" },
  { fullName: "Mira Nair", gender: "female" },
  { fullName: "Arjun Iyer", gender: "male" },
  { fullName: "Naina Reddy", gender: "female" },
  { fullName: "Pranav Desai", gender: "male" },
  { fullName: "Riya Kapoor", gender: "female" },
  { fullName: "Atharv Kulkarni", gender: "male" },
  { fullName: "Sana Malhotra", gender: "female" },
  { fullName: "Dev Shah", gender: "male" },
  { fullName: "Anika Verma", gender: "female" },
  { fullName: "Aditya Saxena", gender: "male" },
  { fullName: "Myra Trivedi", gender: "female" },
  { fullName: "Kunal Jain", gender: "male" },
  { fullName: "Zara Ahmed", gender: "female" },
  { fullName: "Rohan Sinha", gender: "male" },
  { fullName: "Anvi Bhatia", gender: "female" },
  { fullName: "Manan Bhatt", gender: "male" },
  { fullName: "Navya Bansal", gender: "female" },
  { fullName: "Yash Arora", gender: "male" },
  { fullName: "Kiara Kaur", gender: "female" },
  { fullName: "Hrithik Chandra", gender: "male" },
  { fullName: "Aarohi Soni", gender: "female" },
  { fullName: "Vivaan Malviya", gender: "male" },
  { fullName: "Samaira Goenka", gender: "female" },
  { fullName: "Arnav Saxena", gender: "male" },
  { fullName: "Anushka Negi", gender: "female" },
  { fullName: "Kabir Talwar", gender: "male" },
  { fullName: "Sneha Sabharwal", gender: "female" },
  { fullName: "Ayaan Sethi", gender: "male" },
  { fullName: "Ishita Sahni", gender: "female" },
];

const FOREIGN_NAMES = [
  { fullName: "Liam Anderson", gender: "male" },
  { fullName: "Olivia Williams", gender: "female" },
  { fullName: "Noah Johnson", gender: "male" },
  { fullName: "Emma Brown", gender: "female" },
  { fullName: "Oliver Jones", gender: "male" },
  { fullName: "Ava Garcia", gender: "female" },
  { fullName: "Elijah Miller", gender: "male" },
  { fullName: "Charlotte Davis", gender: "female" },
  { fullName: "James Wilson", gender: "male" },
  { fullName: "Amelia Martinez", gender: "female" },
  { fullName: "Benjamin Rodriguez", gender: "male" },
  { fullName: "Sophia Hernandez", gender: "female" },
  { fullName: "Lucas Lopez", gender: "male" },
  { fullName: "Mia Gonzalez", gender: "female" },
  { fullName: "Mason Wright", gender: "male" },
  { fullName: "Isabella Thompson", gender: "female" },
  { fullName: "Logan White", gender: "male" },
  { fullName: "Aria Jackson", gender: "female" },
  { fullName: "Alexander Harris", gender: "male" },
  { fullName: "Scarlett Martin", gender: "female" },
  { fullName: "Sebastian Lee", gender: "male" },
  { fullName: "Harper Thompson", gender: "female" },
  { fullName: "Mateo Lewis", gender: "male" },
  { fullName: "Evelyn Walker", gender: "female" },
  { fullName: "Jack Hall", gender: "male" },
  { fullName: "Luna Allen", gender: "female" },
  { fullName: "Owen Young", gender: "male" },
  { fullName: "Camila King", gender: "female" },
  { fullName: "Wyatt Scott", gender: "male" },
  { fullName: "Layla Green", gender: "female" },
  { fullName: "Carter Adams", gender: "male" },
  { fullName: "Zoe Nelson", gender: "female" },
  { fullName: "Julian Baker", gender: "male" },
  { fullName: "Nora Hill", gender: "female" },
  { fullName: "Levi Ramirez", gender: "male" },
  { fullName: "Hannah Carter", gender: "female" },
];

const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "protonmail.com"];
const PASSWORDS = ["Password123!", "SecurePass456@", "MyPass789#", "Secret101$", "StrongPass202%", "Secure2025^", "MySecret303&", "Secret404*"];

const MALE_PROFILE_PICS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=400",
];

const FEMALE_PROFILE_PICS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=400",
];

const BANNERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1441974231536-cf4a89f5ebd38?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=1200",
];

const POST_IMAGES = [
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-148071437859-2810bbdac877?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=800",
];

const CONTENT_TEMPLATES: Record<string, { titles: string[], contents: string[] }> = {
  "Tech & Design": {
    titles: ["New UI component library just dropped!", "Exploring glassmorphism design trends 2025", "Just shipped a new feature using WebGL", "Design system v2 is now live", "Building better user research findings", "Figma plugin I can't live without", "My product management tips for devs", "Responsive design best practices", "Exploring AI-powered design tools"],
    contents: [
      "Just released a new open-source UI component library focusing on accessibility and performance! Check it out on GitHub. Has over 50 components out of the box, all fully customizable. #tech #ui #opensource",
      "Glassmorphism is making a huge comeback in 2025! What are your thoughts on the trend? Personally loving the layered, translucent look with subtle animations #design",
      "WebGL-powered interactive backgrounds add such an immersive feel! Spent 3 days optimizing performance testing, totally worth it 🚀",
      "Design system v2 features dark mode, better accessibility, and improved performance! Swipe to see before and after shots! #product",
      "User research really pays off! We cut bounce rate by 20% by simplifying the onboarding flow! #research",
      "This Figma plugin saves 5 hours of my week! Highly recommend #productivity",
      "Tips for devs transitioning to product management: listen more than you talk",
      "Responsive design is not optional anymore, it's a must! Here's how we build our layouts #design",
      "AI is changing design faster than we think! Here are 3 tools that will change your workflow #ai #design",
    ]
  },
  "Food & Travel": {
    titles: ["Best street food in Bangkok!", "Hiking the Swiss Alps", "Homemade pasta recipe", "New cafe in Brooklyn", "Travel guide to Tokyo"],
    contents: [
      "Bangkok street food is absolutely incredible! Had the best pad thai ever 🥢 #travel #foodie",
      "Views from the top of the Swiss Alps! Fresh air, no wifi, perfect weekend! #nature",
      "Homemade pasta from scratch is easier than you think! Here's how I do it #cooking",
      "New little cafe in Brooklyn with the most delicious coffee and pastries! ☕️ #foodie",
      "My ultimate travel guide to Tokyo! Where to eat, stay, and explore! #travel",
    ]
  },
  "Music & Art": {
    titles: ["New single out now!", "Live painting session", "Vinyl collection update", "New playlist for focus", "My latest digital art"],
    contents: [
      "New single just dropped on all streaming platforms! Check it out! #music",
      "Live painting stream was so much fun! Thanks for tuning in! #art",
      "Just added a rare pressing to the vinyl collection! 📀 #vinyl #music",
      "New study/focus playlist with lo-fi beats, 3 hours! Perfect for coding or reading! #music",
      "Latest digital art piece using AI tools! #art #digitalart",
    ]
  },
  "Fitness & Wellness": {
    titles: ["Morning yoga flow", "Meal prep for the week", "New gym PR!", "Wellness routine", "Favorite workout gear"],
    contents: [
      "Morning yoga to start the day off right! 🧘‍♀️ #yoga #wellness",
      "Meal prep for the entire week! Here's how I do it! #fitness #health",
      "Hit a new PR today! Feels amazing! #gym #fitness",
      "My wellness routine includes meditation, journaling and stretching! #wellness",
      "This workout gear is a game changer! #fitness",
    ]
  },
  "Gaming & Entertainment": {
    titles: ["New game release!", "Anime recommendations", "Movie night pick", "Gaming setup update", "Streaming tonight!"],
    contents: [
      "New game just dropped! It's so good! Already 10 hours in! #gaming",
      "Anime recommendations for this weekend! #anime",
      "Movie night pick! What are you watching tonight? #movies",
      "Just updated the gaming setup! RGB lights and new monitor! #gaming",
      "Streaming tonight at 8 PM! Come hang out! #streaming",
    ]
  },
  "Finance & Business": {
    titles: ["Market update", "Side hustle ideas", "Productivity tips", "Investment strategy", "How I budget"],
    contents: [
      "Market update for this week! Volatility up! #finance",
      "Side hustle ideas that actually work! #business",
      "Productivity tips for entrepreneurs! #productivity",
      "Long term investment strategy! #investing",
      "How I budget every month! #finance",
    ]
  },
  "Science & Nature": {
    titles: ["Astronomy update", "Sustainability tips", "Wildlife photography", "Science news", "Hiking adventure"],
    contents: [
      "Astronomy update: new telescope images from James Webb! #space",
      "Sustainability tips for everyday life! #sustainability",
      "Wildlife photography from my hike last weekend! #photography",
      "Science news of the week! #science",
      "Hiking adventure this weekend! Saw so many cool animals! #nature",
    ]
  },
  "Fashion & Lifestyle": {
    titles: ["OOTD", "Home decor ideas", "Aesthetic finds", "Capsule wardrobe", "Lifestyle changes"],
    contents: [
      "Outfit of the day! Loving this minimalist look! #fashion",
      "Home decor ideas for small spaces! #lifestyle",
      "Aesthetic finds from my weekend shopping trip! #shopping",
      "Capsule wardrobe essentials! #fashion",
      "Small lifestyle changes that made a big difference! #lifestyle",
    ]
  },
};

const COMMENT_TEMPLATES = [
  "This is amazing!", "Love this!", "Great post!", "So inspiring!", "Can't wait to try this!",
  "Wow, beautiful!", "Great content!", "Love your style!", "This is so cool!", "Thanks for sharing!",
];

async function seedMore() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set — ensure .env exists at project root");
    console.error("CWD:", process.cwd());
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  const existingUsers: any[] = await db.collection("users").find().toArray();
  const existingPosts: any[] = await db.collection("posts").find().toArray();

  console.log("Creating 29 new users...");
  const users: any[] = [];
  const numUsers = 29;

  for (let i = 0; i < numUsers; i++) {
    const nameObj = random([...INDIAN_NAMES, ...FOREIGN_NAMES]);
    const identity = random(IDENTITIES);
    const usernameBase = nameObj.fullName.toLowerCase().replace(/[^a-z]/g, "");
    const username = `${usernameBase}${randomInt(1000, 9999)}`;
    const email = `${username}@${random(DOMAINS)}`;
    const password = random(PASSWORDS);
    const profilePic = nameObj.gender === "male" ? random(MALE_PROFILE_PICS) : random(FEMALE_PROFILE_PICS);
    const createdAt = new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000);

    users.push({
      username,
      fullName: nameObj.fullName,
      email,
      password: await bcrypt.hash(password, 10),
      gender: nameObj.gender,
      bio: `${identity.name} enthusiast! Sharing my journey and passion! #${identity.tags.join(" #")}`,
      identity,
      profilePic: { url: profilePic, public_id: "" },
      bannerImage: { url: random(BANNERS), public_id: "" },
      followersCount: 0,
      followingCount: 0,
      sharesCount: randomInt(0, 20),
      viewsCount: randomInt(50, 300),
      isEmailVerified: true,
      createdAt,
    });
  }

  const userResult = await db.collection("users").insertMany(users);
  const userDocs: any[] = Object.values(userResult.insertedIds).map((_id, index) => ({
    _id,
    ...users[index],
  }));
  console.log(`Created ${userDocs.length} new users!`);

  console.log("Creating posts for new users...");
  const posts: any[] = [];
  const existingSlugs = new Set(existingPosts.map(p => p.slug));

  for (let i = 0; i < userDocs.length; i++) {
    const user = userDocs[i];
    const numPosts = randomInt(0, 6);

    for (let j = 0; j < numPosts; j++) {
      const identity = user.identity;
      const contentTemplate = CONTENT_TEMPLATES[identity.name]!;
      const title = random(contentTemplate.titles);
      const content = random(contentTemplate.contents);
      const numImages = randomInt(0, 2);
      const images = Array.from({ length: numImages }, () => ({
        url: random(POST_IMAGES),
        public_id: "",
        alt: "",
      }));

      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let slug = baseSlug;
      let counter = 1;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter++}`;
      }
      existingSlugs.add(slug);

      const createdAt = new Date(user.createdAt.getTime() + randomInt(1, 10) * 24 * 60 * 60 * 1000);

      posts.push({
        title,
        slug,
        content,
        hashtags: [...identity.tags.slice(0, 5)],
        images,
        author: user._id,
        repostsCount: randomInt(0, 10),
        savesCount: randomInt(0, 25),
        likesCount: randomInt(0, 40),
        commentsCount: randomInt(0, 12),
        sharesCount: randomInt(0, 15),
        viewsCount: randomInt(100, 500),
        createdAt,
      });
    }
  }

  const postResult = await db.collection("posts").insertMany(posts);
  const postDocs: any[] = Object.values(postResult.insertedIds).map((_id, index) => ({
    _id,
    ...posts[index],
  }));
  const allPostIds = [...existingPosts.map(p => p._id), ...postDocs.map(p => p._id)];
  const allUserIds = [...existingUsers.map(u => u._id), ...userDocs.map(u => u._id)];
  console.log(`Created ${postDocs.length} new posts!`);

  console.log("Creating comments...");
  const comments: any[] = [];
  const allUsers = [...existingUsers, ...userDocs];

  for (const post of postDocs) {
    const numComments = randomInt(0, 15);
    for (let i = 0; i < numComments; i++) {
      const author = random(allUsers);
      const createdAt = new Date(post.createdAt.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000);
      comments.push({
        content: random(COMMENT_TEMPLATES),
        author: author._id,
        post: post._id,
        parent: null,
        likesCount: randomInt(0, 8),
        repliesCount: 0,
        createdAt,
      });
    }
  }

  if (comments.length > 0) {
    const commentResult = await db.collection("comments").insertMany(comments);
    console.log(`Created ${commentResult.insertedCount} comments!`);
  }

  console.log("Creating follows...");
  const follows: any[] = [];

  for (let i = 0; i < userDocs.length; i++) {
    const follower = userDocs[i];
    const numFollowing = randomInt(2, 20);

    const followingUserIds = allUserIds
      .filter(id => id.toString() !== follower._id.toString())
      .sort(() => 0.5 - Math.random())
      .slice(0, numFollowing);

    for (const followingId of followingUserIds) {
      const exists = await db.collection("follows").findOne({ follower: follower._id, following: followingId });
      if (!exists) {
        const createdAt = new Date(Math.max(follower.createdAt.getTime(),
          existingUsers.find(u => u._id.toString() === followingId.toString())?.createdAt.getTime() ||
          userDocs.find(u => u._id.toString() === followingId.toString())?.createdAt.getTime() ||
          Date.now()) + randomInt(1, 20) * 24 * 60 * 60 * 1000);
        follows.push({ follower: follower._id, following: followingId, createdAt });
      }
    }
  }

  for (let i = 0; i < Math.floor(existingUsers.length / 4); i++) {
    const follower = random(existingUsers);
    const numFollowing = randomInt(1, 5);
    const followingUserIds = userDocs
      .map(u => u._id)
      .sort(() => 0.5 - Math.random())
      .slice(0, numFollowing);

    for (const followingId of followingUserIds) {
      const exists = await db.collection("follows").findOne({ follower: follower._id, following: followingId });
      if (!exists) {
        const createdAt = new Date(Math.max(follower.createdAt.getTime(), userDocs.find(u => u._id.toString() === followingId.toString())!.createdAt.getTime()) + randomInt(1, 10) * 24 * 60 * 60 * 1000);
        follows.push({ follower: follower._id, following: followingId, createdAt });
      }
    }
  }

  if (follows.length > 0) {
    await db.collection("follows").insertMany(follows);
    console.log(`Created ${follows.length} follows!`);
  }

  console.log("Updating user follow counts...");
  const followAgg = await db.collection("follows").aggregate([
    { $group: { _id: "$follower", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of followAgg) {
    await db.collection("users").updateOne({ _id: agg._id }, { $set: { followingCount: agg.count } });
  }
  const followerAgg = await db.collection("follows").aggregate([
    { $group: { _id: "$following", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of followerAgg) {
    await db.collection("users").updateOne({ _id: agg._id }, { $set: { followersCount: agg.count } });
  }

  console.log("Updating post comment counts...");
  const commentAgg = await db.collection("comments").aggregate([
    { $group: { _id: "$post", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of commentAgg) {
    await db.collection("posts").updateOne({ _id: agg._id }, { $set: { commentsCount: agg.count } });
  }

  console.log("Creating likes...");
  const likes: any[] = [];
  for (const user of userDocs) {
    const numLikes = randomInt(2, 35);
    const likedPostIds = allPostIds.sort(() => 0.5 - Math.random()).slice(0, numLikes);
    for (const postId of likedPostIds) {
      const exists = await db.collection("likes").findOne({ author: user._id, post: postId });
      if (!exists) {
        const postCreatedAt = existingPosts.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() ||
          postDocs.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() || Date.now();
        const createdAt = new Date(Math.max(user.createdAt.getTime(), postCreatedAt) + randomInt(1, 5) * 24 * 60 * 60 * 1000);
        likes.push({ author: user._id, post: postId, createdAt });
      }
    }
  }

  for (let i = 0; i < Math.floor(existingUsers.length / 2); i++) {
    const user = random(existingUsers);
    const numLikes = randomInt(1, 15);
    const likedPostIds = postDocs.map(p => p._id).sort(() => 0.5 - Math.random()).slice(0, numLikes);
    for (const postId of likedPostIds) {
      const exists = await db.collection("likes").findOne({ author: user._id, post: postId });
      if (!exists) {
        const createdAt = new Date(Math.max(user.createdAt.getTime(), postDocs.find(p => p._id.toString() === postId.toString())!.createdAt.getTime()) + randomInt(1, 3) * 24 * 60 * 60 * 1000);
        likes.push({ author: user._id, post: postId, createdAt });
      }
    }
  }

  if (likes.length > 0) {
    await db.collection("likes").insertMany(likes);
    console.log(`Created ${likes.length} likes!`);
  }

  console.log("Updating post like counts...");
  const likeAgg = await db.collection("likes").aggregate([
    { $match: { post: { $ne: null } } },
    { $group: { _id: "$post", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of likeAgg) {
    await db.collection("posts").updateOne({ _id: agg._id }, { $set: { likesCount: agg.count } });
  }

  console.log("Creating saves...");
  const saves: any[] = [];
  for (const user of userDocs) {
    const numSaves = randomInt(1, 20);
    const savedPostIds = allPostIds.sort(() => 0.5 - Math.random()).slice(0, numSaves);
    for (const postId of savedPostIds) {
      const exists = await db.collection("saves").findOne({ user: user._id, post: postId });
      if (!exists) {
        const postCreatedAt = existingPosts.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() ||
          postDocs.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() || Date.now();
        const createdAt = new Date(Math.max(user.createdAt.getTime(), postCreatedAt) + randomInt(1, 7) * 24 * 60 * 60 * 1000);
        saves.push({ user: user._id, post: postId, folder: "General", createdAt });
      }
    }
  }

  if (saves.length > 0) {
    await db.collection("saves").insertMany(saves);
    console.log(`Created ${saves.length} saves!`);
  }

  console.log("Updating post save counts...");
  const saveAgg = await db.collection("saves").aggregate([
    { $group: { _id: "$post", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of saveAgg) {
    await db.collection("posts").updateOne({ _id: agg._id }, { $set: { savesCount: agg.count } });
  }

  console.log("Creating reposts...");
  const reposts: any[] = [];
  for (const user of userDocs) {
    const numReposts = randomInt(0, 10);
    const repostedPostIds = allPostIds.sort(() => 0.5 - Math.random()).slice(0, numReposts);
    for (const postId of repostedPostIds) {
      const exists = await db.collection("reposts").findOne({ user: user._id, post: postId });
      if (!exists) {
        const postCreatedAt = existingPosts.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() ||
          postDocs.find(p => p._id.toString() === postId.toString())?.createdAt.getTime() || Date.now();
        const createdAt = new Date(Math.max(user.createdAt.getTime(), postCreatedAt) + randomInt(1, 4) * 24 * 60 * 60 * 1000);
        reposts.push({ user: user._id, post: postId, createdAt });
      }
    }
  }

  if (reposts.length > 0) {
    await db.collection("reposts").insertMany(reposts);
    console.log(`Created ${reposts.length} reposts!`);
  }

  console.log("Updating post repost counts...");
  const repostAgg = await db.collection("reposts").aggregate([
    { $group: { _id: "$post", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of repostAgg) {
    await db.collection("posts").updateOne({ _id: agg._id }, { $set: { repostsCount: agg.count } });
  }

  console.log("Updating user post counts...");
  const postUserAgg = await db.collection("posts").aggregate([
    { $group: { _id: "$author", count: { $sum: 1 } } }
  ]).toArray();
  for (const agg of postUserAgg) {
    await db.collection("users").updateOne({ _id: agg._id }, { $set: { postsCount: agg.count } });
  }

  await mongoose.disconnect();
  console.log("Done!");
}

seedMore().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
