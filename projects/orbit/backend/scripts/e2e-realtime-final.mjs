#!/usr/bin/env node
/**
 * ORBIT Real-Time E2E Test Suite — Final
 *
 * Tests real-time event propagation between two simulated users.
 * Uses child_process exec for HTTP calls (reliable) and socket.io-client for event listening.
 *
 * Prerequisites:
 *   - Server running on localhost:5006
 *   - Users seeded: alice@orbit.app, bob@orbit.app / Test1234!
 *
 * Usage:
 *   cd orbit-server && node scripts/e2e-realtime-final.mjs
 */

import { io as ioc } from "socket.io-client";
import { execSync } from "child_process";

const BASE = "http://localhost:5006";

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

function curl(method, path, token = "", body = "") {
  const auth = token ? `-H "Authorization: Bearer ${token}"` : "";
  const data = body ? `-H "Content-Type: application/json" -d '${body}'` : "";
  const cmd = `curl -s -X ${method} ${BASE}${path} ${auth} ${data}`;
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 10000 });
    return JSON.parse(out);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function waitForEvent(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout for "${event}"`)), timeout);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function waitAny(socket, events, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout for events: ${events.join(",")}`)), timeout);
    const cleanup = [];
    for (const ev of events) {
      const handler = (data) => {
        cleanup.forEach(([e, h]) => socket.off(e, h));
        clearTimeout(timer);
        resolve({ event: ev, data });
      };
      socket.once(ev, handler);
      cleanup.push([ev, handler]);
    }
  });
}

async function main() {
  console.log("\n┌──────────────────────────────────────────────────────┐");
  console.log("│        ORBIT Real-Time E2E Test Suite (Final)         │");
  console.log("└──────────────────────────────────────────────────────┘\n");

  // ── 1. Login ────────────────────────────────────────────
  console.log("── 1. Login ──");
  const aliceRes = curl("POST", "/api/auth/login", "", JSON.stringify({ usernameOrEmail: "alice@orbit.app", password: "Test1234!" }));
  const bobRes = curl("POST", "/api/auth/login", "", JSON.stringify({ usernameOrEmail: "bob@orbit.app", password: "Test1234!" }));
  assert("Alice login", aliceRes.success, aliceRes.message);
  assert("Bob login", bobRes.success, bobRes.message);

  const aliceToken = aliceRes.token;
  const bobToken = bobRes.token;
  const aliceId = aliceRes.user._id;
  const bobId = bobRes.user._id;

  // ── 2. Socket Connections ───────────────────────────────
  console.log("\n── 2. Socket Connections ──");
  const socketA = ioc(BASE, { auth: { token: aliceToken }, transports: ["websocket", "polling"], withCredentials: true });
  const socketB = ioc(BASE, { auth: { token: bobToken }, transports: ["websocket", "polling"], withCredentials: true });
  await Promise.all([
    new Promise((r) => socketA.on("connect", r)),
    new Promise((r) => socketB.on("connect", r)),
  ]);
  assert("Alice socket connected", socketA.connected);
  assert("Bob socket connected", socketB.connected);
  await new Promise((r) => setTimeout(r, 1000));

  // ── 3. Follow/Unfollow Events ───────────────────────────
  console.log("\n── 3. Follow/Unfollow Events ──");

  // Alice follows Bob — Bob should receive user:follow
  const followPromise = waitForEvent(socketB, "user:follow");
  const followRes = curl("POST", `/api/follows/${bobId}`, aliceToken);
  assert("Alice follows Bob API", followRes.success, followRes.message);
  await new Promise((r) => setTimeout(r, 1000));
  const followEv = await followPromise.catch(() => null);
  assert("Bob receives user:follow", followEv !== null);
  if (followEv) {
    assert("  targetUserId = Bob", followEv.targetUserId === bobId);
    assert("  followerId = Alice", followEv.followerId === aliceId);
  }

  // Alice unfollows Bob — Bob should receive user:unfollow
  const unfollowPromise = waitForEvent(socketB, "user:unfollow");
  const unfollowRes = curl("POST", `/api/follows/${bobId}`, aliceToken);
  assert("Alice unfollows Bob API", unfollowRes.success, unfollowRes.message);
  await new Promise((r) => setTimeout(r, 1000));
  const unfollowEv = await unfollowPromise.catch(() => null);
  assert("Bob receives user:unfollow", unfollowEv !== null);

  // ── 4. Create Post & broadcast ──────────────────────────
  console.log("\n── 4. Create Post (Broadcast) ──");
  const postTitle = `E2E Test ${Date.now()}`;
  const postCreatedPromise = waitForEvent(socketB, "post:created");
  const postRes = curl("POST", "/api/posts", aliceToken,
    JSON.stringify({ title: postTitle, content: "Real-time E2E test post from Alice!" }));
  assert("Alice creates post API", postRes.success, postRes.message);
  const postId = postRes.post?._id;
  assert("Post has ID", !!postId);

  await new Promise((r) => setTimeout(r, 1000));
  const postEv = await postCreatedPromise.catch(() => null);
  // post:created broadcasts to ALL (server doesn't filter by author)
  assert("Bob receives post:created", postEv !== null);

  // ── 5. Like/Unlike ──────────────────────────────────────
  console.log("\n── 5. Like/Unlike Events ──");
  if (postId) {
    const likePromise = waitForEvent(socketA, "post:like");
    const likeRes = curl("POST", `/api/likes/${postId}`, bobToken);
    assert("Bob likes post API", likeRes.success, likeRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const likeEv = await likePromise.catch(() => null);
    assert("Alice receives post:like from Bob", likeEv !== null);
    if (likeEv) {
      assert("  postId matches", likeEv.postId === postId);
      assert("  userId = Bob", likeEv.userId === bobId);
    }

    const unlikePromise = waitForEvent(socketA, "post:unlike");
    const unlikeRes = curl("POST", `/api/likes/${postId}`, bobToken);
    assert("Bob unlikes post API", unlikeRes.success, unlikeRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const unlikeEv = await unlikePromise.catch(() => null);
    assert("Alice receives post:unlike from Bob", unlikeEv !== null);
  }

  // ── 6. Save/Unsave ──────────────────────────────────────
  console.log("\n── 6. Save/Unsave Events ──");
  if (postId) {
    const savePromise = waitForEvent(socketA, "post:save");
    const saveRes = curl("POST", `/api/saves/${postId}`, bobToken);
    assert("Bob saves post API", saveRes.success, saveRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const saveEv = await savePromise.catch(() => null);
    assert("Alice receives post:save from Bob", saveEv !== null);

    const unsavePromise = waitForEvent(socketA, "post:unsave");
    const unsaveRes = curl("POST", `/api/saves/${postId}`, bobToken);
    assert("Bob unsaves post API", unsaveRes.success, unsaveRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const unsaveEv = await unsavePromise.catch(() => null);
    assert("Alice receives post:unsave from Bob", unsaveEv !== null);
  }

  // ── 7. Repost/Unrepost ──────────────────────────────────
  console.log("\n── 7. Repost/Unrepost Events ──");
  if (postId) {
    const repostPromise = waitForEvent(socketA, "post:repost");
    const repostRes = curl("POST", `/api/reposts/${postId}`, bobToken);
    assert("Bob reposts post API", repostRes.success, repostRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const repostEv = await repostPromise.catch(() => null);
    assert("Alice receives post:repost from Bob", repostEv !== null);

    const unrepostPromise = waitForEvent(socketA, "post:unrepost");
    const unrepostRes = curl("POST", `/api/reposts/${postId}`, bobToken);
    assert("Bob unreposts post API", unrepostRes.success, unrepostRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const unrepostEv = await unrepostPromise.catch(() => null);
    assert("Alice receives post:unrepost from Bob", unrepostEv !== null);
  }

  // ── 8. Comments ─────────────────────────────────────────
  console.log("\n── 8. Comment Events ──");
  if (postId) {
    const commentPromise = waitForEvent(socketA, "post:comment");
    const commentRes = curl("POST", `/api/comments/${postId}`, bobToken,
      JSON.stringify({ text: "Great post from Bob!" }));
    assert("Bob comments on post API", commentRes.success, commentRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const commentEv = await commentPromise.catch(() => null);
    assert("Alice receives post:comment from Bob", commentEv !== null);
  }

  // ── 9. Delete Post ──────────────────────────────────────
  console.log("\n── 9. Delete Post Event ──");
  if (postId) {
    const deletePromise = waitForEvent(socketB, "post:deleted");
    const delRes = curl("DELETE", `/api/posts/${postId}`, aliceToken);
    assert("Alice deletes post API", delRes.success, delRes.message);
    await new Promise((r) => setTimeout(r, 1000));
    const delEv = await deletePromise.catch(() => null);
    assert("Bob receives post:deleted", delEv !== null);
    if (delEv) {
      assert("  postId matches", delEv === postId || delEv?.postId === postId);
    }
  }

  // ── 10. Chat Events ──────────────────────────────────────
  console.log("\n── 10. Chat Events ──");

  // Create conversation
  const convRes = curl("POST", "/api/chats/conversations", aliceToken,
    JSON.stringify({ recipientId: bobId }));
  assert("Conversation created", convRes.success, convRes.message);
  const convId = convRes.conversation?._id;

  if (convId) {
    // Join conversation rooms
    socketA.emit("chat:join", { conversationId: convId });
    socketB.emit("chat:join", { conversationId: convId });
    await new Promise((r) => setTimeout(r, 300));

    // Typing indicator
    const typingPromise = waitForEvent(socketB, "chat:typing");
    socketA.emit("chat:typing", { conversationId: convId, isTyping: true });
    const typingEv = await typingPromise.catch(() => null);
    assert("Bob receives chat:typing from Alice", typingEv !== null);
    if (typingEv) {
      assert("  conversationId matches", typingEv.conversationId === convId);
      assert("  isTyping = true", typingEv.isTyping === true);
    }

    // Send message — use FormData to satisfy multer chat middleware
    const msgPromise = waitForEvent(socketB, "message:new");
    const { execSync: exec2 } = await import("child_process");
    const msgCmd = `curl -s -X POST ${BASE}/api/chats/conversations/${convId}/messages -H "Authorization: Bearer ${aliceToken}" -F "text=Hello Bob! Real-time E2E test!"`;
    try {
      const msgOut = exec2(msgCmd, { encoding: "utf-8", timeout: 10000 });
      const msgRes = JSON.parse(msgOut);
      assert("Alice sends message via API", msgRes.success, msgRes.message);
      await new Promise((r) => setTimeout(r, 1000));
      const msgEv = await msgPromise.catch(() => null);
      assert("Bob receives message:new", msgEv !== null);
    } catch (e) {
      assert("Alice sends message via API", false, e.message);
    }

    // Messages:seen — Bob joins, Alice gets seen receipt
    const seenPromise = waitForEvent(socketA, "messages:seen").catch(() => null);
    socketB.emit("chat:join", { conversationId: convId });
    await new Promise((r) => setTimeout(r, 500));
    const seenEv = await seenPromise;
    assert("Alice receives messages:seen from Bob", seenEv !== null);
    if (seenEv) {
      assert("  conversationId matches", seenEv.conversationId === convId);
      assert("  seenBy = Bob", seenEv.seenBy === bobId);
    }

    socketA.emit("chat:leave", { conversationId: convId });
    socketB.emit("chat:leave", { conversationId: convId });
  }

  // ── 11. User Profile Update ─────────────────────────────
  console.log("\n── 11. User Profile Update ──");
  const userUpdatedPromise = waitForEvent(socketB, "user:updated");
  const updateRes = curl("PUT", "/api/users/update-profile", aliceToken,
    JSON.stringify({ bio: "Updated via E2E test! 🚀" }));
  assert("Alice updates profile API", updateRes.success, updateRes.message);
  await new Promise((r) => setTimeout(r, 1000));
  const updateEv = await userUpdatedPromise.catch(() => null);
  assert("Bob receives user:updated", updateEv !== null);
  if (updateEv) {
    assert("  userId matches", updateEv._id === aliceId);
  }

  // ── 12. Notification Event ──────────────────────────────
  console.log("\n── 12. Notification Events ──");
  // Alice follows Bob again — this should generate a notification for Bob
  const notifPromise = waitForEvent(socketB, "notification");
  const follow2Res = curl("POST", `/api/follows/${bobId}`, aliceToken);
  assert("Alice follows Bob (for notification)", follow2Res.success, follow2Res.message);
  await new Promise((r) => setTimeout(r, 1500));
  const notifEv = await notifPromise.catch(() => null);
  assert("Bob receives notification event", notifEv !== null);

  // ── Results ─────────────────────────────────────────────
  socketA.disconnect();
  socketB.disconnect();

  console.log("\n┌──────────────────────────────────────────────┐");
  const pct = Math.round((passed / (passed + failed)) * 100);
  if (failures.length > 0) {
    console.log(`│  ❌  ${failed}/${passed + failed} tests FAILED (${pct}%)        │`);
    console.log("├──────────────────────────────────────────────┤");
    for (const f of failures) {
      const msg = `• ${f.label}${f.detail ? `: ${f.detail.substring(0, 60)}` : ""}`;
      console.log(`│  ${msg.padEnd(44)}│`);
    }
  } else {
    console.log(`│  ✅  All ${passed} tests PASSED!                        │`);
  }
  console.log("└──────────────────────────────────────────────┘\n");
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err.message);
  process.exit(1);
});
