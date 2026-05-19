/* ============================================================
   DASHBOARD -- Live & past sessions for the club
   File: dashboard.js
   ============================================================ */

var _dashboardTimer     = null;
var _dashboardPollTimer = null;
var _dashboardLiveIds   = []; // track current live session IDs

/* ── Dashboard polling -- detects session status changes ── */
function dashboardStartPoll() {
  dashboardStopPoll();
  _dashboardPollTimer = setInterval(async () => {
    // Only poll if dashboard is visible
    const dashPage = document.getElementById('dashboardPage');
    if (!dashPage || dashPage.style.display === 'none') {
      dashboardStopPoll(); return;
    }
    try {
      const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
      let currentLiveIds = [];

      if (isViewer) {
        const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
        if (!myPlayer) return;
        const clubIds = await dbGetPlayerClubs(myPlayer.name);
        if (!clubIds.length) return;
        const inList = '(' + clubIds.join(',') + ')';
        const rows = await sbGet('sessions',
          `club_id=in.${inList}&status=eq.live&select=id`
        );
        currentLiveIds = (rows || []).map(r => r.id);
      } else {
        const club = (typeof getMyClub === 'function') ? getMyClub() : null;
        if (!club || !club.id) return;
        const rows = await sbGet('sessions',
          `club_id=eq.${club.id}&status=eq.live&select=id`
        );
        currentLiveIds = (rows || []).map(r => r.id);
      }

      // Re-render if live sessions changed
      const prev = _dashboardLiveIds.slice().sort().join(',');
      const curr = currentLiveIds.slice().sort().join(',');
      if (prev !== curr) {
        _dashboardLiveIds = currentLiveIds;
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    } catch (e) { /* silent */ }
  }, 15000);
}

function dashboardStopPoll() {
  if (_dashboardPollTimer) { clearInterval(_dashboardPollTimer); _dashboardPollTimer = null; }
}

/* ── Called when Dashboard tab opens ── */
async function renderDashboard() {
  if (typeof viewerStopPoll === 'function') viewerStopPoll(); // stop any active poll
  dashboardStopPoll(); // stop dashboard poll when leaving
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const club     = (typeof getMyClub === 'function') ? getMyClub() : null;

  // Viewer needs a profile; organiser needs a club
  if (isViewer && !myPlayer) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">👤</div>
        <p>${t("setupProfileFirst")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("tapProfileIcon")}</p>
      </div>`;
    return;
  }
  if (!isViewer && (!club || !club.id)) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">🏟️</div>
        <p>${t("noClubSelectedDash")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("goToClubTab")}</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';

  try {
    // Fetch all live sessions (one per hall)
    const liveSessions = await dbGetLiveSessions();

    // Fetch last 3 completed sessions
    const pastSessions = await dbGetPastSessions();

    container.innerHTML = '';

    // For viewer -- enrich sessions with club names
    if (isViewer && (liveSessions.length || pastSessions.length)) {
      try {
        const allClubIds = [...new Set([
          ...liveSessions.map(s => s.club_id),
          ...pastSessions.map(s => s.club_id)
        ].filter(Boolean))];
        if (allClubIds.length) {
          const clubs = await Promise.all(
            allClubIds.map(id => sbGet('clubs', `id=eq.${id}&select=id,name`).catch(() => []))
          );
          const clubMap = {};
          clubs.flat().forEach(c => { if (c) clubMap[c.id] = c.name; });
          liveSessions.forEach(s => { s.club_name = clubMap[s.club_id] || s.club_id; });
          pastSessions.forEach(s => { s.club_name = clubMap[s.club_id] || s.club_id; });
        }
      } catch (e) { /* silent */ }
    }

    // ── Live Section ──
    const liveSection = document.createElement('div');
    liveSection.className = 'dash-section';
    liveSection.innerHTML = `<div class="dash-section-title"><span class="dash-live-dot"></span> ${t("liveNowTitle")}</div>`;

    if (liveSessions.length) {
      liveSessions.forEach(sess => {
        // live_sessions are grouped by club -- players array is from per-player rows
        const players     = (sess.players && sess.players.length) ? sess.players : _extractPlayersFromRounds(sess.rounds_data || []);
        const totalRounds = (sess.rounds_data || []).length || null;
        const cardClubName = isViewer ? (sess.club_name || sess.club_id || '') : (club ? club.name : '');
        const card = _buildSessionCard({
          clubName:    cardClubName,
          starter:     sess.started_by,
          players,
          totalRounds,
          isLive:      true,
          sessionId:   sess.id,
          updatedAt:   sess.updated_at,
          handoverPin: sess.handover_pin || null
        });
        liveSection.appendChild(card);
      });
    } else {
      liveSection.innerHTML += `<div class="dash-empty-inline">${t("noActiveSessions")}</div>`;
    }
    container.appendChild(liveSection);

    // ── Past Sessions ──
    const pastSection = document.createElement('div');
    pastSection.className = 'dash-section';
    pastSection.innerHTML = `<div class="dash-section-title">📅 ${t("recentSessions")}</div>`;

    if (pastSessions.length) {
      pastSessions.forEach(sess => {
        const pastClubName = isViewer ? (sess.club_name || sess.club_id || '') : (club ? club.name : '');
        const card = _buildSessionCard({
          clubName:    pastClubName,
          starter:     sess.started_by,
          players:     sess.players || [],
          totalRounds: (sess.rounds_data || []).length || null,
          isLive:      false,
          sessionId:   sess.id,
          date:        sess.date,
          updatedAt:   sess.updated_at,
          shuttleData: sess.shuttle_data || null
        });
        pastSection.appendChild(card);
      });
    } else {
      pastSection.innerHTML += `<div class="dash-empty-inline">${t("noRecentSessions")}</div>`;
    }
    container.appendChild(pastSection);

    // Start polling for live session changes
    dashboardStartPoll();

  } catch(e) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">📡</div>
        <p>${t("couldNotLoadSessions")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("checkConnection")}</p>
        <button class="help-retry-btn" onclick="renderDashboard()" style="margin-top:12px">${t("retryBtn")}</button>
      </div>`;
  }
}

/* ── Extract unique players from rounds_data ── */
function _extractPlayersFromRounds(roundsData) {
  const seen = new Set();
  const players = [];
  for (const round of (roundsData || [])) {
    for (const game of (round.games || [])) {
      for (const p of [...(game.pair1 || []), ...(game.pair2 || [])]) {
        if (!seen.has(p)) { seen.add(p); players.push({ name: p }); }
      }
    }
  }
  return players;
}

/* ── Build a session card ── */
function _buildSessionCard({ clubName, starter, players, totalRounds, isLive, sessionId, date, updatedAt, shuttleData, handoverPin }) {
  const card = document.createElement('div');
  card.className = 'dash-session-card' + (isLive ? ' live' : '');

  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const myName   = myPlayer ? myPlayer.name.toLowerCase() : '';
  const dateLabel = isLive ? t('today') : _formatDate(date || updatedAt);
  // Show club name on card (useful when viewer sees multiple clubs)
  const displayClub = clubName || '';

  // Top row
  const top = document.createElement('div');
  top.className = 'dash-card-top';
  top.innerHTML = `
    <div class="dash-card-club">${clubName || t('clubLabel')}</div>
    ${isLive
      ? `<div class="dash-live-badge"><div class="dash-live-dot-sm"></div>LIVE</div>`
      : `<div class="dash-past-badge">${dateLabel}</div>`}
  `;
  card.appendChild(top);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'dash-card-meta';
  meta.innerHTML = `
    <span>👥 ${players.length} ${t("playersCount")}</span>
    ${totalRounds ? `<span>🔄 ${totalRounds} ${t("roundsCount")}</span>` : ''}
    ${starter ? `<span>▶ ${starter}</span>` : ''}
  `;
  card.appendChild(meta);

  // Player chips
  const chips = document.createElement('div');
  chips.className = 'dash-card-chips';
  const show = players.slice(0, 5);
  const rest = players.length - show.length;
  show.forEach(p => {
    const chip = document.createElement('div');
    const name = p.name || p.player_name || '';
    const isMe = name.toLowerCase() === myName;
    chip.className = 'dash-chip' + (isMe ? ' me' : '');
    chip.textContent = name + (isMe ? ' ★' : '');
    chips.appendChild(chip);
  });
  if (rest > 0) {
    const more = document.createElement('div');
    more.className = 'dash-chip';
    more.textContent = `+${rest}`;
    chips.appendChild(more);
  }
  card.appendChild(chips);

  // Tap → open rounds view (both live and past)
  if (sessionId) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => _openSessionRounds(sessionId, clubName, dateLabel));
  }

  // Shuttle cost row -- past sessions only
  if (!isLive && shuttleData) {
    const shuttleRow = document.createElement('div');
    shuttleRow.className = 'dash-shuttle-row';
    let info = '';
    if (shuttleData.mode === 'flat') {
      info = `<span class="dash-shuttle-info">💴 Flat fee</span>`;
    } else {
      const parts = [];
      if (shuttleData.shuttles_used) parts.push(`🪶 ${shuttleData.shuttles_used} shuttles`);
      if (shuttleData.court_fee)     parts.push(`🏟 ¥${shuttleData.court_fee.toLocaleString()}`);
      if (shuttleData.misc_fee)      parts.push(`📦 ¥${shuttleData.misc_fee.toLocaleString()}`);
      info = `<span class="dash-shuttle-info">${parts.join(' · ')}</span>`;
    }
    shuttleRow.innerHTML = `
      ${info}
      <span class="dash-shuttle-cost">¥${(shuttleData.cost_per_player||0).toLocaleString()}/player</span>
    `;
    card.appendChild(shuttleRow);
  }

  // Edit Cost button -- organiser mode only, past sessions only
  const isOrg = typeof appMode !== 'undefined' ? appMode === 'organiser' : localStorage.getItem('kbrr_app_mode') === 'organiser';
  if (!isLive && isOrg && sessionId) {
    const editBtn = document.createElement('button');
    editBtn.className = 'dash-force-end-btn';
    editBtn.style.cssText = 'background:rgba(108,99,255,0.15);color:#6c63ff;border-color:rgba(108,99,255,0.3);margin-top:8px;';
    editBtn.textContent = '✏️ Edit Cost';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      showEditCostSheet(sessionId, shuttleData, players);
    };
    const editFooter = document.createElement('div');
    editFooter.className = 'dash-card-footer';
    editFooter.appendChild(editBtn);
    card.appendChild(editFooter);
  }

  // Force End button -- admin only, live sessions only
  const isAdmin = (typeof isAdminMode === 'function') ? isAdminMode() : localStorage.getItem('kbrr_club_mode') === 'admin';
  if (isLive && isAdmin) {
    const footer = document.createElement('div');
    footer.className = 'dash-card-footer';
    const forceEndBtn = document.createElement('button');
    forceEndBtn.className = 'dash-force-end-btn';
    forceEndBtn.textContent = t('forceEndSession');
    forceEndBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(t('forceEndConfirm'))) return;
      forceEndBtn.textContent = t('ending');
      forceEndBtn.disabled = true;
      try {
        await dbForceCompleteSession(sessionId);
        renderDashboard();
      } catch(err) {
        forceEndBtn.textContent = t('forceEndSession');
        forceEndBtn.disabled = false;
        alert('Failed: ' + err.message);
      }
    };
    footer.appendChild(forceEndBtn);
    card.appendChild(footer);
  }

  // ── Organiser controls — live sessions for their club only ──
  if (isLive && isOrg && sessionId) {
    const _storedIds = new Set([
      sessionStorage.getItem('kbrr_session_db_id'),
      localStorage.getItem('kbrr_session_id_persist'),
      (() => { try { return JSON.parse(localStorage.getItem('kbrr_snapshot') || '{}').sessionDbId; } catch(e) { return null; } })()
    ].filter(Boolean));
    const isMySession = _storedIds.has(sessionId);

    const handoverFooter = document.createElement('div');
    handoverFooter.className = 'dash-card-footer';

    // Hand Over — only if I started this session
    if (isMySession) {
      const handoverBtn = document.createElement('button');
      handoverBtn.className = 'dash-force-end-btn';
      handoverBtn.style.cssText = 'background:rgba(108,99,255,0.15);color:#6c63ff;border-color:rgba(108,99,255,0.3);margin-top:8px;';
      handoverBtn.textContent = '🤝 Hand Over';
      handoverBtn.onclick = (e) => {
        e.stopPropagation();
        _showHandoverSetPassword(sessionId);
      };
      handoverFooter.appendChild(handoverBtn);
    }

    // End Session — always shown for any organiser of this club
    const endBtn = document.createElement('button');
    endBtn.className = 'dash-force-end-btn';
    endBtn.style.cssText = 'background:rgba(230,55,87,0.15);color:#e63757;border-color:rgba(230,55,87,0.3);margin-top:8px;';
    endBtn.textContent = '⏹ End Session';
    endBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('End this session?')) return;
      endBtn.textContent = 'Ending...';
      endBtn.disabled = true;
      try {
        await dbForceCompleteSession(sessionId);
        renderDashboard();
      } catch(err) {
        endBtn.textContent = '⏹ End Session';
        endBtn.disabled = false;
        alert('Failed: ' + err.message);
      }
    };
    handoverFooter.appendChild(endBtn);
    card.appendChild(handoverFooter);
  }

  return card;
}

/* ── Handover: Set a password (Organiser A) ── */
function _showHandoverSetPassword(sessionId) {
  var existing = document.getElementById('scs-handover-set-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-handover-set-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
  modal.innerHTML =
    '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
      '<div style="font-size:2.2rem;margin-bottom:10px;">🤝</div>' +
      '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Hand Over Session</div>' +
      '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.5;">Set a password. Share it with the new organiser so they can continue this session.</div>' +
      '<input id="scsHoPassword" type="text" placeholder="Set a handover password"' +
        ' style="width:100%;padding:13px;font-size:1rem;text-align:center;background:var(--surface,#2a2a3e);border:1.5px solid var(--border,#333);border-radius:12px;color:var(--text,#fff);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">' +
      '<div id="scsHoSetErr" style="font-size:0.78rem;color:#e63757;min-height:18px;margin-bottom:10px;"></div>' +
      '<button id="scsHoSetBtn" style="width:100%;padding:13px;background:linear-gradient(135deg,#6c63ff,#574fd6);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Set Password</button>' +
      '<button id="scsHoCancelSet" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';

  document.body.appendChild(modal);

  var errEl = document.getElementById('scsHoSetErr');

  document.getElementById('scsHoSetBtn').onclick = async function() {
    var pw = (document.getElementById('scsHoPassword').value || '').trim();
    if (!pw || pw.length < 3) { errEl.textContent = 'Password must be at least 3 characters.'; return; }
    try {
      await sbPatch('sessions', 'id=eq.' + sessionId, { handover_pin: pw });
      modal.remove();
      // Show confirmation with the password
      var conf = document.createElement('div');
      conf.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
      conf.innerHTML =
        '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
          '<div style="font-size:2.2rem;margin-bottom:10px;">✅</div>' +
          '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:8px;">Password Set</div>' +
          '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:16px;">Share this password with the new organiser:</div>' +
          '<div style="font-size:1.5rem;font-weight:900;letter-spacing:4px;color:var(--accent,#6c63ff);background:var(--surface,#2a2a3e);padding:14px;border-radius:12px;margin-bottom:20px;">' + pw + '</div>' +
          '<button id="scsHoConfClose" style="width:100%;padding:13px;background:var(--surface,#2a2a3e);border:1px solid var(--border,#333);color:var(--text,#fff);border-radius:13px;font-size:0.9rem;cursor:pointer;font-family:inherit;">Done</button>' +
        '</div>';
      document.body.appendChild(conf);
      document.getElementById('scsHoConfClose').onclick = function() { conf.remove(); };
    } catch(e) {
      errEl.textContent = 'Failed to set password: ' + e.message;
    }
  };
  document.getElementById('scsHoCancelSet').onclick = function() { modal.remove(); };
}

/* ── Continue: Enter password (Organiser B) ── */
function _showContinueWithPassword(sessionId, requirePin) {
  var existing = document.getElementById('scs-continue-pw-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-continue-pw-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
  modal.innerHTML =
    '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
      '<div style="font-size:2.2rem;margin-bottom:10px;">▶</div>' +
      '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Continue Session</div>' +
      '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.5;">' +
        (requirePin ? 'Enter the handover password set by the current organiser.' : 'Enter the handover password to take over this session.') +
      '</div>' +
      '<input id="scsContPwInput" type="text" placeholder="Handover password"' +
        ' style="width:100%;padding:13px;font-size:1rem;text-align:center;background:var(--surface,#2a2a3e);border:1.5px solid var(--border,#333);border-radius:12px;color:var(--text,#fff);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">' +
      '<div id="scsContPwErr" style="font-size:0.78rem;color:#e63757;min-height:18px;margin-bottom:10px;"></div>' +
      '<button id="scsContPwSubmit" style="width:100%;padding:13px;background:linear-gradient(135deg,#2dce89,#26b575);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Take Over</button>' +
      '<button id="scsContPwCancel" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';

  document.body.appendChild(modal);

  var errEl = document.getElementById('scsContPwErr');

  document.getElementById('scsContPwSubmit').onclick = async function() {
    var entered = (document.getElementById('scsContPwInput').value || '').trim();
    if (!entered) { errEl.textContent = 'Please enter the handover password.'; return; }

    try {
      var rows = await sbGet('sessions', 'id=eq.' + sessionId + '&select=id,handover_pin,scheduler_state,rounds_data,started_by');
      if (!rows || !rows.length) { errEl.textContent = 'Session not found.'; return; }
      var sess = rows[0];

      if (!sess.handover_pin) { errEl.textContent = 'No handover password set. Ask the organiser to set one first.'; return; }
      if (sess.handover_pin.trim() !== entered) { errEl.textContent = '❌ Wrong password. Try again.'; return; }

      // Password correct — transfer session
      var myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
      var myName   = (myPlayer && myPlayer.name) ? myPlayer.name : 'New Organiser';
      var now      = new Date().toISOString();
      await sbPatch('sessions', 'id=eq.' + sessionId, {
        handover_pin: null,
        started_by:   myName,
        updated_at:   now
      });

      modal.remove();

      // Restore full session state
      if (sess.scheduler_state && sess.scheduler_state.schedulerState) {
        var blob = sess.scheduler_state;
        blob.sessionDbId = sess.id;
        if (typeof persistSessionId === 'function') persistSessionId(sess.id);
        sessionStorage.setItem('kbrr_session_db_id', sess.id);
        localStorage.setItem('kbrr_snapshot', JSON.stringify(blob));
        if (typeof restoreSnapshot === 'function') {
          await restoreSnapshot(blob);
          if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();
        }
      } else {
        // No scheduler state yet — just set session ID and navigate to rounds
        if (typeof persistSessionId === 'function') persistSessionId(sess.id);
        sessionStorage.setItem('kbrr_session_db_id', sess.id);
        alert('Session taken over. Please start a new round to continue.');
      }
    } catch(e) {
      errEl.textContent = 'Error: ' + e.message;
    }
  };
  document.getElementById('scsContPwCancel').onclick = function() { modal.remove(); };
}

/* ── Open rounds view -- navigates to viewerPage ── */
function _openSessionRounds(sessionId, clubName, dateLabel) {
  if (typeof viewerOpen === 'function') {
    viewerOpen(sessionId).then(function() {
      var titleEl = document.getElementById('viewerHeaderTitle');
      var subEl   = document.getElementById('viewerHeaderNickname');
      if (titleEl && clubName) titleEl.textContent = clubName;
      if (subEl   && dateLabel) subEl.textContent  = dateLabel;
    });
  }
}

/* ── Format date ── */
function _formatDate(dateStr) {
  if (!dateStr) return '';
  // Append T00:00:00 for date-only strings so they parse as local midnight, not UTC midnight
  const rawStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  // If no timezone suffix, parse manually as local time to avoid browser ambiguity
  var d;
  if (/[Zz]$/.test(rawStr) || /[+-]\d{2}:\d{2}$/.test(rawStr)) {
    d = new Date(rawStr);
  } else {
    var _pts = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    d = _pts ? new Date(+_pts[1], +_pts[2]-1, +_pts[3], +_pts[4], +_pts[5], +_pts[6]) : new Date(rawStr);
  }
  const now   = new Date();
  // Compare using local date strings to avoid midnight UTC boundary issues
  const _p    = n => String(n).padStart(2,'0');
  const dStr  = `${d.getFullYear()}-${_p(d.getMonth()+1)}-${_p(d.getDate())}`;
  const tStr  = `${now.getFullYear()}-${_p(now.getMonth()+1)}-${_p(now.getDate())}`;
  const diff  = Math.round((new Date(tStr) - new Date(dStr)) / (1000*60*60*24));
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
