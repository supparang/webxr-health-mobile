// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (fair / smooth)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (spawn engine)
// ✅ Decorate targets with emoji per Thai 5 food groups + JUNK
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:end
// ✅ End game stops spawner (no post-end flicker)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  // score
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  timeLeft:0,
  timer:null,

  // plate groups (1..5)
  g:[0,0,0,0,0], // index 0-4 => groupId 1-5

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

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

  // cfg / mode
  cfg:null,
  rng:Math.random,
  isResearch:false,
  adaptiveOn:false,

  // spawner
  spawner:null,
  spawnerProfile:'normal', // easy/normal/hard-ish within diff
  lastAdaptiveAt:0,

  // coach limiter
  coachLastAt:0
};

/* ------------------------------------------------
 * Derived metrics
 * ------------------------------------------------ */
function accuracy(){
  // miss = hitJunk + expireGood (Plate definition)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * UI / Coach
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  const now = Date.now();
  // rate limit: avoid spam
  if(now - STATE.coachLastAt < 900) return;
  STATE.coachLastAt = now;
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

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
 * Scoring
 * ------------------------------------------------ */
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

function addScore(v){
  STATE.score += Number(v) || 0;
  emitScore();
}

/* ------------------------------------------------
 * Targets: decorate with emoji + group label
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.groupIndex: 0..4 => groupId:1..5
  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  el.dataset.groupId = String(groupId);

  // pick emoji deterministically if engine uses seeded rng
  let emo = '❓';
  if(target.kind === 'junk'){
    emo = pickEmoji(target.rng, JUNK.emojis);
    el.dataset.label = 'JUNK';
  }else{
    emo = emojiForGroup(target.rng, groupId);
    el.dataset.label = labelForGroup(groupId);
  }

  // UI: big emoji + tiny label (optional)
  // Keep it lightweight: no innerHTML heavy layout, but enough to feel alive
  el.textContent = emo;

  // subtle assist: title tooltip for debugging/learning
  try{
    el.title = (target.kind === 'junk')
      ? `${JUNK.labelTH} • ${JUNK.descTH}`
      : `${labelForGroup(groupId)} • ${FOOD5[groupId]?.descTH || ''}`;
  }catch{}
}

/* ------------------------------------------------
 * Adaptive (PLAY only)
 * ------------------------------------------------ */
function computeAdaptiveProfile(){
  // only in play mode
  const acc = accuracyPct();
  const c = STATE.combo;
  const t = STATE.timeLeft;

  // make it "fair": if struggling -> soften, if dominating -> spice up
  if(acc < 55 || STATE.miss >= 6) return 'easy';
  if(acc > 85 && c >= 8 && t > 15) return 'hard';
  return 'normal';
}

function computeSpawnSettings(){
  // base by diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  let baseRate = 900;
  if(diff === 'easy') baseRate = 980;
  else if(diff === 'hard') baseRate = 780;

  // profile tweak
  let rate = baseRate;
  let junkW = 0.30;

  const profile = STATE.spawnerProfile;
  if(profile === 'easy'){
    rate = Math.round(baseRate * 1.12);
    junkW = 0.22;
  }else if(profile === 'hard'){
    rate = Math.round(baseRate * 0.88);
    junkW = 0.36;
  }

  // clamp sanity
  rate = clamp(rate, 520, 1300);

  return {
    spawnRate: rate,
    kinds: [
      { kind:'good', weight: 1 - junkW },
      { kind:'junk', weight: junkW }
    ]
  };
}

function maybeUpdateAdaptive(){
  if(!STATE.adaptiveOn || STATE.isResearch) return;
  const now = Date.now();
  if(now - STATE.lastAdaptiveAt < 2200) return;
  STATE.lastAdaptiveAt = now;

  const next = computeAdaptiveProfile();
  if(next === STATE.spawnerProfile) return;

  STATE.spawnerProfile = next;

  // restart spawner with new settings
  restartSpawner('adaptive');
  if(next === 'easy') coach('ปรับให้ง่ายขึ้นนิดนึงนะ ✨', 'AI');
  if(next === 'hard') coach('เก่งมาก! เพิ่มความท้าทาย 🔥', 'AI');
}

/* ------------------------------------------------
 * Hit / Expire handlers
 * ------------------------------------------------ */
function updateGoalProgress(){
  if(STATE.goal.done) return;

  // goal: have at least 1 item in each group
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgress(){
  const accPct = accuracyPct();
  STATE.mini.cur = accPct;

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'AI');
  }
}

function maybeFinishEarly(){
  // allow early clear if both quests done (makes it feel punchy)
  if(STATE.goal.done && STATE.mini.done && STATE.timeLeft > 3){
    endGame('cleared');
  }
}

function onHitGood(groupIndex){
  if(!STATE.running || STATE.ended) return;

  STATE.hitGood++;
  const gi = clamp(groupIndex ?? 0, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalProgress();
  updateMiniProgress();
  emitQuest();
  maybeUpdateAdaptive();
  maybeFinishEarly();
}

function onHitJunk(){
  if(!STATE.running || STATE.ended) return;

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  // quick coaching based on context
  if(STATE.miss <= 3) coach('ระวัง! ของหวาน/ทอด ⚠️', 'AI');
  maybeUpdateAdaptive();
}

function onExpireGood(){
  if(!STATE.running || STATE.ended) return;

  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // gentle hint occasionally
  if(STATE.expireGood === 1) coach('พยายามเก็บให้ทันนะ ⏱️', 'AI');
  maybeUpdateAdaptive();
}

/* ------------------------------------------------
 * Spawner management
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;
}

function restartSpawner(reason='restart'){
  stopSpawner();

  const mount = STATE.cfg?.__mount;
  if(!mount) return;

  const s = computeSpawnSettings();

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: s.spawnRate,
    sizeRange: [44, 64],
    kinds: s.kinds,
    decorateTarget, // ✅ emoji/icon UI
    onHit: (t)=>{
      if(t.kind === 'good'){
        // t.groupIndex already 0..4 from mode-factory (deterministic)
        onHitGood(t.groupIndex);
      }else{
        onHitJunk();
      }
    },
    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  // optional: silent debug hook
  // console.log('[PlateVR] spawner', reason, 'profile=', STATE.spawnerProfile, s);
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();
  clearInterval(STATE.timer);

  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emitTime();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }else{
      // adaptive tick
      maybeUpdateAdaptive();
    }
  }, 1000);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner(); // ✅ IMPORTANT: stop targets now

  emit('hha:end', {
    reason,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accuracyPct(),

    // breakdown for research/dashboard
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // store mount in cfg for internal spawner restart
  cfg = cfg || {};
  cfg.__mount = mount;

  STATE.cfg = cfg;
  STATE.isResearch = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.adaptiveOn = !STATE.isResearch && (cfg.runMode === 'play');

  // RNG: deterministic in research, free in play
  if(STATE.isResearch){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // reset state
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

  STATE.coachLastAt = 0;
  STATE.lastAdaptiveAt = 0;

  // initial profile
  STATE.spawnerProfile = (cfg.diff === 'easy') ? 'easy' : 'normal';

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // announce start
  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    adaptive: STATE.adaptiveOn ? 1 : 0
  });

  // init UI state
  emitScore();
  emitQuest();
  startTimer();

  // start spawner
  restartSpawner('boot');

  // opening coach
  if(STATE.isResearch){
    coach('เริ่มโหมดวิจัย (deterministic) 🍽️', 'System');
  }else{
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'AI');
  }

  // return stop handle (optional)
  return {
    stop(){
      if(STATE.ended) return;
      endGame('stop');
    }
  };
}