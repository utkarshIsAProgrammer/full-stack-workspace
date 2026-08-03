import { spawn } from "child_process";
import WebSocket from "ws";
import fs from "fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = process.env.ORBIT_TOKEN;

const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--window-size=1280,900", "--remote-debugging-port=9223",
  "--user-data-dir=/tmp/cdp-profile2", "about:blank",
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
await send("Network.setCookie", { name: "jwt", value: TOKEN, url: "http://localhost:5173", path: "/", httpOnly: true, sameSite: "Lax" });
await send("Page.navigate", { url: "http://localhost:5173" });
await sleep(7000);

// Focus the composer textarea and type REAL keys
const info = await evalJS("(() => {\n  const t = [...document.querySelectorAll('textarea')].find(x => x.offsetParent !== null);\n  if (!t) return 'no textarea';\n  t.focus();\n  const r = t.getBoundingClientRect();\n  return JSON.stringify({left: r.left, top: r.top, w: r.width, h: r.height});\n})()");
console.log("TEXTAREA RECT:", info);

// Type real keys
const text = "The quick brown fox jumps over the lazy dog and runs away fast";
for (const ch of text) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
}
await sleep(800);

const val = await evalJS("[...document.querySelectorAll('textarea')].find(x => x.offsetParent !== null)?.value");
console.log("TYPED VALUE:", JSON.stringify(val));

// Capture full screenshot
let shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) fs.writeFileSync("/tmp/3-typed.png", Buffer.from(shot.result.data, "base64"));

// Capture element screenshot of the textarea
const elshot = await evalJS("(() => {\n  const t = [...document.querySelectorAll('textarea')].find(x => x.offsetParent !== null);\n  if (!t) return null;\n  const r = t.getBoundingClientRect();\n  return {x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height)};\n})()");
if (elshot) {
  const es = await send("Page.captureScreenshot", { format: "png", clip: elshot });
  if (es.result?.data) fs.writeFileSync("/tmp/4-textarea-clip.png", Buffer.from(es.result.data, "base64"));
}

// Dump computed styles of every textarea + check scrollTop, scrollHeight
const detail = await evalJS("(() => {\n  return JSON.stringify([...document.querySelectorAll('textarea')].filter(x => x.offsetParent !== null).map(t => {\n    const cs = getComputedStyle(t);\n    return { placeholder: t.placeholder, value: t.value.slice(0,40), scrollTop: t.scrollTop, scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, overflow: cs.overflow, h: t.offsetHeight, whiteSpace: cs.whiteSpace };\n  }));\n})()");
console.log("DETAIL:", detail);

ws.close();
chrome.kill();
