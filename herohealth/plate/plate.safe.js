// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Uses mode-factory.js boot() + decorateTarget()
// ✅ Fix: spawn logic ensures 5 groups appear (missing-first)
// ✅ End game: stop spawner + stop timer (no flicker)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { emojiForGroup, pickEmoji, JUNK } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

  // spawn engine
  engine:null,

  // adaptive knobs (play only)
  adapt:{
    junkWeight:0.30,   // will rise slightly if player too accurate
    spawnRate:900,
    ttlGood:2100,
    ttlJunk:1700
  }
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
function pushScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += v;
  pushScore();
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
 * Adaptive (play mode)
 * ------------------------------------------------ */
function applyAdaptiveIfPlay(){
  if(!STATE.cfg) return;
  if(STATE.cfg.runMode !== 'play') return;

  // Simple adaptive: if player too accurate -> raise junk slightly + speed up a bit
  const acc = accuracy();
  if(acc >= 0.92){
    STATE.adapt.junkWeight = clamp(STATE.adapt.junkWeight + 0.02, 0.30, 0.45);
    STATE.adapt.spawnRate = clamp(STATE.adapt.spawnRate - 20, 650, 900);
  }else if(acc <= 0.75){
    STATE.adapt.junkWeight = clamp(STATE.adapt.junkWeight - 0.02, 0.18, 0.35);
    STATE.adapt.spawnRate = clamp(STATE.adapt.spawnRate + 20, 700, 1000);
  }
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
  STATE.timer = null;

  // ✅ important: stop spawner to prevent "flicker targets"
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
 * Group selection (FIX: ensure 5 groups appear)
 * ------------------------------------------------ */
function missingGroups0to4(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(i);
  }
  return miss;
}

function pickGroupIndexForGood(rng){
  // 1) Before goal done: force missing groups first (so player can finish 5/5)
  if(!STATE.goal.done){
    const miss = missingGroups0to4();
    if(miss.length){
      return miss[Math.floor(rng() * miss.length)];
    }
  }

  // 2) After goal done: distribute fairly across 5 groups
  // prefer lower-count groups a bit
  const counts = STATE.g.slice(0,5);
  const min = Math.min(...counts);
  const low = [];
  for(let i=0;i<5;i++) if(counts[i] === min) low.push(i);
  if(low.length) return low[Math.floor(rng() * low.length)];

  return Math.floor(rng()*5);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex0to4){
  STATE.hitGood++;
  STATE.g[groupIndex0to4]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = number of groups that have at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini quest (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  applyAdaptiveIfPlay();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  applyAdaptiveIfPlay();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  applyAdaptiveIfPlay();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji + data attrs)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // t.kind: good | junk
  // t.groupIndex: 0..4
  if(!el) return;

  if(t.kind === 'junk'){
    el.textContent = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.title = 'ขยะอาหาร';
    return;
  }

  const groupId = (t.groupIndex + 1); // 1..5
  el.textContent = emojiForGroup(t.rng, groupId);
  el.dataset.group = String(groupId); // 1..5
  el.title = `หมู่ ${groupId}`;
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const isPlay = STATE.cfg.runMode === 'play';

  const spawnRate = isPlay ? STATE.adapt.spawnRate : (STATE.cfg.diff === 'hard' ? 700 : 900);
  const junkW = isPlay ? STATE.adapt.junkWeight : 0.30;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],

    kinds:[
      { kind:'good', weight:(1 - junkW) },
      { kind:'junk', weight:junkW }
    ],

    decorateTarget,

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good'){
        // ✅ pick group index smartly so 5 groups can be completed
        const gi = pickGroupIndexForGood(STATE.rng);
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

  // stop previous if any
  stopSpawner();
  clearInterval(STATE.timer);

  STATE.cfg = cfg;

  // reset
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

  // RNG rules
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng((cfg.seed || Date.now()) >>> 0);
  }else{
    STATE.rng = Math.random;
  }

  // adaptive rules
  STATE.adapt = {
    junkWeight: 0.30,
    spawnRate: (cfg.diff === 'hard') ? 780 : 900,
    ttlGood: 2100,
    ttlJunk: 1700
  };
  if(cfg.runMode !== 'play'){
    // adaptive OFF in research/study
    STATE.adapt.junkWeight = 0.30;
    STATE.adapt.spawnRate = (cfg.diff === 'hard') ? 700 : 900;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial UI
  emitQuest();
  pushScore();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}