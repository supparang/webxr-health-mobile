// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard (Kids-friendly + Research-ready)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawn rate + junk ratio + size tweak)
//   - research/study: deterministic seed + adaptive OFF (fair + reproducible)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) — supported by mode-factory
// ✅ Default time: 90s (if not passed by boot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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
  g:[0,0,0,0,0], // index 0..4

  // quest (GOAL + MINI)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
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

  // mode / cfg
  cfg:null,
  rng:Math.random,
  isResearch:false,

  // spawner engine handle
  engine:null,

  // adaptive knobs (play only)
  adaptiveLevel: 0,       // 0..3
  lastCoachAt: 0,
};

/* ------------------------------------------------
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', cooldownMs=1600){
  const now = Date.now();
  if(now - (STATE.lastCoachAt||0) < cooldownMs) return;
  STATE.lastCoachAt = now;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub:  STATE.goal.sub,
      cur:  STATE.goal.cur,
      target: STATE.goal.target
    },
    mini:{
      name: STATE.mini.name,
      sub:  STATE.mini.sub,
      cur:  STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
}

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy
 * - Count expireGood as "missed good" (research consistent)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Adaptive (PLAY only)
 * - We "เร่งนิด ๆ" ให้สนุกขึ้น แต่ไม่โหด
 * - Based on performance: combo + accuracy + miss trend
 * ------------------------------------------------ */
function updateAdaptive(){
  if(STATE.isResearch) return;

  const acc = accuracyPct();
  const c = STATE.comboMax;
  const m = STATE.miss;

  // target: kids-friendly, fair
  let lvl = 0;
  if(acc >= 85 && c >= 10 && m <= 3) lvl = 2;
  else if(acc >= 80 && c >= 6 && m <= 5) lvl = 1;
  if(acc >= 90 && c >= 14 && m <= 2) lvl = 3;

  STATE.adaptiveLevel = clamp(lvl, 0, 3);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accuracyPct(),

    // 5 หมู่
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // counts (useful for research logging)
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // gentle pacing cues
    if(!STATE.isResearch){
      if(STATE.timeLeft === 60) coach('เหลือ 60 วิ! เก็บให้ครบทุกหมู่ 🍚🥦', 'Coach', 0);
      if(STATE.timeLeft === 30) coach('เหลือ 30 วิ! ใกล้สำเร็จแล้ว 💪', 'Coach', 0);
      if(STATE.timeLeft === 10) coach('อีกนิดเดียว! 10 วิสุดท้าย ⏳', 'Coach', 0);
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Quest progress
 * ------------------------------------------------ */
function updateGoalProgress(){
  // goal: count distinct groups collected at least once
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v > 0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยมมาก! เติมครบ 5 หมู่แล้ว 🎉');
    }
  }

  // mini: accuracy target
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();

  // kids-friendly scoring: base + small combo bonus
  addScore(100 + (STATE.combo * 6));

  // small positive feedback occasionally
  if(!STATE.isResearch && (STATE.combo === 5 || STATE.combo === 10 || STATE.combo === 15)){
    coach(`คอมโบ x${STATE.combo} สุดยอด! ✨`, 'Coach', 0);
  }

  updateAdaptive();
  updateGoalProgress();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // penalty not too harsh
  addScore(-40);

  if(!STATE.isResearch){
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  }

  updateAdaptive();
  updateGoalProgress();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateAdaptive();
  updateGoalProgress();
}

/* ------------------------------------------------
 * Spawn config builder (PLAY adaptive vs RESEARCH fixed)
 * ------------------------------------------------ */
function buildSpawnCfg(){
  const cfg = STATE.cfg || {};
  const diff = String(cfg.diff || 'normal').toLowerCase();

  // base pacing (เร่งนิด ๆ)
  let spawnRateMs =
    (diff === 'hard') ? 680 :
    (diff === 'easy') ? 900 :
    800;

  // size: make it readable for kids
  let sizeMin = (diff === 'hard') ? 44 : 50;
  let sizeMax = (diff === 'hard') ? 66 : 74;

  // junk ratio
  let goodW = 0.72, junkW = 0.28;

  // Adaptive (play only)
  if(!STATE.isResearch){
    // lvl 0..3
    const lvl = STATE.adaptiveLevel|0;

    // Slightly faster + slightly more junk when doing well
    if(lvl >= 1){
      spawnRateMs = Math.max(620, spawnRateMs - 60);
      junkW = Math.min(0.34, junkW + 0.02);
      goodW = 1 - junkW;
    }
    if(lvl >= 2){
      spawnRateMs = Math.max(580, spawnRateMs - 70);
      junkW = Math.min(0.38, junkW + 0.03);
      goodW = 1 - junkW;
      sizeMin = Math.max(42, sizeMin - 2);
      sizeMax = Math.max(60, sizeMax - 4);
    }
    if(lvl >= 3){
      spawnRateMs = Math.max(540, spawnRateMs - 60);
      junkW = Math.min(0.40, junkW + 0.02);
      goodW = 1 - junkW;
    }
  }

  // IMPORTANT: research fixed knobs (no adaptive)
  if(STATE.isResearch){
    // keep stable by diff only
    // (already set above)
  }

  return {
    seed: Number(cfg.seed || Date.now()),
    spawnRate: spawnRateMs,
    sizeRange: [sizeMin, sizeMax],
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
  };
}

/* ------------------------------------------------
 * Make spawner (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const scfg = buildSpawnCfg();

  return spawnBoot({
    mount,

    // pass-through that mode-factory expects
    seed: scfg.seed,
    spawnRate: scfg.spawnRate,
    sizeRange: scfg.sizeRange,
    kinds: scfg.kinds,

    // optional strategies (safe defaults)
    spawnStrategy: 'grid9',            // helps distribute nicely for kids
    spawnAroundCrosshair: false,       // full spread in playRect
    safezoneAutoRelax: true,           // if playRect small, don't clump

    onHit:(t)=>{
      // mode-factory may pass: {kind, groupIndex, ...}
      if(t && t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng() * 5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(t && t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Public boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

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
  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // mode
  const runMode = String(STATE.cfg.runMode || 'play').toLowerCase();
  STATE.isResearch = (runMode === 'research' || runMode === 'study');

  // RNG (deterministic only in research)
  if(STATE.isResearch){
    STATE.rng = seededRng(Number(STATE.cfg.seed || Date.now()));
  }else{
    STATE.rng = Math.random;
  }

  // time: default 90s
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec || 90);
  STATE.timeLeft = clamp(STATE.timeLeft, 20, 999);

  // init adaptive (play only)
  STATE.adaptiveLevel = 0;
  updateAdaptive();

  emit('hha:start', {
    game: 'plate',
    runMode,
    diff: String(STATE.cfg.diff || 'normal').toLowerCase(),
    seed: Number(STATE.cfg.seed || 0),
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();

  // start
  startTimer();

  // mount spawner
  STATE.engine = makeSpawner(mount);

  // intro coaching
  if(STATE.isResearch){
    emit('hha:coach', { msg:'เริ่มโหมดวิจัย (seed คงที่) 🎯', tag:'System' });
  }else{
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);
    coach('ทริค: เก็บหมู่ที่ยังไม่มีให้ครบก่อนนะ 😉', 'Coach', 1800);
  }
}