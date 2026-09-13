const STORAGE_KEY = "tracker-trackerov:data";
const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/* ---------- Утилиты дат ---------- */

function todayKey() {
  return dateKey(new Date());
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function startOfWeek(d) {
  // понедельник — первый день недели
  const day = d.getDay(); // 0 = Вс
  const diff = day === 0 ? -6 : 1 - day;
  const monday = addDays(d, diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatHeaderDate() {
  const d = new Date();
  const str = d.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatShortDate(d) {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function formatAddedAt(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const timePart = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} в ${timePart}`;
}

/* ---------- Хранилище ---------- */

function loadTrackers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    parsed.forEach((t) => {
      if (!t.createdAt) t.createdAt = Date.now();
    });
    return parsed;
  } catch (e) {
    console.error("Не удалось прочитать данные", e);
    return [];
  }
}

function saveTrackers(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let trackers = loadTrackers();
let expandedId = null;
let editingId = null;

/* ---------- Стрик ---------- */

function computeStreak(tracker) {
  let streak = 0;
  let cursor = new Date();
  if (tracker.history[todayKey()] !== "done") {
    cursor = addDays(cursor, -1);
  }
  while (true) {
    const key = dateKey(cursor);
    if (tracker.history[key] === "done") {
      streak += 1;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

/* ---------- Рендер ---------- */

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const statDoneEl = document.getElementById("statDone");
const statStreakEl = document.getElementById("statStreak");
const dateEl = document.getElementById("headerDate");
const weekHeaderEl = document.getElementById("weekHeader");

function renderWeekHeader() {
  weekHeaderEl.innerHTML = "";
  const monday = startOfWeek(new Date());
  const todayStr = todayKey();
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const cell = document.createElement("div");
    cell.className = "weekday";
    if (dateKey(d) === todayStr) cell.classList.add("is-today");
    cell.innerHTML = `<span class="weekday__label">${WEEKDAY_LABELS[i]}</span><span class="weekday__num">${d.getDate()}</span>`;
    weekHeaderEl.appendChild(cell);
  }
}

function render() {
  dateEl.textContent = formatHeaderDate();
  renderWeekHeader();

  const doneToday = trackers.filter((t) => t.history[todayKey()] === "done").length;
  const bestStreak = trackers.reduce((max, t) => Math.max(max, computeStreak(t)), 0);
  statDoneEl.textContent = trackers.length ? `${doneToday}/${trackers.length}` : "0/0";
  statStreakEl.textContent = bestStreak > 0 ? `${bestStreak} 🔥` : "—";

  listEl.innerHTML = "";

  if (trackers.length === 0) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const sorted = [...trackers].sort((a, b) => {
    const rank = (t) => (t.history[todayKey()] ? 1 : 0);
    return rank(a) - rank(b);
  });

  sorted.forEach((tracker) => {
    listEl.appendChild(renderTracker(tracker));
  });
}

function renderTracker(tracker) {
  const status = tracker.history[todayKey()];
  const card = document.createElement("div");
  card.className = "tracker";
  if (status === "done") card.classList.add("is-done");
  if (status === "miss") card.classList.add("is-miss");

  const streak = computeStreak(tracker);
  const isOpen = expandedId === tracker.id;

  card.innerHTML = `
    <div class="tracker__top">
      <div class="tracker__body" data-action="edit">
        <div class="tracker__name">${escapeHtml(tracker.name)}</div>
        <div class="tracker__meta">
          ${tracker.time ? `<span class="tracker__time">⏰ ${escapeHtml(tracker.time)}</span>` : ""}
          ${streak > 0 ? `<span class="tracker__streak">🔥 ${streak} ${streak === 1 ? "день" : "дней"}</span>` : ""}
        </div>
      </div>
      <div class="tracker__actions">
        <button class="mark-btn done-btn ${status === "done" ? "is-active" : ""}" aria-label="Сделал" data-action="done">✓</button>
        <button class="mark-btn miss-btn ${status === "miss" ? "is-active" : ""}" aria-label="Не сделал" data-action="miss">✕</button>
        <button class="tracker__expand ${isOpen ? "is-open" : ""}" aria-label="История" data-action="toggle">▾</button>
      </div>
    </div>
    <div class="tracker__history ${isOpen ? "is-open" : ""}">
      <div class="history__weekdays"></div>
      <div class="history__grid"></div>
      <div class="tracker__added">Добавлен: ${formatAddedAt(tracker.createdAt)}</div>
      <button class="tracker__delete" data-action="delete">Удалить трекер</button>
    </div>
  `;

  if (isOpen) {
    const weekdaysRow = card.querySelector(".history__weekdays");
    WEEKDAY_LABELS.forEach((label) => {
      const el = document.createElement("div");
      el.className = "history__weekday-label";
      el.textContent = label;
      weekdaysRow.appendChild(el);
    });
    const grid = card.querySelector(".history__grid");
    grid.appendChild(renderHistoryGrid(tracker));
  }

  card.querySelector('[data-action="done"]').addEventListener("click", () => {
    toggleMark(tracker.id, "done");
  });
  card.querySelector('[data-action="miss"]').addEventListener("click", () => {
    toggleMark(tracker.id, "miss");
  });
  card.querySelector('[data-action="toggle"]').addEventListener("click", () => {
    expandedId = isOpen ? null : tracker.id;
    render();
  });
  card.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTracker(tracker.id);
  });
  card.querySelector('[data-action="edit"]').addEventListener("click", () => {
    openEditModal(tracker.id);
  });

  return card;
}

function renderHistoryGrid(tracker) {
  const frag = document.createDocumentFragment();
  const monday = startOfWeek(new Date());
  const start = addDays(monday, -14); // 3 полные недели, заканчивая текущей
  const todayStr = todayKey();
  const createdKey = dateKey(new Date(tracker.createdAt));

  for (let i = 0; i < 21; i++) {
    const d = addDays(start, i);
    const key = dateKey(d);
    const status = tracker.history[key];
    const isFuture = key > todayStr;
    const isBeforeCreated = key < createdKey;

    const cell = document.createElement("div");
    cell.className = "history__cell";
    if (key === todayStr) cell.classList.add("is-today-cell");
    if (isFuture || isBeforeCreated) {
      cell.classList.add("is-empty");
      cell.textContent = String(d.getDate());
    } else if (status === "done") {
      cell.classList.add("is-done");
      cell.textContent = "✓";
    } else if (status === "miss") {
      cell.classList.add("is-miss");
      cell.textContent = "✕";
    } else {
      cell.textContent = String(d.getDate());
    }
    cell.title = formatShortDate(d);
    frag.appendChild(cell);
  }
  return frag;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Действия ---------- */

function toggleMark(id, mark) {
  const tracker = trackers.find((t) => t.id === id);
  if (!tracker) return;
  const key = todayKey();
  if (tracker.history[key] === mark) {
    delete tracker.history[key];
  } else {
    tracker.history[key] = mark;
  }
  saveTrackers(trackers);
  render();
}

function deleteTracker(id) {
  if (!confirm("Удалить этот трекер и всю его историю?")) return;
  trackers = trackers.filter((t) => t.id !== id);
  saveTrackers(trackers);
  render();
}

function addTracker(name, time) {
  trackers.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    time: time || "",
    createdAt: Date.now(),
    history: {},
  });
  saveTrackers(trackers);
  render();
}

function updateTracker(id, name, time) {
  const tracker = trackers.find((t) => t.id === id);
  if (!tracker) return;
  tracker.name = name;
  tracker.time = time || "";
  saveTrackers(trackers);
  render();
}

/* ---------- Модалка добавления / редактирования ---------- */

const overlay = document.getElementById("overlay");
const nameInput = document.getElementById("nameInput");
const timeInput = document.getElementById("timeInput");
const modalTitle = document.getElementById("modalTitle");
const submitBtn = document.getElementById("submitBtn");

function openModal() {
  editingId = null;
  modalTitle.textContent = "Новый трекер";
  submitBtn.textContent = "Добавить";
  overlay.classList.add("is-open");
  nameInput.value = "";
  timeInput.value = "";
  setTimeout(() => nameInput.focus(), 50);
}

function openEditModal(id) {
  const tracker = trackers.find((t) => t.id === id);
  if (!tracker) return;
  editingId = id;
  modalTitle.textContent = "Изменить трекер";
  submitBtn.textContent = "Сохранить";
  overlay.classList.add("is-open");
  nameInput.value = tracker.name;
  timeInput.value = tracker.time || "";
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  overlay.classList.remove("is-open");
  editingId = null;
}

document.getElementById("fab").addEventListener("click", openModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const time = timeInput.value.trim();
  if (editingId) {
    updateTracker(editingId, name, time);
  } else {
    addTracker(name, time);
  }
  closeModal();
});

/* ---------- Инициализация ---------- */

render();

/* ---------- PWA: регистрация service worker ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker не зарегистрирован:", err);
    });
  });
}

/* ---------- Кнопка установки на Android ---------- */

const installBtn = document.getElementById("installBtn");
let deferredInstallEvent = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallEvent = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallEvent) return;
  deferredInstallEvent.prompt();
  await deferredInstallEvent.userChoice;
  deferredInstallEvent = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});
