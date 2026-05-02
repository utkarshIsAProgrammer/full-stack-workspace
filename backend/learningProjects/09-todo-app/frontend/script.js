const API = "http://localhost:5500/api/tasks";

/* ── STATE ─────────────────────────────────────────── */
let allTasks = [];
let editingId = null;
let deleteTarget = null;

/* ── DOM REFS ───────────────────────────────────────── */
const taskList = document.getElementById("task-list");
const fTitle = document.getElementById("f-title");
const fDesc = document.getElementById("f-desc");
const fDue = document.getElementById("f-due");
const fDone = document.getElementById("f-done");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formHeading = document.getElementById("form-heading");
const searchInput = document.getElementById("search-input");
const themeBtn = document.getElementById("theme-btn");
const modal = document.getElementById("delete-modal");

/* ── THEME ──────────────────────────────────────────── */
const html = document.documentElement;
const saved = localStorage.getItem("tf-theme") || "light";
html.dataset.theme = saved;
themeBtn.textContent = saved === "dark" ? "☀️" : "🌙";

themeBtn.addEventListener("click", () => {
	const next = html.dataset.theme === "dark" ? "light" : "dark";
	html.dataset.theme = next;
	themeBtn.textContent = next === "dark" ? "☀️" : "🌙";
	localStorage.setItem("tf-theme", next);
});

/* ── TOAST ──────────────────────────────────────────── */
function toast(msg, type = "success") {
	const el = document.createElement("div");
	el.className = `toast ${type}`;
	el.textContent = msg;
	document.getElementById("toast-container").appendChild(el);
	setTimeout(() => el.remove(), 3000);
}

/* ── API HELPERS ────────────────────────────────────── */
async function apiFetch(path, options = {}) {
	const res = await fetch(API + path, {
		headers: { "Content-Type": "application/json" },
		...options,
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.message || "Request failed");
	return data;
}

/* ── LOAD TASKS ─────────────────────────────────────── */
async function loadTasks() {
	taskList.innerHTML = `<div class="loading"><span class="spinner"></span>Loading tasks…</div>`;
	try {
		const data = await apiFetch("/get");
		allTasks = data.tasks || [];
		renderTasks();
	} catch (e) {
		taskList.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
	}
}

/* ── RENDER ─────────────────────────────────────────── */
function renderTasks() {
	const q = searchInput.value.toLowerCase();
	const now = new Date();
	now.setHours(0, 0, 0, 0);

	let list = allTasks.filter((t) => {
		return (
			!q ||
			t.title.toLowerCase().includes(q) ||
			(t.description || "").toLowerCase().includes(q)
		);
	});

	if (!list.length) {
		taskList.innerHTML = `<div class="empty"><div class="icon">📋</div><p>No tasks found.</p></div>`;
		return;
	}

	taskList.innerHTML = list
		.map((t) => {
			const due = t.dueDate ? new Date(t.dueDate) : null;
			const isOver = due && !t.completed && due < now;
			const dueStr = due
				? due.toLocaleDateString("en-IN", {
						day: "numeric",
						month: "short",
						year: "numeric",
					})
				: null;

			const statusTag = t.completed
				? `<span class="tag done-tag">✓ Done</span>`
				: isOver
					? `<span class="tag overdue-tag">⚠ Overdue</span>`
					: `<span class="tag pending-tag">● Pending</span>`;

			return `
    <div class="task-item ${t.completed ? "done" : ""}" data-id="${t._id}">
      <input class="task-check" type="checkbox" ${t.completed ? "checked" : ""} title="Toggle complete" data-toggle="${t._id}" />
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ""}
        <div class="task-meta">
          ${statusTag}
          ${dueStr ? `<span class="tag">📅 ${dueStr}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" title="Edit" data-edit="${t._id}">✏️</button>
        <button class="icon-btn del" title="Delete" data-delete="${t._id}">❌</button>
      </div>
    </div>`;
		})
		.join("");
}

function esc(str) {
	return (str || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/* ── FORM SUBMIT ────────────────────────────────────── */
submitBtn.addEventListener("click", async () => {
	const title = fTitle.value.trim();
	if (!title) {
		fTitle.focus();
		toast("Title is required!", "error");
		return;
	}

	const payload = {
		title,
		description: fDesc.value.trim() || " ",
		completed: fDone.checked,
		dueDate: fDue.value || new Date().toISOString(),
	};

	try {
		if (editingId) {
			await apiFetch(`/update/${editingId}`, {
				method: "PUT",
				body: JSON.stringify(payload),
			});
			toast("Task updated!");
		} else {
			await apiFetch("/add", {
				method: "POST",
				body: JSON.stringify(payload),
			});
			toast("Task added!");
		}
		resetForm();
		loadTasks();
	} catch (e) {
		toast(e.message, "error");
	}
});

cancelBtn.addEventListener("click", resetForm);

function resetForm() {
	editingId = null;
	fTitle.value = "";
	fDesc.value = "";
	fDue.value = "";
	fDone.checked = false;
	formHeading.textContent = "Add a new task";
	submitBtn.textContent = "Add Task";
	cancelBtn.style.display = "none";
	document.getElementById("completed-field").style.display = "none";
}

/* ── DELEGATED EVENTS ───────────────────────────────── */
taskList.addEventListener("click", async (e) => {
	const editId = e.target.closest("[data-edit]")?.dataset.edit;
	const deleteId = e.target.closest("[data-delete]")?.dataset.delete;
	const toggleId = e.target.closest("[data-toggle]")?.dataset.toggle;

	if (editId) {
		const task = allTasks.find((t) => t._id === editId);
		if (!task) return;
		editingId = editId;
		fTitle.value = task.title;
		fDesc.value = task.description || "";
		fDone.checked = task.completed;
		fDue.value = task.dueDate ? task.dueDate.split("T")[0] : "";
		formHeading.textContent = "Edit task";
		submitBtn.textContent = "Save changes";
		cancelBtn.style.display = "inline-flex";
		document.getElementById("completed-field").style.display = "flex";
		fTitle.focus();
		window.scrollTo({ top: 0, behavior: "smooth" });
	}

	if (deleteId) {
		deleteTarget = deleteId;
		modal.style.display = "grid";
	}

	if (toggleId) {
		const task = allTasks.find((t) => t._id === toggleId);
		if (!task) return;
		try {
			await apiFetch(`/update/${toggleId}`, {
				method: "PUT",
				body: JSON.stringify({
					title: task.title,
					description: task.description || " ",
					completed: !task.completed,
					dueDate: task.dueDate || new Date().toISOString(),
				}),
			});
			toast(task.completed ? "Marked as pending" : "Marked as done ✓");
			loadTasks();
		} catch (e) {
			toast(e.message, "error");
		}
	}
});

/* ── MODAL ──────────────────────────────────────────── */
document.getElementById("modal-cancel").addEventListener("click", () => {
	modal.style.display = "none";
	deleteTarget = null;
});
document.getElementById("modal-confirm").addEventListener("click", async () => {
	if (!deleteTarget) return;
	modal.style.display = "none";
	try {
		await apiFetch(`/delete/${deleteTarget}`, {
			method: "DELETE",
		});
		toast("Task deleted");
		loadTasks();
	} catch (e) {
		toast(e.message, "error");
	}
	deleteTarget = null;
});
modal.addEventListener("click", (e) => {
	if (e.target === modal) {
		modal.style.display = "none";
		deleteTarget = null;
	}
});

searchInput.addEventListener("input", renderTasks);

/* ── INIT ───────────────────────────────────────────── */
loadTasks();
