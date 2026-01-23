// =========================================================
// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) (PATCH A4)
// HHA Standard
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (เล็กน้อย)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js (decorateTarget) to render emoji targets
// ---------------------------------------------------------
// หมู่ 1 โปรตีน: เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
// หมู่ 2 คาร์โบไฮเดรต: ข้าว แป้ง เผือก มัน น้ำตาล
// หมู่ 3 ผัก
// หมู่ 4 ผลไม้
// หมู่ 5 ไขมัน
// =========================================================

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

function pct2(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

// deterministic RNG
function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * Emoji sets (Kid-friendly)
 * ------------------------------------------------ */
const EMOJI_GOOD_BY_GROUP = {
  // 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
  0: ['🥩','🍗','🍖','🥚','🥛','🧀','🫘','🥜','🐟'],

  // 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
  1: ['🍚','🍞','🥖','🥨','🍜','🍝','🥔','🍠','🫓'],

  // 3 ผัก
  2: ['🥦','🥬','🥕','🌽','🍅','🥒','🫑','🧄','🧅'],

  // 4 ผลไม้
  3: ['🍎','🍌','🍊','🍇','🍉','🍍','🥭','🍓','🍐'],

  // 5 ไขมัน
  4: ['🥑','🫒','🧈','🥥','🌰','🥜'] // ถั่วมีไขมันด้วย แต่เราใช้เป็นภาพจำให้เด็กง่าย
};

// junk (หวาน/ทอด/น้ำอัดลม/ขนม)
const EMOJI_JUNK = ['🍟','🍔','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🧁','🍗']; // มีไก่ทอดซ้ำได้

function pickFrom(arr, rng){
  if(!arr || !arr.length) return '⭐';
  return arr[Math.floor(rng()*arr.length)];
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

  // plate groups counts (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% (โดนดี / ทั้งหมด)',
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

  // spawner controller
  spawner:null,

  // adaptive tuning (play only)
  adaptiveOn:false,
  spawnRateMs:900,
  ttlGood:2100,
  ttlJunk:1700
};

/* ------------------------------------------------
 * Quest + Coach
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score / Combo
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
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
  emitScore();
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
 * Adaptive (Play only) — “สนุกท้าทายเร้าใจ” แบบยุติธรรม
 * - ถ้าแม่น/คอมโบดี -> เร็วขึ้นนิด
 * - ถ้าพลาดเยอะ -> ผ่อนนิด (เพื่อไม่ให้ท้อ)
 * ------------------------------------------------ */
function updateAdaptiveEverySecond(){
  if(!STATE.adaptiveOn) return;

  const acc = accuracy();         // 0..1
  const miss = STATE.miss;
  const combo = STATE.comboMax;

  // base
  let sr = 900;     // spawnRate ms
  let goodT = 2100; // good ttl
  let junkT = 1700; // junk ttl

  // performance lift
  if(acc >= 0.85 && combo >= 8){
    sr -= 120;
    goodT -= 120;
    junkT -= 100;
  }else if(acc >= 0.80 && combo >= 5){
    sr -= 70;
    goodT -= 70;
    junkT -= 60;
  }

  // anti-frustration
  if(miss >= 6 && acc < 0.75){
    sr += 90;
    goodT += 90;
  }else if(miss >= 10){
    sr += 120;
    goodT += 120;
  }

  // clamp
  sr = clamp(sr, 640, 1100);
  goodT = clamp(goodT, 1500, 2600);
  junkT = clamp(junkT, 1200, 2200);

  STATE.spawnRateMs = sr;
  STATE.ttlGood = goodT;
  STATE.ttlJunk = junkT;

  // NOTE: mode-factory reads ttl per target at spawn time,
  // so updating here affects *future* spawns.
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct2(accuracy() * 100),

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
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // adaptive step
    updateAdaptiveEverySecond();

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

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

  // คะแนนแบบ “สนุก”:
  // - base 100
  // - combo bonus +5*combo (พอเร้าใจ แต่ไม่พุ่งเว่อร์)
  addScore(100 + STATE.combo * 5);

  // goal progress: หมู่ที่เคยเก็บอย่างน้อย 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
    }
  }

  // mini accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Mini');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Target decoration (emoji + label)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind good/junk, target.groupIndex 0..4, target.rng available
  const rng = target?.rng || STATE.rng;

  let emoji = '⭐';
  if(target.kind === 'junk'){
    emoji = pickFrom(EMOJI_JUNK, rng);
  }else{
    const gi = clamp(target.groupIndex ?? 0, 0, 4);
    emoji = pickFrom(EMOJI_GOOD_BY_GROUP[gi], rng);
  }

  el.textContent = emoji;

  // optional: help a-frame crosshair feel
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', target.kind === 'junk' ? 'อาหารหวาน/ทอด' : `อาหารหมู่ ${Number(target.groupIndex)+1}`);

  // quick visual hint: tiny dot / ring using dataset (css can use)
  el.dataset.gi = String(target.groupIndex ?? 0);

  // allow bigger “plate-like” style if you want later
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // base by diff
  let spawnRate = 900;
  let sizeRange = [44, 64];
  let goodW = 0.72, junkW = 0.28;

  if(diff === 'easy'){
    spawnRate = 980;
    sizeRange = [48, 70];
    goodW = 0.78; junkW = 0.22;
  }else if(diff === 'hard'){
    spawnRate = 760;
    sizeRange = [42, 62];
    goodW = 0.66; junkW = 0.34;
  }

  // adaptive overrides starting point
  STATE.spawnRateMs = spawnRate;
  STATE.ttlGood = 2100;
  STATE.ttlJunk = 1700;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // NOTE: we pass a function-ish by updating STATE.spawnRateMs;
    // mode-factory uses constant spawnRate, so we re-create spawner if needed.
    // To keep simple/stable: use STATE.spawnRateMs only at creation (and light adaptive via ttl feel)
    spawnRate: STATE.spawnRateMs,

    sizeRange,

    kinds:[
      { kind:'good', weight:goodW },
      { kind:'junk', weight:junkW }
    ],

    decorateTarget, // ✅ PATCH

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
        onHitGood(gi);
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

  // reset
  STATE.cfg = cfg;
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

  // RNG: research/study deterministic
  const runMode = (cfg.runMode || 'play').toLowerCase();
  const isStudy = (runMode === 'research' || runMode === 'study');

  STATE.rng = isStudy ? seededRng(cfg.seed || Date.now()) : Math.random;

  // adaptive: ON only for play
  STATE.adaptiveOn = !isStudy;

  // time: Plate default 90 (มาจาก boot.js แล้ว)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();

  startTimer();

  // start spawner
  stopSpawner();
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Start');
}