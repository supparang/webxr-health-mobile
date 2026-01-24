// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PATCHED
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js (spawn layer) + decorateTarget for emoji by Thai 5 food groups
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
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(arr, rng){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

/* ------------------------------------------------
 * Emoji pack (Thai 5 food groups fixed mapping)
 * หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI = {
  // 1) Protein
  g1: ['🥚','🥛','🧀','🍗','🍖','🐟','🫘','🥜','🍤','🦐'],
  // 2) Carbs
  g2: ['🍚','🍞','🥖','🥐','🍜','🍝','🥔','🍠','🥟','🍙'],
  // 3) Veg
  g3: ['🥦','🥬','🥕','🌽','🍅','🥒','🫑','🍆','🧄','🧅'],
  // 4) Fruit
  g4: ['🍎','🍌','🍇','🍊','🍉','🍍','🥭','🍓','🍒','🥝'],
  // 5) Fat
  g5: ['🥑','🫒','🥥','🧈','🫗','🌰'],
  // Junk
  junk: ['🍩','🍟','🍔','🍕','🧁','🍰','🍫','🍬','🥤','🧋']
};

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

  // spawn engine handle
  engine:null,

  // play adaptive
  adaptiveOn:false,
  ddTimer:null,
  spawnRateMs:900,
  junkWeight:0.30
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
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.ddTimer);
  STATE.timer = null;
  STATE.ddTimer = null;

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

    accuracyGoodPct: Math.round(accuracy() * 100),

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
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Target decoration (emoji by group)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const key = GROUP_KEYS[gi] || 'g1';
    const emoji = pickFrom(EMOJI[key], rng) || '🍽️';
    el.dataset.group = key;
    el.textContent = emoji;
    el.setAttribute('aria-label', `อาหารหมู่ ${gi+1}`);
    // สี/ฟีลเพิ่มนิด (ไม่พึ่ง CSS เพิ่มก็ยังได้)
    el.style.fontSize = `${Math.max(20, Math.round((t.size||54)*0.52))}px`;
  }else{
    const emoji = pickFrom(EMOJI.junk, rng) || '🍭';
    el.dataset.group = 'junk';
    el.textContent = emoji;
    el.setAttribute('aria-label', 'ของหวาน/ของทอด');
    el.style.fontSize = `${Math.max(20, Math.round((t.size||54)*0.52))}px`;
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // optional: win early if both done
  if(STATE.goal.done && STATE.mini.done){
    // ให้เด็ก “ผ่านทันที” แบบ satisfying
    coach('ผ่านแล้ว! เก่งมาก 🏁', 'System');
    endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Spawn (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const junkW = clamp(STATE.junkWeight, 0.10, 0.70);
  const goodW = 1 - junkW;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:goodW },
      { kind:'junk', weight:junkW }
    ],
    decorateTarget, // ✅ PATCH: emoji
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
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
 * Light adaptive difficulty (play mode only)
 * - ปรับ spawnRate/junkWeight ทุก 5 วิ
 * - ทำให้ "ท้าทายขึ้น" แบบค่อย ๆ ไม่โหด
 * ------------------------------------------------ */
function startAdaptive(mount){
  if(!STATE.adaptiveOn) return;

  let lastAppliedRate = STATE.spawnRateMs;
  let lastAppliedJunk = STATE.junkWeight;

  STATE.ddTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    const acc = accuracy(); // 0..1
    const c = STATE.comboMax;

    // target: ถ้าแม่น/คอมโบดี -> เพิ่มความเร็ว + เพิ่ม junk นิด
    // ถ้าพลาดเยอะ -> ผ่อน
    let rate = 900;
    let junk = 0.30;

    if(acc >= 0.88 || c >= 12){ rate = 760; junk = 0.36; }
    if(acc >= 0.92 || c >= 18){ rate = 700; junk = 0.40; }

    if(STATE.miss >= 6 && acc < 0.78){ rate = 980; junk = 0.26; }
    if(STATE.miss >= 10 && acc < 0.72){ rate = 1050; junk = 0.22; }

    rate = clamp(rate, 650, 1200);
    junk = clamp(junk, 0.18, 0.48);

    const needRebuild =
      Math.abs(rate - lastAppliedRate) >= 60 ||
      Math.abs(junk - lastAppliedJunk) >= 0.06;

    if(needRebuild){
      STATE.spawnRateMs = rate;
      STATE.junkWeight = junk;

      // rebuild spawner for new params
      stopSpawner();
      STATE.engine = makeSpawner(mount);

      lastAppliedRate = rate;
      lastAppliedJunk = junk;

      // micro tip (rate-limit ด้วย)
      if(!WIN.__PLATE_DD_TIP_TS__ || (Date.now() - WIN.__PLATE_DD_TIP_TS__) > 8000){
        WIN.__PLATE_DD_TIP_TS__ = Date.now();
        coach(`ระดับท้าทายปรับแล้ว! (${Math.round(1000/rate)}x)`, 'AI');
      }
    }

  }, 5000);
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

  // RNG
  const isResearch = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive (play only)
  STATE.adaptiveOn = !isResearch;

  // base spawn params by diff
  const diff = (cfg.diff || 'normal').toLowerCase();
  STATE.spawnRateMs = (diff === 'hard') ? 760 : (diff === 'easy' ? 980 : 900);
  STATE.junkWeight  = (diff === 'hard') ? 0.38 : (diff === 'easy' ? 0.24 : 0.30);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // spawn
  stopSpawner();
  STATE.engine = makeSpawner(mount);

  // adaptive
  clearInterval(STATE.ddTimer);
  STATE.ddTimer = null;
  startAdaptive(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}