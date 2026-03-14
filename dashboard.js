/* ============================================================
   DASHBOARD — Live & past sessions for the club
   File: dashboard.js
   ============================================================ */

var _dashboardTimer = null;

/* ── Called when Dashboard tab opens ── */
async function renderDashboard() {
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">🏟️</div>
        <p>No club selected.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Go to Settings to join a club.</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch live sessions (today)
    const liveRows = await sbGet('live_sessions',
      `club_id=eq.${club.id}&date=eq.${today}&select=player_name,wins,losses,started_by,updated_at,matches&order=updated_at.desc`
    );

    // Fetch past sessions from players.sessions (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const pastRows = await sbGet('players',
      `select=name,sessions&order=name.asc`
    );

    container.innerHTML = '';

    // ── Live Sessions ──
    const liveSection = document.createElement('div');
    liveSection.className = 'dash-section';

    if (liveRows && liveRows.length) {
      // Group by started_by (each session starter = one session)
      const sessions = {};
      liveRows.forEach(r => {
        const key = r.started_by || 'Unknown';
        if (!sessions[key]) sessions[key] = { players: [], updated_at: r.updated_at };
        sessions[key].players.push(r);
        if (r.updated_at > sessions[key].updated_at) sessions[key].updated_at = r.updated_at;
      });

      liveSection.innerHTML = `<div class="dash-section-title"><span class="dash-live-dot"></span> Live Now</div>`;

      Object.entries(sessions).forEach(([starter, session]) => {
        const card = _buildSessionCard({
          clubName: club.name,
          starter,
          players: session.players,
          updatedAt: session.updated_at,
          isLive: true,
          date: today,
        });
        liveSection.appendChild(card);
      });
    } else {
      liveSection.innerHTML = `
        <div class="dash-section-title"><span class="dash-live-dot"></span> Live Now</div>
        <div class="dash-empty-inline">No active sessions right now</div>`;
    }
    container.appendChild(liveSection);

    // ── Past Sessions ──
    const pastSection = document.createElement('div');
    pastSection.className = 'dash-section';
    pastSection.innerHTML = `<div class="dash-section-title">📅 Recent Sessions</div>`;

    // Collect all past sessions from player history
    const pastMap = {};
    (pastRows || []).forEach(player => {
      (player.sessions || []).forEach(sess => {
        if (!sess.date || sess.date === today) return;
        if (sess.date < sevenDaysAgo) return;
        if (!pastMap[sess.date]) pastMap[sess.date] = { players: [], date: sess.date };
        pastMap[sess.date].players.push({ name: player.name, wins: sess.wins || 0, losses: sess.losses || 0 });
      });
    });

    const pastDates = Object.keys(pastMap).sort().reverse();
    if (pastDates.length) {
      pastDates.forEach(date => {
        const sess = pastMap[date];
        const card = _buildSessionCard({
          clubName: club.name,
          starter: null,
          players: sess.players,
          isLive: false,
          date,
        });
        pastSection.appendChild(card);
      });
    } else {
      pastSection.innerHTML += `<div class="dash-empty-inline">No recent sessions found</div>`;
    }
    container.appendChild(pastSection);

  } catch(e) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">📡</div>
        <p>Could not load sessions.</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">Check your connection.</p>
        <button class="help-retry-btn" onclick="renderDashboard()" style="margin-top:12px">↺ Retry</button>
      </div>`;
  }
}

/* ── Build a session card ── */
function _buildSessionCard({ clubName, starter, players, isLive, date, updatedAt }) {
  const card = document.createElement('div');
  card.className = 'dash-session-card' + (isLive ? ' live' : '');

  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const myName   = myPlayer ? myPlayer.name.toLowerCase() : '';

  const totalRounds = players.length > 0
    ? Math.max(...players.map(p => (p.wins || 0) + (p.losses || 0)))
    : 0;

  const dateLabel = isLive ? 'Today' : _formatDate(date);

  // Top row
  const top = document.createElement('div');
  top.className = 'dash-card-top';
  top.innerHTML = `
    <div class="dash-card-club">${clubName || 'Club'}</div>
    ${isLive
      ? `<div class="dash-live-badge"><div class="dash-live-dot-sm"></div>LIVE</div>`
      : `<div class="dash-past-badge">${dateLabel}</div>`}
  `;
  card.appendChild(top);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'dash-card-meta';
  meta.innerHTML = `
    <span>👥 ${players.length} players</span>
    ${totalRounds ? `<span>🔄 ${totalRounds} rounds</span>` : ''}
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
    const isMe = p.player_name
      ? p.player_name.toLowerCase() === myName
      : (p.name || '').toLowerCase() === myName;
    chip.className = 'dash-chip' + (isMe ? ' me' : '');
    chip.textContent = (p.player_name || p.name || '') + (isMe ? ' ★' : '');
    chips.appendChild(chip);
  });
  if (rest > 0) {
    const more = document.createElement('div');
    more.className = 'dash-chip';
    more.textContent = `+${rest}`;
    chips.appendChild(more);
  }
  card.appendChild(chips);

  // Tap → open rounds tab in read-only
  if (isLive) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => _openSessionRounds(date));
  }

  return card;
}

/* ── Open rounds tab in read-only for this session ── */
function _openSessionRounds(date) {
  const roundsBtn = document.getElementById('tabBtnRounds');
  if (typeof showPage === 'function') {
    showPage('roundsPage', roundsBtn);
  }
  // Ensure viewer restrictions are applied
  if (appMode === 'viewer' && typeof setViewerMode === 'function') {
    setTimeout(() => setViewerMode(true), 100);
  }
}

/* ── Format date ── */
function _formatDate(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const diff  = Math.floor((today - d) / (1000*60*60*24));
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
