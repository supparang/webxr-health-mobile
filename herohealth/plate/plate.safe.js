// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks placeholder)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

/* ------------------------------------------------
 * ModeFactory bridge (global build)
 * ------------------------------------------------ */
function getModeFactoryBoot() {
  const GM = window.GAME_MODULES || {};

  // Try common names used across your HHA builds
  const MF =
    GM.ModeFactory ||
    GM.modeFactory ||
    GM.SpawnFactory ||
    GM.TargetFactory ||
    window.ModeFactory ||
    window.modeFactory ||
    null;

  const bootFn =
    (MF && (MF.boot || MF.spawnBoot || MF.create || MF.start)) ||
    null;

  if (typeof bootFn !== 'function') {
    throw new Error(
      'PlateVR: mode-factory boot not found. ' +
      'Load ../vr/mode-factory.js BEFORE plate.boot.js (as <script defer>).'
    );
  }
  return bootFn;
}

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
    sub: 'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ชิ้น/หมู่)',
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

  // mode / cfg
  cfg: null,
  rng: Math.random,

  // spawn
  engine: null
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
    comboMax: STATE.comboMax
  });
}

function addScore(v) {
  STATE.score += v;
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
 * Accuracy
 * ------------------------------------------------ */
function accuracy() {
  // ✅ นับหมด: hit good + hit junk + good expire (เพราะปล่อยให้หมดอายุคือพลาด)
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

  clearInterval(STATE.timer);
  STATE.timer = null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

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

    // tiny tension coach near end
    if (STATE.timeLeft === 15) coach('อีก 15 วิ! รีบเติมให้ครบ 🏃‍♀️', 'Coach');

    if (STATE.timeLeft <= 0) {
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalProgress() {
  // goal = จำนวนหมู่ที่ “เคยเก็บได้แล้วอย่างน้อย 1”
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;

  if (!STATE.goal.done && STATE.goal.cur >= STATE.goal.target) {
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function updateMiniProgress() {
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if (!STATE.mini.done && accPct >= STATE.mini.target) {
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function onHitGood(groupIndex) {
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalProgress();
  updateMiniProgress();

  emitQuest();

  // win condition: when both done, end quickly (but allow a tiny moment)
  if (STATE.goal.done && STATE.mini.done && !STATE.ended) {
    coach('ผ่านแล้ว! เก่งมาก 🥳', 'Coach');
    setTimeout(() => endGame('cleared'), 450);
  }
}

function onHitJunk() {
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();
  addScore(-50);

  updateMiniProgress();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood() {
  STATE.expireGood++;
  STATE.miss++;

  resetCombo();
  updateMiniProgress();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount) {
  const spawnBoot = getModeFactoryBoot();

  // ✅ speed per diff (tune)
  const rate =
    (STATE.cfg.diff === 'hard') ? 650 :
    (STATE.cfg.diff === 'easy') ? 980 :
    820; // normal

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // common knobs (mode-factory ignores unknown keys safely)
    spawnRate: rate,
    sizeRange: [44, 64],

    // spawn distribution
    kinds: [
      { kind: 'good',  weight: 0.72 },
      { kind: 'junk',  weight: 0.28 }
      // (optional) shield/star/diamond can be added later
    ],

    // called by factory when hit
    onHit: (t) => {
      if (!STATE.running || STATE.ended) return;

      if (t.kind === 'good') {
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng() * 5);
        onHitGood(gi);
      } else {
        onHitJunk();
      }
    },

    // called by factory when expires
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

  // reset
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

  STATE.g = [0, 0, 0, 0, 0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  if (cfg.runMode === 'research' || cfg.runMode === 'study') {
    STATE.rng = seededRng(cfg.seed || Date.now());
  } else {
    STATE.rng = Math.random;
  }

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

  // init spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}