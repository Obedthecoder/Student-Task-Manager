const STORAGE_KEY = "studymate.tasks.v1";
const priorityOrder = { high: 0, medium: 1, low: 2 };
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
};

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createStarterTasks() {
  return [
    { id: createId(), title: "Project proposal review", course: "Software Engineering", dueDate: dateOffset(1), priority: "high", notes: "Check the objectives and final formatting.", completed: false, createdAt: Date.now() - 5000 },
    { id: createId(), title: "Web Technologies assignment", course: "Web Technologies", dueDate: dateOffset(2), priority: "high", notes: "Finish the responsive layout and test it.", completed: false, createdAt: Date.now() - 4000 },
    { id: createId(), title: "Visual Basic practical", course: "Visual Basic", dueDate: dateOffset(4), priority: "medium", notes: "Review the form validation exercises.", completed: false, createdAt: Date.now() - 3000 },
    { id: createId(), title: "Database normalisation notes", course: "Database Systems", dueDate: dateOffset(6), priority: "low", notes: "Summarise the normal forms from class.", completed: false, createdAt: Date.now() - 2000 },
    { id: createId(), title: "Find sources for research paper", course: "Communication Skills", dueDate: dateOffset(8), priority: "medium", notes: "Save at least three useful sources.", completed: false, createdAt: Date.now() - 1000 },
    { id: createId(), title: "Discrete Mathematics quiz", course: "Discrete Mathematics", dueDate: dateOffset(-1), priority: "medium", notes: "", completed: true, createdAt: Date.now() - 6000 }
  ];
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return createStarterTasks();
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((task) => task && typeof task.id === "string" && typeof task.title === "string") : createStarterTasks();
  } catch {
    return createStarterTasks();
  }
}

let tasks = loadTasks();
let activeFilter = "all";
let activeView = "dashboard";
let dueWeekOnly = false;
let toastTimer;

const taskList = document.querySelector("#task-list");
const upcomingList = document.querySelector("#upcoming-list");
const dialog = document.querySelector("#task-dialog");
const accountDialog = document.querySelector("#account-dialog");
const taskForm = document.querySelector("#task-form");
const searchInput = document.querySelector("#search-input");
const priorityFilter = document.querySelector("#priority-filter");
const sortSelect = document.querySelector("#sort-select");

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function getToday() {
  return localDateString(new Date());
}

function dateAtNoon(value) {
  return new Date(`${value}T12:00:00`);
}

function daysUntil(value) {
  const today = dateAtNoon(getToday());
  const target = dateAtNoon(value);
  return Math.round((target - today) / 86400000);
}

function formatDue(value) {
  if (!value) return "No due date";
  const difference = daysUntil(value);
  if (difference < 0) return `Overdue ${Math.abs(difference)}d`;
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  return `Due ${dateAtNoon(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const priority = priorityFilter.value;
  const statusFilter = activeView === "completed" ? "completed" : activeView === "tasks" && activeFilter === "all" ? "pending" : activeFilter;
  const visible = tasks.filter((task) => {
    const matchesStatus = statusFilter === "all" || (statusFilter === "completed" ? task.completed : !task.completed);
    const difference = task.dueDate ? daysUntil(task.dueDate) : null;
    const matchesWeek = !dueWeekOnly || (!task.completed && difference >= 0 && difference <= 7);
    const matchesPriority = priority === "all" || task.priority === priority;
    const searchable = `${task.title} ${task.course} ${task.notes || ""}`.toLowerCase();
    return matchesStatus && matchesWeek && matchesPriority && searchable.includes(query);
  });
  const sortBy = sortSelect.value;
  return visible.sort((first, second) => {
    if (sortBy === "priority") return priorityOrder[first.priority] - priorityOrder[second.priority] || first.dueDate.localeCompare(second.dueDate);
    if (sortBy === "created") return second.createdAt - first.createdAt;
    return first.dueDate.localeCompare(second.dueDate) || priorityOrder[first.priority] - priorityOrder[second.priority];
  });
}

function renderTask(task) {
  const dueDifference = task.dueDate ? daysUntil(task.dueDate) : null;
  const dueClass = !task.completed && dueDifference < 0 ? "is-overdue" : !task.completed && dueDifference === 0 ? "is-today" : "";
  const dueText = task.completed ? "Completed" : formatDue(task.dueDate);
  const notesTitle = task.notes ? ` title="${escapeHtml(task.notes)}"` : "";
  return `<article class="task-row ${task.completed ? "is-done" : ""}" data-task-row="${escapeHtml(task.id)}">
    <button class="task-check ${task.completed ? "is-checked" : ""}" type="button" data-action="toggle" data-id="${escapeHtml(task.id)}" aria-label="${task.completed ? "Mark as not complete" : "Mark as complete"}" aria-pressed="${task.completed}">${task.completed ? "✓" : ""}</button>
    <div class="task-main"${notesTitle}>
      <div class="task-title-line"><span class="task-title">${escapeHtml(task.title)}</span><span class="priority-pill priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></div>
      <div class="task-subline"><span class="course-label">${escapeHtml(task.course)}</span><span class="subline-dot">·</span><span>${task.completed ? "Completed" : "Coursework"}</span></div>
    </div>
    <div class="task-end"><span class="due-label ${dueClass}">${escapeHtml(dueText)}</span><div class="task-actions">
      <button class="icon-action" type="button" data-action="edit" data-id="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task">✎</button>
      <button class="icon-action delete" type="button" data-action="delete" data-id="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button>
    </div></div>
  </article>`;
}

function renderUpcoming() {
  const upcoming = tasks.filter((task) => !task.completed && task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  if (!upcoming.length) {
    upcomingList.innerHTML = '<div class="upcoming-empty">Nothing on the horizon. Enjoy the breathing room.</div>';
    return;
  }
  upcomingList.innerHTML = upcoming.map((task) => {
    const date = dateAtNoon(task.dueDate);
    const day = date.toLocaleDateString(undefined, { day: "numeric" });
    const month = date.toLocaleDateString(undefined, { month: "short" });
    return `<div class="upcoming-item"><div class="date-tile"><strong>${day}</strong><span>${month}</span></div><div class="upcoming-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.course)} · ${escapeHtml(formatDue(task.dueDate))}</span></div></div>`;
  }).join("");
}

function renderStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const dueThisWeek = tasks.filter((task) => !task.completed && task.dueDate && daysUntil(task.dueDate) >= 0 && daysUntil(task.dueDate) <= 7).length;
  const percentage = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  document.querySelector("#total-count").textContent = tasks.length;
  document.querySelector("#pending-count").textContent = pending;
  document.querySelector("#completed-count").textContent = completed;
  document.querySelector("#week-count").textContent = dueThisWeek;
  document.querySelector("#all-tab-count").textContent = tasks.length;
  document.querySelector("#nav-pending").textContent = pending;
  document.querySelector("#progress-percent").textContent = `${percentage}%`;
  document.querySelector("#progress-fraction").textContent = `${completed} / ${tasks.length}`;
  document.querySelector("#progress-ring").style.background = `conic-gradient(var(--coral) ${percentage}%, #f2f0eb ${percentage}% 100%)`;
  document.querySelector("#progress-ring").setAttribute("aria-label", `${percentage} percent of tasks completed`);
  document.querySelector("#progress-bar").style.width = `${percentage}%`;
  document.querySelector("#progress-caption").textContent = percentage === 100 && tasks.length ? "All wrapped up!" : completed ? "Nice steady progress" : "A fresh start";
  document.querySelector("#progress-detail").textContent = tasks.length ? `${pending} ${pending === 1 ? "task" : "tasks"} left to finish.` : "Add a task to get started.";
}

function render() {
  renderStats();
  renderUpcoming();
  const visible = getVisibleTasks();
  if (!visible.length) {
    const searching = searchInput.value.trim();
    const title = searching ? "No tasks found" : activeFilter === "completed" || activeView === "completed" ? "Nothing completed yet" : "All clear for now";
    const message = searching ? "Try a different search or clear your filters." : activeFilter === "completed" || activeView === "completed" ? "Finish a task and it will find a home here." : "Add a task when something new lands on your list.";
    taskList.innerHTML = `<div class="empty-state"><span class="empty-mark" aria-hidden="true">✓</span><h3>${title}</h3><p>${message}</p><button class="button button-primary" type="button" data-open-task><span aria-hidden="true">+</span> Add a task</button></div>`;
  } else {
    taskList.innerHTML = visible.map(renderTask).join("");
  }
  document.querySelector("#list-heading").textContent = dueWeekOnly ? "Due this week" : activeView === "completed" ? "Look what you’ve done" : activeView === "tasks" ? "Your to-do list" : "Let’s get things done";
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === activeView));
  document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("is-selected", item.dataset.filter === activeFilter));
}

function openTaskDialog(task) {
  taskForm.reset();
  document.querySelector("#task-id").value = task?.id || "";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-course").value = task?.course || "";
  document.querySelector("#task-due").value = task?.dueDate || dateOffset(1);
  document.querySelector("#task-priority").value = task?.priority || "medium";
  document.querySelector("#task-notes").value = task?.notes || "";
  document.querySelector("#dialog-title").textContent = task ? "Edit task" : "Add a task";
  document.querySelector("#save-task-button").innerHTML = task ? 'Save changes <span aria-hidden="true">→</span>' : 'Save task <span aria-hidden="true">→</span>';
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  document.querySelector("#task-title").focus();
}

function closeTaskDialog() {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function openAccountDialog() {
  if (typeof accountDialog.showModal === "function") {
    accountDialog.showModal();
  } else {
    accountDialog.setAttribute("open", "");
  }
}

function closeAccountDialog() {
  if (typeof accountDialog.close === "function") {
    accountDialog.close();
  } else {
    accountDialog.removeAttribute("open");
  }
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.summaryView) {
    dueWeekOnly = target.dataset.summaryView === "week";
    activeView = target.dataset.summaryView === "completed" ? "completed" : target.dataset.summaryView === "pending" || dueWeekOnly ? "tasks" : "dashboard";
    activeFilter = target.dataset.summaryView === "completed" ? "completed" : target.dataset.summaryView === "all" ? "all" : "pending";
    searchInput.value = "";
    priorityFilter.value = "all";
    render();
    document.querySelector(".section-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (target.hasAttribute("data-profile")) {
    openAccountDialog();
    return;
  }
  if (target.hasAttribute("data-close-account")) {
    closeAccountDialog();
    return;
  }
  if (target.hasAttribute("data-open-task")) {
    openTaskDialog();
    return;
  }
  if (target.hasAttribute("data-close-dialog")) {
    closeTaskDialog();
    return;
  }
  if (target.dataset.filter) {
    activeFilter = target.dataset.filter;
    activeView = "dashboard";
    dueWeekOnly = false;
    render();
    return;
  }
  if (target.dataset.view) {
    activeView = target.dataset.view;
    activeFilter = target.dataset.view === "completed" ? "completed" : "all";
    dueWeekOnly = false;
    render();
    return;
  }
  const { action, id } = target.dataset;
  if (!action || !id) return;
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  if (action === "toggle") {
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    saveTasks();
    render();
    showToast(task.completed ? "Task marked complete." : "Task moved back to your list.");
  }
  if (action === "edit") openTaskDialog(task);
  if (action === "delete" && window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
    tasks = tasks.filter((item) => item.id !== id);
    saveTasks();
    render();
    showToast("Task deleted.");
  }
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!taskForm.reportValidity()) return;
  const id = document.querySelector("#task-id").value;
  const existing = tasks.find((task) => task.id === id);
  const task = {
    id: id || createId(),
    title: document.querySelector("#task-title").value.trim(),
    course: document.querySelector("#task-course").value.trim(),
    dueDate: document.querySelector("#task-due").value,
    priority: document.querySelector("#task-priority").value,
    notes: document.querySelector("#task-notes").value.trim(),
    completed: existing?.completed || false,
    completedAt: existing?.completedAt || null,
    createdAt: existing?.createdAt || Date.now()
  };
  if (!task.title || !task.course || !task.dueDate) return;
  if (existing) {
    tasks = tasks.map((item) => item.id === id ? task : item);
  } else {
    tasks.push(task);
  }
  saveTasks();
  closeTaskDialog();
  activeView = "dashboard";
  activeFilter = "all";
  dueWeekOnly = false;
  render();
  showToast(existing ? "Your changes are saved." : "Task added to your plan.");
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeTaskDialog();
});
accountDialog.addEventListener("click", (event) => {
  if (event.target === accountDialog) closeAccountDialog();
});
accountDialog.addEventListener("cancel", closeAccountDialog);

searchInput.addEventListener("input", render);
priorityFilter.addEventListener("change", render);
sortSelect.addEventListener("change", render);
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});
document.querySelector("#today-label").textContent = formatLongDate(new Date()).toUpperCase();
render();