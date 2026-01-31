// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (lite: speed/weights by diff + gentle coach)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses: mode-factory.js (spawn engine)
// ✅ Uses: food5-th.js (STABLE Thai 5 groups mapping + JUNK emojis)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks (light toggle)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ On end: stop spawner (no "flash" targets)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, emojiForJunk, labelForGroup, descForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

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
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function qsEl(id){ return DOC.getElementById(id); }

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // MISS definition (consistent rule style):
  // miss = good expired + junk hit
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่): index 0-4 => group 1..5
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

  // spawn engine handle
  spawner:null,

  // boss/storm (hooks)
  bossOn:false,
  stormOn:false,
};

/* ------------------------------------------------
 * Coach helper (rate-lite)
 * ------------------------------------------------ */
let __coachTo = 0;
function coach(msg, tag='Coach'){
  clearTimeout(__coachTo);
  emit('hha:coach', { msg, tag });
  // tiny cooldown to avoid spam in play
  __coachTo = setTimeout(()=>{}, 120);
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
      target: STATE.goal.target,
      done: STATE.goal.done
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
 * Accuracy (good / (good + junk + expired good))
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Boss / Storm hooks (lite UI toggles)
 * ------------------------------------------------ */
function setBoss(on){
  STATE.bossOn = !!on;
  const fx = qsEl('bossFx');
  if(!fx) return;
  fx.classList.toggle('boss-on', STATE.bossOn);
}

function setStorm(on){
  STATE.stormOn = !!on;
  const fx = qsEl('stormFx');
  if(!fx) return;
  fx.classList.toggle('storm-on', STATE.stormOn);
}

/* ------------------------------------------------
 * End game (stop spawner)
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
    try{ STATE.spawner.stop(); }catch{}
  }
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner();

  setBoss(false);
  setStorm(false);

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
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress (count unique groups collected)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      // fun hook: tiny boss burst when goal done (play only)
      if(STATE.cfg.runMode === 'play'){
        setBoss(true);
        setTimeout(()=>setBoss(false), 650);
      }
    }
  }

  // mini (accuracy)
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();

  // finish early if both done (optional)
  if(STATE.goal.done && STATE.mini.done){
    // reward: end early only in play (research keeps full time)
    if(STATE.cfg.runMode === 'play'){
      coach('ผ่านด่าน! เก่งมาก ✨', 'System');
      setTimeout(()=>endGame('cleared'), 380);
    }
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // storm flash hook
  if(STATE.cfg.runMode === 'play'){
    setStorm(true);
    setTimeout(()=>setStorm(false), 240);
  }

  // nudge
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Adaptive (lite)
 * - mode-factory currently takes fixed spawnRate/weights
 * - so adaptive here = choose "base params" by runMode/diff
 *   (research/study: fixed, play: faster & a bit more junk on hard)
 * ------------------------------------------------ */
function buildSpawnParams(cfg){
  const diff = (cfg.diff || 'normal').toLowerCase();
  const play = cfg.runMode === 'play';

  // base by difficulty
  let spawnRate = 900;
  let goodW = 0.72;
  let junkW = 0.28;

  if(diff === 'easy'){
    spawnRate = 980;
    goodW = 0.78; junkW = 0.22;
  }else if(diff === 'hard'){
    spawnRate = 760;
    goodW = 0.66; junkW = 0.34;
  }else{
    spawnRate = 860;
    goodW = 0.72; junkW = 0.28;
  }

  // play mode = slightly more intense (fun)
  // research/study = fixed + calmer
  if(play){
    spawnRate = Math.round(spawnRate * 0.95);
  }else{
    spawnRate = Math.round(spawnRate * 1.05);
    goodW = Math.min(0.80, goodW + 0.03);
    junkW = 1 - goodW;
  }

  return {
    spawnRate,
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW },
    ],
  };
}

/* ------------------------------------------------
 * decorateTarget (emoji per group)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  const kind = target.kind || 'good';
  const rng = target.rng || STATE.rng;

  if(kind === 'junk'){
    el.textContent = emojiForJunk(rng);
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH}`);
    el.title = `${JUNK.labelTH} • ${JUNK.descTH}`;
    return;
  }

  // good: groupIndex 0..4 => groupId 1..5
  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  const emoji = emojiForGroup(rng, groupId);

  el.textContent = emoji;
  el.dataset.group = String(groupId);

  const label = labelForGroup(groupId);
  const desc = descForGroup(groupId);

  el.setAttribute('aria-label', `${label}`);
  el.title = `${label} • ${desc}`;
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const { spawnRate, kinds } = buildSpawnParams(STATE.cfg);

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds,

    decorateTarget, // ✅ NEW: customize UI

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        // IMPORTANT: use target's own groupIndex (deterministic)
        const gi = t.groupIndex ?? 0;
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // normalize cfg
  const runMode = (cfg?.runMode || cfg?.run || 'play').toLowerCase();
  const diff = (cfg?.diff || 'normal').toLowerCase();

  STATE.cfg = {
    ...cfg,
    runMode,
    diff,
    seed: Number(cfg?.seed || Date.now()) || Date.now(),
    durationPlannedSec: Number(cfg?.durationPlannedSec || 90) || 90
  };

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

  // RNG: research/study deterministic; play random
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed);
  }else{
    STATE.rng = Math.random;
  }

  // timer
  STATE.timeLeft = clamp(STATE.cfg.durationPlannedSec, 10, 999);

  // emit start
  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial quest + time + score
  emitQuest();
  emitScore();
  startTimer();

  // create spawner
  stopSpawner();
  STATE.spawner = makeSpawner(mount);

  // opening coach
  if(runMode === 'research' || runMode === 'study'){
    coach('โหมดวิจัย: สุ่มแบบกำหนดได้ (seeded) ✅', 'System');
  }else{
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  }
}