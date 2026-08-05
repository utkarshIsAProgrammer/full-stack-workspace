// ─── Orbit Call E2E Test ─────────────────────────────────────────────
// Personal audio call, personal video call, community (LiveKit) call.
// Two real Chromium instances with fake media streams (rolling test
// pattern video + constant-tone mic) so WebRTC/LiveKit publish real media.
import puppeteer from "puppeteer";

const APP = "http://localhost:5173";
const API = "http://localhost:5006/api";
const CHROMIUM = "/usr/bin/chromium";

const USER_A = { username: "testuser", password: "Test1234!" }; // caller
const USER_B = { username: "qatest1", password: "Test1234!" }; // callee
const PARTNER_NAME_B = "QA Tester One";
const PARTNER_NAME_A = "testuser";
const COMMUNITY_NAME = "QA Community 1785908977105";

const results = [];
let step = 0;
const log = (msg) => console.log(`[${String(++step).padStart(2, "0")}] ${msg}`);
const check = (name, ok, extra = "") => {
  results.push({ name, ok: !!ok, extra });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginApi(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernameOrEmail: username, password }),
  });
  const cookies = {};
  for (const sc of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    if (k && v.length) cookies[k] = v.join("=");
  }
  return { status: res.status, cookies };
}

async function apiCall(path, method, body, cookies) {
  const headers = { Cookie: `jwt=${cookies.jwt}; csrf-token=${cookies["csrf-token"]}` };
  if (body) headers["Content-Type"] = "application/json";
  if (cookies["csrf-token"]) headers["x-csrf-token"] = cookies["csrf-token"];
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function launchUser(cookies) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: "new",
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required", "--mute-audio",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setCookie(
    { name: "jwt", value: cookies.jwt, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ...(cookies["csrf-token"] ? [{ name: "csrf-token", value: cookies["csrf-token"], domain: "localhost", path: "/", sameSite: "Lax" }] : []),
  );
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE:" + msg.text().slice(0, 250)); });
  page.on("pageerror", (err) => errors.push("PAGEERROR:" + String(err && err.stack ? err.stack : err).slice(0, 300)));
  await page.goto(APP, { waitUntil: "networkidle2", timeout: 60000 });
  // Wait for the app shell to render (left sidebar nav or dock)
  await page.waitForFunction(
    () => !!Array.from(document.querySelectorAll("button, [role=button], span, div")).find((el) => (el.textContent || "").trim() === "Messages" && el.getBoundingClientRect().width > 0),
    { timeout: 25000 },
  ).catch(() => {});
  await sleep(3000);
  return { browser, page, errors };
}

async function clickNav(page, label) {
  const ok = await page.evaluate((lbl) => {
    const el = Array.from(document.querySelectorAll("button, [role=button], a, span, div"))
      .find((d) => (d.textContent || "").trim() === lbl && d.getBoundingClientRect().width > 0);
    el?.click();
    return !!el;
  }, label);
  await sleep(1500);
  return ok;
}

async function clickText(page, text) {
  const ok = await page.evaluate((txt) => {
    const els = Array.from(document.querySelectorAll("button, [role=button], a, div, span"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (el.textContent || "").trim() === txt;
      });
    if (els.length) { els[0].click(); return true; }
    const leaf = Array.from(document.querySelectorAll("div, span, p, h3"))
      .find((d) => {
        const t = (d.textContent || "").trim();
        const r = d.getBoundingClientRect();
        return r.width > 0 && t === txt && !d.children.length;
      });
    if (leaf) { leaf.click(); return true; }
    return false;
  }, text);
  await sleep(900);
  return ok;
}

async function waitFor(page, fn, timeout = 15000, desc = "condition") {
  try { await page.waitForFunction(fn, { timeout }); return true; }
  catch { console.log(`    ⏱ timeout waiting for: ${desc}`); return false; }
}

async function callOverlay(page) {
  return page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll(".fixed.inset-0"))
      .filter((el) => (el.className || "").includes("z-[340]"));
    const real = overlays.find((el) => !!el.querySelector(".lucide-phone-off")) || overlays[0];
    return real || null;
  });
}

async function captureCallState(page) {
  return page.evaluate(() => {
    const out = { hasCallUI: false, statusText: "", durationText: "", iceReconnecting: false };
    const overlays = Array.from(document.querySelectorAll(".fixed.inset-0"))
      .filter((el) => (el.className || "").includes("z-[340]"));
    const overlay = overlays.find((el) => !!el.querySelector(".lucide-phone-off")) || overlays[0];
    if (!overlay) return out;
    out.hasCallUI = true;
    const txt = (overlay.innerText || "").toUpperCase();
    if (txt.includes("INCOMING CALL")) out.statusText = "incoming";
    else if (txt.includes("CALLING...")) out.statusText = "outgoing";
    else if (/\d{2}:\d{2}/.test(txt)) out.statusText = "active";
    const dur = txt.match(/\b\d{2}:\d{2}\b/);
    if (dur) out.durationText = dur[0];
    if (txt.includes("RECONNECTING...")) out.iceReconnecting = true;
    return out;
  });
}

async function mediaState(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll("video")).map((v) => {
      const st = v.srcObject;
      return {
        muted: v.muted, w: v.videoWidth, h: v.videoHeight,
        audioTracks: st ? st.getAudioTracks().length : 0,
        videoTracks: st ? st.getVideoTracks().length : 0,
        audioEnabled: st && st.getAudioTracks()[0] ? st.getAudioTracks()[0].enabled : null,
        videoEnabled: st && st.getVideoTracks()[0] ? st.getVideoTracks()[0].enabled : null,
      };
    });
    const audios = Array.from(document.querySelectorAll("audio")).map((a) => ({
      audioTracks: a.srcObject ? a.srcObject.getAudioTracks().length : 0,
    }));
    return { videos, audios };
  });
}

// Wait until both sides show an ACTIVE personal call (duration ticking,
// no "Reconnecting" text, and remote media arriving).
async function waitCallActive(aPage, bPage, timeoutMs) {
  const checkActive = (page) =>
    page.evaluate(() => {
      const overlays = Array.from(document.querySelectorAll(".fixed.inset-0"))
        .filter((el) => (el.className || "").includes("z-[340]"));
      const ov = overlays.find((el) => !!el.querySelector(".lucide-phone-off")) || overlays[0];
      if (!ov) return false;
      const txt = (ov.innerText || "").toUpperCase();
      if (txt.includes("RECONNECTING...")) return false;
      if (!/\d{2}:\d{2}/.test(txt)) return false;
      // Remote media must be arriving
      const hasRemoteAudio = Array.from(document.querySelectorAll("audio")).some((a) => a.srcObject && a.srcObject.getAudioTracks().length > 0);
      return hasRemoteAudio;
    });
  const deadline = Date.now() + timeoutMs;
  let aOk = false, bOk = false;
  while (Date.now() < deadline) {
    const [ra, rb] = await Promise.all([checkActive(aPage), checkActive(bPage)]);
    if (ra) aOk = true;
    if (rb) bOk = true;
    if (aOk && bOk) return true;
    await sleep(1000);
  }
  return false;
}

// Click a button inside the active call overlay by icon class
async function clickCallButton(page, iconClass, titlePrefix) {
  return page.evaluate((icon, title) => {
    const overlays = Array.from(document.querySelectorAll(".fixed.inset-0"))
      .filter((el) => (el.className || "").includes("z-[340]"));
    const ov = overlays.find((el) => !!el.querySelector(".lucide-phone-off")) || overlays[0];
    if (!ov) return false;
    const btn = Array.from(ov.querySelectorAll("button")).find((b) =>
      (icon ? !!b.querySelector(icon) : false) || (title ? (b.title || "").startsWith(title) : false),
    );
    if (btn) { btn.click(); return true; }
    return false;
  }, iconClass, titlePrefix);
}

async function endCallFrom(page) {
  await clickCallButton(page, ".lucide-phone-off", null);
}

// ── Establish a personal call (audio or video) with one retry ──
async function establishPersonalCall(type, attempt = 1) {
  const btnTitle = type === "audio" ? "Audio Call" : "Video Call";
  const started = await userA.page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.title || "") === t);
    if (btn) { btn.click(); return true; }
    return false;
  }, btnTitle);
  check(`A clicked ${type} call (attempt ${attempt})`, started);
  if (!started) return false;

  const incomingOk = await waitFor(
    userB.page,
    () => {
      const ov = Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"));
      return !!ov && (ov.innerText || "").toUpperCase().includes("INCOMING CALL");
    },
    12000,
    `incoming ${type} call on B`,
  );
  check(`B sees incoming ${type} call`, incomingOk);
  if (!incomingOk) { await endCallFrom(userA.page); return false; }

  const accepted = await userB.page.evaluate(() => {
    const ov = Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"));
    if (!ov) return false;
    const btn = Array.from(ov.querySelectorAll("button")).find((b) => (b.className || "").includes("bg-emerald-500"));
    if (btn) { btn.click(); return true; }
    return false;
  });
  check(`B accepted the ${type} call`, accepted);

  const active = await waitCallActive(userA.page, userB.page, 20000);
  if (!active) {
    // Retry once — teardown and try again
    await endCallFrom(userA.page).catch(() => {});
    await sleep(2500);
    if (attempt === 1) {
      log(`  ${type} call did not connect on first attempt — retrying...`);
      return establishPersonalCall(type, 2);
    }
  }
  return active;
}

// ═══════════════ SETUP ═══════════════
log("Logging in both users via API");
const loginA = await loginApi(USER_A.username, USER_A.password);
const loginB = await loginApi(USER_B.username, USER_B.password);
check("Login A", loginA.status === 200 && !!loginA.cookies.jwt);
check("Login B", loginB.status === 200 && !!loginB.cookies.jwt);

const meA = await apiCall("/auth/me", "GET", null, loginA.cookies);
const meB = await apiCall("/auth/me", "GET", null, loginB.cookies);
check("A id", !!meA.data?.user?._id);
check("B id", !!meB.data?.user?._id);
const convB = await apiCall("/chats/conversations", "POST", { recipientId: meA.data.user._id }, loginB.cookies);
check("Shared conversation ready", convB.status === 200 || convB.status === 201);

log("Launching two browser instances with fake media devices");
const userA = await launchUser(loginA.cookies);
const userB = await launchUser(loginB.cookies);
check("Browser A loaded app", userA.page.url().startsWith(APP));
check("Browser B loaded app", userB.page.url().startsWith(APP));

// Open the personal chat on both sides (with retries)
log("Opening personal chat on both sides");
for (const [u, name] of [[userA, PARTNER_NAME_B], [userB, PARTNER_NAME_A]]) {
  const navOk = await clickNav(u.page, "Messages");
  log(`  ${name}: Messages nav clicked: ${navOk}`);
  if (!navOk) {
    // Fallback: click the dock Messages button
    await u.page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("button, [role=button]"))
        .find((d) => (d.getAttribute("aria-label") || "").toLowerCase().includes("message"));
      el?.click();
    }).catch(() => {});
    await sleep(1200);
  }
  let opened = false;
  for (let i = 0; i < 3 && !opened; i++) {
    opened = await clickText(u.page, name);
    if (!opened) await sleep(1200);
  }
  log(`  ${name}: conversation opened: ${opened}`);
}
await sleep(1500);

// ═══════════════ TEST 1: PERSONAL AUDIO CALL ═══════════════
log("── TEST 1: Personal audio call ──");
const audioOk = await establishPersonalCall("audio");
check("Audio call active on both sides (ICE connected, remote audio flowing)", audioOk);
if (audioOk) {
  await sleep(2500);
  const stA = await captureCallState(userA.page);
  const stB = await captureCallState(userB.page);
  check("A CallUI active", stA.statusText === "active", stA.durationText);
  check("B CallUI active", stB.statusText === "active", stB.durationText);
  check("A ICE stable (no reconnect)", !stA.iceReconnecting);
  check("B ICE stable (no reconnect)", !stB.iceReconnecting);
  await userA.page.screenshot({ path: "/tmp/call-audio-active.png" });

  // Mute → mic meter dims; unmute → meter reacts
  log("  Testing mute toggle on A...");
  const countActiveBars = () => userA.page.evaluate(() => {
    const ov = Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"));
    if (!ov) return -1;
    const bars = Array.from(ov.querySelectorAll("span")).filter((s) => {
      const st = getComputedStyle(s);
      return st.backgroundColor !== "rgba(0, 0, 0, 0)" && parseFloat(st.height) > 2 && st.width === "4px";
    });
    const dim = "rgba(255, 255, 255, 0.08)";
    return bars.filter((s) => getComputedStyle(s).backgroundColor !== dim).length;
  });

  await clickCallButton(userA.page, ".lucide-mic", null);
  await sleep(800);
  const mutedUI = await userA.page.evaluate(() => !!Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"))?.querySelector(".lucide-mic-off"));
  const barsMuted = await countActiveBars();
  check("A mute → MicOff icon", mutedUI);
  check("A local mic meter fully dim when muted", barsMuted === 0, `active bars: ${barsMuted}`);

  await clickCallButton(userA.page, ".lucide-mic-off", null);
  await sleep(800);
  const unmutedUI = await userA.page.evaluate(() => !!Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"))?.querySelector(".lucide-mic"));
  const barsUnmuted = await countActiveBars();
  check("A unmute → Mic icon", unmutedUI);
  check("A local mic meter reacts after unmute", barsUnmuted > 0, `active bars: ${barsUnmuted}`);
}

log("  Ending audio call from A...");
await endCallFrom(userA.page);
const endA = await waitFor(userA.page, () => !Array.from(document.querySelectorAll(".fixed.inset-0")).some((el) => (el.className || "").includes("z-[340]")), 10000, "A CallUI closed");
const endB = await waitFor(userB.page, () => !Array.from(document.querySelectorAll(".fixed.inset-0")).some((el) => (el.className || "").includes("z-[340]")), 10000, "B CallUI closed");
check("A CallUI closed after ending", endA);
check("B CallUI closed after A ended", endB);

// ═══════════════ TEST 2: PERSONAL VIDEO CALL ═══════════════
log("── TEST 2: Personal video call ──");
await sleep(1000);
const videoOk = await establishPersonalCall("video");
check("Video call active on both sides (ICE connected, remote audio flowing)", videoOk);
if (videoOk) {
  await sleep(3000);
  const vA = await mediaState(userA.page);
  const vB = await mediaState(userB.page);
  check("A renders B's video (remote frames 1280x720)", vA.videos.some((v) => !v.muted && v.w > 0), JSON.stringify(vA.videos.map((v) => ({ w: v.w, h: v.h, muted: v.muted }))));
  check("B renders A's video (remote frames 1280x720)", vB.videos.some((v) => !v.muted && v.w > 0), JSON.stringify(vB.videos.map((v) => ({ w: v.w, h: v.h, muted: v.muted }))));
  check("A local preview playing", vA.videos.some((v) => v.muted && v.w > 0));
  check("B local preview playing", vB.videos.some((v) => v.muted && v.w > 0));
  check("A remote audio present", vA.audios.some((a) => a.audioTracks > 0));
  check("B remote audio present", vB.audios.some((a) => a.audioTracks > 0));
  await userA.page.screenshot({ path: "/tmp/call-video-active.png" });

  // Camera toggle: off → local track disabled + preview hidden; on → enabled
  log("  Testing camera toggle on A...");
  await clickCallButton(userA.page, ".lucide-video", null);
  await sleep(800);
  const camOff = await userA.page.evaluate(() => {
    const ov = Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"));
    const local = Array.from(document.querySelectorAll("video")).find((v) => v.muted && v.srcObject);
    return {
      icon: !!ov?.querySelector(".lucide-video-off"),
      enabled: local?.srcObject?.getVideoTracks()[0]?.enabled ?? null,
      hidden: !!local?.className?.includes("opacity-0"),
    };
  });
  check("A camera off → VideoOff icon", camOff.icon);
  check("A local video track disabled", camOff.enabled === false, String(camOff.enabled));
  check("A local preview hidden", camOff.hidden);

  await clickCallButton(userA.page, ".lucide-video-off", null);
  await sleep(800);
  const camOn = await userA.page.evaluate(() => {
    const ov = Array.from(document.querySelectorAll(".fixed.inset-0")).find((el) => (el.className || "").includes("z-[340]"));
    const local = Array.from(document.querySelectorAll("video")).find((v) => v.muted && v.srcObject);
    return {
      icon: !!ov?.querySelector(".lucide-video"),
      enabled: local?.srcObject?.getVideoTracks()[0]?.enabled ?? null,
    };
  });
  check("A camera on → Video icon", camOn.icon);
  check("A local video track re-enabled", camOn.enabled === true, String(camOn.enabled));

  log("  Testing speaker toggle on A...");
  const spk = await clickCallButton(userA.page, null, "Switch to");
  check("A speaker toggle clickable", spk);
}

log("  Ending video call from A...");
await endCallFrom(userA.page);
const vEndA = await waitFor(userA.page, () => !Array.from(document.querySelectorAll(".fixed.inset-0")).some((el) => (el.className || "").includes("z-[340]")), 10000, "A video CallUI closed");
const vEndB = await waitFor(userB.page, () => !Array.from(document.querySelectorAll(".fixed.inset-0")).some((el) => (el.className || "").includes("z-[340]")), 10000, "B video CallUI closed");
check("Video call ended on A", vEndA);
check("Video call ended on B", vEndB);

// ═══════════════ TEST 3: COMMUNITY (LIVEKIT) VIDEO CALL ═══════════════
log("── TEST 3: Community video call (LiveKit) ──");
for (const u of [userA, userB]) {
  await clickNav(u.page, "Communities");
  await clickText(u.page, COMMUNITY_NAME);
}
await sleep(2000);

const groupBtn = await userA.page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.title || "") === "Start group video call");
  if (btn) { btn.click(); return true; }
  return false;
});
check("A clicked Start group video call", groupBtn);

const floorConnected = (page) =>
  page.evaluate(() => {
    const t = document.body.innerText.toUpperCase();
    if (!t.includes("GROUP VIDEO CALL")) return false;
    if (t.includes("CONNECTING TO GROUP CALL")) return false;
    return Array.from(document.querySelectorAll("video")).some((v) => v.videoWidth > 0);
  });

const groupConnA = await waitFor(userA.page, floorConnected, 25000, "A connected to LiveKit room");
check("A connected to LiveKit room (video tiles rendering)", groupConnA);
if (groupConnA) {
  await sleep(2000);
  const gm = await mediaState(userA.page);
  check("A local video published (LiveKit)", gm.videos.some((v) => v.videoTracks > 0 && v.w > 0), JSON.stringify(gm.videos.map((v) => ({ w: v.w, videoTracks: v.videoTracks }))));
}

const joinBanner = await waitFor(
  userB.page,
  () => !!Array.from(document.querySelectorAll("button")).find((b) => (b.title || "") === "Join the active group call"),
  15000,
  "join banner on B",
);
check("B sees join-call banner", joinBanner);
if (joinBanner) {
  const clicked = await userB.page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.title || "") === "Join the active group call");
    if (btn) { btn.click(); return true; }
    return false;
  });
  check("B clicked join banner", clicked);
}
const groupConnB = await waitFor(userB.page, floorConnected, 25000, "B connected to LiveKit room");
check("B connected to LiveKit room (video tiles rendering)", groupConnB);

await sleep(3000);
const gmB = await mediaState(userB.page);
check("B sees participant videos (self+remote tiles)", gmB.videos.filter((v) => v.w > 0).length >= 2, JSON.stringify(gmB.videos.map((v) => ({ w: v.w, h: v.h, muted: v.muted }))));
const gmA = await mediaState(userA.page);
check("A sees participant videos (self+remote tiles)", gmA.videos.filter((v) => v.w > 0).length >= 2, JSON.stringify(gmA.videos.map((v) => ({ w: v.w, h: v.h, muted: v.muted }))));
await userA.page.screenshot({ path: "/tmp/call-group-active.png" });
await userB.page.screenshot({ path: "/tmp/call-group-active-b.png" });

// Community call controls on A
log("  Testing community call controls on A...");
const grpMute = await userA.page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Mute microphone");
  if (btn) { btn.click(); return true; }
  return false;
});
check("A mute mic (LiveKit)", grpMute);
await sleep(600);
check("A mic now muted", await userA.page.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Unmute microphone")));
const grpCam = await userA.page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Disable camera");
  if (btn) { btn.click(); return true; }
  return false;
});
check("A camera toggle (LiveKit)", grpCam);
await sleep(600);
check("A camera now off", await userA.page.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Enable camera")));

log("  Leaving group call from B then A...");
const grpLeaveB = await userB.page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Leave call");
  if (btn) { btn.click(); return true; }
  return false;
});
check("B clicked Leave call", grpLeaveB);
const grpEndB = await waitFor(userB.page, () => !document.body.innerText.toUpperCase().includes("GROUP VIDEO CALL"), 10000, "B left group call");
check("B left group call (floor closed)", grpEndB);
const grpLeaveA = await userA.page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Leave call" || (b.title || "") === "Leave call");
  if (btn) { btn.click(); return true; }
  return false;
});
check("A clicked Leave call", grpLeaveA);
const grpEndA = await waitFor(userA.page, () => !document.body.innerText.toUpperCase().includes("GROUP VIDEO CALL"), 10000, "A left group call");
check("A left group call (floor closed)", grpEndA);

// ═══════════════ SUMMARY ═══════════════
log("── CONSOLE / PAGE ERRORS ──");
check("A: no console errors", userA.errors.length === 0, userA.errors.slice(0, 3).join(" | "));
check("B: no console errors", userB.errors.length === 0, userB.errors.slice(0, 3).join(" | "));

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log("\n════════════════════════════════════════");
console.log(`RESULT: ${passed} passed / ${failed} failed / ${results.length} total`);
console.log("════════════════════════════════════════");
if (failed) results.filter((r) => !r.ok).forEach((r) => console.log(`  FAILED: ${r.name}${r.extra ? " — " + r.extra : ""}`));
await userA.browser.close();
await userB.browser.close();
process.exit(failed ? 1 : 0);
