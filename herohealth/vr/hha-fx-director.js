// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (SAFE, UNIVERSAL)
// ✅ Provides: window.HHA_FX (safe facade)
// ✅ Hooks events: hha:judge, hha:celebrate, quest:update
// ✅ Uses particles.js if available (window.Particles.*), but never hard-depends
// ✅ Adds CSS-based pulses (body class) so FX still works even when particles missing
// ✅ Rate-limit to avoid spam on mobile
//
// Expected optional deps:
// - /herohealth/vr/particles.js -> window.Particles.popText / burstAt / scorePop (any subset)
//
// Notes:
// - Include this AFTER particles.js (both defer is ok), BEFORE game boot.
// - Works for all games (GoodJunk/Groups/Hydration/Plate/etc.)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  // ------------------ helpers ------------------
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

  function safeEmit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function getParticles() {
    // Accept multiple shapes used across your codebase
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function vpPointFromEvent(ev) {
    // best-effort viewport point
    try {
      const d = ev && ev.detail ? ev.detail : null;
      const x = Number(d?.x ?? d?.clientX);
      const y = Number(d?.y ?? d?.clientY);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    } catch (_) {}
    // fallback center
    return {
      x: Math.floor(DOC.documentElement.clientWidth / 2),
      y: Math.floor(DOC.documentElement.clientHeight / 2),
    };
  }

  // ------------------ global CSS FX (always works) ------------------
  // We provide a small common FX style layer so games don't need per-game keyframes
  const style = DOC.createElement('style');
  style.textContent = `
    /* ===== HHA FX Director base ===== */
    .hha-fx-pulse-good { animation: hhaPulseGood 180ms ease-out; }
    .hha-fx-pulse-bad  { animation: hhaPulseBad  220ms ease-out; }
    .hha-fx-pulse-mini { animation: hhaPulseMini 220ms ease-out; }
    .hha-fx-pulse-goal { animation: hhaPulseGoal 240ms ease-out; }
    .hha-fx-pulse-end  { animation: hhaPulseEnd  360ms ease-out; }

    @keyframes hhaPulseGood{
      0%{ filter:saturate(1) brightness(1); }
      60%{ filter:saturate(1.35) brightness(1.10); }
      100%{ filter:saturate(1) brightness(1); }
    }
    @keyframes hhaPulseBad{
      0%{ filter:saturate(1) brightness(1); }
      50%{ filter:saturate(.85) brightness(.95); }
      100%{ filter:saturate(1) brightness(1); }
    }
    @keyframes hhaPulseMini{
      0%{ transform: translateZ(0) scale(1); }
      60%{ transform: translateZ(0) scale(1.01); }
      100%{ transform: translateZ(0) scale(1); }
    }
    @keyframes hhaPulseGoal{
      0%{ transform: translateZ(0) scale(1); filter:saturate(1); }
      65%{ transform: translateZ(0) scale(1.015); filter:saturate(1.35); }
      100%{ transform: translateZ(0) scale(1); filter:saturate(1); }
    }
    @keyframes hhaPulseEnd{
      0%{ filter:blur(0px) saturate(1) brightness(1); }
      55%{ filter:blur(.2px) saturate(1.25) brightness(1.06); }
      100%{ filter:blur(0px) saturate(1) brightness(1); }
    }

    /* text toast (fallback when particles missing) */
    .hha-fx-toast{
      position:fixed;
      left:50%;
      top:calc(16px + env(safe-area-inset-top,0px));
      transform:translateX(-50%);
      z-index:210;
      pointer-events:none;
      padding:10px 14px;
      border-radius:16px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.72);
      color:#e5e7eb;
      font: 900 14px/1.1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
      box-shadow: 0 18px 45px rgba(0,0,0,.35);
      opacity:0;
      animation: hhaToast 900ms ease-out forwards;
    }
    @keyframes hhaToast{
      0%{ opacity:0; transform:translateX(-50%) translateY(-8px); }
      18%{ opacity:1; transform:translateX(-50%) translateY(0px); }
      80%{ opacity:1; transform:translateX(-50%) translateY(0px); }
      100%{ opacity:0; transform:translateX(-50%) translateY(-10px); }
    }
  `;
  DOC.head.appendChild(style);

  function bodyPulse(cls, ms) {
    try {
      DOC.body.classList.add(cls);
      setTimeout(() => { try { DOC.body.classList.remove(cls); } catch (_) {} }, ms || 220);
    } catch (_) {}
  }

  function toast(text) {
    try {
      const el = DOC.createElement('div');
      el.className = 'hha-fx-toast';
      el.textContent = String(text || '');
      DOC.body.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 1100);
    } catch (_) {}
  }

  // ------------------ rate limit ------------------
  const RL = {
    lastJudgeAt: 0,
    lastPopAt: 0,
    lastBurstAt: 0,
    lastToastAt: 0,
  };

  function allow(key, ms) {
    const t = now();
    const last = RL[key] || 0;
    if (t - last < ms) return false;
    RL[key] = t;
    return true;
  }

  // ------------------ safe facade ------------------
  // Provide a consistent surface across the whole project
  const HHA_FX = root.HHA_FX || {};

  // core primitives
  HHA_FX.popText = function (x, y, text) {
    try {
      const P = getParticles();
      if (P && typeof P.popText === 'function') {
        if (!allow('lastPopAt', 55)) return;
        return P.popText(x, y, text);
      }
    } catch (_) {}
    // fallback: tiny toast when particles missing
    if (allow('lastToastAt', 220)) toast(text);
  };

  HHA_FX.scorePop = function (x, y, text) {
    try {
      const P = getParticles();
      if (P && typeof P.scorePop === 'function') {
        if (!allow('lastPopAt', 55)) return;
        return P.scorePop(x, y, text);
      }
    } catch (_) {}
    if (allow('lastToastAt', 220)) toast(text);
  };

  HHA_FX.burstAt = function (x, y, kind) {
    try {
      const P = getParticles();
      if (P && typeof P.burstAt === 'function') {
        if (!allow('lastBurstAt', 70)) return;
        return P.burstAt(x, y, kind);
      }
    } catch (_) {}
    // fallback: body pulse only
    if (kind === 'bad') bodyPulse('hha-fx-pulse-bad', 220);
    else bodyPulse('hha-fx-pulse-good', 180);
  };

  // semantic helpers (recommended for games)
  HHA_FX.good = function (x, y, scoreText) {
    if (scoreText) HHA_FX.scorePop(x, y, scoreText);
    HHA_FX.burstAt(x, y, 'good');
    bodyPulse('hha-fx-pulse-good', 180);
  };

  HHA_FX.bad = function (x, y, text) {
    if (text) HHA_FX.scorePop(x, y, text);
    HHA_FX.burstAt(x, y, 'bad');
    bodyPulse('hha-fx-pulse-bad', 220);
  };

  HHA_FX.block = function (x, y, text) {
    if (text) HHA_FX.scorePop(x, y, text);
    HHA_FX.burstAt(x, y, 'block');
    bodyPulse('hha-fx-pulse-good', 180);
  };

  HHA_FX.star = function (x, y, text) {
    if (text) HHA_FX.scorePop(x, y, text);
    HHA_FX.burstAt(x, y, 'star');
    bodyPulse('hha-fx-pulse-good', 180);
  };

  HHA_FX.shield = function (x, y, text) {
    if (text) HHA_FX.scorePop(x, y, text);
    HHA_FX.burstAt(x, y, 'shield');
    bodyPulse('hha-fx-pulse-good', 180);
  };

  HHA_FX.diamond = function (x, y, text) {
    if (text) HHA_FX.scorePop(x, y, text);
    HHA_FX.burstAt(x, y, 'diamond');
    bodyPulse('hha-fx-pulse-goal', 240);
  };

  HHA_FX.miniClear = function (text) {
    bodyPulse('hha-fx-pulse-mini', 220);
    if (allow('lastToastAt', 260)) toast(text || 'MINI CLEAR!');
  };

  HHA_FX.goalClear = function (text) {
    bodyPulse('hha-fx-pulse-goal', 240);
    if (allow('lastToastAt', 260)) toast(text || 'GOAL!');
  };

  HHA_FX.end = function (text) {
    bodyPulse('hha-fx-pulse-end', 360);
    if (allow('lastToastAt', 420)) toast(text || 'COMPLETED');
  };

  // expose
  root.HHA_FX = HHA_FX;

  // ------------------ event wiring (universal) ------------------
  function onJudge(ev) {
    if (!allow('lastJudgeAt', 55)) return;

    const d = ev?.detail || {};
    const label = String(d.label || d.msg || '').toUpperCase();
    const p = vpPointFromEvent(ev);

    // map common labels -> semantic FX
    if (label.includes('GOOD')) return HHA_FX.good(p.x, p.y, d.scoreText || d.text || '');
    if (label.includes('BLOCK')) return HHA_FX.block(p.x, p.y, d.scoreText || 'BLOCK');
    if (label.includes('STAR')) return HHA_FX.star(p.x, p.y, d.scoreText || 'STAR');
    if (label.includes('SHIELD')) return HHA_FX.shield(p.x, p.y, d.scoreText || 'SHIELD');
    if (label.includes('DIAMOND')) return HHA_FX.diamond(p.x, p.y, d.scoreText || 'DIAMOND');

    if (label.includes('MISS') || label.includes('OOPS') || label.includes('WRONG')) {
      return HHA_FX.bad(p.x, p.y, d.scoreText || 'MISS');
    }

    if (label.includes('MINI')) return HHA_FX.miniClear(d.toast || d.label || 'MINI CLEAR!');
    if (label.includes('GOAL')) return HHA_FX.goalClear(d.toast || d.label || 'GOAL!');

    // generic fallback
    if (d.text) HHA_FX.popText(p.x, p.y, d.text);
  }

  function onCelebrate(ev) {
    const d = ev?.detail || {};
    const kind = String(d.kind || '').toLowerCase();

    if (kind === 'mini') return HHA_FX.miniClear('MINI CLEAR!');
    if (kind === 'goal') return HHA_FX.goalClear('GOAL!');
    if (kind === 'end')  return HHA_FX.end(`END · ${String(d.grade || '').toUpperCase()}`);

    // fallback
    HHA_FX.end('NICE!');
  }

  function onQuestUpdate(ev) {
    // This is “quiet” - we just ensure UI has a little feedback when missions change
    const d = ev?.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;

    // When mini changes, small pulse (rate-limited)
    try {
      if (mini && allow('lastToastAt', 650)) {
        // subtle, not spammy
        // show only title, not long numbers
        const t = mini.title || mini.type || 'MINI';
        toast(`🎯 ${t}`);
      }
      if (goal && allow('lastToastAt', 900)) {
        const t = goal.title || goal.type || 'GOAL';
        toast(`🏁 ${t}`);
      }
    } catch (_) {}
  }

  // Register listeners (capture on window + document for robustness)
  root.addEventListener('hha:judge', onJudge, { passive: true });
  DOC.addEventListener('hha:judge', onJudge, { passive: true });

  root.addEventListener('hha:celebrate', onCelebrate, { passive: true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive: true });

  root.addEventListener('quest:update', onQuestUpdate, { passive: true });
  DOC.addEventListener('quest:update', onQuestUpdate, { passive: true });

  // announce ready (useful for boot waitForFxCore)
  safeEmit('hha:fx-ready', { ok: true, hasParticles: !!getParticles() });
})(window);