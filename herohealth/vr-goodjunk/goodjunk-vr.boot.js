// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (STRICT AUTO + SAFE-MEASURE FIX for v4.2 + LOGGER INIT)
// ✅ NO MENU, NO OVERRIDE: ignores ?view= entirely
// ✅ Auto base view: pc / mobile (UA-based)
// ✅ Auto-load ../vr/vr-ui.js only if WebXR exists (navigator.xr) and not already present
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ HUD-safe measure -> sets CSS vars --gj-top-safe / --gj-bottom-safe
// ✅ Listens gj:measureSafe (emitted by safe.js boss toggle) to re-measure instantly
// ✅ INIT logger ctx (HHA_LOGGER) before engineBoot()
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

/** ✅ INIT LOGGER (safe no-op if not present or already inited) */
function initLoggerCtx(baseView) {
  try {
    const L = WIN.HHA_LOGGER;
    if (!L || typeof L.init !== 'function') return;

    const cfg = {
      game: 'GoodJunkVR',
      // useful for dashboards / filters
      run: qs('run', 'play'),
      diff: qs('diff', 'normal'),
      time: Number(qs('time', '80') || 80),
      seed: qs('seed', null),
      hub: qs('hub', null),
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null)),
      viewBase: baseView || baseAutoView(),
      pageKey: 'vr-goodjunk/goodjunk-vr.html'
    };

    L.init(cfg);

    if (typeof L.log === 'function') {
      L.log('boot', {
        page: 'goodjunk-vr.boot.js',
        baseView: cfg.viewBase,
        run: cfg.run,
        diff: cfg.diff,
        time: cfg.time,
        seed: cfg.seed,
        hasXR: ('xr' in navigator)
      });
    }
  } catch (_) {}
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
      const topbar   = DOC.querySelector('.gj-topbar');
      const progress = DOC.querySelector('.gj-progress');
      const hudTop   = DOC.getElementById('hud') || DOC.getElementById('gjHudTop');
      const fever    = DOC.getElementById('feverBox');
      const hudBot   = DOC.querySelector('.gj-hud-bot') || DOC.getElementById('gjHudBot');
      const controls = DOC.querySelector('.hha-controls');

      // ✅ IMPORTANT: อย่าเผื่อ HUD สูงเกิน (มันจะกินสนามจน “ไม่มีที่เกิดเป้า”)
      // ให้เผื่อ “พอประมาณ” + safe-area
      let topSafe = 0;
      topSafe = Math.max(topSafe, h(topbar));
      topSafe = Math.max(topSafe, h(progress));
      topSafe = Math.max(topSafe, h(hudTop) * 0.30); // เดิม 0.55 → บังสนามมากไป
      topSafe += (12 + sat);

      let bottomSafe = 0;
      bottomSafe = Math.max(bottomSafe, h(fever) * 0.65); // กันแค่ส่วนสำคัญ
      bottomSafe = Math.max(bottomSafe, h(hudBot) * 0.25);
      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (14 + sab);

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      if (hudHidden) {
        topSafe = Math.max(68 + sat, h(topbar) + h(progress) + 8 + sat);
        bottomSafe = Math.max(72 + sab, h(fever) * 0.40 + 8 + sab);
      }

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  // base triggers
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

  // ✅ when safe.js asks to re-measure (boss bar show/hide)
  WIN.addEventListener('gj:measureSafe', () => {
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 360);
  }, { passive: true });

  // initial + periodic (กัน delayed layout)
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

  // ✅ logger ctx MUST come early (before engine emits hha:start)
  initLoggerCtx(view);

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