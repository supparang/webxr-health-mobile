// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Auto view + VR UI + Safe Engine)
// ✅ Auto detect view: pc/mobile/vr/cvr (no launcher required)
// ✅ Ensures body/view classes + dual-eye layer visibility
// ✅ Uses ../vr/vr-ui.js (already loaded by HTML) for Enter VR/Exit/Recenter + crosshair
// ✅ Boots ./goodjunk.safe.js with payload (view/diff/run/time/seed/hub/study params)
// ✅ No duplicate end-overlay listeners here (safe.js owns end UI)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function setQS(k, v) {
  try {
    const u = new URL(location.href);
    u.searchParams.set(k, v);
    history.replaceState({}, '', u.toString());
  } catch (_) {}
}

function isProbablyPC() {
  try {
    // coarse heuristic: large viewport + pointer fine
    const mqFine = matchMedia('(pointer:fine)').matches;
    const mqHover = matchMedia('(hover:hover)').matches;
    const w = DOC.documentElement.clientWidth || 0;
    return (mqFine && mqHover) || (w >= 980);
  } catch (_) {
    return false;
  }
}

function detectViewAuto() {
  // Priority:
  // 1) explicit view param (pc/mobile/vr/cvr/auto)
  // 2) if already in XR -> vr
  // 3) if view-cvr hint param exists -> cvr
  // 4) PC heuristic -> pc else mobile
  const v = String(qs('view', 'auto') || 'auto').toLowerCase();
  if (v && v !== 'auto') return v;

  // user may pass view=cvr in links; keep that
  // XR detection (best-effort)
  try {
    // If A-Frame is present, check if scene entered VR (but may be false at boot)
    // So we don't force 'vr' here unless explicit.
  } catch (_) {}

  // cVR hint (you can pass ?view=cvr or ?cvr=1)
  if (String(qs('cvr', '') || '').trim() === '1') return 'cvr';

  return isProbablyPC() ? 'pc' : 'mobile';
}

function applyBodyViewClasses(view) {
  const b = DOC.body;
  if (!b) return;

  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function ensureDualEyeLayer(view) {
  const r = DOC.getElementById('gj-layer-r');
  if (!r) return;
  // Only show right-eye layer in cVR (dual-eye overlay).
  // In "vr" (true WebXR) we generally keep DOM single, but keeping hidden is safe.
  const show = (view === 'cvr');
  r.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function normalizeParams(view) {
  // keep view in URL so refresh stays consistent (but do not override explicit)
  const pv = String(qs('view', 'auto') || 'auto').toLowerCase();
  if (pv === 'auto') setQS('view', view);
}

function configureVRUI(view) {
  // vr-ui.js reads window.HHA_VRUI_CONFIG
  // lockPx: aim assist lock radius; cooldown to avoid spam
  // Make VR/cVR slightly tighter feel (kids-friendly still)
  const base = { lockPx: 28, cooldownMs: 90 };

  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
  const isVRish = (view === 'vr' || view === 'cvr');

  let lockPx = base.lockPx;
  if (isVRish) lockPx = 30;
  if (diff === 'hard' && isVRish) lockPx = 32;
  if (diff === 'easy' && isVRish) lockPx = 30;

  WIN.HHA_VRUI_CONFIG = Object.assign({}, base, { lockPx });

  // Optional helper class for CSS if needed
  DOC.body?.classList.toggle('vrui-on', isVRish);
}

function updateChipMeta() {
  const el = DOC.getElementById('gjChipMeta');
  if (!el) return;
  const view = String(qs('view', 'auto') || 'auto');
  const run = String(qs('run', 'play') || 'play');
  const diff = String(qs('diff', 'normal') || 'normal');
  const time = String(qs('time', '80') || '80');
  el.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function bindSafetyRecalc() {
  // Your HTML already sets --gj-top-safe / --gj-bottom-safe via updateSafe().
  // But when entering/exiting VR or toggling HUD, safe-area can change:
  // we'll gently request a recalculation by dispatching resize.
  const kick = () => { try { WIN.dispatchEvent(new Event('resize')); } catch (_) {} };

  // When VR UI button toggles full screen, it often triggers resize anyway.
  // We also kick after a short delay.
  setTimeout(kick, 120);
  setTimeout(kick, 360);

  // If A-Frame scene exists, listen to enter-vr / exit-vr
  const scene = DOC.querySelector('a-scene');
  if (scene) {
    scene.addEventListener('enter-vr', () => setTimeout(kick, 60));
    scene.addEventListener('exit-vr', () => setTimeout(kick, 60));
  }
}

function bootEngine() {
  // Prevent double-boot
  if (WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = detectViewAuto();
  normalizeParams(view);
  applyBodyViewClasses(view);
  ensureDualEyeLayer(view);
  configureVRUI(view);
  updateChipMeta();
  bindSafetyRecalc();

  // Payload (engine reads qs again too, but payload is nice for future)
  const payload = {
    view,
    diff: qs('diff', 'normal'),
    run: qs('run', 'play'),
    time: qs('time', '80'),
    seed: qs('seed', qs('ts', null)),
    hub: qs('hub', null),

    // study params passthrough (optional)
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  try {
    engineBoot(payload);
  } catch (err) {
    console.error('[GoodJunkVR boot] engine boot failed', err);
  }
}

if (DOC.readyState === 'loading') {
  DOC.addEventListener('DOMContentLoaded', bootEngine, { once: true });
} else {
  bootEngine();
}