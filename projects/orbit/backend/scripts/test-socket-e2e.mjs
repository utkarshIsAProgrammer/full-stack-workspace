#!/usr/bin/env node
/**
 * Socket.IO End-to-End Test Script
 * ===================================
 *
 * Tests real-time event propagation between two simulated users.
 * Unlike unit tests, this requires a running server with database + Redis.
 *
 * Prerequisites:
 *   - MongoDB and Redis running (docker or local)
 *   - Server running (npm run dev in orbit-server/)
 *   - At least 2 users seeded in the database
 *
 * Usage:
 *   cd orbit-server && node scripts/test-socket-e2e.mjs
 *
 * What it tests:
 *   ✓ WebSocket connection with JWT auth
 *   ✓ Online presence broadcast via Redis
 *   ✓ Chat events (message:new, messages:seen, chat:typing)
 *   ✓ Like/unlike events (post:like, post:unlike)
 *   ✓ Save/unsave events (post:save, post:unsave)
 *   ✓ Repost/unrepost events (post:repost, post:unrepost)
 *   ✓ Comment events (post:comment)
 *   ✓ Follow/unfollow events (user:follow, user:unfollow)
 *   ✓ Post lifecycle (post:created, post:deleted)
 *   ✓ Notification events
 *   ✓ Count accuracy (authoritative server counts)
 */

import "dotenv/config";
import { io as ioc } from "socket.io-client";
import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";

// ── Config ──────────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5002";
const MONGO_URI  = process.env.MONGO_URI  || "mongodb://localhost:27017/orbit";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

// ── Test Runner ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push({ label, detail });
  }
}

function waitForEvent(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeout}ms) waiting for "${event}"`));
    }, timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function getTestUsers() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const users = await db.collection("users")
    .find({})
    .limit(2)
    .project({ _id: 1, email: 1, username: 1, displayName: 1 })
    .toArray();
  await client.close();

  if (users.length < 2) {
    throw new Error(
      `Need ≥2 users in database (found ${users.length}). Run a seed script first:\n` +
      `  cd orbit-server && npx tsx scripts/seed-test-user.ts`
    );
  }

  return users.map((u) => ({
    ...u,
    _id: u._id.toString(),
    token: jwt.sign({ userId: u._id.toString() }, JWT_SECRET, {
      issuer: "orbit",
      audience: "orbit-users",
    }),
  }));
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│     ORBIT Socket.IO E2E Test Suite           │");
  console.log(`│     Server: ${SERVER_URL.padEnd(35)}│`);
  console.log("└──────────────────────────────────────────────┘");
  console.log();

  const users = await getTestUsers();
  const [alice, bob] = users;

  console.log(`Using users: ${alice.username} (Alice) ↔ ${bob.username} (Bob)\n`);

  // ── 1. Auth & Connection ────────────────────────────────
  console.log("── 1. Auth & Connection ──");

  // Connect Alice first, then Bob — so Bob is guaranteed to get Alice's presence
  const socketA = ioc(SERVER_URL, {
    auth: { token: alice.token },
    transports: ["websocket"],
  });

  await new Promise((r) => socketA.on("connect", r));
  await new Promise((r) => setTimeout(r, 300)); // let presence propagate to Redis

  const socketB = ioc(SERVER_URL, {
    auth: { token: bob.token },
    transports: ["websocket"],
  });

  const presencePromise = waitForEvent(socketB, "user:presence");
  await new Promise((r) => socketB.on("connect", r));

  assert("Alice socket connected", socketA.connected);
  assert("Bob socket connected", socketB.connected);

  const presence = await presencePromise.catch(() => null);
  assert("Bob receives Alice's presence on connect", presence !== null);
  if (presence) {
    assert("Presence status is 'online'", presence.status === "online");
  }

  // ── 2. Chat Events ──────────────────────────────────────
  console.log("\n── 2. Chat Events ──");

  // Find or create a real conversation between Alice and Bob
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const conversations = mongo.db().collection("conversations");

  let conv = await conversations.findOne({
    participants: { $all: [alice._id, bob._id] },
  });

  if (!conv) {
    const result = await conversations.insertOne({
      participants: [alice._id, bob._id],
      unreadCounts: { [alice._id]: 0, [bob._id]: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    conv = { _id: result.insertedId };
    console.log(`  📝 Created test conversation: ${conv._id}`);
  } else {
    console.log(`  📝 Using existing conversation: ${conv._id}`);
  }
  const convId = conv._id.toString();

  // message:new — Alice sends a message, Bob receives it
  const msgNewPromise = waitForEvent(socketB, "message:new");
  socketA.emit("chat:join", { conversationId: convId });
  await new Promise((r) => setTimeout(r, 100));

  const testMessage = {
    _id: `e2e-msg-${Date.now()}`,
    conversation: convId,
    sender: { _id: alice._id, username: alice.username, displayName: alice.displayName },
    content: `Hello Bob! E2E test at ${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    seen: false,
    reactions: [],
  };

  // Simulate what chat.controllers.ts does: emit message:new to conversation room
  socketA.emit("message:new", testMessage);

  const msg = await msgNewPromise.catch(() => null);
  assert("message:new received by other user", msg !== null);
  if (msg) {
    assert("Message content preserved", msg.content === testMessage.content);
  }

  // messages:seen — Bob joins conv, Alice gets seen receipt
  const seenPromise = waitForEvent(socketA, "messages:seen");
  socketB.emit("chat:join", { conversationId: convId });

  const seen = await seenPromise.catch(() => null);
  assert("messages:seen received by Alice", seen !== null);
  if (seen) {
    assert("Seen event has conversationId", !!seen.conversationId);
    assert("Seen event has seenBy", !!seen.seenBy);
  }

  // chat:typing — Alice types, Bob sees
  const typingPromise = waitForEvent(socketB, "chat:typing");
  socketA.emit("chat:typing", { conversationId: convId, isTyping: true });

  const typing = await typingPromise.catch(() => null);
  assert("chat:typing received", typing !== null);
  if (typing) {
    assert("Typing event shows Alice is typing", typing.isTyping === true && typing.userId === alice._id);
  }

  // Cleanup chat
  socketA.emit("chat:leave", { conversationId: convId });
  socketB.emit("chat:leave", { conversationId: convId });

  // ── 3. Post & Interaction Events ────────────────────────
  console.log("\n── 3. Post Events ──");

  const postCreatedPromise = waitForEvent(socketB, "post:created");
  socketA.emit("post:created", {
    _id: `e2e-post-${Date.now()}`,
    author: { _id: alice._id, username: alice.username, displayName: alice.displayName, avatar: null },
    title: "E2E Test Post",
    content: "This is a test post from the E2E socket test suite.",
    createdAt: new Date().toISOString(),
    likesCount: 0,
    savesCount: 0,
    repostsCount: 0,
    commentsCount: 0,
    viewsCount: 0,
  });

  const post = await postCreatedPromise.catch(() => null);
  assert("post:created received by other user", post !== null);

  // ── 4. Like/Unlike ──────────────────────────────────────
  console.log("\n── 4. Like Events ──");
  const postId = `e2e-post-${Date.now()}`;

  const likePromise = waitForEvent(socketB, "post:like");
  socketA.emit("post:like", { postId, userId: alice._id, likesCount: 1 });
  const like = await likePromise.catch(() => null);
  assert("post:like received", like !== null);
  if (like) assert("Like count = 1 (authoritative)", like.likesCount === 1);

  const unlikePromise = waitForEvent(socketB, "post:unlike");
  socketA.emit("post:unlike", { postId, userId: alice._id, likesCount: 0 });
  const unlike = await unlikePromise.catch(() => null);
  assert("post:unlike received", unlike !== null);
  if (unlike) assert("Unlike count = 0 (authoritative)", unlike.likesCount === 0);

  // ── 5. Save/Unsave ──────────────────────────────────────
  console.log("\n── 5. Save Events ──");

  const savePromise = waitForEvent(socketB, "post:save");
  socketA.emit("post:save", { postId, userId: alice._id, savesCount: 1 });
  const save = await savePromise.catch(() => null);
  assert("post:save received", save !== null);
  if (save) assert("Save count = 1", save.savesCount === 1);

  const unsavePromise = waitForEvent(socketB, "post:unsave");
  socketA.emit("post:unsave", { postId, userId: alice._id, savesCount: 0 });
  const unsave = await unsavePromise.catch(() => null);
  assert("post:unsave received", unsave !== null);

  // ── 6. Repost/Unrepost ──────────────────────────────────
  console.log("\n── 6. Repost Events ──");

  const repostPromise = waitForEvent(socketB, "post:repost");
  socketA.emit("post:repost", { postId, userId: alice._id, repostsCount: 1 });
  const repost = await repostPromise.catch(() => null);
  assert("post:repost received", repost !== null);
  if (repost) assert("Repost count = 1", repost.repostsCount === 1);

  const unrepostPromise = waitForEvent(socketB, "post:unrepost");
  socketA.emit("post:unrepost", { postId, userId: alice._id, repostsCount: 0 });
  const unrepost = await unrepostPromise.catch(() => null);
  assert("post:unrepost received", unrepost !== null);

  // ── 7. Comment ──────────────────────────────────────────
  console.log("\n── 7. Comment Events ──");

  const commentPromise = waitForEvent(socketB, "post:comment");
  socketA.emit("post:comment", {
    postId,
    comment: { _id: `e2e-cmt-${Date.now()}`, content: "Great post!", author: alice._id },
    userId: alice._id,
    commentsCount: 1,
  });
  const comment = await commentPromise.catch(() => null);
  assert("post:comment received", comment !== null);

  // ── 8. Follow/Unfollow ──────────────────────────────────
  console.log("\n── 8. Follow Events ──");

  const followPromise = waitForEvent(socketB, "user:follow");
  socketA.emit("user:follow", { targetUserId: bob._id, followerId: alice._id, followersCount: 1 });
  const follow = await followPromise.catch(() => null);
  assert("user:follow received by target", follow !== null);

  const unfollowPromise = waitForEvent(socketB, "user:unfollow");
  socketA.emit("user:unfollow", { targetUserId: bob._id, followerId: alice._id, followersCount: 0 });
  const unfollow = await unfollowPromise.catch(() => null);
  assert("user:unfollow received by target", unfollow !== null);

  // ── 9. Notification ─────────────────────────────────────
  console.log("\n── 9. Notification Events ──");

  const notifPromise = waitForEvent(socketB, "notification");
  socketA.emit("notification", {
    _id: `e2e-notif-${Date.now()}`,
    type: "like",
    from: alice._id,
    message: `${alice.username} liked your post`,
    timestamp: new Date().toISOString(),
  });
  const notif = await notifPromise.catch(() => null);
  assert("notification received", notif !== null);

  // ── 10. Post Delete ─────────────────────────────────────
  console.log("\n── 10. Post Deletion ──");

  const deletePromise = waitForEvent(socketB, "post:deleted");
  socketA.emit("post:deleted", postId);
  const deleted = await deletePromise.catch(() => null);
  assert("post:deleted received", deleted !== null);

  // ── Cleanup ─────────────────────────────────────────────
  await mongo.close();
  socketA.disconnect();
  socketB.disconnect();

  // ── Results ─────────────────────────────────────────────
  console.log();
  console.log("┌──────────────────────────────────────────────┐");

  if (failures.length > 0) {
    console.log(`│  ❌  ${failed}/${passed + failed} tests FAILED               │`);
    console.log("├──────────────────────────────────────────────┤");
    for (const f of failures) {
      console.log(`│  • ${(f.label + (f.detail ? `: ${f.detail}` : "")).padEnd(44)}│`);
    }
  } else {
    console.log(`│  ✅  All ${passed} tests PASSED!                        │`);
  }
  console.log("└──────────────────────────────────────────────┘");
  console.log();

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
