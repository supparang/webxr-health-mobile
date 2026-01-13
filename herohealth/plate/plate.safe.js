// =========================================================
// /herohealth/plate/plate.safe.js
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish (rate by diff) ON
//   - research/study: deterministic seed + (no adaptive surprises)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports hooks: Boss/Storm placeholders
// ✅ Crosshair / tap-to-shoot via vr-ui.js => listens hha:shoot
// ✅ "เร่งนิด ๆ": spawnRate faster (easy/normal/hard)
// ✅ "เวลาไม่ยืด": single timer source of truth
// =========================================================

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

/* ---------------------------------------------------------
 * Utilities
 * --------------------------------------------------------- */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function roundPct(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Mulberry-like deterministic RNG
function seededRng(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return Date.now(); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ---------------------------------------------------------
 * Engine state
 * --------------------------------------------------------- */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  durationPlannedSec:90,
  timeLeft:90,
  startedAtMs:0,
  timer:null,

  // plate groups (5 หมู่)
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner engine
  engine:null,

  // shoot listener
  onShoot:null,
};

/* ---------------------------------------------------------
 * Accuracy
 * --------------------------------------------------------- */
function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function updateMiniFromAccuracy(){
  const accPct = accuracy01() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

/* ---------------------------------------------------------
 * Quest update
 * --------------------------------------------------------- */
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ---------------------------------------------------------
 * Coach helper
 * --------------------------------------------------------- */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ---------------------------------------------------------
 * Score helpers
 * --------------------------------------------------------- */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += (Number(v) || 0);
  emitScore();
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ---------------------------------------------------------
 * End game
 * --------------------------------------------------------- */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  if(STATE.timer) clearInterval(STATE.timer);
  STATE.timer = null;

  // detach shoot listener
  if(STATE.onShoot){
    WIN.removeEventListener('hha:shoot', STATE.onShoot);
    STATE.onShoot = null;
  }

  const playedSec = clamp(Math.round((nowMs() - STATE.startedAtMs) / 1000), 0, 99999);

  emit('hha:end', {
    reason,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: roundPct(accuracy01() * 100),

    durationPlannedSec: STATE.durationPlannedSec,
    durationPlayedSec: playedSec,

    // group counts
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // raw counters (useful for logging)
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood
  });
}

/* ---------------------------------------------------------
 * Timer (single source of truth, no "ยืดเวลา")
 * --------------------------------------------------------- */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft = Math.max(0, (STATE.timeLeft - 1));
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ---------------------------------------------------------
 * Hit handlers
 * --------------------------------------------------------- */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6); // เร่งนิด ๆ: combo reward สูงขึ้นเล็กน้อย

  // goal progress: count how many groups have >= 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  updateMiniFromAccuracy();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60); // เร่งนิด ๆ: โดน junk เจ็บขึ้นนิด (กดดัน)
  updateMiniFromAccuracy();
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateMiniFromAccuracy();
  emitQuest();
}

/* ---------------------------------------------------------
 * Difficulty tuning (เร่งนิด ๆ)
 * --------------------------------------------------------- */
function rateByDiff(diff){
  // ms per spawn tick (lower = faster)
  // easy: ช้าหน่อยให้เด็กทำทัน
  // normal: เร็วขึ้น
  // hard: เร็วและกดดัน
  if(diff === 'easy') return 920;
  if(diff === 'hard') return 650;
  return 780; // normal
}

function junkWeightByDiff(diff){
  if(diff === 'easy') return 0.22;
  if(diff === 'hard') return 0.36;
  return 0.30;
}

function sizeRangeByView(view){
  // ช่วยให้ “มองเห็นง่าย” บนมือถือ + ไม่ใหญ่ไปบน PC
  if(view === 'mobile' || view === 'cvr') return [52, 76];
  return [46, 68];
}

/* ---------------------------------------------------------
 * Crosshair shooting support
 * --------------------------------------------------------- */
function attachShootSupport(mount){
  // If spawner exposes a helper, call it. If not, we do "best effort":
  // - find nearest target DOM around shoot point and click it.
  const pickTarget = (x, y, lockPx) => {
    const r = clamp(lockPx, 14, 70);
    // gather candidates in a small square
    const els = Array.from(mount.querySelectorAll('.plateTarget'));
    if(!els.length) return null;

    let best = null;
    let bestD = Infinity;

    for(const el of els){
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      if(d < bestD && d <= r){
        bestD = d;
        best = el;
      }
    }
    return best;
  };

  STATE.onShoot = (e)=>{
    if(!STATE.running) return;
    const d = e.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lockPx = Number(d.lockPx || 28);
    const target = pickTarget(x, y, lockPx);
    if(target){
      // trigger click path (spawner should listen to click/touch)
      target.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true }));
    }
  };

  WIN.addEventListener('hha:shoot', STATE.onShoot);
}

/* ---------------------------------------------------------
 * Spawn logic wrapper
 * --------------------------------------------------------- */
function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const jw = junkWeightByDiff(diff);
  const sr = rateByDiff(diff);

  const view = (STATE.cfg.view || '').toLowerCase();
  const sz = sizeRangeByView(view);

  // NOTE: mode-factory.js should handle safezone / playRect properly.
  // We pass only the essentials here.

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: sr,
    sizeRange: sz,
    kinds:[
      { kind:'good', weight:(1 - jw) },
      { kind:'junk', weight:jw }
    ],
    // Optional hint to factory for data attrs (if supported)
    kindClassMap: { good:'plateTarget', junk:'plateTarget' },

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng() * 5);
        onHitGood(clamp(gi, 0, 4));
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ---------------------------------------------------------
 * Main boot
 * --------------------------------------------------------- */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset stats
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;
  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const runMode = (cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: still ok to be random
    STATE.rng = Math.random;
  }

  // time: single source of truth from cfg.durationPlannedSec
  STATE.durationPlannedSec = clamp(cfg.durationPlannedSec ?? 90, 10, 999);
  STATE.timeLeft = STATE.durationPlannedSec;

  STATE.startedAtMs = nowMs();

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.durationPlannedSec
  });

  emitScore();
  emitQuest();
  startTimer();

  // spawner
  STATE.engine = makeSpawner(mount);

  // crosshair shoot support
  attachShootSupport(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}