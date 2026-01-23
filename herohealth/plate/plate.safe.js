// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION, PATCHED)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses: mode-factory.js (spawn engine) + decorateTarget for emoji/icon
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

const pctRound2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------
 * Thai 5 food groups mapping (fixed)
 * ------------------------------------------------
 * 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * 2 คาร์บ (ข้าว แป้ง เผือก มัน น้ำตาล)
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
 * ------------------------------------------------ */
const GROUP = {
  PROTEIN: 0,
  CARB:    1,
  VEG:     2,
  FRUIT:   3,
  FAT:     4
};

const GROUP_EMOJI = [
  // 1 โปรตีน
  ['🥚','🥛','🫘','🍗','🐟','🧀'],
  // 2 คาร์บ
  ['🍚','🍞','🥔','🍠','🍜','🥖'],
  // 3 ผัก
  ['🥦','🥬','🥕','🍆','🌽','🫑'],
  // 4 ผลไม้
  ['🍌','🍎','🍉','🍍','🍇','🍊'],
  // 5 ไขมัน
  ['🥑','🫒','🥜','🧈','🍳','🥥'],
];

const JUNK_EMOJI = ['🍟','🍩','🍰','🍪','🧋','🥤','🍭','🍫'];

function pickFrom(list, r){
  if(!list || !list.length) return '⭐';
  const i = Math.floor((r||Math.random)() * list.length);
  return list[Math.max(0, Math.min(list.length-1, i))];
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

  // spawn engine handle
  engine:null,

  // simple adaptive knobs (play only)
  _spawnRateMs: 900,
  _goodWeight: 0.70,
  _junkWeight: 0.30
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
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
  STATE.score += (Number(v)||0);
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
 * Accuracy (good / total interactions)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Play-mode adaptive tuning (light & fair)
 * - only in play mode
 * - keeps deterministic research untouched
 * ------------------------------------------------ */
function tuneAdaptive(){
  if(!STATE.cfg) return;
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study') return;

  // if player struggling (low acc), reduce junk + slightly slower spawn
  const acc = accuracy();
  if(acc < 0.65){
    STATE._junkWeight = 0.22;
    STATE._goodWeight = 0.78;
    STATE._spawnRateMs = 980;
  }else if(acc > 0.85 && STATE.comboMax >= 8){
    // doing well: slightly more challenge
    STATE._junkWeight = 0.34;
    STATE._goodWeight = 0.66;
    STATE._spawnRateMs = 820;
  }else{
    // baseline by diff
    if(STATE.cfg.diff === 'easy'){
      STATE._junkWeight = 0.24; STATE._goodWeight = 0.76; STATE._spawnRateMs = 980;
    }else if(STATE.cfg.diff === 'hard'){
      STATE._junkWeight = 0.36; STATE._goodWeight = 0.64; STATE._spawnRateMs = 780;
    }else{
      STATE._junkWeight = 0.30; STATE._goodWeight = 0.70; STATE._spawnRateMs = 900;
    }
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = null;
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

    accuracyGoodPct: pctRound2(accuracy() * 100),

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
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // light adaptive tune every second in play
    tuneAdaptive();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  if(STATE.ended) return;

  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: how many groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // optional: if both done, end early (kid-friendly)
  if(STATE.goal.done && STATE.mini.done && STATE.timeLeft > 2){
    endGame('all_done');
  }
}

function onHitJunk(){
  if(STATE.ended) return;

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  if(STATE.ended) return;

  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji/icon)
 * - called by mode-factory.js decorateTarget(el, target)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: 'good' | 'junk'
  // target.groupIndex: 0..4 (deterministic)
  const rng = target?.rng || STATE.rng || Math.random;

  if(target.kind === 'junk'){
    el.textContent = pickFrom(JUNK_EMOJI, rng);
    el.title = 'ของหวาน/ทอด';
    return;
  }

  const gi = clamp(target.groupIndex ?? Math.floor(rng()*5), 0, 4);
  el.textContent = pickFrom(GROUP_EMOJI[gi], rng);

  // label for debug/tooltip (optional)
  const label = ['หมู่ 1 โปรตีน','หมู่ 2 คาร์บ','หมู่ 3 ผัก','หมู่ 4 ผลไม้','หมู่ 5 ไขมัน'][gi];
  el.title = label;
  el.dataset.group = String(gi+1);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  // diff baseline (will be nudged by adaptive in play)
  let baseRate = 900;
  if(STATE.cfg.diff === 'easy') baseRate = 980;
  if(STATE.cfg.diff === 'hard') baseRate = 780;

  STATE._spawnRateMs = baseRate;
  STATE._goodWeight  = (STATE.cfg.diff === 'hard') ? 0.64 : (STATE.cfg.diff === 'easy' ? 0.76 : 0.70);
  STATE._junkWeight  = 1 - STATE._goodWeight;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE._spawnRateMs,
    sizeRange: [52, 74], // a bit bigger for kids
    kinds: [
      { kind:'good', weight: STATE._goodWeight },
      { kind:'junk', weight: STATE._junkWeight }
    ],
    decorateTarget, // ✅ PATCH: emoji/icon mapping
    onHit:(t)=>{
      if(STATE.ended) return;

      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? Math.floor((STATE.rng||Math.random)()*5));
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // hard stop previous
  try{ stopSpawner(); }catch{}
  clearInterval(STATE.timer);

  STATE.cfg = cfg;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now()); // deterministic
  }else{
    STATE.rng = Math.random;
  }

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

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // ✅ spawn
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}