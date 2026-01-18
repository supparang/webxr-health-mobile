// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Sets body view class (pc/mobile/vr/cvr)
// ✅ Never override if URL already has ?view=
// ✅ Adds body.ready after DOM/CSS settle (prevents target flash)
// ✅ Calls engine boot from ./goodjunk.safe.js
// ✅ Pass-through research params + emits a lightweight boot meta

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k) {
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function normView(v) {
  v = String(v || '').toLowerCase();
  if (v === 'cardboard') return 'vr';
  if (v === 'view-cvr') return 'cvr';
  if (v === 'cvr') return 'cvr';
  if (v === 'vr') return 'vr';
  if (v === 'pc') return 'pc';
  if (v === 'mobile') return 'mobile';
  return 'mobile';
}
function isLikelyMobileUA() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectViewNoOverride() {
  // If caller already specified view, use it (DO NOT override)
  if (has('view')) return normView(qs('view', 'mobile'));

  // Soft remember last view
  try {
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if (last) return normView(last);
  } catch (_) {}

  // Default guess
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // Best-effort: WebXR immersive-vr support => prefer vr on mobile
  try {
    if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if (ok && isLikelyMobileUA()) guess = 'vr';
    }
  } catch (_) {}

  return normView(guess);
}

function setBodyView(view) {
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  // keep legacy class names if you use them elsewhere
  b.dataset.view = view;
}

function markReadySoon() {
  // prevent “targets flash then disappear”:
  // show layers only after CSS + layout settle
  const b = DOC.body;
  const go = () => { try { b.classList.add('ready'); } catch (_) {} };

  // after paint + a couple beats
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 120);
  setTimeout(go, 360);
}

function buildPayload(view) {
  const payload = {
    view,                                      // pc/mobile/vr/cvr
    run: qs('run', 'play'),                    // play | research
    diff: qs('diff', 'normal'),                // easy | normal | hard
    time: Number(qs('time', '80')) || 80,
    seed: qs('seed', null),
    hub: qs('hub', null),

    // research meta passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    // logging meta passthrough
    log: qs('log', null),
    style: qs('style', null),
    ts: qs('ts', null),
  };

  // normalize seed behavior:
  // - research should be deterministic if seed missing
  // - play may use Date.now in safe.js anyway
  if (!payload.seed && payload.run === 'research') {
    payload.seed = payload.ts || 'RESEARCH-SEED';
  }
  return payload;
}

function wireChipMeta(payload) {
  const el = DOC.getElementById('gjChipMeta');
  if (!el) return;
  const v = payload.view || 'mobile';
  const run = payload.run || 'play';
  const diff = payload.diff || 'normal';
  const t = payload.time || 80;
  el.textContent = `view=${v} · run=${run} · diff=${diff} · time=${t}`;
}

async function main() {
  const view = await detectViewNoOverride();
  try { localStorage.setItem('HHA_LAST_VIEW', view); } catch (_) {}

  setBodyView(view);
  markReadySoon();

  const payload = buildPayload(view);
  wireChipMeta(payload);

  // announce boot
  try {
    WIN.dispatchEvent(new CustomEvent('hha:boot', {
      detail: { game:'GoodJunkVR', view, run: payload.run, diff: payload.diff, time: payload.time }
    }));
  } catch (_) {}

  // Start engine
  engineBoot(payload);
}

if (DOC.readyState === 'loading') {
  DOC.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}