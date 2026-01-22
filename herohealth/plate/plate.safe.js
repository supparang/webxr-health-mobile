// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF (deterministic RNG)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports hooks: Boss/Storm (optional; safe no-op)
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

const roundPct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------
 * Emoji sets (shared feel with other games)
 * ------------------------------------------------ */
const EMOJI = {
  // 5 หมู่ (ไทย) — ทำให้เด็ก ป.5 จำง่าย + สีสัน
  g1: ['🍚','🍞','🍜','🥔','🌽'],            // ข้าว-แป้ง
  g2: ['🥦','🥬','🥕','🍅','🥒'],            // ผัก
  g3: ['🍎','🍌','🍇','🍍','🍓'],            // ผลไม้
  g4: ['🐟','🍗','🥚','🫘','🧀'],            // โปรตีน (เนื้อ/ถั่ว/ไข่/นมบางส่วน)
  g5: ['🥛','🍼','🍶','🧃','🧈'],            // นม/ผลิตภัณฑ์นม (ปรับได้)
  junk: ['🍟','🍔','🍩','🍰','🧋','🍭','🍫','🥓']
};

function pickFrom(arr, rng){
  if(!arr || !arr.length) return '🍽️';
  return arr[Math.floor(rng() * arr.length)] || arr[0];
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

  // spawner controller
  engine:null,

  // hooks (safe no-op)
  bossOn:false,
  stormOn:false
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
 * Accuracy (good hits / total actions)
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
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: roundPct(accuracy() * 100),

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
 * Progress recompute
 * ------------------------------------------------ */
function updateGoalProgress(){
  if(STATE.goal.done) return;

  // goal: have at least 1 in each group
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;

  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgress(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
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

  updateGoalProgress();
  updateMiniProgress();

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();
  addScore(-50);

  updateMiniProgress();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;

  resetCombo();
  updateMiniProgress();
  emitQuest();
}

/* ------------------------------------------------
 * Optional hooks (Boss/Storm) — safe no-op now
 * ------------------------------------------------ */
function setBoss(on){
  STATE.bossOn = !!on;
  // If you have #bossFx layer, you can toggle class from boot.js or here later.
}
function setStorm(on){
  STATE.stormOn = !!on;
}

/* ------------------------------------------------
 * Group selection & emoji mapping
 * ------------------------------------------------ */
function pickGroupIndex({ rng }){
  // deterministic: use STATE.rng in research/study; random in play
  return Math.floor(rng() * 5);
}

function emojiByGroupIndex(gi, rng){
  if(gi === 0) return pickFrom(EMOJI.g1, rng);
  if(gi === 1) return pickFrom(EMOJI.g2, rng);
  if(gi === 2) return pickFrom(EMOJI.g3, rng);
  if(gi === 3) return pickFrom(EMOJI.g4, rng);
  return pickFrom(EMOJI.g5, rng);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  // Weighted kinds — good/junk
  const weights = (STATE.cfg.diff === 'hard')
    ? { good:0.62, junk:0.38 }
    : (STATE.cfg.diff === 'easy')
      ? { good:0.78, junk:0.22 }
      : { good:0.70, junk:0.30 };

  // Speed
  const spawnRate = (STATE.cfg.diff === 'hard') ? 650
                  : (STATE.cfg.diff === 'easy') ? 980
                  : 820;

  // Lifetimes: hard = shorter good life (แรงกดดัน), easy = longer
  const lifeGoodMs = (STATE.cfg.diff === 'hard') ? 1500
                  : (STATE.cfg.diff === 'easy') ? 2300
                  : 1900;

  const lifeJunkMs = (STATE.cfg.diff === 'hard') ? 2500
                  : 2800;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    spawnRate,
    sizeRange:[44, 66],

    lifeGoodMs,
    lifeJunkMs,

    kinds:[
      { kind:'good', weight:weights.good },
      { kind:'junk', weight:weights.junk }
    ],

    // emoji sets for spawner (fallback); we also override per-target via pickGroupIndex
    emojiByKind:{
      good: ['🍚','🥦','🍎','🐟','🥛'],
      junk: EMOJI.junk
    },

    pickGroupIndex: ({ rng }) => pickGroupIndex({ rng }),

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? pickGroupIndex({ rng: STATE.rng }));
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

  // RNG: deterministic only for research/study
  const rm = String(cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time: plate feel — default 90 ok for kids (70 ก็ได้แต่จะกดดันกว่า)
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

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // OPTIONAL: if you want auto-end when both done (goal+mini) — OFF by default
  // (ไว้ใช้ในโหมดสอน/เดโม่ได้)
  // WIN.addEventListener('quest:update', (e)=>{
  //   const d = e.detail || {};
  //   if(d.allDone) endGame('allDone');
  // }, { once:true });
}