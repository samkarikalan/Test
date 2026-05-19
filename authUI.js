/* ============================================================
   authUI.js
   UI functions for auth screens
   ============================================================ */

/* ── Show auth overlay and a specific screen ── */
function authShowScreen(screen) {
  var overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Hide home + mode select
  var homeEl = document.getElementById('homePageOverlay');
  if (homeEl) homeEl.style.display = 'none';
  var modeEl = document.getElementById('modeSelectOverlay');
  if (modeEl) modeEl.style.display = 'none';

  // Show requested screen
  var screenMap = {
    'welcome':  'authWelcome',
    'login':    'authLogin',
    'signup':   'authSignup',
    'forgot':   'authForgot',
    'claim':    'authClaim',
    'joinClub': 'authJoinClub'
  };
  var el = document.getElementById(screenMap[screen]);
  if (el) el.style.display = 'flex';

  // Load clubs for claim dropdown
  if (screen === 'claim') authLoadClaimClubs();

  // Clear errors
  ['loginError','signupError','forgotError','forgotError2','claimError','joinClubError'].forEach(function(id) {
    var err = document.getElementById(id);
    if (err) { err.style.display = 'none'; err.textContent = ''; }
  });
}

/* ── Hide auth overlay ── */
function authHideOverlay() {
  var overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── Show error ── */
function authShowError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/* ── Show loading state on button ── */
function authSetLoading(btnSelector, loading) {
  var btn = document.querySelector(btnSelector);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._origText = btn.textContent;
    btn.textContent = t('pleaseWait');
  } else {
    btn.textContent = btn._origText || btn.textContent;
  }
}

/* ── Do Login ── */
async function authDoLogin() {
  var email    = (document.getElementById('loginEmail')?.value || '').trim();
  var password = (document.getElementById('loginPassword')?.value || '');

  authSetLoading('#authLogin .auth-btn-primary', true);
  var result = await authLogin(email, password);
  authSetLoading('#authLogin .auth-btn-primary', false);

  if (result.error) {
    authShowError('loginError', result.error);
    return;
  }

  // Another device is logged in -- show conflict modal
  if (result.conflict) {
    authShowConflictModal(result.user, result.deviceInfo);
    return;
  }

  // Login success -- proceed (authAfterLogin starts session watch)
  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  authAfterLogin(result.user);
}

/* -- Session conflict modal -- another device is logged in -- */
var _conflictPendingUser = null;

function authShowConflictModal(user, deviceInfo) {
  _conflictPendingUser = user;
  var existing = document.getElementById('scs-conflict-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-conflict-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99998;padding:20px;box-sizing:border-box;';

  modal.innerHTML = '<div style="background:var(--card-bg,#1e1e2e);border-radius:18px;padding:28px 24px;max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5);text-align:center;">'
    + '<div style="font-size:2rem;margin-bottom:12px;">📱</div>'
    + '<div style="font-size:1rem;font-weight:700;color:var(--text,#fff);margin-bottom:8px;">Already Signed In</div>'
    + '<div style="font-size:0.82rem;color:var(--muted,#aaa);line-height:1.5;margin-bottom:22px;">Your account is active on <strong style="color:var(--text,#fff);">' + (deviceInfo || 'another device') + '</strong>. Only one device can be signed in at a time.</div>'
    + '<button id="scsConflictForce" style="width:100%;padding:13px;background:linear-gradient(135deg,#e63757,#c0392b);color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">🔐 Log out other device &amp; sign in</button>'
    + '<button id="scsConflictCancel" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--muted,#aaa);border-radius:12px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>'
    + '</div>';

  document.body.appendChild(modal);

  document.getElementById('scsConflictForce').onclick = async function() {
    this.disabled = true;
    this.textContent = 'Signing in...';
    try {
      var r = await authForceLogin(_conflictPendingUser);
      modal.remove();
      _conflictPendingUser = null;
      if (r && r.user) {
        if (typeof updateProfileBtn === 'function') updateProfileBtn();
        authAfterLogin(r.user);
      } else {
        // Force login failed — show error in modal
        this.disabled = false;
        this.textContent = '🔐 Log out other device & sign in';
        var errEl = modal.querySelector('.scs-conflict-err');
        if (!errEl) {
          errEl = document.createElement('div');
          errEl.className = 'scs-conflict-err';
          errEl.style.cssText = 'font-size:0.78rem;color:#e63757;margin-top:8px;';
          modal.querySelector('div').appendChild(errEl);
        }
        errEl.textContent = 'Network error. Please try again.';
      }
    } catch(e) {
      this.disabled = false;
      this.textContent = '🔐 Log out other device & sign in';
    }
  };

  document.getElementById('scsConflictCancel').onclick = function() {
    modal.remove();
    _conflictPendingUser = null;
    // Return user to login screen cleanly
    if (typeof authShowScreen === 'function') authShowScreen('login');
  };
}

/* ── Do Sign Up ── */
var _pendingSignup = null;

async function authDoSignup() {
  var email        = (document.getElementById('signupEmail')?.value || '').trim();
  var displayName  = (document.getElementById('signupDisplayName')?.value || '').trim();
  var gender       = (document.getElementById('signupGender')?.value || 'Male');
  var password     = (document.getElementById('signupPassword')?.value || '');
  var confirm      = (document.getElementById('signupConfirm')?.value || '');
  var recoveryWord = (document.getElementById('signupRecoveryWord')?.value || '').trim();

  if (!email)                       { authShowError('signupError', t('emailRequired')); return; }
  if (!displayName)                 { authShowError('signupError', t('displayNameRequired') || 'Please enter a display name.'); return; }
  if (!password)                    { authShowError('signupError', t('passwordRequired') || 'Please enter a password.'); return; }
  if (password.length < 6)          { authShowError('signupError', t('passwordTooShort') || 'Password must be at least 6 characters.'); return; }
  if (!confirm)                     { authShowError('signupError', t('confirmPasswordRequired') || 'Please confirm your password.'); return; }
  if (password !== confirm)         { authShowError('signupError', t('passwordsNotMatch')); return; }
  if (!recoveryWord)                { authShowError('signupError', t('recoveryWordRequired') || 'Please enter a recovery keyword.'); return; }

  // Send OTP first
  authSetLoading('#authSignup .auth-btn-primary', true);
  var otpResult = await authSendOtp(email);
  authSetLoading('#authSignup .auth-btn-primary', false);

  if (otpResult.error) { authShowError('signupError', '❌ ' + otpResult.error); return; }

  _pendingSignup = { email, displayName, gender, password, recoveryWord };
  authShowOtpScreen(email, 'signup');
}

async function authCompleteSignup(otp) {
  if (!_pendingSignup) return;
  var { email, displayName, gender, password, recoveryWord } = _pendingSignup;

  var btn = document.getElementById('authOtpSubmitBtn');
  if (btn) btn.disabled = true;
  var verifyResult = await authVerifyOtp(email, otp);
  if (btn) btn.disabled = false;

  if (verifyResult.error) { authShowError('authOtpError', '❌ ' + verifyResult.error); return; }

  var result = await authSignUp(email, password, displayName, gender, recoveryWord);
  if (result.error) { authShowError('authOtpError', result.error); return; }

  var loginResult = await authLogin(email, password);
  if (loginResult.error) { authShowScreen('login'); return; }

  // Signup is fresh account — no conflict expected, but handle defensively
  if (loginResult.conflict) {
    // Force session since this is their own new account
    var forced = await authForceLogin(loginResult.user);
    _pendingSignup = null;
    authHideOtpScreen();
    if (forced && forced.user) authAfterLogin(forced.user);
    return;
  }

  _pendingSignup = null;
  authHideOtpScreen();
  authAfterLogin(loginResult.user);
}

/* ── After successful login -- single entry point for all post-login setup ── */
async function authAfterLogin(user) {
  // ── 1. Start the single session heartbeat (auth.js) ──────
  // This polls active_sessions every 2 mins and kicks out this device
  // if another device has taken over the session token.
  if (typeof _startSessionWatch === 'function') _startSessionWatch();

  // ── 2. Subscription: store email + restore plan + start plan watch ──
  // Does NOT do session check (that is auth.js's job above).
  if (user.email) {
    var _email = user.email.trim().toLowerCase();
    localStorage.setItem('scs_sub_email', _email);
    if (typeof _initTrial      === 'function') _initTrial();
    if (typeof restorePlanByEmail === 'function') {
      restorePlanByEmail(_email).then(function(restored) {
        if (restored && typeof _subToast === 'function')
          _subToast('✅ Plan restored — ' + (typeof getLicensePlan === 'function' ? getLicensePlan().toUpperCase() : ''));
      }).catch(function(){});
    }
    if (typeof startPlanWatch  === 'function') startPlanWatch();
    if (typeof subShowTrialBanner === 'function') subShowTrialBanner();
  }

  // ── 3. Player / UI setup ─────────────────────────────────
  if (typeof setMyPlayer === 'function' && user.nickname) {
    setMyPlayer({ name: user.nickname, gender: 'Male' });
  }
  if (typeof updateProfileBtn === 'function') updateProfileBtn();

  // ── 4. Silent background sync ────────────────────────────
  authSyncPlayerLinks(user).catch(function(){});

  // Check for pending invite
  var pending = (typeof authGetPendingInvite === 'function') ? authGetPendingInvite() : null;
  if (pending) {
    var joinInput = document.getElementById('joinClubCode');
    if (joinInput) joinInput.value = pending;
    authShowScreen('joinClub');
    return;
  }

  // Auto-find all clubs via memberships linked to this user_account
  try {
    var linkedMemberships = await sbGet('memberships',
      'user_account_id=eq.' + user.id + '&select=club_id,nickname');

    if (linkedMemberships && linkedMemberships.length) {
      // Fetch club names separately
      var clubIds = linkedMemberships.map(function(m) { return m.club_id; });
      var clubs = [];
      try {
        clubs = await sbGet('clubs', 'id=in.(' + clubIds.join(',') + ')&select=id,name');
      } catch(e) {}
      var clubMap = {};
      clubs.forEach(function(c) { clubMap[c.id] = c.name; });

      // Enrich memberships with club names
      linkedMemberships = linkedMemberships.map(function(m) {
        return { club_id: m.club_id, nickname: m.nickname, club_name: clubMap[m.club_id] || '' };
      });

      // Set nickname from first membership (all should share same nickname)
      var firstMem = linkedMemberships[0];
      if (typeof setMyPlayer === 'function') setMyPlayer({ name: firstMem.nickname, gender: 'Male' });
      // Set active club to first membership as default (used by organiser/vault modes)
      if (typeof setMyClub === 'function') setMyClub(firstMem.club_id, firstMem.club_name);
      authHideOverlay();
      if (typeof selectMode === 'function') (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
      return;
    }
  } catch(e) { /* offline -- fall through to cached club */ }

  // Check cached club
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (club && club.id) {
    authHideOverlay();
    if (typeof selectMode === 'function') (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
    return;
  }

  // No club found -- go straight to mode select (user can join clubs from viewer/home)
  authHideOverlay();
  var overlay = document.getElementById('modeSelectOverlay');
  if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
}

function authShowClubPicker(memberships, user) {
  // Show a simple sheet to pick which club to enter
  var overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub','authClaim'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Build club picker screen
  var picker = document.getElementById('authClubPicker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'authClubPicker';
    picker.className = 'auth-screen';
    overlay.appendChild(picker);
  }
  picker.style.display = '';
  picker.innerHTML = '<div class="auth-title">' + t('selectClubTitle') + '</div>' +
    '<div class="auth-sub">' + t('youMemberMultipleClubs') + '</div>' +
    memberships.map(function(m) {
      var cid   = m.club_id;
      var cname = m.club_name || cid;
      var nick  = m.nickname;
      return '<button class="auth-club-pick-btn" onclick="authPickClub(\''+cid+'\',\''+cname+'\',\''+nick+'\')">'+
        '<strong>'+cname+'</strong><span>'+nick+'</span></button>';
    }).join('');
  // Apply current language to dynamically built screen
  if (typeof setLanguage === 'function' && typeof currentLang !== 'undefined') setLanguage(currentLang);
}

async function authPickClub(clubId, clubName, nickname) {
  if (typeof setMyClub   === 'function') setMyClub(clubId, clubName);
  if (typeof setMyPlayer === 'function') setMyPlayer({ name: nickname, gender: 'Male' });
  authHideOverlay();
  if (typeof selectMode === 'function') (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
}

/* ── Do Forgot Password -- recovery keyword ── */
async function authDoForgotReset() {
  var email        = (document.getElementById('forgotEmail')?.value || '').trim();
  var recoveryWord = (document.getElementById('forgotRecoveryWord')?.value || '').trim();
  var newPw        = (document.getElementById('forgotNewPw')?.value || '');
  var confirmPw    = (document.getElementById('forgotConfirmPw')?.value || '');

  if (newPw !== confirmPw) {
    authShowError('forgotError', t('passwordsNotMatch'));
    return;
  }

  authSetLoading('#authForgot .auth-btn-primary', true);
  var result = await authResetPassword(email, recoveryWord, newPw);
  authSetLoading('#authForgot .auth-btn-primary', false);

  if (result.error) {
    authShowError('forgotError', result.error);
    return;
  }

  authShowError('forgotError', t('passwordReset'));
  document.getElementById('forgotError').style.color = 'var(--green, #2dce89)';
  setTimeout(function() { authShowScreen('login'); }, 1500);
}

/* ── Do Join Club ── */
async function authDoJoinClub() {
  var code = (document.getElementById('joinClubCode')?.value || '').trim().toUpperCase();

  authSetLoading('#authJoinClub .auth-btn-primary', true);
  var result = await authJoinClub(code);
  authSetLoading('#authJoinClub .auth-btn-primary', false);

  if (result.error) {
    authShowError('joinClubError', result.error);
    return;
  }

  // Clear pending invite
  if (typeof authClearPendingInvite === 'function') authClearPendingInvite();

  // Success -- go to app
  authHideOverlay();
  if (typeof updateProfileBtn === 'function') updateProfileBtn();
  (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
}

/* ── Skip join club ── */
function authSkipJoin() {
  authHideOverlay();
  (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
}

/* ── Logout ── */
function authDoLogout() {
  // Immediately hide all overlays to prevent content flash
  var modeOverlay = document.getElementById('modeSelectOverlay');
  if (modeOverlay) modeOverlay.style.display = 'none';
  var homeOverlay = document.getElementById('homePageOverlay');
  if (homeOverlay) homeOverlay.style.display = 'none';
  document.querySelectorAll('.page').forEach(function(p) { p.style.display = 'none'; });

  if (typeof authLogout === 'function') authLogout();
  // Reset app state
  if (typeof ResetAll === 'function') ResetAll();
  authShowScreen('welcome');
}

/* ── Club search UI ── */
var _searchTimeout = null;
function authSearchClubsUI(query) {
  clearTimeout(_searchTimeout);
  var resultsEl = document.getElementById('joinClubResults');
  var errorEl   = document.getElementById('joinClubError');
  var pendingEl = document.getElementById('joinClubPending');
  if (errorEl)   { errorEl.style.display = 'none'; }
  if (pendingEl) { pendingEl.style.display = 'none'; }

  if (!query || query.trim().length < 2) {
    if (resultsEl) resultsEl.style.display = 'none';
    return;
  }

  if (resultsEl) {
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div class="auth-club-loading">' + t('searching') + '</div>';
  }

  _searchTimeout = setTimeout(async function() {
    var result = await authSearchClubs(query);
    if (result.error) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">' + t('searchFailed') + '</div>';
      return;
    }
    if (!result.clubs || !result.clubs.length) {
      if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-empty">' + t('noClubsFound') + '</div>';
      return;
    }
    if (resultsEl) {
      resultsEl.innerHTML = result.clubs.map(function(club) {
        return '<div class="auth-club-item" onclick="authDoRequestJoin(\'' + club.id + '\',\'' + club.name.replace(/'/g, "\\'") + '\')">' +
          '<div class="auth-club-item-name">🏢 ' + club.name + '</div>' +
          '<div class="auth-club-item-btn">' + t('requestToJoin') + '</div>' +
          '</div>';
      }).join('');
    }
  }, 400);
}

/* ── Request to join a club ── */
async function authDoRequestJoin(clubId, clubName) {
  var resultsEl = document.getElementById('joinClubResults');
  var errorEl   = document.getElementById('joinClubError');
  var pendingEl = document.getElementById('joinClubPending');

  if (errorEl) { errorEl.style.display = 'none'; }
  if (resultsEl) resultsEl.innerHTML = '<div class="auth-club-loading">' + t('sendingRequest') + '</div>';

  var result = await authRequestJoin(clubId);

  if (result.error) {
    if (resultsEl) resultsEl.style.display = 'none';
    if (errorEl) { errorEl.textContent = result.error; errorEl.style.display = 'block'; }
    return;
  }

  if (result.alreadyMember) {
    // Already member -- go straight to app
    authHideOverlay();
    (function() {
  var saved = sessionStorage.getItem('appMode') || localStorage.getItem('kbrr_app_mode');
  if (saved) {
    selectMode(saved);
  } else {
    // First login — show mode select screen
    var overlay = document.getElementById('modeSelectOverlay');
    if (overlay) { overlay.style.display = 'flex'; if (typeof mlSyncLangDisplay === 'function') mlSyncLangDisplay(); }
  }
})();
    return;
  }

  // Show pending state
  if (resultsEl) resultsEl.style.display = 'none';
  if (pendingEl) pendingEl.style.display = 'flex';

  // Store pending club info
  localStorage.setItem('pending_club_id', clubId);
  localStorage.setItem('pending_club_name', clubName);
}

/* ── Load join requests for admin (Vault Requests tab) ── */

function authToggleLang() {
  var p = document.getElementById('authLangPicker');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
function authSelectLang(code, flag, label) {
  var cur = document.getElementById('authLangCurrent');
  if (cur) cur.textContent = flag + ' ' + label + ' ▾';
  var p = document.getElementById('authLangPicker');
  if (p) p.style.display = 'none';
  if (typeof setLanguage === 'function') setLanguage(code);
}


/* ── Report page ── */
function r2Init() {
  const now  = new Date();
  const yearEl = document.getElementById('r2Year');
  if (yearEl) yearEl.textContent = now.getFullYear();
  r2BuildClubPicker();
  r2BuildMonths(now.getFullYear(), now.getMonth() + 1);
  r2SelectMonth(now.getMonth() + 1);
}

// Build the club filter pill row (All | Club A | Club B ...)
async function r2BuildClubPicker() {
  var container = document.getElementById('r2ClubPicker');
  if (!container) return;
  var authUser = (typeof authGetUser === 'function') ? authGetUser() : null;
  if (!authUser) { container.style.display = 'none'; return; }

  var clubs = [];
  try {
    var mems = await sbGet('memberships',
      'user_account_id=eq.' + authUser.id + '&select=club_id,clubs(name)').catch(function(){ return []; });
    clubs = mems.map(function(m){ return { id: m.club_id, name: m.clubs && m.clubs.name ? m.clubs.name : m.club_id }; });
  } catch(e) {}

  if (clubs.length <= 1) { container.style.display = 'none'; return; }

  container.style.display = 'flex';
  var pills = [{ id: null, name: 'All' }].concat(clubs);
  container.innerHTML = pills.map(function(c, i) {
    var active = i === 0;
    return '<button onclick="r2SelectClub(' + (c.id ? '\'' + c.id + '\'' : 'null') + ',this)" ' +
      'class="r2-pill' + (active ? ' active-club' : '') + '">' +
      c.name + '</button>';
  }).join('');
}

var _r2SelectedClub = null;
function r2SelectClub(clubId, btn) {
  _r2SelectedClub = clubId || null;
  var container = document.getElementById('r2ClubPicker');
  if (container) {
    container.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active-club', b === btn);
    });
  }
  vaultLoadReport();
}

function r2BuildMonths(year, activeMonth) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const container = document.getElementById('r2Months');
  if (!container) return;
  container.innerHTML = months.map(function(m, i) {
    var isActive = (i + 1) === activeMonth;
    return '<button onclick="r2SelectMonth(' + (i+1) + ')" data-month="' + (i+1) + '" ' +
      'class="r2-pill' + (isActive ? ' active-month' : '') + '"' +
      (isActive ? ' id="r2ActiveMonth"' : '') + '>' + m + '</button>';
  }).join('');
}

function r2SelectMonth(month) {
  document.querySelectorAll('#r2Months button').forEach(function(btn) {
    var isActive = parseInt(btn.dataset.month) === month;
    btn.classList.toggle('active-month', isActive);
    btn.id = isActive ? 'r2ActiveMonth' : (btn.id === 'r2ActiveMonth' ? '' : btn.id);
  });
  vaultLoadReport();
}

function r2ChangeYear(dir) {
  var yearEl = document.getElementById('r2Year');
  if (!yearEl) return;
  yearEl.textContent = parseInt(yearEl.textContent) + dir;
  vaultLoadReport();
}

function vaultLoadReport() {
  const yearEl  = document.getElementById('r2Year');
  const monthEl = document.getElementById('r2ActiveMonth');
  const ct      = document.getElementById('r2Content');
  const year    = yearEl  ? parseInt(yearEl.textContent)    : new Date().getFullYear();
  const month   = monthEl ? parseInt(monthEl.dataset.month) : new Date().getMonth() + 1;
  if (ct) ct.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);">⏳ Loading...</div>';
  if (typeof reportFetchMonthData !== 'function') {
    if (ct) ct.innerHTML = '<div style="padding:24px;text-align:center;color:#e63757;">❌ Report module not loaded</div>';
    return;
  }
  var selectedClub = (typeof _r2SelectedClub !== 'undefined') ? _r2SelectedClub : null;
  reportFetchMonthData(year, month, selectedClub).then(function(data) {
    reportRenderViewerPage(data);
  }).catch(function(e) {
    if (ct) ct.innerHTML = '<div style="padding:24px;text-align:center;color:#e63757;">❌ ' + (e.message || 'Failed to load') + '</div>';
  });
}


/* ============================================================
   VIEWER QC MODULE
   Checks each home tile and auto-fixes silently.
   Shows message only if cannot fix.
============================================================ */
async function viewerQCCheck() {
  const fixes = [];
  const msgs  = [];

  // ── QC 1: My Card ──
  const ratingEl = document.getElementById('homeTileRatingV');
  const nameEl   = document.getElementById('homeTileNameV');
  const ratingTxt = ratingEl ? ratingEl.textContent : '';
  if (!ratingTxt || ratingTxt === 'Not selected' || ratingTxt === 'Loading...') {
    // Try fix: refresh screen
    try {
      if (typeof homeRefreshScreen === 'function') await homeRefreshScreen();
      fixes.push('My Card refreshed');
    } catch(e) {
      msgs.push('My Card: Please select your player profile');
    }
  }
  viewerQCDot('myCardQC', ratingTxt && ratingTxt !== 'Not selected' && ratingTxt !== 'Loading...' ? 'green' : 'yellow');

  // ── QC 2: Dashboard ──
  const dashEl  = document.getElementById('tileSubDashboardV');
  const dashTxt = dashEl ? dashEl.textContent : '';
  if (!dashTxt || dashTxt === 'Loading...') {
    try {
      if (typeof dbGetLiveSessions === 'function') {
        const sessions = await dbGetLiveSessions();
        const count = (sessions || []).length;
        if (dashEl) dashEl.textContent = count > 0 ? count + ' live session' + (count !== 1 ? 's' : '') : 'No live sessions';
        fixes.push('Dashboard refreshed');
      }
    } catch(e) {
      msgs.push('Dashboard: Connection issue');
    }
  }
  viewerQCDot('dashQC', dashTxt && dashTxt !== 'Loading...' ? 'green' : 'yellow');

  // ── QC 3: My Clubs ──
  const club = (typeof getMyClub === 'function') ? getMyClub() : null;
  if (!club || !club.id) {
    try {
      if (typeof homeRefreshJoinClubTile === 'function') await homeRefreshJoinClubTile();
      fixes.push('My Clubs refreshed');
    } catch(e) {}
    const clubOk = club && club.id;
    if (!clubOk) msgs.push('My Clubs: Please join or select a club');
    viewerQCDot('clubsQC', clubOk ? 'green' : 'red');
  } else {
    viewerQCDot('clubsQC', 'green');
  }

  // ── QC 4: Report ──
  // Report just checks if club is set
  viewerQCDot('reportQC', club && club.id ? 'green' : 'yellow');

  // Show message if needed
  if (msgs.length > 0) {
    viewerQCShowMsg(msgs.join(' · '));
  }
}

function viewerQCDot(id, color) {
  var el = document.getElementById(id);
  if (!el) return;
  var colors = { green: '#1db954', yellow: '#f59e0b', red: '#e63757' };
  el.style.background = colors[color] || colors.yellow;
  el.style.display = 'block';
}

function viewerQCShowMsg(msg) {
  var existing = document.getElementById('viewerQCMsg');
  if (existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'viewerQCMsg';
  div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--surface,#1e1e2e);color:var(--text,#fff);padding:10px 18px;border-radius:20px;font-size:0.78rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);max-width:90vw;text-align:center;border:1px solid var(--border,#2a2a4a);';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(function() { div.remove(); }, 4000);
}

async function vaultLoadRequests() {
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  var listEl = document.getElementById('vaultRequestsList');
  if (!listEl) return;

  if (!club || !club.id) {
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('connectClubFirst') + '</div>';
    return;
  }

  listEl.innerHTML = '<div class="profile-sessions-loading">Loading...</div>';
  var result = await authGetJoinRequests(club.id);

  if (result.error) {
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('failedLoadRequests') + '</div>';
    return;
  }

  if (!result.requests || !result.requests.length) {
    listEl.innerHTML = '<div class="profile-sessions-empty">' + t('noPendingRequests') + '</div>';
    return;
  }

  listEl.innerHTML = result.requests.map(function(req) {
    return '<div class="vault-request-card">' +
      '<div class="vault-request-info">' +
        '<div class="vault-request-name">' + req.nickname + '</div>' +
        '<div class="vault-request-id">' + req.email + '</div>' +
      '</div>' +
      '<div class="vault-request-actions">' +
        '<button class="vault-request-accept" onclick="vaultAcceptRequest(\'' + req.requestId + '\',\'' + req.userAccountId + '\',\'' + req.nickname.replace(/'/g, "\\'") + '\',this)">✓ Accept</button>' +
        '<button class="vault-request-reject" onclick="vaultRejectRequest(\'' + req.requestId + '\',this)">✗ Reject</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ── Accept request ── */
async function vaultAcceptRequest(requestId, userAccountId, nickname, btn) {
  var club = (typeof getMyClub === 'function') ? getMyClub() : { id: null };
  if (!club || !club.id) return;

  // Show loading state on button
  var acceptBtn = btn || event.target;
  var originalText = acceptBtn ? acceptBtn.textContent : '';
  if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.textContent = '⏳ Accepting...'; }

  var result = await authAcceptRequest(requestId, club.id, userAccountId, nickname, 'Male');

  if (result.error) {
    if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = originalText; }
    if (typeof showToast === 'function') showToast('❌ Failed: ' + result.error);
    else alert('Failed: ' + result.error);
    return;
  }

  // Success feedback
  if (typeof showToast === 'function') showToast('✅ ' + nickname + ' accepted and added to club!');

  // Invalidate player cache and resync so organiser sees the new player immediately
  localStorage.removeItem('kbrr_cache_players');
  localStorage.removeItem('kbrr_cache_ts');
  if (typeof syncToLocal === 'function') await syncToLocal();

  // Refresh the requests list and home tiles
  vaultLoadRequests();
  if (typeof homeRefreshTiles === 'function') homeRefreshTiles();
}

/* ── Reject request ── */
async function vaultRejectRequest(requestId, btn) {
  var rejectBtn = btn || event.target;
  var originalText = rejectBtn ? rejectBtn.textContent : '';
  if (rejectBtn) { rejectBtn.disabled = true; rejectBtn.textContent = '⏳...'; }

  var result = await authRejectRequest(requestId);

  if (result.error) {
    if (rejectBtn) { rejectBtn.disabled = false; rejectBtn.textContent = originalText; }
    if (typeof showToast === 'function') showToast('❌ Failed: ' + result.error);
    else alert('Failed: ' + result.error);
    return;
  }

  if (typeof showToast === 'function') showToast('🚫 Request rejected.');
  vaultLoadRequests();
}

/* ── OTP Screen ── */
var _otpContext = null; // 'signup' | 'claim'

function authShowOtpScreen(email, context) {
  _otpContext = context;
  var overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'flex';

  // Hide all screens
  ['authWelcome','authLogin','authSignup','authForgot','authJoinClub','authClaim','authClubPicker'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Build or show OTP screen
  var otpScreen = document.getElementById('authOtpScreen');
  if (!otpScreen) {
    otpScreen = document.createElement('div');
    otpScreen.id = 'authOtpScreen';
    otpScreen.className = 'auth-screen';
    document.getElementById('authOverlay').appendChild(otpScreen);
  }
  otpScreen.style.display = '';
  otpScreen.innerHTML =
    '<div class="auth-title">' + t('verifyEmailTitle') + '</div>' +
    '<div class="auth-sub" style="margin-bottom:16px">Enter the 6-digit code sent to<br><strong>' + email + '</strong></div>' +
    '<input id="authOtpInput" class="auth-input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" style="letter-spacing:8px;font-size:1.2rem;text-align:center;">' +
    '<div id="authOtpError" class="auth-error" style="display:none"></div>' +
    '<button id="authOtpSubmitBtn" class="auth-btn auth-btn-primary" onclick="authSubmitOtp()" style="margin-top:12px;">' + t('verifyBtn') + '</button>' +
    '<button class="auth-btn auth-btn-secondary" onclick="authResendOtp(\'' + email + '\')" style="margin-top:8px;">' + t('resendCode') + '</button>';

  setTimeout(function() {
    var inp = document.getElementById('authOtpInput');
    if (inp) inp.focus();
  }, 100);
}

function authHideOtpScreen() {
  var otpScreen = document.getElementById('authOtpScreen');
  if (otpScreen) otpScreen.style.display = 'none';
}

async function authSubmitOtp() {
  var otp = (document.getElementById('authOtpInput')?.value || '').trim();
  if (otp.length !== 6) { authShowError('authOtpError', t('enterSixDigitHint')); return; }
  if (_otpContext === 'signup') await authCompleteSignup(otp);
  if (_otpContext === 'claim')  await authCompleteClaim(otp);
}

async function authResendOtp(email) {
  var result = await authSendOtp(email);
  if (result.error) {
    authShowError('authOtpError', result.error);
  } else {
    authShowError('authOtpError', t('codeResent'));
    document.getElementById('authOtpError').style.color = 'var(--green,#2dce89)';
    document.getElementById('authOtpError').style.display = '';
  }
}

function authShowError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = ''; }
}

/* ── Claim Account with OTP verification ── */
var _pendingClaim = null;

async function authDoClaimAccount() {
  var clubId       = (document.getElementById('claimClubSelect')?.value || '').trim();
  var nickname     = (document.getElementById('claimNickname')?.value || '').trim();
  var defaultPw    = (document.getElementById('claimDefaultPassword')?.value || '').trim();
  var email        = (document.getElementById('claimEmail')?.value || '').trim();
  var newPassword  = (document.getElementById('claimPassword')?.value || '');
  var confirmPw    = (document.getElementById('claimConfirm')?.value || '');
  var recoveryWord = (document.getElementById('claimRecoveryWord')?.value || '').trim();
  var errEl        = document.getElementById('claimError');

  var setErr = function(msg) { if (errEl) { errEl.textContent = msg; errEl.style.display = ''; } };

  if (!clubId)      { setErr(t('selectYourClub')); return; }
  if (!nickname)    { setErr(t('enterYourNickname')); return; }
  if (!defaultPw)   { setErr(t('enterDefaultPassword')); return; }
  if (!email)       { setErr('Enter your email'); return; }
  if (newPassword.length < 6) { setErr('Password must be at least 6 characters'); return; }
  if (newPassword !== confirmPw) { setErr(t('passwordsNotMatch')); return; }

  // Send OTP to verify email
  setErr(t('sendingVerification'));
  errEl.style.color = 'var(--accent,#6c63ff)';
  var otpResult = await authSendOtp(email);
  if (otpResult.error) { errEl.style.color = ''; setErr(otpResult.error); return; }

  // Store claim data and show OTP screen
  _pendingClaim = { clubId, nickname, defaultPw, email, newPassword, recoveryWord };
  authShowOtpScreen(email, 'claim');
}

async function authCompleteClaim(otp) {
  if (!_pendingClaim) return;
  var { clubId, nickname, defaultPw, email, newPassword, recoveryWord } = _pendingClaim;

  var verifyResult = await authVerifyOtp(email, otp);
  if (verifyResult.error) { authShowError('authOtpError', verifyResult.error); return; }

  // OTP verified -- complete claim
  var result = await authClaimAccount(clubId, nickname, defaultPw, email, newPassword, recoveryWord);
  if (result.error) { authShowError('authOtpError', result.error); return; }

  _pendingClaim = null;
  authHideOtpScreen();
  authAfterLogin(result.user);
}

/* ============================================================
   QC MODULE v1.0
   Watches viewer / organiser / vault modes
   Auto-fixes silently. Toast only if can't fix.
   Update this module as app grows.
============================================================ */

var _qcTimer      = null;
var _qcMode       = null;
var _qcInterval   = 5000; // check every 5s

function qcStart(mode) {
  qcStop(); // clear any existing
  _qcMode = mode;
  _qcRun();
  _qcTimer = setInterval(_qcRun, _qcInterval);
}

function qcStop() {
  if (_qcTimer) { clearInterval(_qcTimer); _qcTimer = null; }
  _qcMode = null;
}

async function _qcRun() {
  // ── Settings (all modes) ──────────────────────────────────
  _qcApplySettings();

  if (_qcMode === 'viewer')     await _qcViewer();
  if (_qcMode === 'organiser')  await _qcOrganiser();
  if (_qcMode === 'vault')      await _qcVault();
}

// ── Settings fix ─────────────────────────────────────────────
function _qcApplySettings() {
  try {
    const theme = localStorage.getItem('app-theme');
    const font  = localStorage.getItem('appFontSize');
    const tile  = localStorage.getItem('kbrr_tile_style');
    const lang  = localStorage.getItem('kbrr_lang');
    if (theme && typeof applyTheme    === 'function') applyTheme(theme);
    if (font  && typeof setFontSize   === 'function') setFontSize(font);
    if (tile  && typeof setTileStyle  === 'function') setTileStyle(tile);
    if (lang  && typeof setLanguage   === 'function') setLanguage(lang);
  } catch(e) {}
}

// ── Viewer QC ─────────────────────────────────────────────────
async function _qcViewer() {
  // License integrity check
  try {
    if (typeof qcCheckLicense === 'function') await qcCheckLicense();
  } catch(e) {}

  // My Card
  try {
    const ratingEl = document.getElementById('homeTileRatingV');
    const txt = ratingEl ? ratingEl.textContent : '';
    if (!txt || txt === 'Loading...' || txt === 'Not selected') {
      if (typeof homeRefreshTiles === 'function') await homeRefreshTiles();
    }
  } catch(e) {}

  // Dashboard
  try {
    const dashEl = document.getElementById('tileSubDashboardV');
    if (dashEl && dashEl.textContent === 'Loading...') {
      const sessions = typeof dbGetLiveSessions === 'function' ? await dbGetLiveSessions() : [];
      const count = (sessions||[]).length;
      dashEl.textContent = count > 0 ? count + ' live session' + (count!==1?'s':'') : 'No live sessions';
    }
  } catch(e) {}

  // Active club
  try {
    const club = typeof getMyClub === 'function' ? getMyClub() : null;
    if (!club || !club.id) {
      if (typeof homeRefreshJoinClubTile === 'function') await homeRefreshJoinClubTile();
    }
  } catch(e) {}
}

// ── Organiser QC ──────────────────────────────────────────────
async function _qcOrganiser() {
  // License integrity check
  try {
    if (typeof qcCheckLicense === 'function') await qcCheckLicense();
  } catch(e) {}

  // Players loaded
  try {
    const players = typeof getActivePlayers === 'function' ? getActivePlayers() : [];
    if (!players || players.length === 0) {
      if (typeof syncToLocal === 'function') syncToLocal();
    }
  } catch(e) {}

  // Courts set - read from DOM element like the app does
  try {
    const courtsEl = document.getElementById('num-courts');
    const courts = courtsEl ? parseInt(courtsEl.textContent || '0') : 1;
    if (courtsEl && courts === 0) {
      _qcToast('⚠️ No courts set — please configure in Settings');
    }
  } catch(e) {}

  // Cost edit: verify session entries have session_id for reliable cost editing
  // (new sessions will have it, old ones won't — no action needed, just informational)
}

// ── Vault QC ──────────────────────────────────────────────────
async function _qcVault() {
  // Logged in
  try {
    const user = typeof authGetUser === 'function' ? authGetUser() : null;
    if (!user) {
      _qcToast('⚠️ Not logged in — please sign in to Vault');
      return;
    }
  } catch(e) {}

  // Club selected
  try {
    const club = typeof getMyClub === 'function' ? getMyClub() : null;
    if (!club || !club.id) {
      if (typeof homeRefreshJoinClubTile === 'function') await homeRefreshJoinClubTile();
    }
  } catch(e) {}

  // Sync status
  try {
    if (typeof vaultSyncStatus === 'function') vaultSyncStatus();
  } catch(e) {}
}

// ── Toast ─────────────────────────────────────────────────────
function _qcToast(msg) {
  var existing = document.getElementById('qcToast');
  if (existing && existing.textContent === msg) return; // don't repeat same msg
  if (existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'qcToast';
  div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:var(--surface,#1e1e2e);color:var(--text,#fff);padding:10px 18px;border-radius:20px;' +
    'font-size:0.78rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);' +
    'max-width:90vw;text-align:center;pointer-events:none;border:1px solid var(--border,#2a2a4a);';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(function() { div.remove(); }, 4000);
}
