// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + VR-UI + SAFE-ZONE)
// FULL FINAL v20260220b
//
// ✅ Auto detect view (pc/mobile/cvr/vr) + allow override via ?view=
// ✅ Auto load ../vr/vr-ui.js once (only when needed)
// ✅ Compute safe zones -> sets :root CSS vars:
//    --gj-top-safe, --gj-bottom-safe, --sat/--sab/--sal/--sar
// ✅ HUD-safe spawn: prevents targets under topbar/hud/bottom meters
// ✅ No duplicate listeners / no double boot (guards with window.GJ_BOOT)
// ✅ End overlay remains controlled by safe.js (boot binds actions only)
// ✅ FIX HUB: default ไป /herohealth/hub.html (absolute) + still respects ?hub=
// ✅ B) bindBasicButtons รองรับ “id เดิม + id มาตรฐาน” และใช้ onOnce + กัน bind ซ้ำ
//
// Requires:
// - goodjunk.safe.js exports boot(payload)
// - goodjunk-vr.html includes IDs used by safe.js + UI

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

(function () {
  const WIN = window;
  const DOC = document;

  // ------------------------------------------------------------
  // global guard (no double boot)
  // ------------------------------------------------------------
  if (WIN.GJ_BOOT && WIN.GJ_BOOT.started) {
    console.warn('[GJ BOOT] already started, skip');
    return;
  }
  WIN.GJ_BOOT = WIN.GJ_BOOT || {};
  WIN.GJ_BOOT.started = true;
  WIN.GJ_BOOT.version = 'v20260220b';

  // ------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const qs = (k, d = null) => {
    try {
      return new URL(location.href).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  };
  const byId = (id) => DOC.getElementById(id);

  function setRootVar(name, value) {
    try { DOC.documentElement.style.setProperty(name, String(value)); } catch (_) {}
  }

  function getPxVar(name, fallback = 0) {
    try {
      const cs = getComputedStyle(DOC.documentElement);
      const raw = String(cs.getPropertyValue(name) || '').trim();
      const n = Number(raw.replace('px', '').trim());
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function detectView() {
    const v = String(qs('view', '') || '').toLowerCase().trim();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

    // stereo hint from hub
    const stereo = String(qs('stereo', '') || '').toLowerCase().trim();
    if (stereo === '1' || stereo === 'true') return 'cvr';

    // heuristic
    const w = DOC.documentElement.clientWidth || WIN.innerWidth || 800;
    let hasCoarse = false;
    try { hasCoarse = !!WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches; } catch (_) {}
    if (!hasCoarse && w >= 760) return 'pc';
    return 'mobile';
  }

  // ------------------------------------------------------------
  // safe zone compute (for spawn/hud)
  // ------------------------------------------------------------
  function computeSafeZones() {
    const topbar   = DOC.querySelector('.gj-topbar');
    const hudTop   = byId('hud') || DOC.querySelector('.gj-hud-top');
    const hudBot   = DOC.querySelector('.gj-hud-bot');
    const controls = DOC.querySelector('.hha-controls'); // includes vr-ui buttons sometimes

    const H = DOC.documentElement.clientHeight || WIN.innerHeight || 700;

    // If CSS already sets env(safe-area-inset-*), we read back via CSS vars.
    // Otherwise default 0.
    const sat = getPxVar('--sat', 0);
    const sab = getPxVar('--sab', 0);
    const sal = getPxVar('--sal', 0);
    const sar = getPxVar('--sar', 0);

    // write them anyway so CSS can rely on vars consistently
    setRootVar('--sat', `${sat}px`);
    setRootVar('--sab', `${sab}px`);
    setRootVar('--sal', `${sal}px`);
    setRootVar('--sar', `${sar}px`);

    function rectH(el) {
      if (!el) return 0;
      try {
        const r = el.getBoundingClientRect();
        return Math.max(0, r.height || 0);
      } catch (_) {
        return 0;
      }
    }

    const topbarH   = rectH(topbar);
    const hudTopH   = rectH(hudTop);
    const hudBotH   = rectH(hudBot);
    const controlsH = rectH(controls);

    // top reserved space
    let topSafe = topbarH + hudTopH + 10;
    topSafe = clamp(topSafe, 110 + sat, Math.floor(H * 0.55));

    // bottom reserved space
    let bottomSafe = hudBotH + Math.max(0, controlsH - 8) + 10;
    bottomSafe = clamp(bottomSafe, 90 + sab, Math.floor(H * 0.50));

    // short screens
    if (H <= 640) {
      bottomSafe = clamp(bottomSafe, 80 + sab, Math.floor(H * 0.42));
      topSafe    = clamp(topSafe, 100 + sat, Math.floor(H * 0.50));
    }
    if (H <= 560) {
      bottomSafe = clamp(bottomSafe, 70 + sab, Math.floor(H * 0.38));
      topSafe    = clamp(topSafe, 92 + sat, Math.floor(H * 0.46));
    }

    setRootVar('--gj-top-safe', `${Math.round(topSafe)}px`);
    setRootVar('--gj-bottom-safe', `${Math.round(bottomSafe)}px`);

    WIN.GJ_BOOT.safe = {
      topSafe, bottomSafe,
      topbarH, hudTopH, hudBotH, controlsH,
      H, sat, sab, sal, sar
    };
  }

  // ------------------------------------------------------------
  // load script once (vr-ui.js)
  // ------------------------------------------------------------
  function normalizeSrcKey(src) {
    return String(src || '').replace(/[?#].*$/, '');
  }

  function hasScriptLoaded(src) {
    const norm = normalizeSrcKey(src);
    try {
      return Array.from(DOC.scripts || []).some((s) => normalizeSrcKey(s.src || '').includes(norm));
    } catch (_) {
      return false;
    }
  }

  function loadScriptOnce(src) {
    return new Promise((resolve) => {
      try {
        const key = '__LOADED__' + normalizeSrcKey(src);
        if (WIN[key]) return resolve(true);

        if (hasScriptLoaded(src)) {
          WIN[key] = true;
          return resolve(true);
        }

        const s = DOC.createElement('script');
        s.src = src;
        s.defer = true;
        s.onload = () => { WIN[key] = true; resolve(true); };
        s.onerror = () => { resolve(false); };
        DOC.head.appendChild(s);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function ensureVrUi(view) {
    const need = (view === 'vr' || view === 'cvr' || String(qs('vrui', '0')) === '1');
    if (!need) return;

    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {};

    if (view === 'cvr') {
      WIN.HHA_VRUI_CONFIG.cvrStrict = true;
      WIN.HHA_VRUI_CONFIG.lockPx = Number(qs('lockPx', '28')) || 28;
      WIN.HHA_VRUI_CONFIG.cooldownMs = Number(qs('cooldownMs', '90')) || 90;
      WIN.HHA_VRUI_CONFIG.showCrosshair = true;
      WIN.HHA_VRUI_CONFIG.showButtons = true;
    }

    // Optional in VR too
    if (view === 'vr') {
      WIN.HHA_VRUI_CONFIG.showButtons = true;
      if (!Number.isFinite(Number(WIN.HHA_VRUI_CONFIG.cooldownMs))) {
        WIN.HHA_VRUI_CONFIG.cooldownMs = Number(qs('cooldownMs', '90')) || 90;
      }
    }

    await loadScriptOnce('../vr/vr-ui.js?v=20260216a');
  }

  // ------------------------------------------------------------
  // HUB url resolver (absolute default + respects ?hub=)
  // ------------------------------------------------------------
  function resolveHubUrl() {
    const raw = qs('hub', null);
    if (raw) return raw;

    // works on GitHub Pages project path /webxr-health-mobile
    const origin = location.origin || '';
    const pathname = location.pathname || '';
    const m = pathname.match(/^(.*?\/webxr-health-mobile)(?:\/|$)/i);
    const repoBase = m ? m[1] : '/webxr-health-mobile';
    return origin + repoBase + '/herohealth/hub.html';
  }

  // ------------------------------------------------------------
  // onOnce binder helper (prevents duplicate binding)
  // ------------------------------------------------------------
  function onOnce(el, type, fn, opts) {
    if (!el || !type || !fn) return false;
    try {
      el.__hhaBound = el.__hhaBound || {};
      const key = String(type) + '::' + (fn.__bindKey || fn.name || 'anon');
      if (el.__hhaBound[key]) return false;
      el.__hhaBound[key] = true;
      el.addEventListener(type, fn, opts);
      return true;
    } catch (_) {
      try { el.addEventListener(type, fn, opts); } catch (__){}
      return true;
    }
  }

  function firstExisting(ids) {
    for (const id of ids) {
      const el = byId(id);
      if (el) return el;
    }
    return null;
  }

  function allExisting(ids) {
    const seen = new Set();
    const out = [];
    for (const id of ids) {
      const el = byId(id);
      if (el && !seen.has(el)) {
        seen.add(el);
        out.push(el);
      }
    }
    return out;
  }

  // ------------------------------------------------------------
  // bind buttons (supports legacy + standard IDs)
  // ------------------------------------------------------------
  function bindBasicButtons() {
    // Standard + legacy IDs (บางรอบใช้ชื่อไม่เหมือนกัน)
    const restartButtons = allExisting([
      'btnRestart',     // top (standard)
      'btnRestartTop',  // top (legacy)
      'btnRestartEnd'   // end overlay
    ]);

    const hubButtons = allExisting([
      'btnHub',         // top (standard)
      'btnHubTop',      // top (legacy)
      'btnBackHub'      // end overlay
    ]);

    const restartHandler = function onRestartClick(ev) {
      try { ev && ev.preventDefault && ev.preventDefault(); } catch (_) {}
      const u = new URL(location.href);

      // bump seed in play mode to avoid stale cache/freeze feeling
      if (String(qs('run', 'play')).toLowerCase() !== 'research') {
        u.searchParams.set('seed', String(Date.now()));
      }

      // optional cache buster
      u.searchParams.set('_r', String(Date.now()));
      location.href = u.toString();
    };
    restartHandler.__bindKey = 'restart';

    const hubHandler = function onHubClick(ev) {
      try { ev && ev.preventDefault && ev.preventDefault(); } catch (_) {}
      location.href = resolveHubUrl();
    };
    hubHandler.__bindKey = 'goHub';

    restartButtons.forEach((el) => onOnce(el, 'click', restartHandler));
    hubButtons.forEach((el) => onOnce(el, 'click', hubHandler));

    // Neutralize inline onclick in end button if present (HTML เก่า)
    const btnRestartEnd = firstExisting(['btnRestartEnd']);
    if (btnRestartEnd) {
      try { btnRestartEnd.onclick = null; } catch (_) {}
    }

    WIN.GJ_BOOT.boundButtons = {
      restart: restartButtons.map((x) => x.id || '(no-id)'),
      hub: hubButtons.map((x) => x.id || '(no-id)')
    };
  }

  // ------------------------------------------------------------
  // extra guards (reserved)
  // ------------------------------------------------------------
  function guardIntervals() {
    // placeholder: no-op for now
    // kept to avoid adding duplicate interval logic in future patches
  }

  // ------------------------------------------------------------
  // main
  // ------------------------------------------------------------
  async function main() {
    if (WIN.GJ_BOOT.mainRan) {
      console.warn('[GJ BOOT] main already ran, skip');
      return;
    }
    WIN.GJ_BOOT.mainRan = true;

    const view = detectView();
    WIN.GJ_BOOT.view = view;

    // body classes for CSS
    DOC.body.classList.toggle('view-pc', view === 'pc');
    DOC.body.classList.toggle('view-mobile', view === 'mobile');
    DOC.body.classList.toggle('view-vr', view === 'vr');
    DOC.body.classList.toggle('view-cvr', view === 'cvr');

    // ensure VR UI first (it may inject controls/buttons)
    await ensureVrUi(view);

    // compute safe zones after potential UI injection
    computeSafeZones();

    // bind buttons (restart/hub)
    bindBasicButtons();
    guardIntervals();

    // recalc safe zone on layout changes
    let raf = 0;
    const requestRecalc = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        computeSafeZones();
      });
    };

    // bind recalc listeners once
    if (!WIN.GJ_BOOT.recalcBound) {
      WIN.GJ_BOOT.recalcBound = true;

      WIN.addEventListener('resize', requestRecalc, { passive: true });
      WIN.addEventListener('orientationchange', requestRecalc, { passive: true });

      DOC.addEventListener('click', (e) => {
        const t = e && e.target;
        if (!t) return;
        const id = t.id || '';
        // include old/new ids if UI changed
        if (
          id === 'btnHideHud' ||
          id === 'btnMissions' ||
          id === 'btnQuestOpen' ||
          id === 'btnQuestClose' ||
          id === 'btnClosePeek'
        ) {
          setTimeout(requestRecalc, 30);
          setTimeout(requestRecalc, 180);
        }
      }, { passive: true });
    }

    // recalc after fonts/layout settle
    setTimeout(requestRecalc, 180);
    setTimeout(requestRecalc, 600);
    setTimeout(requestRecalc, 1200);

    // payload -> safe engine
    const payload = {
      view,
      run:  String(qs('run', 'play') || 'play'),
      diff: String(qs('diff', 'normal') || 'normal'),
      time: Number(qs('time', '80') || 80),
      hub:  qs('hub', null),
      seed: qs('seed', null) ?? qs('ts', null),
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null))
    };

    WIN.GJ_BOOT.payload = payload;
    WIN.GJ_BOOT.resolveHubUrl = resolveHubUrl;

    // start SAFE engine (single source of truth)
    try {
      bootSafe(payload);
      WIN.GJ_BOOT.safeStarted = true;
    } catch (err) {
      console.error('[GJ BOOT] bootSafe failed:', err);
      WIN.GJ_BOOT.safeStarted = false;
      WIN.GJ_BOOT.error = String(err && (err.stack || err.message) || err);

      try {
        const div = DOC.createElement('div');
        div.style.position = 'fixed';
        div.style.left = '12px';
        div.style.right = '12px';
        div.style.bottom = '12px';
        div.style.zIndex = '9999';
        div.style.padding = '10px 12px';
        div.style.borderRadius = '14px';
        div.style.background = 'rgba(255,80,80,.18)';
        div.style.border = '1px solid rgba(255,80,80,.35)';
        div.style.color = 'rgba(255,240,240,.95)';
        div.style.font = '600 14px system-ui,-apple-system,sans-serif';
        div.textContent = 'GoodJunkVR error: เปิด console ดูรายละเอียด';
        DOC.body.appendChild(div);
      } catch (_) {}
    }
  }

  // ------------------------------------------------------------
  // DOM ready
  // ------------------------------------------------------------
  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', main, { once: true });
  } else {
    main();
  }
})();