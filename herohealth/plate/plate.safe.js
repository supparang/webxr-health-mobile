// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (rule-based difficulty director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (spawn engine)
//   - supports decorateTarget(el,target) for emoji/icon
// ✅ Emoji mapping: Thai Food 5 Groups (STABLE)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End: stop spawner (no “blink targets” after end)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji } from '../vr/food5-th.js';

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

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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

  // plate groups counts (index 0..4 => หมู่ 1..5)
  g:[0,0,0,0,0],

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

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner
  engine:null,

  // difficulty (adaptive in play)
  dyn:{
    spawnRate: 900,
    sizeRange:[46,66],
    goodW:0.72,
    junkW:0.28,
    lastCoachAt:0
  }
};

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  // miss ตามแนวเดียวกับ GoodJunk: good expired + junk hit
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accPctInt(){
  return Math.round(accuracy() * 100);
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

function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMini(){
  const a = accPctInt();
  STATE.mini.cur = a;
  if(!STATE.mini.done && a >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
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
}

/* ------------------------------------------------
 * Adaptive difficulty (Play only)
 * ------------------------------------------------ */
function maybeCoachTip(){
  const t = performance.now ? performance.now() : Date.now();
  if(t - STATE.dyn.lastCoachAt < 2500) return;
  STATE.dyn.lastCoachAt = t;

  const a = accPctInt();
  if(a < 65) coach('เล็งให้ชัวร์ก่อนกดนะ 😄', 'Coach');
  else if(STATE.combo >= 10) coach('คอมโบสวยมาก! รักษาจังหวะไว้ ✨', 'Coach');
}

function adjustDifficulty(){
  if(!STATE.cfg || STATE.cfg.runMode !== 'play') return;

  const a = accPctInt();
  const elapsed = Math.max(1, (STATE.cfg.durationPlannedSec - STATE.timeLeft + 1));
  const pace = STATE.hitGood / elapsed;

  const base = (STATE.cfg.diff === 'hard') ? 1.15 : (STATE.cfg.diff === 'easy') ? 0.90 : 1.00;

  // เร่ง: แม่น + เก็บเร็ว
  if(a >= 85 && pace >= 0.55){
    STATE.dyn.spawnRate = Math.max(520, Math.round(820 / base));
    STATE.dyn.goodW = 0.66; STATE.dyn.junkW = 0.34;
    maybeCoachTip();
    return;
  }

  // ผ่อน: พลาดเยอะ
  if(a <= 70){
    STATE.dyn.spawnRate = Math.min(1100, Math.round(980 / base));
    STATE.dyn.goodW = 0.75; STATE.dyn.junkW = 0.25;
    maybeCoachTip();
    return;
  }

  // ปกติ
  STATE.dyn.spawnRate = Math.round(((STATE.cfg.diff === 'hard') ? 760 : (STATE.cfg.diff === 'easy') ? 980 : 880) / base);
  STATE.dyn.goodW = 0.72; STATE.dyn.junkW = 0.28;
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

    accuracyGoodPct: accPctInt(),

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

    // adaptive tick
    if(STATE.cfg && STATE.cfg.runMode === 'play' && (STATE.timeLeft % 3 === 0)){
      adjustDifficulty();
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
  addScore(100 + STATE.combo * 6);

  updateGoal();
  updateMini();
  emitQuest();

  // ผ่านทันทีเมื่อครบทั้งคู่
  if(STATE.goal.done && STATE.mini.done){
    coach('ผ่านทันที! ทำได้ครบทั้ง Goal + Mini ✅', 'Coach');
    endGame('all_done');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  updateMini();
  emitQuest();
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMini();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji pack)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  try{ el.innerHTML = ''; }catch{}

  const isJunk = (target.kind === 'junk');
  const groupId = isJunk ? 0 : (Number(target.groupIndex||0) + 1); // 1..5

  let emoji = '🍽️';
  if(isJunk){
    emoji = pickEmoji(target.rng, JUNK.emojis);
  }else{
    emoji = emojiForGroup(target.rng, groupId);
  }

  const span = document.createElement('span');
  span.className = 'tg-emoji';
  span.textContent = emoji;
  el.appendChild(span);

  const label = document.createElement('span');
  label.className = 'tg-label';
  label.textContent = isJunk ? 'JUNK' : `หมู่ ${groupId}`;
  el.appendChild(label);

  if(!isJunk) el.dataset.group = String(groupId);
  else el.dataset.group = 'junk';
}

/* ------------------------------------------------
 * Spawn builder
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate: STATE.dyn.spawnRate,
    sizeRange: STATE.dyn.sizeRange,

    kinds:[
      { kind:'good', weight: STATE.dyn.goodW },
      { kind:'junk', weight: STATE.dyn.junkW }
    ],

    decorateTarget, // ✅

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

  // RNG (deterministic for research/study)
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time default 90
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // init dyn from diff
  STATE.dyn.spawnRate = (cfg.diff === 'hard') ? 760 : (cfg.diff === 'easy') ? 980 : 880;
  STATE.dyn.sizeRange = (cfg.diff === 'hard') ? [44,64] : (cfg.diff === 'easy') ? [50,72] : [46,66];
  STATE.dyn.goodW = 0.72;
  STATE.dyn.junkW = 0.28;
  STATE.dyn.lastCoachAt = 0;

  // research/study: adaptive OFF (ไม่เรียก adjustDifficulty)
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

  stopSpawner();
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}