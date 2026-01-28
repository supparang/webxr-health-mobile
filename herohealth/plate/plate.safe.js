// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (dynamic spawnRate + junk weight)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Target UI: decorateTarget + emoji by Thai 5 food groups (1..5) + junk emojis
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss/Storm hooks: optional DOM layers (#bossFx/#stormFx) if present
// ✅ Crosshair/tap-to-shoot via vr-ui.js -> event "hha:shoot" handled inside mode-factory
// ✅ Endgame: stops spawner to prevent "target flash"
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function isResearch(runMode){
  const m = String(runMode || 'play').toLowerCase();
  return (m === 'research' || m === 'study');
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

  // miss definition for Plate (same spirit as GoodJunk):
  // miss = good expired + junk hit
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่): index 0..4 maps to groupId 1..5
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

  // spawner controller
  controller:null,

  // adaptive
  adaptiveOn:false,
  spawnRateBase:900,
  spawnRateNow:900,
  junkWBase:0.30,
  junkWNow:0.30,
  adaptTicker:null,
  lastCoachAt:0,

  // phase flags
  stormOn:false,
  bossOn:false,
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * DOM FX hooks (optional)
 * ------------------------------------------------ */
function setFx(id, clsOn, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(clsOn);
  else el.classList.remove(clsOn);
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
function coach(msg, tag='Coach', minGapMs=1200){
  const t = nowMs();
  if(t - STATE.lastCoachAt < minGapMs) return;
  STATE.lastCoachAt = t;
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
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Adaptive Director (play mode only)
 * ------------------------------------------------ */
function applyAdaptiveTick(){
  if(!STATE.running || STATE.ended) return;
  if(!STATE.adaptiveOn) return;

  const tLeft = STATE.timeLeft;
  const acc = accuracy();                 // 0..1
  const combo = STATE.combo;
  const miss = STATE.miss;

  // base difficulty from diff
  let rateBase = STATE.spawnRateBase;
  let junkBase = STATE.junkWBase;

  // performance -> adjust
  // - doing well (high acc + good combo) => faster + slightly more junk
  // - struggling (low acc + high miss) => slower + less junk
  let rate = rateBase;
  let junkW = junkBase;

  const well = (acc >= 0.82 && combo >= 6);
  const struggle = (acc <= 0.65 && miss >= 6);

  if(well){
    rate *= 0.82;          // faster spawns
    junkW = Math.min(0.45, junkW + 0.08);
  }else if(struggle){
    rate *= 1.12;          // slower spawns
    junkW = Math.max(0.18, junkW - 0.10);
  }else{
    // gentle nudge by accuracy
    const k = (0.78 - acc);          // positive -> struggling
    rate *= clamp(1 + k * 0.35, 0.82, 1.15);
    junkW = clamp(junkW + (acc - 0.78) * 0.10, 0.18, 0.42);
  }

  // phase spice near end (last 20s) => "storm"
  if(tLeft <= 20 && tLeft > 0){
    rate *= 0.90;
    junkW = Math.min(0.48, junkW + 0.06);
    if(!STATE.stormOn){
      STATE.stormOn = true;
      setFx('stormFx', 'storm-on', true);
      coach('สตอร์มมาแล้ว! ตั้งสติ เล็งดี ๆ 🌪️', 'AI');
    }
  }else if(STATE.stormOn){
    STATE.stormOn = false;
    setFx('stormFx', 'storm-on', false);
  }

  // boss spice at last 10s => "boss"
  if(tLeft <= 10 && tLeft > 0){
    junkW = Math.min(0.55, junkW + 0.06);
    if(!STATE.bossOn){
      STATE.bossOn = true;
      setFx('bossFx', 'boss-on', true);
      coach('บอสมา! อย่าเผลอแตะของทอด/หวาน 😈', 'AI');
    }
  }else if(STATE.bossOn){
    STATE.bossOn = false;
    setFx('bossFx', 'boss-on', false);
  }

  STATE.spawnRateNow = Math.round(clamp(rate, 520, 1400));
  STATE.junkWNow = clamp(junkW, 0.15, 0.60);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.controller && typeof STATE.controller.stop === 'function'){
    try{ STATE.controller.stop(); }catch{}
  }
  STATE.controller = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  try{ clearInterval(STATE.adaptTicker); }catch{}
  STATE.timer = null;
  STATE.adaptTicker = null;

  // stop spawner to prevent "flash targets"
  stopSpawner();

  // turn off FX layers
  setFx('stormFx', 'storm-on', false);
  setFx('bossFx', 'boss-on', false);

  const accPct = Math.round(accuracy() * 100);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct,

    // group counts (1..5)
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // mode info
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed
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

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateMiniByAccuracy(){
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function updateGoalByGroups(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;

  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function onHitGood(groupIndex0){
  STATE.hitGood++;

  const gi = clamp(groupIndex0, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalByGroups();
  updateMiniByAccuracy();
  emitQuest();

  // fun micro feedback (rare)
  if(STATE.combo === 5) coach('คอมโบ 5! สวยมาก ✨', 'AI', 1800);
  if(STATE.combo === 10) coach('คอมโบ 10! มือโปรแล้ว 🔥', 'AI', 1800);

  emitScore();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;          // miss = junk hit
  resetCombo();
  addScore(-50);

  updateMiniByAccuracy();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 1400);
  emitScore();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;          // miss = good expired
  resetCombo();

  updateMiniByAccuracy();
  emitQuest();

  // softer coach
  coach('เร็วเข้า! อาหารดี ๆ หายไปแล้ว ⏳', 'Coach', 1700);
  emitScore();
}

/* ------------------------------------------------
 * decorateTarget (emoji UI)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: good/junk
  // target.groupIndex: 0..4 (we map to 1..5)
  const kind = String(target.kind || 'good');
  const rng = target.rng || STATE.rng;

  if(kind === 'junk'){
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', 'ขยะอาหาร');
    el.textContent = pickEmoji(rng, JUNK.emojis);
    return;
  }

  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  const g = FOOD5[groupId];

  el.dataset.group = String(groupId);
  el.setAttribute('aria-label', g ? g.labelTH : `หมู่ ${groupId}`);
  el.textContent = emojiForGroup(rng, groupId);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = String(STATE.cfg?.diff || 'normal').toLowerCase();

  // base by difficulty
  if(diff === 'easy'){
    STATE.spawnRateBase = 980;
    STATE.junkWBase = 0.24;
  }else if(diff === 'hard'){
    STATE.spawnRateBase = 760;
    STATE.junkWBase = 0.34;
  }else{
    STATE.spawnRateBase = 900;
    STATE.junkWBase = 0.30;
  }

  // initial
  STATE.spawnRateNow = STATE.spawnRateBase;
  STATE.junkWNow = STATE.junkWBase;

  // note: mode-factory uses static spawnRate + weights passed at boot time
  // To keep it simple & robust, we re-create spawner when adaptive changes cross thresholds.
  // But we can also do "soft adaptive" by using small ranges and leaving spawner stable.
  // Here: stable spawner + adaptive changes are applied via periodic "re-seed spawner" only if big drift.

  let lastRate = STATE.spawnRateNow;
  let lastJunk = STATE.junkWNow;

  function buildKinds(junkW){
    const jw = clamp(junkW, 0.12, 0.65);
    return [
      { kind:'good', weight: (1 - jw) },
      { kind:'junk', weight: jw }
    ];
  }

  const controller = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateNow,
    sizeRange: [44, 64],
    kinds: buildKinds(STATE.junkWNow),
    decorateTarget, // ✅ emoji/icon hook
    onHit:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  // adaptive "rebuild" if drift is large (keeps engine simple & avoids race)
  function maybeRebuild(){
    if(STATE.ended || !STATE.running) return;
    if(!STATE.adaptiveOn) return;

    const rate = STATE.spawnRateNow;
    const junk = STATE.junkWNow;

    const rateDrift = Math.abs(rate - lastRate);
    const junkDrift = Math.abs(junk - lastJunk);

    // if drift enough -> rebuild controller
    if(rateDrift >= 120 || junkDrift >= 0.10){
      lastRate = rate;
      lastJunk = junk;

      // rebuild
      try{ controller.stop(); }catch{}
      STATE.controller = spawnBoot({
        mount,
        seed: STATE.cfg.seed, // keep deterministic sequence per run
        spawnRate: rate,
        sizeRange: [44, 64],
        kinds: buildKinds(junk),
        decorateTarget,
        onHit:(t)=>{
          if(STATE.ended) return;
          if(t.kind === 'good') onHitGood(t.groupIndex ?? 0);
          else onHitJunk();
        },
        onExpire:(t)=>{
          if(STATE.ended) return;
          if(t.kind === 'good') onExpireGood();
        }
      });
    }
  }

  // check rebuild occasionally
  STATE.adaptTicker = setInterval(()=>{
    applyAdaptiveTick();
    maybeRebuild();
  }, 650);

  return controller;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
  STATE.cfg = cfg || {};
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

  STATE.stormOn = false;
  STATE.bossOn = false;

  // RNG
  if(isResearch(cfg.runMode)){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // adaptive
  STATE.adaptiveOn = !isResearch(cfg.runMode);

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode || 'play',
    diff: cfg.diff || 'normal',
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    adaptive: STATE.adaptiveOn ? 'on' : 'off'
  });

  emitQuest();
  emitScore();
  startTimer();

  // make spawner
  STATE.controller = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 10);

  // return stop handle (optional)
  return {
    stop(){
      endGame('stop');
    }
  };
}