import puppeteer from "puppeteer";

const BASE = "http://localhost:5173";
const API = "http://localhost:5006";

// API login → get session cookies
const loginRes = await fetch(`${API}/api/auth/login`, {
	method: "POST",
	headers: { "Content-Type": "application/json", Origin: BASE },
	body: JSON.stringify({ usernameOrEmail: "qatest1", password: "Test1234!" }),
});
const loginData = await loginRes.json();
if (!loginData.success) {
	console.log("LOGIN FAILED:", JSON.stringify(loginData).slice(0, 200));
	process.exit(1);
}
const cookieHeader = loginRes.headers.get("set-cookie") || "";
const m = cookieHeader.match(/([^=;]+)=([^;]+)/);
if (!m) {
	console.log("NO COOKIE:", cookieHeader.slice(0, 200));
	process.exit(1);
}
const cookieName = m[1];
const cookieValue = m[2];

const browser = await puppeteer.launch({
	headless: "new",
	args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setCookie({
	name: cookieName,
	value: cookieValue,
	domain: "localhost",
	path: "/",
});

async function openViewer() {
	// Navigate to home (authenticated)
	await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
	// Wait for the glance strip rings
	await page.waitForSelector('[class*="rounded-2xl"] [class*="gradient"]', { timeout: 15000 }).catch(() => {});
	await new Promise((r) => setTimeout(r, 3500));
	// Click the first glance ring: buttons with a gradient ring in the glance strip
	const clicked = await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll("button"));
		// glance rings are gradient-bordered buttons holding an avatar
		const ring = btns.find(
			(b) =>
				b.className.includes("gradient") &&
				b.className.includes("rounded") &&
				b.querySelector("img, .h-10, .h-11, .h-12")
		);
		if (!ring) return "no-ring";
		ring.click();
		return "clicked";
	});
	await new Promise((r) => setTimeout(r, 1500));
	return clicked;
}

async function measure(label) {
	const out = await page.evaluate(() => {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		// frame = the element with aspect-ratio 9/16 inside the viewer overlay
		const frame = Array.from(document.querySelectorAll("div")).find(
			(d) => {
				const st = getComputedStyle(d);
				return st.aspectRatio === "9 / 16" && d.getBoundingClientRect().height > 100;
			}
		);
		const frameRect = frame?.getBoundingClientRect();
		// buttons = the Like/Reply pills
		const buttons = Array.from(document.querySelectorAll("button")).filter(
			(b) => {
				const t = b.textContent.trim();
				return (t === "Like" || t === "Reply" || t === "Liked") && b.getBoundingClientRect().height > 0;
			}
		);
		const btnRects = buttons.map((b) => b.getBoundingClientRect());
		const progress = Array.from(document.querySelectorAll("div")).find(
			(d) => d.className.includes("rounded-full") && d.className.includes("bg-white/20") && d.getBoundingClientRect().width > 100
		);
		return {
			vw,
			vh,
			frame: frameRect
				? {
						x: Math.round(frameRect.x),
						y: Math.round(frameRect.y),
						w: Math.round(frameRect.width),
						h: Math.round(frameRect.height),
						ratio: (frameRect.width / frameRect.height).toFixed(3),
				  }
				: null,
			buttons: btnRects.map((r) => ({
				bottom: Math.round(r.bottom),
				top: Math.round(r.top),
				visible: r.bottom <= vh + 1 && r.top >= -1,
			})),
			progressVisible: !!progress && progress.getBoundingClientRect().top >= 0,
		};
	});

	const frameOk = out.frame && Math.abs(out.frame.ratio - 9 / 16) < 0.06;
	const buttonsOk = out.buttons.length > 0 && out.buttons.every((b) => b.visible);
	console.log(
		`${label} [${out.vw}x${out.vh}] frame=${out.frame ? `${out.frame.w}x${out.frame.h} ratio=${out.frame.ratio}` : "NONE"} ` +
			`buttons=${out.buttons.map((b) => (b.visible ? "OK" : `CLIPPED(bottom=${b.bottom}>)`)).join(",")} ` +
			`progressTop=${out.progressVisible ? "OK" : "CLIPPED"} ` +
			`=> ${frameOk && buttonsOk ? "PASS" : "FAIL"}`
	);
	return frameOk && buttonsOk;
}

// 1. Portrait phone
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
let r1 = await openViewer();
let ok1 = await measure("portrait-phone " + r1);

// 2. Landscape phone (the critical short-screen case)
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
await new Promise((r) => setTimeout(r, 500));
let r2 = await openViewer();
let ok2 = await measure("landscape-phone " + r2);

// 3. Normal desktop
await page.setViewport({ width: 1280, height: 900 });
await new Promise((r) => setTimeout(r, 500));
let r3 = await openViewer();
let ok3 = await measure("desktop " + r3);

// 4. Short desktop (the other short-screen case)
await page.setViewport({ width: 1280, height: 600 });
await new Promise((r) => setTimeout(r, 500));
let r4 = await openViewer();
let ok4 = await measure("short-desktop " + r4);

console.log(ok1 && ok2 && ok3 && ok4 ? "ALL PASS" : "SOME FAILED");
await browser.close();
process.exit(ok1 && ok2 && ok3 && ok4 ? 0 : 1);
