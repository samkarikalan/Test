/* ============================================================
   IMPORT PLAYERS MODAL
   File: importPlayers.js
   ============================================================ */

/* =========================
   HELPERS
========================= */

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

// Shared gender lookup builder
function buildGenderLookup() {
  const lookup = { male: "Male", m: "Male", female: "Female", f: "Female" };
  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)   lookup[langObj.male.toLowerCase()]   = "Male";
      if (langObj.female) lookup[langObj.female.toLowerCase()] = "Female";
    });
  }
  return lookup;
}

// Parse raw textarea text into [{ displayName, gender }]
function parsePlayerLines(text, defaultGender) {
  const genderLookup = buildGenderLookup();
  const players = [];

  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;

    let gender = defaultGender;

    // Remove leading numbering: "1. John" → "John"
    const numMatch = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (numMatch) line = numMatch[2].trim();

    // "name, gender" format
    if (line.includes(",")) {
      const [name, g] = line.split(",").map(p => p.trim());
      line = name;
      if (g && genderLookup[g.toLowerCase()]) gender = genderLookup[g.toLowerCase()];
    }

    // "name (gender)" format
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;
    addToListIfNotExists(players, { displayName: line, gender });
  }

  return players;
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
  newImportModal         = document.getElementById("newImportModal");
  newImportSelectCards   = document.getElementById("newImportSelectCards");
  newImportSelectedCards = document.getElementById("newImportSelectedCards");
  newImportSelectedCount = document.getElementById("newImportSelectedCount");
  newImportSearch        = document.getElementById("newImportSearch");

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
  syncPlayersFromMaster(); // ensure latest ratings before rendering
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
    listContainer.style.display  = "none";
    addSection.style.display     = "block";
    searchInput.style.display    = "none";
    clearHistory.style.display   = "none";
    clearFavorites.style.display = "none";
    // Use translated placeholder
    const ta = document.getElementById("players-names");
    if (ta && typeof translations !== "undefined" && translations[currentLang]?.importExample) {
      ta.placeholder = translations[currentLang].importExample;
    }
    return;
  }
  // Leaving addplayers tab — reset star toggle state
  newImportResetFavToggle();

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
   VALID PLAYER NAME FILTER
   Strips junk from old paste-import leftovers
========================= */
function isValidPlayerName(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (n.length < 2)   return false;       // too short
  if (n.length > 40)  return false;       // too long (URLs, sentences)
  if (n.startsWith("*")) return false;    // schedule/annotation lines
  if (n.includes("http")) return false;   // URLs
  if (n.includes("www.")) return false;   // URLs
  if (n.includes(".com")) return false;   // URLs
  if (n.includes(".slotbooking")) return false;
  if (/^[\d\s\-:\/]+$/.test(n)) return false;  // pure numbers/dates/times
  return true;
}

/* =========================
   STORAGE — HISTORY
========================= */
function newImportLoadHistory() {
  const data = localStorage.getItem("newImportHistory");
  const raw  = data ? JSON.parse(data) : [];
  // Filter junk, deduplicate, preserve rating as-is from storage
  const cleaned = raw.filter(p => isValidPlayerName(p.displayName));
  const deduped = newImportDeduplicate(cleaned);
  deduped.forEach(hp => {
    if (hp.rating === undefined || hp.rating === null) hp.rating = 1.0;
  });
  newImportState.historyPlayers = deduped;
  // Sync ratings into session players now that history is loaded
  if (typeof syncPlayersFromMaster === 'function') syncPlayersFromMaster();
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
   RENDER — SELECT CARDS
========================= */
function newImportRefreshSelectCards() {
  if (newImportState.currentSelectMode === "addplayers") return;

  newImportSelectCards.innerHTML = "";

  // ── Favorite Sets (top of favorites tab only) ──
  if (newImportState.currentSelectMode === "favorites") {
    const sets = newImportLoadFavoriteSets();
    sets.forEach(set => {
      const safeName = set.name.replace(/'/g, "\\'");
      const setCard  = document.createElement("div");
      setCard.className    = "newImport-set-card";
      setCard.dataset.open = "false";

      setCard.innerHTML = `
        <div class="newImport-set-header">
          <div class="newImport-set-info">
            <span class="newImport-set-icon">★</span>
            <span class="newImport-set-name">${set.name}</span>
            <span class="newImport-set-count">${set.players.length} players</span>
            <span class="newImport-set-chevron">▶</span>
          </div>
          <div class="newImport-set-actions">
            <button class="newImport-set-addall-btn" data-setname="${safeName}">+ All</button>
            <button class="newImport-set-delete-btn" data-setname="${safeName}">×</button>
          </div>
        </div>
        <div class="newImport-set-players" style="display:none">
          ${set.players.map(p => `
            <div class="newImport-set-player-row">
              <img src="${p.gender === 'Male' ? 'male.png' : 'female.png'}"
                class="newImport-set-player-img"
                data-action="set-gender"
                data-setname="${safeName}"
                data-name="${p.displayName.replace(/"/g, '&quot;')}"
                data-gender="${p.gender}"
                title="Tap to toggle gender">
              <span class="newImport-set-player-name">${p.displayName}</span>
              <span class="rating-badge" style="font-size:0.68rem;padding:2px 5px;">${(p.rating || 1.0).toFixed(1)}</span>
              <button class="newImport-set-player-remove-btn"
                data-setname="${safeName}"
                data-name="${p.displayName.replace(/"/g, '&quot;')}">×</button>
              <button class="newImport-set-player-add-btn"
                data-name="${p.displayName.replace(/"/g, '&quot;')}"
                data-gender="${p.gender}">+</button>
            </div>
          `).join("")}
          <div class="newImport-set-addplayer-row">
            <input type="text"
              class="newImport-set-addplayer-input"
              data-setname="${safeName}"
              placeholder="Add player name...">
            <button class="newImport-set-addplayer-btn" data-setname="${safeName}">+</button>
          </div>
        </div>
      `;

      newImportSelectCards.appendChild(setCard);
    });
  }

  // ── Individual players (history / favorites) ──
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
      const nameNorm = p.displayName.trim().toLowerCase();
      // Case-insensitive match for both checks
      const added = newImportState.selectedPlayers.some(sp => sp.displayName.trim().toLowerCase() === nameNorm);
      // In Favorites tab the player is already a favourite by definition — always orange
      const fav = newImportState.currentSelectMode === "favorites"
        ? true
        : newImportState.favoritePlayers.some(fp => fp.displayName.trim().toLowerCase() === nameNorm);

      const card = document.createElement("div");
      card.className = "newImport-player-card";
      const rating1 = (p.rating || 1.0).toFixed(1);
      card.innerHTML = `
        <div class="newImport-player-top">
          <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
               data-action="gender" data-player="${p.displayName}">
          <div class="newImport-player-name">${p.displayName}</div>
        </div>
        <div class="newImport-player-actions">
          <span class="rating-badge">${rating1}</span>
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
   SET CARD CLICK HANDLER
   Handles expand, +All, ×delete, +player
   All via event delegation on newImportSelectCards
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("newImportSelectCards");
  container?.addEventListener("click",   newImportHandleSetClick);
  container?.addEventListener("keydown", newImportHandleSetClick);
});

function newImportHandleSetClick(e) {

  // ── Expand / collapse set ──
  const setInfo = e.target.closest(".newImport-set-info");
  if (setInfo) {
    const setCard  = setInfo.closest(".newImport-set-card");
    const players  = setCard.querySelector(".newImport-set-players");
    const chevron  = setCard.querySelector(".newImport-set-chevron");
    const isOpen   = setCard.dataset.open === "true";
    setCard.dataset.open    = isOpen ? "false" : "true";
    players.style.display   = isOpen ? "none" : "block";
    chevron.textContent     = isOpen ? "▶" : "▼";
    return;
  }

  // ── + All button ──
  if (e.target.matches(".newImport-set-addall-btn")) {
    const setName = e.target.dataset.setname;
    newImportLoadSetToSelected(setName);
    return;
  }

  // ── × Delete set ──
  if (e.target.matches(".newImport-set-delete-btn")) {
    const setName = e.target.dataset.setname;
    newImportDeleteFavoriteSet(setName);
    return;
  }

  // ── Gender toggle for set player ──
  if (e.target.matches(".newImport-set-player-img")) {
    const setName  = e.target.dataset.setname;
    const name     = e.target.dataset.name;
    const sets     = newImportLoadFavoriteSets();
    const set      = sets.find(s => s.name === setName);
    if (!set) return;
    const player   = set.players.find(p => p.displayName === name);
    if (!player) return;
    player.gender  = player.gender === "Male" ? "Female" : "Male";
    newImportSaveFavoriteSets(sets);
    // Update img src immediately without full refresh
    e.target.src           = player.gender === "Male" ? "male.png" : "female.png";
    e.target.dataset.gender = player.gender;
    return;
  }

  // ── + Add new player to set from inline input ──
  if (e.target.matches(".newImport-set-addplayer-btn")) {
    const setName = e.target.dataset.setname;
    const input   = e.target.closest(".newImport-set-addplayer-row")
                      ?.querySelector(".newImport-set-addplayer-input");
    if (!input) return;
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const sets = newImportLoadFavoriteSets();
    const set  = sets.find(s => s.name === setName);
    if (!set) return;
    // Check duplicate within set
    if (set.players.some(p => p.displayName.trim().toLowerCase() === name.toLowerCase())) {
      input.value = "";
      input.placeholder = "Already in set!";
      setTimeout(() => { input.placeholder = "Add player name..."; }, 2000);
      return;
    }
    set.players.push({ displayName: name, gender: "Male" });
    newImportSaveFavoriteSets(sets);
    newImportRefreshSelectCards();
    return;
  }

  // ── Enter key on add-player-to-set input ──
  if (e.target.matches(".newImport-set-addplayer-input") && e.type === "keydown" && e.key === "Enter") {
    e.target.nextElementSibling?.click();
    return;
  }

  // ── × Remove single player from set ──
  if (e.target.matches(".newImport-set-player-remove-btn")) {
    const setName     = e.target.dataset.setname;
    const displayName = e.target.dataset.name;
    const sets        = newImportLoadFavoriteSets();
    const set         = sets.find(s => s.name === setName);
    if (set) {
      set.players = set.players.filter(p => p.displayName !== displayName);
      newImportSaveFavoriteSets(sets);
      newImportRefreshSelectCards();
    }
    return;
  }

  // ── + Add single player from set ──
  if (e.target.matches(".newImport-set-player-add-btn")) {
    const displayName = e.target.dataset.name;
    const gender      = e.target.dataset.gender;
    addToListIfNotExists(newImportState.selectedPlayers, { displayName, gender });
    // Visual feedback
    e.target.textContent = "✓";
    e.target.disabled    = true;
    newImportRefreshSelectedCards();
    return;
  }
}

/* =========================
   CARD ACTIONS (history / favorites individual players)
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

  const playerNameNorm = playerName.trim().toLowerCase();
  const player = source.find(p => p.displayName.trim().toLowerCase() === playerNameNorm);
  if (!player) return;

  // ADD TO SELECTED
  if (action === "add") {
    addToListIfNotExists(newImportState.selectedPlayers, player);
    newImportRefreshSelectedCards();
    newImportRefreshSelectCards();
    return;
  }

  // TOGGLE GENDER
  if (action === "gender") {
    player.gender = player.gender === "Male" ? "Female" : "Male";
    [newImportState.historyPlayers, newImportState.favoritePlayers].forEach(list => {
      const p = list.find(p => p.displayName === player.displayName);
      if (p) p.gender = player.gender;
    });
    localStorage.setItem("newImportHistory",   JSON.stringify(newImportState.historyPlayers));
    localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
    newImportRefreshSelectCards();
    return;
  }

  // TOGGLE FAVORITE
  if (action === "favorite") {
    const i = newImportState.favoritePlayers.findIndex(p => p.displayName.trim().toLowerCase() === player.displayName.trim().toLowerCase());
    if (i >= 0) {
      newImportState.favoritePlayers.splice(i, 1);
    } else {
      addToListIfNotExists(newImportState.favoritePlayers, player);
    }
    newImportSaveFavorites();
    newImportRefreshSelectCards();
    return;
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
    newImportRefreshSelectCards();
  }
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
    const rating2 = (p.rating || 1.0).toFixed(1);
    card.innerHTML = `
      <div class="newImport-player-top">
        <img src="${p.gender === "Male" ? "male.png" : "female.png"}">
        <div class="newImport-player-name">${p.displayName}</div>
      </div>
      <div class="newImport-player-actions">
        <span class="rating-badge">${rating2}</span>
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
   FAVORITE SETS — SAVE INPUT TOGGLE
========================= */
function newImportResetFavToggle() {
  const row  = document.getElementById("newImportFavoriteSetRow");
  const icon = document.getElementById("addPlayerFavToggle");
  if (row)  row.style.display  = "none";
  if (icon) {
    icon.textContent = "☆";
    icon.style.color = "rgba(255,255,255,0.5)";
  }
  newImportState.addToFavOnAdd = false;
}

function newImportToggleAddFav() {
  const row  = document.getElementById("newImportFavoriteSetRow");
  const icon = document.getElementById("addPlayerFavToggle");
  if (!row || !icon) return;

  const isOpen = row.style.display !== "none";

  if (isOpen) {
    // Close — turn star off
    row.style.display            = "none";
    icon.textContent             = "☆";
    icon.style.color             = "rgba(255,255,255,0.5)";
    newImportState.addToFavOnAdd = false;
  } else {
    // Open — turn star on
    row.style.display            = "block";
    icon.textContent             = "★";
    icon.style.color             = "var(--amber)";
    newImportState.addToFavOnAdd = true;
    document.getElementById("newImportSetName")?.focus();
  }
}

function newImportSaveFavoriteSet() {
  const setNameInput = document.getElementById("newImportSetName");
  const setName      = setNameInput.value.trim();
  if (!setName) { setNameInput.focus(); return; }

  const textarea = document.getElementById("players-names");
  const text     = textarea?.value.trim();
  if (!text) { alert("No players in the text area"); return; }

  const defaultGender = document.getElementById("player-gender")?.value || "Male";
  const players = parsePlayerLines(text, defaultGender);
  if (!players.length) { alert("No valid player names found"); return; }

  const sets = newImportLoadFavoriteSets();
  const existingIdx = sets.findIndex(
    s => s.name.trim().toLowerCase() === setName.toLowerCase()
  );
  if (existingIdx >= 0) {
    // Same name exists — ask user to confirm overwrite or pick a new name
    const overwrite = confirm(`A set named "${sets[existingIdx].name}" already exists.\nOverwrite it?`);
    if (!overwrite) {
      setNameInput.focus();
      setNameInput.select();
      return;
    }
    sets[existingIdx].players = players;
  } else {
    sets.push({ name: setName, players });
  }
  newImportSaveFavoriteSets(sets);

  setNameInput.value = "";
  newImportResetFavToggle();
  newImportShowSelectMode("favorites");
}

function newImportDeleteFavoriteSet(setName) {
  if (!confirm(`Delete set "${setName}"?`)) return;
  const sets = newImportLoadFavoriteSets().filter(s => s.name !== setName);
  newImportSaveFavoriteSets(sets);
  newImportRefreshSelectCards();
}

function newImportLoadSetToSelected(setName) {
  const sets = newImportLoadFavoriteSets();
  const set  = sets.find(s => s.name === setName);
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

  const defaultGender    = document.getElementById("player-gender")?.value || "Male";
  const extractedPlayers = parsePlayerLines(text, defaultGender);
  if (!extractedPlayers.length) return;

  extractedPlayers.forEach(player => {
    // Add to selected (unique)
    addToListIfNotExists(newImportState.selectedPlayers, player);

    // Add to history (unique, newest on top) — skip invalid names
    if (isValidPlayerName(player.displayName)) {
      const added = addToListIfNotExists(newImportState.historyPlayers, player);
      if (added) {
        newImportState.historyPlayers.pop();
        newImportState.historyPlayers.unshift({ ...player });
      }
    }
    // Also add to favorites if star toggle is ON
    if (newImportState.addToFavOnAdd) {
      addToListIfNotExists(newImportState.favoritePlayers, player);
    }
  });

  newImportState.historyPlayers = newImportState.historyPlayers.slice(0, 50);
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
  if (newImportState.addToFavOnAdd) {
    newImportSaveFavorites();
  }

  newImportRefreshSelectedCards();
  newImportRefreshSelectCards();

  textarea.value        = "";
  textarea.style.height = "";   // let CSS min-height take over
  textarea.focus();
}

/* =========================
   FINAL IMPORT — OK button
========================= */
function newImportAddPlayers() {
  if (!newImportState.selectedPlayers.length) { alert("No players selected"); return; }
  addPlayersFromInputUI();
}
