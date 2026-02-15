// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+V CLEAN)
// ✅ Auto base view: pc/mobile (ignores ?view= by default; can opt-in with ?forceView=1)
// ✅ Auto-load ../vr/vr-ui.js only if WebXR exists (navigator.xr)
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile => cvr
//    - desktop => vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Debug keys: Space/Enter => hha:shoot (PC testing)
// ✅ Boots engine: goodjunk.safe.js (Boss++/Storm/Rage inside SAFE)

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(v, min, max) {
  v = Number(v);
  if (!Number.isFinite(v)) v = min;
  return Math.max(min, Math.min(max, v));
}
function nowSeed() { return String(Date.now()); }

function isMobileUA() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

function setBodyView(view) {
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // aria for right eye (only meaningful in cVR split)
  const r = DOC.getElementById('gj-layer-r');
  if (r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');

  b.dataset.view = view;
  try { WIN.dispatchEvent(new CustomEvent('hha:view', { detail: { view } })); } catch (_) {}
}

function baseAutoView() {
  // STRICT default: ignore ?view= to prevent accidental broken layouts on mobile/host
  const force = String(qs('forceView', '0') || '0').toLowerCase();
  if (force === '1' || force === 'true') {
    const v = String(qs('view', '') || '').toLowerCase();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
  }
  return isMobileUA() ? 'mobile' : 'pc';
}

function ensureVrUiLoaded() {
  // Load only if WebXR exists (so ENTER VR UI makes sense)
  if (!navigator.xr) return;

  if (WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if (exists) return;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onerror = () => console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

function bindVrAutoSwitch() {
  const base = baseAutoView();

  function onEnter() {
    // Enter VR: mobile => cvr, desktop => vr
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
  }
  function onExit() {
    setBodyView(base);
  }

  // STRICT: only listen to HHA events (emitted by vr-ui.js)
  WIN.addEventListener('hha:enter-vr', onEnter, { passive: true });
  WIN.addEventListener('hha:exit-vr', onExit, { passive: true });

  // expose hook
  WIN.HHA_GJ_resetView = onExit;
}

function bindDebugKeys() {
  WIN.addEventListener('keydown', (e) => {
    const k = e.key || '';
    if (k === ' ' || k === 'Enter') {
      try { WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail: { source: 'key' } })); } catch (_) {}
    }
  }, { passive: true });
}

function hudSafeMeasure() {
  const root = DOC.documentElement;

  const px = (n) => Math.max(0, Math.round(Number(n) || 0)) + 'px';
  const h = (el) => { try { return el ? el.getBoundingClientRect().height : 0; } catch { return 0; } };

  function update() {
    try {
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      // note: your HTML ids vary across versions, so we try both
      const topHudA = DOC.getElementById('hud');        // clean HTML
      const topHudB = DOC.getElementById('gjHudTop');   // alt HTML
      const botHudA = DOC.getElementById('feverBox');   // clean HTML
      const botHudB = DOC.getElementById('gjHudBot');   // alt HTML

      const topbar = DOC.querySelector('.gj-topbar');
      const miniHud = DOC.getElementById('vrMiniHud');
      const controls = DOC.querySelector('.hha-controls');

      const topHud = topHudA || topHudB;
      const botHud = botHudA || botHudB;

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe = Math.max(topSafe, h(topHud) * 0.55);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(botHud));
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if (hudHidden) {
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(botHud) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  WIN.addEventListener('resize', update, { passive: true });
  WIN.addEventListener('orientationchange', update, { passive: true });

  // HUD toggle button (both ids)
  WIN.addEventListener('click', (e) => {
    const id = e?.target?.id || '';
    if (id === 'btnHideHud' || id === 'btnHideHud2') {
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive: true });

  // when view switches (enter/exit vr)
  WIN.addEventListener('hha:view', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive: true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function sanityPatchFxLayer() {
  // If CSS fails, ensure FX layer still visible above playfield but below HUD clicks
  // (particles.js already makes .hha-fx-layer fixed; this forces z-index safe)
  try {
    const layer = DOC.querySelector('.hha-fx-layer');
    if (layer) {
      const z = Number(getComputedStyle(layer).zIndex || '0');
      if (!Number.isFinite(z) || z < 120) layer.style.zIndex = '140';
      layer.style.pointerEvents = 'none';
    }
  } catch (_) {}
}

function start() {
  // STRICT AUTO BASE VIEW (pc/mobile) — never trust ?view= unless forceView=1
  const baseView = baseAutoView();
  setBodyView(baseView);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  // If FX scripts loaded with defer, wait 1 tick then ensure layer on top
  setTimeout(sanityPatchFxLayer, 50);
  setTimeout(sanityPatchFxLayer, 280);

  // collect params
  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
  const run  = String(qs('run', 'play') || 'play').toLowerCase();
  const time = clamp(qs('time', '80'), 20, 300);

  // seed rules:
  // - research: prefer seed= ; fallback ts= ; fallback fixed token
  // - play: prefer seed= ; fallback now()
  const seedParam = qs('seed', null);
  const tsParam = qs('ts', null);

  const seed =
    (run === 'research')
      ? (seedParam ?? tsParam ?? 'RESEARCH-SEED')
      : (seedParam ?? nowSeed());

  engineBoot({
    view: baseView,
    diff,
    run,
    time,
    seed,

    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();