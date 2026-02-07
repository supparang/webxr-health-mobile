// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (STRICT AUTO + SAFE-MEASURE FIX)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile (UA-based)
// ✅ Auto-load ../vr/vr-ui.js only if WebXR exists (navigator.xr) and not already present
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure (PATCH): measures ONLY #hudMainRow (not GOAL/MINI cards)
// ✅ Listens gj:measureSafe to re-measure instantly
// ✅ Boots engine: ./goodjunk.safe.js (module export boot())

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

  const r = DOC.getElementById('gj-layer-r');
  if (r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');

  b.dataset.view = view;
}

function ensureVrUiLoaded() {
  if (!('xr' in navigator)) return;

  if (WIN.__HHA_VRUI_LOADED__ || WIN.__HHA_VR_UI_LOADED__) return;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if (exists) return;

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
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    emitViewChanged();
  }

  function onExit() {
    setBodyView(base);
    emitViewChanged();
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive: true });
  WIN.addEventListener('hha:exit-vr', onExit, { passive: true });

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

/** ✅ PATCH: measure safe-top using ONLY #hudMainRow (not GOAL/MINI cards) */
function hudSafeMeasure() {
  const root = DOC.documentElement;

  const px = (n) => Math.max(0, Math.round(Number(n) || 0)) + 'px';
  const h = (el) => { try { return el ? el.getBoundingClientRect().height : 0; } catch { return 0; } };

  function update() {
    try {
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar   = DOC.querySelector('.gj-topbar');
      const progress = DOC.querySelector('.gj-progress');

      // ✅ only main HUD row
      const hudMain  = DOC.getElementById('hudMainRow');

      const fever    = DOC.getElementById('feverBox');
      const hudBot   = DOC.querySelector('.gj-hud-bot') || DOC.getElementById('gjHudBot');
      const controls = DOC.querySelector('.hha-controls');

      // TOP SAFE
      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(progress));
      topSafe = Math.max(topSafe, h(hudMain) * 0.22);
      topSafe += (10 + sat);

      // BOTTOM SAFE
      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever) * 0.40);
      bottomSafe = Math.max(bottomSafe, h(hudBot) * 0.18);
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (12 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if (hudHidden) {
        topSafe = Math.max(56 + sat, h(topbar) + h(progress) + 6 + sat);
        bottomSafe = Math.max(64 + sab, h(fever) * 0.28 + 8 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  WIN.addEventListener('resize', update, { passive: true });
  WIN.addEventListener('orientationchange', update, { passive: true });

  WIN.addEventListener('click', (e) => {
    if (e?.target?.id === 'btnHideHud' || e?.target?.id === 'btnHideHud2') {
      setTimeout(update, 30);
      setTimeout(update, 180);
      setTimeout(update, 420);
    }
  }, { passive: true });

  WIN.addEventListener('hha:view', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 350);
  }, { passive: true });

  WIN.addEventListener('gj:measureSafe', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 360);
  }, { passive: true });

  setTimeout(update, 0);
  setTimeout(update, 120);
  setTimeout(update, 350);
  setInterval(update, 1200);
}

function waitForFxCore(ms = 900) {
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
  const view = baseAutoView();
  setBodyView(view);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  const fxReady = await waitForFxCore(900);
  if (!fxReady) {
    console.warn('[GoodJunkVR] FX core not detected yet (particles.js). Game will still run.');
  }

  engineBoot({
    view,
    diff: qs('diff', 'normal'),
    run: qs('run', 'play'),
    time: qs('time', '80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    lockPx: Number(qs('lockPx', '0')) || undefined,
  });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();