// === /herohealth/launch/launcher-core.js ===
// HeroHealth Launcher Core — v2.0 (PRODUCTION)
// ✅ Pass-through all params (NO override)
// ✅ Always attaches hub backlink (?hub=...)
// ✅ Auto-fill view if missing (pc/mobile/cvr) but never override
// ✅ Optional defaults (fill only missing)

export function hhDetectView() {
  try {
    const u = new URL(location.href);
    const v = (u.searchParams.get('view') || '').toLowerCase();
    if (v) return v; // NO OVERRIDE
  } catch {}

  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const w = Math.min(window.innerWidth || 0, document.documentElement.clientWidth || 0, screen.width || 9999);
  const h = Math.min(window.innerHeight || 0, document.documentElement.clientHeight || 0, screen.height || 9999);
  const small = Math.min(w, h) <= 520;
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

  if ((touch || isMobileUA) && small) return 'cvr';
  if (touch || isMobileUA) return 'mobile';
  return 'pc';
}

function hubUrlClean() {
  try { return location.href.split('#')[0]; } catch { return location.href; }
}

function parseQS(urlStr) {
  try { return new URL(urlStr).searchParams; } catch { return new URLSearchParams(); }
}

function setIfMissing(sp, k, v) {
  if (!sp) return;
  if (sp.has(k) && String(sp.get(k) || '').trim() !== '') return; // NO OVERRIDE
  if (v == null) return;
  const s = String(v).trim();
  if (!s) return;
  sp.set(k, s);
}

export function hhBuildRedirectUrl(targetHref, options = {}) {
  const {
    defaults = {},
    ensureHub = true,
    ensureView = true,
  } = options;

  const from = hubUrlClean();
  const cur = parseQS(from);

  const target = new URL(targetHref, location.href);

  for (const [k, v] of cur.entries()) {
    if (k === 'hub') continue;
    target.searchParams.set(k, v);
  }

  if (ensureHub) target.searchParams.set('hub', from);

  if (ensureView) {
    const hasView = target.searchParams.has('view') && String(target.searchParams.get('view') || '').trim() !== '';
    const hubHasView = cur.has('view') && String(cur.get('view') || '').trim() !== '';
    if (!hasView && !hubHasView) target.searchParams.set('view', hhDetectView());
  }

  if (defaults && typeof defaults === 'object') {
    for (const [k, v] of Object.entries(defaults)) {
      setIfMissing(target.searchParams, k, v);
    }
  }

  return target.toString();
}

export function hhGo(targetHref, options = {}) {
  const url = hhBuildRedirectUrl(targetHref, options);
  location.replace(url);
}