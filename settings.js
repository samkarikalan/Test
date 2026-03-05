/* ============================================================
   HOME — Theme, font size, language, reset actions
   File: home.js
   ============================================================ */

let pendingAction = null;

function t(key) {
  return translations[currentLang]?.[key] || key;
}

function showConfirm(messageKey, action) {
  const overlay = document.getElementById("confirmOverlay");
  const title   = document.getElementById("confirmTitle");
  const yesBtn  = document.getElementById("confirmYes");
  const cancelBtn = document.getElementById("confirmCancel");

  title.textContent = t(messageKey);
  yesBtn.textContent = t("yes");
  cancelBtn.textContent = t("cancel");

  pendingAction = action;
  overlay.classList.remove("hidden");

  // ✅ YES button
  yesBtn.onclick = () => {
    pendingAction && pendingAction();
    closeConfirm();
  };

  // ✅ CANCEL button (THIS enables it)
  cancelBtn.onclick = closeConfirm;
}

function closeConfirm() {
  document.getElementById("confirmOverlay").classList.add("hidden");
  pendingAction = null;
}


let currentLang = "en";

function toggleLangMenu() {
  const menu = document.getElementById('langMenu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';  
}

document.querySelectorAll('.lang-menu div').forEach(item => {
  item.addEventListener('click', () => {
    document.getElementById('currentFlag').textContent = item.dataset.flag;
    setLanguage(item.dataset.lang);
    document.getElementById('langMenu').style.display = 'none';
  });
});



const langFlagMap = {
  en: "🇺🇸",
  jp: "🇯🇵",
  zh: "🇨🇳",
  kr: "🇰🇷",
  vi: "🇻🇳"
  
};
/* ===== Theme ===== */

function initLanguage() {
const savedLang = localStorage.getItem("appLanguage");
const supportedLangs = ["en", "jp", "kr", "vi"];
 // 2. update flag
  document.getElementById("currentFlag").textContent =
    langFlagMap[savedLang] || "🌐";
  
if (supportedLangs.includes(savedLang)) {
setLanguage(savedLang);
//updateHelpLanguage(savedLang);
} else {
const browserLang = navigator.language.toLowerCase();
if (browserLang.startsWith("ja")) {
setLanguage("jp");
//updateHelpLanguage("jp");
} else if (browserLang.startsWith("ko")) {
setLanguage("kr");
//updateHelpLanguage("kr");
} else if (browserLang.startsWith("vi")) {
setLanguage("vi");
//updateHelpLanguage("vi");
} else {
setLanguage("en");
//updateHelpLanguage("en");
}
}
}

function initTheme() {
  const saved = localStorage.getItem('app-theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

function initFontSize() {
  const savedSize = localStorage.getItem("appFontSize") || "medium";
  setFontSize(savedSize);
}


function applyTheme(mode) {
  document.body.classList.toggle('app-light', mode === 'light');
  document.body.classList.toggle('app-dark',  mode === 'dark');
  document.getElementById('theme_light')?.classList.toggle('active', mode === 'light');
  document.getElementById('theme_dark')?.classList.toggle('active',  mode === 'dark');
  localStorage.setItem('app-theme', mode);
}

function setTheme(mode) {
  applyTheme(mode);
}

/* ===== Init ===== */
initTheme();



document.addEventListener("DOMContentLoaded", () => {
  initTheme();     // restore theme
  initFontSize();  // restore font size
  initLanguage();  // restore language
});



function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("appLanguage", lang);

  document.querySelectorAll("[id^='lang_']").forEach(btn => {
    btn.classList.remove("active");
  });
  document.getElementById("lang_" + lang)?.classList.add("active");

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = translations[lang][key] || key;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = translations[lang][key] || "";
  });
  
   loadHelp(currentHelpSection);
}

function updateRoundTitle(round) {
  const roundTitle = document.getElementById("roundTitle");
  if (!roundTitle) return;

  roundTitle.innerText = `${translations[currentLang].nround} ${round}`;
}

function setFontSize(size) {
  const root = document.documentElement;

  if (size === "small") root.style.setProperty("--base-font-size", "12px");
  if (size === "medium") root.style.setProperty("--base-font-size", "14px");
  if (size === "large") root.style.setProperty("--base-font-size", "17px");

  localStorage.setItem("appFontSize", size); // 👈 SAVE (ADD THIS)

  document.querySelectorAll("#font_small, #font_medium, #font_large").forEach(el => {
    el.classList.remove("active");
  });

  document.getElementById(`font_${size}`)?.classList.add("active");
}


function ResetAll() {
  location.reload(); // This refreshes the entire app clean
  document.getElementById("reset_all").classList.remove("active");
}


function resetRounds() {
  // 1️⃣ Clear all previous rounds
  allRounds.length = 0;
  initScheduler(1);  
  clearPreviousRound();
  goToRounds();
  report(); 
  sessionFinished = false;
  document.getElementById("nextBtn").disabled = false;
  document.getElementById("roundShufle").disabled = false;

  // Optional: also disable End to prevent double-click
  //document.getElementById("endBtn").disabled = false;
	
  const btn = document.getElementById("reset_rounds_btn");
  if (btn) {
    btn.classList.remove("active");
  }
}

/* =========================
   PLAYER MANAGEMENT (Settings Tab)
========================= */
const ADMIN_DEFAULT_PASSWORD = "1234";
let adminModalMode = "unlock"; // "unlock" | "changepwd"

function adminGetPassword() {
  return localStorage.getItem("adminPassword") || ADMIN_DEFAULT_PASSWORD;
}

// ── Unlock flow ──
function playerMgmtUnlock() {
  adminModalMode = "unlock";
  document.getElementById("adminModalTitle").textContent = "🔐 Admin Access";
  document.getElementById("adminPasswordConfirmRow").style.display = "none";
  document.getElementById("adminModalError").textContent = "";
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("adminModal").style.display = "flex";
  setTimeout(() => document.getElementById("adminPasswordInput").focus(), 100);
}

function playerMgmtLock() {
  document.getElementById("playerMgmtLocked").style.display = "block";
  document.getElementById("playerMgmtUnlocked").style.display = "none";
}

// ── Change password flow ──
function playerMgmtChangePwd() {
  adminModalMode = "changepwd";
  document.getElementById("adminModalTitle").textContent = "🔑 Change Password";
  document.getElementById("adminPasswordConfirmRow").style.display = "block";
  document.getElementById("adminModalError").textContent = "";
  document.getElementById("adminPasswordInput").value = "";
  document.getElementById("adminPasswordConfirm").value = "";
  document.getElementById("adminModal").style.display = "flex";
  setTimeout(() => document.getElementById("adminPasswordInput").focus(), 100);
}

function adminCloseModal() {
  document.getElementById("adminModal").style.display = "none";
}

function adminVerifyPassword() {
  const input = document.getElementById("adminPasswordInput").value;
  const err   = document.getElementById("adminModalError");

  if (adminModalMode === "unlock") {
    if (input === adminGetPassword()) {
      adminCloseModal();
      document.getElementById("playerMgmtLocked").style.display = "none";
      document.getElementById("playerMgmtUnlocked").style.display = "block";
      playerMgmtRenderList();
    } else {
      err.textContent = "Wrong password. Try again.";
      document.getElementById("adminPasswordInput").value = "";
    }

  } else if (adminModalMode === "changepwd") {
    const confirm = document.getElementById("adminPasswordConfirm").value;
    if (input.length < 4) {
      err.textContent = "Password must be at least 4 characters."; return;
    }
    if (input !== confirm) {
      err.textContent = "Passwords do not match."; return;
    }
    localStorage.setItem("adminPassword", input);
    adminCloseModal();
    alert("Password changed successfully.");
  }
}

// ── Render master player list ──
function playerMgmtRenderList() {
  const container = document.getElementById("playerMgmtList");
  container.innerHTML = "";

  // Master DB = newImportHistory
  const players = newImportState.historyPlayers || [];

  if (players.length === 0) {
    container.innerHTML = '<p class="player-mgmt-empty">No players in database yet.</p>';
    return;
  }

  const sorted = [...players].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  sorted.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "player-mgmt-row";
    row.innerHTML = `
      <img src="${p.gender === 'Female' ? 'female.png' : 'male.png'}"
           class="player-mgmt-avatar"
           onclick="playerMgmtToggleGender('${p.displayName}')"
           title="Tap to toggle gender">
      <span class="player-mgmt-name">${p.displayName}</span>
      <input type="number" class="rating-edit-input"
        value="${(p.rating || 1.0).toFixed(1)}"
        min="1.0" max="5.0" step="0.1"
        onchange="playerMgmtSaveRating('${p.displayName}', this.value)">
      <button class="player-mgmt-del-btn"
        onclick="playerMgmtDelete('${p.displayName}')">🗑</button>
    `;
    container.appendChild(row);
  });
}

// ── Save rating to master DB ──
function playerMgmtSaveRating(displayName, value) {
  const rating = Math.round(parseFloat(value) * 10) / 10;
  if (isNaN(rating) || rating < 1.0 || rating > 5.0) return;
  const key = displayName.trim().toLowerCase();

  // Update master DB
  const hp = newImportState.historyPlayers.find(p => p.displayName.trim().toLowerCase() === key);
  if (hp) hp.rating = rating;
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));

  // Sync into schedulerState and refresh Players tab
  syncPlayersFromMaster();
  updatePlayerList();
}

// ── Toggle gender ──
function playerMgmtToggleGender(displayName) {
  const key = displayName.trim().toLowerCase();
  const hp  = newImportState.historyPlayers.find(p => p.displayName.trim().toLowerCase() === key);
  if (!hp) return;
  hp.gender = hp.gender === "Female" ? "Male" : "Female";
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  const sp = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
  if (sp) { sp.gender = hp.gender; saveAllPlayersState(); }
  playerMgmtRenderList();
}

// ── Delete from master DB ──
function playerMgmtDelete(displayName) {
  if (!confirm(`Remove "${displayName}" from player database?`)) return;
  const key = displayName.trim().toLowerCase();
  newImportState.historyPlayers = newImportState.historyPlayers.filter(
    p => p.displayName.trim().toLowerCase() !== key
  );
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  playerMgmtRenderList();
}

// ── Add new player ──
function playerMgmtAddNew() {
  const name = prompt("Enter player name:");
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (newImportState.historyPlayers.some(p => p.displayName.trim().toLowerCase() === key)) {
    alert("Player already exists."); return;
  }
  newImportState.historyPlayers.unshift({ displayName: trimmed, gender: "Male", rating: 1.0 });
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  playerMgmtRenderList();
}
