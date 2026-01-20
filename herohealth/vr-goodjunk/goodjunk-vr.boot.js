// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (PACK-FAIR)
// ✅ View modes: pc / mobile / vr / cvr (NO override if URL has view=)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Fullscreen hint class body.is-fs (optional; safe)
// ✅ Boots engine: ./goodjunk.safe.js (ESM)
// ✅ Updates safe spawn vars by calling window.__GJ_UPDATE_SAFE__ if present (html already has measure script)
// ✅ Avoid duplicate boot / listeners
// ✅ Research mode: deterministic seed + adaptive handled inside safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

if (WIN.__GOODJUNK_BOOT__) {
  console.warn('[GoodJunkVR] boot skipped (already booted)');
} else {
  WIN.__GOODJUNK_BOOT__ = true;
}

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k) {
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}

function normalizeView(v) {
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
  const ua = (navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectViewNoOverride() {
  // if already has view=, respect it 100%
  if (has('view')) return normalizeView(qs('view', 'mobile'));

  // soft remember (optional)
  try {
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if (last) return normalizeView(last);
  } catch (_) {}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort WebXR check (never forces override if user passed view already)
  try {
    if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if (ok) guess = isLikelyMobileUA() ? 'vr' : 'pc';
    }
  } catch (_) {}

  return normalizeView(guess);
}

function setBodyViewClass(view) {
  const b = DOC.body;
  if (!b) return;

  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  b.classList.add(`view-${view}`);

  // also keep a generic class for css hooks
  if (view === 'cvr') b.classList.add('view-cvr');
  if (view === 'vr') b.classList.add('view-vr');
  if (view === 'pc') b.classList.add('view-pc');
  if (view === 'mobile') b.classList.add('view-mobile');
}

function setFullscreenFlag() {
  try {
    const b = DOC.body;
    if (!b) return;
    const fs = !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
    b.classList.toggle('is-fs', fs);
  } catch (_) {}
}

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function buildPayload(view) {
  const run = String(qs('run', 'play') || 'play').toLowerCase();      // play | research | practice (if used)
  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase(); // easy | normal | hard
  const time = clamp(Number(qs('time', '80') || 80), 20, 300);

  // seed rules:
  // - research: prefer explicit seed or ts; else stable fallback
  // - play: default Date.now unless seed provided
  const seedQ = qs('seed', null);
  const tsQ = qs('ts', null);
  const seed =
    (run === 'research')
      ? (seedQ ?? tsQ ?? 'RESEARCH-SEED')
      : (seedQ ?? String(Date.now()));

  const hub = qs('hub', null);

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return {
    view,
    run,
    diff,
    time,
    seed,
    hub,
    studyId,
    phase,
    conditionGroup,
  };
}

function updateChipMeta(payload) {
  try {
    const el = DOC.getElementById('gjChipMeta');
    if (!el) return;
    const v = has('view') ? normalizeView(qs('view', payload.view)) : payload.view;
    el.textContent = `view=${v} · run=${payload.run} · diff=${payload.diff} · time=${payload.time}`;
  } catch (_) {}
}

function requestSafeUpdateSoon() {
  // HTML already measures + sets CSS vars, but we keep a hardening call here too.
  try {
    if (typeof WIN.__GJ_UPDATE_SAFE__ === 'function') {
      WIN.__GJ_UPDATE_SAFE__();
      setTimeout(() => WIN.__GJ_UPDATE_SAFE__(), 120);
      setTimeout(() => WIN.__GJ_UPDATE_SAFE__(), 360);
    } else {
      // fallback: trigger resize handlers so HTML safe-measure runs again
      WIN.dispatchEvent(new Event('resize'));
      setTimeout(() => WIN.dispatchEvent(new Event('resize')), 120);
      setTimeout(() => WIN.dispatchEvent(new Event('resize')), 360);
    }
  } catch (_) {}
}

function wireButtons() {
  const btnBack = DOC.getElementById('btnBackHub');
  const btnHide = DOC.getElementById('btnHideHud');

  btnHide?.addEventListener('click', () => {
    DOC.body.classList.toggle('hud-hidden');
    requestSafeUpdateSoon();
  });

  btnBack?.addEventListener('click', () => {
    const hub = qs('hub', null);
    try {
      if (hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    } catch (_) {}
  });
}

async function main() {
  const view = await detectViewNoOverride();
  setBodyViewClass(view);

  // Remember view only if not forced by URL (soft)
  try {
    if (!has('view')) localStorage.setItem('HHA_LAST_VIEW', view);
  } catch (_) {}

  // fullscreen flag
  setFullscreenFlag();
  DOC.addEventListener('fullscreenchange', setFullscreenFlag, { passive: true });
  DOC.addEventListener('webkitfullscreenchange', setFullscreenFlag, { passive: true });

  // ensure safe spawn vars exist
  requestSafeUpdateSoon();
  WIN.addEventListener('resize', requestSafeUpdateSoon, { passive: true });
  WIN.addEventListener('orientationchange', requestSafeUpdateSoon, { passive: true });

  const payload = buildPayload(view);
  updateChipMeta(payload);

  wireButtons();

  // Boot engine once DOM is ready
  try {
    engineBoot(payload);
  } catch (e) {
    console.error('[GoodJunkVR] engine boot failed', e);
  }
}

if (DOC.readyState === 'loading') {
  DOC.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}