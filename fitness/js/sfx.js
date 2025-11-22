// === js/sfx.js — Audio helper (2025-11-24, cooldown + pitch + volume) ===
'use strict';

const LAST_PLAY = {};
const COOLDOWN_MS = 80; // กัน spam เสียงซ้อนถี่เกินไป

function _play(id, { volume = 1, randomPitch = false, pitchSpread = 0.06 } = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const now = (window.performance && performance.now) ? performance.now() : Date.now();
  const last = LAST_PLAY[id] || 0;
  if (now - last < COOLDOWN_MS) return; // cooldown
  LAST_PLAY[id] = now;

  try {
    // reset
    el.pause();
    el.currentTime = 0;

    // pitch (ใช้ playbackRate)
    if (randomPitch) {
      const base = 1;
      const spread = pitchSpread; // ±
      const v = base + (Math.random() * 2 - 1) * spread;
      el.playbackRate = Math.max(0.85, Math.min(1.15, v));
    } else {
      el.playbackRate = 1;
    }

    // volume curve
    el.volume = Math.max(0, Math.min(1, volume));

    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(()=>{});
  } catch (e) {
    // เงียบ ๆ ถ้าเล่นไม่ได้
  }
}

// grade: 'perfect' | 'good' | 'bad'
export function playHit(grade = 'good') {
  let vol = 0.95;
  let pitchSpread = 0.04;

  if (grade === 'perfect') {
    vol = 1.0;
    pitchSpread = 0.07;   // perfect สนุกกว่า นิดนึง
  } else if (grade === 'bad') {
    vol = 0.85;
    pitchSpread = 0.03;
  }

  _play('sfx-hit', { volume: vol, randomPitch: true, pitchSpread });
}

export function playBomb() {
  // ระเบิด: เสียงดังหน่อย แต่ pitch ไม่ต้องแกว่งเยอะ
  _play('sfx-bomb', { volume: 1.0, randomPitch: true, pitchSpread: 0.03 });
}

export function playMiss() {
  // miss: เบากว่า hit หน่อย
  _play('sfx-miss', { volume: 0.85, randomPitch: false });
}

export function playFever() {
  // fever: ไม่ให้เล่นถี่เกินไปด้วย cooldown
  _play('sfx-fever', { volume: 1.0, randomPitch: true, pitchSpread: 0.05 });
}

export function playBoss() {
  _play('sfx-boss', { volume: 1.0, randomPitch: false });
}
