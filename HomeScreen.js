/* =============================================
HomeScreen.js
Standalone home screen & session stepper.
Depends on: schedulerState, allRounds (rounds.js)
getMyClub, getMyPlayer (supabase.js)
============================================= */

/* ── State ── */
var _stepCourtsSet = false;
var _navSource = 'home'; // 'home' | 'rounds' -- tracks where Players/Summary was opened from
var _stepPairsSeen = false;
var _homeCurrentStep = 0;

var STEP_DEFS = [
{
icon: '👥',
get title()     { return t('selectPlayersStep'); },
get activeSub() { return t('addAtLeast4Step'); },
doneSub: function() {
var n = schedulerState.activeplayers.length;
return n + ' ' + t('playerSingular') + ' ' + t('playersSelected');
},
isDone: function() { return schedulerState.activeplayers.length >= 4; },
go: function() { homeGo('playersPage', 'tabBtnPlayers'); }
},
{
icon: '🤝',
get title()     { return t('fixedPairsStep'); },
get activeSub() { return t('fixedPairsOptional'); },
doneSub: function() {
var n = schedulerState.fixedPairs.length;
return n ? n + ' ' + (n !== 1 ? t('pairsSet') : t('pairSet')) : t('skippedOptional');
},
isDone: function() { return _stepPairsSeen; },
go: function() { homeGo('fixedPairsPage', 'tabBtnFixedPairs'); }
},
{
icon: '🏟',
get title()     { return t('courtSettings'); },
get activeSub() { return t('setCourtMode'); },
doneSub: function() {
var c = parseInt(document.getElementById('num-courts').textContent) || 1;
var tog = document.getElementById('modeToggle');
var mode = (tog && tog.checked) ? t('competitive') : t('randomMode');
return c + ' ' + (c !== 1 ? t('courtPlural') : t('courtSingle')) + ' · ' + mode;
},
isDone: function() { return _stepCourtsSet; },
go: function() { homeShowCourtsPanel(); }
},
{
icon: '🏸',
get title()     { return t('startRoundsStep'); },
get activeSub() { return t('allSetReady'); },
doneSub: function() { return t('sessionInProgress'); },
isDone: function() { return Array.isArray(allRounds) && allRounds.length > 0; },
go: function() { homeGo('roundsPage', 'tabBtnRounds'); }
}
];

/* ── Show More / Less toggle for organiser home tiles ── */
var _homeMoreExpanded = false;

function homeToggleMoreTiles() {
  _homeMoreExpanded = !_homeMoreExpanded;
  var section = document.getElementById('homeMoreSection');
  var label   = document.getElementById('homeShowMoreLabel');
  if (section) {
    section.classList.toggle('home-more-collapsed', !_homeMoreExpanded);
    section.classList.toggle('home-more-expanded',   _homeMoreExpanded);
  }
  if (label) label.textContent = _homeMoreExpanded ? '‹ Less' : 'More ›';
}

/* ── Show More / Less toggle for viewer home tiles ── */
var _homeMoreExpandedV = false;

function homeToggleMoreTilesV() {
  _homeMoreExpandedV = !_homeMoreExpandedV;
  var section = document.getElementById('homeMoreSectionV');
  var label   = document.getElementById('homeShowMoreLabelV');
  if (section) {
    section.classList.toggle('home-more-collapsed', !_homeMoreExpandedV);
    section.classList.toggle('home-more-expanded',   _homeMoreExpandedV);
  }
  if (label) label.textContent = _homeMoreExpandedV ? '‹ Less' : 'More ›';
}

/* ── Main entry: show home screen ── */
function showHomeScreen() {
  if (typeof qcStop === 'function') qcStop(); // stop QC when leaving a mode
  // Auth guard
  if (typeof authIsLoggedIn === 'function' && !authIsLoggedIn()) {
    if (typeof authShowScreen === 'function') authShowScreen('welcome');
    return;
  }
var homeEl = document.getElementById('homePageOverlay');
if (!homeEl) return;

// Add body class so .top-bar hides
document.body.classList.add('home-open');

homeEl.style.display = 'flex';

// Restore both top bars when back on home
document.querySelectorAll('.home-topbar, .top-bar').forEach(function(b) { b.style.display = ''; });

// Mode + status bar
var isOrganiser = (typeof appMode !== 'undefined') && appMode === 'organiser';
var isVault     = (typeof appMode !== 'undefined') && appMode === 'vault';
var statusBar  = document.getElementById('homeStatusBar');
var statusName = document.getElementById('homeStatusName');
var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;

if (club && club.name) {
var modePrefix = isVault ? '🔑 ' : (isAdmin ? '★ ' : '');
if (statusName) statusName.textContent = modePrefix + club.name;
if (statusBar)  statusBar.classList.remove('disconnected');
} else if (player && player.displayName) {
if (statusName) statusName.textContent = player.displayName;
if (statusBar)  statusBar.classList.remove('disconnected');
} else {
if (statusName) statusName.textContent = t('notConnected') || 'Not connected';
if (statusBar)  statusBar.classList.add('disconnected');
}

// Show correct flow and grids (3 modes: viewer / organiser / vault)
var isVault   = (typeof appMode !== 'undefined') && appMode === 'vault';
var isViewer  = !isOrganiser && !isVault;

var orgFlow    = document.getElementById('homeOrganizerFlow');
var viewFlow   = document.getElementById('homeViewerFlow');
var orgGrid    = document.getElementById('homeOrgGrid');
var viewerGrid = document.getElementById('homeViewerGrid');
var vaultGrid  = document.getElementById('homeVaultGrid');

if (orgFlow)    orgFlow.style.display    = isOrganiser ? '' : 'none';
if (viewFlow)   viewFlow.style.display   = isViewer    ? '' : 'none';
if (orgGrid)    orgGrid.style.display    = isOrganiser ? '' : 'none';
if (viewerGrid) viewerGrid.style.display = isViewer    ? '' : 'none';
if (vaultGrid)  vaultGrid.style.display  = isVault     ? '' : 'none';

// Render My Card content inline on viewer home
if (isViewer && typeof renderMyCard === 'function') renderMyCard();

// Show More button — organiser only; reset to collapsed each time home opens
var showMoreBtn = document.getElementById('homeShowMoreBtn');
var moreSection = document.getElementById('homeMoreSection');
var moreLabel   = document.getElementById('homeShowMoreLabel');
if (showMoreBtn) showMoreBtn.style.display = isOrganiser ? '' : 'none';
if (isOrganiser) {
  _homeMoreExpanded = false;
  if (moreSection) { moreSection.classList.add('home-more-collapsed'); moreSection.classList.remove('home-more-expanded'); }
  if (moreLabel)   moreLabel.textContent = 'More ›';
}

// Show More button — viewer only; reset to collapsed each time home opens
var showMoreBtnV = document.getElementById('homeShowMoreBtnV');
var moreSectionV = document.getElementById('homeMoreSectionV');
var moreLabelV   = document.getElementById('homeShowMoreLabelV');
if (showMoreBtnV) showMoreBtnV.style.display = isViewer ? '' : 'none';
if (isViewer) {
  _homeMoreExpandedV = false;
  if (moreSectionV) { moreSectionV.classList.add('home-more-collapsed'); moreSectionV.classList.remove('home-more-expanded'); }
  if (moreLabelV)   moreLabelV.textContent = 'More ›';
}

if (isOrganiser) homeUpdateStepper();
homeRefreshSummaryTile();
homeRefreshTiles();
homeRefreshJoinClubTile();

// Viewer no-club guidance banner
var viewerBanner = document.getElementById('viewerNoClubBanner');
if (viewerBanner) {
  var hasClub = !!(club && club.id);
  if (isViewer && !hasClub) {
    // No club in localStorage — check server for approved memberships before showing banner
    viewerBanner.style.display = 'none'; // hide while checking
    (async function() {
      try {
        var user = (typeof authGetUser === 'function') ? authGetUser() : null;
        if (user && user.id) {
          var mems = await sbGet('memberships',
            'user_account_id=eq.' + user.id + '&select=club_id,nickname');
          if (mems && mems.length) {
            var clubIds = mems.map(function(m) { return m.club_id; });
            var clubs = await sbGet('clubs', 'id=in.(' + clubIds.join(',') + ')&select=id,name').catch(function(){ return []; });
            var clubMap = {};
            clubs.forEach(function(c) { clubMap[c.id] = c.name; });
            var first = mems[0];
            if (typeof setMyClub === 'function') setMyClub(first.club_id, clubMap[first.club_id] || '');
            if (typeof setMyPlayer === 'function') setMyPlayer({ name: first.nickname, gender: 'Male' });
            // Club found — hide banner, refresh home
            var b = document.getElementById('viewerNoClubBanner');
            if (b) b.style.display = 'none';
            if (typeof homeRefreshTiles === 'function') homeRefreshTiles();
            if (typeof homeRefreshJoinClubTile === 'function') homeRefreshJoinClubTile();
            if (typeof updateModePill === 'function') updateModePill('viewer');
            return;
          }
        }
      } catch(e) {}
      // No memberships found — show the banner
      var b = document.getElementById('viewerNoClubBanner');
      if (b) b.style.display = '';
    })();
  } else {
    viewerBanner.style.display = 'none';
  }
}
// Init subscription and show trial banner
if (typeof subInit === 'function') subInit();
if (typeof subShowTrialBanner === 'function') subShowTrialBanner();
}

/* ── Refresh all tile subtitles with live data ── */
async function homeRefreshTiles() {
var isOrganiser = (typeof appMode !== 'undefined') && appMode === 'organiser';

// ── Vault ──
var club   = (typeof getMyClub   === 'function') ? getMyClub()   : null;
var isAdmin = (typeof isClubAdmin === 'function') ? isClubAdmin() : false;
var vaultSub = document.getElementById('tileSubVault');
if (vaultSub) {
if (club && club.name) {
vaultSub.textContent = club.name + (isAdmin ? ' ' + t('adminRole') : ' ' + t('userRole'));
} else {
vaultSub.textContent = t('notConnected') || 'Not connected';
}
}

// ── Vault -- show/hide no-club state vs tiles ──
var vaultNoClub  = document.getElementById('vaultNoClubState');
var vaultTileGrid = document.getElementById('vaultTileGrid');
var vaultStatusTile = document.getElementById('vaultClubStatusTile');

if (club && club.id) {
// Has club -- show tiles, hide create form
if (vaultNoClub)    vaultNoClub.style.display    = 'none';
if (vaultTileGrid)  vaultTileGrid.style.display  = '';
if (vaultStatusTile) vaultStatusTile.style.display = '';
} else {
// No club -- show create form, hide tiles
if (vaultNoClub)    vaultNoClub.style.display    = '';
if (vaultTileGrid)  vaultTileGrid.style.display  = 'none';
if (vaultStatusTile) vaultStatusTile.style.display = 'none';
}

// ── Vault club status tile ──
var vctName  = document.getElementById('vctName');
var vctBadge = document.getElementById('vctBadge');
var vctDot   = document.getElementById('vctDot');
if (vctName) {
if (club && club.name) {
vctName.textContent = club.name;
if (vctDot) vctDot.style.background = '#2dce89';
if (vctBadge) {
vctBadge.textContent = t('adminBadge') || 'ADMIN';
vctBadge.style.background = '#2dce89';
vctBadge.style.color = '#000';
vctBadge.style.display = '';
}
} else {
vctName.textContent = t('noClubSelected');
if (vctBadge) vctBadge.style.display = 'none';
if (vctDot) vctDot.style.background = '#888';
}
}

// ── Organiser club tile (home-tile style) ──
var orgVctName  = document.getElementById('orgVctName');
var orgVctBadge = document.getElementById('orgVctBadge');
var orgTileIcon = document.getElementById('orgTileIcon');
if (orgVctName) {
if (club && club.name) {
orgVctName.textContent  = club.name;
if (orgVctBadge) orgVctBadge.textContent = '✅ ' + (t('connectClub') || 'Connected');
if (orgTileIcon) orgTileIcon.textContent  = '🏢';
} else {
orgVctName.textContent  = t('clubLabel') || 'Club';
if (orgVctBadge) orgVctBadge.textContent = t('tapConnect');
if (orgTileIcon) orgTileIcon.textContent  = '🏢';
}
}

// ── Vault gradient tiles -- load live stats ──
if (club && club.id) {
homeRefreshVaultTiles(club.id);
}

// ── Players ──
var playersSub = document.getElementById('tileSubPlayers');
if (playersSub) {
if (typeof schedulerState !== 'undefined' && schedulerState.allPlayers) {
var total  = schedulerState.allPlayers.length;
var active = schedulerState.activeplayers.length;
playersSub.textContent = total > 0
? total + ' ' + t('playerPlural') + ' · ' + active + ' ' + t('playersActive')
: 'Add · Remove';
} else {
playersSub.textContent = t('addRemove');
}
}

// ── Fixed Pairs ──
var pairsSub = document.getElementById('tileSubPairs');
if (pairsSub) {
var pairCount = (typeof schedulerState !== 'undefined' && schedulerState.fixedPairs)
? schedulerState.fixedPairs.length : 0;
pairsSub.textContent = pairCount > 0
? pairCount + ' pair' + (pairCount !== 1 ? 's' : '') + ' set'
: t('optional');
}

// ── Settings ──
var settingsSub = document.getElementById('tileSubSettings');
var settingsSubV = document.getElementById('tileSubSettingsV');
var settingsText = '';
if (settingsSub || settingsSubV) {
var theme    = localStorage.getItem('app-theme')    || 'dark';
var fontSize = localStorage.getItem('appFontSize')  || 'medium';
settingsText = (theme.charAt(0).toUpperCase() + theme.slice(1))
+ ' · ' + (fontSize.charAt(0).toUpperCase() + fontSize.slice(1));
if (settingsSub)  settingsSub.textContent  = settingsText;
if (settingsSubV) settingsSubV.textContent = settingsText;
}

// ── My Card tile (organiser grid only — viewer home uses renderMyCard directly) ──
var tileRating  = document.getElementById('homeTileRating');
var tileName    = document.getElementById('homeTileName');
var tileAvatar  = document.getElementById('homeTileAvatar');
var tileIcon    = document.getElementById('homeTileIcon');
var player = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;

function _setMyCardTileBase(name, avatar, icon, rating, p) {
if (!name) return;
if (p) {
if (name)   name.textContent = p.name;
if (avatar) { avatar.src = p.gender === 'Female' ? 'female.png' : 'male.png'; avatar.style.display = 'block'; }
if (icon)   icon.style.display = 'none';
if (rating) rating.textContent = t('loading');
} else {
if (name)   name.textContent = t('myCard');
if (avatar) avatar.style.display = 'none';
if (icon)   { icon.style.display = ''; icon.textContent = '👤'; }
if (rating) rating.textContent = t('notSelected');
}
}
_setMyCardTileBase(tileName, tileAvatar, tileIcon, tileRating, player);

// Auto-fetch rating from all memberships (no live session needed)
if (player) {
(async function() {
try {
var user = (typeof authGetUser === 'function') ? authGetUser() : null;
var bestRating = null;
var bestClubName = null;
var wins = 0, losses = 0;

    if (user) {
      // Use the ACTIVE club specifically, not the highest-rated one
      var activeClub = (typeof getMyClub === 'function') ? getMyClub() : null;
      var mems = await sbGet('memberships',
        'user_account_id=eq.' + user.id +
        '&select=club_id,club_rating,nickname,player_id').catch(function(){ return []; });

      if (mems && mems.length) {
        // Fetch club names separately
        var clubIds = mems.map(function(m){ return m.club_id; });
        var clubRows = await sbGet('clubs', 'id=in.(' + clubIds.join(',') + ')&select=id,name').catch(function(){ return []; });
        var clubMap = {};
        (clubRows || []).forEach(function(c){ clubMap[c.id] = c.name; });

        // Find the active club's membership first, fall back to highest rating
        var activeMem = activeClub && activeClub.id
          ? mems.find(function(m){ return m.club_id === activeClub.id; })
          : null;
        var bestMem = activeMem || mems.reduce(function(best, m) {
          return (!best || parseFloat(m.club_rating) > parseFloat(best.club_rating)) ? m : best;
        }, null);

        bestRating = parseFloat(bestMem.club_rating) || 1.0;
        bestClubName = clubMap[bestMem.club_id] || null;

        // Wins/losses from the linked player record
        var pid = bestMem.player_id;
        if (pid) {
          var prows = await sbGet('players', 'id=eq.' + pid + '&select=wins,losses').catch(function(){ return []; });
          if (prows && prows[0]) {
            wins   = prows[0].wins   || 0;
            losses = prows[0].losses || 0;
          }
        }
      }
    }

    // Fallback to local cache if Supabase gave nothing
    if (bestRating === null) {
      var master = JSON.parse(localStorage.getItem('newImportHistory') || '[]');
      var hp = master.find(function(h) {
        return h.displayName && h.displayName.trim().toLowerCase() === player.name.trim().toLowerCase();
      });
      bestRating = parseFloat(hp && hp.clubRating) || 1.0;
    }

    var label = bestClubName ? bestClubName + '  ·  ' + bestRating.toFixed(1) : 'Club ' + bestRating.toFixed(1);
    if (wins || losses) label += '  ·  ' + t('winsShort') + ':' + wins + ' ' + t('lossesShort') + ':' + losses;

    if (tileRating)  tileRating.textContent  = label;
  } catch(e) {
    if (tileRating)  tileRating.textContent  = t('loading') || 'Tap to view';
  }
})();

}

// ── Dashboard -- async fetch live session count ──
var dashSub  = document.getElementById('tileSubDashboard');
var dashSubV = document.getElementById('tileSubDashboardV');
if (dashSub || dashSubV) {
if (dashSub)  dashSub.textContent  = t('loading');
if (dashSubV) dashSubV.textContent = t('loading');
try {
var sessions = (typeof dbGetLiveSessions === 'function') ? await dbGetLiveSessions() : [];
var count = (sessions || []).length;
var dashText = count > 0
? count + ' ' + t('liveSession') + (count !== 1 ? 's' : '')
: t('noLiveSessions');
if (dashSub)  dashSub.textContent  = dashText;
if (dashSubV) dashSubV.textContent = dashText;
} catch(e) {
if (dashSub)  dashSub.textContent  = t('liveSessions');
if (dashSubV) dashSubV.textContent = t('liveSessions');
}
}
}

/* ── Hide home screen (go to inner page) ── */
function homeHideScreen() {
var homeEl = document.getElementById('homePageOverlay');
if (homeEl) homeEl.style.display = 'none';
document.body.classList.remove('home-open');
}

/* ── Navigate to an inner page ── */
function homeGo(pageId, tabId) {
if (!pageId) return;
homeHideScreen();
_navSource = 'home';
var tabEl = tabId ? document.getElementById(tabId) : null;
showPage(pageId, tabEl);
_updateDynamicBackBtns(pageId);
}

/* ── Return from an inner page (Players/Rounds update stepper) ── */
function homeBack() {
_stepPairsSeen = _stepPairsSeen || (schedulerState.activeplayers.length >= 4);
showHomeScreen();
}

/* ── Update stepper UI ── */
function homeUpdateStepper() {
// Reset courts panel
var panel = document.getElementById('stepCourtsPanel');
var card  = document.getElementById('stepCard');
if (panel) panel.style.display = 'none';
if (card)  card.style.display  = '';

// Determine done state for each step
var done = STEP_DEFS.map(function(s) { return s.isDone(); });

// Current step = first not done; if all done = last
var current = done.indexOf(false);
if (current === -1) current = STEP_DEFS.length - 1;
_homeCurrentStep = current;

// Update each dot
for (var i = 0; i < STEP_DEFS.length; i++) {
var dot = document.getElementById('stepDot' + i);
if (!dot) continue;
dot.classList.remove('s-active', 's-done', 's-locked');
var sn = dot.querySelector('.sn');

if (i < current && done[i]) {
  dot.classList.add('s-done');
  if (sn) sn.textContent = '✓';
} else if (i === current) {
  dot.classList.add('s-active');
  if (sn) sn.textContent = i + 1;
} else {
  dot.classList.add(done[i] ? 's-done' : 's-locked');
  if (sn) sn.textContent = done[i] ? '✓' : (i + 1);
}

// Line after this step
var line = document.getElementById('stepLine' + i);
if (line) line.classList.toggle('s-done', i < current && done[i]);

}

// Update step card
var step = STEP_DEFS[current];
var isDoneCurrent = done[current];

var icon  = document.getElementById('stepCardIcon');
var title = document.getElementById('stepCardTitle');
var sub   = document.getElementById('stepCardSub');
var btn   = document.getElementById('stepCardBtn');

// Map step index to tile color (matches home tile colors)
var stepTileColors = [2, 3, 4, 5];
if (card) card.setAttribute('data-tile-color', stepTileColors[current] || 2);

if (icon)  icon.textContent  = step.icon;
if (title) title.textContent = isDoneCurrent && current === STEP_DEFS.length - 1
? t('sessionActive') : step.title;
if (sub)   sub.textContent   = isDoneCurrent ? step.doneSub() : step.activeSub;

if (btn) {
btn.classList.toggle('btn-done', isDoneCurrent && current === STEP_DEFS.length - 1);
if (current === 1 && isDoneCurrent) {
btn.textContent = t('doneBtn');
} else if (current === 2 && !_stepCourtsSet) {
btn.textContent = t('setUpBtn');
} else if (current === STEP_DEFS.length - 1 && Array.isArray(allRounds) && allRounds.length > 0) {
btn.textContent = t('continueBtn');
} else {
btn.textContent = t('goBtn');
}
}

// Show Skip only on step 2 (Fixed Pairs) when not yet done
var skipBtn = document.getElementById('stepSkipBtn');
if (skipBtn) skipBtn.style.display = (current === 1 && !isDoneCurrent) ? '' : 'none';
}

/* ── Step card button tapped ── */
function stepAction() {
var step = STEP_DEFS[_homeCurrentStep];
if (_homeCurrentStep === 1) _stepPairsSeen = true;
// Reset sessionFinished so Go works after a previous session ended
if (typeof sessionFinished !== 'undefined') sessionFinished = false;
step.go();
}

/* ── Skip Fixed Pairs ── */
function stepSkip() {
_stepPairsSeen = true;
homeUpdateStepper();
}

/* ── Courts panel ── */
function homeShowCourtsPanel() {
var panel = document.getElementById('stepCourtsPanel');
var card  = document.getElementById('stepCard');
if (!panel || !card) return;

// Sync from actual rounds page values
var mainCourts = document.getElementById('num-courts');
var stepCourts = document.getElementById('stepNumCourts');
if (mainCourts && stepCourts) stepCourts.textContent = mainCourts.textContent;

var mainToggle = document.getElementById('modeToggle');
var stepToggle = document.getElementById('stepModeToggle');
if (mainToggle && stepToggle) stepToggle.checked = mainToggle.checked;

card.style.display  = 'none';
panel.style.display = '';
}

function stepCourtAdj(delta) {
var el = document.getElementById('stepNumCourts');
if (!el) return;
var max = Math.max(1, Math.floor(schedulerState.activeplayers.length / 4));
var val = Math.min(max, Math.max(1, (parseInt(el.textContent) || 1) + delta));
el.textContent = val;
// Mirror to rounds page counter
var main = document.getElementById('num-courts');
if (main) main.textContent = val;
}

function stepSyncMode() {
var stepToggle = document.getElementById('stepModeToggle');
var mainToggle = document.getElementById('modeToggle');
if (stepToggle && mainToggle) {
mainToggle.checked = stepToggle.checked;
mainToggle.dispatchEvent(new Event('change'));
}
}

function stepCourtsDone() {
_stepCourtsSet = true;
homeGo('roundsPage', 'tabBtnRounds');
}

/* ── Summary navigation ── */
function homeGoSummary() {
_navSource = 'home';
homeGo('summaryPage', 'tabBtnSummary');
}

function roundsGoSummary() {
_navSource = 'rounds';
homeHideScreen();
showPage('summaryPage', null);
_updateDynamicBackBtns('summaryPage');
}

/* ── Players navigation from Rounds ── */
function roundsGoPlayers() {
_navSource = 'rounds';
homeHideScreen();
showPage('playersPage', null);
_updateDynamicBackBtns('playersPage');
}

function roundsGoFixedPairs() {
_navSource = 'rounds';
homeHideScreen();
showPage('fixedPairsPage', null);
_updateDynamicBackBtns('fixedPairsPage');
}

/* ── Update dynamic back button labels ── keep ✕ always */
function _updateDynamicBackBtns(pageId) {
  // No-op: buttons always show ✕, navBack() handles routing
}

/* ── Back navigation -- goes to correct origin ── */
function navBack() {
if (_navSource === 'rounds') {
  showPage('roundsPage', null);
} else if (_navSource === 'settings') {
  showPage('settingsPage', null);
} else {
  showHomeScreen();
}
}

/* ── Refresh Summary tile -- always active since it fetches from Supabase ── */
function homeRefreshSummaryTile() {
document.querySelectorAll('.home-tile-summary').forEach(function(tile) {
tile.style.opacity       = '1';
tile.style.pointerEvents = '';
});
}

/* Language is now handled in Settings page */
function homeLangToggle() {}
function homeLangSelect() {}

/* ══════════════════════════════════════════════
JOIN CLUB PAGE -- Viewer mode tile & full page
══════════════════════════════════════════════ */

/* Called every time home screen opens -- show/hide tile, refresh status */
async function vclSetActiveClub(clubId, clubName) {
if (typeof setMyClub === 'function') setMyClub(clubId, clubName);
localStorage.setItem('kbrr_club_mode', 'user');
// Sync players from the newly active club
if (typeof syncToLocal === 'function') syncToLocal();
// Refresh join club tile first to re-render active highlight immediately
await homeRefreshJoinClubTile();
// Then refresh full home screen -- updates My Card rating to active club
if (typeof homeRefreshScreen === 'function') await homeRefreshScreen();
// Also update profile button in top bar
if (typeof updateProfileBtn === 'function') updateProfileBtn();
}

/* ── QC dot indicators ── */
function viewerQCAddDots() {
  var configs = [
    { elId: 'myCardQC',  sel: '[onclick*="myCardPage"]' },
    { elId: 'dashQC',    sel: '[onclick*="dashboardPage"]' },
    { elId: 'clubsQC',   sel: '#joinClubTileRow' },
    { elId: 'reportQC',  sel: '[onclick*="vaultReport2Page"]' },
  ];
  configs.forEach(function(d) {
    if (document.getElementById(d.elId)) return;
    var tile = document.querySelector(d.sel);
    if (!tile) return;
    tile.style.position = 'relative';
    var dot = document.createElement('div');
    dot.id = d.elId;
    dot.style.cssText = 'position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;display:none;z-index:10;';
    tile.appendChild(dot);
  });
}

async function homeRefreshJoinClubTile() {
var sub     = document.getElementById('tileSubJoinClub');
var listEl  = document.getElementById('vcl-list-inner');
if (!sub) return;

var user = (typeof authGetUser === 'function') ? authGetUser() : null;
if (user) {
try {
var memberships = await sbGet('memberships',
'user_account_id=eq.' + user.id + '&select=club_id,nickname');
var pending = await sbGet('club_join_requests',
'user_account_id=eq.' + user.id + '&status=eq.pending&select=club_id').catch(function(){ return []; });
var pendingIds = (pending || []).map(function(p){ return p.club_id; });

  var allIds = [...new Set([
    ...(memberships||[]).map(function(m){ return m.club_id; }),
    ...pendingIds
  ])];

  if (allIds.length) {
    var clubRows = await sbGet('clubs', 'id=in.(' + allIds.join(',') + ')&select=id,name').catch(function(){ return []; });
    var clubMap = {};
    clubRows.forEach(function(c){ clubMap[c.id] = c.name; });

    // Subtitle: all club names joined by ·
    var memCount = (memberships||[]).length;
    var pendCount = pendingIds.filter(function(id){ return !(memberships||[]).find(function(m){ return m.club_id===id; }); }).length;
    if (memCount > 0) {
      sub.textContent = memCount + ' club' + (memCount !== 1 ? 's' : '') + (pendCount > 0 ? ' · ' + pendCount + ' pending' : '');
    } else if (pendCount > 0) {
      sub.textContent = pendCount + ' pending · Tap to view';
    } else {
      sub.textContent = 'Join or view your clubs';
    }

    // Inline list (max 10)
    if (listEl) {
      var activeClubId = (typeof getMyClub === 'function') ? (getMyClub().id || null) : null;
      var items = [];
      (memberships||[]).slice(0,10).forEach(function(m) {
        items.push({ id: m.club_id, name: clubMap[m.club_id]||m.club_id, nick: m.nickname, pending: false });
      });
      pendingIds.filter(function(id){ return !(memberships||[]).find(function(m){ return m.club_id===id; }); })
        .slice(0, 10 - items.length).forEach(function(id) {
          items.push({ id: id, name: clubMap[id]||id, nick: null, pending: true });
        });

      if (listEl) listEl.innerHTML = '';
    }
    return;
  }
} catch(e) { /* offline -- fall through */ }

}

// Fallback
if (listEl) listEl.innerHTML = '';
var pending = localStorage.getItem('kbrr_pending_club_name');
if (pending) { sub.textContent = t('pendingPrefix') + pending; return; }
sub.textContent = t('findRequest');
}

/* ── Join Club Page -- initialise when page opens ── */
async function joinClubPageOpen() {
// Reset search + feedback
var searchInput = document.getElementById('joinClubPageSearch');
if (searchInput) searchInput.value = '';
var results = document.getElementById('joinClubPageResults');
if (results) { results.style.display = 'none'; results.innerHTML = ''; }
var errEl = document.getElementById('joinClubPageError');
if (errEl) errEl.style.display = 'none';
var fbEl = document.getElementById('joinClubPageFeedback');
if (fbEl) fbEl.style.display = 'none';
var nickEl = document.getElementById('joinClubNicknameSection');
if (nickEl) nickEl.style.display = 'none';
var nickEntryEl = document.getElementById('joinClubNicknameEntrySection');
if (nickEntryEl) nickEntryEl.style.display = 'none';
var pwEl = document.getElementById('joinClubPasswordSection');
if (pwEl) pwEl.style.display = 'none';

// Load all my clubs
await _renderMyClubsList();
}

function jcActivateClub(row) {
  var id   = row.getAttribute('data-cid');
  var name = row.getAttribute('data-cname');
  if (!id) return;
  // Update all rows instantly
  document.querySelectorAll('.jc-club-item').forEach(function(r) {
    var rid         = r.getAttribute('data-cid');
    var isNowActive = rid === id;
    var badge       = r.querySelector('.jc-club-badge');
    r.querySelector('.jc-club-icon').textContent = isNowActive ? '✅' : '🏸';
    if (badge) {
      badge.style.background = '';
      badge.style.color = '';
      badge.className = isNowActive ? 'jc-club-badge jc-badge-active' : 'jc-club-badge jc-badge-member';
      badge.textContent = isNowActive ? (t('active')||'Active') : (t('badgeMember')||'Member');
    }
    if (isNowActive) { r.removeAttribute('onclick'); r.style.cursor = ''; }
    else { r.setAttribute('onclick', 'jcActivateClub(this)'); r.style.cursor = 'pointer'; }
  });
  if (typeof vclSetActiveClub === 'function') vclSetActiveClub(id, name);
}

async function _renderMyClubsList() {
var inner = document.getElementById('myClubsListInner');
if (!inner) return;
inner.innerHTML = '<div class="jc-empty">Loading...</div>';

var user = (typeof authGetUser === 'function') ? authGetUser() : null;
if (!user) {
inner.innerHTML = '<div class="jc-empty">' + t('loginToSeeClubs') + '</div>';
return;
}

try {
// Get all memberships for this user
var memberships = await sbGet('memberships',
'user_account_id=eq.' + user.id + '&select=club_id,nickname');

// Also check pending requests
var pending = await sbGet('club_join_requests',
  'user_account_id=eq.' + user.id + '&status=eq.pending&select=club_id').catch(function(){ return []; });
var pendingIds = (pending || []).map(function(p){ return p.club_id; });

if ((!memberships || !memberships.length) && !pendingIds.length) {
  inner.innerHTML = '<div class="jc-empty">' + t('noClubsYetSearch') + '</div>';
  return;
}

// Fetch club names
var allIds = [...new Set([
  ...(memberships||[]).map(function(m){ return m.club_id; }),
  ...pendingIds
])];
var clubs = allIds.length
  ? await sbGet('clubs', 'id=in.(' + allIds.join(',') + ')&select=id,name').catch(function(){ return []; })
  : [];
var clubMap = {};
clubs.forEach(function(c){ clubMap[c.id] = c.name; });

var activeClubId2 = (typeof getMyClub === 'function') ? ((getMyClub()||{}).id||null) : null;
var html = '';

// Member clubs — tick on active, tap others to activate
(memberships || []).forEach(function(m) {
  var cname    = clubMap[m.club_id] || m.club_id;
  var isActive = m.club_id === activeClubId2;
  var icon     = isActive ? '✅' : '🏸';
  var badge    = isActive
    ? '<span class="jc-club-badge jc-badge-active">' + (t('active')||'Active') + '</span>'
    : '<span class="jc-club-badge jc-badge-member">' + t('badgeMember') + '</span>';
  html += '<div class="jc-club-row jc-club-item"' +
    (isActive ? '' : ' style="cursor:pointer;" onclick="jcActivateClub(this)"') +
    ' data-cid="' + m.club_id + '" data-cname="' + cname.replace(/"/g,'&quot;') + '">' +
    '<div class="jc-club-icon">' + icon + '</div>' +
    '<div class="jc-club-info">' +
      '<div class="jc-club-name">' + cname + '</div>' +
      '<div class="jc-club-nick">' + t('asNick') + ' ' + m.nickname + '</div>' +
    '</div>' +
    badge +
  '</div>';
});

// Pending clubs
pendingIds.forEach(function(cid) {
  if ((memberships||[]).find(function(m){ return m.club_id === cid; })) return; // already shown
  var cname = clubMap[cid] || cid;
  html += '<div class="jc-club-row">' +
    '<div class="jc-club-icon">⏳</div>' +
    '<div class="jc-club-info">' +
      '<div class="jc-club-name">' + cname + '</div>' +
      '<div class="jc-club-nick">' + t('requestPendingText') + '</div>' +
    '</div>' +
    '<span class="jc-club-pending">' + t('badgePending') + '</span>' +
  '</div>';
});

inner.innerHTML = html || '<div class="jc-empty">' + t('noClubsYet') + '</div>';

} catch(e) {
inner.innerHTML = '<div class="jc-empty">' + t('couldNotLoadClubs') + '</div>';
}
}

function _joinClubShowStatus(state, clubName) {
var icon  = document.getElementById('joinClubStatusIcon');
var title = document.getElementById('joinClubStatusTitle');
var msg   = document.getElementById('joinClubStatusMsg');
var leave = document.getElementById('joinClubLeaveBtn');
var card  = document.getElementById('joinClubStatusCard');

if (state === 'joined') {
if (icon)  icon.textContent  = '✅';
if (title) title.textContent = t('joined') + ': ' + clubName;
if (msg)   msg.textContent   = t('memberMsg') || 'You are a member of this club.';
if (leave) leave.style.display = '';
if (card)  card.style.borderColor = '#2dce89';
} else if (state === 'pending') {
if (icon)  icon.textContent  = '⏳';
if (title) title.textContent = t('requestPending');
if (msg)   msg.textContent   = t('yourRequestToJoin') + ' "' + clubName + '" ' + t('awaitingApproval');
if (leave) leave.style.display = '';
if (card)  card.style.borderColor = '#e6a817';
}
}

/* ── Search clubs as user types ── */
var _joinClubSearchTimer = null;
function joinClubPageSearchUI(query) {
clearTimeout(_joinClubSearchTimer);
var errEl = document.getElementById('joinClubPageError');
if (errEl) errEl.style.display = 'none';
var fbEl = document.getElementById('joinClubPageFeedback');
if (fbEl) fbEl.style.display = 'none';

if (!query || (query.trim().length < 2 && query.trim() !== '*')) {
var r = document.getElementById('joinClubPageResults');
if (r) { r.style.display = 'none'; r.innerHTML = ''; }
return;
}
_joinClubSearchTimer = setTimeout(function() { _joinClubDoSearch(query); }, 350);
}

async function _joinClubDoSearch(query) {
var resultsEl = document.getElementById('joinClubPageResults');
var errEl     = document.getElementById('joinClubPageError');
if (!resultsEl) return;

resultsEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:0.85rem;">' + t('searching') + '</div>';
resultsEl.style.display = '';

var result = (typeof authSearchClubs === 'function') ? await authSearchClubs(query) : { clubs: [] };

if (result.error) {
resultsEl.style.display = 'none';
if (errEl) { errEl.textContent = result.error; errEl.style.display = ''; }
return;
}

var clubs = result.clubs || [];
if (!clubs.length) {
resultsEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--muted);font-size:0.85rem;">' + t('noClubsFoundFor') + ' "' + query + '"</div>';
return;
}

resultsEl.innerHTML = clubs.map(function(c) {
return '<div onclick="joinClubShowNicknameEntry(\'' + c.id + '\',\'' + c.name.replace(/\'/g, "\\'") + '\')" class="jc-club-row" style="cursor:pointer;justify-content:space-between;">' +
'<div><div class="jc-club-name">' + c.name + '</div></div>' +
'<span style="color:var(--accent,#6c63ff);font-size:0.82rem;font-weight:600;">' + t('requestToJoin') + '</span>' +
'</div>';
}).join('');
}

/* ── Stores clubId/Name while user picks a new nickname ── */
var _pendingJoinClubId       = null;
var _pendingJoinClubName     = null;
var _pendingJoinNickname     = null;

/* ── Step 1: Show nickname entry after tapping Request to Join ── */
function joinClubShowNicknameEntry(clubId, clubName) {
  if (typeof isDemoMode === 'function' && isDemoMode()) {
    alert('🎮 Joining clubs is not available in demo mode.\n\nSign up free to join and manage your own clubs!');
    return;
  }
  _pendingJoinClubId   = clubId;
  _pendingJoinClubName = clubName;

  // Hide results, show nickname entry
  var resultsEl = document.getElementById('joinClubPageResults');
  if (resultsEl) resultsEl.style.display = 'none';

  // Reset all other sections
  ['joinClubPasswordSection','joinClubNicknameSection','joinClubNicknameEntrySection','joinClubPageFeedback','joinClubPageError'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  var section = document.getElementById('joinClubNicknameEntrySection');
  var msg     = document.getElementById('joinClubNicknameEntryMsg');
  var input   = document.getElementById('joinClubNicknameEntryInput');

  // Pre-fill with user's account nickname as default
  var _defaultNick = '';
  var _u = (typeof authGetUser === 'function') ? authGetUser() : null;
  if (_u && _u.nickname) _defaultNick = _u.nickname;
  if (!_defaultNick) { var _p = (typeof getMyPlayer === 'function') ? getMyPlayer() : null; if (_p && _p.name) _defaultNick = _p.name; }

  if (msg) { msg.textContent = 'Enter your nickname for "' + clubName + '":'; msg.style.color = ''; }
  if (input) { input.value = _defaultNick; setTimeout(function(){ input.focus(); input.select(); }, 100); }
  if (section) section.style.display = '';
}

/* ── Step 2: User submitted nickname — proceed with join request ── */
function joinClubSubmitNicknameEntry() {
  var input   = document.getElementById('joinClubNicknameEntryInput');
  var errEl   = document.getElementById('joinClubPageError');
  var section = document.getElementById('joinClubNicknameEntrySection');
  var nickname = input ? input.value.trim() : '';

  if (!nickname) {
    // Show error inside entry section, not the global error element
    var entryMsg = document.getElementById('joinClubNicknameEntryMsg');
    if (entryMsg) { entryMsg.textContent = 'Please enter your nickname.'; entryMsg.style.color = '#e63757'; }
    if (input) input.focus();
    return;
  }

  if (section) section.style.display = 'none';
  joinClubPageRequest(_pendingJoinClubId, _pendingJoinClubName, nickname);
}

async function joinClubPageRequest(clubId, clubName, customNickname) {
if (typeof isDemoMode === 'function' && isDemoMode()) {
  alert('🎮 Joining clubs is not available in demo mode.\n\nSign up free to join and manage your own clubs!');
  return;
}
var fbEl      = document.getElementById('joinClubPageFeedback');
var fbIcon    = document.getElementById('joinClubPageFeedbackIcon');
var fbTitle   = document.getElementById('joinClubPageFeedbackTitle');
var fbMsg     = document.getElementById('joinClubPageFeedbackMsg');
var resultsEl = document.getElementById('joinClubPageResults');
var errEl     = document.getElementById('joinClubPageError');
var nickEl    = document.getElementById('joinClubNicknameSection');

if (errEl) errEl.style.display = 'none';
if (nickEl) nickEl.style.display = 'none';
var nickEntrySectionReset = document.getElementById('joinClubNicknameEntrySection');
if (nickEntrySectionReset) nickEntrySectionReset.style.display = 'none';
var pwSectionReset = document.getElementById('joinClubPasswordSection');
if (pwSectionReset) pwSectionReset.style.display = 'none';

// Show loading
if (fbEl) {
if (fbIcon)  fbIcon.textContent  = '⏳';
if (fbTitle) fbTitle.textContent = t('checking');
if (fbMsg)   fbMsg.textContent   = '';
fbEl.style.display = '';
}
if (resultsEl) resultsEl.style.display = 'none';

var result = (typeof authRequestJoin === 'function')
? await authRequestJoin(clubId, customNickname)
: { error: t('notAvailable') };

if (result.alreadyMember) {
_joinClubShowStatus('joined', clubName);
document.getElementById('joinClubStatusCard').style.display = '';
document.getElementById('joinClubSearchSection').style.display = 'none';
if (fbEl) fbEl.style.display = 'none';
homeRefreshJoinClubTile();
return;
}

if (result.autoLinked) {
if (typeof setMyClub === 'function') setMyClub(result.clubId, result.clubName);
if (typeof setMyPlayer === 'function') setMyPlayer({ name: result.nickname, gender: 'Male' });
if (fbEl) {
if (fbIcon)  fbIcon.textContent  = '✅';
if (fbTitle) fbTitle.textContent = t('joined') + ' ' + result.clubName;
if (fbMsg)   fbMsg.textContent   = t('welcomeBack') + ', ' + result.nickname + '!';
fbEl.style.display = '';
}
homeRefreshJoinClubTile();
_renderMyClubsList();
return;
}

if (result.needsPassword) {
// Unclaimed player found -- ask for default password to verify identity
if (fbEl) fbEl.style.display = 'none';
_pendingJoinClubId   = clubId;
_pendingJoinClubName = clubName;
_pendingJoinNickname = result.conflictNickname;
var pwSection = document.getElementById('joinClubPasswordSection');
var pwMsg     = document.getElementById('joinClubPasswordMsg');
var pwInput   = document.getElementById('joinClubPasswordInput');
if (nickEl) nickEl.style.display = 'none';
if (pwMsg) pwMsg.textContent = '"' + result.conflictNickname + '" ' + (t('foundInClub') || 'found in') + ' ' + clubName + '. ' + (t('enterDefaultPwClaim') || 'Enter your default password to join:');
if (pwInput) pwInput.value = '';
if (pwSection) pwSection.style.display = '';
return;
}

if (result.nicknameConflict) {
// Nickname truly taken by someone else -- ask for different nickname
if (fbEl) fbEl.style.display = 'none';
_pendingJoinClubId   = clubId;
_pendingJoinClubName = clubName;
var pwSection2 = document.getElementById('joinClubPasswordSection');
if (pwSection2) pwSection2.style.display = 'none';
if (nickEl) {
var msgEl  = document.getElementById('joinClubNicknameMsg');
var inputEl = document.getElementById('joinClubNicknameInput');
if (msgEl)  msgEl.textContent = '"' + result.conflictNickname + '" ' + t('alreadyTaken') + ' ' + clubName + '. ' + t('chooseDifferentNickname') + ':';
if (inputEl) inputEl.value = '';
nickEl.style.display = '';
}
return;
}

if (result.pending || result.success) {
localStorage.setItem('kbrr_pending_club_id',   clubId);
localStorage.setItem('kbrr_pending_club_name', clubName);
if (fbIcon)  fbIcon.textContent  = '⏳';
if (fbTitle) fbTitle.textContent = t('requestSentTitle');
if (fbMsg)   fbMsg.textContent   = t('waitingAdminApproval');
homeRefreshJoinClubTile();
return;
}

if (result.error) {
if (fbEl) fbEl.style.display = 'none';
if (resultsEl) resultsEl.style.display = '';
if (errEl) { errEl.textContent = result.error; errEl.style.display = ''; }
}
}

/* ── Called when user submits their chosen nickname ── */
function joinClubSubmitNickname() {
var inputEl = document.getElementById('joinClubNicknameInput');
var nickname = inputEl ? inputEl.value.trim() : '';
if (!nickname) {
var errEl = document.getElementById('joinClubPageError');
if (errEl) { errEl.textContent = t('nicknameNotFound') || 'Please enter a nickname.'; errEl.style.display = ''; }
return;
}
joinClubPageRequest(_pendingJoinClubId, _pendingJoinClubName, nickname);
}

/* ── Called when user submits default password to claim their player ── */
async function joinClubSubmitPassword() {
var pwInput = document.getElementById('joinClubPasswordInput');
var errEl   = document.getElementById('joinClubPageError');
var password = pwInput ? pwInput.value.trim() : '';

if (!password) {
if (errEl) { errEl.textContent = t('enterPasswordHint'); errEl.style.display = ''; }
return;
}

var fbEl    = document.getElementById('joinClubPageFeedback');
var fbIcon  = document.getElementById('joinClubPageFeedbackIcon');
var fbTitle = document.getElementById('joinClubPageFeedbackTitle');
var fbMsg   = document.getElementById('joinClubPageFeedbackMsg');
var pwSection = document.getElementById('joinClubPasswordSection');

if (fbIcon)  fbIcon.textContent  = '⏳';
if (fbTitle) fbTitle.textContent = t('checking');
if (fbMsg)   fbMsg.textContent   = '';
if (fbEl)    fbEl.style.display  = '';
if (pwSection) pwSection.style.display = 'none';

var result = (typeof authClaimAndJoin === 'function')
? await authClaimAndJoin(_pendingJoinClubId, _pendingJoinNickname, password)
: { error: t('notAvailable') };

if (result.success) {
if (typeof setMyClub === 'function') setMyClub(result.clubId, result.clubName);
if (typeof setMyPlayer === 'function') setMyPlayer({ name: result.nickname, gender: 'Male' });
if (fbIcon)  fbIcon.textContent  = '✅';
if (fbTitle) fbTitle.textContent = t('joined') + ' ' + result.clubName;
if (fbMsg)   fbMsg.textContent   = t('welcomeBack') + ', ' + result.nickname + '!';
homeRefreshJoinClubTile();
_renderMyClubsList();
return;
}

// Error -- show password section again
if (pwSection) pwSection.style.display = '';
if (fbEl) fbEl.style.display = 'none';
if (errEl) { errEl.textContent = result.error; errEl.style.display = ''; }
}

/* ── Leave club ── */
async function joinClubLeave() {
if (!confirm(t('leaveClubConfirm'))) return;

var pendingClubId = localStorage.getItem('kbrr_pending_club_id');
var myClub = (typeof getMyClub === 'function') ? getMyClub() : null;
var clubId = (myClub && myClub.id) || pendingClubId;
var user   = (typeof authGetUser === 'function') ? authGetUser() : null;

// Delete from DB: player row and join request
if (clubId && user) {
try {
// Delete player row for this user in this club
await sbDelete('memberships', 'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
} catch(e) { /* silent */ }
try {
// Delete join request so it doesn't restore on next login
await sbDelete('club_join_requests', 'club_id=eq.' + clubId + '&user_account_id=eq.' + user.id);
} catch(e) { /* silent */ }
}

// Clear localStorage
localStorage.removeItem('kbrr_pending_club_id');
localStorage.removeItem('kbrr_pending_club_name');
localStorage.removeItem('kbrr_cache_players');
localStorage.removeItem('kbrr_cache_ts');
if (typeof clearMyClub === 'function') clearMyClub();
else {
localStorage.removeItem('kbrr_my_club_id');
localStorage.removeItem('kbrr_my_club_name');
}

// Reset page view
document.getElementById('joinClubStatusCard').style.display = 'none';
document.getElementById('joinClubSearchSection').style.display = '';
homeRefreshJoinClubTile();
}

/* ── Load live stats into vault gradient tiles ── */
async function homeRefreshVaultTiles(clubId) {
try {
// Playing count
var playing = await sbGet('memberships', 'club_id=eq.' + clubId + '&is_playing=eq.true&select=id').catch(() => []);
var playingCount = (playing || []).length;
var vtBadgePlaying = document.getElementById('vtBadgePlaying');
if (vtBadgePlaying) vtBadgePlaying.style.display = playingCount > 0 ? '' : 'none';
var tileSubPlaying = document.getElementById('tileSubPlaying');
if (tileSubPlaying) tileSubPlaying.textContent = playingCount + ' ' + t('playersActive');

// Total players (register + modify share same count)
var members = await sbGet('memberships', 'club_id=eq.' + clubId + '&select=id').catch(() => []);
var memberCount = (members || []).length;
var vtRegister = document.getElementById('vtStatRegister');
if (vtRegister) vtRegister.textContent = memberCount;
var vtModify = document.getElementById('vtStatModify');
if (vtModify) vtModify.textContent = memberCount;

// Pending requests
var requests = await sbGet('club_join_requests', 'club_id=eq.' + clubId + '&status=eq.pending&select=id').catch(() => []);
var reqCount = (requests || []).length;
var vtRequests = document.getElementById('vtStatRequests');
if (vtRequests) vtRequests.textContent = reqCount;
var vtBadgeReq = document.getElementById('vtBadgeRequests');
if (vtBadgeReq) vtBadgeReq.style.display = reqCount > 0 ? '' : 'none';

} catch(e) { /* silent */ }
}

/* ── Quick Create Club from Vault home (first time user) ── */
async function vaultQuickCreateClub() {
var name    = (document.getElementById('vaultQuickClubName')?.value || '').trim();
var memberPw = (document.getElementById('vaultQuickMemberPw')?.value || '').trim();
var adminPw  = (document.getElementById('vaultQuickAdminPw')?.value || '').trim();
var fb = document.getElementById('vaultQuickFeedback');
var setFb = function(msg, ok) {
if (fb) { fb.textContent = msg; fb.style.color = ok ? 'var(-green,#2dce89)' : 'var(-red,#e63757)'; }
};

if (!name)    { setFb(t('enterClubName'), false); return; }
if (!memberPw) { setFb(t('enterMemberPw'), false); return; }
if (!adminPw)  { setFb(t('enterAdminPw'), false); return; }
if (memberPw === adminPw) { setFb(t('memberAdminDiff'), false); return; }

setFb(t('creatingClub'), true);
try {
var club = await dbAddClub(name, memberPw, adminPw);
if (typeof setMyClub  === 'function') setMyClub(club.id, club.name);
localStorage.setItem('kbrr_club_mode', 'admin');
setFb('✅ ' + club.name + ' created!', true);
// Clear fields
document.getElementById('vaultQuickClubName').value  = '';
document.getElementById('vaultQuickMemberPw').value  = '';
document.getElementById('vaultQuickAdminPw').value   = '';
// Refresh home to show vault tiles
// Set vault mode so pill shows correctly
if (typeof appMode !== 'undefined') appMode = 'vault';
sessionStorage.setItem('appMode', 'vault');
localStorage.setItem('kbrr_app_mode', 'vault');
if (typeof updateModePill === 'function') updateModePill('vault');
setTimeout(function() { homeRefreshTiles(); showHomeScreen(); }, 600);
} catch(e) {
setFb('❌ ' + e.message, false);
}
}

/* ── Vault -- Leave/Logout Club ── */
function vaultLogoutClub() {
if (!confirm(t('leaveVaultConfirm'))) return;
// Clear only vault-specific state
localStorage.removeItem('kbrr_vault_club_id');
localStorage.removeItem('kbrr_vault_club_name');
localStorage.removeItem('kbrr_club_mode');
localStorage.removeItem('kbrr_club_trusted');
sessionStorage.removeItem('scs_vault_verified');
localStorage.removeItem('scs_vault_verified');
// If current active club was vault's club, also clear shared club
var vaultId = localStorage.getItem('kbrr_vault_club_id');
if (!vaultId) {
  // already removed above, clear shared if it was vault's
  if (typeof clearMyClub === 'function') clearMyClub();
}
if (typeof vaultSyncStatus === 'function') vaultSyncStatus();
// Go to mode selector front page
var overlay = document.getElementById('modeSelectOverlay');
if (overlay) {
if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay();
overlay.style.display = 'flex';
}
}

function organiserLogoutClub() {
if (typeof isDemoMode === 'function' && isDemoMode()) {
  alert('🎮 You cannot leave the organiser in demo mode.\n\nSign up free to manage your own clubs!');
  return;
}
if (!confirm(t('leaveOrganiserConfirm'))) return;
// Clear only organiser-specific state
localStorage.removeItem('kbrr_org_club_id');
localStorage.removeItem('kbrr_org_club_name');
sessionStorage.removeItem('scs_organiser_verified');
localStorage.removeItem('scs_organiser_verified');
// Go to mode selector front page
var overlay = document.getElementById('modeSelectOverlay');
if (overlay) {
if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay();
overlay.style.display = 'flex';
}
}

/* ── Club Management -- show panel by tile tap ── */
function clubMgmtShowPanel(panel) {
['connect','create','delete'].forEach(function(p) {
var el = document.getElementById('clubMgmt' + p.charAt(0).toUpperCase() + p.slice(1) + 'Panel');
if (el) el.style.display = p === panel ? '' : 'none';
});
// Load clubs for connect panel
if (panel === 'connect' && typeof viewerLoadClubs === 'function') viewerLoadClubs();
// Load clubs for delete panel
if (panel === 'delete' && typeof sbPopulateDeleteDropdown === 'function') sbPopulateDeleteDropdown();
}

/* ══════════════════════════════════════════════════════════
   VIEWER NO-CLUB OVERLAY — vncb* functions
   Full-screen join flow shown to first-time viewer with no club
   Reuses same backend logic as joinClubPage but independent IDs
   ══════════════════════════════════════════════════════════ */

var _vncbPendingClubId   = null;
var _vncbPendingClubName = null;
var _vncbPendingNickname = null;
var _vncbSearchTimer     = null;

function vncbSearchUI(query) {
  var resultsEl = document.getElementById('vncbResults');
  var errorEl   = document.getElementById('vncbError');
  if (errorEl)   errorEl.style.display = 'none';
  // Reset steps
  ['vncbNicknameSection','vncbPasswordSection','vncbNicknameAltSection','vncbFeedback'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  _vncbPendingClubId = null; _vncbPendingClubName = null;

  if (!query || query.trim().length < 1) {
    if (resultsEl) resultsEl.style.display = 'none';
    return;
  }
  clearTimeout(_vncbSearchTimer);
  _vncbSearchTimer = setTimeout(function() { _vncbDoSearch(query.trim()); }, 350);
}

async function _vncbDoSearch(query) {
  var resultsEl = document.getElementById('vncbResults');
  var errorEl   = document.getElementById('vncbError');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div style="padding:12px 14px;font-size:0.82rem;color:var(--muted);">Searching...</div>';
  resultsEl.style.display = '';
  try {
    var clubs = await sbGet('clubs', 'select=id,name&order=name.asc');
    var q = query.toLowerCase();
    var matched = (clubs || []).filter(function(c) { return c.name && c.name.toLowerCase().includes(q); });
    if (!matched.length) {
      resultsEl.innerHTML = '<div style="padding:12px 14px;font-size:0.82rem;color:var(--muted);">No clubs found for "' + query + '"</div>';
      return;
    }
    resultsEl.innerHTML = matched.map(function(c) {
      return '<div onclick="vncbSelectClub(\'' + c.id + '\',\'' + c.name.replace(/'/g,"&#39;") + '\')" ' +
        'style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);transition:background 0.12s;" ' +
        'onmousedown="this.style.background=\'var(--surface3)\'" onmouseup="this.style.background=\'\'">' +
        '<span style="font-size:1.1rem;">🏸</span>' +
        '<span style="font-size:0.88rem;font-weight:600;color:var(--text);">' + c.name + '</span>' +
        '<span style="margin-left:auto;font-size:0.75rem;color:var(--accent);">Join →</span>' +
        '</div>';
    }).join('');
  } catch(e) {
    if (errorEl) { errorEl.textContent = 'Could not load clubs: ' + e.message; errorEl.style.display = ''; }
    if (resultsEl) resultsEl.style.display = 'none';
  }
}

function vncbSelectClub(clubId, clubName) {
  _vncbPendingClubId   = clubId;
  _vncbPendingClubName = clubName;
  var resultsEl = document.getElementById('vncbResults');
  if (resultsEl) resultsEl.style.display = 'none';
  var searchEl = document.getElementById('vncbSearch');
  if (searchEl) searchEl.value = clubName;
  // Show nickname entry
  var ns = document.getElementById('vncbNicknameSection');
  var nm = document.getElementById('vncbNicknameMsg');
  if (nm) nm.textContent = 'What is your nickname in "' + clubName + '"? (as added by your organiser)';
  if (ns) ns.style.display = '';
  var ni = document.getElementById('vncbNicknameInput');
  if (ni) { ni.value = ''; setTimeout(function() { ni.focus(); }, 100); }
}

function vncbSubmitNickname() {
  var ni = document.getElementById('vncbNicknameInput');
  var nickname = ni ? ni.value.trim() : '';
  if (!nickname) { var el = document.getElementById('vncbNicknameInput'); if (el) el.focus(); return; }
  _vncbPendingNickname = nickname;
  _vncbRequest(_vncbPendingClubId, _vncbPendingClubName, nickname);
}

function vncbSubmitNicknameAlt() {
  var ni = document.getElementById('vncbNicknameAltInput');
  var nickname = ni ? ni.value.trim() : '';
  if (!nickname) return;
  _vncbPendingNickname = nickname;
  _vncbRequest(_vncbPendingClubId, _vncbPendingClubName, nickname);
}

async function vncbSubmitPassword() {
  var pi = document.getElementById('vncbPasswordInput');
  var password = pi ? pi.value.trim() : '';
  if (!password) { if (pi) pi.focus(); return; }
  try {
    var result = (typeof authClaimAndJoin === 'function')
      ? await authClaimAndJoin(_vncbPendingClubId, _vncbPendingNickname, password)
      : await joinClubPageRequest(_vncbPendingClubId, _vncbPendingClubName, _vncbPendingNickname);
    _vncbShowFeedback('✅', 'Joined!', 'You have joined "' + _vncbPendingClubName + '" as ' + _vncbPendingNickname);
    setTimeout(function() { _vncbOnJoined(); }, 1500);
  } catch(e) {
    var errorEl = document.getElementById('vncbError');
    if (errorEl) { errorEl.textContent = '❌ ' + e.message; errorEl.style.display = ''; }
  }
}

async function _vncbRequest(clubId, clubName, nickname) {
  _vncbShowFeedback('⏳', 'Sending request...', 'Please wait');
  try {
    if (typeof authRequestJoin !== 'function') {
      _vncbShowFeedback('✅', 'Joined!', 'You have joined "' + clubName + '" as ' + nickname);
      setTimeout(function() { _vncbOnJoined(); }, 1500);
      return;
    }
    var result = await authRequestJoin(clubId, nickname);

    if (result.alreadyMember) {
      // Already approved — go straight to home
      _vncbShowFeedback('✅', 'Welcome back!', 'You are already a member of "' + clubName + '".');
      setTimeout(function() { _vncbOnJoined(); }, 800);
      return;
    }
    if (result.needsPassword) {
      // Unclaimed player — show password step
      var fb = document.getElementById('vncbFeedback');
      if (fb) fb.style.display = 'none';
      _vncbPendingNickname = result.conflictNickname || nickname;
      var pm = document.getElementById('vncbPasswordMsg');
      var ps = document.getElementById('vncbPasswordSection');
      if (pm) pm.textContent = 'A player named "' + _vncbPendingNickname + '" exists in this club. Enter the default password to claim this account.';
      if (ps) ps.style.display = '';
      return;
    }
    if (result.nicknameConflict) {
      // Nickname taken — show alt nickname step
      var fb = document.getElementById('vncbFeedback');
      if (fb) fb.style.display = 'none';
      var am = document.getElementById('vncbNicknameAltMsg');
      var as = document.getElementById('vncbNicknameAltSection');
      if (am) am.textContent = 'The nickname "' + (result.conflictNickname || nickname) + '" is already taken in this club. Please choose a different one.';
      if (as) as.style.display = '';
      return;
    }
    if (result.error) {
      _vncbShowFeedback('❌', 'Error', result.error);
      return;
    }
    // Success — request sent, pending approval
    _vncbShowFeedback('📨', 'Request Sent!', 'Your request to join "' + clubName + '" as "' + nickname + '" is awaiting approval from the organiser.');
  } catch(e) {
    _vncbShowFeedback('❌', 'Error', e.message || 'Something went wrong.');
  }
}

function _vncbShowFeedback(icon, title, msg) {
  ['vncbNicknameSection','vncbPasswordSection','vncbNicknameAltSection'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var fb = document.getElementById('vncbFeedback');
  var fi = document.getElementById('vncbFeedbackIcon');
  var ft = document.getElementById('vncbFeedbackTitle');
  var fm = document.getElementById('vncbFeedbackMsg');
  if (fi) fi.textContent = icon;
  if (ft) ft.textContent = title;
  if (fm) fm.textContent = msg;
  if (fb) fb.style.display = '';
}

function _vncbOnJoined() {
  // Ensure club is set in localStorage before returning to home
  if (_vncbPendingClubId && _vncbPendingClubName) {
    if (typeof setMyClub === 'function') setMyClub(_vncbPendingClubId, _vncbPendingClubName);
  }
  var banner = document.getElementById('viewerNoClubBanner');
  if (banner) banner.style.display = 'none';
  if (typeof homeRefreshJoinClubTile === 'function') homeRefreshJoinClubTile();
  if (typeof homeRefreshTiles        === 'function') homeRefreshTiles();
  if (typeof showHomeScreen          === 'function') showHomeScreen();
}
