// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (อนาคตค่อยเสียบ)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses ../vr/mode-factory.js (export boot)  <-- IMPORTANT
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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
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

  // ✅ Miss = good expired + junk hit (แนวเดียวกับ HHA มาตรฐาน)
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

  // spawner engine
  engine:null
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
    allDone: !!(STATE.goal.done && STATE.mini.done)
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
  STATE.score += Number(v) || 0;
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
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  // stop spawner
  try{ STATE.engine?.destroy?.(); }catch(_){}

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
 * Progress checks
 * ------------------------------------------------ */
function checkGoalMiniAndMaybeFinish(){
  // goal: filled all 5 groups (at least 1 each)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy >= target
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // ✅ optional: finish early when both done
  if(STATE.goal.done && STATE.mini.done && !STATE.ended){
    // bonus for finishing early
    const bonus = Math.max(0, Math.round(STATE.timeLeft * 8));
    if(bonus > 0){
      addScore(bonus);
      coach(`ผ่านไว! โบนัสเวลา +${bonus} ✨`, 'Bonus');
    }
    endGame('allDone');
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  checkGoalMiniAndMaybeFinish();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;        // ✅ junk hit counts miss
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  checkGoalMiniAndMaybeFinish();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;        // ✅ good expired counts miss
  resetCombo();
  checkGoalMiniAndMaybeFinish();
}

/* ------------------------------------------------
 * Spawn logic (5 groups + junk)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // ปรับ “ความเร่ง” ตาม diff
  const spawnRate =
    diff === 'easy' ? 980 :
    diff === 'hard' ? 720 :
    860;

  const ttlMs =
    diff === 'easy' ? 1500 :
    diff === 'hard' ? 1100 :
    1300;

  // emoji set (Plate)
  const EMOJI = {
    g1:'🍚', // ข้าว-แป้ง
    g2:'🥩', // เนื้อ/ปลา/ไข่/ถั่ว
    g3:'🥦', // ผัก
    g4:'🍌', // ผลไม้
    g5:'🥛', // นม
    junk:'🍩'
  };

  // kinds: แยก good เป็น 5 หมู่จริง (ไม่ใช่ good อันเดียว)
  const kinds = [
    { kind:'g1', weight:0.14, groupIndex:0, emoji:EMOJI.g1 },
    { kind:'g2', weight:0.14, groupIndex:1, emoji:EMOJI.g2 },
    { kind:'g3', weight:0.14, groupIndex:2, emoji:EMOJI.g3 },
    { kind:'g4', weight:0.14, groupIndex:3, emoji:EMOJI.g4 },
    { kind:'g5', weight:0.14, groupIndex:4, emoji:EMOJI.g5 },

    // junk รวมแล้ว ~0.30
    { kind:'junk', weight:0.30, emoji:EMOJI.junk }
  ];

  const kindToEmoji = {
    g1: EMOJI.g1, g2: EMOJI.g2, g3: EMOJI.g3, g4: EMOJI.g4, g5: EMOJI.g5,
    junk: EMOJI.junk
  };

  return spawnBoot({
    mount,
    seed: STATE.cfg?.seed,

    spawnRate,
    ttlMs,
    sizeRange:[46, 72],

    kinds,
    kindToEmoji,

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'junk'){
        onHitJunk();
        return;
      }

      // g1..g5
      const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
      onHitGood(gi);
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind !== 'junk') onExpireGood(); // good groups expire => miss
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

  // RNG
  const runMode = (cfg?.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(cfg?.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: (cfg?.diff || 'normal'),
    seed: cfg?.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // first UI push
  emitQuest();
  emitScore();

  // start timer + spawn
  startTimer();
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}