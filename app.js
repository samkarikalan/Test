
/* ============================================================
   MAIN — Navigation, tab access, scheduler init, round progression
   File: main.js
   ============================================================ */

let sessionFinished = false;
let lastPage = null;



function isPageVisible(pageId) {
  const el = document.getElementById(pageId);
  return el && el.style.display !== 'none';
}


function updateRoundsPageAccess() {
  const block = schedulerState.activeplayers.length < 4;
  const tabs = document.querySelectorAll('.tab-btn');
  const roundsTab = tabs[1]; // page2

  if (!roundsTab) return;

  roundsTab.style.pointerEvents = block ? 'none' : 'auto';
  roundsTab.style.opacity = block ? '0.4' : '1';
  roundsTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('roundsPage')) {
    showPage('playersPage', tabs[0]);
  }
	
}


function updateSummaryPageAccess() {
  const hasRounds = Array.isArray(allRounds) && allRounds.length > 0;
  const tabs = document.querySelectorAll('.tab-btn');
  const summaryTab = tabs[2]; // page3

  const block = !hasRounds;

  if (!summaryTab) return;

  summaryTab.style.pointerEvents = block ? 'none' : 'auto';
  summaryTab.style.opacity = block ? '0.4' : '1';
  summaryTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('summaryPage')) {
    showPage('playersPage', tabs[0]);
  }
}


document.addEventListener('DOMContentLoaded', () => {
  updateRoundsPageAccess();
  updateSummaryPageAccess();
});


function updateRoundsPageAccess() {
  const block = schedulerState.activeplayers.length < 4;
  const tabs = document.querySelectorAll('.tab-btn');
  const roundsTab = tabs[2]; // ← was 1, now 2 (Settings added at 0)

  if (!roundsTab) return;

  roundsTab.style.pointerEvents = block ? 'none' : 'auto';
  roundsTab.style.opacity = block ? '0.4' : '1';
  roundsTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('roundsPage')) {
    showPage('playersPage', tabs[1]);
  }
}


function updateSummaryPageAccess() {
  const hasRounds = Array.isArray(allRounds) && allRounds.length > 0;
  const tabs = document.querySelectorAll('.tab-btn');
  const summaryTab = tabs[3]; // ← was 2, now 3

  const block = !hasRounds;

  if (!summaryTab) return;

  summaryTab.style.pointerEvents = block ? 'none' : 'auto';
  summaryTab.style.opacity = block ? '0.4' : '1';
  summaryTab.setAttribute('aria-disabled', block);

  if (block && isPageVisible('summaryPage')) {
    showPage('playersPage', tabs[1]);
  }
}

function showPage(pageID, el) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Show selected page
  document.getElementById(pageID).style.display = 'block';

  // Update active tab styling
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  // ── Move shared player slot to the active page ──
  const slot = document.getElementById('sharedPlayerSlot');
  if (pageID === 'playersPage') {
    const anchor = document.getElementById('playersSlotAnchor');
    if (slot && anchor) anchor.appendChild(slot);
  } else if (pageID === 'roundsPage') {
    const anchor = document.getElementById('roundsSlotAnchor');
    if (slot && anchor) anchor.appendChild(slot);
  }

  // ➜ Additional action when roundsPage is opened
  if (pageID === "roundsPage") {
    if (sessionFinished) {
      console.warn("Rounds already finished");
      return;
    }
    updateMixedSessionFlag();
    if (allRounds.length <= 1) {
      resetRounds();
    } else {
      if (lastPage === "playersPage") {
        goToRounds();
      }
    }
  }

  if (pageID === "summaryPage") {
    report();
    renderRounds();
  }

  if (pageID === "helpPage") {}

  // Update last visited page
  lastPage = pageID;
}

let IS_MIXED_SESSION = false;

function updateMixedSessionFlag() {
  let hasMale = false;
  let hasFemale = false;

  for (const p of schedulerState.allPlayers) {
    if (p.gender === "Male") hasMale = true;
    if (p.gender === "Female") hasFemale = true;
    if (hasMale && hasFemale) break;
  }

  IS_MIXED_SESSION = hasMale && hasFemale;
}

	




function goBack() {
  updatePlayerList();
  document.getElementById('playersPage').style.display = 'block';
  document.getElementById('roundsPage').style.display = 'none';
  isOnPage2 = false;
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = false;
}

function nextRound() {
  if (currentRoundIndex + 1 < allRounds.length) {
    currentRoundIndex++;
    showRound(currentRoundIndex);
  } else {
    updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 1;
    showRound(currentRoundIndex);
  }
}
function prevRound() {
  if (currentRoundIndex > 0) {
    currentRoundIndex--;
    showRound(currentRoundIndex);
  }
}

function initScheduler(numCourts) {
  schedulerState.numCourts = numCourts;  
  schedulerState.restCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
 //schedulerState.restQueue = new Map(schedulerState.activeplayers.map(p => [p, 0]));
    
  schedulerState.PlayedCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayerScoreMap = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.playedTogether = new Map();
  schedulerState.fixedMap = new Map();
  schedulerState.pairPlayedSet = new Set();
  schedulerState.roundIndex = 0;
  // 🆕 Initialize opponentMap — nested map for opponent counts
  schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
  // Map each fixed pair for quick lookup
  schedulerState.fixedPairs.forEach(([a, b]) => {
    schedulerState.fixedMap.set(a, b);
    schedulerState.fixedMap.set(b, a);
  });
    schedulerState.restQueue = createRestQueue();
    
}
function updateScheduler() {
   schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
    schedulerState.restQueue = rebuildRestQueue(
    schedulerState.restQueue );  // initial queue
    
}

function updSchedule(roundIndex, schedulerState) {
  const data = allRounds[roundIndex];
  if (!data) return;

  const { games, resting } = data;
  const {
    restCount,
    PlayedCount,
    PlayerScoreMap,
    opponentMap,
    pairPlayedSet,
    playedTogether, // <<-- Missing in your version
  } = schedulerState;

  // 1️⃣ Update rest count
  for (const p of resting) {
    const playerName = p.split('#')[0];
    restCount.set(playerName, (restCount.get(playerName) || 0) + 1);
  }
   
// Helper → base name
const base = p => p.split('#')[0];

// 1️⃣ COPY restQueue first (so we don't modify during loop)
let newQueue = schedulerState.restQueue.slice();

// 2️⃣ FULL REMOVE: strip any players whose base name matches resting
for (const r of resting) {
  const b = base(r);
  newQueue = newQueue.filter(q => base(q) !== b);
}

// Replace restQueue after ALL removals done
schedulerState.restQueue = newQueue;

// 3️⃣ FULL ADD: now add base names of ALL resting at once
for (const r of resting) {
  schedulerState.restQueue.push(base(r));
}    

  // 2️⃣ Update PlayedCount
  for (const game of games) {
    const allPlayers = [...game.pair1, ...game.pair2];
    for (const p of allPlayers) {
      PlayedCount.set(p, (PlayedCount.get(p) || 0) + 1);
    }
  }

  // 3️⃣ Update opponentMap & PlayerScoreMap
  for (const game of games) {
    const { pair1, pair2 } = game;

    // Ensure maps exist (prevents null errors)
    for (const a of [...pair1, ...pair2]) {
      if (!opponentMap.has(a)) opponentMap.set(a, new Map());
    }

    // Opponent tracking
    for (const a of pair1) {
      for (const b of pair2) {
        opponentMap.get(a).set(b, (opponentMap.get(a).get(b) || 0) + 1);
        opponentMap.get(b).set(a, (opponentMap.get(b).get(a) || 0) + 1);
      }
    }

    // Score calculation (new opponents bonus)
    for (const group of [pair1, pair2]) {
      for (const player of group) {
        let newOpponents = 0;
        const rivals = group === pair1 ? pair2 : pair1;

        for (const r of rivals) {
          if (opponentMap.get(player).get(r) === 1) newOpponents++;
        }

        const score = newOpponents === 2 ? 2 : newOpponents === 1 ? 1 : 0;
        PlayerScoreMap.set(player, (PlayerScoreMap.get(player) || 0) + score);
      }
    }
  }

  // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
    for (const pr of [game.pair1, game.pair2]) {
      const key = pr.slice().sort().join("&");
      pairPlayedSet.add(key);
      playedTogether.set(key, roundIndex); // <<-- IMPORTANT FIX
    }
  }
}

function createRestQueue() {
  // Simply return active players in their current order
  return [...schedulerState.activeplayers];
}

function rebuildRestQueue(restQueue) {
  const newQueue = [];
  const active = schedulerState.activeplayers;

  // 1. Add active players based on the order in old restQueue
  for (const p of restQueue) {
    if (active.includes(p)) {
      newQueue.push(p);
    }
  }

  // 2. Add any newly active players not found in old restQueue
  for (const p of active) {
    if (!newQueue.includes(p)) {
      newQueue.push(p);
    }
  }

  return newQueue;
}




  

function RefreshRound() {
    schedulerState.roundIndex = allRounds.length - 1;
    currentRoundIndex = schedulerState.roundIndex;
    const newRound = AischedulerNextRound(schedulerState);
    allRounds[allRounds.length - 1] = newRound;
    showRound(currentRoundIndex);
}
function report() {
  const container = document.getElementById("reportContainer");
  container.innerHTML = ""; // Clear old cards

  // ⭐ Add title header row
  const header = document.createElement("div");
  header.className = "report-header";
  header.innerHTML = `
    <div class="header-rank" data-i18n="rank">Rank</div>
    <div class="header-name" data-i18n="name">Name</div>
    <div class="header-played" data-i18n="played">Played</div>
    <div class="header-rested" data-i18n="rested">Rested</div>
  `;
  container.appendChild(header);

  // Sort & add players
  const sortedPlayers = [...schedulerState.allPlayers].sort((a, b) => {
    const playedA = schedulerState.PlayedCount.get(a.name) || 0;
    const playedB = schedulerState.PlayedCount.get(b.name) || 0;
    return playedB - playedA;
  });

  sortedPlayers.forEach((p, index) => {
    const played = schedulerState.PlayedCount.get(p.name) || 0;
    const rest = schedulerState.restCount.get(p.name) || 0;

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="name">${p.name.replace(/^\d+\.?\s*/, "")}</div>
      <div class="stat played" style="border-color:${getPlayedColor(played)}">${played}</div>
      <div class="stat rest" style="border-color:${getRestColor(rest)}">${rest}</div>
    `;
    container.appendChild(card);
  });

  // ⭐ Important: Apply translation to new elements
  setLanguage(currentLang);
}


function toggleGender() {
  const toggle = document.querySelector(".gender-toggle");
  const hiddenInput = document.getElementById("genderValue");

  toggle.classList.toggle("active");

  const isFemale = toggle.classList.contains("active");
  hiddenInput.value = isFemale ? "Female" : "Male";

  console.log("Selected Gender:", hiddenInput.value);
}


// Page initialization
function initPage() {
  document.getElementById("playersPage").style.display = 'block';
  document.getElementById("roundsPage").style.display = 'none';
}




 


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







/* ============================================================
   PLAYERS TAB — Add, edit, delete, import players and fixed pairs
   File: players.js
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

  const textarea = document.getElementById("players-names");
  if (!textarea) return;

  const defaultHeight = 40;

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  textarea.addEventListener("input", function () {
    autoResize(this);
  });

  textarea.addEventListener("blur", function () {
    if (!this.value.trim()) {
      this.style.height = defaultHeight + "px";
    }
  });

});



function getGenderIconByName(playerName) {
  const player = schedulerState.allPlayers.find(
    p => p.name === playerName
  );

  if (!player) return "❔";

  return player.gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function refreshFixedCards() {
  const list = document.getElementById("fixed-pair-list");
  list.innerHTML = "";

  schedulerState.fixedPairs.forEach(([p1, p2], index) => {
    addFixedCard(p1, p2, index);
  });
}


function updateFixedPairSelectors() {
  const sel1 = document.getElementById('fixed-pair-1');
  const sel2 = document.getElementById('fixed-pair-2');
  const pairedPlayers = new Set(schedulerState.fixedPairs.flat());

  sel1.innerHTML = '<option value="" data-i18n="selectPlayer1"></option>';
  sel2.innerHTML = '<option value="" data-i18n="selectPlayer2"></option>';

  schedulerState.activeplayers.slice().reverse().forEach(p => {
    if (!pairedPlayers.has(p)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');

      const icon = getGenderIconByName(p);

      option1.value = option2.value = p;
      option1.textContent = option2.textContent = `${icon} ${p}`;

      sel1.appendChild(option1);
      sel2.appendChild(option2);
    }
  });
}

function addFixedCard(p1, p2, key) {
  const list = document.getElementById('fixed-pair-list');

  const card = document.createElement("div");
  card.className = "fixed-card";
  card.setAttribute("data-key", key);

  const icon1 = getGenderIconByName(p1);
  const icon2 = getGenderIconByName(p2);

  card.innerHTML = `
    <div class="fixed-name">
      ${icon1} ${p1} & ${icon2} ${p2}
    </div>
    <div class="fixed-delete">
      <button class="pec-btn delete"
              onclick="modifyFixedPair('${p1}', '${p2}')">🗑</button>
    </div>
  `;

  list.appendChild(card);
}



function pastePlayersText() {
  const textarea = document.getElementById('players-textarea');

  const stopMarkers = [
    /court full/i, /wl/i, /waitlist/i, /late cancel/i,
    /cancelled/i, /reserve/i, /bench/i, /extras/i, /backup/i
  ];

  function cleanText(text) {
    const lines = text.split(/\r?\n/);

    let startIndex = 0;
    let stopIndex = lines.length;

    // Find first "Confirm" line
    const confirmLineIndex = lines.findIndex(line => /confirm/i.test(line));

    if (confirmLineIndex >= 0) {
      startIndex = confirmLineIndex + 1;

      for (let i = startIndex; i < lines.length; i++) {
        if (stopMarkers.some(re => re.test(lines[i]))) {
          stopIndex = i;
          break;
        }
      }
    }

    const cleanedLines = [];

    for (let i = startIndex; i < stopIndex; i++) {
      let line = lines[i].trim();

      if (!line) continue;                  // skip empty
      if (line.toLowerCase().includes("http")) continue; // skip links

      cleanedLines.push(line);
    }

    return cleanedLines.join("\n");
  }

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(text => {
        const cleaned = cleanText(text);

        if (!cleaned) {
          alert("No valid player names found.");
          return;
        }

        textarea.value += (textarea.value ? '\n' : '') + cleaned;
        textarea.focus();
      })
      .catch(() => {
        alert('Paste not allowed. Long-press and paste instead.');
      });
  } else {
    alert('Paste not supported on this device.');
  }
}



function showImportModal() {
  const textarea = document.getElementById("players-textarea");
  // Clear any entered text
  textarea.value = "";
  textarea.placeholder = translations[currentLang].importExample;
  document.getElementById('importModal').style.display = 'block';
}

function hideImportModal() {
  document.getElementById('newImportModal').style.display = 'none';
  //document.getElementById('players-textarea').value = '';
}

/* =========================
   ADD SINGLE PLAYER
========================= */
function addPlayerokd() {

  const textarea = document.getElementById("players-names");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender =
    document.getElementById("player-gender")?.value || "Male";

  const lines = text.split(/\r?\n/);

  // ======================
  // GENDER LOOKUP (multi-language)
  // ======================
  const genderLookup = {};

  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)
        genderLookup[langObj.male.toLowerCase()] = "Male";

      if (langObj.female)
        genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  // fallback English
  genderLookup["male"] = "Male";
  genderLookup["m"] = "Male";
  genderLookup["female"] = "Female";
  genderLookup["f"] = "Female";

  const extractedNames = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let gender = defaultGender;

    // Remove numbering (1. John → John)
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();

    // name, gender
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());
      line = parts[0];

      if (parts[1]) {
        const g = parts[1].toLowerCase();
        if (genderLookup[g]) gender = genderLookup[g];
      }
    }

    // name (gender)
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();

      if (genderLookup[inside])
        gender = genderLookup[inside];

      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;

    const normalized = line.toLowerCase();

    // Avoid duplicates in scheduler + current import
    const exists =
      schedulerState.allPlayers.some(
        p => p.name.trim().toLowerCase() === normalized
      ) ||
      extractedNames.some(
        p => p.name.trim().toLowerCase() === normalized
      );

    if (!exists) {
      extractedNames.push({
        name: line,
        gender,
        active: true
      });
    }
  }

  if (extractedNames.length === 0) return;

  // ======================
  // SAVE TO MAIN PLAYER LIST
  // ======================
  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();

  // ======================
  // ENSURE IMPORT HISTORY EXISTS
  // ======================
  if (!localStorage.getItem("newImportHistory")) {
    localStorage.setItem("newImportHistory", JSON.stringify([]));
  }

  // ======================
  // SAVE TO IMPORT HISTORY (for Import Modal)
  // ======================
  let history = JSON.parse(localStorage.getItem("newImportHistory"));

  const historyPlayers = extractedNames.map(p => ({
    displayName: p.name,
    gender: p.gender
  }));

  historyPlayers.forEach(newPlayer => {
    if (!history.some(p => p.displayName === newPlayer.displayName)) {
      history.unshift(newPlayer); // newest first
    }
  });

  history = history.slice(0, 50); // keep last 50

  localStorage.setItem("newImportHistory", JSON.stringify(history));

  // ======================
  // RESET UI
  // ======================
  const defaultHeight = 40;
  textarea.value = "";
  textarea.style.height = defaultHeight + "px";
  textarea.focus();
}

function saveAllPlayersState() {

  // save scheduler players (main list)
  localStorage.setItem(
    "schedulerPlayers",
    JSON.stringify(schedulerState.allPlayers)
  );

  // save import modal lists
  localStorage.setItem(
    "newImportHistory",
    JSON.stringify(newImportState.historyPlayers)
  );

  localStorage.setItem(
    "newImportFavorites",
    JSON.stringify(newImportState.favoritePlayers)
  );
}

function oldaddPlayer() {
  const name = document.getElementById('player-name').value.trim();
  const gender = document.getElementById('player-gender').value;
  if (name && !schedulerState.allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    schedulerState.allPlayers.push({ name, gender, active: true });
    schedulerState.activeplayers = schedulerState.allPlayers
      .filter(p => p.active)
      .map(p => p.name)
      .reverse();

    updatePlayerList();
    updateFixedPairSelectors();
  } else if (name) {
    alert(`Player "${name}" already exists!`);
  }
  document.getElementById('player-name').value = '';
  	
}


/* =========================
   EDIT PLAYER INFO
========================= */
function editPlayer(i, field, val) {
  const player = schedulerState.allPlayers[i];

  // Normal update
  if (field === 'active') {
    player.active = !!val;                         // make sure it's boolean
    if (val) {                                     // ←←← THIS IS THE ONLY NEW PART
      const highest = Math.max(0, ...schedulerState.allPlayers.map(p => p.turnOrder || 0));
      player.turnOrder = highest + 1;              // put him at the very end of the line
    }
  } else {
    player[field] = val.trim();
  }

  // Your two existing lines — unchanged
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();  	
}

function removeFixedPairsForPlayer(playerName) {
  // Remove from data
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => {
    const keep = !pair.includes(playerName);
    if (!keep) {
      const key = pair.slice().sort().join("&");
      removeFixedCard(key); // Remove UI card
    }
    return keep;
  });

  updateFixedPairSelectors();
}

/* =========================
   DELETE PLAYER
========================= */
function deletePlayer(i) {
  const deletedPlayer = schedulerState.allPlayers[i]?.name;
  if (!deletedPlayer) return;

  // 1️⃣ Remove player
  schedulerState.allPlayers.splice(i, 1);

  // 2️⃣ Remove any fixed pairs involving this player
  removeFixedPairsForPlayer(deletedPlayer);

  // 3️⃣ Recalculate active players
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  // 4️⃣ Refresh UI
  updatePlayerList();
  updateFixedPairSelectors();
  refreshFixedCards(); // 🔥 THIS is the key
}



function olddeletePlayer(i) {
  schedulerState.allPlayers.splice(i, 1);
   schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  
}

function toggleActive(index, checkbox) {
  // Update data model first
  schedulerState.allPlayers[index].active = checkbox.checked;

  const card = checkbox.closest(".player-edit-card");

  // Apply the CSS class based on active state
  if (checkbox.checked) {
    card.classList.remove("inactive");
  } else {
    card.classList.add("inactive");
  }

  // Recalculate active players list
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
	.reverse();

  // Refresh UI
  updateFixedPairSelectors();
  
	
}


function getGenderIcon(gender) {
  return gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function toggleGender(index, iconEl) {
  const player = schedulerState.allPlayers[index];
  if (!player) return;

  // 1️⃣ Toggle gender
  player.gender = player.gender === "Male" ? "Female" : "Male";

  const genderClass = player.gender.toLowerCase();

  // 2️⃣ Update icon
  iconEl.textContent = getGenderIcon(player.gender);

  // 3️⃣ Update icon class
  iconEl.classList.remove("male", "female");
  iconEl.classList.add(genderClass);

  // 4️⃣ Update card class
  const card = iconEl.closest(".player-edit-card");
  if (card) {
    card.classList.remove("male", "female");
    card.classList.add(genderClass);
  }

  // 5️⃣ Update linked state
  updateGenderGroups();

  // 6️⃣ Refresh dependent UI
  updateFixedPairSelectors();
  refreshFixedCards(); // 🔥 THIS fixes your issue

   saveAllPlayersState();
	
}


function updateGenderGroups() {
  schedulerState.malePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Male" && p.active)
    .map(p => p.name);

  schedulerState.femalePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Female" && p.active)
    .map(p => p.name);
}

function addPlayersFromInputUI() {

  const importPlayers = newImportState.selectedPlayers;

  if (!importPlayers || importPlayers.length === 0) {
    alert('No players to add!');
    return;
  }

  const extractedNames = [];

  importPlayers.forEach(p => {

    const name = p.displayName.trim();
    const gender = p.gender || "Male";

    if (
      !schedulerState.allPlayers.some(
        existing => existing.name.trim().toLowerCase() === name.toLowerCase()
      ) &&
      !extractedNames.some(
        existing => existing.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      extractedNames.push({
        name: name,
        gender: gender,
        active: true
      });
    }

  });

  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();

  // Optional: reset selection after import
  newImportState.selectPlayers = [];
}


/* =========================
   ADD PLAYERS FROM TEXT
========================= */
function addPlayersFromText() {

  const textarea = document.getElementById("players-textarea");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender =
    document.querySelector('input[name="genderSelect"]:checked')?.value || "Male";

  const lines = text.split(/\r?\n/);

  // stop markers
  const stopMarkers = [
    /court full/i, /wl/i, /waitlist/i, /late cancel/i,
    /cancelled/i, /reserve/i, /bench/i, /extras/i, /backup/i
  ];

  let startIndex = 0;
  let stopIndex = lines.length;

  // detect "confirm" section
  const confirmLineIndex = lines.findIndex(line => /confirm/i.test(line));

  if (confirmLineIndex >= 0) {
    startIndex = confirmLineIndex + 1;

    for (let i = startIndex; i < lines.length; i++) {
      if (stopMarkers.some(re => re.test(lines[i]))) {
        stopIndex = i;
        break;
      }
    }
  }

  // ======================
  // GENDER LOOKUP (multi-language)
  // ======================
  const genderLookup = {};

  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)
        genderLookup[langObj.male.toLowerCase()] = "Male";

      if (langObj.female)
        genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  // fallback English
  genderLookup["male"] = "Male";
  genderLookup["m"] = "Male";
  genderLookup["female"] = "Female";
  genderLookup["f"] = "Female";

  // ======================
  // EXTRACT NAMES
  // ======================
  const extractedNames = [];

  for (let i = startIndex; i < stopIndex; i++) {

    let line = lines[i].trim();
    if (!line) continue;
    if (/https?/i.test(line)) continue;

    let gender = defaultGender;

    // remove numbering (1. John → John)
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();

    // ======================
    // name, gender
    // ======================
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());

      line = parts[0];

      if (parts[1]) {
        const g = parts[1].toLowerCase();
        if (genderLookup[g]) gender = genderLookup[g];
      }
    }

    // ======================
    // name (gender)
    // ======================
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();

      if (genderLookup[inside])
        gender = genderLookup[inside];

      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;

    const normalized = line.toLowerCase();

    // avoid duplicates globally + in this import
    const exists =
      schedulerState.allPlayers.some(
        p => p.name.trim().toLowerCase() === normalized
      ) ||
      extractedNames.some(
        p => p.name.trim().toLowerCase() === normalized
      );

    if (!exists) {
      extractedNames.push({
        name: line,
        gender,
        active: true
      });
    }
  }

  if (extractedNames.length === 0) return;

  // ======================
  // SAVE
  // ======================
  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();
}



/* =========================
 
PLAYER MANAGEMENT
 
========================= */

function createPlayerCard(player, index) {
  let cardClass = `player-edit-card player-row ${player.gender.toLowerCase()}`;
  if (!player.active) cardClass += " inactive";

  const card = document.createElement("div");
  card.className = cardClass;

  // 🔹 Drag support
  card.draggable = true;
  card.dataset.index = index;
  card.addEventListener("dragstart", onDragStart);
  card.addEventListener("dragover", onDragOver);
  card.addEventListener("drop", onDrop);

  const genderIcon =
    player.gender === "Male" ? "👨‍💼" :
    player.gender === "Female" ? "🙎‍♀️" :
    "❔";

  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox"
        ${player.active ? "checked" : ""}
        onchange="toggleActive(${index}, this)">
    </div>

    <div class="pec-col pec-sl">${index + 1}</div>

    <div class="pec-col pec-gender">
      <span class="gender-icon ${player.gender.toLowerCase()}"
            onclick="toggleGender(${index}, this)">
        ${genderIcon}
      </span>
    </div>

    <div class="pec-col pec-name"
         onclick="editPlayerName(${index})">
      ${player.name}
    </div>

    <div class="pec-col pec-delete">
      <button class="pec-btn delete"
              onclick="deletePlayer(${index})">🗑</button>
    </div>
  `;

  return card;
}

function editPlayerName(index) {
  const oldPlayer = schedulerState.allPlayers[index];
  const oldName = oldPlayer.name;

  const newName = prompt("Edit player name", oldName);
  if (!newName) return;

  const trimmed = newName.trim();
  if (!trimmed) return;

  const duplicate = schedulerState.allPlayers.some(
    (p, i) =>
      i !== index &&
      p.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    alert("Player name already exists!");
    return;
  }

  // ✅ immutable update
  schedulerState.allPlayers = schedulerState.allPlayers.map((p, i) =>
    i === index ? { ...p, name: trimmed } : p
  );

  updatePlayerList();
}

let draggedIndex = null;

function onDragStart(e) {
  draggedIndex = Number(e.currentTarget.dataset.index);
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  e.preventDefault(); // Allow drop
}

function onDrop(e) {
  const targetIndex = Number(e.currentTarget.dataset.index);
  if (draggedIndex === targetIndex) return;

  const list = schedulerState.allPlayers;
  const [moved] = list.splice(draggedIndex, 1);
  list.splice(targetIndex, 0, moved);

  updatePlayerList();
}



function xxxcreatePlayerCard(player, index) {
  // Base card class + gender
  let cardClass = `player-edit-card player-row ${player.gender.toLowerCase()}`;
  
  // Add 'inactive' class if player is not active
  if (!player.active) {
    cardClass += " inactive";
  }

  const card = document.createElement("div");
  card.className = cardClass;

  // Gender icon
  const genderIcon =
    player.gender === "Male" ? "👨‍💼" :
    player.gender === "Female" ? "🙎‍♀️" :
    "❔";

  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox"
        ${player.active ? "checked" : ""}
        onchange="toggleActive(${index}, this)">
    </div>
    <div class="pec-col pec-sl">${index + 1}</div>
    <div class="pec-col pec-gender">
      <span class="gender-icon ${player.gender.toLowerCase()}"
      onclick="toggleGender(${index}, this)">
  ${genderIcon}
</span>
    </div> 

    <div class="pec-col pec-name">${player.name}</div>    

    <div class="pec-col pec-delete">
      <button class="pec-btn delete" onclick="deletePlayer(${index})">🗑</button>
    </div>
  `;

  return card;
}
/*
========================
   UPDATE PLAYER LIST TABLE
========================= */
function reportold1() {
  const table = document.getElementById('page3-table');
  table.innerHTML = `
    <tr>
      <th>No</th>
      <th>Name</th>
      <th>P/R</th>
    </tr>
  `;

  schedulerState.allPlayers.forEach((p, i) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <!-- No -->
      <td class="no-col" style="text-align:center; font-weight:bold;">
        ${i + 1}
      </td>

      <!-- Name (plain text) -->
      <td class="Player-cell">
        ${p.name}
      </td>

      <!-- Played / Rest circles -->
      <td class="stat-cell">
        <span class="played-count" id="played_${i}"></span>
        <span class="rest-count" id="rest_${i}"></span>
      </td>
    `;

    // 🔥 Update Played circle
    const playedElem = row.querySelector(`#played_${i}`);
    if (playedElem) {
      const playedValue = schedulerState.PlayedCount.get(p.name) || 0;
      playedElem.textContent = playedValue;
      playedElem.style.borderColor = getPlayedColor(playedValue);
    }

    // 🔥 Update Rest circle
    const restElem = row.querySelector(`#rest_${i}`);
    if (restElem) {
      const restValue = schedulerState.restCount.get(p.name) || 0;
      restElem.textContent = restValue;
      restElem.style.borderColor = getRestColor(restValue);
    }

    table.appendChild(row);
  });
}

function updatePlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = "";

  schedulerState.allPlayers.forEach((player, index) => {
    const card = createPlayerCard(player, index);
    container.appendChild(card);
  });
  // Recalculate active players list
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
	.reverse();

  // Refresh UI
  updateFixedPairSelectors();
	
  updateCourtButtons()
  updateRoundsPageAccess(); 	
}

function oldupdatePlayerList() {
  const table = document.getElementById('player-list-table');
  table.innerHTML = `
    <tr>
      <th>No</th>
      <th></th>
      <th>Name</th>
      <th>M/F</th>
      <th>Del</th>
    </tr>
  `;

  schedulerState.allPlayers.forEach((p, i) => {
    const row = document.createElement('tr');
    if (!p.active) row.classList.add('inactive');

    row.innerHTML = `
      <!-- No. -->
      <td class="no-col" style="text-align:center; font-weight:bold;">${i + 1}</td>

      <!-- Active checkbox -->
      <td style="text-align:center;">
        <input type="checkbox" ${p.active ? 'checked' : ''}
          onchange="editPlayer(${i}, 'active', this.checked)">
      </td>

      <!-- Name -->
      <td class="Player-cell">
        <input type="text" value="${p.name}"
          ${!p.active ? 'disabled' : ''}
          onchange="editPlayer(${i}, 'name', this.value)">
      </td>

      <!-- Gender -->
      <td class="gender-cell">
        <label class="gender-btn male">
          <input type="radio" name="gender-${i}" value="Male"
            ${p.gender === 'Male' ? 'checked' : ''}
            onchange="editPlayer(${i}, 'gender', 'Male')">
          <span>M</span>
        </label>
        <label class="gender-btn female">
          <input type="radio" name="gender-${i}" value="Female"
            ${p.gender === 'Female' ? 'checked' : ''}
            onchange="editPlayer(${i}, 'gender', 'Female')">
          <span>F</span>
        </label>
      </td>

      <!-- Delete button col -->
      <td style="text-align:center;">
        <button onclick="deletePlayer(${i})">🗑️</button>
      </td>
    `;  // <-- ⬅ HERE: properly closed backtick!

    table.appendChild(row);
  });
}



function getPlayedColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const plays = Math.min(value, 20);
  const hue = (plays - 1) * 36; // 36° steps → 10 distinct, bold colors: 0°, 36°, 72°, ..., 684° → wraps cleanly

  return `hsl(${hue}, 92%, 58%)`;
}

function getRestColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const rests = Math.min(value, 20);
  const hue = ((rests - 1) * 36 + 180) % 360; // +180° offset = perfect opposite color

  return `hsl(${hue}, 88%, 62%)`;
}




let selectedNoCell = null;

function enableTouchRowReorder() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach(cell => {
    cell.addEventListener("click", onNumberTouch);
    cell.addEventListener("touchend", onNumberTouch);
  });
}

function onNumberTouch(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  const sourceRow = selectedNoCell ? selectedNoCell.parentElement : null;
  const targetRow = cell.parentElement;

  // Select first row
  if (!sourceRow) {
    selectedNoCell = cell;
    cell.classList.add("selected-no");
    return;
  }

  // Unselect if same row
  if (sourceRow === targetRow) {
    selectedNoCell.classList.remove("selected-no");
    selectedNoCell = null;
    return;
  }

  const table = document.getElementById("player-list-table");

  // Move source row AFTER target row
  const nextSibling = targetRow.nextSibling;
  table.insertBefore(sourceRow, nextSibling);

  // Clear selection
  selectedNoCell.classList.remove("selected-no");
  selectedNoCell = null;

  // Update No. column
  updateNumbers();
  syncPlayersFromTable();
}


function updateNumbers() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach((cell, idx) => {
    cell.textContent = idx + 1;
  });
}

function syncPlayersFromTable() {
  const table = document.getElementById('player-list-table');
  const rows = table.querySelectorAll('tr');

  const updated = [];

  rows.forEach((row, index) => {
    if (index === 0) return; // skip header

    const nameCell = row.querySelector('.player-name');
    const genderCell = row.querySelector('.player-gender');

    if (!nameCell || !genderCell) return;

    updated.push({
      name: nameCell.textContent.trim(),
      gender: genderCell.textContent.trim(),
      active: !row.classList.contains('inactive-row')
    });
  });

  // Update your global arrays
  schedulerState.allPlayers = updated;
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

}


// Function to toggle all checkboxes
function toggleAllCheckboxes(masterCheckbox) {
  // Only run if the checkbox exists and event came from it
  if (!masterCheckbox || masterCheckbox.id !== 'select-all-checkbox') return;
  const checkboxes = document.querySelectorAll('#player-list-table td:first-child input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
/* =========================
   FIXED PAIRS MANAGEMENT
========================= */
function oldupdateFixedPairSelectors() {
  const sel1 = document.getElementById('fixed-pair-1');
  const sel2 = document.getElementById('fixed-pair-2');
  const pairedPlayers = new Set(schedulerState.fixedPairs.flat());
  sel1.innerHTML = '<option value="" data-i18n="selectPlayer1"></option>';
  sel2.innerHTML = '<option value="" data-i18n="selectPlayer2"></option>';
  //sel2.innerHTML = '<option value="">-- Select Player 2 --</option>';
  // Only active players
  schedulerState.activeplayers.slice().reverse().forEach(p => {
    if (!pairedPlayers.has(p)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');
      option1.value = option2.value = p;
      option1.textContent = option2.textContent = p;
      sel1.appendChild(option1);
      sel2.appendChild(option2);
    }
  });
}

function modifyFixedPair(p1 = null, p2 = null) {
  // If called from delete button (icon), values passed.
  // If called from main button, read from selectors:
  if (!p1 || !p2) {
    p1 = document.getElementById('fixed-pair-1').value;
    p2 = document.getElementById('fixed-pair-2').value;
  }

  if (!p1 || !p2) {
    alert("Please select both players.");
    return;
  }

  if (p1 === p2) {
    alert("You cannot pair the same player with themselves.");
    return;
  }

  const pairKey = [p1, p2].sort().join('&');

  // Check if pair already exists
  const index = schedulerState.fixedPairs.findIndex(
    pair => pair.sort().join('&') === pairKey
  );

  // -------------------------
  // REMOVE if exists
  // -------------------------
  if (index !== -1) {
    schedulerState.fixedPairs.splice(index, 1);
    removeFixedCard(pairKey);
    updateFixedPairSelectors();
    return;
  }

  // -------------------------
  // ADD if does not exist
  // -------------------------
  schedulerState.fixedPairs.push([p1, p2]);
  addFixedCard(p1, p2, pairKey);
  updateFixedPairSelectors();
}

function oldaddFixedCard(p1, p2, key) {
  const list = document.getElementById('fixed-pair-list');

  const card = document.createElement("div");
  card.className = "fixed-card";
  card.setAttribute("data-key", key);

  card.innerHTML = `
    
    <div class="fixed-name">${p1} & ${p2}</div>
    <div class="fixed-delete">
      <button class="pec-btn delete"
              onclick="modifyFixedPair('${p1}', '${p2}')">🗑</button>
    </div>
  `;

  list.appendChild(card);
}

function removeFixedCard(key) {
  const card = document.querySelector(`[data-key="${key}"]`);
  if (card) card.remove();
}

function addFixedPairold() {
  const p1 = document.getElementById('fixed-pair-1').value;
  const p2 = document.getElementById('fixed-pair-2').value;
  if (!p1 || !p2) {
    alert("Please select both players.");
    return;
  }
  if (p1 === p2) {
    alert("You cannot pair the same player with themselves.");
    return;
  }
  const pairKey = [p1, p2].sort().join('&');
  const alreadyExists = schedulerState.fixedPairs.some(pair => pair.sort().join('&') === pairKey);
  if (alreadyExists) {
    alert(`Fixed pair "${p1} & ${p2}" already exists.`);
    return;
  }
  schedulerState.fixedPairs.push([p1, p2]);
  const div = document.createElement('div');
  div.classList.add('fixed-pair-item');
  div.innerHTML = `
    ${p1} & ${p2}
    <span class="fixed-pair-remove" onclick="removeFixedPair(this, '${p1}', '${p2}')">
      Remove
    </span>
  `;
  document.getElementById('fixed-pair-list').appendChild(div);
  updateFixedPairSelectors();
}
function removeFixedPair(el, p1, p2) {
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => !(pair[0] === p1 && pair[1] === p2));
  el.parentElement.remove();
  updateFixedPairSelectors();
}

/* =========================
 
PAGE NAVIGATION
 
========================= */

function showToast(msg) {
  if (!msg) return; // ⛔ nothing to show

  const toast = document.getElementById("toast");
  if (!toast) return; // ⛔ toast element not present

  toast.textContent = msg;
  toast.classList.remove("hidden");

  setTimeout(() => {
    if (toast) toast.classList.add("hidden");
  }, 2500);
}


function alert(msg) {
  showToast(msg);   // your toast function
}



// ======================
// HELPERS
// ======================
function debounce(func, delay = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// ======================
// MODAL
// ======================
// ======================
// REMOVE DUPLICATES (GLOBAL SAFE)
// ======================
function newImportDeduplicate(list) {

  const map = new Map();

  list.forEach(player => {
    const key = player.displayName.trim().toLowerCase();

    if (!map.has(key)) {
      map.set(key, player);
    } else {
      // If duplicate found, prefer latest data (keeps updated gender)
      map.set(key, player);
    }
  });

  return Array.from(map.values());
}

// ================= STATE =================
const newImportState = {
  historyPlayers: [],
  favoritePlayers: [],
  selectedPlayers: [],
  currentSelectMode: "history"
};

let newImportModal;
let newImportSelectCards;
let newImportSelectedCards;
let newImportSelectedCount;
let newImportSearch;


// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  newImportModal = document.getElementById("newImportModal");
  newImportSelectCards = document.getElementById("newImportSelectCards");
  newImportSelectedCards = document.getElementById("newImportSelectedCards");
  newImportSelectedCount = document.getElementById("newImportSelectedCount");
  newImportSearch = document.getElementById("newImportSearch");

  newImportLoadHistory();
  newImportLoadFavorites();

  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();

  newImportSelectCards.addEventListener("click", newImportHandleCardClick);
  newImportSearch.addEventListener("input", newImportRefreshSelectCards);
});


// ================= MODAL =================
function newImportShowModal(){
  newImportModal.style.display="flex";
  newImportLoadHistory();
  newImportLoadFavorites();
  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();
}

function newImportHideModal(){
  newImportModal.style.display="none";
  newImportState.selectedPlayers=[];
}


// ================= TAB SWITCH =================

function newImportShowSelectMode(mode){

  newImportState.currentSelectMode = mode;

  // remove active
  document.querySelectorAll(".newImport-subtab-btn")
    .forEach(btn => btn.classList.remove("active"));

  // activate clicked
  document.getElementById(
    "newImport" + mode.charAt(0).toUpperCase() + mode.slice(1) + "Btn"
  )?.classList.add("active");

  const clearHistory = document.getElementById("newImportClearHistoryBtn");
  const clearFavorites = document.getElementById("newImportClearFavoritesBtn");
  const listContainer = document.getElementById("newImportSelectCards");
  const addSection = document.getElementById("newImportAddPlayersSection");
  const searchInput = document.getElementById("newImportSearch");

  // ===== ADD PLAYERS MODE =====
  if(mode === "addplayers"){
    listContainer.style.display = "none";
    addSection.style.display = "block";
    searchInput.style.display = "none";
    clearHistory.style.display = "none";
    clearFavorites.style.display = "none";
    return;
  }

  // ===== HISTORY / FAVORITES =====
  listContainer.style.display = "flex";
  addSection.style.display = "none";
  searchInput.style.display = "block";

  if(mode === "history"){
    clearHistory.style.display = "block";
    clearFavorites.style.display = "none";
  } else {
    clearHistory.style.display = "none";
    clearFavorites.style.display = "block";
  }

  newImportRefreshSelectCards();
}



function newImportShowSelectModeor(mode){
  newImportState.currentSelectMode=mode;

  document.querySelectorAll(".newImport-subtab-btn")
    .forEach(btn=>btn.classList.remove("active"));

  document.getElementById(
    "newImport"+mode.charAt(0).toUpperCase()+mode.slice(1)+"Btn"
  )?.classList.add("active");

  newImportRefreshSelectCards();
}


// ================= STORAGE =================
function newImportLoadHistory(){
  const data = localStorage.getItem("newImportHistory");
  newImportState.historyPlayers = data
    ? newImportDeduplicate(JSON.parse(data))
    : [];

  localStorage.setItem(
    "newImportHistory",
    JSON.stringify(newImportState.historyPlayers)
  );
}

function newImportLoadFavorites(){
  const data = localStorage.getItem("newImportFavorites");
  newImportState.favoritePlayers = data
    ? newImportDeduplicate(JSON.parse(data))
    : [];

  localStorage.setItem(
    "newImportFavorites",
    JSON.stringify(newImportState.favoritePlayers)
  );
}


function newImportSaveFavorites(){
  localStorage.setItem(
    "newImportFavorites",
    JSON.stringify(newImportState.favoritePlayers)
  );
}


// ================= RENDER LIST =================

function newImportRefreshSelectCards(){

  if(newImportState.currentSelectMode === "addplayers"){
    return;
  }

  newImportSelectCards.innerHTML = "";

const source =
  newImportState.currentSelectMode === "favorites"
    ? [...newImportState.favoritePlayers]
    : [...newImportState.historyPlayers];

// ✅ Sort ascending A → Z
source.sort((a, b) =>
  a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
);
  const search = newImportSearch.value.toLowerCase();

  source
    .filter(p => p.displayName.toLowerCase().includes(search))
    .forEach((p) => {

      const added = newImportState.selectedPlayers.some(
        sp => sp.displayName === p.displayName
      );

      const fav = newImportState.favoritePlayers.some(
        fp => fp.displayName === p.displayName
      );

      const card = document.createElement("div");
      card.className = "newImport-player-card";

      card.innerHTML = `
        <div class="newImport-player-top">
          <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
               data-action="gender"
               data-player="${p.displayName}">
          <div class="newImport-player-name">${p.displayName}</div>
        </div>

        <div class="newImport-player-actions">
          <button 
            class="circle-btn favorite ${fav ? 'active-favorite' : ''}" 
            data-action="favorite" 
            data-player="${p.displayName}">
            ${fav ? "★" : "☆"}
          </button>

          <button 
            class="circle-btn delete" 
            data-action="delete" 
            data-player="${p.displayName}">
            ×
          </button>

          <button 
            class="circle-btn add ${added ? 'active-added' : ''}" 
            data-action="add" 
            data-player="${p.displayName}" 
            ${added ? "disabled" : ""}>
            ${added ? "✓" : "+"}
          </button>
        </div>
      `;

      newImportSelectCards.appendChild(card);
    });
}


// ================= CARD ACTIONS =================

function newImportHandleCardClick(e){
  const action = e.target.dataset.action;
  if(!action) return;

  const playerName = e.target.dataset.player;
  if(!playerName) return;

  const source =
    newImportState.currentSelectMode==="favorites"
      ? newImportState.favoritePlayers
      : newImportState.historyPlayers;

  const player = source.find(p => p.displayName === playerName);
  if(!player) return;

  // ADD PLAYER
  if(action==="add"){
    if(!newImportState.selectedPlayers.some(
      p => p.displayName===player.displayName
    )){
      newImportState.selectedPlayers.push({...player});
      newImportRefreshSelectedCards();
    }
  }

  // TOGGLE GENDER
  if(action==="gender"){
  player.gender = player.gender==="Male" ? "Female" : "Male";

  // update in history
  newImportState.historyPlayers.forEach(p=>{
    if(p.displayName===player.displayName){
      p.gender = player.gender;
    }
  });

  // update in favorites
  newImportState.favoritePlayers.forEach(p=>{
    if(p.displayName===player.displayName){
      p.gender = player.gender;
    }
  });

  localStorage.setItem(
    "newImportHistory",
    JSON.stringify(newImportState.historyPlayers)
  );

  localStorage.setItem(
    "newImportFavorites",
    JSON.stringify(newImportState.favoritePlayers)
  );
}

  // TOGGLE FAVORITE
  if(action==="favorite"){
    const i = newImportState.favoritePlayers.findIndex(
      p => p.displayName===player.displayName
    );

    if(i>=0){
      newImportState.favoritePlayers.splice(i,1);
    }else{
      newImportState.favoritePlayers.push({...player});
    }

    newImportSaveFavorites();
  }

  // DELETE PLAYER
  if(action==="delete"){
    const removeIndex = source.findIndex(
      p => p.displayName === playerName
    );

    if(removeIndex >= 0) source.splice(removeIndex,1);

    if(newImportState.currentSelectMode==="history"){
      localStorage.setItem(
        "newImportHistory",
        JSON.stringify(newImportState.historyPlayers)
      );
    }else{
      localStorage.setItem(
        "newImportFavorites",
        JSON.stringify(newImportState.favoritePlayers)
      );
    }
  }

  newImportRefreshSelectCards();
}


function newImportHandleCardClickold(e){
  const action=e.target.dataset.action;
  if(!action) return;

  const idx=parseInt(e.target.dataset.index);

  const source=
    newImportState.currentSelectMode==="favorites"
      ?newImportState.favoritePlayers
      :newImportState.historyPlayers;

  const player=source[idx];
  if(!player) return;

  if(action==="add"){
    if(!newImportState.selectedPlayers.some(
      p=>p.displayName===player.displayName
    )){
      newImportState.selectedPlayers.push({...player});
      newImportRefreshSelectedCards();
    }
  }

  if(action==="gender"){
    player.gender=player.gender==="Male"?"Female":"Male";
  }

  if(action==="favorite"){
    const i=newImportState.favoritePlayers.findIndex(
      p=>p.displayName===player.displayName
    );

    i>=0
      ?newImportState.favoritePlayers.splice(i,1)
      :newImportState.favoritePlayers.push({...player});

    newImportSaveFavorites();
  }

  if(action==="delete"){
  source.splice(idx,1);

  // save to storage depending on tab
  if(newImportState.currentSelectMode==="history"){
    localStorage.setItem(
      "newImportHistory",
      JSON.stringify(newImportState.historyPlayers)
    );
  }else{
    localStorage.setItem(
      "newImportFavorites",
      JSON.stringify(newImportState.favoritePlayers)
    );
  }
}

  newImportRefreshSelectCards();
}


// ================= SELECTED LIST =================
function newImportRefreshSelectedCards(){
  newImportSelectedCards.innerHTML="";
  newImportSelectedCount.textContent=newImportState.selectedPlayers.length;

  newImportState.selectedPlayers.forEach((p,i)=>{
    const card=document.createElement("div");
    card.className="newImport-player-card";

    card.innerHTML=`
      <div class="newImport-player-top">
        <img src="${p.gender==="Male"?"male.png":"female.png"}">
        <div class="newImport-player-name">${p.displayName}</div>
      </div>
      <div class="newImport-player-actions">
        <button onclick="newImportRemoveSelected(${i})">×</button>
      </div>
    `;

    newImportSelectedCards.appendChild(card);
  });
}

function newImportRemoveSelected(i){
  newImportState.selectedPlayers.splice(i,1);
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

function newImportClearSelected(){
  newImportState.selectedPlayers=[];
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}


// ================= FINAL IMPORT =================
function newImportAddPlayers(){
  if(!newImportState.selectedPlayers.length){
    alert("No players selected");
    return;
  }

  if(typeof addPlayersFromText==="function"){
    addPlayersFromText(newImportState.selectedPlayers);
  }

  newImportState.historyPlayers=[
    ...newImportState.selectedPlayers,
    ...newImportState.historyPlayers
  ].slice(0,50);

  localStorage.setItem(
    "newImportHistory",
    JSON.stringify(newImportState.historyPlayers)
  );

  newImportHideModal();
}

function newImportAddIfNotExists(list, player) {
  const exists = list.some(
    p => p.displayName.trim().toLowerCase() ===
         player.displayName.trim().toLowerCase()
  );

  if (!exists) {
    list.push(player);
    return true;
  }

  return false;
}

function addPlayer() {

  const textarea = document.getElementById("players-names");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender =
    document.getElementById("player-gender")?.value || "Male";

  const lines = text.split(/\r?\n/);

  // ======================
  // GENDER LOOKUP (multi-language)
  // ======================
  const genderLookup = {};

  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)
        genderLookup[langObj.male.toLowerCase()] = "Male";

      if (langObj.female)
        genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  // fallback English
  genderLookup["male"] = "Male";
  genderLookup["m"] = "Male";
  genderLookup["female"] = "Female";
  genderLookup["f"] = "Female";

  const extractedPlayers = [];

  for (let line of lines) {

    line = line.trim();
    if (!line) continue;

    let gender = defaultGender;

    // Remove numbering (1. John → John)
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();

    // name, gender
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());
      line = parts[0];

      if (parts[1]) {
        const g = parts[1].toLowerCase();
        if (genderLookup[g]) gender = genderLookup[g];
      }
    }

    // name (gender)
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;

    const normalized = line.toLowerCase();

    // prevent duplicates ONLY inside selectedPlayers
    const exists =
      newImportState.selectedPlayers.some(
        p => p.displayName.trim().toLowerCase() === normalized
      ) ||
      extractedPlayers.some(
        p => p.displayName.trim().toLowerCase() === normalized
      );

    if (!exists) {
      extractedPlayers.push({
        displayName: line,
        gender: gender
      });
    }
  }

  if (!extractedPlayers.length) return;

// ======================
// ADD TO SELECTED + HISTORY
// ======================
extractedPlayers.forEach(player => {

  // Add to selected
  newImportAddIfNotExists(
    newImportState.selectedPlayers,
    player
  );

  // Add to history
  if (newImportAddIfNotExists(
        newImportState.historyPlayers,
        {...player}
      )) {
    // keep newest on top
    newImportState.historyPlayers.unshift(player);
  }

});

// keep max 50
newImportState.historyPlayers =
  newImportState.historyPlayers.slice(0, 50);

// save history
localStorage.setItem(
  "newImportHistory",
  JSON.stringify(newImportState.historyPlayers)
);

newImportRefreshSelectedCards();
newImportRefreshSelectCards();

  // ======================
  // RESET UI
  // ======================
  textarea.value = "";
  textarea.style.height = "40px";
  textarea.focus();
}
// ================= CLEAR LISTS =================
function newImportClearHistory(){
  if(!confirm("Clear history?")) return;
  newImportState.historyPlayers=[];
  localStorage.setItem("newImportHistory","[]");
  newImportRefreshSelectCards();
}

function newImportClearFavorites(){
  if(!confirm("Clear favorites?")) return;
  newImportState.favoritePlayers=[];
  localStorage.setItem("newImportFavorites","[]");
  newImportRefreshSelectCards();
}

document.addEventListener("click", (e) => {
  if (!e.target.matches(".circle-btn")) return;

  const action = e.target.dataset.action;

  if (action === "favorite") {
    e.target.classList.toggle("active-favorite");
    e.target.textContent = e.target.classList.contains("active-favorite") ? "★" : "☆";
  }

  if (action === "add") {
    e.target.classList.add("active-added");
    e.target.textContent = "✓";
    e.target.disabled = true;
  }
});



/* ============================================================
   ROUNDS TAB — Court setup, scheduling algorithm, rest queue, global state
   File: rounds.js
   ============================================================ */


let allRounds = [];
let lastRound = [];
let currentRoundIndex = 0;
let isOnPage2 = false;
let resetRest = false;


	
let schedulerState = {
    numCourts: 0,
    allPlayers: [],
    activeplayers: [],
    fixedPairs: [],
    PlayedCount: new Map(),
    restCount: new Map(),
    restQueue: new Map(),
    PlayerScoreMap: new Map(),
    playedTogether: new Map(),
    fixedMap: new Map(),
    roundIndex: 0,
    pairPlayedSet: new Set(),
    gamesMap: new Map(),
    markingWinnerMode: false,
    winCount: new Map(),
    pairCooldownMap: new Map(),
    // ── Competitive algorithm additions ──
    minRounds:  6,
    rankPoints: new Map(),
    streakMap:  new Map(),
    tierMap:    new Map(),
    courts:     1,
    // ─────────────────────────────────────
};

schedulerState.activeplayers = new Proxy([], {
  get(target, prop) {
    const value = target[prop];

    if (typeof value === 'function') {
      return function (...args) {
        const result = value.apply(target, args);
        updateRoundsPageAccess();
        return result;
      };
    }

    return value;
  }
});



allRounds = new Proxy(allRounds, {
  set(target, prop, value) {
    target[prop] = value;
    updateSummaryPageAccess();
    return true;
  },
  deleteProperty(target, prop) {
    delete target[prop];
    updateSummaryPageAccess();
    return true;
  }
});


let courts = 1;

function updateCourtDisplay() {
  document.getElementById("num-courts").textContent = courts;
  updateCourtButtons(); // update both + and -
  goToRounds(); // auto trigger

  const totalPlayers = schedulerState.activeplayers.length;
  const numPlayersPerRound = courts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  if (numResting >= numPlayersPerRound) {
    resetRest = true;
  } else {
    resetRest = false;
  }
	
}

// PLUS button
document.getElementById("courtPlus").onclick = () => {
  const totalPlayers = schedulerState.activeplayers.length;
  const allowedCourts = Math.floor(totalPlayers / 4);

  if (courts < allowedCourts) {
    courts++;
    updateCourtDisplay();
  }
};

// MINUS button
document.getElementById("courtMinus").onclick = () => {
  if (courts > 1) {
    courts--;
    updateCourtDisplay();
  }
};

// Enable / disable buttons
function updateCourtButtons() {
  const totalPlayers = schedulerState.activeplayers.length;
  const allowedCourts = Math.floor(totalPlayers / 4);

  const plusBtn = document.getElementById("courtPlus");
  const minusBtn = document.getElementById("courtMinus");

  // PLUS disable logic
  if (courts >= allowedCourts) {
    plusBtn.disabled = true;
    plusBtn.classList.add("disabled-btn");
  } else {
    plusBtn.disabled = false;
    plusBtn.classList.remove("disabled-btn");
  }

  // MINUS disable logic
  if (courts <= 1) {
    minusBtn.disabled = true;
    minusBtn.classList.add("disabled-btn");
  } else {
    minusBtn.disabled = false;
    minusBtn.classList.remove("disabled-btn");
  }
}


function goToRounds() {
  const numCourtsInput = parseInt(document.getElementById("num-courts").textContent);
  //const numCourtsInput = parseInt(document.getElementById('num-courts').value);
  schedulerState.courts = numCourtsInput; // keep alias in sync for competitive_algorithm.js
  const totalPlayers = schedulerState.activeplayers.length;
  if (!totalPlayers) {
    alert('Please add players first!');
    return;
  }

  if (!numCourtsInput) {
    alert('Please enter no of Courts!');
    return;
  }  
  // Auto-calculate courts based on player count ÷ 4
  let autoCourts = Math.floor(totalPlayers / 4);
  if (autoCourts < 1) autoCourts = 1;
  // Use the smaller of user-input or calculated courts
  const numCourts = numCourtsInput
    ? Math.min(numCourtsInput, autoCourts)
    : autoCourts;
  if (!numCourts) {
    alert('Number of courts could not be determined!');
    return;
  }
  if (allRounds.length <= 1) {
    initScheduler(numCourts);
    allRounds = [AischedulerNextRound(schedulerState)];
    currentRoundIndex = 0;
    showRound(0);
  } else {   
      schedulerState.numCourts = numCourts;      
      schedulerState.fixedMap = new Map();
      let highestRestCount = -Infinity;
      updateScheduler();      
      schedulerState.roundIndex = allRounds.length - 1;
      currentRoundIndex = schedulerState.roundIndex;
      const newRound = AischedulerNextRound(schedulerState);
      allRounds[allRounds.length - 1] = newRound;
       showRound(currentRoundIndex);
    }  
  /*
  document.getElementById('playersPage').style.display = 'none';
  document.getElementById('roundsPage').style.display = 'block';
  isOnPage2 = true;
  */
}

function goBack() {
  updatePlayerList();
  document.getElementById('playersPage').style.display = 'block';
  document.getElementById('roundsPage').style.display = 'none';
  isOnPage2 = false;
  const btn = document.getElementById('goToRoundsBtn');
  btn.disabled = false;
}

function nextRound() {
  
  if (currentRoundIndex + 1 < allRounds.length) {
    currentRoundIndex++;
    showRound(currentRoundIndex);
  } else {
    updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 1;
    showRound(currentRoundIndex);
  }
  updateSummaryPageAccess()
}
function endRounds() {  
	sessionFinished = true;
	updSchedule(allRounds.length - 1, schedulerState); // pass schedulerState
    const newRound = AischedulerNextRound(schedulerState); // do NOT wrap in []
    allRounds.push(newRound);
    currentRoundIndex = allRounds.length - 2;
    showRound(currentRoundIndex);
	
	// pass schedulerState              
	// Disable Next & Refresh
  document.getElementById("nextBtn").disabled = true;
  document.getElementById("roundShufle").disabled = true;

  // Optional: also disable End to prevent double-click
  document.getElementById("endBtn").disabled = true;
	updateSummaryPageAccess();
	showPage('summaryPage');

	
}
function prevRound() {
  if (currentRoundIndex > 0) {
    currentRoundIndex--;
    showRound(currentRoundIndex);
  }
}

function initScheduler(numCourts) {
  schedulerState.numCourts = numCourts;
  schedulerState.restCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayedCount = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.PlayerScoreMap = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.playedTogether = new Map();
  schedulerState.fixedMap = new Map();
  schedulerState.pairPlayedSet = new Set();
  schedulerState.gamesMap = new Set();
  schedulerState.roundIndex = 0;

  // ── Competitive algorithm additions ──
  schedulerState.minRounds  = parseInt(localStorage.getItem('minRounds')) || 6;
  schedulerState.rankPoints = new Map(schedulerState.activeplayers.map(p => [p, 100]));
  schedulerState.streakMap  = new Map(schedulerState.activeplayers.map(p => [p, 0]));
  schedulerState.tierMap    = new Map();
  schedulerState.courts     = numCourts;
  // ─────────────────────────────────────

  // Initialize opponentMap
  schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0);
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }

  // Map each fixed pair for quick lookup
  schedulerState.fixedPairs.forEach(([a, b]) => {
    schedulerState.fixedMap.set(a, b);
    schedulerState.fixedMap.set(b, a);
  });

  schedulerState.restQueue = createRestQueue();
}


function updateScheduler() {
   schedulerState.opponentMap = new Map();
  for (const p1 of schedulerState.activeplayers) {
    const innerMap = new Map();
    for (const p2 of schedulerState.activeplayers) {
      if (p1 !== p2) innerMap.set(p2, 0); // start all counts at 0
    }
    schedulerState.opponentMap.set(p1, innerMap);
  }
    schedulerState.restQueue = rebuildRestQueue(
    schedulerState.restQueue );  // initial queue
    
}

/* ================================
   🔁 1-3-2-4 QUEUE REORDER (GUARDED)
================================ */
function reorder1324(queue, roundIndex = 0) {
  const total = queue.length;

  if (total < 4 || total % 2 !== 0) {
    return queue.slice();
  }

  // 1️⃣ split into pairs
  const pairs = [];
  for (let i = 0; i < total; i += 2) {
    pairs.push([queue[i], queue[i + 1]]);
  }

  const pCount = pairs.length;

  // 2️⃣ 4 or 6 pairs (8 / 12 players)
  if (pCount === 4 || pCount === 6) {
    const size = Math.floor(pCount / 4);

    const g1 = pairs.slice(0, size);
    const g2 = pairs.slice(size, size * 2);
    const g3 = pairs.slice(size * 2, size * 3);
    const g4 = pairs.slice(size * 3);

    // deterministic rotations (no randomness)
    const patterns = [
      [g1, g4, g2, g3], // 1-4-2-3
      [g2, g1, g4, g3], // rotate
      [g3, g2, g1, g4], // rotate
    ];

    const pattern = patterns[roundIndex % patterns.length];
    return pattern.flat().flat();
  }

  // 3️⃣ 8+ pairs (16+ players)
  if (pCount >= 8) {
    const size = Math.floor(pCount / 8);
    const groups = [];

    for (let i = 0; i < 8; i++) {
      groups.push(pairs.slice(i * size, (i + 1) * size));
    }

    const patterns = [
      [0, 2, 4, 6, 1, 3, 5, 7],
      [1, 3, 5, 7, 2, 4, 6, 0],
      [2, 4, 6, 0, 3, 5, 7, 1],
      [3, 5, 7, 1, 4, 6, 0, 2],
    ];

    const order = patterns[roundIndex % patterns.length];
    return order.flatMap(i => groups[i]).flat();
  }

  // 4️⃣ fallback → rotate pairs by roundIndex
  const offset = roundIndex % pCount;
  return [...pairs.slice(offset), ...pairs.slice(0, offset)].flat();
}
function old2reorder1324(queue) {
  const total = queue.length;

  // 🔹 Case: 8 or 12 players → divide by 4
  if (total === 8 || total === 12) {
    const size = Math.floor(total / 4);

    const g1 = queue.slice(0, size);
    const g2 = queue.slice(size, size * 2);
    const g3 = queue.slice(size * 2, size * 3);
    const g4 = queue.slice(size * 3);

    // 1,4,2,3
    return [...g1, ...g4, ...g2, ...g3];
  }

  // 🔹 Case: 16 or more players → divide by 8
  if (total >= 16) {
    const size = Math.floor(total / 8);
    const groups = [];

    for (let i = 0; i < 8; i++) {
      groups.push(queue.slice(i * size, (i + 1) * size));
    }

    // 1,3,5,7,2,4,6,8
    return [
      ...groups[0],
      ...groups[2],
      ...groups[4],
      ...groups[6],
      ...groups[1],
      ...groups[3],
      ...groups[5],
      ...groups[7],
    ];
  }

  // 🔹 Default → no change
  return queue.slice();
}

function oldreorder1324(queue) {
  const total = queue.length;
  const quarter = Math.floor(total / 4);

  const q1 = queue.slice(0, quarter);
  const q2 = queue.slice(quarter, quarter * 2);
  const q3 = queue.slice(quarter * 2, quarter * 3);
  const q4 = queue.slice(quarter * 3);

  return [...q1, ...q3, ...q2, ...q4];
}

// 🔍 check if ALL pairs exhausted
function allPairsExhausted(queue, pairPlayedSet) {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const key = [queue[i], queue[j]].sort().join("&");
      if (!pairPlayedSet.has(key)) return false;
    }
  }
  return true;
}



function updSchedule(roundIndex, schedulerState) {
  //AUTO_SAVE();
	const data = allRounds[roundIndex];
  if (!data) return;

  const { games, resting } = data;
  const {
    restCount,
    PlayedCount,
    PlayerScoreMap,
    opponentMap,
    pairPlayedSet,
	gamesMap,
    playedTogether, // <<-- Missing in your version
  } = schedulerState;

  // 1️⃣ Update rest count
  for (const p of resting) {
    const playerName = p.split('#')[0];
    restCount.set(playerName, (restCount.get(playerName) || 0) + 1);
  }
   
// Helper → base name
const base = p => p.split('#')[0];

// 1️⃣ COPY restQueue first (so we don't modify during loop)
let newQueue = schedulerState.restQueue.slice();

// 2️⃣ FULL REMOVE: strip any players whose base name matches resting
for (const r of resting) {
  const b = base(r);
  newQueue = newQueue.filter(q => base(q) !== b);
}

// Replace restQueue after ALL removals done
schedulerState.restQueue = newQueue;

// 3️⃣ FULL ADD: now add base names of ALL resting at once
for (const r of resting) {
  schedulerState.restQueue.push(base(r));
}    

  // 2️⃣ Update PlayedCount
  lastRound.length = 0; // 🔥 reset global array (keeps reference)

for (const game of games) {
  const allPlayers = [...game.pair1, ...game.pair2];

  lastRound.push(...allPlayers);

  for (const p of allPlayers) {
    PlayedCount.set(p, (PlayedCount.get(p) || 0) + 1);
  }
}

  // 3️⃣ Update opponentMap & PlayerScoreMap
  for (const game of games) {
    const { pair1, pair2 } = game;

    // Ensure maps exist (prevents null errors)
    for (const a of [...pair1, ...pair2]) {
      if (!opponentMap.has(a)) opponentMap.set(a, new Map());
    }

    // Opponent tracking
    for (const a of pair1) {
      for (const b of pair2) {
        opponentMap.get(a).set(b, (opponentMap.get(a).get(b) || 0) + 1);
        opponentMap.get(b).set(a, (opponentMap.get(b).get(a) || 0) + 1);
      }
    }

    // Score calculation (new opponents bonus)
    for (const group of [pair1, pair2]) {
      for (const player of group) {
        let newOpponents = 0;
        const rivals = group === pair1 ? pair2 : pair1;

        for (const r of rivals) {
          if (opponentMap.get(player).get(r) === 1) newOpponents++;
        }

        const score = newOpponents === 2 ? 2 : newOpponents === 1 ? 1 : 0;
        PlayerScoreMap.set(player, (PlayerScoreMap.get(player) || 0) + score);
      }
    }
  }

  // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
    for (const pr of [game.pair1, game.pair2]) {
      const key = pr.slice().sort().join("&");
      pairPlayedSet.add(key);
      playedTogether.set(key, roundIndex); // <<-- IMPORTANT FIX
    }
  }

    // 4️⃣ Track pairs played together (with round info)
  for (const game of games) {
  const p1 = game.pair1.slice().sort().join("&");
  const p2 = game.pair2.slice().sort().join("&");

  // ensure A&B:C&D === C&D:A&B
  const gameKey = [p1, p2].sort().join(":");

  gamesMap.add(gameKey);
}

/// 7️⃣ 🏆 Update COMPETITIVE RANK POINTS (+2 / -2)
if (getPlayMode() === "competitive") {
  for (const game of games) {
    if (!game.winner) continue;

    const winners = game.winner === 'L' ? game.pair1 : game.pair2;
    const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

    for (const p of winners) {
      schedulerState.rankPoints.set(
        p,
        (schedulerState.rankPoints.get(p) || 0) + 2
      );
	  schedulerState.winCount.set(
	    p,
	    (schedulerState.winCount.get(p) || 0) + 1
	  );	
    }

    for (const p of losers) {
      schedulerState.rankPoints.set(
        p,
        (schedulerState.rankPoints.get(p) || 0) - 2
      );
    }
  }
}

// after tracking pairs & games
checkAndResetPairCycle(schedulerState, games, roundIndex);
	// ✅ EXECUTE ONLY WHEN BOTH CONDITIONS ARE TRUE
if ( resetRest === true &&
  allPairsExhausted(schedulerState.restQueue, pairPlayedSet)
) {
  schedulerState.restQueue = reorder1324(schedulerState.restQueue);

  // optional: prevent repeated execution
  //schedulerState.resetRest = false;
}
}

function createRestQueue() {
  // Simply return active players in their current order
  return [...schedulerState.activeplayers];
}

function rebuildRestQueue(restQueue) {
  const newQueue = [];
  const active = schedulerState.activeplayers;

  // 1. Add active players based on the order in old restQueue
  for (const p of restQueue) {
    if (active.includes(p)) {
      newQueue.push(p);
    }
  }

  // 2. Add any newly active players not found in old restQueue
  for (const p of active) {
    if (!newQueue.includes(p)) {
      newQueue.push(p);
    }
  }

  return newQueue;
}




  

function RefreshRound() {
    schedulerState.roundIndex = allRounds.length - 1;
    currentRoundIndex = schedulerState.roundIndex;
    const newRound = AischedulerNextRound(schedulerState);
    allRounds[allRounds.length - 1] = newRound;
    showRound(currentRoundIndex);
}

function report() {
  const container = document.getElementById("reportContainer");
  container.innerHTML = "";

  const playMode = getPlayMode(); // "competitive" | "random"

  /* ===== HEADER ===== */
  const header = document.createElement("div");
  header.className = "report-header";
  header.innerHTML = `
    <div class="header-rank" data-i18n="rank">Rank</div>
    <div class="header-name" data-i18n="name">Name</div>
    <div class="header-wins" data-i18n="wins">Wins</div>
    <div class="header-played" data-i18n="played">Played</div>
    <div class="header-rested" data-i18n="rested">Rested</div>
  `;
  container.appendChild(header);

  /* ===== SORT LOGIC ===== */
  let sortedPlayers = [...schedulerState.allPlayers];

  if (playMode === "competitive") {
    // 🔥 PURE WINS LADDER
    sortedPlayers.sort((a, b) => {
      const wA = schedulerState.winCount.get(a.name) || 0;
      const wB = schedulerState.winCount.get(b.name) || 0;
      return wB - wA;
    });
  } else {
    // 🎲 EXISTING FAIRNESS MODE
    sortedPlayers.sort((a, b) => {
      const playedA = schedulerState.PlayedCount.get(a.name) || 0;
      const playedB = schedulerState.PlayedCount.get(b.name) || 0;
      if (playedB !== playedA) return playedB - playedA;

      const restA = schedulerState.restCount.get(a.name) || 0;
      const restB = schedulerState.restCount.get(b.name) || 0;
      return restB - restA;
    });
  }

  /* ===== RENDER ===== */
  sortedPlayers.forEach((p, index) => {
    const wins = schedulerState.winCount.get(p.name) || 0;
    const played = schedulerState.PlayedCount.get(p.name) || 0;
    const rest = schedulerState.restCount.get(p.name) || 0;

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="name">${p.name}</div>
      <div class="stat wins">${wins}</div>
      <div class="stat played">${played}</div>
      <div class="stat rest">${rest}</div>
    `;
    container.appendChild(card);
  });

  setLanguage(currentLang);
}

function workedreport() {
  const container = document.getElementById("reportContainer");
  container.innerHTML = ""; // Clear old cards

  // ⭐ Add title header row
  const header = document.createElement("div");
  header.className = "report-header";
  header.innerHTML = `
    <div class="header-rank" data-i18n="rank">Rank</div>
    <div class="header-name" data-i18n="name">Name</div>
    <div class="header-played" data-i18n="played">Played</div>
    <div class="header-rested" data-i18n="rested">Rested</div>
  `;
  container.appendChild(header);

  // Sort & add players
  const sortedPlayers = [...schedulerState.allPlayers].sort((a, b) => {
    const playedA = schedulerState.PlayedCount.get(a.name) || 0;
    const playedB = schedulerState.PlayedCount.get(b.name) || 0;
    return playedB - playedA;
  });

  sortedPlayers.forEach((p, index) => {
    const played = schedulerState.PlayedCount.get(p.name) || 0;
    const rest = schedulerState.restCount.get(p.name) || 0;

    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div class="name">${p.name.replace(/^\d+\.?\s*/, "")}</div>
      <div class="stat played" style="border-color:${getPlayedColor(played)}">${played}</div>
      <div class="stat rest" style="border-color:${getRestColor(rest)}">${rest}</div>
    `;
    container.appendChild(card);
  });

  // ⭐ Important: Apply translation to new elements
  setLanguage(currentLang);
}


function checkAndResetPairCycle(schedulerState, games, roundIndex) {
  const {
    activeplayers,
    pairPlayedSet,
    playedTogether,
    gamesMap,
    opponentMap
  } = schedulerState;

  // --- exhaustion check (INCLUDING latest round) ---
  const bases = activeplayers.map(p => p.split('#')[0]);
  const totalPossiblePairs =
    (bases.length * (bases.length - 1)) / 2;

  if (pairPlayedSet.size < totalPossiblePairs) return false;

  // --- snapshot latest round ---
  const latestPairs = [];
  const latestGames = [];

  for (const game of games) {
    const p1 = game.pair1.slice().sort().join("&");
    const p2 = game.pair2.slice().sort().join("&");

    latestPairs.push(p1, p2);
    latestGames.push([p1, p2].sort().join(":"));
  }

  // --- reset pairing-related state ---
  pairPlayedSet.clear();
  playedTogether.clear();
  gamesMap.clear();
  opponentMap.clear();

  // --- restore ONLY latest round ---
  for (const key of latestPairs) {
    pairPlayedSet.add(key);
    playedTogether.set(key, roundIndex);
  }

  for (const gk of latestGames) {
    gamesMap.add(gk);
  }

  return true; // cycle reset happened
}






 


/* ============================================================
   GAMES — Round rendering, win marking, player swaps
   File: games.js
   ============================================================ */

let roundActive = false;

let currentState = "idle";
const statusEl = document.getElementById("statusDisplay");
const textEl = document.getElementById("btnText");
const btn = document.getElementById("nextBtn");
const icon = btn.querySelector(".icon");
const roundStates = {
  idle: {
    key: "nround",
    icon: "▶",
    class: ""
  },
  active: {
    key: "endrounds",
    icon: "⏹",
    class: "end"
  }
};
function getPairKey(a, b) {
  return [a, b].sort().join("|");
}

// Game identity must be based on PAIR vs PAIR (not 4 flattened players)
function getGameKey(pair1Key, pair2Key) {
  return [pair1Key, pair2Key].sort().join("|");
}

const repetitionHistory = {
  pairSet: new Set(),
  gameSet: new Set(),
  builtUntilRound: -1
};

function updatePreviousHistory(currentRoundIndex) {

  // Safety reset (if reset/back navigation happens)
  if (repetitionHistory.builtUntilRound >= currentRoundIndex - 1) {
    repetitionHistory.pairSet.clear();
    repetitionHistory.gameSet.clear();
    repetitionHistory.builtUntilRound = -1;
  }

  // Build only missing rounds
  for (
    let i = repetitionHistory.builtUntilRound + 1;
    i < currentRoundIndex;
    i++
  ) {

    const round = allRounds[i];
    if (!round?.games) continue;

    for (const game of round.games) {

      const t1 = game.pair1;
      const t2 = game.pair2;

      if (!t1 || !t2) continue;

      const pair1Key = getPairKey(t1[0], t1[1]);
      const pair2Key = getPairKey(t2[0], t2[1]);

      // Store pair history
      repetitionHistory.pairSet.add(pair1Key);
      repetitionHistory.pairSet.add(pair2Key);

      // Store exact game history (pair vs pair)
      const gameKey = getGameKey(pair1Key, pair2Key);
      repetitionHistory.gameSet.add(gameKey);
    }
  }

  repetitionHistory.builtUntilRound = currentRoundIndex - 1;
}

function isPairRepeated(pair) {
  if (!pair) return false;

  const pairKey = getPairKey(pair[0], pair[1]);
  return repetitionHistory.pairSet.has(pairKey);
}

function isGameRepeated(game) {
  if (!game?.pair1 || !game?.pair2) return false;

  const pair1Key = getPairKey(game.pair1[0], game.pair1[1]);
  const pair2Key = getPairKey(game.pair2[0], game.pair2[1]);

  const gameKey = getGameKey(pair1Key, pair2Key);

  return repetitionHistory.gameSet.has(gameKey);
}





function toggleRound() {
  const btn = document.getElementById("nextBtn");
  const textEl = document.getElementById("btnText");
  const icon = btn.querySelector(".icon");
  const playmode = getPlayMode();
  
  if (currentState === "idle") {
    // ---- ENTER ACTIVE (BUSY) MODE ----
    if (interactionLocked ==false) {
      lockBtn.click();
    }
    currentState = "active";

    // Disable everything except #nextBtn and .win-cup
    document.querySelectorAll(
      "button, .player-btn, .mode-card, .lock-icon, .swap-icon, .menu-btn"
    ).forEach(el => {
      if (el.id !== "nextBtn" && !el.classList.contains("win-cup")) {
        el.style.pointerEvents = "none";
        el.classList.add("disabled");    
      }
    });   

    // Show win cups whenever competitive toggle is ON
    // (even during warm-up) so winners can be marked for seeding
    document.querySelectorAll(".win-cup").forEach(cup => {
      cup.style.visibility = playmode === "competitive" ? "visible" : "hidden";
      cup.style.pointerEvents = playmode === "competitive" ? "auto" : "none";
      cup.classList.add("blinking");
    });

    document.getElementById("roundsPage").classList.add("active-mode");

  } else {
    // ---- RETURN TO IDLE MODE ----

    // Require winners if competitive toggle is ON
    // (warm-up rounds included — results seed tier rankings)
    if (playmode === "competitive") {     
      const currentRoundGames = allRounds[allRounds.length - 1].games;
      const winnersCount = currentRoundGames.filter(game => game.winner).length;
      
      if (!currentRoundGames.length || winnersCount !== currentRoundGames.length) {
        alert("Please mark winners for all games");
        return; // ❌ stay in active mode
      }

      // Always update points when competitive toggle is ON
      // warm-up rounds → seeds tier rankings
      // competitive rounds → drives tier rankings
      updatePointsAfterRound(schedulerState);
    }

    currentState = "idle";
    nextRound();
    document.getElementById("roundsPage").classList.remove("active-mode");
    
    // Re-enable everything previously disabled
    document.querySelectorAll(".disabled").forEach(el => {
      el.style.pointerEvents = "";
      el.classList.remove("disabled");
    
      if (el.classList.contains("menu-btn")) {
        el.onclick = function() {
          showPage('settingsPage', this);
        };
      }
    });

    // Hide & disable win cups
    document.querySelectorAll(".win-cup").forEach(cup => {
      cup.style.pointerEvents = "none";
      cup.style.visibility = "hidden";
    });
  }

  const state = roundStates[currentState];
  textEl.dataset.i18n = state.key;
  icon.textContent = state.icon;
  btn.classList.toggle("end", state.class === "end");
  setLanguage(currentLang);
}





function setStatus(status) {
  //statusEl.classList.remove("status-ready", "status-progress");

  /*if (status === "Ready") {
    statusEl.dataset.i18n = "statusReady";
    statusEl.classList.add("status-ready");
  } else if (status === "In Progress") {
    statusEl.dataset.i18n = "statusProgress";
    statusEl.classList.add("status-progress");
  } 
*/

  // Re-apply translations so text updates immediately
  setLanguage(currentLang);
}



let isLocked = true;
  const lockIcon = document.getElementById('lockToggleBtn');

  function toggleLock() {
    isLocked = !isLocked;
    lockIcon.src = isLocked ? 'lock.png' : 'unlock.png';
    lockIcon.alt = isLocked ? 'Lock' : 'Unlock';
  }

  lockIcon.addEventListener('click', toggleLock);

function getNextFixedPairGames(schedulerState, fixedPairs, numCourts) {
  const hash = JSON.stringify(fixedPairs);

  // 🔁 Initialize OR reset when queue is empty OR pairs changed
  if (
    !schedulerState.fixedPairGameQueue ||
    schedulerState.fixedPairGameQueue.length === 0 ||
    schedulerState.fixedPairGameQueueHash !== hash
  ) {
    schedulerState.fixedPairGameQueueHash = hash;
    schedulerState.fixedPairGameQueue = [];

    // Generate ALL unique games (pair vs pair)
    for (let i = 0; i < fixedPairs.length; i++) {
      for (let j = i + 1; j < fixedPairs.length; j++) {
        schedulerState.fixedPairGameQueue.push({
          pair1: fixedPairs[i],
          pair2: fixedPairs[j],
        });
      }
    }

    // Optional shuffle (recommended)
    schedulerState.fixedPairGameQueue = shuffle(
      schedulerState.fixedPairGameQueue
    );
  }

  const games = [];
  const usedPairs = new Set();
  const remainingGames = [];

  // 🎯 Select playable games, remove ONLY played ones
  for (const game of schedulerState.fixedPairGameQueue) {
    if (games.length >= numCourts) {
      remainingGames.push(game);
      continue;
    }

    const k1 = game.pair1.join("&");
    const k2 = game.pair2.join("&");

    if (usedPairs.has(k1) || usedPairs.has(k2)) {
      // Not playable this round → keep it
      remainingGames.push(game);
      continue;
    }

    // ✅ Game is played → remove
    playername1 = "";
    playername2 = "";
    games.push({
      court: games.length + 1,
      pair1: [...game.pair1],
      pair2: [...game.pair2],
      winners: [playername1, playername2]
    });

    usedPairs.add(k1);
    usedPairs.add(k2);
  }

  // Update queue with unplayed games only
  schedulerState.fixedPairGameQueue = remainingGames;

  return games;
}


function AischedulerNextRound(schedulerState) {

  const { activeplayers } = schedulerState;
  const playmode = getPlayMode();
  const page2 = document.getElementById("roundsPage");

  let result;

  // Use minRounds from user input instead of hardcoded played count
  const canStartCompetitive =
    activeplayers.length > 0 &&
    allRounds.length >= (schedulerState.minRounds || 6);

  // --------------------------------------------------
  // RANDOM MODE
  // --------------------------------------------------
  if (playmode === "random" || !canStartCompetitive) {

    if (schedulerState._lastMode === "competitive") {
      // resetForRandomPhase(schedulerState); // optional
    }

    result = RandomRound(schedulerState);

    page2.classList.remove("competitive-mode");
    page2.classList.add("random-mode");

    schedulerState._lastMode = "random";
  }

  // --------------------------------------------------
  // COMPETITIVE MODE
  // --------------------------------------------------
  else {

    // Reset only once when entering competitive
    if (schedulerState._lastMode !== "competitive") {
      resetForCompetitivePhase(schedulerState);
    }

    // 🔥 Uses new CompetitiveRound from competitive_algorithm.js
    result = CompetitiveRound(schedulerState);

    page2.classList.remove("random-mode");
    page2.classList.add("competitive-mode");

    schedulerState._lastMode = "competitive";
  }

  return result;
}

function resetForCompetitivePhase(state) {

  // Clear pair uniqueness memory
  state.pairPlayedSet.clear();
  state.playedTogether.clear();
  state.gamesMap.clear();
  state.pairCooldownMap.clear();

  // Reset opponent tracking
  state.opponentMap = new Map();
  for (const p1 of state.activeplayers) {
    const inner = new Map();
    for (const p2 of state.activeplayers) {
      if (p1 !== p2) inner.set(p2, 0);
    }
    state.opponentMap.set(p1, inner);
  }

  // DO NOT TOUCH:
  // winCount
  // rankPoints
  // PlayedCount
  // restCount
  // restQueue
}

function getPlayingAndResting(state) {

  const totalPlayers = state.activeplayers.length;
  const playersPerRound = state.courts * 4;

  let resting = [];
  let playing = [];

  if (totalPlayers > playersPerRound) {
    const needRest = totalPlayers - playersPerRound;
    // Use existing restQueue order (same logic as RandomRound)
    resting = state.restQueue.slice(0, needRest);
  }

  const restSet = new Set(resting);
  playing = state.activeplayers.filter(p => !restSet.has(p));

  return { playing, resting };
}

function extractActiveFixedPairs(state, playing) {

  const activePairs = [];
  const lockedPlayers = new Set();

  for (const pair of state.fixedPairs || []) {
    const [a, b] = pair;

    if (playing.includes(a) && playing.includes(b)) {
      activePairs.push([a, b]);
      lockedPlayers.add(a);
      lockedPlayers.add(b);
    }
  }

  return { activePairs, lockedPlayers };
}

function groupByTier(state, players) {

  const strong = [];
  const inter = [];
  const weak = [];

  for (const p of players) {
    const rating = state.winCount.get(p) || 0;

    if (rating >= state.strongThreshold) strong.push(p);
    else if (rating >= state.interThreshold) inter.push(p);
    else weak.push(p);
  }

  return { strong, inter, weak };
}

function buildBestTeam(state, pool) {

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {

      const p1 = pool[i];
      const p2 = pool[j];

      const key = createSortedKey(p1, p2);

      if (!state.pairPlayedSet.has(key)) {
        return [p1, p2];
      }
    }
  }

  // fallback if no unique pair
  return [pool[0], pool[1]];
}

// OLD CompetitiveRound removed — using competitive_algorithm.js instead

function updateAfterRound(state, games) {
  for (const game of games) {

    // Handle both [team1, team2] array format AND {pair1, pair2} object format
    const team1 = Array.isArray(game) ? game[0] : game.pair1;
    const team2 = Array.isArray(game) ? game[1] : game.pair2;

    if (!team1 || !team2) continue;

    const key1 = createSortedKey(team1[0], team1[1]);
    const key2 = createSortedKey(team2[0], team2[1]);

    state.pairPlayedSet.add(key1);
    state.pairPlayedSet.add(key2);

    // Update opponent map safely
    for (const p1 of team1) {
      for (const p2 of team2) {

        // Ensure maps exist before accessing
        if (!state.opponentMap.has(p1)) state.opponentMap.set(p1, new Map());
        if (!state.opponentMap.has(p2)) state.opponentMap.set(p2, new Map());

        state.opponentMap.get(p1).set(p2, (state.opponentMap.get(p1).get(p2) || 0) + 1);
        state.opponentMap.get(p2).set(p1, (state.opponentMap.get(p2).get(p1) || 0) + 1);
      }
    }
  }
}


function RandomRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
    lastRound,
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  const fixedPairPlayers = new Set(fixedPairs.flat());
  let freePlayers = activeplayers.filter(p => !fixedPairPlayers.has(p));

  let resting = [];
  let playing = [];

  // ================= REST SELECTION (UNCHANGED) =================
  if (fixedPairs.length > 0 && numResting >= 2) {
    let needed = numResting;
    const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a);
    }

    for (const p of schedulerState.restQueue) {
      if (resting.includes(p)) continue;

      const partner = fixedMap.get(p);
      if (partner) {
        if (needed >= 2) {
          resting.push(p, partner);
          needed -= 2;
        }
      } else if (needed > 0) {
        resting.push(p);
        needed -= 1;
      }

      if (needed <= 0) break;
    }

    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    const sortedPlayers = [...schedulerState.restQueue];
    resting = sortedPlayers.slice(0, numResting);
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
  }

  // ================= PAIR PREP =================
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(
    p => !fixedPairPlayersThisRound.has(p)
  );

  freePlayersThisRound = reorderFreePlayersByLastRound(
    freePlayersThisRound,
    lastRound,
    numCourts
  );

  // ================= ALL FIXED DETECTION =================
  const allFixed =
    freePlayersThisRound.length === 0 &&
    fixedPairs.length >= numCourts * 2;

  // ================= ALL FIXED (QUEUE-BASED ROUND ROBIN) =================
  if (allFixed) {
    const games = getNextFixedPairGames(
      schedulerState,
      fixedPairs,
      numCourts
    );

    const playingPlayers = new Set(
      games.flatMap(g => [...g.pair1, ...g.pair2])
    );

    resting = activeplayers.filter(p => !playingPlayers.has(p));
    playing = [...playingPlayers];

    schedulerState.roundIndex =
      (schedulerState.roundIndex || 0) + 1;

    return {
      round: schedulerState.roundIndex,
      resting: resting.map(p => {
        const c = restCount.get(p) || 0;
        return `${p}#${c + 1}`;
      }),
      playing,
      games,
    };
  }

  // ================= ORIGINAL FREE-PAIR LOGIC =================
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs =
    requiredPairsCount - fixedPairsThisRound.length;

  let selectedPairs = findDisjointPairs(
    freePlayersThisRound,
    schedulerState.pairPlayedSet,
    neededFreePairs,
    opponentMap
  );

  let finalFreePairs = selectedPairs || [];

  if (finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());

    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;

      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;

        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }

      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  allPairs = shuffle(allPairs);

  let matchupScores = getMatchupScores(allPairs, opponentMap);
  const games = [];
  const usedPairs = new Set();

  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join("&");
    const p2Key = pair2.join("&");

    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;

    games.push({
      court: games.length + 1,
      pair1: [...pair1],
      pair2: [...pair2],
    });

    usedPairs.add(p1Key);
    usedPairs.add(p2Key);

    if (games.length >= numCourts) break;
  }

  const restingWithNumber = resting.map(p => {
    const c = restCount.get(p) || 0;
    return `${p}#${c + 1}`;
  });

  schedulerState.roundIndex =
    (schedulerState.roundIndex || 0) + 1;

  return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };
}




// ==============================
// Generate next round (no global updates)
// ==============================
function betaAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
    pairPlayedSet
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const playersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - playersPerRound, 0);

  /* ==========================
     1️⃣ RESTING / PLAYING
  ========================== */

  let resting = [];
  let playing = [];

  if (numResting > 0) {
    resting = schedulerState.restQueue.slice(0, numResting);
    playing = activeplayers.filter(p => !resting.includes(p));
  } else {
    playing = activeplayers.slice(0, playersPerRound);
  }

  /* ==========================
     2️⃣ FIXED PAIRS
  ========================== */

  const playingSet = new Set(playing);
  const fixedPairsThisRound = fixedPairs.filter(
    ([a, b]) => playingSet.has(a) && playingSet.has(b)
  );

  const fixedPlayers = new Set(fixedPairsThisRound.flat());
  let freePlayers = playing.filter(p => !fixedPlayers.has(p));

  const requiredPairs = playersPerRound / 2;
  const neededFreePairs = requiredPairs - fixedPairsThisRound.length;

  /* ==========================
     3️⃣ BEST FREE PAIRS
  ========================== */

  let freePairs =
    findDisjointPairs(
      freePlayers,
      pairPlayedSet,
      neededFreePairs,
      opponentMap
    ) || [];

  // fallback safety
  if (freePairs.length < neededFreePairs) {
    const used = new Set(freePairs.flat());
    for (let i = 0; i < freePlayers.length; i++) {
      for (let j = i + 1; j < freePlayers.length; j++) {
        const a = freePlayers[i], b = freePlayers[j];
        if (used.has(a) || used.has(b)) continue;
        freePairs.push([a, b]);
        used.add(a); used.add(b);
        if (freePairs.length === neededFreePairs) break;
      }
      if (freePairs.length === neededFreePairs) break;
    }
  }

  const allPairs = [...fixedPairsThisRound, ...freePairs];

  /* ==========================
     4️⃣ BEST COURT MATCHUPS
  ========================== */

  const matchupScores = getMatchupScores(allPairs, opponentMap);

  const games = [];
  const usedPairs = new Set();

  for (const m of matchupScores) {
    const k1 = m.pair1.join("&");
    const k2 = m.pair2.join("&");
    if (usedPairs.has(k1) || usedPairs.has(k2)) continue;

    games.push({
      court: games.length + 1,
      pair1: [...m.pair1],
      pair2: [...m.pair2]
    });

    usedPairs.add(k1);
    usedPairs.add(k2);

    if (games.length === numCourts) break;
  }

  /* ==========================
     5️⃣ REST DISPLAY
  ========================== */

  const restingWithCount = resting.map(p => {
    const cnt = restCount.get(p) || 0;
    return `${p}#${cnt + 1}`;
  });

  schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

  return {
    round: schedulerState.roundIndex,
    resting: restingWithCount,
    playing,
    games
  };
}



function backupAischedulerNextRound(schedulerState) {
  const {
    activeplayers,
    numCourts,
    fixedPairs,
    restCount,
    opponentMap,
  } = schedulerState;

  const totalPlayers = activeplayers.length;
  const numPlayersPerRound = numCourts * 4;
  const numResting = Math.max(totalPlayers - numPlayersPerRound, 0);

  // Separate fixed pairs and free players
  const fixedPairPlayers = new Set(fixedPairs.flat());
let freePlayers = activeplayers.filter(p => !fixedPairPlayers.has(p));

// ... top of function (resting and playing already declared as let)
let resting = [];
let playing = [];

// 1. Select resting and playing players
if (fixedPairs.length > 0 && numResting >= 2) {

  let needed = numResting;
  const fixedMap = new Map();
    for (const [a, b] of fixedPairs) {
      fixedMap.set(a, b);
      fixedMap.set(b, a); // Must include reverse
    }

  // Use only restQueue order
 for (const p of schedulerState.restQueue) {
  if (resting.includes(p)) continue;

  const partner = fixedMap.get(p);

  if (partner) {
    // Fixed pair rule -> only rest together
    if (needed >= 2) {
      resting.push(p, partner);
      needed -= 2;
    }
    // If not enough slots -> skip both completely
  } else {
    // Only rest free players
    if (needed > 0) {
      resting.push(p);
      needed -= 1;
    }
  }

  if (needed <= 0) break;
}



  // Playing = everyone else (NO redeclaration)
  playing = activeplayers.filter(p => !resting.includes(p));

} else {

      // Use restQueue order directly (no sorting)
    const sortedPlayers = [...schedulerState.restQueue];
    
    // Assign resting players
    resting = sortedPlayers.slice(0, numResting);
    
    // Assign playing players
    playing = activeplayers
      .filter(p => !resting.includes(p))
      .slice(0, numPlayersPerRound);
}


  // 2️⃣ Prepare pairs
  const playingSet = new Set(playing);
  let fixedPairsThisRound = [];
  for (const pair of fixedPairs) {
    if (playingSet.has(pair[0]) && playingSet.has(pair[1])) {
      fixedPairsThisRound.push([pair[0], pair[1]]);
    }
  }

  const fixedPairPlayersThisRound = new Set(fixedPairsThisRound.flat());
  let freePlayersThisRound = playing.filter(p => !fixedPairPlayersThisRound.has(p));
  freePlayersThisRound = reorderFreePlayersByLastRound(
  freePlayersThisRound,
  lastRound,
  numCourts
);
  const requiredPairsCount = Math.floor(numPlayersPerRound / 2);
  let neededFreePairs = requiredPairsCount - fixedPairsThisRound.length;
  //freePlayersThisRound = reorder1324(freePlayersThisRound);
  let selectedPairs = findDisjointPairs(freePlayersThisRound, schedulerState.pairPlayedSet, neededFreePairs, opponentMap);

  let finalFreePairs = selectedPairs || [];

  // Fallback pairing for leftovers
  if (finalFreePairs.length < neededFreePairs) {
    const free = freePlayersThisRound.slice();
    const usedPlayers = new Set(finalFreePairs.flat());
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (usedPlayers.has(a)) continue;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (usedPlayers.has(b)) continue;
        finalFreePairs.push([a, b]);
        usedPlayers.add(a);
        usedPlayers.add(b);
        break;
      }
      if (finalFreePairs.length >= neededFreePairs) break;
    }
  }

  // 3️⃣ Combine all pairs and shuffle
  let allPairs = fixedPairsThisRound.concat(finalFreePairs);
  allPairs = shuffle(allPairs);

  // 4️⃣ Create games (courts) using matchupScores (no updates here)
  let matchupScores = getMatchupScores(allPairs, opponentMap);
  const games = [];
  const usedPairs = new Set();
  for (const match of matchupScores) {
    const { pair1, pair2 } = match;
    const p1Key = pair1.join("&");
    const p2Key = pair2.join("&");
    if (usedPairs.has(p1Key) || usedPairs.has(p2Key)) continue;
    games.push({ court: games.length + 1, pair1: [...pair1], pair2: [...pair2] });
    usedPairs.add(p1Key);
    usedPairs.add(p2Key);
    if (games.length >= numCourts) break;
  }

  // 5️⃣ Prepare resting display with +1 for current round
  const restingWithNumber = resting.map(p => {
    const currentRest = restCount.get(p) || 0;
    return `${p}#${currentRest + 1}`;
  });

 schedulerState.roundIndex = (schedulerState.roundIndex || 0) + 1;

return {
    round: schedulerState.roundIndex,
    resting: restingWithNumber,
    playing,
    games,
  };

  
}


function reorderFreePlayersByLastRound(
  freePlayersThisRound,
  lastRound,
  numCourts
) {
  if (numCourts <= 0 || freePlayersThisRound.length === 0) {
    return [...freePlayersThisRound];
  }

  const total = freePlayersThisRound.length;

  // per-court capacity
  const base = Math.floor(total / numCourts);
  const remainder = total % numCourts;

  // court capacities
  const capacities = Array.from(
    { length: numCourts },
    (_, i) => base + (i < remainder ? 1 : 0)
  );

  // split by last round
  const lastRoundSet = new Set(lastRound);
  const nonPlayed = [];
  const played = [];

  for (const p of freePlayersThisRound) {
    (lastRoundSet.has(p) ? played : nonPlayed).push(p);
  }

  // simulate court fill
  const courts = Array.from({ length: numCourts }, () => []);
  let c = 0;

  const distribute = (list) => {
    for (const p of list) {
      while (courts[c].length >= capacities[c]) {
        c = (c + 1) % numCourts;
      }
      courts[c].push(p);
      c = (c + 1) % numCourts;
    }
  };

  distribute(nonPlayed);
  distribute(played);

  // flatten to single ordered array
  return courts.flat();
}
// ==============================



function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function findDisjointPairs(playing, usedPairsSet, requiredPairsCount, opponentMap) {
  const allPairs = [];
  const unusedPairs = [];
  const usedPairs = [];

  // Build all pairs and classify (new vs old)
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      const a = playing[i], b = playing[j];
      const key = [a, b].slice().sort().join("&");
      const isNew = !usedPairsSet || !usedPairsSet.has(key);

      const pairObj = { a, b, key, isNew };
      allPairs.push(pairObj);

      if (isNew) unusedPairs.push(pairObj);
      else usedPairs.push(pairObj);
    }
  }

  // ------------------------------
  //  Opponent Freshness Score
  // ------------------------------
  function calculateOpponentFreshnessScore(currentPair, selectedPairs, opponentMap) {
    let totalScore = 0;
    const [a, b] = currentPair;

    for (const [x, y] of selectedPairs) {
      const pair1 = [x, y];
      const pair2 = [a, b];

      for (const bPlayer of pair2) {
        let newOpp = 0;
        for (const aPlayer of pair1) {
          // Your exact logic:
          if ((opponentMap.get(bPlayer)?.get(aPlayer) || 0) === 1) {
            newOpp += 1;
          }
        }
        // Your exact scoring:
        totalScore += (newOpp === 2) ? 2 : (newOpp === 1 ? 1 : 0);
      }
    }
    return totalScore;
  }

  // ------------------------------
  //  DFS Backtracking With Scoring
  // ------------------------------
function pickBestFromCandidates(candidates) {
  const usedPlayers = new Set();
  const selected = [];
  let best = null;
  const MAX_BRANCHES = 15000; // limit search
  let branches = 0;

  function dfs(startIndex, baseScore) {
    // stop explosion
    if (branches++ > MAX_BRANCHES) return;

    if (selected.length === requiredPairsCount) {
      if (!best || baseScore > best.score) {
        best = { score: baseScore, pairs: selected.slice() };
      }
      return;
    }

    // Remaining candidates insufficient → prune
    const remainingSlots = requiredPairsCount - selected.length;
    if (candidates.length - startIndex < remainingSlots) return;

    for (let i = startIndex; i < candidates.length; i++) {
      const { a, b, isNew } = candidates[i];
      if (usedPlayers.has(a) || usedPlayers.has(b)) continue;

      usedPlayers.add(a);
      usedPlayers.add(b);
      selected.push([a, b]);

      // opponent freshness score
      const oppScore = calculateOpponentFreshnessScore(
        [a, b],
        selected.slice(0, -1),
        opponentMap
      );

      // new-pair strong priority
      const newPairScore = isNew ? 100 : 0;

      dfs(i + 1, baseScore + newPairScore + oppScore);

      selected.pop();
      usedPlayers.delete(a);
      usedPlayers.delete(b);
    }
  }

  dfs(0, 0);
  return best ? best.pairs : null;
}

  // -----------------------------------
  // 1) Try unused (new) pairs only
  // -----------------------------------
  if (unusedPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(unusedPairs);
    if (best) return best;
  }

  // -----------------------------------
  // 2) Try unused + used
  // -----------------------------------
  const combined = [...unusedPairs, ...usedPairs];
  if (combined.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(combined);
    if (best) return best;
  }

  // -----------------------------------
  // 3) Try all pairs as last fallback
  // -----------------------------------
  if (allPairs.length >= requiredPairsCount) {
    const best = pickBestFromCandidates(allPairs);
    if (best) return best;
  }

  return [];
}




function getMatchupScores(allPairs, opponentMap) {
  const matchupScores = [];
  for (let i = 0; i < allPairs.length; i++) {
    for (let j = i + 1; j < allPairs.length; j++) {
      const [a1, a2] = allPairs[i];
      const [b1, b2] = allPairs[j];
      // --- Count past encounters for each of the 4 possible sub-matchups ---
      const ab11 = opponentMap.get(a1)?.get(b1) || 0;
      const ab12 = opponentMap.get(a1)?.get(b2) || 0;
      const ab21 = opponentMap.get(a2)?.get(b1) || 0;
      const ab22 = opponentMap.get(a2)?.get(b2) || 0;
      // --- Total previous encounters (lower = better) ---
      const totalScore = ab11 + ab12 + ab21 + ab22;
      // --- Freshness: number of unseen sub-matchups (4 = completely new) ---
      const freshness =
        (ab11 === 0 ? 1 : 0) +
        (ab12 === 0 ? 1 : 0) +
        (ab21 === 0 ? 1 : 0) +
        (ab22 === 0 ? 1 : 0);
      // --- Store individual player freshness for tie-breaker ---
      const opponentFreshness = {
        a1: (ab11 === 0 ? 1 : 0) + (ab12 === 0 ? 1 : 0),
        a2: (ab21 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
        b1: (ab11 === 0 ? 1 : 0) + (ab21 === 0 ? 1 : 0),
        b2: (ab12 === 0 ? 1 : 0) + (ab22 === 0 ? 1 : 0),
      };
      matchupScores.push({
        pair1: allPairs[i],
        pair2: allPairs[j],
        freshness,         // 0–4
        totalScore,        // numeric repetition penalty
        opponentFreshness, // for tie-breaking only
      });
    }
  }
  // --- Sort by freshness DESC, then totalScore ASC, then opponent freshness DESC ---
  matchupScores.sort((a, b) => {
    if (b.freshness !== a.freshness) return b.freshness - a.freshness;
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    // Tie-breaker: sum of all 4 individual opponent freshness values
    const aSum = a.opponentFreshness.a1 + a.opponentFreshness.a2 + a.opponentFreshness.b1 + a.opponentFreshness.b2;
    const bSum = b.opponentFreshness.a1 + b.opponentFreshness.a2 + b.opponentFreshness.b1 + b.opponentFreshness.b2;
    return bSum - aSum; // prefer higher sum of unseen opponents
  });
  return matchupScores;
}


/* =========================
 
DISPLAY & UI FUNCTIONS
 
========================= */
// Main round display

function clearPreviousRound() {
  const resultsDiv = document.getElementById('game-results');

  // Remove all child nodes (old rounds)
  while (resultsDiv.firstChild) {
    resultsDiv.removeChild(resultsDiv.firstChild);
  }

  // Remove any lingering selection highlights
  window.selectedPlayer = null;
  window.selectedTeam = null;
  document.querySelectorAll('.selected, .selected-team, .swapping').forEach(el => {
    el.classList.remove('selected', 'selected-team', 'swapping');
  });
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = "R";
}



// Show a round
function showRound(index) {
  clearPreviousRound();
  const resultsDiv = document.getElementById('game-results');
  resultsDiv.innerHTML = '';

  const data = allRounds[index];
  if (!data) return;

  // ✅ Update round title
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = translations[currentLang].roundno + " " + data.round;

  // ✅ Create sections safely
  let restDiv = null;
  if (data.resting && data.resting.length !== 0) {
    restDiv = renderRestingPlayers(data, index);
  }

  const gamesDiv = renderGames(data, index);

  // ✅ Wrap everything
  const wrapper = document.createElement('div');
  wrapper.className = 'round-wrapper';

  // 🔒 Apply lock state globally
  if (interactionLocked) {
    wrapper.classList.add('locked');
  }

  // ✅ Append conditionally
  if (restDiv) {
    wrapper.append(gamesDiv, restDiv);
  } else {
    wrapper.append(gamesDiv);
  }

  resultsDiv.append(wrapper);
}


function goodshowRound(index) {
  clearPreviousRound();
  const resultsDiv = document.getElementById('game-results');
  resultsDiv.innerHTML = '';
  const data = allRounds[index];
  if (!data) return;
  // ✅ Update round title
  const roundTitle = document.getElementById("roundTitle");
  roundTitle.className = "roundTitle";
  roundTitle.innerText = translations[currentLang].roundno + " " + data.round;
  // ✅ Create sections safely
  let restDiv = null;
  if (data.resting && data.resting.length !== 0) {
    restDiv = renderRestingPlayers(data, index);
  }
  const gamesDiv = renderGames(data, index);
  // ✅ Wrap everything in a container to distinguish latest vs played
  const wrapper = document.createElement('div');
  const isLatest = index === allRounds.length - 1;
  wrapper.className = isLatest ? 'latest-round' : 'played-round';
  // ✅ Append conditionally
  if (restDiv) {
    wrapper.append(gamesDiv,restDiv);
  } else {
    wrapper.append(gamesDiv);
  }
  resultsDiv.append(wrapper);
  // ✅ Navigation buttons
  //document.getElementById('prevBtn').disabled = index === 0;
  //document.getElementById('nextBtn').disabled = false;
}


// Resting players display
function t(key) {
  return translations[currentLang]?.[key] || key;
}


function chkrenderRestingPlayers(data, index) {
  const restDiv = document.createElement('div');
  restDiv.className = 'round-header';
  restDiv.style.paddingLeft = "12px";

  const title = document.createElement('div');
  title.dataset.i18n = 'sittingOut';
  title.textContent = t('sittingOut');
  restDiv.appendChild(title);

  const restBox = document.createElement('div');
  restBox.className = 'rest-box';

  if (!data.resting || data.resting.length === 0) {
    const span = document.createElement('span');
    span.dataset.i18n = 'none';
    span.textContent = t('none');
    restBox.appendChild(span);
  } else {
    data.resting.forEach(restName => {
      const baseName = restName.split('#')[0];

      const playerObj = schedulerState.allPlayers.find(
        p => p.name === baseName
      );

      if (playerObj) {
        restBox.appendChild(
          makeRestButton(
            { ...playerObj, displayName: restName },
            data,
            index
          )
        );
      }
    });
  }

  restDiv.appendChild(restBox);
  return restDiv;
}

function renderGames(data, roundIndex) {

  const wrapper = document.createElement('div');
  const playmode = getPlayMode();

  // ⭐ Build previous history
  const previousPairSet = new Set();
  const previousGameSet = new Set();

  for (let i = 0; i < roundIndex; i++) {
    const prev = allRounds[i];
    if (!prev?.games) continue;

    prev.games.forEach(g => {
      if (!g?.pair1 || !g?.pair2) return;

      const pair1Key = getPairKey(g.pair1[0], g.pair1[1]);
      const pair2Key = getPairKey(g.pair2[0], g.pair2[1]);

      previousPairSet.add(pair1Key);
      previousPairSet.add(pair2Key);

      // ✅ FIXED — store game as pair-vs-pair (NOT 4 flattened players)
      const gameKey = [pair1Key, pair2Key].sort().join("|");
      previousGameSet.add(gameKey);
    });
  }

  data.games.forEach((game, gameIndex) => {

    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard';

    const courtName = document.createElement('div');
    courtName.classList.add('courtname');
    courtName.textContent = `Court ${gameIndex + 1}`;

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    const makeTeamDiv = (teamSide) => {

      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;

      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;

      // ⭐ Pair repetition detection
      if (teamPairs) {
        const pairKey = getPairKey(teamPairs[0], teamPairs[1]);
        if (previousPairSet.has(pairKey)) {
          teamDiv.classList.add('repeated-pair');
        }
      }

      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);

      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(
          makePlayerButton(p, teamSide, gameIndex, i, data, roundIndex)
        );
      });

      const winCup = document.createElement('img');
      winCup.src = 'win-cup.png';
      winCup.className = 'win-cup blinking';
      winCup.title = 'Mark winner';
      winCup.style.visibility = 'hidden';
      winCup.style.pointerEvents = 'none';

      if (game.winner === teamSide) {
        winCup.classList.add('active');
        winCup.classList.remove('blinking');
      }

      const toggleWinner = (e) => {
        if (currentState === "idle") return;
        e.stopPropagation();
        e.preventDefault();

        const allCups = teamDiv.parentElement.querySelectorAll('.win-cup');
        const allSwapIcons = teamDiv.parentElement.querySelectorAll('.swap-icon');
        const isActive = winCup.classList.contains('active');

        if (!isActive) {
          allCups.forEach(cup => {
            cup.classList.remove('active', 'blinking');
            cup.style.visibility = 'hidden';
            cup.style.pointerEvents = 'none';
          });

          winCup.classList.add('active');
          winCup.classList.remove('blinking');
          winCup.style.visibility = 'visible';
          winCup.style.pointerEvents = 'auto';

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'hidden';
            icon.style.pointerEvents = 'none';
          });

          game.winner = teamSide;
          game.winners = teamPairs.slice();
        } else {
          allCups.forEach(cup => {
            cup.classList.remove('active');
            cup.classList.add('blinking');
            cup.style.visibility = 'visible';
            cup.style.pointerEvents = 'auto';
          });

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'visible';
            icon.style.pointerEvents = 'auto';
          });

          game.winner = undefined;
          game.winners = [];
        }
      };

      winCup.addEventListener('click', toggleWinner);
      teamDiv.addEventListener('click', toggleWinner);

      teamDiv.appendChild(winCup);

      const isLatestRound = roundIndex === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (game.winner) return;

          if (window.selectedTeam) {
            const src = window.selectedTeam;
            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(
                src,
                { teamSide, gameIndex },
                data,
                roundIndex
              );
            }
            window.selectedTeam = null;
            document.querySelectorAll('.selected-team')
              .forEach(b => b.classList.remove('selected-team'));
          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }

      return teamDiv;
    };

    const teamLeft = makeTeamDiv('L');
    const teamRight = makeTeamDiv('R');

    // ⭐ FIXED — Exact game repetition detection
    if (game?.pair1 && game?.pair2) {

      const pair1Key = getPairKey(game.pair1[0], game.pair1[1]);
      const pair2Key = getPairKey(game.pair2[0], game.pair2[1]);

      const currentGameKey = [pair1Key, pair2Key].sort().join("|");

      if (previousGameSet.has(currentGameKey)) {
        courtDiv.classList.add('repeated-game');
      }
    }

    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = '  ';

    teamsDiv.append(teamLeft, vs, teamRight);
    courtDiv.append(courtName, teamsDiv);
    wrapper.appendChild(courtDiv);
  });

  return wrapper;
}
function goodrenderGames(data, roundIndex) {
  const wrapper = document.createElement('div');
  const playmode = getPlayMode();

  data.games.forEach((game, gameIndex) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard';

    const courtName = document.createElement('div');
    courtName.classList.add('courtname');
    courtName.textContent = `Court ${gameIndex + 1}`;

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;

      // 🔁 Swap icon
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);

      // 👥 Players
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(
          makePlayerButton(p, teamSide, gameIndex, i, data, roundIndex)
        );
      });

      // 🏆 Win cup (created hidden)
      const winCup = document.createElement('img');
      winCup.src = 'win-cup.png';
      winCup.className = 'win-cup blinking';
      winCup.title = 'Mark winner';
      winCup.style.visibility = 'hidden';
      winCup.style.pointerEvents = 'none';

      // Restore winner state
      if (game.winner === teamSide) {
        winCup.classList.add('active');
        winCup.classList.remove('blinking');
      }

      // 🏆 Winner toggle logic (minimal, correct)
      const toggleWinner = (e) => {
        if (currentState === "idle") return;
        e.stopPropagation();
        e.preventDefault();

        const allCups = teamDiv.parentElement.querySelectorAll('.win-cup');
        const allSwapIcons = teamDiv.parentElement.querySelectorAll('.swap-icon');
        const isActive = winCup.classList.contains('active');

        if (!isActive) {
          // 👉 Mark this team
          allCups.forEach(cup => {
            cup.classList.remove('active', 'blinking');
            cup.style.visibility = 'hidden';
            cup.style.pointerEvents = 'none';
          });
          
          winCup.classList.add('active');
          winCup.classList.remove('blinking');
          winCup.style.visibility = 'visible';
          winCup.style.pointerEvents = 'auto';

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'hidden';
            icon.style.pointerEvents = 'none';
          });

          game.winner = teamSide;
          game.winners = teamPairs.slice();
        } else {
          // 👉 Unmark → show BOTH cups again
          allCups.forEach(cup => {
            cup.classList.remove('active');
            cup.classList.add('blinking');
            cup.style.visibility = 'visible';
            cup.style.pointerEvents = 'auto';
          });

          allSwapIcons.forEach(icon => {
            icon.style.visibility = 'visible';
            icon.style.pointerEvents = 'auto';
          });

          game.winner = undefined;
          game.winners = [];
        }
      };

      // Attach to BOTH team and cup
      winCup.addEventListener('click', toggleWinner);
      teamDiv.addEventListener('click', toggleWinner);

      teamDiv.appendChild(winCup);

      // 🔁 Swap logic (unchanged)
      const isLatestRound = roundIndex === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (game.winner) return; // Busy → no swap

          if (window.selectedTeam) {
            const src = window.selectedTeam;
            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(
                src,
                { teamSide, gameIndex },
                data,
                roundIndex
              );
            }
            window.selectedTeam = null;
            document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }

      return teamDiv;
    };

    const teamLeft = makeTeamDiv('L');
    const teamRight = makeTeamDiv('R');

    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = '  ';

    teamsDiv.append(teamLeft, vs, teamRight);
    courtDiv.append(courtName, teamsDiv);
    wrapper.appendChild(courtDiv);
  });

  return wrapper;
}


function renderGames2(data, index) {
  const wrapper = document.createElement('div');
  const playmode = getPlayMode(); // "competitive" or "random"

  data.games.forEach((game, gameIndex) => {
    const courtDiv = document.createElement('div');
    courtDiv.className = 'courtcard';

    const courtName = document.createElement('div');
    courtName.classList.add('courtname');
    courtName.textContent = `Court ${gameIndex + 1}`;

    const teamsDiv = document.createElement('div');
    teamsDiv.className = 'teams';

    const makeTeamDiv = (teamSide) => {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamSide = teamSide;
      teamDiv.dataset.gameIndex = gameIndex;

      // 🔁 Swap icon
      const swapIcon = document.createElement('div');
      swapIcon.className = 'swap-icon';
      swapIcon.innerHTML = '🔁';
      teamDiv.appendChild(swapIcon);

      // 👥 Players
      const teamPairs = teamSide === 'L' ? game.pair1 : game.pair2;
      teamPairs.forEach((p, i) => {
        teamDiv.appendChild(
          makePlayerButton(p, teamSide, gameIndex, i, data, index)
        );
      });

      // 🏆 Win cup
      const winCup = document.createElement('img');
      winCup.src = 'win-cup.png';
      winCup.className = 'win-cup blinking';
      winCup.title = 'Mark winner';

      // Start hidden
      winCup.style.visibility = 'hidden';
      winCup.style.pointerEvents = 'none';

      // Restore state
      if (game.winner === teamSide) {
        winCup.classList.add('active');
        winCup.classList.remove('blinking');
        winCup.style.visibility = 'visible';
        winCup.style.pointerEvents = 'auto';
      }

      // 🏆 Win-cup logic (competitive mode only)
      if (playmode === 'competitive') {
        winCup.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          const allCups = teamDiv.parentElement.querySelectorAll('.win-cup');
          const allSwapIcons = teamDiv.parentElement.querySelectorAll('.swap-icon');
          const isActive = winCup.classList.contains('active');

          if (!isActive) {
            // ---- ACTIVATE THIS TEAM ----
            allCups.forEach(cup => {
              cup.classList.remove('active', 'blinking');
              cup.style.visibility = 'hidden';
              cup.style.pointerEvents = 'none';
            });

            winCup.classList.add('active');
            winCup.style.visibility = 'visible';
            winCup.style.pointerEvents = 'auto';

            // Disable swaps while busy
            allSwapIcons.forEach(icon => {
              icon.style.visibility = 'hidden';
              icon.style.pointerEvents = 'none';
            });

            game.winner = teamSide;
            game.winners = teamPairs.slice();
          } else {
            // ---- RESET TO IDLE ----
            allCups.forEach(cup => {
              cup.classList.remove('active');
              cup.classList.add('blinking');
              cup.style.visibility = 'hidden';
              cup.style.pointerEvents = 'none';
            });

            // Re-enable swaps
            allSwapIcons.forEach(icon => {
              icon.style.visibility = 'visible';
              icon.style.pointerEvents = 'auto';
            });

            game.winner = undefined;
            game.winners = [];
          }
        });
      }

      teamDiv.appendChild(winCup);

      // 🔁 Swap logic (EXACTLY like renderGamesold)
      const isLatestRound = index === allRounds.length - 1;
      if (isLatestRound) {
        swapIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (game.winner) return; // Busy → no swap

          if (window.selectedTeam) {
            const src = window.selectedTeam;

            if (src.gameIndex !== gameIndex) {
              handleTeamSwapAcrossCourts(
                src,
                { teamSide, gameIndex },
                data,
                index
              );
            }

            window.selectedTeam = null;
            document
              .querySelectorAll('.selected-team')
              .forEach(b => b.classList.remove('selected-team'));

          } else {
            window.selectedTeam = { teamSide, gameIndex };
            teamDiv.classList.add('selected-team');
          }
        });
      }

      return teamDiv;
    };

    const teamLeft = makeTeamDiv('L');
    const teamRight = makeTeamDiv('R');

    const vs = document.createElement('span');
    vs.className = 'vs';
    vs.innerText = '  ';

    teamsDiv.append(teamLeft, vs, teamRight);
    courtDiv.append(courtName, teamsDiv);
    wrapper.appendChild(courtDiv);

    // Restore visibility if winner exists
    if (playmode === 'competitive' && game.winner) {
      teamsDiv.querySelectorAll('.win-cup').forEach(cup => {
        if (!cup.classList.contains('active')) {
          cup.style.visibility = 'hidden';
          cup.style.pointerEvents = 'none';
        }
      });
      teamsDiv.querySelectorAll('.swap-icon').forEach(icon => {
        icon.style.visibility = 'hidden';
        icon.style.pointerEvents = 'none';
      });
    }
  });

  return wrapper;
}





function updateWinCupVisibility() {
  const playmode = getPlayMode();
  document.querySelectorAll('.win-cup').forEach(cup => {
    cup.style.display = playmode === "competitive" ? "" : "none";
  });
}


function renderRestingPlayers(data, index) {
  const restDiv = document.createElement('div');
  restDiv.className = 'round-header';
  restDiv.style.paddingLeft = "12px";

  //const title = document.createElement('div');
  //title.setAttribute("data-i18n", "sittingOut");
  //restDiv.appendChild(title);
  const title = document.createElement('div');
title.dataset.i18n = 'sittingOut';
title.textContent = t('sittingOut');
restDiv.appendChild(title);
  const restBox = document.createElement('div');
  restBox.className = 'rest-box';

  if (!data.resting || data.resting.length === 0) {
    const span = document.createElement('span');
    span.innerText = 'None';
    restBox.appendChild(span);
  } else {
    data.resting.forEach(restName => {
      // 🔑 Extract real player name (before #)
      const baseName = restName.split('#')[0];

      const playerObj = schedulerState.allPlayers.find(
        p => p.name === baseName
      );

      if (playerObj) {
        restBox.appendChild(
          makeRestButton(
            { ...playerObj, displayName: restName }, // keep #count
            data,
            index
          )
        );
      }
    });
  }

  restDiv.appendChild(restBox);
  return restDiv;
}




function getGenderByName(playerName) {
  const p = schedulerState.allPlayers.find(pl => pl.name === playerName);
  return p ? p.gender : null; // "Male" | "Female"
}

function getTeamTypeFromPairs(playerNames) {
  let hasMale = false;
  let hasFemale = false;

  for (const name of playerNames) {
    const gender = getGenderByName(name);

    if (gender === "Male") hasMale = true;
    if (gender === "Female") hasFemale = true;
  }

  if (hasMale && hasFemale) return "mixed";
  if (hasMale) return "men";
  if (hasFemale) return "women";

  return "unknown";
}


function makeRestButton(player, data, index) {
  const btn = document.createElement('button');
  btn.className = 'rest-btn';

  // ───────── GENDER ICON (IMAGE-BASED) ─────────
  if (IS_MIXED_SESSION && player?.gender) {
    const genderIcon = document.createElement('img');
    genderIcon.className = 'gender-icon';

    genderIcon.src =
      player.gender === 'Female'
        ? 'female.png'
        : 'male.png';

    genderIcon.alt = player.gender;
    btn.appendChild(genderIcon);
  }

  // ───────── LABEL ─────────
  const label = player.displayName || player.name;
  const textNode = document.createElement('span');
  textNode.innerText = label;
  btn.appendChild(textNode);

  /* ───────── COLOR LOGIC ───────── */

  const restMatch = label.match(/#(\d+)/);
  const restCount = restMatch ? parseInt(restMatch[1], 10) : 0;

  if (IS_MIXED_SESSION && player?.gender) {
    // Gender-based hue + rest-based lightness
    const hue = player.gender === "Male" ? 200 : 330;
    const lightness = Math.min(90, 65 + restCount * 5);

    btn.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;
    btn.style.color = "#000";
  } else {
    // Original rest-count coloring
    if (restMatch) {
      const hue = (restCount * 40) % 360;
      btn.style.backgroundColor = `hsl(${hue}, 60%, 85%)`;
    } else {
      btn.style.backgroundColor = '#eee';
    }
    btn.style.color = "#000";
  }

  /* ─────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'team') {
        handleDropRestToTeam(
          e,
          src.teamSide,
          src.gameIndex,
          src.playerIndex,
          data,
          index,
          label
        );
      }
      window.selectedPlayer = null;
      document
        .querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = { playerName: label, from: 'rest' };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}

function makePlayerButton(name, teamSide, gameIndex, playerIndex, data, index) {
  const btn = document.createElement('button');

  // Get player object
  const baseName = name.split('#')[0];
  const player = schedulerState.allPlayers.find(p => p.name === baseName);

  btn.className = teamSide === 'L'
    ? 'Lplayer-btn'
    : 'Rplayer-btn';

  /* ───────── GENDER EMOJI (LEFT) ───────── */
  if (IS_MIXED_SESSION && player?.gender) {
  const genderIcon = document.createElement('img');
  genderIcon.className = 'gender-icon';

  genderIcon.src =
  player.gender === 'Female'
    ? 'female.png'
    : 'male.png';

  genderIcon.alt = player.gender;
  btn.prepend(genderIcon);
}

  /* ───────── PLAYER NAME (TRUNCATED) ───────── */
  const nameSpan = document.createElement('span');
  nameSpan.className = 'player-name';
  nameSpan.textContent = name;
  nameSpan.title = name; // full name on long-press / hover

  btn.appendChild(nameSpan);

  /* ───────────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;

      if (src.from === 'rest') {
        handleDropRestToTeam(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src.playerName
        );
      } else {
        handleDropBetweenTeams(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src
        );
      }

      window.selectedPlayer = null;
      document
        .querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = {
        playerName: name,
        teamSide,
        gameIndex,
        playerIndex,
        from: 'team'
      };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}


function xxxmakePlayerButton(name, teamSide, gameIndex, playerIndex, data, index) {
  const btn = document.createElement('button');

  // Determine if gender icons should be shown
  const showGender = IS_MIXED_SESSION;

  // Get player object
  const baseName = name.split('#')[0];
  const player = schedulerState.allPlayers.find(p => p.name === baseName);
  
  btn.textContent = name;
  btn.className = teamSide === 'L' ? 'Lplayer-btn' : 'Rplayer-btn';
  

  /* ───────── COLOR OVERRIDE ───────── */
if (IS_MIXED_SESSION && player?.gender) {
  const genderBtn = document.createElement('span');
  genderBtn.className =
    'gender-btn ' +
    (player.gender === 'Female' ? 'female' : 'male');

  genderBtn.textContent =
   //player.gender === 'Female' ? '👩' : '👨';
   player.gender === 'Female' ? "🙎‍♀️" : "👨‍💼" ;
    
  btn.prepend(genderBtn);
}

  /* ───────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;

      if (src.from === 'rest') {
        handleDropRestToTeam(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src.playerName
        );
      } else {
        handleDropBetweenTeams(
          e,
          teamSide,
          gameIndex,
          playerIndex,
          data,
          index,
          src
        );
      }

      window.selectedPlayer = null;
      document.querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = {
        playerName: name,
        teamSide,
        gameIndex,
        playerIndex,
        from: 'team'
      };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}




function xxxmakeRestButton(player, data, index) {
  const btn = document.createElement('button');

  let genderIcon = "";
  if (IS_MIXED_SESSION) {
    genderIcon =
      player.gender === "Male" ? "👨‍💼 " :
      player.gender === "Female" ?"🙎‍♀️ "  :
      "";
  }

  const label = player.displayName || player.name;
  btn.innerText = `${genderIcon}${label}`;
  btn.className = 'rest-btn';

  /* ───────── COLOR LOGIC ───────── */

  const restMatch = label.match(/#(\d+)/);
  const restCount = restMatch ? parseInt(restMatch[1], 10) : 0;

  if (IS_MIXED_SESSION && genderIcon) {
    // 🎨 Gender base hue + rest-based lightness
    const hue = player.gender === "Male" ? 200 : 330;
    const lightness = Math.min(90, 65 + restCount * 5); // lighter with rest

    btn.style.backgroundColor = `hsl(${hue}, 70%, ${lightness}%)`;
    btn.style.color = "#000";
  } else {
    // ♻️ Original rest-count rainbow
    if (restMatch) {
      const hue = (restCount * 40) % 360;
      btn.style.backgroundColor = `hsl(${hue}, 60%, 85%)`;
    } else {
      btn.style.backgroundColor = '#eee';
    }
    btn.style.color = "#000";
  }

  /* ─────────────────────────────── */

  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;

  const handleTap = (e) => {
    e.preventDefault();

    if (window.selectedPlayer) {
      const src = window.selectedPlayer;
      if (src.from === 'team') {
        handleDropRestToTeam(
          e,
          src.teamSide,
          src.gameIndex,
          src.playerIndex,
          data,
          index,
          label
        );
      }
      window.selectedPlayer = null;
      document.querySelectorAll('.selected')
        .forEach(b => b.classList.remove('selected'));
    } else {
      window.selectedPlayer = { playerName: label, from: 'rest' };
      btn.classList.add('selected');
    }
  };

  btn.addEventListener('click', handleTap);
  btn.addEventListener('touchstart', handleTap);

  return btn;
}


function makeTeamButton(label, teamSide, gameIndex, data, index) {
  const btn = document.createElement('button');
  btn.className = 'team-btn';
  btn.innerText = label; // Visible label stays simple (Team L / Team R)
  // Store internal unique info in dataset
  btn.dataset.gameIndex = gameIndex;
  btn.dataset.teamSide = teamSide;
  const isLatestRound = index === allRounds.length - 1;
  if (!isLatestRound) return btn;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.selectedTeam) {
      const src = window.selectedTeam;
      if (src.gameIndex !== gameIndex) {
        handleTeamSwapAcrossCourts(src, { teamSide, gameIndex }, data, index);
      }
      window.selectedTeam = null;
      document.querySelectorAll('.selected-team').forEach(b => b.classList.remove('selected-team'));
    } else {
      // Store internal info for selection
      window.selectedTeam = { teamSide, gameIndex };
      btn.classList.add('selected-team');
    }
  });
  return btn;
}

function handleDropRestToTeam(
  e, teamSide, gameIndex, playerIndex, data, roundIndex, movingPlayer = null
) {
  const drop = !movingPlayer && e.dataTransfer
    ? JSON.parse(e.dataTransfer.getData('text/plain'))
    : { type: 'rest', player: movingPlayer };

  if (drop.type !== 'rest' || !drop.player) return;

  const teamKey = teamSide === 'L' ? 'pair1' : 'pair2';

  const newPlayer = drop.player.replace(/#\d+$/, '');
  const oldPlayer = data.games[gameIndex][teamKey][playerIndex];

  // Remove the new player from data.resting
  data.resting = data.resting.filter(p => !p.startsWith(newPlayer));

  // Insert new player into team
  data.games[gameIndex][teamKey][playerIndex] = newPlayer;

  // ---------------------------------------------
  // 🔥 schedulerState.restCount is READ-ONLY
  // ---------------------------------------------
  const { restCount } = schedulerState;

  if (oldPlayer && oldPlayer !== '(Empty)') {

    // Read only value
    const stored = restCount.get(oldPlayer) || 0;

    // UI number = scheduler stored + 1
    const nextNum = stored + 1;

    // Add to data.resting
    data.resting.push(`${oldPlayer}#${nextNum}`);
  }

  showRound(roundIndex);
}

function handleDropBetweenTeams(e, teamSide, gameIndex, playerIndex, data, index, src) {
  // src contains info about the player you selected first
  const { teamSide: fromTeamSide, gameIndex: fromGameIndex, playerIndex: fromPlayerIndex, playerName: player } = src;
  if (!player || player === '(Empty)') return;
  const fromTeamKey = fromTeamSide === 'L' ? 'pair1' : 'pair2';
  const toTeamKey = teamSide === 'L' ? 'pair1' : 'pair2';
  const fromTeam = data.games[fromGameIndex][fromTeamKey];
  const toTeam = data.games[gameIndex][toTeamKey];
  // No need to strip #index anymore
  const movedPlayer = player;
  const targetPlayer = toTeam[playerIndex];
  // ✅ Swap players
  toTeam[playerIndex] = movedPlayer;
  fromTeam[fromPlayerIndex] = targetPlayer && targetPlayer !== '(Empty)' ? targetPlayer : '(Empty)';
  showRound(index);
}

// Add a global flag to prevent concurrent swaps
let swapInProgress = false;
const swapQueue = [];

function handleTeamSwapAcrossCourts(src, target, data, index) {
  if (!src || !target) return;
  if (src.gameIndex === target.gameIndex && src.teamSide === target.teamSide) return;

  // Queue the swap if another is in progress
  if (swapInProgress) {
    swapQueue.push({ src, target, data, index });
    return;
  }

  swapInProgress = true;

  const srcKey = src.teamSide === 'L' ? 'pair1' : 'pair2';
  const targetKey = target.teamSide === 'L' ? 'pair1' : 'pair2';

  // Fetch teams immediately before swapping
  const srcTeam = data.games[src.gameIndex][srcKey];
  const targetTeam = data.games[target.gameIndex][targetKey];

  // Animation highlight
  const srcDiv = document.querySelector(`.team[data-game-index="${src.gameIndex}"][data-team-side="${src.teamSide}"]`);
  const targetDiv = document.querySelector(`.team[data-game-index="${target.gameIndex}"][data-team-side="${target.teamSide}"]`);
  [srcDiv, targetDiv].forEach(div => {
    div.classList.add('swapping');
    setTimeout(() => div.classList.remove('swapping'), 600);
  });

  setTimeout(() => {
    // Swap teams safely using temporary variable
    const temp = data.games[src.gameIndex][srcKey];
    data.games[src.gameIndex][srcKey] = data.games[target.gameIndex][targetKey];
    data.games[target.gameIndex][targetKey] = temp;

    // Refresh the round
    showRound(index);

    swapInProgress = false;

    // Process next swap in queue if any
    if (swapQueue.length > 0) {
      const nextSwap = swapQueue.shift();
      handleTeamSwapAcrossCourts(nextSwap.src, nextSwap.target, nextSwap.data, nextSwap.index);
    }
  }, 300);
}


/* =========================
 
MOBILE BEHAVIOR
 
========================= */
function enableTouchDrag(el) {
  let offsetX = 0, offsetY = 0;
  let clone = null;
  let isDragging = false;
  const startDrag = (x, y) => {
    const rect = el.getBoundingClientRect();
    offsetX = x - rect.left;
    offsetY = y - rect.top;
    clone = el.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.opacity = '0.7';
    clone.style.zIndex = 9999;
    clone.classList.add('dragging');
    document.body.appendChild(clone);
    isDragging = true;
  };
  const moveDrag = (x, y) => {
    if (!clone) return;
    clone.style.left = `${x - offsetX}px`;
    clone.style.top = `${y - offsetY}px`;
  };
  const endDrag = () => {
    if (clone) {
      clone.remove();
      clone = null;
    }
    isDragging = false;
  };
  // --- Touch Events ---
  el.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
    e.preventDefault();
  });
  el.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  });
  el.addEventListener('touchend', endDrag);
  // --- Mouse Events ---
  el.addEventListener('mousedown', e => {
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) moveDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', endDrag);
}


let interactionLocked = true;

// Apply initial state
document.body.classList.add('locked');

const lockBtn = document.getElementById('lockToggleBtn');

lockBtn.addEventListener('click', () => {
  interactionLocked = !interactionLocked;

  // Toggle body class
  document.body.classList.toggle('locked', interactionLocked);

  // Update icon text
  //lockBtn.textContent = interactionLocked ? '🔒' : '🔓';
});









function getPlayMode() {
  return document.getElementById("modeToggle").checked
    ? "competitive"
    : "random";
}

const modeToggle = document.getElementById("modeToggle");
const modeLabel  = document.getElementById("modeLabel");

// Restore saved mode
modeToggle.checked = localStorage.getItem("playMode") === "competitive";
updateModeLabel();
toggleMinRoundsVisibility(); // ← restore on load

modeToggle.addEventListener("change", () => {
  localStorage.setItem("playMode", getPlayMode());
  updateModeLabel();
  toggleMinRoundsVisibility();
});

// Min Rounds value
let minRoundsValue = parseInt(localStorage.getItem('minRounds')) || 6;
document.getElementById('minRoundsDisplay').textContent = minRoundsValue;

document.getElementById('minRoundsPlus').addEventListener('click', () => {
  minRoundsValue = Math.min(20, minRoundsValue + 1);
  document.getElementById('minRoundsDisplay').textContent = minRoundsValue;
  localStorage.setItem('minRounds', minRoundsValue);
  schedulerState.minRounds = minRoundsValue;
});

document.getElementById('minRoundsMinus').addEventListener('click', () => {
  minRoundsValue = Math.max(1, minRoundsValue - 1);
  document.getElementById('minRoundsDisplay').textContent = minRoundsValue;
  localStorage.setItem('minRounds', minRoundsValue);
  schedulerState.minRounds = minRoundsValue;
});

function toggleRoundSettings() {
  const body    = document.getElementById('roundSettingsBody');
  const chevron = document.getElementById('roundSettingsChevron');
  const isOpen  = body.classList.toggle('open');
  chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleMinRoundsVisibility() {
  const isCompetitive = getPlayMode() === 'competitive';
  document.getElementById('minRoundsRow').style.display = isCompetitive ? 'flex' : 'none';
}

function updateModeLabel() {
  modeLabel.textContent =
    getPlayMode() === "competitive"
      ? "🏆"
      : "🎲";
}

/* ============================================================
   COMPETITIVE ALGORITHM — Tier calculation, point tracking, match fairness
   File: competitive_algorithm.js
   ============================================================ */

// ============================================================
//  COMPETITIVE ROUND ALGORITHM
//  Full implementation based on discussion
// ============================================================

// ============================================================
//  SECTION 1 — POINTS & STREAK HELPERS
// ============================================================

/**
 * Rebuild points and streaks fresh from allRounds every time.
 * Reads game.winner ("L" or "R") and game.pair1 / game.pair2
 * to determine who won and who lost.
 *
 * Returns:
 *   rankPoints  : Map<playerName, number>   (starts at 100)
 *   streakMap   : Map<playerName, number>   (+ = win streak, - = loss streak)
 */
function buildPointsAndStreaks(allRounds, activeplayers) {

  // Initialise every active player at 100 / streak 0
  const rankPoints = new Map();
  const streakMap  = new Map();

  for (const p of activeplayers) {
    rankPoints.set(p, 100);
    streakMap.set(p, 0);
  }

  // Replay every completed round in order
  for (const round of allRounds) {
    if (!round?.games) continue;

    for (const game of round.games) {

      // Skip unfinished games
      if (!game.winner || !game.pair1 || !game.pair2) continue;

      const winners = game.winner === 'L' ? game.pair1 : game.pair2;
      const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

      for (const p of winners) {
        applyResult(p, true,  rankPoints, streakMap);
      }

      for (const p of losers) {
        applyResult(p, false, rankPoints, streakMap);
      }
    }
  }

  return { rankPoints, streakMap };
}

/**
 * Apply one win or loss to a single player.
 *
 * Points rules (confirmed):
 *   Win                  → +2
 *   Consecutive win      → +1 bonus (flat, not increasing)
 *   Loss                 → -2
 *   Consecutive loss     → -1 penalty (flat, not increasing)
 *   Any loss resets win streak, any win resets loss streak.
 */
function applyResult(player, isWin, rankPoints, streakMap) {

  const currentStreak = streakMap.get(player) || 0;
  let delta = 0;

  if (isWin) {
    delta = 2;
    if (currentStreak > 0) delta += 1;          // consecutive win bonus
    streakMap.set(player, Math.max(currentStreak, 0) + 1);
  } else {
    delta = -2;
    if (currentStreak < 0) delta -= 1;          // consecutive loss penalty
    streakMap.set(player, Math.min(currentStreak, 0) - 1);
  }

  rankPoints.set(player, (rankPoints.get(player) || 100) + delta);
}


// ============================================================
//  SECTION 2 — TIER HELPERS
// ============================================================

/**
 * Split active players into Strong / Inter / Weak
 * using top / middle / bottom 33% of current rankPoints.
 *
 * Returns Map<playerName, "strong"|"inter"|"weak">
 */
function calculateTiers(activeplayers, rankPoints) {

  // Sort descending by points
  const sorted = [...activeplayers].sort(
    (a, b) => (rankPoints.get(b) || 100) - (rankPoints.get(a) || 100)
  );

  const total     = sorted.length;
  const topCut    = Math.ceil(total / 3);
  const bottomCut = Math.floor((total * 2) / 3);

  const tierMap = new Map();

  sorted.forEach((p, i) => {
    if (i < topCut)          tierMap.set(p, 'strong');
    else if (i < bottomCut)  tierMap.set(p, 'inter');
    else                     tierMap.set(p, 'weak');
  });

  return tierMap;
}

/**
 * Return tier string for one player.
 */
function getPlayerTier(player, tierMap) {
  return tierMap.get(player) || 'inter';
}


// ============================================================
//  SECTION 3 — TIER RULE CHECKER
// ============================================================

/**
 * Given two pairs and the tierMap, return which rule the
 * matchup satisfies:
 *
 *   Rule 1 — all 4 same tier          (best)
 *   Rule 2 — both pairs identical mix  (S+I vs S+I etc.)
 *   Rule 3 — S+W vs I+I               (compensated)
 *   Rule 0 — none of the above        (fallback)
 */
function getGameTierRule(pair1, pair2, tierMap) {

  const [t1a, t1b] = pair1.map(p => getPlayerTier(p, tierMap));
  const [t2a, t2b] = pair2.map(p => getPlayerTier(p, tierMap));

  const sig1 = [t1a, t1b].sort().join('+');
  const sig2 = [t2a, t2b].sort().join('+');

  // Rule 1 — all same tier
  const rule1Sigs = ['strong+strong', 'inter+inter', 'weak+weak'];
  if (rule1Sigs.includes(sig1) && sig1 === sig2) return 1;

  // Rule 2 — identical mixed composition both sides
  const rule2Sigs = ['inter+strong', 'strong+weak', 'inter+weak'];
  if (rule2Sigs.includes(sig1) && sig1 === sig2) return 2;

  // Rule 3 — S+W vs I+I  (either way around)
  const isSwPair   = s => s === 'strong+weak' || s === 'weak+strong';
  const isIIPair   = s => s === 'inter+inter';
  if ((isSwPair(sig1) && isIIPair(sig2)) ||
      (isIIPair(sig1) && isSwPair(sig2))) return 3;

  return 0;
}


// ============================================================
//  SECTION 4 — BEST COURT COMBINATION (global across courts)
// ============================================================

/**
 * Given a pool of players and the number of courts,
 * find the globally best assignment of players to courts
 * maximising the sum of tier-rule scores across all courts.
 *
 * Scoring per court:
 *   Rule 1 → 3 pts
 *   Rule 2 → 2 pts
 *   Rule 3 → 1 pt
 *   Random → 0 pts
 *
 * For each court we also respect:
 *   - pairPlayedSet  (prefer new partnerships)
 *   - opponentMap    (prefer fresh opponents)
 *   - isGameRepeated (if repeated → force random for that court)
 *
 * Returns array of games:
 *   [{ pair1, pair2, courtRule }]
 */
function findBestCourtCombination(playing, numCourts, tierMap, state) {

  const { pairPlayedSet, opponentMap } = state;

  // Generate all possible pairs from playing pool
  const allPossiblePairs = [];
  for (let i = 0; i < playing.length; i++) {
    for (let j = i + 1; j < playing.length; j++) {
      allPossiblePairs.push([playing[i], playing[j]]);
    }
  }

  let bestScore  = -Infinity;
  let bestGames  = null;

  // Cap combinations to avoid explosion
  const MAX_ITERATIONS = 2000;
  let iterations = 0;

  /**
   * Recursive backtracking:
   * At each step pick a pair for the next team slot,
   * then pair it with an opponent, assign to a court.
   */
  function solve(remainingPlayers, currentGames, currentScore) {

    if (iterations++ > MAX_ITERATIONS) return;

    // All courts filled
    if (currentGames.length === numCourts) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestGames = currentGames.slice();
      }
      return;
    }

    // Not enough players left to fill remaining courts
    if (remainingPlayers.length < 4) return;

    const usedInStep = new Set();

    // Try every pair combination for team1
    for (let i = 0; i < remainingPlayers.length; i++) {
      for (let j = i + 1; j < remainingPlayers.length; j++) {

        const p1 = remainingPlayers[i];
        const p2 = remainingPlayers[j];
        const team1 = [p1, p2];

        // Try every pair combination for team2 from the rest
        const restAfterTeam1 = remainingPlayers.filter(
          p => p !== p1 && p !== p2
        );

        for (let k = 0; k < restAfterTeam1.length; k++) {
          for (let l = k + 1; l < restAfterTeam1.length; l++) {

            const p3 = restAfterTeam1[k];
            const p4 = restAfterTeam1[l];
            const team2 = [p3, p4];

            // Check if this game has been played before
            const gameObj = { pair1: team1, pair2: team2 };
            const repeated = isGameRepeated(gameObj);

            let courtScore = 0;
            let courtRule  = 0;

            if (repeated) {
              // Force random for this court — score 0
              courtScore = 0;
              courtRule  = -1; // marker for random
            } else {
              courtRule  = getGameTierRule(team1, team2, tierMap);
              courtScore = courtRule === 1 ? 3
                         : courtRule === 2 ? 2
                         : courtRule === 3 ? 1
                         : 0;

              // Bonus for new partnerships
              const key1 = createSortedKey(p1, p2);
              const key2 = createSortedKey(p3, p4);
              if (!pairPlayedSet.has(key1)) courtScore += 0.5;
              if (!pairPlayedSet.has(key2)) courtScore += 0.5;

              // Bonus for fresh opponents
              const oppFresh = getOpponentFreshness(team1, team2, opponentMap);
              courtScore += oppFresh * 0.1;
            }

            const nextRemaining = restAfterTeam1.filter(
              p => p !== p3 && p !== p4
            );

            currentGames.push({
              pair1: [...team1],
              pair2: [...team2],
              courtRule,
              repeated
            });

            solve(nextRemaining, currentGames, currentScore + courtScore);

            currentGames.pop();

            if (iterations > MAX_ITERATIONS) return;
          }
        }
      }
    }
  }

  solve([...playing], [], 0);

  // Search exhausted → your existing RandomRound() takes over
  if (!bestGames) {
    const randomResult = RandomRound(state);
    return randomResult.games.map(g => ({
      pair1:     g.pair1,
      pair2:     g.pair2,
      courtRule: 0,
      repeated:  false
    }));
  }

  return bestGames;
}

/**
 * Count how many of the 4 opponent sub-matchups are fresh (never seen).
 */
function getOpponentFreshness(team1, team2, opponentMap) {
  let fresh = 0;
  for (const a of team1) {
    for (const b of team2) {
      if ((opponentMap.get(a)?.get(b) || 0) === 0) fresh++;
    }
  }
  return fresh; // 0–4
}


// ============================================================
//  SECTION 5 — FROZEN COURT HANDLER
// ============================================================

/**
 * When a court is frozen (game repeated), delegate entirely
 * to your existing RandomRound() scoped to just these 4 players.
 */
function findFreshRandomMatchup(courtPlayers, state) {

  const tempState = {
    ...state,
    activeplayers: courtPlayers,
    courts: 1
  };

  const randomResult = RandomRound(tempState);

  if (randomResult?.games?.length > 0) {
    return {
      pair1: randomResult.games[0].pair1,
      pair2: randomResult.games[0].pair2
    };
  }

  return null;
}


// ============================================================
//  SECTION 6 — WARM UP CHECK
// ============================================================

/**
 * Returns true if enough rounds have been played to start
 * competitive mode. Uses state.minRounds set from user input.
 */
function isWarmupComplete(state) {
  const minRounds = state.minRounds || 6; // default 6
  return allRounds.length >= minRounds;
}


// ============================================================
//  SECTION 7 — MAIN CompetitiveRound
// ============================================================

/**
 * CompetitiveRound(state)
 *
 * Called when warm-up is complete and mode is "competitive".
 * Receives playing list already resolved by parent.
 *
 * Per court logic:
 *   1. Check if proposed game is a repetition
 *      YES → random matchup for that court
 *      NO  → Rule 1 → Rule 2 → Rule 3 → fallback random
 *
 * Global:
 *   - Tries to maximise rule quality ACROSS ALL courts together
 *   - Updates points and streaks AFTER winners are marked
 *     (called from toggleRound when returning to idle)
 */
function CompetitiveRound(state) {

  const { activeplayers, courts, opponentMap } = state;

  // ── 1. Rebuild points + streaks from allRounds ──────────
  const { rankPoints, streakMap } = buildPointsAndStreaks(
    allRounds,
    activeplayers
  );

  // Store on state so UI / other functions can read them
  state.rankPoints = rankPoints;
  state.streakMap  = streakMap;

  // ── 2. Recalculate tiers ─────────────────────────────────
  const tierMap = calculateTiers(activeplayers, rankPoints);
  state.tierMap = tierMap;

  // ── 3. Get playing list (resting already resolved) ───────
  const { playing, resting } = getPlayingAndResting(state);

  // ── 4. Update repetition history ────────────────────────
  updatePreviousHistory(allRounds.length);

  // ── 5. Find globally best court combination ──────────────
  const proposedGames = findBestCourtCombination(
    playing,
    courts,
    tierMap,
    state
  );

  // ── 6. Per-court: handle repeated games → random ─────────
  const finalGames = [];

  for (let c = 0; c < proposedGames.length; c++) {

    const proposed = proposedGames[c];

    if (proposed.repeated || proposed.courtRule === -1) {

      // Court is frozen → delegate to RandomRound()
      const courtPlayers = [...proposed.pair1, ...proposed.pair2];
      const fresh = findFreshRandomMatchup(courtPlayers, state);

      if (fresh) {
        finalGames.push({
          court:     c + 1,
          pair1:     [...fresh.pair1],
          pair2:     [...fresh.pair2],
          courtRule: 0,
          isRandom:  true
        });
      } else {
        // Absolute fallback — RandomRound() on full state
        const rr = RandomRound(state);
        const rrGame = rr.games[c] || rr.games[0];
        finalGames.push({
          court:     c + 1,
          pair1:     [...rrGame.pair1],
          pair2:     [...rrGame.pair2],
          courtRule: 0,
          isRandom:  true
        });
      }

    } else {

      // Court is clean — use tier-rule result
      finalGames.push({
        court:     c + 1,
        pair1:     [...proposed.pair1],
        pair2:     [...proposed.pair2],
        courtRule: proposed.courtRule,
        isRandom:  false
      });
    }
  }

  // ── 7. Update pair + opponent memory ─────────────────────
  updateAfterRound(state, finalGames.map(g => [g.pair1, g.pair2]));

  return {
    games:   finalGames,
    resting,
    tierMap  // expose for UI if needed
  };
}


// ============================================================
//  SECTION 8 — UPDATED PARENT FUNCTION
// ============================================================

/**
 * AischedulerNextRound(schedulerState)
 *
 * Parent decides:
 *   - Warm up not complete  → RandomRound()
 *   - Warm up complete      → CompetitiveRound()
 *
 * The per-court freeze logic now lives INSIDE CompetitiveRound.
 * No mode memory needed — fresh check every round.
 */
function AischedulerNextRound(schedulerState) {

  const { activeplayers } = schedulerState;
  const playmode = getPlayMode();
  const page2    = document.getElementById('roundsPage');

  // ── Warm up gate ─────────────────────────────────────────
  const warmupDone = isWarmupComplete(schedulerState);

  let result;

  if (playmode === 'random' || !warmupDone) {

    // Random phase
    result = RandomRound(schedulerState);

    page2.classList.remove('competitive-mode');
    page2.classList.add('random-mode');

    schedulerState._lastMode = 'random';

  } else {

    // Competitive phase
    // Reset competitive memory only once on first entry
    if (schedulerState._lastMode !== 'competitive') {
      resetForCompetitivePhase(schedulerState);
    }

    result = CompetitiveRound(schedulerState);

    page2.classList.remove('random-mode');
    page2.classList.add('competitive-mode');

    schedulerState._lastMode = 'competitive';
  }

  return result;
}


// ============================================================
//  SECTION 9 — POINTS UPDATE (called on round end)
// ============================================================

/**
 * Called when the round ends (user clicks End Round).
 * Reads winners from the latest completed round and updates
 * rankPoints + streakMap on schedulerState.
 *
 * NOTE: buildPointsAndStreaks() recalculates from scratch
 * at the START of each CompetitiveRound, so this function
 * is mainly for UI display between rounds.
 */
function updatePointsAfterRound(state) {

  const latestRound = allRounds[allRounds.length - 1];
  if (!latestRound?.games) return;

  for (const game of latestRound.games) {

    if (!game.winner || !game.pair1 || !game.pair2) continue;

    const winners = game.winner === 'L' ? game.pair1 : game.pair2;
    const losers  = game.winner === 'L' ? game.pair2 : game.pair1;

    for (const p of winners) {
      applyResult(p, true,  state.rankPoints, state.streakMap);
    }
    for (const p of losers) {
      applyResult(p, false, state.rankPoints, state.streakMap);
    }
  }
}


// ============================================================
//  SECTION 10 — STATE INITIALISATION ADDITIONS
// ============================================================

/**
 * Add these fields to schedulerState when initialising your session.
 * Merge with your existing initialisation code.
 *
 *   state.minRounds  = parseInt(userInput) || 6;
 *   state.rankPoints = new Map();   // will be rebuilt each round
 *   state.streakMap  = new Map();   // will be rebuilt each round
 *   state.tierMap    = new Map();   // will be rebuilt each round
 *
 * All active players start at:
 *   rankPoints = 100
 *   streak     = 0
 */


// ============================================================
//  HELPER — createSortedKey (if not already in your codebase)
// ============================================================

/**
 * Canonical sorted key for a pair of players.
 * Use this everywhere instead of mixing getPairKey / createSortedKey.
 */
function createSortedKey(a, b) {
  return [a, b].sort().join('|');
}


/* ============================================================
   I18N — All UI translations EN/JP/KR/VI/ZH
   File: engjap.js
   ============================================================ */

const translations = {
  en: {
    appTitle: "CLUB Scheduler",
    home: "Home",
    language: "Language",
    settings: "Settings",
    players: "Players",
    rounds: "Rounds",
    summary: "Summary",
    fontSize: "Font Size",
    reset: "Reset",
    resetAll: "Reset App",
    resetExcept: "Reset Games",
    enterCourts: "Enter Number of Courts",
    importPlayers: "Browse Players ▶",
    gender: "Gender",
    male: "Male",
    female: "Female",
    import: "Import",
    cancel: "Cancel",
    enterPlayerName: "Enter Player Name",
    addPlayer: "Add",
    fixedPairs: "Set Fixed Pairs (Optional)",
    add: "Add",
    pround: " Round",
    nround: "Play ",
    endrounds: "Finish & Next Round ",
    roundno: "Round ",
    roundShort: "R",
    rank: "Rank",
    name: "Name",
    wins: "Wins",
    played: "Played",
    rested: "Rested",
    importExample: "Name,Gender\nKari\nBhavani",
    Timer: "Timer",
    min: "min",
    selectPlayer1: "Select Player 1",
    selectPlayer2: "Select Player 2",
    small: "Small",
    medium: "Medium",
    large: "Large",
    maxcourts: "Enter Number of Courts",
    sittingOut: "Resting",
    courts: "Courts",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    export: "Export",
    exporthtml: "📄 Export Summary",
    help: "Help",
    confirmResetAll: "Do you want to reset everything?",
    confirmResetGames: "Do you want to reset games only?",
    endRoundsConfirm: "Do you want to end the rounds?",
    yes: "Yes",
    browsePlayersSub: "Select from saved players",
    statusReady: "Status: Ready",
    statusProgress: "Status: Progress…",
    minRounds: "Warm-Up Rounds",
    roundSettings: "Round Settings",
    competitive: "Competitive"
  },

  jp: {
    appTitle: "CLUB Scheduler",
    home: "ホーム",
    players: "選手一覧",
    rounds: "試合ラウンド",
    summary: "集計",
    language: "言語",
    fontSize: "文字サイズ",
    reset: "リセット",
    resetAll: "全てをリセット",
    resetExcept: "プレーヤー以外をリセット",
    enterCourts: "コート数を入力",
    importPlayers: "プレイヤーを閲覧 ▶",
    gender: "性別",
    male: "男",
    female: "女",
    import: "取り込み",
    cancel: "キャンセル",
    enterPlayerName: "選手名を入力",
    addPlayer: "追加",
    fixedPairs: "固定ペア設定（任意）",
    add: "追加",
    pround: " ラウンド",
    nround: "ラウンド開始 ",
    endrounds: "終了して次のラウンド ",
    roundno: "ラウンド ",
    roundShort: "R",
    rank: "順位",
    name: "名前",
    wins: "勝利",
    played: "試合数",
    rested: "休憩数",
    importExample: "名前,性別\nカリ\nババニ",
    Timer: "タイマー",
    min: "分",
    selectPlayer1: "プレーヤー1を選択",
    selectPlayer2: "プレーヤー2を選択",
    small: "小",
    medium: "中",
    large: "大",
    maxcourts: "コートの数を入力してください",
    sittingOut: "休憩中:",
    courts: "コート",
    theme: "テーマ",
    light: "ライト",
    dark: "ダーク",
    export: "エクスポート",
    exporthtml: "📄 概要出力",
    confirmResetAll: "すべてをリセットしますか？",
    confirmResetGames: "試合のみをリセットしますか？",
    endRoundsConfirm: "ラウンドを終了しますか？",
    yes: "はい",
    help: "ヘルプ",
    statusReady: "状態: 準備完了",
    statusProgress: "状態: 進行中...",
    minRounds: "ウォームアップラウンド",
    roundSettings: "ラウンド設定",
    competitive: "競技モード",
    browsePlayersSub: "保存済みプレイヤーから選択"
  },

  kr: {
    appTitle: "CLUB Scheduler",
    home: "홈",
    players: "선수",
    rounds: "라운드",
    summary: "요약",
    language: "언어",
    fontSize: "글자 크기",
    reset: "초기화",
    resetAll: "전체 초기화",
    resetExcept: "경기만 초기화",
    enterCourts: "코트 수 입력",
    importPlayers: "플레이어 찾아보기 ▶",
    gender: "성별",
    male: "남성",
    female: "여성",
    import: "가져오기",
    cancel: "취소",
    enterPlayerName: "선수 이름 입력",
    addPlayer: "선수 추가",
    fixedPairs: "고정 페어 설정 (선택)",
    add: "추가",
    pround: " 라운드",
    nround: "라운드 시작 ",
    endrounds: "종료 및 다음 라운드 ",
    roundno: "라운드 ",
    roundShort: "R",
    rank: "순위",
    name: "이름",
    wins: "승리",
    played: "경기 수",
    rested: "휴식 수",
    importExample: "이름,성별\n카리\n바바니",
    Timer: "타이머",
    min: "분",
    selectPlayer1: "선수 1 선택",
    selectPlayer2: "선수 2 선택",
    small: "작게",
    medium: "보통",
    large: "크게",
    maxcourts: "코트 수를 입력하세요",
    sittingOut: "휴식 중:",
    courts: "코트",
    theme: "테마",
    light: "라이트",
    dark: "다크",
    export: "내보내기",
    exporthtml: "📄 요약 내보내기",
    confirmResetAll: "모든 데이터를 초기화하시겠습니까?",
    confirmResetGames: "경기만 초기화하시겠습니까?",
    endRoundsConfirm: "라운드를 종료하시겠습니까?",
    yes: "확인",
    help: "도움말",
    statusReady: "상태: 준비 완료",
    statusProgress: "상태: 진행 중…",
    minRounds: "워밍업 라운드",
    roundSettings: "라운드 설정",
    competitive: "경쟁 모드",
    browsePlayersSub: "저장된 선수에서 선택"
  },

  vi: {
    appTitle: "CLUB Scheduler",
    home: "Trang chủ",
    players: "Người chơi",
    rounds: "Vòng đấu",
    summary: "Tóm tắt",
    language: "Ngôn ngữ",
    fontSize: "Cỡ chữ",
    reset: "Đặt lại",
    resetAll: "Đặt lại tất cả",
    resetExcept: "Đặt lại trận đấu",
    enterCourts: "Nhập số sân",
    importPlayers: "Duyệt người chơi ▶",
    gender: "Giới tính",
    male: "Nam",
    female: "Nữ",
    import: "Nhập",
    cancel: "Hủy",
    enterPlayerName: "Nhập tên người chơi",
    addPlayer: "Thêm người chơi",
    fixedPairs: "Cố định cặp đấu (Tùy chọn)",
    add: "Thêm",
    pround: " Vòng",
    nround: "Bắt đầu vòng ",
    endrounds: "Kết thúc & Vòng tiếp theo ",
    roundno: "Vòng ",
    roundShort: "R",
    rank: "Xếp hạng",
    name: "Tên",
    wins: "Chiến thắng",
    played: "Số trận",
    rested: "Số lần nghỉ",
    importExample: "Tên,Giới tính\nKari\nBhavani",
    Timer: "Hẹn giờ",
    min: "phút",
    selectPlayer1: "Chọn người chơi 1",
    selectPlayer2: "Chọn người chơi 2",
    small: "Nhỏ",
    medium: "Vừa",
    large: "Lớn",
    maxcourts: "Nhập số sân",
    sittingOut: "Đang nghỉ:",
    courts: "Sân",
    theme: "Chủ đề",
    light: "Sáng",
    dark: "Tối",
    export: "Xuất",
    exporthtml: "📄 Xuất bản tóm tắt",
    confirmResetAll: "Bạn có muốn đặt lại tất cả không?",
    confirmResetGames: "Bạn có muốn đặt lại trận đấu không?",
    endRoundsConfirm: "Bạn có muốn kết thúc các vòng không?",
    yes: "Có",
    help: "Trợ giúp",
    statusReady: "Trạng thái: Sẵn sàng",
    statusProgress: "Trạng thái: Đang tiến hành…",
    minRounds: "Vòng khởi động",
    roundSettings: "Cài đặt vòng",
    competitive: "Cạnh tranh",
    browsePlayersSub: "Chọn từ danh sách đã lưu"
  },

  zh: {
    appTitle: "CLUB 调度器",
    home: "首页",
    players: "球员",
    rounds: "回合",
    summary: "汇总",
    language: "语言",
    fontSize: "字体大小",
    reset: "重置",
    resetAll: "重置应用",
    resetExcept: "仅重置比赛",
    enterCourts: "输入场地数量",
    importPlayers: "浏览玩家 ▶",
    gender: "性别",
    male: "男",
    female: "女",
    import: "导入",
    cancel: "取消",
    enterPlayerName: "输入球员姓名",
    addPlayer: "添加球员",
    fixedPairs: "设置固定搭档（可选）",
    add: "添加",
    pround: " 回合",
    nround: "开始回合 ",
    endrounds: "结束并进入下一回合 ",
    roundno: "回合 ",
    roundShort: "R",
    rank: "排名",
    name: "姓名",
    wins: "胜利",
    played: "已比赛",
    rested: "休息次数",
    importExample: "姓名,性别\nKari\nBhavani",
    Timer: "计时器",
    min: "分钟",
    selectPlayer1: "选择球员 1",
    selectPlayer2: "选择球员 2",
    small: "小",
    medium: "中",
    large: "大",
    maxcourts: "请输入场地数量",
    sittingOut: "休息中:",
    courts: "场地",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    export: "导出",
    exporthtml: "📄 导出汇总",
    confirmResetAll: "确定要重置所有内容吗？",
    confirmResetGames: "确定只重置比赛吗？",
    endRoundsConfirm: "确定要结束回合吗？",
    yes: "确定",
    help: "帮助",
    statusReady: "状态: 就绪",
    statusProgress: "状态: 进行中…",
    minRounds: "热身轮次",
    roundSettings: "回合设置",
    competitive: "竞技模式",
    browsePlayersSub: "从已保存的球员中选择"
  }
};

/* ============================================================
   SUMMARY TAB — Round report and HTML export
   File: summary.js
   ============================================================ */

function renderRounds() {
  const exportRoot = document.getElementById('export');
  exportRoot.innerHTML = '';

  allRounds.slice(0, -1).forEach((data) => {
    /* ───────── Round Container ───────── */
    const roundDiv = document.createElement('div');
    roundDiv.className = 'export-round';

    /* ───────── Round Title ───────── */
    const title = document.createElement('div');
    title.className = 'export-round-title';
    title.textContent = data.round;
    roundDiv.appendChild(title);

    /* ───────── Matches ───────── */
    data.games.forEach(game => {
      const match = document.createElement('div');
      match.className = 'export-match';

      const leftTeam = document.createElement('div');
      leftTeam.className = 'export-team';
      leftTeam.innerHTML = game.pair1.join('<br>');

      const vs = document.createElement('div');
      vs.className = 'export-vs';
      vs.textContent = 'VS';

      const rightTeam = document.createElement('div');
      rightTeam.className = 'export-team';
      rightTeam.innerHTML = game.pair2.join('<br>');

      // ✅ Add 🏆 to the winning team
      if (game.winners && Array.isArray(game.winners)) {
        const leftWins = game.pair1.filter(p => game.winners.includes(p)).length;
        const rightWins = game.pair2.filter(p => game.winners.includes(p)).length;

       if (leftWins > rightWins) {
          leftTeam.classList.add('winner');
        } else if (rightWins > leftWins) {
          rightTeam.classList.add('winner');
        } else if (leftWins > 0 && leftWins === rightWins) {
          leftTeam.classList.add('winner');
          rightTeam.classList.add('winner');
        }
      }

      match.append(leftTeam, vs, rightTeam);
      roundDiv.appendChild(match);
    });

    /* ───────── Sitting Out Section ───────── */
    const restTitle = document.createElement('div');
    restTitle.className = 'export-rest-title';
    restTitle.textContent = t('sittingOut'); 
    roundDiv.appendChild(restTitle);

    const restBox = document.createElement('div');
    restBox.className = 'export-rest-box';

    if (!data.resting || data.resting.length === 0) {
      restBox.textContent = t('none'); 
    } else {
      restBox.innerHTML = data.resting.join(', ');
    }

    roundDiv.appendChild(restBox);

    exportRoot.appendChild(roundDiv);
  });
}

// ExportCSS.js

async function createSummaryCSS() {
  return `
/* Summary */
.report-header,
.player-card {
  display: grid;
  grid-template-columns: 50px 1fr minmax(60px, auto) minmax(60px, auto) minmax(60px, auto);
  align-items: center;
  gap: 10px;
}

/* Header styling */
.report-header {
  margin: 5px 0;
  background: #800080;
  font-weight: bold;
  color: #fff;
  padding: 6px;
  border-radius: 6px;
  margin-bottom: 1px;
  position: sticky;
  z-index: 10;
}

/* Player card styling */
.player-card {
  background: #296472;
  color: #fff;
  padding: 2px;
  margin: 5px 0;
  border-radius: 1.1rem;
  border: 1px solid #555;
  box-shadow: 0 0 4px rgba(0,0,0,0.4);
}

/* Rank styling */
.player-card .rank {
  text-align: center;
  font-size: 1.1rem;
  font-weight: bold;
}

/* Name column */
.player-card .name {
  font-size: 1.1rem;
  padding-left: 6px;
}


.export-round {
  margin: 15px 3px 3px;
  border: 3px solid #800080;
}

.export-round-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  border-bottom: 1px solid #000;
  padding-bottom: 4px;
  text-align: center;
}

.export-match {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 5px;
}

.export-team {
  position: relative;           /* allow positioning of trophy */
  padding: 10px 25px 10px 10px; /* top/right/bottom/left; right space for trophy */
  display: flex;                /* use flex for centering and spacing */
  flex-direction: column;       /* stack players vertically */
  align-items: center;          /* center horizontally */
  justify-content: center;      /* center vertically */
  border: 2px solid #333;    /* boundary */
  border-radius: 8px;           /* optional rounded corners */
  width: 37%;             /* ensures all boxes roughly same size */
  background-color:none;    /* optional light background */
  text-align: center;           /* center text inside */
}

/* Trophy on the right for winning team */
.export-team::after {
  content: '🏆';
  position: absolute;
  right: 5px;                   /* stick to right edge */
  top: 50%;                     /* vertically center */
  transform: translateY(-50%);
  display: none;                 /* hidden by default */
}

.export-team.winner::after {
  display: inline-block;
}



.export-vs {
  width: 10%;
  text-align: center;
  font-weight: 600;
}

/* Sitting out */
.export-rest-title {
  margin: 5px;
  font-weight: 600;
}

.export-rest-box {
  margin: 5px;
  font-size: 13px;
}

`;
}

async function exportBRR2HTML() {
  const SUMMARY_CSS = await createSummaryCSS();
  showPage('summaryPage');
  await new Promise(r => setTimeout(r, 300));

  const page = document.getElementById('summaryPage');
  if (!page) return alert("Export page not found");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BRR Export</title>
<style>
${SUMMARY_CSS}
</style>
</head>
<body>
${page.outerHTML}
</body>
</html>
`;

  // ✅ Android WebView
  if (window.Android && typeof Android.saveHtml === "function") {
    Android.saveHtml(html);
  }

  // ✅ iOS WebView (if you implemented message handler)
  else if (window.webkit && window.webkit.messageHandlers?.saveHtml) {
    window.webkit.messageHandlers.saveHtml.postMessage(html);
  }

  // ✅ Normal browser fallback (download file)
  else {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "BRR_Export.html";
    a.click();

    URL.revokeObjectURL(url);
  }
}










/* ============================================================
   HELP TAB — Load and display contextual help sections
   File: help.js
   ============================================================ */

var helpData = null;
var loadedLang = null;
var currentHelpSection = 'players';

function loadHelp(sectionKey) {
  currentHelpSection = sectionKey;

  var lang = localStorage.getItem("appLanguage") || "en";

  // Update active button
  document.querySelectorAll('.help-btn')
    .forEach(btn => btn.classList.remove('active'));

  var activeBtn = document.querySelector(
    `.help-btn[onclick="loadHelp('${sectionKey}')"]`
  );
  if (activeBtn) activeBtn.classList.add('active');

  // Reload help JSON if language changed
  if (!helpData || loadedLang !== lang) {
    fetch(`https://samkarikalan.github.io/APP/help_${lang}.json?v=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error("Help file not found");
        return res.json();
      })
      .then(data => {
        helpData = data;
        loadedLang = lang;
        showHelpSection(sectionKey);
      })
      .catch(() => {
        document.getElementById('helpContainer').innerHTML =
          '<p style="color:red;">Help file not available for this language.</p>';
      });
  } else {
    showHelpSection(sectionKey);
  }
}

function showHelpSection(sectionKey) {
  var container = document.getElementById('helpContainer');
  var sectionObj = helpData?.[sectionKey];

  if (!sectionObj) {
    container.innerHTML = '<p>No help found for this section.</p>';
    return;
  }

  var html = '';

  for (var topicKey in sectionObj) {
    var topic = sectionObj[topicKey];
    html += `
      <div class="help-card">
        ${topic.title ? `<h3>${topic.title}</h3>` : ''}
        ${topic.content ? `<p>${topic.content}</p>` : ''}
        ${topic.list
          ? `<ul>${topic.list.map(item => `<li>${item}</li>`).join('')}</ul>`
          : ''}
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ===============================
   LANGUAGE CHANGE HANDLER
   =============================== */
function changeLanguage(lang) {
  localStorage.setItem("appLanguage", lang);

  // 🔥 Instantly refresh help in current section
  loadHelp(currentHelpSection);
}

// Initial load
loadHelp(currentHelpSection);

