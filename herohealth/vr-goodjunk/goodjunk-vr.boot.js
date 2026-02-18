// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + AUTO VR UI + SAFE-ZONE) — v20260218a
//
// ✅ Auto base view: pc / mobile (ignores ?view= by default)
// ✅ Auto-switch on Enter/Exit VR via hha:enter-vr / hha:exit-vr:
//    - mobile -> cvr
//    - desktop -> vr
// ✅ Auto-load ../vr/vr-ui.js only when WebXR exists (navigator.xr)
// ✅ Safe-zone compute from actual DOM heights -> sets:
//    --gj-top-safe, --gj-bottom-safe
// ✅ Recompute on resize/orientation + HUD/Quest toggle + after VR enter/exit
// ✅ No duplicate listeners / no duplicate boot
//
// Requires: ./goodjunk.safe.js exports boot(payload)

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

if (WIN.__HHA_GJ_BOOT__) {
  // prevent double boot
} else {
  WIN.__HHA_GJ_BOOT__ = true;
}

// ---------------- helpers ----------------
function qs(k, def = null) {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v, a, b) {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function isMobileUA() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}
function raf2(fn){ requestAnimationFrame(()=>requestAnimationFrame(fn)); }

// ---------------- view class ----------------
function setBodyView(view) {
  const b = DOC.body;
  b.classList.add('gj');
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');

  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  DOC.body.dataset.view = view;

  // Right eye layer visible only for cVR
  const r = DOC.getElementById('gj-layer-r');
  if (r) r.setAttribute('aria-hidden', (view === 'cvr') ? 'false' : 'true');
}

function baseAutoView() {
  return isMobileUA() ? 'mobile' : 'pc';
}

// ---------------- auto VR UI load ----------------
function ensureVrUiLoaded() {
  // Load only if WebXR exists (so ENTER VR makes sense)
  if (!navigator.xr) return;

  if (WIN.__HHA_VR_UI_LOADED__) return;
  WIN.__HHA_VR_UI_LOADED__ = true;

  const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes('/vr/vr-ui.js'));
  if (exists) return;

  // Configure VR UI defaults (safe; vr-ui.js reads this)
  WIN.HHA_VRUI_CONFIG = Object.assign({}, WIN.HHA_VRUI_CONFIG || {}, {
    lockPx: 28,
    cooldownMs: 90,
    showCrosshair: true,
    showButtons: true,
    cvrStrict: true
  });

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js?v=20260218a';
  s.defer = true;
  s.onerror = () => console.warn('[GoodJunkVR] vr-ui.js failed to load');
  DOC.head.appendChild(s);
}

// ---------------- VR auto switch ----------------
function bindVrAutoSwitch() {
  const base = baseAutoView();

  function onEnter() {
    // Enter VR: mobile => cvr, desktop => vr
    setBodyView(isMobileUA() ? 'cvr' : 'vr');
    try { WIN.dispatchEvent(new CustomEvent('hha:view', { detail: { view: DOC.body.dataset.view } })); } catch (_) {}
  }
  function onExit() {
    setBodyView(base);
    try { WIN.dispatchEvent(new CustomEvent('hha:view', { detail: { view: DOC.body.dataset.view } })); } catch (_) {}
  }

  WIN.addEventListener('hha:enter-vr', onEnter, { passive: true });
  WIN.addEventListener('hha:exit-vr', onExit, { passive: true });

  WIN.HHA_GJ_resetView = onExit;
}

// ---------------- debug keys -> shoot ----------------
function bindDebugKeys() {
  WIN.addEventListener('keydown', (e) => {
    const k = e.key || '';
    if (k === ' ' || k === 'Enter') {
      try { WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail: { source: 'key' } })); } catch (_) {}
    }
  }, { passive: true });
}

// ---------------- SAFE-ZONE (fix: targets behind HUD) ----------------
function hudSafeMeasure() {
  const root = DOC.documentElement;
  const px = (n) => Math.max(0, Math.round(Number(n) || 0)) + 'px';
  const h = (el) => { try { return el ? el.getBoundingClientRect().height : 0; } catch { return 0; } };
  const isHidden = (el) => {
    try { return !el || getComputedStyle(el).display === 'none' || el.getAttribute('aria-hidden') === 'true'; }
    catch { return true; }
  };

  function update() {
    try {
      const cs = getComputedStyle(root);
      const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
      const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

      const topbar = DOC.querySelector('.gj-topbar');
      const hudTop = DOC.getElementById('hud');             // gj-hud-top
      const prog   = DOC.querySelector('.gj-progress');     // optional
      const boss   = DOC.getElementById('bossBar');         // optional
      const questPanel = DOC.getElementById('questPanel');  // optional overlay
      const miniHud = DOC.getElementById('vrMiniHud');      // chip row

      const hudBot = DOC.querySelector('.gj-hud-bot');
      const fever  = DOC.getElementById('feverBox');
      const controls = DOC.querySelector('.hha-controls');  // optional cluster

      const hudHidden = DOC.body.classList.contains('hud-hidden');
      const questOpen = DOC.body.classList.contains('quest-open') ||
                        (questPanel && questPanel.getAttribute('aria-hidden') === 'false');

      let topSafe = 0;

      // Always reserve topbar
      topSafe = Math.max(topSafe, h(topbar));

      if (!hudHidden) {
        // reserve HUD top + optional rows
        topSafe = Math.max(topSafe, h(hudTop));
        if (!isHidden(prog)) topSafe = Math.max(topSafe, h(hudTop) + h(prog));
        if (boss && boss.getAttribute('aria-hidden') === 'false') topSafe = Math.max(topSafe, h(hudTop) + h(prog) + h(boss));
        topSafe = Math.max(topSafe, h(miniHud) + h(topbar));
      } else {
        // if HUD hidden, still keep a minimal safe band below topbar
        topSafe = Math.max(topSafe, 62);
      }

      // Quest panel is an overlay (center), but on short screens it can overlap playfield edges.
      // Add a small extra margin while open to keep spawns away from extreme top.
      if (questOpen) topSafe += 18;

      topSafe += (14 + sat);

      let bottomSafe = 0;

      if (!hudHidden) {
        bottomSafe = Math.max(bottomSafe, h(hudBot));
        bottomSafe = Math.max(bottomSafe, h(fever));
      } else {
        bottomSafe = Math.max(bottomSafe, 72);
      }

      bottomSafe = Math.max(bottomSafe, h(controls));
      bottomSafe += (16 + sab);

      root.style.setProperty('--gj-top-safe', px(topSafe));
      root.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    } catch (_) {}
  }

  // Recompute when:
  // - resize/orientation
  // - view switches (enter/exit vr)
  // - HUD/Quest toggles
  const kick = () => { raf2(update); setTimeout(update, 120); setTimeout(update, 320); };

  WIN.addEventListener('resize', kick, { passive: true });
  WIN.addEventListener('orientationchange', kick, { passive: true });
  WIN.addEventListener('hha:view', kick, { passive: true });

  // Observe body class changes (hud-hidden / quest-open)
  try {
    const mo = new MutationObserver(() => kick());
    mo.observe(DOC.body, { attributes: true, attributeFilter: ['class'] });
  } catch (_) {}

  // Also recalc periodically (handles font load / late layout)
  setTimeout(kick, 0);
  setTimeout(kick, 200);
  setTimeout(kick, 500);
  setInterval(update, 1200);
}

// ---------------- start ----------------
function start() {
  // AUTO BASE VIEW (ignore ?view=)
  const base = baseAutoView();
  setBodyView(base);

  ensureVrUiLoaded();
  bindVrAutoSwitch();
  bindDebugKeys();
  hudSafeMeasure();

  engineBoot({
    view: base, // engine will still respect hha:shoot and will work after view switch
    diff: qs('diff', 'normal'),
    run: qs('run', 'play'),
    time: qs('time', '80'),
    seed: qs('seed', null),
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', start);
else start();