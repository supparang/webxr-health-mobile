// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish (bias missing groups) ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js (decorateTarget for emoji/icon)
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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(rng, arr){
  if(!arr || !arr.length) return '❓';
  const i = Math.floor(rng() * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

/* ------------------------------------------------
 * Emoji sets (ไทย 5 หมู่)
 * ------------------------------------------------ */
const EMOJI_GROUPS = [
  // หมู่ 1 โปรตีน
  ['🍗','🥚','🥛','🫘','🐟'],
  // หมู่ 2 คาร์บ/พลังงาน
  ['🍚','🍞','🥔','🍠','🍜'],
  // หมู่ 3 ผัก
  ['🥦','🥬','🥕','🥒','🌽'],
  // หมู่ 4 ผลไม้
  ['🍎','🍌','🍊','🍉','🍇'],
  // หมู่ 5 ไขมัน
  ['🥜','🥑','🧈','🫒','🥥'],
];

const EMOJI_JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🧁','🍰'];

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

  // plate groups (5 หมู่) index 0-4 => หมู่ 1-5
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

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn
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
  STATE.score += v;
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
  try{ STATE.engine?.stop?.(); }catch{}

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
    if(STATE.timeLeft <= 0) endGame('timeup');
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

  // goal progress (unique groups collected)
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
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Smart choose group (Play only)
 * - ให้เกม “ไม่ง้อดวง” และจบภารกิจได้จริงในเวลา
 * ------------------------------------------------ */
function chooseGroupIndexForGood(t){
  const play = (STATE.cfg?.runMode === 'play');
  if(!play) return t.groupIndex; // research/study: ไม่ปรับ

  // ถ้ายังไม่ครบ 5 หมู่ ให้ bias ไปหมู่ที่ขาด (65%)
  if(!STATE.goal.done){
    const missing = [];
    for(let i=0;i<5;i++) if((STATE.g[i]||0) <= 0) missing.push(i);
    if(missing.length){
      const p = STATE.rng();
      if(p < 0.65){
        const pick = missing[Math.floor(STATE.rng() * missing.length)];
        return pick;
      }
    }
  }
  return t.groupIndex;
}

/* ------------------------------------------------
 * Target decorator (emoji/icon)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // set group (may be overwritten for play bias)
  if(t.kind === 'good'){
    t.groupIndex = chooseGroupIndexForGood(t);
    el.dataset.group = String(t.groupIndex + 1); // 1..5
  }else{
    el.dataset.group = 'junk';
  }

  // emoji pick (deterministic via t.rng)
  const r = (typeof t.rng === 'function') ? t.rng : STATE.rng;
  let emoji = '🍽️';
  if(t.kind === 'junk'){
    emoji = pickFrom(r, EMOJI_JUNK);
  }else{
    emoji = pickFrom(r, EMOJI_GROUPS[t.groupIndex] || []);
  }

  // build inner
  el.innerHTML = `<span class="tEmoji" aria-hidden="true">${emoji}</span>`;
  el.setAttribute('role','button');
  el.setAttribute('aria-label', t.kind === 'junk' ? `ของหวาน/ทอด ${emoji}` : `หมู่ ${t.groupIndex+1} ${emoji}`);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal');

  // แนวทางให้ “90 วิ” เล่นแล้วจบจริง:
  // easy: ช้าลง / junk น้อยลง
  // hard: เร็วขึ้น / junk มากขึ้น
  const spawnRate =
    diff === 'easy' ? 980 :
    diff === 'hard' ? 720 :
    860;

  const goodW =
    diff === 'hard' ? 0.62 :
    diff === 'easy' ? 0.78 :
    0.70;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,66],
    kinds:[
      { kind:'good', weight:goodW },
      { kind:'junk', weight:1-goodW }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
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
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // ✅ เวลา: default 90 (เหมาะกับ ป.5 ให้ “ทำครบภารกิจได้จริง”)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}