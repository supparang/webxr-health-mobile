// =========================================================
// /herohealth/plate/plate.safe.js
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) PATCHED
// HHA Standard
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (ถ้าจะเปิดในอนาคต)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses: ../vr/mode-factory.js (export boot)  ← FIXED
// =========================================================

'use strict';

import { boot as modeBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pctInt = (n) => Math.round(Number(n) || 0);

function seededRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running: false,
  ended: false,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  timeLeft: 0,
  timer: null,

  // plate groups (5 หมู่)
  g: [0, 0, 0, 0, 0], // index 0-4

  // quest
  goal: {
    name: 'เติมจานให้ครบ 5 หมู่',
    sub: 'เก็บอาหารให้ครบทุกหมู่',
    cur: 0,
    target: 5,
    done: false
  },
  mini: {
    name: 'ความแม่นยำ',
    sub: 'คุมความแม่น ≥ 80%',
    cur: 0,
    target: 80,
    done: false
  },

  // counters
  hitGood: 0,
  hitJunk: 0,
  expireGood: 0,

  // shield
  shield: 0,

  // mode / cfg
  cfg: null,
  rng: Math.random,

  // spawn controller
  controller: null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail) {
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function emitQuest() {
  emit('quest:update', {
    goal: {
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini: {
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag = 'Coach') {
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore() {
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    shield: STATE.shield
  });
}

function addScore(v) {
  STATE.score += (Number(v) || 0);
  emitScore();
}

function addCombo() {
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo() {
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy (HHA Standard-ish)
 * total = hitGood + hitJunk + expireGood
 * ------------------------------------------------ */
function accuracy() {
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if (total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason = 'timeup') {
  if (STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  if (STATE.timer) clearInterval(STATE.timer);
  STATE.timer = null;

  // stop spawner
  try { STATE.controller?.stop?.(); } catch { /* ignore */ }

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pctInt(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer() {
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(() => {
    if (!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if (STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex) {
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: นับหมู่ที่มีอย่างน้อย 1 ชิ้น
  if (!STATE.goal.done) {
    STATE.goal.cur = STATE.g.filter(v => v > 0).length;
    if (STATE.goal.cur >= STATE.goal.target) {
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if (!STATE.mini.done && accPct >= STATE.mini.target) {
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk() {
  STATE.hitJunk++;

  // shield block (ถ้ามี)
  if (STATE.shield > 0) {
    STATE.shield--;
    coach('🛡️ Shield ช่วยไว้แล้ว!', 'Shield');
    emitScore();
    return;
  }

  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitScore();
}

function onHitShield() {
  STATE.shield = clamp(STATE.shield + 1, 0, 3);
  coach('ได้ 🛡️ Shield!', 'Power');
  emitScore();
}

function onExpireGood() {
  STATE.expireGood++;

  // shield ไม่กัน “พลาดดีหมดเวลา” ตามมาตรฐานส่วนใหญ่
  STATE.miss++;
  resetCombo();
  emitScore();
}

/* ------------------------------------------------
 * Spawner
 * ------------------------------------------------ */
function makeSpawner(mount) {
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // เร่งนิด ๆ ตามที่สั่ง: hard=650, normal=820, easy=950
  const spawnEveryMs =
    diff === 'hard' ? 650 :
    diff === 'easy' ? 950 : 820;

  // good/junk/shield
  const kinds = [
    { kind: 'good',   weight: 0.70 },
    { kind: 'junk',   weight: 0.27 },
    { kind: 'shield', weight: 0.03 }
  ];

  return modeBoot({
    mount,
    seed: Number(STATE.cfg?.seed || Date.now()),
    spawnEveryMs,
    sizeRange: [46, 68],
    kinds,

    // Plate-specific payload extension
    makeTargetData: (kind, rng) => {
      if (kind === 'good') {
        return { groupIndex: Math.floor(rng() * 5) };
      }
      return {};
    },

    onHit: (t) => {
      if (!STATE.running || STATE.ended) return;

      if (t.kind === 'good') {
        const gi = (t.groupIndex ?? Math.floor(STATE.rng() * 5));
        onHitGood(gi);
      } else if (t.kind === 'shield') {
        onHitShield();
      } else {
        onHitJunk();
      }
    },

    onExpire: (t) => {
      if (!STATE.running || STATE.ended) return;
      if (t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }) {
  if (!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;
  STATE.shield = 0;
  STATE.g = [0, 0, 0, 0, 0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const rm = (cfg?.runMode || 'play').toLowerCase();
  if (rm === 'research' || rm === 'study') {
    STATE.rng = seededRng(Number(cfg.seed || Date.now()));
  } else {
    STATE.rng = Math.random;
  }

  // time: default 90 (ตามที่คุย)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game: 'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // start spawner
  STATE.controller = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}
