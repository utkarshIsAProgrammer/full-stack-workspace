import { spawn } from "child_process";
import WebSocket from "ws";
import fs from "fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = process.env.ORBIT_TOKEN;
const VIEWPORT = process.env.VIEWPORT || "desktop";

const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--window-size=1280,900", "--remote-debugging-port=9223",
  "--user-data-dir=/tmp/cdp-profile3", "about:blank",
], { stdio: "ignore" });

let targets;
for (let i = 0; i < 40; i++) {
  await sleep(300);
  try {
    targets = await fetch("http://localhost:9223/json/list").then((r) => r.json());
    if (targets.length) break;
  } catch {}
}
const page = targets?.find((t) => t.type === "page");
if (!page) { console.log("no page"); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
let msgId = 0;
const pending = new Map();
ws.on("message", (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((res) => ws.on("open", res));
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

if (VIEWPORT === "mobile") {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
} else if (VIEWPORT === "tablet") {
  await send("Emulation.setDeviceMetricsOverride", { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false });
}

await send("Network.setCookie", { name: "jwt", value: TOKEN, url: "http://localhost:5173", path: "/", httpOnly: true, sameSite: "Lax" });
await send("Page.navigate", { url: "http://localhost:5173" });
await sleep(7000);

console.log("LOADED:", JSON.stringify(await evalJS("({url: location.href, t: document.title})")));

// Open the PostModal by clicking the "Post" / compose button
const modalBtn = await evalJS("(() => {\n  const btns = [...document.querySelectorAll('button')];\n  const b = btns.find(x => x.innerText.trim() === 'Post' && x.offsetParent !== null);\n  if (b) { b.click(); return 'clicked Post btn'; }\n  return 'no Post btn: ' + btns.filter(x=>x.offsetParent!==null).map(x=>x.innerText.trim()).filter(Boolean).slice(0,20).join('|');\n})()");
console.log("OPEN MODAL:", modalBtn);
await sleep(2000);

// Find all textareas now
const allTas = await evalJS("(() => JSON.stringify([...document.querySelectorAll('textarea')].filter(x=>x.offsetParent!==null).map(t => ({ph: t.placeholder, w: t.offsetWidth, h: t.offsetHeight}))))");
console.log("ALL TEXTAREAS:", allTas);

// Focus the main composer textarea (content field in PostModal)
const taResult = await evalJS("(() => {\n  const tas = [...document.querySelectorAll('textarea')].filter(x => x.offsetParent !== null);\n  const t = tas.find(x => x.placeholder?.includes(\"What's on your mind\")) || tas.find(x => x.placeholder?.includes('Share your thoughts')) || tas[0];\n  if (!t) return 'no textarea';\n  t.focus();\n  t.scrollIntoView({ block: 'center' });\n  return JSON.stringify({ph: t.placeholder, r: (() => { const r = t.getBoundingClientRect(); return {l:r.left,t:r.top,w:r.width,h:r.height}; })()});\n})()");
console.log("TARGET:", taResult);
await sleep(500);

// Type real keys
const text = "This is a test post to check the hidden text issue in the composer";
for (const ch of text) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
}
await sleep(800);

// Screenshot
let shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) fs.writeFileSync(`/tmp/5-${VIEWPORT}-postmodal.png`, Buffer.from(shot.result.data, "base64"));

// Check textarea details incl scroll
const detail = await evalJS("(() => JSON.stringify([...document.querySelectorAll('textarea')].filter(x => x.offsetParent !== null).map(t => ({ ph: t.placeholder, val: t.value.slice(0,50), scrollTop: t.scrollTop, sh: t.scrollHeight, ch: t.clientHeight, overflow: getComputedStyle(t).overflow, color: getComputedStyle(t).color, bg: getComputedStyle(t).backgroundColor }))))");
console.log("DETAIL:", detail);

// Check for any element overlaying the textarea left portion
const ov = await evalJS("(() => {\n  const t = [...document.querySelectorAll('textarea')].find(x => x.offsetParent !== null && x.value.length > 0);\n  if (!t) return 'no focused ta';\n  const rect = t.getBoundingClientRect();\n  const els = [...document.querySelectorAll('*')].filter(el => {\n    if (el === t || t.contains(el) || !el.isConnected) return false;\n    const r = el.getBoundingClientRect();\n    if (r.width < 5 || r.height < 5) return false;\n    const c = getComputedStyle(el);\n    const pos = c.position;\n    const vis = c.visibility !== 'hidden' && c.display !== 'none';\n    if (!vis) return false;\n    const overlaps = r.left < rect.left + 60 && r.right > rect.left && r.bottom > rect.top && r.top < rect.bottom;\n    return overlaps && (pos === 'absolute' || pos === 'fixed' || parseFloat(c.zIndex) >= 0);\n  });\n  return JSON.stringify(els.slice(0,10).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0,100), bg: getComputedStyle(el).backgroundColor, z: getComputedStyle(el).zIndex, pos: getComputedStyle(el).position, r: (() => { const r = el.getBoundingClientRect(); return {l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; })() })));\n})()");
console.log("OVERLAYS:", ov);

ws.close();
chrome.kill();
