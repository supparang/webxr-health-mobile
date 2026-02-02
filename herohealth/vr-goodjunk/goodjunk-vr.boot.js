// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (STRICT AUTO + CLEAN)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile (UA-based)
// ✅ Auto-load ../vr/vr-ui.js only if WebXR exists (navigator.xr) and not already present
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Boots engine: ./goodjunk.safe.js (module export boot())
// Notes:
// - Recommended: include ../vr/particles.js + ../vr/hha-fx-director.js before this boot (defer ok)
// - Logger optional: ../vr/hha-cloud-logger.js

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isMobileUA() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}

function baseAutoView() {
  return isMobileUA() ? 'mobile' : 'pc';
}

function setBodyView(view) {
  const b = DOC.body;
  if (!b) return;

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
}

function ensureVrUiLoaded() {
  // load only if WebXR exists
  if (!('xr' in navigator)) return;

  // if already loaded by <script defer>, don't inject
  if (WIN.__HHA_VRUI_LOADED__ || WIN.__HHA_VR_UI_LOADED__) return;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if (exists) return;

  // mark to prevent duplicates
  WIN.__HHA_VRUI_LOADED__ = true;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  s.onerror = () => console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

function bindVrAutoSwitch() {
  const base = baseAutoView();

  function emitViewChanged() {
    try {
      WIN.dispatchEvent(new CustomEvent('hha:view', { detail: { view: DOC.body?.dataset?.view || base } }));
    } catch (_) {}
  }

  function onEnter() {
    // Enter VR: mobile => cvr, desktop => vr
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    emitViewChanged();
  }

  function onExit() {
    setBodyView(base);
    emitViewChanged();
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive: true });
  WIN.addEventListener('hha:exit-vr', onExit, { passive: true });

  // Expose manual reset
  WIN.HHA_GJ_resetView = onExit;
}

function bindDebugKeys() {
  // convenience for PC testing
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

      // elements that can block top/bottom
      const topbar  = DOC.querySelector('.gj-topbar');
      const hudTop  = DOC.getElementById('hud') || DOC.getElementById('gjHudTop');
      const miniHud = DOC.getElementById('vrMiniHud');
      const fever   = DOC.getElementById('feverBox');
      const hudBot  = DOC.querySelector('.gj-hud-bot') || DOC.getElementById('gjHudBot');
      const controls= DOC.querySelector('.hha-controls');

      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(miniHud));
      topSafe = Math.max(topSafe, h(hudTop) * 0.55);
      topSafe += (14 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever));
      bottomSafe = Math.max(bottomSafe, h(hudBot) * 0.55);
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if (hudHidden) {
        topSafe = Math.max(72 + sat, h(topbar) + 10 + sat);
        bottomSafe = Math.max(76 + sab, h(fever) + 10 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  WIN.addEventListener('resize', update, { passive: true });
  WIN.addEventListener('orientationchange', update, { passive: true });

  // when HUD toggles
  WIN.addEventListener('click', (e) => {
    if (e?.target?.id === 'btnHideHud' || e?.target?.id === 'btnHideHud2') {
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

function waitForFxCore(ms = 900) {
  // FX is optional but we want it ready early
  return new Promise((resolve) => {
    const t0 = performance.now();
    (function tick() {
      const ok =
        !!WIN.HHA_FX ||
        !!WIN.Particles ||
        (!!WIN.GAME_MODULES && !!WIN.GAME_MODULES.Particles);
      if (ok) return resolve(true);
      if (performance.now() - t0 > ms) return resolve(false);
      requestAnimationFrame(tick);
    })();
  });
}

async function start() {
  // STRICT AUTO BASE VIEW — never read ?view=
  const view = baseAutoView();
  setBodyView(view);

  // ensure vr-ui available if WebXR exists
  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  // wait for FX core briefly (safe even if missing)
  const fxReady = await waitForFxCore(900);
  if (!fxReady) {
    console.warn('[GoodJunkVR] FX core not detected yet (particles.js). Game will still run.');
  }

  engineBoot({
    view, // base view; will become cvr/vr after enter via events
    diff: qs('diff', 'normal'),
    run: qs('run', 'play'),
    time: qs('time', '80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    // optional tuning if safe.js reads it
    lockPx: Number(qs('lockPx', '0')) || undefined,
  });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();