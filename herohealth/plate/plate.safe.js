// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) (PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (placeholder hook)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (boot) + decorateTarget (emoji/icons)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom(rngFn, arr){
  if(!arr || !arr.length) return '';
  const r = (typeof rngFn === 'function') ? rngFn() : Math.random();
  const i = Math.floor(r * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

/* ------------------------------------------------
 * Emoji packs (Thai 5 food groups) — many per group
 * mapping locked by user:
 * 1 โปรตีน, 2 คาร์บ, 3 ผัก, 4 ผลไม้, 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI_GROUPS = [
  // g1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
  ['🍗','🥚','🥛','🫘','🐟','🍖','🧀'],
  // g2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
  ['🍚','🍞','🍜','🥔','🍠','🥖','🥨'],
  // g3 ผัก
  ['🥦','🥬','🥕','🥒','🌽','🍅','🫑'],
  // g4 ผลไม้
  ['🍎','🍌','🍊','🍉','🍇','🍍','🥭'],
  // g5 ไขมัน
  ['🥑','🥜','🫒','🧈','🥥','🧀','🌰'],
];

// junk (หวาน/ทอด/น้ำอัดลม/ขนม)
const EMOJI_JUNK = ['🍟','🍩','🍰','🍫','🥤','🍪','🧋'];

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

  // spawn engine instance
  engine:null,

  // simple difficulty hook state
  spawnRateMs: 900
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
  STATE.score += Number(v)||0;
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
  // good hit is correct. junk hit + good expire are mistakes (miss)
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

  try{ clearInterval(STATE.timer); }catch{}
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
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Mini AI hook (Prediction-friendly placeholder)
 * - ไม่ใช่ ML จริง แต่เป็น “feature hook” ที่เกมอื่นใช้ได้
 * ------------------------------------------------ */
function emitPredict(){
  const acc = accuracy(); // 0..1
  // risk สูงเมื่อ accuracy ต่ำ + miss เยอะ + combo พังบ่อย
  const risk = clamp((1-acc) * 0.65 + clamp(STATE.miss/10,0,1)*0.25 + clamp((STATE.combo===0?1:0)*0.10,0,1), 0, 1);
  emit('hha:predict', { risk, accPct: Math.round(acc*100), miss: STATE.miss, combo: STATE.combo });
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  const gi = clamp(groupIndex, 0, 4);

  STATE.hitGood++;
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: count how many groups have at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini quest: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
  emitPredict();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
  emitPredict();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  emitPredict();
}

/* ------------------------------------------------
 * Target decorator (emoji/icons)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // clear existing
  try{ el.innerHTML = ''; }catch{}

  const kind = t.kind || 'good';

  let emoji = '🍽️';
  if(kind === 'junk'){
    emoji = pickFrom(t.rng, EMOJI_JUNK);
  }else{
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    emoji = pickFrom(t.rng, EMOJI_GROUPS[gi]);
    el.dataset.group = String(gi+1); // optional (1..5)
  }

  // build centered emoji
  const e = document.createElement('div');
  e.className = 'emoji';
  e.textContent = emoji;

  el.appendChild(e);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  // (optional) simple adaptive hook for play mode: adjust spawn rate by performance
  const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  const base = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860);

  if(isStudy){
    STATE.spawnRateMs = base; // deterministic baseline
  }else{
    // play: tiny adapt (safe)
    const acc = accuracy();
    // if accuracy high -> faster, else slower
    STATE.spawnRateMs = clamp(Math.round(base - (acc*140) + (STATE.miss*10)), 620, 1100);
  }

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange:[52, 76],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget, // ✅ KEY PATCH
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? Math.floor(STATE.rng()*5));
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

  // build spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
  emitPredict();
}