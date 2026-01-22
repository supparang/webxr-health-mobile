// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — PLAY ONLY (research-safe)
// ✅ A (Rule-based Predictor): คาดการณ์เสี่ยงพลาด + micro-tips
// ✅ B (Online ML-lite): ปรับน้ำหนัก predictor แบบ online (SGD) + personal baseline (localStorage)
// ✅ C (DL-ready): เก็บ feature+label เป็น dataset buffer (ยังไม่ train) + export hook
//
// Activate: ?run=play&ai=1
// Level: ?ailvl=a|b|c  (default a)
// Safety: run=research/practice => disabled always

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  if (NS.AIHooks) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (root.performance && performance.now) ? performance.now() : Date.now();
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function isPlay() {
    const run = String(qs('run', 'play') || 'play').toLowerCase();
    return run === 'play';
  }

  function aiWanted() {
    const on = String(qs('ai', '0') || '0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  function level() {
    const lv = String(qs('ailvl', 'a') || 'a').toLowerCase();
    if (lv === 'b' || lv === 'c') return lv;
    return 'a';
  }

  // ---------------- State ----------------
  const ST = {
    enabled: false,
    level: 'a',
    seed: '',
    runMode: 'play',

    // last-known telemetry
    score: 0,
    combo: 0,
    misses: 0,
    acc: 0,
    grade: 'C',
    pressure: 0,
    stormOn: false,
    miniOn: false,
    miniLeft: 0,
    miniNeed: 0,
    miniNow: 0,
    groupName: '',
    groupKey: '',

    // rate limits
    lastTipAt: 0,
    lastAdjustAt: 0,
    lastBannerAt: 0,

    // difficulty modifiers (applied into engine if supported)
    mod: {
      spawnMul: 1.0,     // <1 => faster spawn, >1 => slower
      wrongDelta: 0.0,
      junkDelta: 0.0,
      sizeMul: 1.0,
      lifeMul: 1.0
    },

    // ML-lite weights (B)
    w: null,

    // dataset buffer (C)
    data: [],
    dataMax: 240
  };

  const LS_W = 'HHA_GROUPS_AI_W_B';
  const LS_BASE = 'HHA_GROUPS_AI_BASELINE';

  function loadWeightsB() {
    try {
      const raw = localStorage.getItem(LS_W);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    // baseline weights (small + stable)
    return { b0: -1.2, wMissRate: 2.2, wAccLow: 2.0, wPressure: 0.9, wStorm: 0.6, wMini: 0.5, lr: 0.06 };
  }

  function saveWeightsB(w) {
    try { localStorage.setItem(LS_W, JSON.stringify(w)); } catch (_) {}
  }

  function loadBaseline() {
    try {
      const raw = localStorage.getItem(LS_BASE);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { plays: 0, emaAcc: 70, emaMissPerMin: 4.0 };
  }

  function saveBaseline(b) {
    try { localStorage.setItem(LS_BASE, JSON.stringify(b)); } catch (_) {}
  }

  // ---------------- Feature extraction ----------------
  function missRatePerMin() {
    // crude estimate using planned time; good enough for play fun
    const time = Number(qs('time', 90) || 90);
    const played = Math.max(10, (time - Math.max(0, Number(qs('time', 90) || 90) - 1))); // dummy guard
    // fallback: misses per 90s => per min
    return (ST.misses / Math.max(0.5, (time / 60)));
  }

  function riskA() {
    // Normalize
    const accLow = clamp((80 - ST.acc) / 40, 0, 1);              // 0..1
    const mr = clamp(missRatePerMin() / 10, 0, 1);              // 0..1
    const p = clamp(ST.pressure / 3, 0, 1);                     // 0..1
    const s = ST.stormOn ? 1 : 0;
    const m = ST.miniOn ? 1 : 0;

    // Rule-based logistic (stable)
    const x =
      (-1.0) +
      (2.3 * mr) +
      (2.0 * accLow) +
      (1.0 * p) +
      (0.7 * s) +
      (0.5 * m);

    return sigmoid(x); // 0..1
  }

  function riskB() {
    const w = ST.w || loadWeightsB();
    const accLow = clamp((80 - ST.acc) / 40, 0, 1);
    const mr = clamp(missRatePerMin() / 10, 0, 1);
    const p = clamp(ST.pressure / 3, 0, 1);
    const s = ST.stormOn ? 1 : 0;
    const m = ST.miniOn ? 1 : 0;

    const x =
      (w.b0 || 0) +
      (w.wMissRate || 0) * mr +
      (w.wAccLow || 0) * accLow +
      (w.wPressure || 0) * p +
      (w.wStorm || 0) * s +
      (w.wMini || 0) * m;

    return sigmoid(x);
  }

  function getRisk() {
    return (ST.level === 'b' || ST.level === 'c') ? riskB() : riskA();
  }

  // ---------------- Tips / Coach ----------------
  function tip(text, mood) {
    if (!ST.enabled) return;
    const t = nowMs();
    if (t - ST.lastTipAt < 2400) return;
    ST.lastTipAt = t;
    emit('hha:coach', { text, mood: mood || 'neutral' });
  }

  function banner(text, ms) {
    if (!ST.enabled) return;
    const t = nowMs();
    if (t - ST.lastBannerAt < 900) return;
    ST.lastBannerAt = t;
    try {
      const w = DOC.getElementById('bannerWrap');
      const tx = DOC.getElementById('bannerText');
      if (!w || !tx) return;
      tx.innerHTML = String(text || '—');
      w.classList.add('show');
      clearTimeout(banner._t);
      banner._t = setTimeout(() => { try { w.classList.remove('show'); } catch (_) {} }, ms || 1100);
    } catch (_) {}
  }

  // ---------------- Difficulty Director (play-only) ----------------
  function applyToEngine() {
    try {
      const E = NS.GameEngine;
      if (!E || typeof E.setAIModifiers !== 'function') return;
      E.setAIModifiers(Object.assign({}, ST.mod));
    } catch (_) {}
  }

  function adjustDifficulty() {
    if (!ST.enabled) return;
    const t = nowMs();
    if (t - ST.lastAdjustAt < 1600) return;
    ST.lastAdjustAt = t;

    const r = getRisk(); // 0..1
    const acc = ST.acc | 0;
    const combo = ST.combo | 0;

    // Goal: risk ~ 0.35–0.55 (ตึงกำลังดี)
    // ถ้าเด็กเทพมาก: เพิ่มความท้าทาย (เร็วขึ้น/เล็กลง/อายุสั้นลง/ขยะเพิ่มนิด)
    // ถ้ากำลังพลาดหนัก: ผ่อน (ช้าลง/ใหญ่ขึ้น/อายุยาวขึ้น/ขยะลด)
    let spawnMul = ST.mod.spawnMul;
    let sizeMul  = ST.mod.sizeMul;
    let lifeMul  = ST.mod.lifeMul;
    let wrongD   = ST.mod.wrongDelta;
    let junkD    = ST.mod.junkDelta;

    if (r < 0.30 && acc >= 85 && combo >= 6) {
      spawnMul = clamp(spawnMul * 0.94, 0.78, 1.18);
      sizeMul  = clamp(sizeMul  * 0.98, 0.92, 1.10);
      lifeMul  = clamp(lifeMul  * 0.96, 0.85, 1.15);
      wrongD   = clamp(wrongD + 0.01, -0.06, 0.10);
      junkD    = clamp(junkD  + 0.008, -0.05, 0.10);
      banner('🤖 AI: เพิ่มความท้าทาย!', 900);
      tip('เก่งมาก! ต่อไปเป้าจะไวขึ้นนิดนะ 🔥', 'happy');
    }
    else if (r > 0.70 || (ST.pressure >= 2 && acc < 70)) {
      spawnMul = clamp(spawnMul * 1.06, 0.78, 1.26);
      sizeMul  = clamp(sizeMul  * 1.03, 0.92, 1.20);
      lifeMul  = clamp(lifeMul  * 1.05, 0.85, 1.25);
      wrongD   = clamp(wrongD - 0.012, -0.10, 0.10);
      junkD    = clamp(junkD  - 0.012, -0.10, 0.10);
      banner('🤖 AI: ผ่อนให้นิด (อย่าท้อ!)', 1100);
      tip('ค่อย ๆ เล็งนะ ไม่ต้องรีบ ยิงให้ถูกหมู่ก่อน 👀', 'neutral');
    }
    else {
      // drift back toward neutral slowly
      spawnMul = spawnMul + (1.0 - spawnMul) * 0.06;
      sizeMul  = sizeMul  + (1.0 - sizeMul)  * 0.06;
      lifeMul  = lifeMul  + (1.0 - lifeMul)  * 0.06;
      wrongD   = wrongD   * 0.92;
      junkD    = junkD    * 0.92;
    }

    ST.mod.spawnMul = spawnMul;
    ST.mod.sizeMul  = sizeMul;
    ST.mod.lifeMul  = lifeMul;
    ST.mod.wrongDelta = wrongD;
    ST.mod.junkDelta  = junkD;

    applyToEngine();
  }

  // ---------------- Online ML-lite (B) ----------------
  function sgdUpdate(label01) {
    if (!ST.enabled) return;
    if (ST.level !== 'b' && ST.level !== 'c') return;

    // label: 1=bad event (miss/bad), 0=good hit streak
    const w = ST.w || loadWeightsB();
    const y = label01 ? 1 : 0;

    const accLow = clamp((80 - ST.acc) / 40, 0, 1);
    const mr = clamp(missRatePerMin() / 10, 0, 1);
    const p = clamp(ST.pressure / 3, 0, 1);
    const s = ST.stormOn ? 1 : 0;
    const m = ST.miniOn ? 1 : 0;

    const x =
      (w.b0 || 0) +
      (w.wMissRate || 0) * mr +
      (w.wAccLow || 0) * accLow +
      (w.wPressure || 0) * p +
      (w.wStorm || 0) * s +
      (w.wMini || 0) * m;

    const pHat = sigmoid(x);
    const err = (y - pHat);
    const lr = clamp(w.lr || 0.06, 0.01, 0.12);

    w.b0        = (w.b0 || 0) + lr * err * 1.0;
    w.wMissRate = (w.wMissRate || 0) + lr * err * mr;
    w.wAccLow   = (w.wAccLow || 0) + lr * err * accLow;
    w.wPressure = (w.wPressure || 0) + lr * err * p;
    w.wStorm    = (w.wStorm || 0) + lr * err * s;
    w.wMini     = (w.wMini || 0) + lr * err * m;

    ST.w = w;
    saveWeightsB(w);
  }

  // ---------------- DL-ready dataset buffer (C) ----------------
  function pushData(label, extra) {
    if (!ST.enabled) return;
    if (ST.level !== 'c') return;
    const row = Object.assign({
      t: Date.now(),
      seed: ST.seed,
      diff: String(qs('diff', 'normal') || 'normal'),
      style: String(qs('style', 'mix') || 'mix'),
      view: String(qs('view', 'mobile') || 'mobile'),
      score: ST.score|0,
      combo: ST.combo|0,
      misses: ST.misses|0,
      acc: ST.acc|0,
      pressure: ST.pressure|0,
      stormOn: ST.stormOn ? 1 : 0,
      miniOn: ST.miniOn ? 1 : 0,
      miniLeft: ST.miniLeft|0,
      label: Number(label)||0
    }, extra || {});
    ST.data.push(row);
    if (ST.data.length > ST.dataMax) ST.data.splice(0, ST.data.length - ST.dataMax);

    // Optional: publish for future cloud logger
    emit('ai:data', { row, size: ST.data.length });
  }

  function exportDataset() {
    if (ST.level !== 'c') return null;
    return {
      meta: { game: 'GroupsVR', seed: ST.seed, createdAt: new Date().toISOString() },
      data: ST.data.slice()
    };
  }

  // ---------------- Event wiring ----------------
  function wireEvents() {
    root.addEventListener('hha:score', (ev) => {
      const d = ev.detail || {};
      ST.score = Number(d.score ?? ST.score) || 0;
      ST.combo = Number(d.combo ?? ST.combo) || 0;
      ST.misses = Number(d.misses ?? ST.misses) || 0;
      // adjust every tick-ish
      adjustDifficulty();
    }, { passive: true });

    root.addEventListener('hha:rank', (ev) => {
      const d = ev.detail || {};
      ST.grade = String(d.grade || ST.grade);
      ST.acc = Number(d.accuracy ?? ST.acc) || 0;
      adjustDifficulty();
    }, { passive: true });

    root.addEventListener('groups:progress', (ev) => {
      const d = ev.detail || {};
      if (d.kind === 'pressure') {
        ST.pressure = Number(d.level ?? ST.pressure) || 0;
        adjustDifficulty();
      }
      if (d.kind === 'storm_on') ST.stormOn = true;
      if (d.kind === 'storm_off') ST.stormOn = false;
      if (d.kind === 'perfect_switch') {
        banner(`✨ สลับหมู่!`, 900);
        tip('เยี่ยม! สลับหมู่แล้ว เล็งหมู่ใหม่ให้ไว 🎯', 'happy');
        pushData(0, { e: 'switch' });
      }
    }, { passive: true });

    root.addEventListener('quest:update', (ev) => {
      const d = ev.detail || {};
      ST.groupKey = String(d.groupKey || ST.groupKey);
      ST.groupName = String(d.groupName || ST.groupName);

      const miniTitle = String(d.miniTitle || '—');
      ST.miniOn = (miniTitle !== '—');
      ST.miniLeft = Number(d.miniTimeLeftSec || 0) || 0;
      ST.miniNeed = Number(d.miniTotal || 0) || 0;
      ST.miniNow = Number(d.miniNow || 0) || 0;

      // If mini started and risk high -> give a nudge
      if (ST.miniOn && ST.miniLeft > 0) {
        const r = getRisk();
        if (r > 0.65) tip('MINI กำลังมา! เลือกยิงเฉพาะที่มั่นใจนะ ⚡', 'neutral');
      }
    }, { passive: true });

    root.addEventListener('hha:judge', (ev) => {
      const d = ev.detail || {};
      const k = String(d.kind || '');

      // Online learning signal
      if (k === 'bad' || k === 'miss') { sgdUpdate(1); pushData(1, { e: k }); }
      if (k === 'good' || k === 'perfect') { sgdUpdate(0); pushData(0, { e: k }); }

      // Prediction tip when repeated bad
      if (k === 'bad' || k === 'miss') {
        const r = getRisk();
        if (r > 0.72) {
          tip('ลอง “หยุดครึ่งวิ” แล้วค่อยยิงนะ จะพลาดน้อยลง 💡', ST.pressure >= 2 ? 'fever' : 'neutral');
        }
      }
    }, { passive: true });

    root.addEventListener('hha:end', (ev) => {
      const d = ev.detail || {};
      // update baseline
      try {
        const b = loadBaseline();
        b.plays = (b.plays|0) + 1;
        b.emaAcc = b.emaAcc + (Number(d.accuracyGoodPct ?? ST.acc) - b.emaAcc) * 0.18;
        const mpm = (Number(d.misses ?? ST.misses) / Math.max(1, Number(d.durationPlayedSec ?? 90) / 60));
        b.emaMissPerMin = b.emaMissPerMin + (mpm - b.emaMissPerMin) * 0.18;
        saveBaseline(b);
      } catch (_) {}

      if (ST.level === 'c') {
        // attach dataset export for UI copy if needed later
        try { NS.AIHooks.__lastDataset = exportDataset(); } catch (_) {}
      }

      // reset engine mods toward neutral after end (avoid carryover feel)
      ST.mod = { spawnMul: 1.0, wrongDelta: 0.0, junkDelta: 0.0, sizeMul: 1.0, lifeMul: 1.0 };
      applyToEngine();
    }, { passive: true });
  }

  // ---------------- Public API ----------------
  const API = {
    attach(opts) {
      opts = opts || {};
      const runMode = String(opts.runMode || 'play').toLowerCase();
      const enabled = !!opts.enabled;

      // hard safety gates
      if (runMode !== 'play') { ST.enabled = false; return; }
      if (!isPlay()) { ST.enabled = false; return; }
      if (!aiWanted()) { ST.enabled = false; return; }
      if (!enabled) { ST.enabled = false; return; }

      ST.enabled = true;
      ST.level = level();
      ST.seed = String(opts.seed || '');
      ST.runMode = 'play';

      if (ST.level === 'b' || ST.level === 'c') ST.w = loadWeightsB();

      // one-time wire
      if (!API._wired) {
        API._wired = true;
        wireEvents();
      }

      // initial nudge
      banner(`🤖 AI ON (${ST.level.toUpperCase()})`, 1100);
      tip('AI เปิดแล้ว! จะปรับความท้าทายให้พอดีกับเรา 🎮', 'happy');

      // apply neutral mods now (engine may read immediately)
      applyToEngine();
    },

    isEnabled() { return !!ST.enabled; },
    getState() { return Object.assign({}, ST); },

    // C only
    exportDataset() { return exportDataset(); }
  };

  NS.AIHooks = API;

})(typeof window !== 'undefined' ? window : globalThis);