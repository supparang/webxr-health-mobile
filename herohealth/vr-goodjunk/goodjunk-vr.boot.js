// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (clean)
// ✅ Starts goodjunk.safe.js boot()
// ✅ view=auto -> best effort (pc/mobile/cvr/vr) but NEVER override explicit view
// ✅ Adds body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Global error trap (error + unhandledrejection)

import { boot } from './goodjunk.safe.js';

const WIN = window;

const qs = (k, d = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
};

function detectView() {
  // never override if user explicitly set view=...
  const explicit = String(qs('view', '') || '').toLowerCase();
  if (explicit && explicit !== 'auto') return explicit;

  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);
  const isXRUA = /oculus|quest|vive|pico|webkitxr|xr/.test(ua);

  // special: if someone passes view=cvr explicitly we already handled above
  if (isXRUA) return 'vr';
  return isMobile ? 'mobile' : 'pc';
}

function applyViewClass(view) {
  try {
    document.body.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
    if (view === 'pc') document.body.classList.add('view-pc');
    else if (view === 'vr') document.body.classList.add('view-vr');
    else if (view === 'cvr') document.body.classList.add('view-cvr');
    else document.body.classList.add('view-mobile');
  } catch (_) {}
}

function start() {
  const run  = String(qs('run', 'play')).toLowerCase();     // play | research | practice (etc)
  const diff = String(qs('diff', 'normal')).toLowerCase();  // easy | normal | hard
  const time = Number(qs('time', '80')) || 80;

  const seed = String(qs('seed', '') || Date.now());
  const view = detectView();

  applyViewClass(view);

  boot({ view, run, diff, time, seed });
}

(function () {
  // global traps
  WIN.addEventListener('error', (e) => {
    try { console.error('[GoodJunkVR] error', e?.error || e?.message || e); } catch (_) {}
  });
  WIN.addEventListener('unhandledrejection', (e) => {
    try { console.error('[GoodJunkVR] unhandled', e?.reason || e); } catch (_) {}
  });

  // wait DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();