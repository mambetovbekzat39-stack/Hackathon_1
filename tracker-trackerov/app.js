// --- Хранение данных ---
const STORAGE_KEY = "tracker_trackerov_data_v2";

let state = {
  trackers: [], // { id, name, time, notify, createdAt, history: { "YYYY-MM-DD": "done" | "miss" } }
  achievements: []
};

// Константы достижений
const ACHIEVEMENTS_LIST = [
  { id: "first_step", icon: "🏅", name: "Первый шаг", desc: "Выполни свой первый трекер" },
  { id: "week_streak", icon: "🔥", name: "Неделя", desc: "Серия из 7 дней подряд" },
  { id: "discipline", icon: "💪", name: "Дисциплина", desc: "Серия из 30 дней подряд" },
  { id: "perfect_month", icon: "👑", name: "Месяц", desc: "100% выполнение за прошлые 30 дней" },
  { id: "iron_will", icon: "💎", name: "Железная воля", desc: "Серия из 100 дней подряд" }
];

// --- Инициализация ---
function init() {
  loadData();
  setupEvents();
  renderHeaderDate();
  renderWeekHeader();
  renderTrackers();
  updateStats();
  initPWAInstall();
  initNotifications();
}

function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      state = JSON.parse(data);
    } catch (e) {
      console.error("Ошибка загрузки данных", e);
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateStats();
  checkAchievements();
}

// --- Даты и Форматирование ---
function getTodayStr() {
  const d = new Date();
  return formatDateKey(d);
}

function formatDateKey(d) {
  return d.toISOString().split("T")[0];
}

function renderHeaderDate() {
  const d = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById("headerDate").textContent = d.toLocaleDateString("ru-RU", options);
}

// --- Полоса недели и календарь ---
function renderWeekHeader() {
  const container = document.getElementById("weekHeader");
  container.innerHTML = "";
  
  const today = new Date();
  const currentDayOfWeek = (today.getDay() + 6) % 7; // Понедельник = 0
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - currentDayOfWeek + i);
    
    const isToday = formatDateKey(d) === getTodayStr();
    const dayName = d.toLocaleDateString("ru-RU", { weekday: "short" });
    const dayNum = d.getDate();
    
    const el = document.createElement("div");
    el.className = `weekday ${isToday ? "is-today" : ""}`;
    el.innerHTML = `
      <span class="weekday__label">${dayName}</span>
      <span class="weekday__num">${dayNum}</span>
    `;
    container.appendChild(el);
  }
}

// --- Отрисовка списка трекеров ---
function renderTrackers() {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  listEl.innerHTML = "";

  if (state.trackers.length === 0) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const todayStr = getTodayStr();

  // Сортировка: Сначала не отмеченные за сегодня
  const sorted = [...state.trackers].sort((a, b) => {
    const aDone = a.history[todayStr] ? 1 : 0;
    const bDone = b.history[todayStr] ? 1 : 0;
    return aDone - bDone;
  });

  sorted.forEach(t => {
    const status = t.history[todayStr];
    const streak = calculateTrackerStreak(t);
    
    const card = document.createElement("div");
    card.className = `tracker ${status === "done" ? "is-done" : status === "miss" ? "is-miss" : ""}`;
    
    card.innerHTML = `
      <div class="tracker__top">
        <div class="tracker__body">
          <div class="tracker__name" onclick="openEditModal('${t.id}')">${escapeHtml(t.name)}</div>
          <div class="tracker__meta">
            ${t.time ? `<span class="tracker__time">⏰ ${t.time}</span>` : ""}
            <span class="tracker__streak">🔥 ${streak} дн.</span>
          </div>
        </div>
        <div class="tracker__actions">
          <button class="mark-btn done-btn ${status === "done" ? "is-active" : ""}" onclick="toggleStatus('${t.id}', 'done')">✓</button>
          <button class="mark-btn miss-btn ${status === "miss" ? "is-active" : ""}" onclick="toggleStatus('${t.id}', 'miss')">✕</button>
          <button class="tracker__expand" onclick="toggleHistory(this)">▾</button>
        </div>
      </div>
      <div class="tracker__history">
        <div class="history__grid">${renderHistoryGrid(t)}</div>
        <div class="tracker__footer">
          <span>Добавлен: ${t.createdAt}</span>
          <button class="tracker__delete" onclick="deleteTracker('${t.id}')">Удалить</button>
        </div>
      </div>
    `;
    listEl.appendChild(card);
  });
}

function renderHistoryGrid(tracker) {
  let html = "";
  const today = new Date();
  
  // Показываем последние 14 дней
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    const st = tracker.history[key];
    
    html += `<div class="history__cell ${st === 'done' ? 'is-done' : st === 'miss' ? 'is-miss' : ''}">${d.getDate()}</div>`;
  }
  return html;
}

// --- Логика отметок и Стриков ---
function toggleStatus(id, newStatus) {
  const tracker = state.trackers.find(t => t.id === id);
  if (!tracker) return;

  const todayStr = getTodayStr();
  if (tracker.history[todayStr] === newStatus) {
    delete tracker.history[todayStr];
  } else {
    tracker.history[todayStr] = newStatus;
  }

  saveData();
  renderTrackers();
  checkDayCompletion();
}

function calculateTrackerStreak(tracker) {
  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    
    if (tracker.history[key] === "done") {
      streak++;
    } else if (i === 0 && !tracker.history[key]) {
      // Если сегодня ещё не отмечено, не прерываем вчерашний стрик
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function calculateGlobalStreak() {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);

    const allDone = state.trackers.length > 0 && state.trackers.every(t => t.history[key] === "done");
    
    if (allDone) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// --- Красивое завершение дня ---
function checkDayCompletion() {
  if (state.trackers.length === 0) return;
  
  const todayStr = getTodayStr();
  const allDone = state.trackers.every(t => t.history[todayStr] === "done");

  if (allDone) {
    const streak = calculateGlobalStreak();
    document.getElementById("celebrationStreak").textContent = `🔥 ${streak} ${pluralDays(streak)} подряд`;
    document.getElementById("celebrationOverlay").classList.add("is-open");
  }
}

// --- Оконное управление и события ---
function setupEvents() {
  // Добавление / Редактирование
  document.getElementById("fab").onclick = () => openAddModal();
  document.getElementById("cancelBtn").onclick = () => closeModal("overlay");
  document.getElementById("addForm").onsubmit = handleFormSubmit;

  // Виды Неделя/Месяц
  document.getElementById("viewWeekBtn").onclick = () => switchView("week");
  document.getElementById("viewMonthBtn").onclick = () => switchView("month");

  // Модальные окна
  document.getElementById("statsNavBtn").onclick = () => openStatsModal();
  document.getElementById("closeStatsBtn").onclick = () => closeModal("statsOverlay");
  document.getElementById("settingsNavBtn").onclick = () => openModal("settingsOverlay");
  document.getElementById("closeSettingsBtn").onclick = () => closeModal("settingsOverlay");
  document.getElementById("closeCelebrationBtn").onclick = () => closeModal("celebrationOverlay");

  // Резервные копии
  document.getElementById("exportBtn").onclick = exportData;
  document.getElementById("importInput").onchange = importData;
}

function openAddModal() {
  document.getElementById("modalTitle").textContent = "Новый трекер";
  document.getElementById("editTrackerId").value = "";
  document.getElementById("addForm").reset();
  openModal("overlay");
}

function openEditModal(id) {
  const t = state.trackers.find(x => x.id === id);
  if (!t) return;

  document.getElementById("modalTitle").textContent = "Редактировать трекер";
  document.getElementById("editTrackerId").value = t.id;
  document.getElementById("nameInput").value = t.name;
  document.getElementById("timeInput").value = t.time || "";
  document.getElementById("notifyInput").checked = !!t.notify;
  openModal("overlay");
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("editTrackerId").value;
  const name = document.getElementById("nameInput").value.trim();
  const time = document.getElementById("timeInput").value;
  const notify = document.getElementById("notifyInput").checked;

  if (!name) return;

  if (id) {
    const tracker = state.trackers.find(t => t.id === id);
    if (tracker) {
      tracker.name = name;
      tracker.time = time;
      tracker.notify = notify;
    }
  } else {
    const now = new Date();
    const createdStr = `${now.getDate()} ${now.toLocaleDateString("ru-RU", { month: "short" })} в ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    state.trackers.push({
      id: Date.now().toString(),
      name,
      time,
      notify,
      createdAt: createdStr,
      history: {}
    });
  }

  saveData();
  renderTrackers();
  closeModal("overlay");
}

function deleteTracker(id) {
  if (confirm("Удалить этот трекер?")) {
    state.trackers = state.trackers.filter(t => t.id !== id);
    saveData();
    renderTrackers();
  }
}

function toggleHistory(btn) {
  btn.classList.toggle("is-open");
  const historyEl = btn.closest(".tracker").querySelector(".tracker__history");
  historyEl.classList.toggle("is-open");
}

function openModal(id) { document.getElementById(id).classList.add("is-open"); }
function closeModal(id) { document.getElementById(id).classList.remove("is-open"); }

// --- Статистика & Календарь ---
function updateStats() {
  const todayStr = getTodayStr();
  const doneToday = state.trackers.filter(t => t.history[todayStr] === "done").length;
  const total = state.trackers.length;

  document.getElementById("statDone").textContent = `${doneToday}/${total}`;
  document.getElementById("statStreak").textContent = `🔥 ${calculateGlobalStreak()}`;
}

function openStatsModal() {
  // Расчёт показателей
  const totalTrackers = state.trackers.length;
  let weekDone = 0;
  let weekTotal = totalTrackers * 7;

  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    state.trackers.forEach(t => {
      if (t.history[key] === "done") weekDone++;
    });
  }

  const percent = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
  
  document.getElementById("statWeekScore").textContent = `${weekDone}/${weekTotal}`;
  document.getElementById("statPercent").textContent = `${percent}%`;
  document.getElementById("statBestStreak").textContent = `${calculateGlobalStreak()} дн.`;

  renderAchievements();
  openModal("statsOverlay");
}

function switchView(view) {
  const weekStrip = document.getElementById("weekHeader");
  const monthView = document.getElementById("monthView");
  const weekBtn = document.getElementById("viewWeekBtn");
  const monthBtn = document.getElementById("viewMonthBtn");

  if (view === "week") {
    weekStrip.classList.remove("hidden");
    monthView.classList.add("hidden");
    weekBtn.classList.add("active");
    monthBtn.classList.remove("active");
  } else {
    weekStrip.classList.add("hidden");
    monthView.classList.remove("hidden");
    weekBtn.classList.remove("active");
    monthBtn.classList.add("active");
    renderMonthCalendar();
  }
}

function renderMonthCalendar() {
  const grid = document.getElementById("monthGrid");
  grid.innerHTML = "";
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startDay = (firstDay.getDay() + 6) % 7; // Пн = 0
  
  // Пустые ячейки в начале
  for (let i = 0; i < startDay; i++) {
    grid.innerHTML += `<div class="month-day is-empty"></div>`;
  }

  // Дни месяца
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month, d);
    const key = formatDateKey(dateObj);
    
    // День считается "золотым", если выполнена хотя бы половина задач
    const doneCount = state.trackers.filter(t => t.history[key] === "done").length;
    const isGood = state.trackers.length > 0 && doneCount >= Math.ceil(state.trackers.length / 2);

    grid.innerHTML += `<div class="month-day ${isGood ? 'is-active' : ''}">${d}</div>`;
  }
}

// --- Достижения ---
function checkAchievements() {
  const unlocked = state.achievements || [];
  const streak = calculateGlobalStreak();

  if (state.trackers.some(t => Object.values(t.history).includes("done")) && !unlocked.includes("first_step")) {
    unlocked.push("first_step");
  }
  if (streak >= 7 && !unlocked.includes("week_streak")) unlocked.push("week_streak");
  if (streak >= 30 && !unlocked.includes("discipline")) unlocked.push("discipline");
  if (streak >= 100 && !unlocked.includes("iron_will")) unlocked.push("iron_will");

  state.achievements = unlocked;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAchievements() {
  const container = document.getElementById("achievementsList");
  container.innerHTML = "";

  ACHIEVEMENTS_LIST.forEach(a => {
    const isUnlocked = (state.achievements || []).includes(a.id);
    const el = document.createElement("div");
    el.className = `achievement ${isUnlocked ? 'unlocked' : ''}`;
    el.innerHTML = `
      <div class="achievement__icon">${a.icon}</div>
      <div>
        <div class="achievement__title">${a.name}</div>
        <div class="achievement__desc">${a.desc}</div>
      </div>
    `;
    container.appendChild(el);
  });
}

// --- Резервные копии (Экспорт/Импорт) ---
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tracker_backup_${getTodayStr()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedState = JSON.parse(event.target.result);
      if (importedState && importedState.trackers) {
        state = importedState;
        saveData();
        init();
        alert("Данные успешно импортированы!");
        closeModal("settingsOverlay");
      }
    } catch (err) {
      alert("Ошибка при чтении файла резервной копии");
    }
  };
  reader.readAsText(file);
}

// --- PWA & Уведомления ---
function initPWAInstall() {
  let deferredPrompt;
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;

    installBtn.onclick = () => {
      installBtn.hidden = true;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
    };
  });
}

function initNotifications() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pluralDays(n) {
  return n === 1 ? "день" : (n >= 2 && n <= 4) ? "дня" : "дней";
}

// Старт приложения
document.addEventListener("DOMContentLoaded", init);
