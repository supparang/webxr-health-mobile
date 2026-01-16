// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+C ready)
// ✅ Auto-detect view: pc / mobile / vr / cvr (NO launcher required)
// ✅ Adds body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Ensures Right-eye layer visibility for cVR only
// ✅ Measures HUD + topbar => sets :root --gj-top-safe / --gj-bottom-safe (spawn-safe)
// ✅ Wires Missions/Hide HUD buttons if present
// ✅ Boots engine: ./goodjunk.safe.js
// ✅ Prevent double-boot

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

if (ROOT.__GJ_BOOT_LOADED__) {
  // prevent double boot (hot reload / duplicate script)
  console.warn('[GoodJunkVR.boot] already loaded');
} else {
  ROOT.__GJ_BOOT_LOADED__ = true;
}

/* ---------------- helpers ---------------- */
function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function px(n){ return `${Math.max(0, Math.floor(Number(n)||0))}px`; }

function isLikelyTouch() {
  try { return ('ontouchstart' in ROOT) || (navigator.maxTouchPoints > 0); }
  catch { return false; }
}

function detectViewAuto() {
  // priority:
  // 1) explicit view param
  // 2) WebXR state hint (if present)
  // 3) user agent / touch heuristic

  const v = String(qs('view', 'auto') || 'auto').toLowerCase();
  if (v && v !== 'auto') return v;

  // if already in WebXR immersive, treat as vr
  try {
    // some browsers expose navigator.xr + session state; keep defensive
    if (ROOT.__HHA_VR_ACTIVE__ === true) return 'vr';
  } catch (_) {}

  // if user forces cVR by query or UI
  const layers = String(qs('layers', '') || '').toLowerCase();
  if (layers === '2' || layers === 'stereo') return 'cvr';

  // wide screens => pc, else mobile
  const W = DOC.documentElement.clientWidth || innerWidth || 0;
  if (W >= 980 && !isLikelyTouch()) return 'pc';
  return 'mobile';
}

function setBodyView(view) {
  const b = DOC.body;
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function enableRightEyeLayer(view) {
  const r = DOC.getElementById('gj-layer-r');
  if (!r) return;
  // show right-eye only in cVR
  r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
}

function updateChipMeta(view) {
  const chip = DOC.getElementById('gjChipMeta') || DOC.getElementById('chipMeta') || null;
  if (!chip) return;
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  chip.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

/* ---------------- spawn safe measurement ---------------- */
function measureHudSafe() {
  // We set:
  //  :root --gj-top-safe    = topbar + hudTop + margin + safeAreaTop
  //  :root --gj-bottom-safe = hudBot + margin + safeAreaBottom (min clamp)
  try {
    const rootStyle = DOC.documentElement.style;

    const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;
    const sab = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sab')) || 0;

    const topbar = DOC.getElementById('gjTopbar')?.getBoundingClientRect().height || 0;
    const hudTop = DOC.getElementById('gjHudTop')?.getBoundingClientRect().height || 0;
    const hudBot = DOC.getElementById('gjHudBot')?.getBoundingClientRect().height || 0;

    const hudHidden = DOC.body.classList.contains('hud-hidden');

    const topSafe = hudHidden
      ? (topbar + 16 + sat)
      : (topbar + hudTop + 16 + sat);

    const bottomSafe = hudHidden
      ? (Math.max(20, 18 + sab))
      : (Math.max(110, hudBot + 18 + sab));

    rootStyle.setProperty('--gj-top-safe', px(topSafe));
    rootStyle.setProperty('--gj-bottom-safe', px(bottomSafe));
  } catch (_) {}
}

function installSafeMeasure() {
  // Do several passes (layout stabilizes)
  measureHudSafe();
  setTimeout(measureHudSafe, 0);
  setTimeout(measureHudSafe, 120);
  setTimeout(measureHudSafe, 360);

  ROOT.addEventListener('resize', measureHudSafe, { passive:true });
  ROOT.addEventListener('orientationchange', measureHudSafe, { passive:true });

  // if fonts/layout changes later (missions overlay/hud toggle)
  DOC.addEventListener('transitionend', (e)=>{
    if (!e) return;
    if (String(e.target?.className||'').includes('gj-hud')) measureHudSafe();
  }, { passive:true });
}

/* ---------------- UI wiring (optional) ---------------- */
function wireHudButtons() {
  const btnHide = DOC.getElementById('btnHideHud');
  const btnMis  = DOC.getElementById('btnMissions');
  const peek    = DOC.getElementById('missionsPeek');

  // hide HUD toggle
  function toggleHud() {
    DOC.body.classList.toggle('hud-hidden');
    measureHudSafe();
  }
  btnHide?.addEventListener('click', toggleHud);

  // missions peek toggle
  function toggleMissions() {
    DOC.body.classList.toggle('show-missions');
    const on = DOC.body.classList.contains('show-missions');
    if (peek) peek.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);
}

/* ---------------- ensure vr-ui is present ---------------- */
function warnIfVrUiMissing() {
  // vr-ui.js should be loaded by HTML. If not, warn loudly.
  if (!ROOT.__HHA_VRUI_LOADED__) {
    console.warn('[GoodJunkVR.boot] vr-ui.js not detected. VR buttons/crosshair may be missing.');
  }
}

/* ---------------- boot engine ---------------- */
function buildPayload(view) {
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);

  // research params passthrough
  const hub  = qs('hub', null);
  const seed = qs('seed', qs('ts', null));

  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return {
    view,
    run,
    diff,
    time: Number(time),
    hub,
    seed,
    studyId,
    phase,
    conditionGroup,
  };
}

function main() {
  const view = detectViewAuto();
  setBodyView(view);
  enableRightEyeLayer(view);
  updateChipMeta(view);

  wireHudButtons();
  installSafeMeasure();
  warnIfVrUiMissing();

  // Prevent double-engine boot
  if (ROOT.__GJ_ENGINE_STARTED__) {
    console.warn('[GoodJunkVR.boot] engine already started');
    return;
  }
  ROOT.__GJ_ENGINE_STARTED__ = true;

  // Start engine
  try {
    engineBoot(buildPayload(view));
  } catch (err) {
    console.error('[GoodJunkVR.boot] engineBoot failed', err);
    ROOT.__GJ_ENGINE_STARTED__ = false;
  }
}

// start once DOM is ready
if (DOC.readyState === 'loading') {
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}