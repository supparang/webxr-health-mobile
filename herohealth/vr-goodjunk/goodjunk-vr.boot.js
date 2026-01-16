// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto detect view: pc / mobile / vr / cvr (NO override if ?view= exists)
// ✅ Loads ../vr/vr-ui.js (ENTER VR/EXIT/RECENTER + crosshair + tap-to-shoot)
// ✅ Starts engine: import { boot } from ./goodjunk.safe.js
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup
// ✅ Safe: start once, guards double-boot

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

if (WIN.__GJ_BOOT__) {
  // prevent double-run (hot reload / accidental duplicate script include)
  console.warn('[GoodJunkVR boot] already loaded');
} else {
  WIN.__GJ_BOOT__ = true;
}

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function hasQS(k) {
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}

function isProbablyMobile() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  const small = Math.min(DOC.documentElement.clientWidth || 9999, DOC.documentElement.clientHeight || 9999) <= 820;
  const mobileUA = /android|iphone|ipad|ipod|mobile|silk|kindle/.test(ua);
  return !!(touch && (small || mobileUA));
}

function supportsWebXR() {
  return !!(navigator.xr && typeof navigator.xr.isSessionSupported === 'function');
}

async function isImmersiveVrSupported() {
  try {
    if (!supportsWebXR()) return false;
    return await navigator.xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}

// Detect view only if user DID NOT specify ?view=
async function detectView() {
  if (hasQS('view')) {
    return String(qs('view', 'mobile')).toLowerCase();
  }

  // If VR is supported, prefer 'vr' on devices likely used for HMD / Cardboard.
  // If user is in cVR mode via parameter in another layer (e.g., view-cvr), they should pass ?view=cvr explicitly.
  const vrOk = await isImmersiveVrSupported();

  // Heuristic: if VR supported and device is mobile => likely Cardboard => 'vr'
  if (vrOk && isProbablyMobile()) return 'vr';

  // Desktop with WebXR could be PC-VR; still default to pc unless explicitly asked
  if (!isProbablyMobile()) return 'pc';

  return 'mobile';
}

function loadScriptOnce(src) {
  return new Promise((resolve) => {
    // already loaded?
    const existing = [...DOC.scripts].find(s => (s.src || '').includes(src));
    if (existing) return resolve(true);

    const s = DOC.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    DOC.head.appendChild(s);
  });
}

function ensureVrUi() {
  // vr-ui.js sets window.__HHA_VRUI_LOADED__
  if (WIN.__HHA_VRUI_LOADED__) return Promise.resolve(true);
  // path is relative to /vr-goodjunk/
  return loadScriptOnce('../vr/vr-ui.js');
}

function buildPayload(view) {
  const run = String(qs('run', 'play') || 'play').toLowerCase(); // play | research
  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();

  // IMPORTANT: Do not clamp here; safe.js clamps
  const time = Number(qs('time', '80') || 80);

  const hub = (qs('hub', null) || '').trim() || null;

  const seed = qs('seed', null);
  const ts = qs('ts', null);

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  // If run=research and seed not provided, prefer ts if exists; else stable default
  let useSeed = seed;
  if (run === 'research' && !useSeed) useSeed = ts || 'RESEARCH-SEED';
  if (run !== 'research' && !useSeed) useSeed = String(Date.now());

  return {
    view,
    run,
    diff,
    time,
    hub,
    seed: useSeed,
    studyId,
    phase,
    conditionGroup,
  };
}

function markBodyView(view) {
  const b = DOC.body;
  if (!b) return;
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  b.classList.add(`view-${view}`);
}

async function start() {
  try {
    // wait DOM
    if (DOC.readyState === 'loading') {
      await new Promise(res => DOC.addEventListener('DOMContentLoaded', res, { once: true }));
    }

    const view = await detectView();

    // always mark body class (for CSS tweaks)
    markBodyView(view);

    // Ensure VR UI exists (Enter VR button + crosshair + tap-to-shoot)
    // NOTE: even on pc/mobile it's useful (crosshair/tap-to-shoot for mobile)
    await ensureVrUi();

    // configure vr-ui (optional tuning)
    WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});

    // Hand off to engine
    const payload = buildPayload(view);

    // Prevent double engine boot
    if (WIN.__GJ_ENGINE_STARTED__) return;
    WIN.__GJ_ENGINE_STARTED__ = true;

    engineBoot(payload);

  } catch (err) {
    console.error('[GoodJunkVR boot] failed', err);
    alert('GoodJunkVR boot error: ' + (err?.message || err));
  }
}

start();