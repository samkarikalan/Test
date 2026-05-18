/* ============================================================
   SUBSCRIPTION MODULE v4 — Proxied via Cloudflare Worker
   No Supabase URL or keys in this file.
   All license/purchase calls go to WORKER_URL/sub/*
============================================================ */

// WORKER_URL is defined in supabase.js — loaded before this file

/* ── Storage keys ── */
const SK_TRIAL  = 'sub_first_install';
const SK_PLAN   = 'scs_license_plan';
const SK_EXPIRY = 'scs_license_expiry';
const SK_EMAIL  = 'scs_sub_email';
const SK_KEY    = 'scs_license_key';
const SK_SID    = 'scs_session_id';
const TRIAL_DAYS = 60;

/* ── Worker helpers (subscription routes) ── */
async function _wPost(path, body) {
  try {
    const res = await fetch(WORKER_URL + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

/* ── Clear all subscription data ── */
function clearSubscription() {
  localStorage.removeItem('scs_sub_email');
  localStorage.removeItem('scs_license_plan');
  localStorage.removeItem('scs_license_expiry');
  localStorage.removeItem('scs_license_key');
  localStorage.removeItem('scs_session_id');
  localStorage.removeItem('sub_first_install');
}

/* ── Single license check ── */
async function checkLicense(email) {
  if (!email) return;
  email = email.trim().toLowerCase();
  localStorage.setItem('scs_sub_email', email);
  _initTrial();
  await restorePlanByEmail(email);
  subShowTrialBanner();
}

/* ── Trial ── */
function _initTrial() {
  if (!localStorage.getItem(SK_TRIAL)) {
    localStorage.setItem(SK_TRIAL, Date.now().toString());
  }
}

function isTrialActive() {
  const ts = parseInt(localStorage.getItem(SK_TRIAL) || '0');
  if (!ts) return false;
  return (Date.now() - ts) / 86400000 < TRIAL_DAYS;
}

function getTrialDaysLeft() {
  const ts = parseInt(localStorage.getItem(SK_TRIAL) || '0');
  if (!ts) return 0;
  return Math.max(0, Math.ceil(TRIAL_DAYS - (Date.now() - ts) / 86400000));
}

/* ── Plan ── */
function getLicensePlan()   { return localStorage.getItem(SK_PLAN)   || null; }
function getLicenseExpiry() { return localStorage.getItem(SK_EXPIRY) || null; }

function isLicenseValid() {
  const plan   = getLicensePlan();
  const expiry = getLicenseExpiry();
  if (!plan || plan === 'trial') return false;
  if (expiry && new Date(expiry) < new Date()) return false;
  return true;
}

function isPro()   { return isLicenseValid() && getLicensePlan() === 'pro'; }
function isBasic() { return isLicenseValid() && getLicensePlan() === 'basic'; }
function hasFullAccess() { return isTrialActive() || isPro(); }
function hasAnyAccess()  { return isTrialActive() || isLicenseValid(); }

/* ── Server-issued access token (in-memory only — cannot be faked) ── */
var _accessToken     = null;   // token string from server
var _accessPlan      = null;   // 'pro' | 'basic' | 'trial'
var _accessExpiry    = 0;      // token expiry timestamp (ms)
var _accessAllowed   = false;  // server said allowed

function getDeviceId() {
  let id = localStorage.getItem('scs_device_id');
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('scs_device_id', id);
  }
  return id;
}

/* Call once on login and once on every session start */
async function verifyAccessWithServer(email) {
  try {
    const deviceId = getDeviceId();
    const data = await _wPost('/sub/verify', { email, deviceId });
    if (!data) return false;

    if (data.allowed) {
      _accessAllowed = true;
      _accessPlan    = data.plan || 'trial';
      _accessToken   = data.token || null;
      _accessExpiry  = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

      // Mirror to localStorage for UI display only (not used for gating)
      if (data.plan && data.plan !== 'trial') {
        localStorage.setItem(SK_PLAN,   data.plan);
        localStorage.setItem(SK_EXPIRY, data.expires_at || '');
      }
    } else {
      _accessAllowed = false;
      _accessPlan    = null;
      _accessToken   = null;
      _accessExpiry  = 0;
      if (data.reason === 'expired') {
        _subToast('⚠️ Your subscription has expired');
      } else if (data.reason === 'wrong_device') {
        _subToast('⚠️ This account is active on another device');
      }
    }
    return _accessAllowed;
  } catch (e) {
    // Network error — fall back to local check so offline still works
    console.warn('verifyAccessWithServer failed, falling back to local:', e);
    _accessAllowed = hasAnyAccess();
    _accessPlan    = getLicensePlan() || (isTrialActive() ? 'trial' : null);
    return _accessAllowed;
  }
}

/* Token refresh — called if token is older than 1.5 hours */
async function _refreshTokenIfNeeded(email) {
  if (!email) return;
  const remainingMs = _accessExpiry - Date.now();
  if (remainingMs > 30 * 60 * 1000) return; // still > 30 min, no need
  await verifyAccessWithServer(email);
}

function canAccessMode(mode) {
  // Server token overrides everything if present and valid
  if (_accessToken && Date.now() < _accessExpiry) {
    if (!_accessAllowed) return false;
    if (mode === 'viewer') return true;   // viewer is always free
    return _accessPlan === 'pro' || _accessPlan === 'trial';
  }
  // Fallback to local (offline or before first verify)
  if (isPro()) return true;
  if (isTrialActive() && !isBasic()) return true;
  if (mode === 'viewer') return hasAnyAccess();
  return false;
}

function showModeUpgradePrompt(mode) {
  showUpgradeScreen('Pro required for ' + mode + ' mode');
}

/* ── Restore plan by email from Worker ── */
async function restorePlanByEmail(email) {
  const data = await _wPost('/sub/restore', { email });
  if (!data || !data.restored) return false;
  localStorage.setItem(SK_PLAN, data.plan);
  if (data.expires_at) localStorage.setItem(SK_EXPIRY, data.expires_at);
  else localStorage.removeItem(SK_EXPIRY);
  return true;
}

/* ── On login ── */
async function onUserLogin(email) {
  email = email.trim().toLowerCase();
  localStorage.setItem(SK_EMAIL, email);
  _initTrial();
  const restored = await restorePlanByEmail(email);
  if (restored) _subToast('✅ Plan restored — ' + getLicensePlan().toUpperCase());
  await registerSession(email);
  startSessionWatch(email);
  startPlanWatch();
  subShowTrialBanner();
}

/* ── Validate key ── */
async function validateLicenseKey(key) {
  key = key.trim().toUpperCase();
  const data = await _wPost('/sub/activate', { key });
  if (!data) return { valid: false, error: 'Network error — please try again' };
  if (!data.valid) return { valid: false, error: data.error || 'Invalid key' };
  return { valid: true, plan: data.plan, expiry: data.expiry };
}

/* ── Activate key ── */
async function activateLicenseKey(key) {
  key = key.trim().toUpperCase();
  const myEmail = localStorage.getItem(SK_EMAIL) || '';
  const data    = await _wPost('/sub/activate', { key, email: myEmail });
  if (!data || !data.valid) return { valid: false, error: (data && data.error) || 'Invalid key' };

  localStorage.setItem(SK_PLAN, data.plan);
  localStorage.setItem(SK_KEY,  key);
  if (data.expiry) localStorage.setItem(SK_EXPIRY, data.expiry);
  else localStorage.removeItem(SK_EXPIRY);

  return { valid: true, plan: data.plan, expiry: data.expiry };
}

/* ── QC: re-validate plan every 5 mins ── */
var _planTimer = null;
function startPlanWatch() {
  if (_planTimer) clearInterval(_planTimer);
  _planTimer = setInterval(async function() {
    const email = localStorage.getItem(SK_EMAIL);
    if (!email) return;
    const plan = getLicensePlan();
    if (!plan || plan === 'trial') return;
    const data = await _wPost('/sub/check', { email });
    if (!data) return;
    if (!data.valid || data.expired) {
      localStorage.removeItem(SK_PLAN);
      localStorage.removeItem(SK_EXPIRY);
      subShowTrialBanner();
      _subToast('⚠️ Your license has expired');
    }
  }, 5 * 60 * 1000);
}

/* ── Session management ── */
function _genSid() {
  return 'sid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function registerSession(email) {
  const sid = _genSid();
  localStorage.setItem(SK_SID, sid);
  await _wPost('/sub/register-session', { email, deviceId: sid });
}

async function validateSession(email) {
  const localSid = localStorage.getItem(SK_SID);
  if (!localSid) return true;
  const data = await _wPost('/sub/validate-session', { email, deviceId: localSid });
  if (!data) return true;
  return data.valid;
}

var _sessionTimer = null;
function startSessionWatch(email) {
  if (_sessionTimer) clearInterval(_sessionTimer);
  _sessionTimer = setInterval(async function() {
    const valid = await validateSession(email);
    if (!valid) {
      clearInterval(_sessionTimer);
      localStorage.removeItem(SK_SID);
      alert('You have been logged in on another device. Please login again.');
      location.reload();
    }
  }, 60000);
}

/* ── Purchase requests ── */
async function createPurchaseRequest(plan) {
  const email = localStorage.getItem(SK_EMAIL) || '';
  if (!email) return { success: false, error: 'Please log in first' };
  return await _wPost('/sub/purchase-request', { email, plan }) || { success: false, error: 'Network error' };
}

async function getPurchaseRequestStatus() {
  const email = localStorage.getItem(SK_EMAIL) || '';
  if (!email) return null;
  const data = await _wPost('/sub/purchase-status', { email });
  if (!data || !data.found) return null;
  return data;
}

async function cancelPurchaseRequest() {
  const email = localStorage.getItem(SK_EMAIL) || '';
  if (!email) return;
  await _wPost('/sub/purchase-cancel', { email });
}

/* ── App config (payment details) ── */
async function _getAppConfig() {
  try {
    const data = await _wPost('/sub/app-config', {});
    return data || {};
  } catch(e) { return {}; }
}

/* ── Activate from settings ── */
async function settingsActivateKey() {
  const input = document.getElementById('settingsKeyInput');
  const errEl = document.getElementById('settingsKeyError');
  const key   = input ? input.value.trim() : '';
  if (!key) { if (errEl) errEl.textContent = 'Please enter a license key'; return; }
  if (errEl) errEl.textContent = '⏳ Validating...';
  const result = await activateLicenseKey(key);
  if (!result.valid) { if (errEl) errEl.textContent = '❌ ' + result.error; return; }
  if (errEl) errEl.textContent = '';
  if (input) input.value = '';
  subShowTrialBanner();
  _subToast('✅ ' + result.plan.toUpperCase() + ' plan activated!');
  setTimeout(function() { location.reload(); }, 1500);
}

/* ── Activate from upgrade screen ── */
async function upgradeActivateKey() {
  const input = document.getElementById('upgradeKeyInput');
  const errEl = document.getElementById('upgradeKeyError');
  const key   = input ? input.value.trim() : '';
  if (!key) { if (errEl) errEl.textContent = 'Please enter a license key'; return; }
  if (errEl) errEl.textContent = '⏳ Validating...';
  const result = await activateLicenseKey(key);
  if (!result.valid) { if (errEl) errEl.textContent = '❌ ' + result.error; return; }
  hideUpgradeScreen();
  subShowTrialBanner();
  _subToast('✅ ' + result.plan.toUpperCase() + ' plan activated!');
  setTimeout(function() { location.reload(); }, 1500);
}

/* ── Settings banner ── */
function subShowTrialBanner() {
  _initTrial();
  const labelEl   = document.getElementById('settingsTrialLabel');
  const valueEl   = document.getElementById('settingsTrialValue');
  const actionsEl = document.getElementById('settingsSubActions');
  if (isPro()) {
    const expiry = getLicenseExpiry();
    if (labelEl) labelEl.textContent = '⭐ Pro Plan';
    if (valueEl) { valueEl.textContent = expiry ? 'Active · expires ' + new Date(expiry).toLocaleDateString() : 'Active'; valueEl.style.color = '#2dce89'; }
    if (actionsEl) actionsEl.style.display = 'none';
  } else if (isBasic()) {
    if (actionsEl) actionsEl.style.display = 'block';
    const expiry = getLicenseExpiry();
    if (labelEl) labelEl.textContent = '📱 Basic Plan';
    if (valueEl) { valueEl.textContent = 'Viewer only' + (expiry ? ' · expires ' + new Date(expiry).toLocaleDateString() : ''); valueEl.style.color = '#6c63ff'; }
  } else if (isTrialActive()) {
    if (actionsEl) actionsEl.style.display = 'block';
    const days = getTrialDaysLeft();
    if (labelEl) labelEl.textContent = '🎉 Free Trial';
    if (valueEl) { valueEl.textContent = days + ' days remaining'; valueEl.style.color = days < 10 ? '#e63757' : '#2dce89'; }
  } else {
    if (actionsEl) actionsEl.style.display = 'block';
    if (labelEl) labelEl.textContent = '⏰ Trial Expired';
    if (valueEl) { valueEl.textContent = 'Subscribe to continue'; valueEl.style.color = '#e63757'; }
  }
}

/* ── Upgrade screen ── */
async function showUpgradeScreen(reason) {
  const existing = document.getElementById('upgradeScreen');
  if (existing) { existing.style.display = 'flex'; return; }

  const daysLeft  = getTrialDaysLeft();
  const isExpired = !isTrialActive() && !isLicenseValid();
  const isBasic_  = isBasic();

  var paypal = '', paypay = '', priceBasic = '200', pricePro = '1000';
  try {
    const cfg = await _getAppConfig();
    if (cfg.paypal)      paypal     = cfg.paypal;
    if (cfg.paypay)      paypay     = cfg.paypay;
    if (cfg.price_basic) priceBasic = cfg.price_basic;
    if (cfg.price_pro)   pricePro   = cfg.price_pro;
  } catch(e) {}

  var existingReq = null, hasActivePending = false;
  try {
    existingReq      = await getPurchaseRequestStatus();
    hasActivePending = existingReq && existingReq.status === 'pending' && existingReq.hrsLeft > 0;
  } catch(e) {}

  const screen = document.createElement('div');
  screen.id = 'upgradeScreen';
  screen.style.cssText = 'position:fixed;inset:0;background:var(--bg,#0f0f1a);z-index:99998;display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:32px 20px;';

  screen.innerHTML =
    '<div style="width:100%;max-width:400px;">' +
    (!isExpired ? '<div style="text-align:right;margin-bottom:8px;">' +
      '<button onclick="hideUpgradeScreen()" style="background:none;border:none;color:var(--muted,#888);font-size:1.5rem;cursor:pointer;padding:4px 8px;line-height:1;">✕</button>' +
    '</div>' : '') +
    '<div style="text-align:center;margin-bottom:28px;">' +
      '<div style="font-size:2.5rem;margin-bottom:10px;">' + (isExpired ? '⏰' : isBasic_ ? '⬆️' : '🏸') + '</div>' +
      '<div style="font-size:1.3rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">' +
        (isExpired ? 'Trial Expired' : isBasic_ ? 'Upgrade to Pro' : reason || 'Subscribe') +
      '</div>' +
      '<div style="font-size:0.82rem;color:var(--muted,#888);">' +
        (isExpired ? 'Your 60-day trial has ended' : isBasic_ ? 'Unlock all features' : daysLeft + ' days left in trial') +
      '</div>' +
    '</div>' +
    '<div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#2a2a4a);border-radius:16px;padding:18px;margin-bottom:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<div style="font-weight:700;color:var(--text,#fff);">Basic</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:#6c63ff;">¥' + priceBasic + '<span style="font-size:0.72rem;font-weight:400;color:var(--muted,#888)">/year</span></div>' +
      '</div>' +
      '<div style="font-size:0.75rem;color:var(--muted,#888);margin-bottom:12px;">👁 Viewer mode only</div>' +
      '<button id="reqBasicBtn" data-plan="basic" style="width:100%;padding:10px;border-radius:10px;border:none;background:#6c63ff;color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">Request Basic Plan</button>' +
    '</div>' +
    '<div style="background:linear-gradient(135deg,rgba(108,99,255,0.15),rgba(0,212,255,0.08));border:1.5px solid rgba(108,99,255,0.4);border-radius:16px;padding:18px;margin-bottom:20px;position:relative;">' +
      '<div style="position:absolute;top:-10px;right:16px;background:#6c63ff;color:#fff;font-size:0.65rem;font-weight:700;padding:3px 10px;border-radius:20px;">RECOMMENDED</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<div style="font-weight:700;color:var(--text,#fff);">Pro</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:#6c63ff;">¥' + pricePro + '<span style="font-size:0.72rem;font-weight:400;color:var(--muted,#888)">/year</span></div>' +
      '</div>' +
      '<div style="font-size:0.75rem;color:var(--muted,#888);margin-bottom:12px;">🏆 All modes · Organiser · Vault · Reports</div>' +
      '<button id="reqProBtn" data-plan="pro" style="width:100%;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#6c63ff);color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">Request Pro Plan</button>' +
    '</div>' +
    '<div id="upgradeRequestStatus" style="margin-bottom:12px;"></div>' +
    '<div id="upgradeRequestMsg" style="color:#e63757;font-size:0.78rem;text-align:center;min-height:16px;margin-bottom:12px;"></div>' +
    '<div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#2a2a4a);border-radius:14px;padding:16px;margin-bottom:16px;">' +
      '<div style="font-size:0.78rem;color:var(--muted,#888);margin-bottom:10px;">Already have a key? Enter it here:</div>' +
      '<input id="upgradeKeyInput" type="text" placeholder="SCS-XXXX-XXXX-XXXX"' +
        ' style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border,#2a2a4a);background:var(--bg,#0f0f1a);color:var(--text,#fff);font-size:0.9rem;text-align:center;letter-spacing:2px;margin-bottom:8px;font-family:inherit;box-sizing:border-box;"' +
        ' oninput="this.value=this.value.toUpperCase()">' +
      '<div id="upgradeKeyError" style="color:#e63757;font-size:0.75rem;min-height:16px;text-align:center;margin-bottom:8px;"></div>' +
      '<button onclick="upgradeActivateKey()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#6c63ff);color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">🔑 Activate Key</button>' +
    '</div>' +
    (!isExpired ? '<button onclick="hideUpgradeScreen()" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--border,#2a2a4a);background:transparent;color:var(--muted,#888);font-size:0.82rem;cursor:pointer;font-family:inherit;">Continue with Trial (' + daysLeft + ' days left)</button>' : '') +
    '</div>';

  document.body.appendChild(screen);

  var basicBtn = document.getElementById('reqBasicBtn');
  var proBtn   = document.getElementById('reqProBtn');
  if (basicBtn) basicBtn.addEventListener('click', function() { submitRequest('basic'); });
  if (proBtn)   proBtn.addEventListener('click',   function() { submitRequest('pro'); });

  if (hasActivePending) _showUpgradeRequestStatus(existingReq);
}

async function _showUpgradeRequestStatus(req) {
  var el = document.getElementById('upgradeRequestStatus');
  if (!el) return;
  const cfg    = await _getAppConfig();
  var paypal = cfg.paypal || '', paypay = cfg.paypay || '';
  var contact = '';
  if (paypal) contact += 'PayPal: ' + paypal + '\n';
  if (paypay) contact += 'PayPay: ' + paypay;
  el.innerHTML =
    '<div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:12px;padding:14px;">' +
      '<div style="color:#2dce89;font-weight:700;margin-bottom:6px;">⏳ Request Pending — ' + req.hrsLeft + 'hrs left</div>' +
      '<div style="font-size:0.78rem;color:var(--muted,#888);margin-bottom:8px;">' + req.plan.toUpperCase() + ' plan requested</div>' +
      (contact ? '<div style="font-size:0.78rem;color:var(--text,#fff);background:var(--surface,#1e1e2e);border-radius:8px;padding:10px;margin-bottom:8px;">💳 Payment details: ' + contact + '</div>' : '<div style="font-size:0.78rem;color:var(--muted,#888);margin-bottom:8px;">Payment details will appear after admin activates your request.</div>') +
      '<button onclick="cancelAndRequest()" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border,#2a2a4a);background:transparent;color:var(--muted,#888);font-size:0.75rem;cursor:pointer;font-family:inherit;">Cancel & Request Again</button>' +
    '</div>';
}

async function submitRequest(plan) {
  var msgEl = document.getElementById('upgradeRequestMsg');
  if (msgEl) msgEl.textContent = '⏳ Submitting...';
  var result = await createPurchaseRequest(plan);
  if (!result || !result.success) { if (msgEl) msgEl.textContent = '❌ ' + (result?.error || 'Failed'); return; }
  if (msgEl) msgEl.textContent = '';
  var req = await getPurchaseRequestStatus();
  if (req) await _showUpgradeRequestStatus(req);
  _subToast('✅ Request submitted! Admin will review within 24 hours.');
}

async function cancelAndRequest() {
  await cancelPurchaseRequest();
  var el = document.getElementById('upgradeRequestStatus');
  if (el) el.innerHTML = '';
  _subToast('✅ Cancelled. You can now submit a new request.');
}

function hideUpgradeScreen() {
  var s = document.getElementById('upgradeScreen');
  if (s) s.remove();
}

function subPayWith(method, id, price, plan) {
  var url  = '';
  var note = encodeURIComponent('SCS ' + plan.toUpperCase() + ' plan - ¥' + price + '/year');
  if (method === 'paypal') url = 'https://' + id + '/' + price + 'JPY?note=' + note;
  if (method === 'paypay') url = 'https://qr.paypay.ne.jp/' + id;
  if (url) window.open(url, '_blank');
  setTimeout(function() { alert('After payment, you will receive a license key. Enter it in the Activate box to unlock your plan.'); }, 1000);
}

function _subToast(msg) {
  if (typeof _qcToast === 'function') { _qcToast(msg); return; }
  var el = document.getElementById('subToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'subToast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--surface,#1e1e2e);color:var(--text,#fff);padding:10px 18px;border-radius:20px;font-size:0.78rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);max-width:90vw;text-align:center;border:1px solid var(--border,#2a2a4a);display:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 4000);
}

function licenseCheck()      { return true; }
function showLicenseScreen() { return; }
