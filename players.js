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
  const player = schedulerState.allPlayers.find(p => p.name === playerName);
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
    <div class="fixed-name">${icon1} ${p1} & ${icon2} ${p2}</div>
    <div class="fixed-delete">
      <button class="pec-btn delete" onclick="modifyFixedPair('${p1}', '${p2}')">🗑</button>
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
    const confirmLineIndex = lines.findIndex(line => /confirm/i.test(line));
    if (confirmLineIndex >= 0) {
      startIndex = confirmLineIndex + 1;
      for (let i = startIndex; i < lines.length; i++) {
        if (stopMarkers.some(re => re.test(lines[i]))) { stopIndex = i; break; }
      }
    }
    const cleanedLines = [];
    for (let i = startIndex; i < stopIndex; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      if (line.toLowerCase().includes("http")) continue;
      cleanedLines.push(line);
    }
    return cleanedLines.join("\n");
  }

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(text => {
        const cleaned = cleanText(text);
        if (!cleaned) { alert("No valid player names found."); return; }
        textarea.value += (textarea.value ? '\n' : '') + cleaned;
        textarea.focus();
      })
      .catch(() => { alert('Paste not allowed. Long-press and paste instead.'); });
  } else {
    alert('Paste not supported on this device.');
  }
}

function showImportModal() {
  const textarea = document.getElementById("players-textarea");
  textarea.value = "";
  textarea.placeholder = translations[currentLang].importExample;
  document.getElementById('importModal').style.display = 'block';
}

function hideImportModal() {
  document.getElementById('newImportModal').style.display = 'none';
}

function saveAllPlayersState() {
  localStorage.setItem("schedulerPlayers", JSON.stringify(schedulerState.allPlayers));
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

/* =========================
   EDIT PLAYER INFO
========================= */
function editPlayer(i, field, val) {
  const player = schedulerState.allPlayers[i];
  if (field === 'active') {
    player.active = !!val;
    if (val) {
      const highest = Math.max(0, ...schedulerState.allPlayers.map(p => p.turnOrder || 0));
      player.turnOrder = highest + 1;
    }
  } else {
    player[field] = val.trim();
  }
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updatePlayerList();
  updateFixedPairSelectors();
}

function removeFixedPairsForPlayer(playerName) {
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => {
    const keep = !pair.includes(playerName);
    if (!keep) { const key = pair.slice().sort().join("&"); removeFixedCard(key); }
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
  schedulerState.allPlayers.splice(i, 1);
  removeFixedPairsForPlayer(deletedPlayer);
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updatePlayerList();
  updateFixedPairSelectors();
  refreshFixedCards();
}

function toggleActive(index, checkbox) {
  schedulerState.allPlayers[index].active = checkbox.checked;
  const card = checkbox.closest(".player-edit-card");
  if (checkbox.checked) { card.classList.remove("inactive"); }
  else { card.classList.add("inactive"); }
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updateFixedPairSelectors();
}

function getGenderIcon(gender) {
  return gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function toggleGender(index, iconEl) {
  const player = schedulerState.allPlayers[index];
  if (!player) return;
  player.gender = player.gender === "Male" ? "Female" : "Male";
  const genderClass = player.gender.toLowerCase();
  iconEl.textContent = getGenderIcon(player.gender);
  iconEl.classList.remove("male", "female");
  iconEl.classList.add(genderClass);
  const card = iconEl.closest(".player-edit-card");
  if (card) { card.classList.remove("male", "female"); card.classList.add(genderClass); }
  updateGenderGroups();
  updateFixedPairSelectors();
  refreshFixedCards();
  saveAllPlayersState();
}

function updateGenderGroups() {
  schedulerState.malePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Male" && p.active).map(p => p.name);
  schedulerState.femalePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Female" && p.active).map(p => p.name);
}

function addPlayersFromInputUI() {
  const importPlayers = newImportState.selectedPlayers;
  if (!importPlayers || importPlayers.length === 0) { alert('No players to add!'); return; }

  const extractedNames = [];
  importPlayers.forEach(p => {
    const name = p.displayName.trim();
    const gender = p.gender || "Male";
    if (
      !schedulerState.allPlayers.some(e => e.name.trim().toLowerCase() === name.toLowerCase()) &&
      !extractedNames.some(e => e.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      extractedNames.push({ name, gender, active: true });
    }
  });

  schedulerState.allPlayers.push(...extractedNames);
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();
  newImportState.selectedPlayers = [];
}

/* =========================
   ADD PLAYERS FROM TEXT
========================= */
function addPlayersFromText() {
  const textarea = document.getElementById("players-textarea");
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender = document.querySelector('input[name="genderSelect"]:checked')?.value || "Male";
  const lines = text.split(/\r?\n/);
  const stopMarkers = [
    /court full/i, /wl/i, /waitlist/i, /late cancel/i,
    /cancelled/i, /reserve/i, /bench/i, /extras/i, /backup/i
  ];

  let startIndex = 0, stopIndex = lines.length;
  const confirmLineIndex = lines.findIndex(line => /confirm/i.test(line));
  if (confirmLineIndex >= 0) {
    startIndex = confirmLineIndex + 1;
    for (let i = startIndex; i < lines.length; i++) {
      if (stopMarkers.some(re => re.test(lines[i]))) { stopIndex = i; break; }
    }
  }

  const genderLookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)   genderLookup[langObj.male.toLowerCase()]   = "Male";
      if (langObj.female) genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  const extractedNames = [];
  for (let i = startIndex; i < stopIndex; i++) {
    let line = lines[i].trim();
    if (!line || /https?/i.test(line)) continue;
    let gender = defaultGender;
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }
    if (!line) continue;
    const normalized = line.toLowerCase();
    const exists =
      schedulerState.allPlayers.some(p => p.name.trim().toLowerCase() === normalized) ||
      extractedNames.some(p => p.name.trim().toLowerCase() === normalized);
    if (!exists) extractedNames.push({ name: line, gender, active: true });
  }

  if (extractedNames.length === 0) return;
  schedulerState.allPlayers.push(...extractedNames);
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
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
  card.draggable = true;
  card.dataset.index = index;
  card.addEventListener("dragstart", onDragStart);
  card.addEventListener("dragover", onDragOver);
  card.addEventListener("drop", onDrop);

  const genderIcon = player.gender === "Male" ? "👨‍💼" : player.gender === "Female" ? "🙎‍♀️" : "❔";

  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox" ${player.active ? "checked" : ""} onchange="toggleActive(${index}, this)">
    </div>
    <div class="pec-col pec-sl">${index + 1}</div>
    <div class="pec-col pec-gender">
      <span class="gender-icon ${player.gender.toLowerCase()}" onclick="toggleGender(${index}, this)">
        ${genderIcon}
      </span>
    </div>
    <div class="pec-col pec-name" onclick="editPlayerName(${index})">${player.name}</div>
    <div class="pec-col pec-delete">
      <button class="pec-btn delete" onclick="deletePlayer(${index})">🗑</button>
    </div>
  `;
  return card;
}

function editPlayerName(index) {
  const oldName = schedulerState.allPlayers[index].name;
  const newName = prompt("Edit player name", oldName);
  if (!newName) return;
  const trimmed = newName.trim();
  if (!trimmed) return;
  const duplicate = schedulerState.allPlayers.some(
    (p, i) => i !== index && p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) { alert("Player name already exists!"); return; }
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

function onDragOver(e) { e.preventDefault(); }

function onDrop(e) {
  const targetIndex = Number(e.currentTarget.dataset.index);
  if (draggedIndex === targetIndex) return;
  const list = schedulerState.allPlayers;
  const [moved] = list.splice(draggedIndex, 1);
  list.splice(targetIndex, 0, moved);
  updatePlayerList();
}

function updatePlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = "";
  schedulerState.allPlayers.forEach((player, index) => {
    container.appendChild(createPlayerCard(player, index));
  });
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updateFixedPairSelectors();
  updateCourtButtons();
  updateRoundsPageAccess();
}

function getPlayedColor(value) {
  if (!value || value <= 0) return "#e0e0e0";
  return `hsl(${(Math.min(value, 20) - 1) * 36}, 92%, 58%)`;
}

function getRestColor(value) {
  if (!value || value <= 0) return "#e0e0e0";
  return `hsl(${((Math.min(value, 20) - 1) * 36 + 180) % 360}, 88%, 62%)`;
}

/* =========================
   FIXED PAIRS MANAGEMENT
========================= */
function modifyFixedPair(p1 = null, p2 = null) {
  if (!p1 || !p2) {
    p1 = document.getElementById('fixed-pair-1').value;
    p2 = document.getElementById('fixed-pair-2').value;
  }
  if (!p1 || !p2) { alert("Please select both players."); return; }
  if (p1 === p2) { alert("You cannot pair the same player with themselves."); return; }

  const pairKey = [p1, p2].sort().join('&');
  const index = schedulerState.fixedPairs.findIndex(pair => pair.slice().sort().join('&') === pairKey);

  if (index !== -1) {
    schedulerState.fixedPairs.splice(index, 1);
    removeFixedCard(pairKey);
    updateFixedPairSelectors();
    return;
  }

  schedulerState.fixedPairs.push([p1, p2]);
  addFixedCard(p1, p2, pairKey);
  updateFixedPairSelectors();
}

function removeFixedCard(key) {
  const card = document.querySelector(`[data-key="${key}"]`);
  if (card) card.remove();
}

function removeFixedPair(el, p1, p2) {
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(
    pair => !(pair[0] === p1 && pair[1] === p2)
  );
  el.parentElement.remove();
  updateFixedPairSelectors();
}

/* =========================
   PAGE NAVIGATION / TOAST
========================= */
function showToast(msg) {
  if (!msg) return;
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => { if (toast) toast.classList.add("hidden"); }, 2500);
}

function alert(msg) { showToast(msg); }

/* =========================
   HELPERS
========================= */
function debounce(func, delay = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Universal unique-add utility — used for all three lists
function addToListIfNotExists(list, player) {
  const exists = list.findIndex(
    p => p.displayName.trim().toLowerCase() === player.displayName.trim().toLowerCase()
  );
  if (exists >= 0) return false;
  list.push({ ...player });
  return true;
}

function newImportDeduplicate(list) {
  const map = new Map();
  list.forEach(player => {
    const key = player.displayName.trim().toLowerCase();
    map.set(key, player); // keep latest
  });
  return Array.from(map.values());
}

/* =========================
   STATE
========================= */
const newImportState = {
  historyPlayers:  [],
  favoritePlayers: [],
  selectedPlayers: [],
  currentSelectMode: "history"
};

let newImportModal;
let newImportSelectCards;
let newImportSelectedCards;
let newImportSelectedCount;
let newImportSearch;

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  newImportModal        = document.getElementById("newImportModal");
  newImportSelectCards  = document.getElementById("newImportSelectCards");
  newImportSelectedCards = document.getElementById("newImportSelectedCards");
  newImportSelectedCount = document.getElementById("newImportSelectedCount");
  newImportSearch       = document.getElementById("newImportSearch");

  newImportLoadHistory();
  newImportLoadFavorites();
  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();

  newImportSelectCards.addEventListener("click", newImportHandleCardClick);
  newImportSearch.addEventListener("input", newImportRefreshSelectCards);
});

/* =========================
   MODAL OPEN / CLOSE
========================= */
function newImportShowModal() {
  newImportModal.style.display = "flex";
  newImportLoadHistory();
  newImportLoadFavorites();
  newImportRefreshSelectCards();
  newImportRefreshSelectedCards();
}

function newImportHideModal() {
  newImportModal.style.display = "none";
  newImportState.selectedPlayers = [];
}

/* =========================
   TAB SWITCH
========================= */
function newImportShowSelectMode(mode) {
  newImportState.currentSelectMode = mode;

  document.querySelectorAll(".newImport-subtab-btn")
    .forEach(btn => btn.classList.remove("active"));

  document.getElementById(
    "newImport" + mode.charAt(0).toUpperCase() + mode.slice(1) + "Btn"
  )?.classList.add("active");

  const clearHistory   = document.getElementById("newImportClearHistoryBtn");
  const clearFavorites = document.getElementById("newImportClearFavoritesBtn");
  const listContainer  = document.getElementById("newImportSelectCards");
  const addSection     = document.getElementById("newImportAddPlayersSection");
  const searchInput    = document.getElementById("newImportSearch");

  if (mode === "addplayers") {
    listContainer.style.display = "none";
    addSection.style.display    = "block";
    searchInput.style.display   = "none";
    clearHistory.style.display   = "none";
    clearFavorites.style.display = "none";
    return;
  }

  listContainer.style.display = "flex";
  addSection.style.display    = "none";
  searchInput.style.display   = "block";

  if (mode === "history") {
    clearHistory.style.display   = "block";
    clearFavorites.style.display = "none";
  } else {
    clearHistory.style.display   = "none";
    clearFavorites.style.display = "block";
  }

  newImportRefreshSelectCards();
}

/* =========================
   STORAGE — HISTORY
========================= */
function newImportLoadHistory() {
  const data = localStorage.getItem("newImportHistory");
  newImportState.historyPlayers = data ? newImportDeduplicate(JSON.parse(data)) : [];
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
}

/* =========================
   STORAGE — FAVORITES (individual players)
========================= */
function newImportLoadFavorites() {
  const data = localStorage.getItem("newImportFavorites");
  newImportState.favoritePlayers = data ? newImportDeduplicate(JSON.parse(data)) : [];
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

function newImportSaveFavorites() {
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

/* =========================
   STORAGE — FAVORITE SETS
========================= */
function newImportLoadFavoriteSets() {
  try { return JSON.parse(localStorage.getItem("newImportFavoriteSets") || "[]"); }
  catch { return []; }
}

function newImportSaveFavoriteSets(sets) {
  localStorage.setItem("newImportFavoriteSets", JSON.stringify(sets));
}

/* =========================
   RENDER — SELECT CARDS (history / favorites)
========================= */
function newImportRefreshSelectCards() {
  if (newImportState.currentSelectMode === "addplayers") return;

  newImportSelectCards.innerHTML = "";

  // ── Favorite Sets (top of favorites tab only) ──
  if (newImportState.currentSelectMode === "favorites") {
    const sets = newImportLoadFavoriteSets();
    sets.forEach(set => {
      const setCard = document.createElement("div");
      setCard.className = "newImport-set-card";
      const safeName = set.name.replace(/'/g, "\\'");
      setCard.innerHTML = `
        <div class="newImport-set-info" onclick="newImportLoadSetToSelected('${safeName}')">
          <span class="newImport-set-icon">★</span>
          <span class="newImport-set-name">${set.name}</span>
          <span class="newImport-set-count">${set.players.length} players</span>
        </div>
        <button class="circle-btn delete" onclick="newImportDeleteFavoriteSet('${safeName}')">×</button>
      `;
      newImportSelectCards.appendChild(setCard);
    });
  }

  // ── Individual players ──
  const source =
    newImportState.currentSelectMode === "favorites"
      ? [...newImportState.favoritePlayers]
      : [...newImportState.historyPlayers];

  source.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );

  const search = newImportSearch.value.toLowerCase();

  source
    .filter(p => p.displayName.toLowerCase().includes(search))
    .forEach(p => {
      const added = newImportState.selectedPlayers.some(sp => sp.displayName === p.displayName);
      const fav   = newImportState.favoritePlayers.some(fp => fp.displayName === p.displayName);

      const card = document.createElement("div");
      card.className = "newImport-player-card";
      card.innerHTML = `
        <div class="newImport-player-top">
          <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
               data-action="gender" data-player="${p.displayName}">
          <div class="newImport-player-name">${p.displayName}</div>
        </div>
        <div class="newImport-player-actions">
          <button class="circle-btn favorite ${fav ? 'active-favorite' : ''}"
            data-action="favorite" data-player="${p.displayName}">
            ${fav ? "★" : "☆"}
          </button>
          <button class="circle-btn delete" data-action="delete" data-player="${p.displayName}">×</button>
          <button class="circle-btn add ${added ? 'active-added' : ''}"
            data-action="add" data-player="${p.displayName}" ${added ? "disabled" : ""}>
            ${added ? "✓" : "+"}
          </button>
        </div>
      `;
      newImportSelectCards.appendChild(card);
    });
}

/* =========================
   CARD ACTIONS (history / favorites)
========================= */
function newImportHandleCardClick(e) {
  const action = e.target.dataset.action;
  if (!action) return;

  const playerName = e.target.dataset.player;
  if (!playerName) return;

  const source =
    newImportState.currentSelectMode === "favorites"
      ? newImportState.favoritePlayers
      : newImportState.historyPlayers;

  const player = source.find(p => p.displayName === playerName);
  if (!player) return;

  // ADD TO SELECTED
  if (action === "add") {
    addToListIfNotExists(newImportState.selectedPlayers, player);
    newImportRefreshSelectedCards();
  }

  // TOGGLE GENDER
  if (action === "gender") {
    player.gender = player.gender === "Male" ? "Female" : "Male";
    // sync across history and favorites
    [newImportState.historyPlayers, newImportState.favoritePlayers].forEach(list => {
      const p = list.find(p => p.displayName === player.displayName);
      if (p) p.gender = player.gender;
    });
    localStorage.setItem("newImportHistory",   JSON.stringify(newImportState.historyPlayers));
    localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
  }

  // TOGGLE FAVORITE
  if (action === "favorite") {
    const i = newImportState.favoritePlayers.findIndex(p => p.displayName === player.displayName);
    if (i >= 0) {
      newImportState.favoritePlayers.splice(i, 1);
    } else {
      addToListIfNotExists(newImportState.favoritePlayers, player);
    }
    newImportSaveFavorites();
  }

  // DELETE
  if (action === "delete") {
    const removeIndex = source.findIndex(p => p.displayName === playerName);
    if (removeIndex >= 0) source.splice(removeIndex, 1);
    if (newImportState.currentSelectMode === "history") {
      localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
    } else {
      localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
    }
  }

  newImportRefreshSelectCards();
}

/* =========================
   SELECTED LIST
========================= */
function newImportRefreshSelectedCards() {
  newImportSelectedCards.innerHTML = "";
  newImportSelectedCount.textContent = newImportState.selectedPlayers.length;

  newImportState.selectedPlayers.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "newImport-player-card";
    card.innerHTML = `
      <div class="newImport-player-top">
        <img src="${p.gender === "Male" ? "male.png" : "female.png"}">
        <div class="newImport-player-name">${p.displayName}</div>
      </div>
      <div class="newImport-player-actions">
        <button onclick="newImportRemoveSelected(${i})">×</button>
      </div>
    `;
    newImportSelectedCards.appendChild(card);
  });
}

function newImportRemoveSelected(i) {
  newImportState.selectedPlayers.splice(i, 1);
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

function newImportClearSelected() {
  newImportState.selectedPlayers = [];
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

/* =========================
   CLEAR LISTS
========================= */
function newImportClearHistory() {
  if (!confirm("Clear history?")) return;
  newImportState.historyPlayers = [];
  localStorage.setItem("newImportHistory", "[]");
  newImportRefreshSelectCards();
}

function newImportClearFavorites() {
  if (!confirm("Clear favorites?")) return;
  newImportState.favoritePlayers = [];
  localStorage.setItem("newImportFavorites", "[]");
  newImportRefreshSelectCards();
}

/* =========================
   FAVORITE SETS
========================= */
function newImportToggleFavoriteSetInput() {
  const row = document.getElementById("newImportFavoriteSetRow");
  const isVisible = row.style.display !== "none";
  row.style.display = isVisible ? "none" : "block";
  if (!isVisible) document.getElementById("newImportSetName").focus();
}

function newImportSaveFavoriteSet() {
  const setNameInput = document.getElementById("newImportSetName");
  const setName = setNameInput.value.trim();
  if (!setName) { setNameInput.focus(); return; }

  const textarea = document.getElementById("players-names");
  const text = textarea?.value.trim();
  if (!text) return;

  const defaultGender = document.getElementById("player-gender")?.value || "Male";
  const genderLookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)   genderLookup[langObj.male.toLowerCase()]   = "Male";
      if (langObj.female) genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  const players = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    let gender = defaultGender;
    const numMatch = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (numMatch) line = numMatch[2].trim();
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }
    if (!line) continue;
    addToListIfNotExists(players, { displayName: line, gender });
  }

  if (!players.length) return;

  const sets = newImportLoadFavoriteSets();
  const existingIdx = sets.findIndex(
    s => s.name.trim().toLowerCase() === setName.toLowerCase()
  );
  if (existingIdx >= 0) {
    sets[existingIdx].players = players;
  } else {
    sets.push({ name: setName, players });
  }
  newImportSaveFavoriteSets(sets);

  setNameInput.value = "";
  document.getElementById("newImportFavoriteSetRow").style.display = "none";
  newImportShowSelectMode("favorites");
}

function newImportDeleteFavoriteSet(setName) {
  const sets = newImportLoadFavoriteSets().filter(s => s.name !== setName);
  newImportSaveFavoriteSets(sets);
  newImportRefreshSelectCards();
}

function newImportLoadSetToSelected(setName) {
  const sets = newImportLoadFavoriteSets();
  const set = sets.find(s => s.name === setName);
  if (!set) return;
  set.players.forEach(p => addToListIfNotExists(newImportState.selectedPlayers, p));
  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();
}

/* =========================
   ADD PLAYER (from Add Players tab)
========================= */
function addPlayer() {
  const textarea = document.getElementById("players-names");
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender = document.getElementById("player-gender")?.value || "Male";
  const genderLookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)   genderLookup[langObj.male.toLowerCase()]   = "Male";
      if (langObj.female) genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  const extractedPlayers = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    let gender = defaultGender;
    const numMatch = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (numMatch) line = numMatch[2].trim();
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }
    if (!line) continue;
    addToListIfNotExists(extractedPlayers, { displayName: line, gender });
  }

  if (!extractedPlayers.length) return;

  extractedPlayers.forEach(player => {
    // Add to selected (unique)
    addToListIfNotExists(newImportState.selectedPlayers, player);

    // Add to history (unique, newest on top)
    const added = addToListIfNotExists(newImportState.historyPlayers, player);
    if (added) {
      newImportState.historyPlayers.pop();
      newImportState.historyPlayers.unshift({ ...player });
    }
  });

  // Keep max 50 history entries
  newImportState.historyPlayers = newImportState.historyPlayers.slice(0, 50);
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));

  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();

  textarea.value = "";
  textarea.style.height = "40px";
  textarea.focus();
}

/* =========================
   FINAL IMPORT
========================= */
function newImportAddPlayers() {
  if (!newImportState.selectedPlayers.length) { alert("No players selected"); return; }
  if (typeof addPlayersFromText === "function") {
    addPlayersFromText(newImportState.selectedPlayers);
  }
  newImportState.historyPlayers = [
    ...newImportState.selectedPlayers,
    ...newImportState.historyPlayers
  ].slice(0, 50);
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  newImportHideModal();
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
