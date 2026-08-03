import { spawn } from "child_process";
import WebSocket from "ws";
import fs from "fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = process.env.ORBIT_TOKEN;

const chrome = spawn("/usr/bin/chromium", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--window-size=1280,900",
  "--remote-debugging-port=9223",
  "--user-data-dir=/tmp/cdp-profile",
  "about:blank",
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

await send("Network.setCookie", {
  name: "jwt",
  value: TOKEN,
  url: "http://localhost:5173",
  path: "/",
  httpOnly: true,
  sameSite: "Lax",
});

await send("Page.navigate", { url: "http://localhost:5173" });
await sleep(7000);

console.log("AFTER LOAD:", JSON.stringify(await evalJS("({url: location.href, txt: document.body.innerText.slice(0,300)})")));

const ta = await evalJS("(() => {\n  const t = [...document.querySelectorAll('textarea')].find(x => x.offsetParent !== null);\n  if (!t) return 'no textarea: ' + document.body.innerText.slice(0,300);\n  t.focus();\n  t.scrollIntoView({ block: 'center' });\n  const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;\n  s.call(t, 'The quick brown fox jumps over the lazy dog');\n  t.dispatchEvent(new Event('input', { bubbles: true }));\n  return 'typed: ' + t.value;\n})()");
console.log("TEXTAREA:", ta);
await sleep(1500);

let shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) fs.writeFileSync("/tmp/2-composer.png", Buffer.from(shot.result.data, "base64"));

const styles = await evalJS("(() => {\n  const t = [...document.querySelectorAll('textarea')].find(x => x.value.includes('quick brown fox'));\n  if (!t) return 'no matched textarea';\n  const cs = getComputedStyle(t);\n  const rect = t.getBoundingClientRect();\n  const overlays = [...document.querySelectorAll('*')].filter(el => {\n    if (el === t || t.contains(el)) return false;\n    const r = el.getBoundingClientRect();\n    if (r.width === 0 || r.height === 0) return false;\n    const c = getComputedStyle(el);\n    if (c.position !== 'absolute' && c.position !== 'fixed') return false;\n    const overlap = r.left < rect.left + 80 && r.right > rect.left && r.bottom > rect.top && r.top < rect.bottom;\n    return overlap;\n  });\n  return JSON.stringify({\n    color: cs.color, bg: cs.backgroundColor, font: cs.fontFamily,\n    textIndent: cs.textIndent, direction: cs.direction, letterSpacing: cs.letterSpacing,\n    textShadow: cs.textShadow, padding: cs.padding, overflow: cs.overflow,\n    textAlign: cs.textAlign, rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },\n    overlays: overlays.map(el => ({ tag: el.tagName, cls: el.className?.toString().slice(0,80), bg: getComputedStyle(el).backgroundColor, z: getComputedStyle(el).zIndex, rect: (() => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })() }))\n  });\n})()");
console.log("STYLES:", styles);

ws.close();
chrome.kill();
