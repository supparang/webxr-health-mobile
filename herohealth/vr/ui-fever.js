// === /herohealth/vr/ui-fever.js ===
// HeroHealth — Fever UI (IIFE / Global) — PRODUCTION
// ✅ NO export (แก้ปัญหา Unexpected token 'export')
// ✅ Expose: window.FeverUI + window.GAME_MODULES.FeverUI
// ✅ Bind to DOM: #fever-pct #fever-bar .hha-fever-card (ถ้ามี)
// ✅ Safe: ทำงานได้แม้ element บางตัวไม่มี
// ✅ API: set/add/getState/activateShield/isShield/setEnabled
// ✅ Auto tick: decay เล็กน้อย + broadcast event 'hha:fever'

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  function clamp(v, a, b) {
    v = Number(v) || 0;
    if (v < a) return a;
    if (v > b) return b;
    return v;
  }

  // -----------------------------
  // State
  // -----------------------------
  const S = {
    pct: 0,                 // 0..100
    enabled: true,
    shieldUntil: 0,         // ts (ms)
    lastTs: 0,
    // tuning
    decayPerSec: 1.15,      // ลด fever ต่อวินาที (เบา ๆ)
    minShow: 0,
    maxShow: 100
  };

  // -----------------------------
  // DOM refs (lazy)
  // -----------------------------
  const UI = {
    ready: false,
    pctEl: null,
    barEl: null,
    cardEl: null,
    rootEl: null
  };

  function qs(sel) {
    try { return DOC.querySelector(sel); } catch { return null; }
  }
  function byId(id) {
    try { return DOC.getElementById(id); } catch { return null; }
  }

  function ensureDom() {
    if (UI.ready) return;

    UI.pctEl  = byId('fever-pct');
    UI.barEl  = byId('fever-bar');
    UI.cardEl = qs('.hha-fever-card');
    UI.rootEl = DOC.documentElement;

    UI.ready = true;
  }

  function setCssVars() {
    ensureDom();
    try {
      if (UI.rootEl) UI.rootEl.style.setProperty('--hha-fever', String(S.pct));
      if (UI.cardEl) {
        UI.cardEl.dataset.fever = String(Math.round(S.pct));
        if (S.pct >= 70) UI.cardEl.classList.add('hha-fever-hot');
        else UI.cardEl.classList.remove('hha-fever-hot');
        if (isShield()) UI.cardEl.classList.add('hha-shield-on');
        else UI.cardEl.classList.remove('hha-shield-on');
      }
    } catch {}
  }

  function render() {
    ensureDom();

    const pct = Math.round(S.pct);
    try {
      if (UI.pctEl) UI.pctEl.textContent = pct + '%';
      if (UI.barEl) UI.barEl.style.width = clamp(pct, 0, 100) + '%';
    } catch {}

    setCssVars();
  }

  function broadcast() {
    try {
      root.dispatchEvent(new CustomEvent('hha:fever', {
        detail: {
          pct: S.pct,
          shield: isShield(),
          shieldLeftMs: Math.max(0, S.shieldUntil - now())
        }
      }));
    } catch {}
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // -----------------------------
  // Shield
  // -----------------------------
  function isShield() {
    return now() < (S.shieldUntil || 0);
  }

  function activateShield(ms) {
    ms = clamp(ms == null ? 4500 : ms, 800, 20000);
    const t = now() + ms;
    S.shieldUntil = Math.max(S.shieldUntil || 0, t);
    render();
    broadcast();
    return { shieldUntil: S.shieldUntil };
  }

  // -----------------------------
  // Fever adjust
  // -----------------------------
  function setPct(pct, reason) {
    S.pct = clamp(pct, S.minShow, S.maxShow);
    render();
    broadcast();
    return { pct: S.pct, reason: reason || null };
  }

  function addPct(delta, reason) {
    delta = Number(delta) || 0;
    if (!S.enabled) return { pct: S.pct, ignored: true, reason: 'disabled' };

    // ถ้า shield อยู่ และกำลังเพิ่ม fever (delta>0) ให้เบาลง
    if (delta > 0 && isShield()) delta *= 0.25;

    S.pct = clamp(S.pct + delta, S.minShow, S.maxShow);
    render();
    broadcast();
    return { pct: S.pct, delta, reason: reason || null };
  }

  // -----------------------------
  // Tick loop (auto decay)
  // -----------------------------
  let rafId = null;

  function tick(ts) {
    if (!S.enabled) {
      rafId = root.requestAnimationFrame(tick);
      return;
    }

    if (!S.lastTs) S.lastTs = ts;
    const dt = ts - S.lastTs;
    S.lastTs = ts;

    if (dt > 0 && S.pct > 0) {
      const dec = (S.decayPerSec * dt) / 1000;
      if (dec > 0.0001) {
        S.pct = clamp(S.pct - dec, S.minShow, S.maxShow);
        // render แบบประหยัด: อัปเดตเป็นช่วง ๆ
        // แต่เพื่อความชัวร์ในมือถือ เรา render ทุกครั้ง (เบามาก)
        render();
        broadcast();
      }
    }

    rafId = root.requestAnimationFrame(tick);
  }

  function startLoop() {
    try {
      if (rafId != null) return;
      rafId = root.requestAnimationFrame(tick);
    } catch {}
  }

  function stopLoop() {
    try {
      if (rafId != null) root.cancelAnimationFrame(rafId);
    } catch {}
    rafId = null;
  }

  // -----------------------------
  // Optional: listen helper events
  // -----------------------------
  function bindEvents() {
    // เพิ่ม/ตั้งค่า fever ผ่าน event ได้ (เผื่อเกมอื่นยิงมา)
    root.addEventListener('hha:fever:add', (e) => {
      const d = e && e.detail ? e.detail : {};
      addPct(Number(d.delta || 0), d.reason || 'event:add');
    });

    root.addEventListener('hha:fever:set', (e) => {
      const d = e && e.detail ? e.detail : {};
      setPct(Number(d.pct || 0), d.reason || 'event:set');
    });

    root.addEventListener('hha:shield', (e) => {
      const d = e && e.detail ? e.detail : {};
      activateShield(d.ms == null ? 4500 : d.ms);
    });

    // รีเซ็ตง่าย ๆ
    root.addEventListener('hha:reset', () => {
      S.pct = 0;
      S.shieldUntil = 0;
      render();
      broadcast();
    });

    // หยุดทั้งระบบตอนเกม stop
    root.addEventListener('hha:stop', () => {
      // ไม่ reset ค่า (บางเกมอยากสรุปผล)
      stopLoop();
    });
  }

  // -----------------------------
  // Public API
  // -----------------------------
  const FeverUI = {
    ensure() { ensureDom(); render(); return true; },

    // state
    getState() {
      return {
        pct: S.pct,
        enabled: S.enabled,
        shield: isShield(),
        shieldLeftMs: Math.max(0, S.shieldUntil - now())
      };
    },

    // control
    setEnabled(v) {
      S.enabled = !!v;
      if (S.enabled) startLoop();
      return { enabled: S.enabled };
    },

    // fever
    set(pct, reason) { return setPct(pct, reason); },
    add(delta, reason) { return addPct(delta, reason); },

    // shield
    activateShield(ms) { return activateShield(ms); },
    isShield() { return isShield(); },

    // tuning
    setDecayPerSec(v) {
      S.decayPerSec = clamp(v, 0, 8);
      return { decayPerSec: S.decayPerSec };
    }
  };

  // publish
  root.FeverUI = FeverUI;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = FeverUI;

  // init
  function init() {
    ensureDom();
    render();
    bindEvents();
    startLoop();
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : globalThis);