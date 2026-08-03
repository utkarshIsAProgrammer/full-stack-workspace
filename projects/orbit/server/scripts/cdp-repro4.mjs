import { spawn } from "child_process";
import WebSocket from "ws";
import fs from "fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = process.env.ORBIT_TOKEN;

const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--window-size=1280,900", "--remote-debugging-port=9223",
  "--user-data-dir=/tmp/cdp-profile4", "about:blank",
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

// Open PostModal via the left sidebar "Post" button
const opened = await evalJS("(() => {\n  const btns = [...document.querySelectorAll('button')];\n  const b = btns.find(x => x.innerText.trim() === 'Post' && x.offsetParent !== null);\n  if (b) { b.click(); return 'clicked'; }\n  return 'no btn: ' + btns.filter(x=>x.offsetParent!==null).map(x=>x.innerText.trim()).slice(0,15).join('|');\n})()");
console.log("OPEN:", opened);
await sleep(2000);

// Type a very long line into the content textarea
const typed = await evalJS("(() => {\n  const tas = [...document.querySelectorAll('textarea')].filter(x => x.offsetParent !== null);\n  const t = tas.find(x => x.placeholder?.includes(\"What's on your mind\")) || tas[0];\n  if (!t) return 'no ta';\n  t.focus();\n  const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;\n  const long = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud'.repeat(3);\n  s.call(t, long);\n  t.dispatchEvent(new Event('input', { bubbles: true }));\n  t.dispatchEvent(new Event('change', { bubbles: true }));\n  return JSON.stringify({len: t.value.length, scrollTop: t.scrollTop, scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, overflow: getComputedStyle(t).overflow, overflowY: getComputedStyle(t).overflowY});\n})()");
console.log("TYPED LONG:", typed);
await sleep(1200);

// Now focus the textarea (blur/focus) and scroll to top, then report
const post = await evalJS("(() => {\n  const tas = [...document.querySelectorAll('textarea')].filter(x => x.offsetParent !== null);\n  const t = tas.find(x => x.value.length > 100) || tas[0];\n  if (!t) return 'no ta2';\n  const cs = getComputedStyle(t);\n  return JSON.stringify({scrollTop: t.scrollTop, scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, overflow: cs.overflow, textAlign: cs.textAlign, direction: cs.direction, whiteSpace: cs.whiteSpace, wordWrap: cs.wordWrap, overflowWrap: cs.overflowWrap});\n})()");
console.log("POST LONG:", post);

let shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) fs.writeFileSync("/tmp/6-longline.png", Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
