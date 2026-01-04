// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — PACK 15 (PRODUCTION-SAFE)
// ✅ Default: OFF (enabled only with ?ai=1 in play)
// ✅ Research: ALWAYS OFF (even if ai=1)
// ✅ Deterministic-ready: receives seed + can use seeded RNG if needed later
// ✅ Provides attach/detach + hook points:
//    - Difficulty Director (adaptive pacing)  [stub]
//    - AI Coach micro-tips (explainable)      [stub, rate-limited]
//    - Pattern Generator (storm/boss/spawn)  [stub]
//
// This file MUST NEVER break the game if AI is disabled.
// Exports: window.GroupsVR.AIHooks

(function (root) {
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  // ---------------- Utilities ----------------
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function emit(name, detail) {
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  // ---------------- State ----------------
  const S = {
    attached: false,
    enabled: false,
    runMode: 'play',
    seed: '',
    rng: null,

    // live metrics (from events)
    score: 0,
    combo: 0,
    misses: 0,
    acc: 0,
    left: 0,

    // rate-limit coach tips
    lastTipAt: 0,
    tipCooldownMs: 4500,
  };

  // ---------------- Hooks: Difficulty Director (stub) ----------------
  // In future, can call into engine (if engine exposes setters).
  function difficultyDirectorTick() {
    // ✅ safe no-op now
    // Idea: observe acc/combo/misses/left and suggest spawn pacing or target mix.
  }

  // ---------------- Hooks: AI Coach (explainable micro-tips) ----------------
  function maybeCoachTip(reason) {
    if (!S.enabled) return;
    const now = Date.now();
    if (now - S.lastTipAt < S.tipCooldownMs) return;
    S.lastTipAt = now;

    // Micro tips: short, explainable, never spam
    let text = '';
    let mood = 'neutral';

    if (reason === 'miss_spike') {
      text = 'ทิป: ช้าลงนิดนึง เล็งให้ตรง “หมู่ที่ต้องยิง” ก่อนค่อยยิง 🎯';
      mood = 'sad';
    } else if (reason === 'good_streak') {
      text = 'ทิป: คอมโบมาแล้ว! รักษาจังหวะเดิมไว้ แล้วค่อยเร่ง 🔥';
      mood = 'happy';
    } else if (reason === 'low_acc') {
      text = 'ทิป: ดูสีขอบเป้าให้ทัน — เขียวคือถูกหมู่, เหลืองคือผิดหมู่, แดงคือขยะ';
      mood = 'neutral';
    } else if (reason === 'clutch') {
      text = 'ทิป: ช่วงท้าย ให้ยิง “เป้าใกล้กลางจอ” ก่อน จะพลาดน้อยลง ✅';
      mood = 'fever';
    } else {
      text = 'ทิป: ถ้าเริ่มหลุดคอมโบ ให้รีเซ็ตจังหวะ 1–2 วินาทีแล้วค่อยยิงต่อ ✨';
      mood = 'neutral';
    }

    emit('hha:coach', { text, mood });
  }

  // ---------------- Hooks: Pattern Generator (stub) ----------------
  // Placeholder for deterministic spawn patterns (storm waves/boss bursts)
  function patternDirectorTick() {
    // ✅ safe no-op now
  }

  // ---------------- Event listeners ----------------
  function onScore(ev) {
    const d = ev.detail || {};
    S.score = Number(d.score || 0);
    S.combo = Number(d.combo || 0);
    S.misses = Number(d.misses || 0);

    if (!S.enabled) return;

    // heuristics
    if (S.combo >= 8 && (S.rng && S.rng() < 0.15)) maybeCoachTip('good_streak');
    if (S.misses >= 6 && (S.rng && S.rng() < 0.12)) maybeCoachTip('miss_spike');

    difficultyDirectorTick();
  }

  function onRank(ev) {
    const d = ev.detail || {};
    S.acc = Number(d.accuracy || 0);

    if (!S.enabled) return;
    if (S.acc > 0 && S.acc < 55 && (S.rng && S.rng() < 0.18)) maybeCoachTip('low_acc');
  }

  function onTime(ev) {
    const d = ev.detail || {};
    S.left = Number(d.left || 0);

    if (!S.enabled) return;
    if (S.left > 0 && S.left <= 10 && (S.rng && S.rng() < 0.22)) maybeCoachTip('clutch');

    patternDirectorTick();
  }

  // ---------------- Public API ----------------
  function attach(cfg) {
    cfg = cfg || {};
    const runMode = String(cfg.runMode || 'play').toLowerCase();
    const requested = !!cfg.enabled;

    // ✅ research OFF hard
    const enabled = (runMode !== 'research') && requested;

    S.runMode = runMode;
    S.enabled = enabled;
    S.seed = String(cfg.seed || '');
    S.rng = makeRng(hashSeed(S.seed + '::aihooks'));

    if (S.attached) {
      // already attached: just update enabled state
      if (enabled) emit('hha:coach', { text: 'AI (ทดลอง) เปิดแล้ว 🤖', mood: 'happy' });
      return;
    }

    // attach listeners (lightweight, safe)
    try {
      root.addEventListener('hha:score', onScore, { passive: true });
      root.addEventListener('hha:rank',  onRank,  { passive: true });
      root.addEventListener('hha:time',  onTime,  { passive: true });
    } catch (_) {}

    S.attached = true;

    if (enabled) {
      emit('hha:coach', { text: 'AI (ทดลอง) เปิดแล้ว: ปรับตามการเล่น + ทิปสั้น ๆ ✨', mood: 'happy' });
    }
  }

  function detach() {
    if (!S.attached) return;
    try {
      root.removeEventListener('hha:score', onScore);
      root.removeEventListener('hha:rank', onRank);
      root.removeEventListener('hha:time', onTime);
    } catch (_) {}
    S.attached = false;
    S.enabled = false;
  }

  NS.AIHooks = { attach, detach };

})(typeof window !== 'undefined' ? window : globalThis);