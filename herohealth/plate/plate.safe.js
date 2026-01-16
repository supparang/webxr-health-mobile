// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (storm เร่งนิด ๆ 15 วิท้าย)
//   - research/study: deterministic seed + adaptive OFF (no storm speed-up)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * ModeFactory bridge (supports non-module global build)
 * ------------------------------------------------ */
function getModeFactoryBoot(){
  const GM = WIN.GAME_MODULES || {};
  const MF =
    GM.ModeFactory ||
    GM.modeFactory ||
    GM.SpawnFactory ||
    GM.TargetFactory ||
    WIN.ModeFactory ||
    WIN.modeFactory ||
    null;

  const bootFn =
    (MF && (MF.boot || MF.spawnBoot || MF.create || MF.start)) ||
    null;

  if(typeof bootFn !== 'function'){
    throw new Error(
      'PlateVR: mode-factory boot not found. ' +
      'Make sure ../vr/mode-factory.js is loaded BEFORE plate.boot.js'
    );
  }
  return bootFn;
}

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct0 = (n)=> Math.round(Number(n)||0);

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
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
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

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
    sub:'คุมความแม่น ≥ 80% จนจบ',
    cur:0,           // current accuracy %
    target:80,
    done:false,
    locked:false     // ✅ ตัดสินตอนท้ายเท่านั้น
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // derived
  accPct:100,

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner instance (mode-factory)
  spawner:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
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

/* ------------------------------------------------
 * Coach helper (rate-limit เบา ๆ กันรัว)
 * ------------------------------------------------ */
let COACH_AT = 0;
function coach(msg, tag='Coach', minGapMs=900){
  const now = Date.now();
  if(now - COACH_AT < minGapMs) return;
  COACH_AT = now;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    misses: STATE.miss
  });
}

function addScore(v){
  STATE.score += Number(v)||0;
  emitScore();
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy (นับ hitGood vs (hitGood+hitJunk+expireGood))
 * ------------------------------------------------ */
function accuracyPct(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 100;
  return (STATE.hitGood / total) * 100;
}

function updateAccuracy(){
  STATE.accPct = accuracyPct();
  STATE.mini.cur = clamp(Math.round(STATE.accPct), 0, 100);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // ✅ Finalize Mini at end only
  if(!STATE.mini.locked){
    STATE.mini.locked = true;
    if(STATE.accPct >= STATE.mini.target){
      STATE.mini.done = true;
      // (ไม่ coach ตอนจบเยอะ เดี๋ยวไปโชว์ summary)
    }else{
      STATE.mini.done = false;
    }
  }

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct0(STATE.accPct),

    // group counts
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer + storm trigger
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // storm hint (optional hook)
    const run = (STATE.cfg?.runMode || 'play').toLowerCase();
    if(run === 'play' && STATE.timeLeft === 15){
      emit('hha:judge', { kind:'storm', on:true, text:'STORM: เร่งนิด ๆ!' });
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = จำนวนหมู่ที่มีอย่างน้อย 1 ชิ้น
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', 0);
    }
  }

  // accuracy live update (แต่ mini ตัดสินตอนจบ)
  updateAccuracy();

  // hint เบา ๆ ช่วงท้าย ถ้าความแม่นกำลังตก
  if(!STATE.mini.locked){
    if(STATE.timeLeft <= 15 && STATE.accPct < STATE.mini.target){
      coach('ท้ายเกมแล้ว! ระวังของหวาน/ทอดนะ 😄', 'Coach', 1100);
    }
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  updateAccuracy();
  if(STATE.timeLeft > 10) coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 1000);

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateAccuracy();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  const baseRate = (diff === 'hard') ? 700 : 900;

  // ✅ เร่งนิด ๆ เฉพาะ play และเฉพาะ 15 วิท้าย
  const storm = (run === 'play') && (Number(STATE.timeLeft)||0) <= 15;
  const rate = storm
    ? Math.max(580, Math.round(baseRate * 0.85))
    : baseRate;

  const spawnBoot = getModeFactoryBoot();

  // NOTE: config shape must match your mode-factory.js
  // We use the same fields you used earlier: mount/seed/spawnRate/sizeRange/kinds/onHit/onExpire
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
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

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset
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
  STATE.mini.locked = false;

  COACH_AT = 0;

  // RNG
  const run = (STATE.cfg.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(Number(STATE.cfg.seed) || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // initial accuracy
  updateAccuracy();

  emit('hha:start', {
    game:'plate',
    projectTag:'herohealth',
    runMode: run,
    diff: (STATE.cfg.diff || 'normal'),
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // start spawner
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);
}