// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Works with: ../vr/mode-factory.js (export boot)
// ✅ Uses decorateTarget(el,t) => emoji by Thai 5 food groups + junk icon
// ✅ Play / Research modes
//   - play: adaptive ON (lightweight heuristic)
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

function pickFrom(rng, arr){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

function pct2(n){
  // keep 2 decimals for logs; UI can round
  return Math.round((Number(n)||0) * 100) / 100;
}

/* ------------------------------------------------
 * Emoji pack (Thai 5 food groups mapping - fixed)
 * หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * หมู่ 2 คาร์บ (ข้าว แป้ง เผือก มัน น้ำตาล)
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI = {
  g1: ['🥩','🍗','🍖','🥚','🥛','🫘'],          // โปรตีน
  g2: ['🍚','🍞','🥖','🍜','🥔','🍠','🍙'],    // คาร์บ/แป้ง/เผือกมัน
  g3: ['🥦','🥬','🥒','🥕','🌽','🍆','🫑'],    // ผัก
  g4: ['🍎','🍌','🍊','🍉','🍍','🍇','🥭'],    // ผลไม้
  g5: ['🥑','🧈','🥥','🫒','🌰'],              // ไขมัน
  junk: ['🍟','🍔','🍕','🍩','🍰','🧋','🥤','🍫'] // ของหวาน/ทอด
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

  // plate groups (5 หมู่) collected counts
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
    // ปรับให้สนุกกว่า “แม่น ≥80%” แบบเดิม (แต่ยังคุมให้เหมาะเด็ก)
    name:'คอมโบต่อเนื่อง',
    sub:'ทำคอมโบ ≥ 10',
    cur:0,
    target:10,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner
  mount:null,
  spawner:null,

  // adaptive (play mode only)
  adaptiveOn:false,
  tick2s:null,
  spawnRateMs:900,
  junkWeight:0.30,

  // recent window (for “prediction”/tips)
  recent:[], // {t, kind:'good'|'junk'|'expire'}
  lastCoachAt:0
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
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  const now = performance.now ? performance.now() : Date.now();
  if(now - STATE.lastCoachAt < 900) return; // rate limit
  STATE.lastCoachAt = now;
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
}

/* ------------------------------------------------
 * Accuracy (good-based)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Recent window for “prediction” tips
 * ------------------------------------------------ */
function pushRecent(kind){
  const t = performance.now ? performance.now() : Date.now();
  STATE.recent.push({ t, kind });
  const cutoff = t - 8000; // last 8s
  while(STATE.recent.length && STATE.recent[0].t < cutoff) STATE.recent.shift();
}
function predictedRisk(){
  // simple heuristic (placeholder for ML): junk/expire frequency in last 8s
  if(!STATE.recent.length) return 0;
  const bad = STATE.recent.filter(x => x.kind !== 'good').length;
  return bad / STATE.recent.length;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopAllTimers(){
  clearInterval(STATE.timer);
  clearInterval(STATE.tick2s);
  STATE.timer = null;
  STATE.tick2s = null;
}

function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  stopAllTimers();
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
    g5: STATE.g[4],

    // telemetry snapshot (for future ML/DL)
    spawnRateMs: STATE.spawnRateMs,
    junkWeight: STATE.junkWeight
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
function updateGoal(){
  if(STATE.goal.done) return;

  // goal: have at least 1 in each group
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;

  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMini(){
  if(STATE.mini.done) return;

  // mini: combo >= target
  STATE.mini.cur = Math.max(STATE.mini.cur, STATE.comboMax);
  if(STATE.comboMax >= STATE.mini.target){
    STATE.mini.done = true;
    coach('สุดยอด! คอมโบถึงเป้าแล้ว 🔥');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6); // slightly more exciting

  pushRecent('good');

  updateGoal();
  updateMini();

  emitQuest();

  // “prediction” micro tip (play mode only)
  if(STATE.adaptiveOn){
    const risk = predictedRisk();
    if(risk >= 0.45) coach('ช้า ๆ ได้! เล็งให้แม่นก่อนยิง 👀', 'AI Coach');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  pushRecent('junk');

  coach('ระวัง! ของหวาน/ทอด ⚠️');

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  pushRecent('expire');

  // no spam coach here (keep calm)
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji by group)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  const kind = t.kind || 'good';
  const gi = clamp(t.groupIndex ?? 0, 0, 4);

  if(kind === 'good'){
    const key = ['g1','g2','g3','g4','g5'][gi] || 'g1';
    const e = pickFrom(t.rng || STATE.rng, EMOJI[key]);
    el.textContent = e || '🍽️';
    el.dataset.group = key;
    el.setAttribute('aria-label', `อาหารหมู่ ${gi+1}`);
  }else{
    const e = pickFrom(t.rng || STATE.rng, EMOJI.junk);
    el.textContent = e || '🍩';
    el.setAttribute('aria-label', 'อาหารหวาน/ทอด');
  }
}

/* ------------------------------------------------
 * Spawner (supports restart for adaptive)
 * ------------------------------------------------ */
function startSpawner(){
  stopSpawner();

  const spawnRate = STATE.spawnRateMs;
  const jw = STATE.junkWeight;

  STATE.spawner = spawnBoot({
    mount: STATE.mount,
    seed: STATE.cfg.seed,

    spawnRate,
    sizeRange:[46, 70],

    // weights: good vs junk
    kinds:[
      { kind:'good', weight: Math.max(0.05, 1 - jw) },
      { kind:'junk', weight: Math.max(0.05, jw) }
    ],

    decorateTarget, // ✅ key patch

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
      emit('hha:judge', { kind:t.kind, groupIndex:t.groupIndex, source:t.source || '' });
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Adaptive difficulty (play mode only)
 * ------------------------------------------------ */
function adaptiveTick(){
  if(!STATE.running || !STATE.adaptiveOn) return;

  // simple, safe heuristic (placeholder for ML):
  // - If accuracy high + low miss => faster, slightly more junk
  // - If accuracy low or many miss => slower, less junk
  const acc = accuracy(); // 0..1
  const miss = STATE.miss;

  let rate = STATE.spawnRateMs;
  let jw = STATE.junkWeight;

  // score flow indicator: combo helps
  const comboNow = STATE.combo;

  if(acc >= 0.82 && miss <= 4){
    rate = Math.max(620, rate - 40);
    jw = Math.min(0.38, jw + 0.01);
  }else if(acc <= 0.65 || miss >= 8){
    rate = Math.min(980, rate + 55);
    jw = Math.max(0.22, jw - 0.02);
  }else{
    // gentle drift
    if(comboNow >= 8) rate = Math.max(680, rate - 15);
  }

  // if changed enough, restart spawner
  const changed = (Math.abs(rate - STATE.spawnRateMs) >= 35) || (Math.abs(jw - STATE.junkWeight) >= 0.02);
  STATE.spawnRateMs = rate;
  STATE.junkWeight = jw;

  if(changed){
    startSpawner();
    // “AI” feedback (sparingly)
    if(predictedRisk() < 0.25 && acc >= 0.78) coach('เริ่มเก่งขึ้นแล้ว! เพิ่มความเร็วให้นิดนึง 🚀', 'AI Director');
  }
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.mount = mount;
  STATE.cfg = cfg;

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

  STATE.recent = [];
  STATE.lastCoachAt = 0;

  // RNG
  const runMode = (cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
    STATE.adaptiveOn = false; // ✅ deterministic
  }else{
    STATE.rng = Math.random;
    STATE.adaptiveOn = true; // ✅ adaptive
  }

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // base difficulty
  const diff = (cfg.diff || 'normal').toLowerCase();
  if(diff === 'easy'){
    STATE.spawnRateMs = 950;
    STATE.junkWeight = 0.24;
    STATE.mini.target = 8;
    STATE.mini.sub = 'ทำคอมโบ ≥ 8';
  }else if(diff === 'hard'){
    STATE.spawnRateMs = 760;
    STATE.junkWeight = 0.34;
    STATE.mini.target = 12;
    STATE.mini.sub = 'ทำคอมโบ ≥ 12';
  }else{
    STATE.spawnRateMs = 880;
    STATE.junkWeight = 0.30;
    STATE.mini.target = 10;
    STATE.mini.sub = 'ทำคอมโบ ≥ 10';
  }

  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  // spawner
  startSpawner();

  // adaptive loop (every 2s) — play mode only
  clearInterval(STATE.tick2s);
  if(STATE.adaptiveOn){
    STATE.tick2s = setInterval(adaptiveTick, 2000);
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}