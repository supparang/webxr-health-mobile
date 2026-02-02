// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (lightweight)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js spawner (decorateTarget supported)
// ✅ FIX: “ออกไม่ครบ 5 หมู่” -> Good targets use BAG (1..5 must appear before repeat)
// ✅ End game stops spawner + clears timer (no flashing targets)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pctRound = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

  // plate groups counts (1..5 stored in array index 0..4)
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

  // counters (HHA miss = good expired + junk hit)
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn
  engine:null,

  // BAG for good group fairness
  bag:[],
  bagCursor:0,

  // adaptive knobs (play only)
  spawnRateMs:900,
  wGood:0.70,
  wJunk:0.30,

  // rate-limit coach
  coachAt:0,
};

/* ------------------------------------------------
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  const t = performance.now ? performance.now() : Date.now();
  if(t - STATE.coachAt < 800) return;
  STATE.coachAt = t;
  emit('hha:coach', { msg, tag });
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
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
}

/* ------------------------------------------------
 * Accuracy (good vs total mistakes)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * BAG: ensure good targets cover groups 1..5 before repeat
 * ------------------------------------------------ */
function refillBag(){
  // bag holds groupId 1..5
  const arr = [1,2,3,4,5];
  // shuffle via rng for determinism in research mode
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(STATE.rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  STATE.bag = arr;
  STATE.bagCursor = 0;
}

function nextGoodGroupId(){
  if(!STATE.bag || STATE.bagCursor >= STATE.bag.length) refillBag();
  const gid = STATE.bag[STATE.bagCursor] || 1;
  STATE.bagCursor++;
  return gid;
}

/* ------------------------------------------------
 * Adaptive (play only) — lightweight + fair
 * ------------------------------------------------ */
function applyAdaptive(){
  if(!STATE.cfg) return;
  const run = String(STATE.cfg.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study') return; // adaptive OFF

  // Use simple signals
  const acc = accuracy();           // 0..1
  const combo = STATE.comboMax;     // rising means doing well
  const timeLeft = STATE.timeLeft;

  // Early phase: help them see all groups (keep good high)
  if(timeLeft > (STATE.cfg.durationPlannedSec || 90) * 0.55){
    STATE.wGood = 0.75;
    STATE.wJunk = 0.25;
    STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 760 : 860;
    return;
  }

  // If accuracy low -> reduce junk + slow a bit
  if(acc < 0.70){
    STATE.wGood = 0.78;
    STATE.wJunk = 0.22;
    STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 820 : 920;
    return;
  }

  // If doing well -> increase spice
  if(acc > 0.85 || combo >= 10){
    STATE.wGood = 0.64;
    STATE.wJunk = 0.36;
    STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 680 : 780;
    return;
  }

  // neutral
  STATE.wGood = 0.70;
  STATE.wJunk = 0.30;
  STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 720 : 850;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function hardStopSpawner(){
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // stop spawner NOW (prevent flashing targets)
  hardStopSpawner();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pctRound(accuracy() * 100),

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

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // adapt as time progresses (play only)
    applyAdaptive();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupId){
  STATE.hitGood++;

  // groupId is 1..5 -> array index 0..4
  const idx = clamp(groupId, 1, 5) - 1;
  STATE.g[idx]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // Goal: count how many groups have at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v => v > 0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    } else if(STATE.goal.cur === 3){
      coach('เหลืออีก 2 หมู่! ลุยต่อ 🍽️');
    }
  }

  // Mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // Optional judge emit
  emit('hha:judge', { type:'hit_good', groupId, score: STATE.score, combo: STATE.combo });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emit('hha:judge', { type:'hit_junk', score: STATE.score, combo: STATE.combo });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emit('hha:judge', { type:'expire_good', score: STATE.score, combo: STATE.combo });
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: good/junk
  // target.groupIndex: we will store 1..5 for good; keep 0 for junk
  const kind = target.kind || 'good';

  // emoji + label
  let emoji = '🍽️';
  let label = '';

  if(kind === 'junk'){
    emoji = pickEmoji(target.rng || STATE.rng, JUNK.emojis);
    label = JUNK.labelTH;
  }else{
    const gid = clamp(target.groupIndex, 1, 5);
    emoji = emojiForGroup(target.rng || STATE.rng, gid);
    label = labelForGroup(gid);
  }

  // set content
  try{
    el.textContent = emoji;
    el.setAttribute('aria-label', label);
    el.title = label;
    el.dataset.emoji = emoji;
    el.dataset.group = String(target.groupIndex || '');
  }catch{}
}

function makeSpawner(mount){
  // choose rates / weights based on current state (adaptive may adjust in play)
  const spawnRate = clamp(STATE.spawnRateMs, 520, 1400);

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange: [44, 64],
    kinds: [
      { kind:'good', weight: STATE.wGood },
      { kind:'junk', weight: STATE.wJunk }
    ],

    // ✅ decorateTarget hook
    decorateTarget,

    onHit: (t) => {
      if(STATE.ended) return;

      if(t.kind === 'good'){
        // groupIndex stored as 1..5 (guaranteed by BAG)
        const gid = clamp(t.groupIndex || 1, 1, 5);
        onHitGood(gid);
      }else{
        onHitJunk();
      }

      // If allDone, you can end early (optional)
      // if(STATE.goal.done && STATE.mini.done) endGame('all_done');
    },

    onExpire: (t) => {
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
  if(!cfg) cfg = {};

  // stop previous run if any (hot reload safety)
  try{ hardStopSpawner(); }catch{}
  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  STATE.cfg = cfg;
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

  STATE.coachAt = 0;

  // RNG
  const runMode = String(cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // BAG reset
  STATE.bag = [];
  STATE.bagCursor = 999; // force refill
  refillBag();

  // initial adaptive knobs
  STATE.spawnRateMs = (cfg.diff === 'hard') ? 820 : 900;
  STATE.wGood = 0.70;
  STATE.wJunk = 0.30;
  applyAdaptive();

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  emit('hha:time', { leftSec: STATE.timeLeft });

  // Start timer
  startTimer();

  // Spawn engine — IMPORTANT: guarantee good groups come outครบ 1..5
  // We do this by patching groupIndex at creation time via decorateTarget + using BAG for good targets:
  // mode-factory creates target.groupIndex randomly; we override it safely inside decorateTarget path? -> better:
  // We'll use a tiny trick: when decorateTarget is called, target is already created.
  // So we also ensure the group assignment before decorateTarget runs by intercepting via global hook:
  // BUT we don't have that here; easiest is: use BAG inside decorateTarget + also inside onHit uses groupIndex.
  // However we must ensure consistency: set target.groupIndex for good BEFORE decorateTarget uses it.
  // -> We'll do it by wrapping decorateTarget (below) with an assignment.

  const decorateTargetWrap = (el, target) => {
    if(target && target.kind === 'good'){
      // Force 1..5 cycling
      target.groupIndex = nextGoodGroupId();
    } else if(target && target.kind === 'junk'){
      target.groupIndex = 0;
    }
    decorateTarget(el, target);
  };

  // create spawner with wrapped decorate
  STATE.engine = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: clamp(STATE.spawnRateMs, 520, 1400),
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight: STATE.wGood },
      { kind:'junk', weight: STATE.wJunk }
    ],
    decorateTarget: decorateTargetWrap,
    onHit:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good'){
        const gid = clamp(t.groupIndex || 1, 1, 5);
        onHitGood(gid);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // Safety: if engine missing stop() (should not), at least don't crash
  if(!STATE.engine || typeof STATE.engine.stop !== 'function'){
    console.warn('[PlateVR] spawner did not return stop()');
  }
}