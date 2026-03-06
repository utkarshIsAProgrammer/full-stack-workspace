const API = "https://event-feedback-system-backend.onrender.com/api";

// dark mode
const html = document.documentElement;
const toggle = document.getElementById("theme-toggle");

function applyTheme(dark) {
	html.classList.toggle("dark", dark);
	localStorage.setItem("efms-theme", dark ? "dark" : "light");
}

toggle.addEventListener("click", () =>
	applyTheme(!html.classList.contains("dark")),
);

// navbar — scroll effect and active link
const navbar = document.getElementById("navbar");

window.addEventListener(
	"scroll",
	() => {
		navbar.classList.toggle("scrolled", window.scrollY > 8);
	},
	{ passive: true },
);

const sections = document.querySelectorAll("section[id]");
const navPills = document.querySelectorAll(".nav-pill");

const sectionObserver = new IntersectionObserver(
	(entries) => {
		entries.forEach((e) => {
			if (e.isIntersecting) {
				navPills.forEach((p) => {
					const active = p.getAttribute("href") === `#${e.target.id}`;
					p.classList.toggle("active", active);
				});
			}
		});
	},
	{ rootMargin: "-40% 0px -40% 0px" },
);

sections.forEach((s) => sectionObserver.observe(s));

// mobile menu
const hamburger = document.getElementById("hamburger");
const mobileNav = document.getElementById("mobile-nav");
const hamOpen = document.getElementById("ham-open");
const hamClose = document.getElementById("ham-close");

hamburger.addEventListener("click", () => {
	const open = mobileNav.classList.toggle("hidden");
	hamOpen.classList.toggle("hidden", !open);
	hamClose.classList.toggle("hidden", open);
});

mobileNav.querySelectorAll("a").forEach((l) =>
	l.addEventListener("click", () => {
		mobileNav.classList.add("hidden");
		hamOpen.classList.remove("hidden");
		hamClose.classList.add("hidden");
	}),
);

// toast
let toastTimer = null;

function showToast(msg, type = "success") {
	const box = document.getElementById("toast-box");
	const inner = document.getElementById("toast-inner");
	const icon = document.getElementById("toast-icon");
	const text = document.getElementById("toast-msg");

	// reset
	box.classList.remove("hidden", "leaving", "entering");
	inner.className = `flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-medium ${type}`;
	icon.textContent = type === "success" ? "✅" : "❌";
	text.textContent = msg;

	void box.offsetWidth; // force reflow
	box.classList.add("entering");

	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		box.classList.remove("entering");
		box.classList.add("leaving");
		setTimeout(() => box.classList.add("hidden"), 320);
	}, 4200);
}

// star rating
const stars = document.querySelectorAll(".star");
const ratingInput = document.getElementById("f-rating");
const ratingLabel = document.getElementById("rating-label");
const starWrap = document.getElementById("star-wrap");
const ratingErr = document.getElementById("rating-err");

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
let currentRating = 0;

function paintStars(val) {
	stars.forEach((s) => {
		const v = parseInt(s.dataset.v);
		s.style.color = v <= val ? "#f59e0b" : "";
		s.classList.toggle("scale-110", v === val);
	});
	ratingLabel.textContent = val ? LABELS[val] : "";
}

stars.forEach((s) => {
	s.addEventListener("click", () => {
		currentRating = parseInt(s.dataset.v);
		ratingInput.value = currentRating;
		paintStars(currentRating);
		starWrap.classList.remove("err");
		ratingErr.classList.add("hidden");
	});
	s.addEventListener("mouseenter", () => paintStars(parseInt(s.dataset.v)));
	s.addEventListener("mouseleave", () => paintStars(currentRating));
});

// form validation
function validateInput(el) {
	const wrap = el.closest(".field-wrap");
	const err = wrap?.querySelector(".field-err");
	let msg = "";

	if (!el.value.trim()) {
		msg = "this field is required.";
	} else if (el.type === "email") {
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()))
			msg = "enter a valid email address.";
	}

	if (err) {
		err.textContent = msg;
		err.classList.toggle("hidden", !msg);
	}
	el.classList.toggle("err", !!msg);
	return !msg;
}

document.querySelectorAll(".field-input").forEach((el) => {
	el.addEventListener("blur", () => validateInput(el));
	el.addEventListener("input", () => {
		if (el.classList.contains("err")) validateInput(el);
	});
});

// form submit
const form = document.getElementById("feedback-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnIcon = document.getElementById("btn-icon");
const btnSpin = document.getElementById("btn-spinner");

function setSubmitting(on) {
	submitBtn.disabled = on;
	btnText.textContent = on ? "submitting…" : "send feedback";
	btnIcon.classList.toggle("hidden", on);
	btnSpin.classList.toggle("hidden", !on);
}

form.addEventListener("submit", async (e) => {
	e.preventDefault();

	const fName = document.getElementById("f-name");
	const fEmail = document.getElementById("f-email");
	const fEvent = document.getElementById("f-event");
	const fComment = document.getElementById("f-comment");
	const rating = parseInt(ratingInput.value);

	let valid = [fName, fEmail, fEvent, fComment].reduce(
		(ok, el) => validateInput(el) && ok,
		true,
	);

	// validate rating
	if (!rating || rating < 1 || rating > 5) {
		ratingErr.textContent = "please select a rating (1–5).";
		ratingErr.classList.remove("hidden");
		starWrap.classList.add("err");
		valid = false;
	}

	if (!valid) return;

	setSubmitting(true);

	try {
		const res = await fetch(`${API}/feedback`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: fName.value.trim(),
				email: fEmail.value.trim(),
				event: fEvent.value,
				rating,
				comment: fComment.value.trim(),
			}),
		});

		const data = await res.json();

		if (res.ok && data.success) {
			// reset
			form.reset();
			currentRating = 0;
			ratingInput.value = 0;
			paintStars(0);
			form.querySelectorAll(".field-input").forEach((el) =>
				el.classList.remove("err"),
			);
			document
				.querySelectorAll(".field-err")
				.forEach((el) => el.classList.add("hidden"));
			starWrap.classList.remove("err");

			showToast("feedback submitted! thank you 🎉", "success");
			loadFeedback();
		} else {
			showToast(
				data.error || "submission failed. please try again.",
				"error",
			);
		}
	} catch {
		showToast("cannot reach server. is the backend running?", "error");
	} finally {
		setSubmitting(false);
	}
});

// fetch & render feedback
const skeleton = document.getElementById("fb-skeleton");
const grid = document.getElementById("fb-grid");
const empty = document.getElementById("fb-empty");
const errEl = document.getElementById("fb-error");

function showOnly(el) {
	[skeleton, grid, empty, errEl].forEach((e) => e.classList.add("hidden"));
	el.classList.remove("hidden");
}

async function loadFeedback() {
	const icon = document.getElementById("refresh-icon");
	icon.classList.add("spinning");
	setTimeout(() => icon.classList.remove("spinning"), 520);

	showOnly(skeleton);

	try {
		const res = await fetch(`${API}/feedback`);
		const data = await res.json();

		if (!res.ok || !data.success) {
			showOnly(errEl);
			return;
		}

		const list = data.allFeedbacks || [];
		if (list.length === 0) {
			showOnly(empty);
			return;
		}

		// sort newest first
		const sorted = [...list].sort(
			(a, b) => new Date(b.createdAt) - new Date(a.createdAt),
		);

		grid.innerHTML = "";
		sorted.forEach((fb, i) => {
			const card = buildCard(fb, i);
			grid.appendChild(card);
		});

		showOnly(grid);
	} catch {
		showOnly(errEl);
	}
}

/* avatar color pool */
const AVATAR_COLORS = [
	"bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
	"bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
	"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	"bg-amber-100   text-amber-700  dark:bg-amber-950  dark:text-amber-300",
	"bg-rose-100    text-rose-700   dark:bg-rose-950   dark:text-rose-300",
	"bg-sky-100     text-sky-700    dark:bg-sky-950    dark:text-sky-300",
];

function buildCard(fb, index) {
	const card = document.createElement("div");
	card.className = "fb-card";
	card.style.animationDelay = `${index * 0.06}s`;

	const initials = fb.name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0])
		.join("")
		.toUpperCase();
	const color = AVATAR_COLORS[fb.name.charCodeAt(0) % AVATAR_COLORS.length];
	const stars = Array.from(
		{ length: 5 },
		(_, i) =>
			`<span style="color:${i < fb.rating ? "#f59e0b" : "#d6d3d1"}">★</span>`,
	).join("");
	const date = new Date(fb.createdAt || Date.now()).toLocaleDateString(
		"en-US",
		{
			month: "short",
			day: "numeric",
			year: "numeric",
		},
	);

	card.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl ${color} flex items-center justify-center text-xs font-semibold shrink-0">${esc(initials)}</div>
        <div>
          <p class="text-sm font-semibold text-stone-900 dark:text-white leading-tight">${esc(fb.name)}</p>
          <p class="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">${date}</p>
        </div>
      </div>
      <div class="flex gap-px text-base leading-none shrink-0">${stars}</div>
    </div>

    <div class="mb-3">
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-stone-800/70 text-[11px] font-medium text-stone-600 dark:text-stone-400">
        <svg class="w-3 h-3 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        ${esc(fb.event)}
      </span>
    </div>

    <p class="text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">${esc(fb.comment)}</p>
  `;

	return card;
}

function esc(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// refresh button
document.getElementById("refresh-btn").addEventListener("click", loadFeedback);

// init
loadFeedback();
