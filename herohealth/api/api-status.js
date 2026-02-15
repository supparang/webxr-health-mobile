'use strict';

// Remote disable latch (per-tab) for 401/403 to prevent retry spam
const KEY = 'HHA_API_DISABLED';
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function disableRemote(code, reason) {
  try {
    const payload = { code: Number(code) || 403, reason: String(reason || ''), ts: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {}
}

export function clearDisable() {
  try { sessionStorage.removeItem(KEY); } catch (e) {}
}

export function disabledInfo() {
  try {
    var raw = sessionStorage.getItem(KEY);
    if (!raw) return { disabled: false };
    var d = JSON.parse(raw);
    return { disabled: true, code: d.code || 403, reason: d.reason || '', ts: d.ts || 0 };
  } catch (e) {
    return { disabled: false };
  }
}

export function isRemoteDisabled() {
  var info = disabledInfo();
  if (!info.disabled) return false;
  var age = Date.now() - (info.ts || 0);
  if (age > TTL_MS) {
    clearDisable();
    return false;
  }
  return true;
}

// UI helpers
export function setBanner(_, status, title, msg) {
  status = status || 'warn';
  title = title || '';
  msg = msg || '';
  var dot = document.getElementById('apiDot');
  var titleEl = document.getElementById('apiTitle');
  var msgEl = document.getElementById('apiMsg');
  if (dot) {
    dot.classList.remove('ok', 'warn', 'bad');
    if (status === 'ok') dot.classList.add('ok');
    else if (status === 'bad') dot.classList.add('bad');
    else dot.classList.add('warn');
  }
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
}

export function toast(text, ms) {
  ms = typeof ms === 'number' ? ms : 2200;
  try {
    var id = 'hh-toast';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, {
        position: 'fixed',
        left: '50%',
        bottom: '18px',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '8px',
        zIndex: 9999,
        transition: 'opacity 200ms'
      });
      document.body.appendChild(el);
    }
    el.textContent = String(text || '');
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.style.opacity = '0'; }, ms);
  } catch (e) { console.warn('toast', e); }
}

export function qs(name, fallback) {
  fallback = typeof fallback === 'undefined' ? '' : fallback;
  try {
    var u = new URL(location.href);
    return u.searchParams.get(name) || fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * probeAPI(endpoint, opts, timeoutMs)
 * - Default: GET (health/ping endpoint)
 * - Optional POST ping ONLY if you truly need it (opts.ping=true)
 * - Optional disableOnAuth (default false): avoid latching offline when auth is expected
 */
export async function probeAPI(endpoint, opts, timeoutMs) {
  opts = opts || {};
  timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 3000;
  if (!endpoint) return { status: 0 };
  if (isRemoteDisabled()) return { status: 403 };

  var disableOnAuth = (typeof opts.disableOnAuth === 'boolean') ? opts.disableOnAuth : false;

  var controller = new AbortController();
  var t = setTimeout(function() { controller.abort(); }, timeoutMs);

  try {
    // Prefer GET for probes (no auth, no side effects)
    var method = opts.ping ? 'POST' : 'GET';
    var body = opts.ping ? JSON.stringify({ ping: true, ts: Date.now() }) : undefined;

    var headers = {};
    if (opts.ping) headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';

    var res = await fetch(endpoint, {
      method: method,
      headers: headers,
      body: body,
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit'
    });

    clearTimeout(t);

    if ((res.status === 401 || res.status === 403) && disableOnAuth) {
      try { disableRemote(res.status, 'status:' + String(res.status)); } catch (e) {}
    }

    return { status: res.status };
  } catch (err) {
    clearTimeout(t);
    return { status: 0, error: String(err && err.message ? err.message : err) };
  }
}

export function attachRetry(btnId, fn) {
  var btn = document.getElementById(btnId);
  if (!btn) return;

  var update = function() {
    var disabled = isRemoteDisabled();
    if (disabled) btn.classList.add('btn--disabled'); else btn.classList.remove('btn--disabled');
    try { btn.disabled = disabled; } catch (e) {}
  };

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    if (isRemoteDisabled()) return;
    try { fn(); } catch (err) { console.warn('probe fn', err); }
  });

  update();
  var iv = setInterval(update, 1000);
  btn._hh_interval = iv;
}
