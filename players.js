/* ============================================================
   PLAYERS TAB — Add, edit, delete, players and fixed pairs
   File: players.js
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  const textarea = document.getElementById("players-names");
  if (!textarea) return;
  // Grow on input, but never shrink below the CSS min-height (3 rows)
  textarea.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
  textarea.addEventListener("blur", function () {
    // Reset to natural size when empty so CSS min-height takes over
    if (!this.value.trim()) this.style.height = "";
  });
});

/* =========================
   GENDER HELPERS
========================= */
function getGenderIconByName(playerName) {
  const player = schedulerState.allPlayers.find(p => p.name === playerName);
  if (!player) return "❔";
  return player.gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function getGenderIcon(gender) {
  return gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function updateGenderGroups() {
  schedulerState.malePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Male" && p.active).map(p => p.name);
  schedulerState.femalePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Female" && p.active).map(p => p.name);
}

/* =========================
   FIXED PAIRS
========================= */
function refreshFixedCards() {
  const list = document.getElementById("fixed-pair-list");
  list.innerHTML = "";
  schedulerState.fixedPairs.forEach(([p1, p2], index) => addFixedCard(p1, p2, index));
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

function modifyFixedPair(p1 = null, p2 = null) {
  if (!p1 || !p2) {
    p1 = document.getElementById('fixed-pair-1').value;
    p2 = document.getElementById('fixed-pair-2').value;
  }
  if (!p1 || !p2) { alert("Please select both players."); return; }
  if (p1 === p2)  { alert("You cannot pair the same player with themselves."); return; }
  const pairKey = [p1, p2].sort().join('&');
  const index   = schedulerState.fixedPairs.findIndex(
    pair => pair.slice().sort().join('&') === pairKey
  );
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

function removeFixedPairsForPlayer(playerName) {
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => {
    const keep = !pair.includes(playerName);
    if (!keep) removeFixedCard(pair.slice().sort().join("&"));
    return keep;
  });
  updateFixedPairSelectors();
}

/* =========================
   PLAYER STATE SAVE
========================= */

/* =========================
   RATING SYNC — schedulerState → history
   Called after save so import history carries latest ratings
========================= */
function syncRatingsToHistory() {
  if (!newImportState || !newImportState.historyPlayers) return;
  let changed = false;
  newImportState.historyPlayers.forEach(hp => {
    const key = hp.displayName.trim().toLowerCase();
    const sp  = schedulerState.allPlayers.find(p => p.name.trim().toLowerCase() === key);
    if (sp && sp.rating !== undefined) {
      if (hp.rating !== sp.rating) { hp.rating = sp.rating; changed = true; }
    }
  });
  if (changed) {
    localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  }
}
function saveAllPlayersState() {
  // Migrate existing players — ensure rating field exists
  schedulerState.allPlayers.forEach(p => {
    if (p.rating === undefined || p.rating === null) p.rating = 1.0;
  });
  localStorage.setItem("schedulerPlayers",  JSON.stringify(schedulerState.allPlayers));
  // Sync ratings back to import history so next session carries updated ratings
  syncRatingsToHistory();
  localStorage.setItem("newImportHistory",  JSON.stringify(newImportState.historyPlayers));
  localStorage.setItem("newImportFavorites",JSON.stringify(newImportState.favoritePlayers));
}

/* =========================
   EDIT PLAYER
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
  checkbox.checked ? card.classList.remove("inactive") : card.classList.add("inactive");
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updateFixedPairSelectors();
}

function toggleGender(index, iconEl) {
  const player = schedulerState.allPlayers[index];
  if (!player) return;
  player.gender = player.gender === "Male" ? "Female" : "Male";
  const genderClass = player.gender.toLowerCase();
  // Update img src if using image avatar, or textContent if emoji
  if (iconEl.tagName === "IMG") {
    iconEl.src = player.gender === "Female" ? "female.png" : "male.png";
  } else {
    iconEl.textContent = getGenderIcon(player.gender);
  }
  iconEl.classList.remove("male", "female");
  iconEl.classList.add(genderClass);
  const card = iconEl.closest(".player-edit-card");
  if (card) { card.classList.remove("male", "female"); card.classList.add(genderClass); }
  updateGenderGroups();
  updateFixedPairSelectors();
  refreshFixedCards();
  saveAllPlayersState();
}

/* =========================
   IMPORT MODAL BRIDGE
========================= */
function showImportModal() {
  const textarea = document.getElementById("players-textarea");
  if (textarea) {
    textarea.value = "";
    textarea.placeholder = translations[currentLang].importExample;
  }
  document.getElementById('importModal').style.display = 'block';
}

function hideImportModal() {
  document.getElementById('newImportModal').style.display = 'none';
}

// OK button — moves selectedPlayers into scheduler
function addPlayersFromInputUI() {
  const importPlayers = newImportState.selectedPlayers;
  if (!importPlayers || importPlayers.length === 0) { alert('No players to add!'); return; }
  const extractedNames = [];
  importPlayers.forEach(p => {
    const name   = p.displayName.trim();
    const gender = p.gender || "Male";
    const nameKey = name.toLowerCase();
    const existing = schedulerState.allPlayers.find(e => e.name.trim().toLowerCase() === nameKey);
    if (
      !existing &&
      !extractedNames.some(e => e.name.trim().toLowerCase() === nameKey)
    ) {
      // Carry rating from history if available, else default 1.0
      const histRating = (typeof p.rating === 'number') ? p.rating : 1.0;
      extractedNames.push({ name, gender, active: true, rating: histRating });
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
   PASTE / TEXT MODAL (legacy)
========================= */
function pastePlayersText() {
  const textarea    = document.getElementById('players-textarea');
  const stopMarkers = [
    /court full/i, /wl/i, /waitlist/i, /late cancel/i,
    /cancelled/i, /reserve/i, /bench/i, /extras/i, /backup/i
  ];
  function cleanText(text) {
    const lines = text.split(/\r?\n/);
    let startIndex = 0, stopIndex = lines.length;
    const confirmIdx = lines.findIndex(l => /confirm/i.test(l));
    if (confirmIdx >= 0) {
      startIndex = confirmIdx + 1;
      for (let i = startIndex; i < lines.length; i++) {
        if (stopMarkers.some(re => re.test(lines[i]))) { stopIndex = i; break; }
      }
    }
    const out = [];
    for (let i = startIndex; i < stopIndex; i++) {
      const l = lines[i].trim();
      if (!l || l.toLowerCase().includes("http")) continue;
      out.push(l);
    }
    return out.join("\n");
  }
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(text => {
        const cleaned = cleanText(text);
        if (!cleaned) { alert("No valid player names found."); return; }
        textarea.value += (textarea.value ? '\n' : '') + cleaned;
        textarea.focus();
      })
      .catch(() => alert('Paste not allowed. Long-press and paste instead.'));
  } else {
    alert('Paste not supported on this device.');
  }
}

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
  const confirmIdx = lines.findIndex(l => /confirm/i.test(l));
  if (confirmIdx >= 0) {
    startIndex = confirmIdx + 1;
    for (let i = startIndex; i < lines.length; i++) {
      if (stopMarkers.some(re => re.test(lines[i]))) { stopIndex = i; break; }
    }
  }
  const genderLookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(l => {
      if (l.male)   genderLookup[l.male.toLowerCase()]   = "Male";
      if (l.female) genderLookup[l.female.toLowerCase()] = "Female";
    });
  }
  const extractedNames = [];
  for (let i = startIndex; i < stopIndex; i++) {
    let line = lines[i].trim();
    if (!line || /https?/i.test(line)) continue;
    let gender = defaultGender;
    const m = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (m) line = m[2].trim();
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }
    const pm = line.match(/\(([^)]+)\)/);
    if (pm) {
      const inside = pm[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }
    if (!line) continue;
    const normalized = line.toLowerCase();
    const exists =
      schedulerState.allPlayers.some(p => p.name.trim().toLowerCase() === normalized) ||
      extractedNames.some(p => p.name.trim().toLowerCase() === normalized);
    if (!exists) extractedNames.push({ name: line, gender, active: true, rating: 1.0 });
  }
  if (!extractedNames.length) return;
  schedulerState.allPlayers.push(...extractedNames);
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active).map(p => p.name).reverse();
  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();
}

/* =========================
   PLAYER LIST RENDERING
========================= */
function createPlayerCard(player, index) {
  let cardClass = `player-edit-card player-row ${player.gender.toLowerCase()}`;
  if (!player.active) cardClass += " inactive";
  const card = document.createElement("div");
  card.className = cardClass;
  card.draggable = true;
  card.dataset.index = index;
  card.addEventListener("dragstart", onDragStart);
  card.addEventListener("dragover",  onDragOver);
  card.addEventListener("drop",      onDrop);
  const genderImg = player.gender === "Female" ? "female.png" : "male.png";
  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox" ${player.active ? "checked" : ""} onchange="toggleActive(${index}, this)">
    </div>
    <div class="pec-col pec-sl">${index + 1}</div>
    <div class="pec-col pec-gender">
      <img src="${genderImg}" class="gender-icon pec-gender-img" onclick="toggleGender(${index}, this)" title="Tap to toggle gender">
    </div>
    <div class="pec-col pec-name" onclick="editPlayerName(${index})">${player.name}</div>
    <div class="pec-col pec-rating">
      <span class="rating-badge">${(player.rating || 1.0).toFixed(1)}</span>
    </div>
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
  const [moved] = schedulerState.allPlayers.splice(draggedIndex, 1);
  schedulerState.allPlayers.splice(targetIndex, 0, moved);
  updatePlayerList();
}

function updatePlayerList() {
  // Migrate: ensure every player has a rating field
  schedulerState.allPlayers.forEach(p => {
    if (p.rating === undefined || p.rating === null) p.rating = 1.0;
  });
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

/* =========================
   COLOUR HELPERS
========================= */
function getPlayedColor(value) {
  if (!value || value <= 0) return "#e0e0e0";
  return `hsl(${(Math.min(value, 20) - 1) * 36}, 92%, 58%)`;
}
function getRestColor(value) {
  if (!value || value <= 0) return "#e0e0e0";
  return `hsl(${((Math.min(value, 20) - 1) * 36 + 180) % 360}, 88%, 62%)`;
}

/* =========================
   TOAST / ALERT
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
   MISC HELPERS
========================= */
function debounce(func, delay = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}


