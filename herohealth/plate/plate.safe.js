// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION | FAST+)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (gentle ramp)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0) || 1;
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
  timePlanned:0,
  timer:null,
  t0:0,

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
    sub:'รักษาความแม่น ≥ 80% ต่อเนื่อง',
    cur:0,
    target:80,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mini “hold” logic
  miniHoldSecNeed: 8,   // ต้องถือ >= target ต่อเนื่องกี่วิ ถึงจะนับผ่าน (เล่น)
  miniHoldSecNow:  0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner
  spawner:null,
  spawnerCfg:null
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
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += (Number(v) || 0);
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Adaptive helpers (play only)
 * ------------------------------------------------ */
function isResearch(){
  const m = (STATE.cfg?.runMode || '').toLowerCase();
  return (m === 'research' || m === 'study');
}

function progress01(){
  const planned = Math.max(1, Number(STATE.timePlanned) || 1);
  const left = clamp(STATE.timeLeft, 0, planned);
  return clamp(1 - (left / planned), 0, 1);
}

function computeSpawnRateMs(){
  // Base by diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const base =
    diff === 'easy' ? 980 :
    diff === 'hard' ? 760 :
    880;

  // Research: fixed
  if(isResearch()) return base;

  // Play: gentle ramp with time + combo
  const p = progress01(); // 0..1
  const comboBoost = clamp(STATE.combo / 25, 0, 1); // 0..1
  const ramp = (0.25 * p) + (0.18 * comboBoost);   // max ~0.43
  const ms = Math.round(base * (1 - ramp));        // faster over time
  return clamp(ms, 520, 1200);
}

function computeJunkWeight(){
  // Base weights
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const base =
    diff === 'easy' ? 0.24 :
    diff === 'hard' ? 0.34 :
    0.30;

  if(isResearch()) return base;

  // Play: little more junk later (pressure)
  const p = progress01();
  const extra = 0.10 * clamp((p - 0.45) / 0.55, 0, 1); // +0..0.10
  return clamp(base + extra, 0.18, 0.48);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  try{
    // if spawner supports stop/destroy, best effort
    if(STATE.spawner && typeof STATE.spawner.stop === 'function') STATE.spawner.stop();
    if(STATE.spawner && typeof STATE.spawner.destroy === 'function') STATE.spawner.destroy();
  }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: round2(accuracy() * 100),

    // group counters
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // extra analytics (nice-to-have)
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

    STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
    emit('hha:time', { leftSec: STATE.timeLeft });

    // play-only adaptive update (spawnrate + weights)
    if(!isResearch()){
      const nextRate = computeSpawnRateMs();
      const nextJunkW = computeJunkWeight();

      // best effort: if mode-factory supports live update
      if(STATE.spawner && typeof STATE.spawner.setSpawnRate === 'function'){
        try{ STATE.spawner.setSpawnRate(nextRate); }catch{}
      }
      if(STATE.spawner && typeof STATE.spawner.setKinds === 'function'){
        try{
          STATE.spawner.setKinds([
            { kind:'good', weight: 1 - nextJunkW },
            { kind:'junk', weight: nextJunkW }
          ]);
        }catch{}
      }
    }

    // mini “hold” tracker (play only)
    if(!STATE.mini.done && !isResearch()){
      const accPct = accuracy() * 100;
      if(accPct >= STATE.mini.target){
        STATE.miniHoldSecNow++;
      }else{
        STATE.miniHoldSecNow = Math.max(0, STATE.miniHoldSecNow - 2); // หลุดแล้วถอยเร็วหน่อย
      }

      // แสดงความคืบหน้า mini เป็น “วินาทีที่ถือได้” แต่ยังคง target เป็น 80% (อ่านง่าย)
      STATE.mini.cur = Math.round(accPct);

      if(STATE.miniHoldSecNow >= STATE.miniHoldSecNeed){
        STATE.mini.done = true;
        coach('โคตรนิ่ง! คุมความแม่นได้ต่อเนื่อง ✅', 'Coach');
        emitQuest();
      }
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
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();

  // เร่งนิด ๆ: ให้รางวัลคอมโบชัดขึ้นแต่ไม่เวอร์
  addScore(95 + STATE.combo * 7);

  // goal progress: นับ “หมู่ที่เคยได้อย่างน้อย 1”
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v => v > 0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini (accuracy) — research: ตัดสินแบบตรง ๆ ทันที
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && isResearch() && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำผ่านเกณฑ์ 👍', 'Coach');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();

  // ลงโทษนุ่ม ๆ แต่รู้สึกได้
  addScore(-55);

  // play: ลด “mini hold” ทันทีเล็กน้อย
  if(!isResearch()){
    STATE.miniHoldSecNow = Math.max(0, STATE.miniHoldSecNow - 3);
  }

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // ไม่หักคะแนนแรง (กันเด็กท้อ) แต่เสียมิสจริง
  addScore(-10);

  if(!isResearch()){
    STATE.miniHoldSecNow = Math.max(0, STATE.miniHoldSecNow - 1);
  }

  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const seed = Number(STATE.cfg?.seed) || Date.now();

  // initial weights
  const jw = computeJunkWeight();

  // initial rate
  const rate = computeSpawnRateMs();

  const sp = spawnBoot({
    mount,
    seed,

    // NOTE: mode-factory inโปรเจกต์คุณ “รองรับ seed” แล้ว
    // เราให้ค่าเริ่ม และพยายามอัปเดตตอนเล่นผ่าน setSpawnRate / setKinds ถ้ามี
    spawnRate: rate,
    sizeRange: [44, 64],

    kinds: [
      { kind:'good', weight: 1 - jw },
      { kind:'junk', weight: jw }
    ],

    // optional: if mode-factory supports tagging/attrs
    onHit: (t) => {
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        // groupIndex may come from spawner; else random 0..4
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng() * 5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire: (t) => {
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  // save for live updates
  STATE.spawner = sp;

  return sp;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
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

  STATE.miniHoldSecNow = 0;

  // RNG
  if(isResearch()){
    STATE.rng = seededRng(Number(cfg.seed) || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timePlanned = Number(cfg.durationPlannedSec) || 90;
  STATE.timeLeft = STATE.timePlanned;

  emit('hha:start', {
    game: 'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timePlanned
  });

  emitQuest();
  startTimer();

  makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}