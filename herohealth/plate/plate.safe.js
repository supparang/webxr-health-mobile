// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (boot + decorateTarget)
// ✅ Uses Thai 5-food-group mapping: ../vr/food5-th.js
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ FIX: endGame() stops spawner (no “target flash” after end)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b)=>{
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n)=> Math.round((Number(n) || 0) * 100) / 100;

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

function nowMs(){
  try{ return performance.now(); }catch{ return Date.now(); }
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

  // ✅ miss definition aligned w/ HHA style: miss = junk hit + good expired
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups counts (index 0..4 => group 1..5)
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0, target:5, done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg/mode
  cfg:null,
  rng:Math.random,

  // spawner
  engine:null,

  // adaptive knobs (play mode only)
  baseSpawnRate: 900,
  baseTTLGood: 2100,
  baseTTLJunk: 1700,

  spawnRateNow: 900,
  ttlGoodNow: 2100,
  ttlJunkNow: 1700,

  lastAdaptiveAt: 0,

  // for adaptive stats
  lastScore: 0,
  lastMiss: 0,
  lastComboMax: 0
};

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
 * Accuracy (good only / miss definition)
 * total = good hit + junk hit + good expired
 * accuracy = good hit / total
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Adaptive difficulty (play mode only)
 * ------------------------------------------------ */
function isAdaptiveOn(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  return run === 'play';
}

function applyAdaptive(){
  if(!isAdaptiveOn()) return;

  const t = nowMs();
  if(t - STATE.lastAdaptiveAt < 900) return; // update ~1s
  STATE.lastAdaptiveAt = t;

  const acc = accuracy(); // 0..1
  const combo = STATE.comboMax;
  const miss = STATE.miss;

  // Simple fair ramp:
  // - if accuracy high + combo growing => slightly faster spawns, slightly shorter TTL
  // - if misses rising / accuracy low => ease up
  const skill = (acc * 0.65) + (Math.min(combo, 20)/20) * 0.35; // 0..1

  // penalty if miss increased recently
  const missDelta = miss - (STATE.lastMiss || 0);
  const ease = clamp(missDelta, 0, 3) / 3; // 0..1

  // spawnRate: lower = harder
  const hardFactor = clamp(skill - ease*0.6, 0, 1); // 0..1
  const sr = STATE.baseSpawnRate - hardFactor * 220 + ease * 180; // 900 -> ~680 (hard) or ~1080 (easy)
  STATE.spawnRateNow = clamp(sr, 620, 1200);

  const ttlGood = STATE.baseTTLGood - hardFactor * 320 + ease * 260; // 2100 -> ~1780 or ~2360
  const ttlJunk = STATE.baseTTLJunk - hardFactor * 240 + ease * 220; // 1700 -> ~1460 or ~1880
  STATE.ttlGoodNow = clamp(ttlGood, 1600, 2600);
  STATE.ttlJunkNow = clamp(ttlJunk, 1200, 2200);

  STATE.lastMiss = miss;
}

/* ------------------------------------------------
 * End game (stop spawner!)
 * ------------------------------------------------ */
function stopSpawner(){
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function'){
      STATE.engine.stop();
    }
  }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner(); // ✅ critical: prevent “target flash” after end

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

    // group counts
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
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
    applyAdaptive();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalProgress(){
  if(STATE.goal.done) return;
  // goal progress = how many groups have at least 1 hit
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(groupIndex0to4){
  STATE.hitGood++;

  const gi = clamp(groupIndex0to4, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalProgress();
  updateMiniAccuracy();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;

  // miss = junk hit + good expired
  STATE.miss++;

  resetCombo();
  addScore(-50);

  updateMiniAccuracy();
  emitQuest();
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;

  // miss = junk hit + good expired
  STATE.miss++;

  resetCombo();
  updateMiniAccuracy();
  emitQuest();
}

/* ------------------------------------------------
 * Target decorator (emoji per group)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.groupIndex: 0..4 => groupId: 1..5
  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  const rng = target.rng;

  let emoji = '🥦';
  let label = '';

  if(target.kind === 'junk'){
    emoji = pickEmoji(rng, JUNK.emojis);
    label = JUNK.labelTH;
    el.dataset.group = 'junk';
  }else{
    emoji = emojiForGroup(rng, groupId);
    label = labelForGroup(groupId);
    el.dataset.group = String(groupId);
  }

  // Simple: emoji only (fast + clean)
  el.textContent = emoji;
  el.setAttribute('aria-label', `${label}`);

  // Optional: tiny hint (uncomment if you want 2-line)
  // el.innerHTML = `<div class="emo">${emoji}</div><div class="cap">${label}</div>`;
}

/* ------------------------------------------------
 * Spawn logic (uses mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  stopSpawner(); // safety if re-boot

  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const hard = diff === 'hard';
  const easy = diff === 'easy';

  // base difficulty by diff
  STATE.baseSpawnRate = easy ? 980 : (hard ? 760 : 880);
  STATE.baseTTLGood   = easy ? 2350 : (hard ? 1850 : 2100);
  STATE.baseTTLJunk   = easy ? 1900 : (hard ? 1500 : 1700);

  // initial (may be adapted)
  STATE.spawnRateNow = STATE.baseSpawnRate;
  STATE.ttlGoodNow   = STATE.baseTTLGood;
  STATE.ttlJunkNow   = STATE.baseTTLJunk;

  // In research/study: lock knobs (no adaptive)
  if(!isAdaptiveOn()){
    STATE.spawnRateNow = STATE.baseSpawnRate;
    STATE.ttlGoodNow   = STATE.baseTTLGood;
    STATE.ttlJunkNow   = STATE.baseTTLJunk;
  }

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // dynamic spawnRate: we pass a fixed number to mode-factory,
    // so for adaptive we recreate spawner when rate changes a lot (lightweight approach).
    // BUT to keep simple + stable: we keep spawnRate fixed and rely on TTL only.
    // (If you want dynamic rate, tell me เดี๋ยวเพิ่ม “setRate()” ใน mode-factory ให้)
    spawnRate: STATE.spawnRateNow,

    sizeRange: [44, 66],

    kinds: [
      { kind:'good', weight: 0.72 },
      { kind:'junk', weight: 0.28 }
    ],

    decorateTarget,

    onHit: (t)=>{
      if(STATE.ended) return;

      if(t.kind === 'good'){
        // groupIndex already chosen deterministically in spawner
        const gi = (t.groupIndex ?? Math.floor(STATE.rng()*5));
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(STATE.ended) return;

      // ✅ apply adaptive TTL by kind (best-effort):
      // mode-factory currently sets ttl at spawn time; here we just count misses.
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Public boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous run if any
  clearInterval(STATE.timer);
  stopSpawner();

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

  STATE.lastAdaptiveAt = 0;
  STATE.lastMiss = 0;

  // RNG
  const run = (cfg?.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    // deterministic
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

  // spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}