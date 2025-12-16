// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — FIX v5 (emoji ALWAYS visible)
// ✅ เป้าไม่เป็นแผ่นขาวอีกแล้ว: ใช้ a-text เป็น emoji เป้าหลัก (ไม่พึ่ง texture)
// ✅ plane (พื้น) ทำโปร่งใส/ไม่โชว์ เพื่อไม่ให้เป็นบล็อคขาว
// ✅ spawn หน้าเลนส์ตามทิศกล้องจริง
// ✅ goal + mini quest progress + quest:update
// ✅ timeout นับ miss เฉพาะ good/bonus (junk หลุดไม่โดนไม่ลงโทษ)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function r(min, max) { return min + Math.random() * (max - min); }

function dispatch(name, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
}

function getParticles() {
  const gm = ROOT.GAME_MODULES || {};
  return gm.Particles || ROOT.Particles || null;
}

const EMOJI = {
  good:    ['🥦','🍎','🥛','🥗','🍌','🥕','🍇'],
  junk:    ['🍟','🍔','🍕','🍩','🍿','🧋','🥤'],
  star:    ['⭐'],
  diamond: ['💎'],
  shield:  ['🛡️']
};
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function diffCfg(diffKey) {
  const d = String(diffKey || 'normal').toLowerCase();
  if (d === 'easy') {
    return {
      spawnMs: 920, ttlMs: 1700, maxActive: 4,
      scale: 1.18, goodRatio: 0.72, bonusRatio: 0.11,
      goalGoodTarget: 14, junkLimit: 4,
      miniComboTarget: 6, miniBonusTarget: 2, miniPerfectStreak: 5
    };
  }
  if (d === 'hard') {
    return {
      spawnMs: 650, ttlMs: 1150, maxActive: 5,
      scale: 1.03, goodRatio: 0.60, bonusRatio: 0.13,
      goalGoodTarget: 16, junkLimit: 3,
      miniComboTarget: 8, miniBonusTarget: 3, miniPerfectStreak: 7
    };
  }
  return {
    spawn
