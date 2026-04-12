/* ============================================================
   snapshot.js — Full session state save & restore
   
   SAVE: saveSnapshot() called after every meaningful action
   RESTORE: checkAndResume() called on initAppFlow()
   
   Maps/Sets serialized as [[k,v]] arrays for JSON compat.
   sessionDbId moved from sessionStorage → localStorage.
============================================================ */

const SNAPSHOT_KEY = 'kbrr_snapshot';
const SESSION_ID_KEY = 'kbrr_session_id_persist';

/* ── Serialization helpers for Map / Set ── */
function _serializeMap(m) {
  if (!m || !(m instanceof Map)) return [];
  return Array.from(m.entries());
}
function _serializeSet(s) {
  if (!s || !(s instanceof Set)) return [];
  return Array.from(s.values());
}
function _deserializeMap(arr) {
  return new Map(Array.isArray(arr) ? arr : []);
}
function _deserializeSet(arr) {
  return new Set(Array.isArray(arr) ? arr : []);
}

/* ── Save full snapshot ── */
function saveSnapshot() {
  try {
    if (typeof schedulerState === 'undefined' || typeof allRounds === 'undefined') return;
    // Only save if session is in progress
    if (!Array.isArray(allRounds) || allRounds.length === 0) return;

    const ss = schedulerState;
    const blob = {
      version:           2,
      timestamp:         Date.now(),
      page:              'roundsPage',
      appMode:           typeof appMode !== 'undefined' ? appMode : 'organiser',
      currentLang:       typeof currentLang !== 'undefined' ? currentLang : 'en',
      currentRoundIndex: typeof currentRoundIndex !== 'undefined' ? currentRoundIndex : 0,
      currentState:      typeof currentState !== 'undefined' ? currentState : 'idle',
      interactionLocked: typeof interactionLocked !== 'undefined' ? interactionLocked : false,
      roundActive:       typeof roundActive !== 'undefined' ? roundActive : false,
      sessionDbId:       localStorage.getItem(SESSION_ID_KEY) || null,

      // allRounds — plain objects, safe to stringify
      allRounds: JSON.parse(JSON.stringify(allRounds)),

      // schedulerState — serialize Maps/Sets
      schedulerState: {
        numCourts:      ss.numCourts,
        courts:         ss.courts,
        roundIndex:     ss.roundIndex,
        markingWinnerMode: ss.markingWinnerMode,
        allPlayers:     JSON.parse(JSON.stringify(ss.allPlayers || [])),
        activeplayers:  JSON.parse(JSON.stringify(
          Array.isArray(ss.activeplayers) ? ss.activeplayers : Array.from(ss.activeplayers || [])
        )),
        fixedPairs:     JSON.parse(JSON.stringify(ss.fixedPairs || [])),
        PlayedCount:    _serializeMap(ss.PlayedCount),
        restCount:      _serializeMap(ss.restCount),
        restQueue:      _serializeMap(ss.restQueue),
        PlayerScoreMap: _serializeMap(ss.PlayerScoreMap),
        playedTogether: _serializeMap(ss.playedTogether),
        fixedMap:       _serializeMap(ss.fixedMap),
        gamesMap:       _serializeMap(ss.gamesMap),
        winCount:       _serializeMap(ss.winCount),
        pairCooldownMap:_serializeMap(ss.pairCooldownMap),
        rankPoints:     _serializeMap(ss.rankPoints),
        streakMap:      _serializeMap(ss.streakMap),
        pairPlayedSet:  _serializeSet(ss.pairPlayedSet),
      }
    };

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(blob));
  } catch(e) {
    console.warn('saveSnapshot failed:', e.message);
  }
}

/* ── Clear snapshot (called on normal end session) ── */
function clearSnapshot() {
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}

/* ── Persist sessionDbId to localStorage (survives page reload) ── */
function persistSessionId(id) {
  if (id) localStorage.setItem(SESSION_ID_KEY, id);
  else localStorage.removeItem(SESSION_ID_KEY);
}

/* ── Restore full snapshot into live app state ── */
async function restoreSnapshot(blob) {
  try {
    _showResumeToast('Resuming session…');

    // Restore simple globals
    if (typeof appMode        !== 'undefined') appMode        = blob.appMode || 'organiser';
    if (typeof currentLang    !== 'undefined') currentLang    = blob.currentLang || 'en';
    if (typeof currentRoundIndex !== 'undefined') currentRoundIndex = blob.currentRoundIndex || 0;
    if (typeof currentState   !== 'undefined') currentState   = blob.currentState || 'idle';
    if (typeof interactionLocked !== 'undefined') interactionLocked = blob.interactionLocked || false;
    if (typeof roundActive    !== 'undefined') roundActive    = blob.roundActive || false;

    // Restore sessionDbId
    if (blob.sessionDbId) {
      persistSessionId(blob.sessionDbId);
      // Also restore to sessionStorage so existing functions find it
      sessionStorage.setItem('kbrr_session_db_id', blob.sessionDbId);
    }

    // Restore allRounds
    if (typeof allRounds !== 'undefined') {
      allRounds.length = 0;
      (blob.allRounds || []).forEach(r => allRounds.push(r));
    }

    // Restore schedulerState
    const s = blob.schedulerState;
    if (typeof schedulerState !== 'undefined' && s) {
      schedulerState.numCourts       = s.numCourts || 1;
      schedulerState.courts          = s.courts || 1;
      schedulerState.roundIndex      = s.roundIndex || 0;
      schedulerState.markingWinnerMode = s.markingWinnerMode || false;
      schedulerState.allPlayers      = s.allPlayers || [];
      schedulerState.fixedPairs      = s.fixedPairs || [];
      schedulerState.PlayedCount     = _deserializeMap(s.PlayedCount);
      schedulerState.restCount       = _deserializeMap(s.restCount);
      schedulerState.restQueue       = _deserializeMap(s.restQueue);
      schedulerState.PlayerScoreMap  = _deserializeMap(s.PlayerScoreMap);
      schedulerState.playedTogether  = _deserializeMap(s.playedTogether);
      schedulerState.fixedMap        = _deserializeMap(s.fixedMap);
      schedulerState.gamesMap        = _deserializeMap(s.gamesMap);
      schedulerState.winCount        = _deserializeMap(s.winCount);
      schedulerState.pairCooldownMap = _deserializeMap(s.pairCooldownMap);
      schedulerState.rankPoints      = _deserializeMap(s.rankPoints);
      schedulerState.streakMap       = _deserializeMap(s.streakMap);
      schedulerState.pairPlayedSet   = _deserializeSet(s.pairPlayedSet);

      // Restore activeplayers (plain array, not proxy for restore)
      schedulerState.activeplayers.splice(0, schedulerState.activeplayers.length,
        ...(s.activeplayers || []));
    }

    // Apply mode and language
    if (typeof applyMode    === 'function') applyMode(blob.appMode || 'organiser');
    if (typeof setLanguage  === 'function') setLanguage(blob.currentLang || 'en');
    if (typeof updateModePill === 'function') updateModePill(blob.appMode || 'organiser');
    if (typeof loadHomeStyle === 'function') loadHomeStyle();

    // Navigate to roundsPage and render
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const rp = document.getElementById('roundsPage');
    if (rp) rp.style.display = 'block';

    // Hide home overlay
    const homeEl = document.getElementById('homePageOverlay');
    if (homeEl) homeEl.style.display = 'none';

    // Render the round
    if (typeof showRound === 'function') {
      showRound(blob.currentRoundIndex || 0);
    }

    // Restore active state UI
    if (blob.currentState === 'active') {
      // Re-apply active mode visuals
      document.getElementById('roundsPage')?.classList.add('active-mode');
      document.querySelectorAll('.win-cup').forEach(cup => {
        cup.style.visibility    = 'visible';
        cup.style.pointerEvents = 'auto';
      });
      // Disable buttons except nextBtn/endBtn
      document.querySelectorAll('button, .player-btn, .mode-card, .lock-icon').forEach(el => {
        const keep = el.id === 'nextBtn' || el.id === 'endBtn' || el.classList.contains('win-cup');
        if (!keep) { el.style.pointerEvents = 'none'; el.classList.add('disabled'); }
      });
      // Update Next button label
      const nextBtn = document.getElementById('nextBtn');
      const btnText = document.getElementById('btnText');
      if (nextBtn) nextBtn.classList.remove('start-state');
      if (btnText) { btnText.removeAttribute('data-i18n'); btnText.textContent = 'Next'; }
    }

    // Restore lock state
    if (blob.interactionLocked) {
      const lockBtn = document.getElementById('lockToggleBtn');
      if (lockBtn) lockBtn.src = 'lock.png';
      document.getElementById('roundsPage')?.querySelector('.round-wrapper')?.classList.add('locked');
    }

    // Update live bar
    if (typeof updateSessionLiveBar === 'function') updateSessionLiveBar();

    // Restart heartbeat
    if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();

    // Sync shuffle button
    if (typeof _syncShuffleBtn === 'function') _syncShuffleBtn();

    setTimeout(() => _hideResumeToast(), 1500);
    console.log('✅ Session restored from snapshot');

  } catch(e) {
    console.error('restoreSnapshot failed:', e);
    clearSnapshot();
    // Fallback to normal start
    if (typeof showHomeScreen === 'function') showHomeScreen();
  }
}

/* ── Check on startup: restore or auto-end ── */
async function checkAndResume() {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return false; // No snapshot — normal startup

  let blob;
  try { blob = JSON.parse(raw); } catch(e) { clearSnapshot(); return false; }

  // Snapshot too old? (24 hours)
  if (Date.now() - (blob.timestamp || 0) > 24 * 60 * 60 * 1000) {
    clearSnapshot();
    return false;
  }

  const sessionId = blob.sessionDbId;

  // No session ID — just restore locally (offline session)
  if (!sessionId) {
    await restoreSnapshot(blob);
    return true;
  }

  // Check DB session status
  try {
    _showResumeToast('Checking session…');
    const rows = await sbGet('sessions', `id=eq.${sessionId}&select=id,status`);
    _hideResumeToast();

    if (rows && rows.length && rows[0].status === 'live') {
      // Session still alive in DB — restore
      await restoreSnapshot(blob);
      return true;
    } else {
      // Session dead/completed — auto clean up
      _showResumeToast('Previous session ended — resetting…');
      clearSnapshot();
      // Release any stale player slots silently
      try {
        if (typeof flushLiveSession === 'function') await flushLiveSession();
        if (typeof dbReleaseMySession === 'function') await dbReleaseMySession();
      } catch(e) { /* silent */ }
      setTimeout(() => _hideResumeToast(), 1500);
      return false;
    }
  } catch(e) {
    // Offline — restore from snapshot anyway
    _hideResumeToast();
    console.warn('DB check failed (offline?) — restoring from snapshot');
    await restoreSnapshot(blob);
    return true;
  }
}

/* ── Resume toast UI ── */
function _showResumeToast(msg) {
  let t = document.getElementById('resumeToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'resumeToast';
    t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#fff;padding:16px 28px;border-radius:16px;font-size:0.9rem;font-weight:700;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
}
function _hideResumeToast() {
  const t = document.getElementById('resumeToast');
  if (t) t.style.display = 'none';
}
