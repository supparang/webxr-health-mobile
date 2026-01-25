// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive (Prediction Director) ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory (spawn) + decorateTarget (emoji)
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

  // spawner controller
  spawner:null,

  // prediction director
  dirTimer:null,
  lastDirAt:0,
  dirLevel:0, // -2 .. +3
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
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopAll(){
  clearInterval(STATE.timer);
  clearInterval(STATE.dirTimer);
  STATE.timer = null;
  STATE.dirTimer = null;
  if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
    try{ STATE.spawner.stop(); }catch{}
  }
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  stopAll();

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
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: count how many groups filled (>=1)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Target decorate (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // t.groupIndex: 0..4 => groupId: 1..5
  const groupId = (Number(t.groupIndex)||0) + 1;

  // clear & build
  el.innerHTML = '';

  const span = document.createElement('span');
  span.className = 'fg-emoji';

  if(t.kind === 'junk'){
    span.textContent = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', 'ของหวาน/ทอด');
  }else{
    span.textContent = emojiForGroup(t.rng, groupId);
    el.dataset.group = `g${groupId}`;
    // labelTH: หมู่ 1..5
    el.setAttribute('aria-label', labelForGroup(groupId));
  }

  el.appendChild(span);
}

/* ------------------------------------------------
 * Prediction Director (rule-based AI) — PLAY ONLY
 * ------------------------------------------------ */
function startDirectorIfPlay(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study') return;

  // base per diff
  const base = {
    spawnRate: (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860),
    ttlGoodMs: 2100,
    ttlJunkMs: 1700,
    junkW: (STATE.cfg.diff === 'easy') ? 0.24 : (STATE.cfg.diff === 'hard' ? 0.34 : 0.30),
  };

  function applyLevel(level){
    // level: -2..+3 (higher = harder)
    const lv = clamp(level, -2, 3);
    const spawnRate = clamp(base.spawnRate - (lv * 70), 420, 1600);
    const ttlGoodMs = clamp(base.ttlGoodMs - (lv * 120), 900, 3500);
    const ttlJunkMs = clamp(base.ttlJunkMs - (lv * 90), 700, 3000);
    const junkW = clamp(base.junkW + (lv * 0.04), 0.18, 0.55);
    const goodW = 1 - junkW;

    if(STATE.spawner?.setParams){
      STATE.spawner.setParams({
        spawnRate,
        ttlGoodMs,
        ttlJunkMs,
        kinds: [
          { kind:'good', weight: goodW },
          { kind:'junk', weight: junkW }
        ]
      });
    }
  }

  // start at 0
  STATE.dirLevel = 0;
  applyLevel(STATE.dirLevel);

  STATE.dirTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    // signals
    const acc = accuracy();                 // 0..1
    const miss = STATE.miss;                // absolute
    const combo = STATE.combo;              // current combo
    const tleft = STATE.timeLeft || 0;

    // quick heuristic:
    // - if acc very high and combo decent => harder
    // - if miss rising and acc low => easier
    let next = STATE.dirLevel;

    if(acc >= 0.90 && combo >= 4) next += 1;
    else if(acc <= 0.72 && miss >= 3) next -= 1;

    // also near end: small push
    if(tleft <= 18 && acc >= 0.82) next += 1;

    next = clamp(next, -2, 3);
    if(next !== STATE.dirLevel){
      STATE.dirLevel = next;
      applyLevel(STATE.dirLevel);

      // tiny coach hint (rate-limited)
      if(STATE.dirLevel >= 2) coach('เริ่มยากขึ้นแล้วนะ! โฟกัสให้ดี 👀');
      else if(STATE.dirLevel <= -1) coach('ค่อย ๆ ทำได้ ไม่เป็นไร 🙂');
    }
  }, 2200);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  const spawnRate = (diff === 'hard') ? 720 : (diff === 'easy' ? 980 : 860);

  // weights
  const junkW = (diff === 'easy') ? 0.24 : (diff === 'hard' ? 0.34 : 0.30);
  const goodW = 1 - junkW;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[48,72],
    ttlGoodMs: 2100,
    ttlJunkMs: 1700,
    kinds:[
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget, // ✅ emoji/icon
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

  // reset state
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

  // RNG: deterministic only in research/study
  const rm = (cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
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
  emitScore();
  startTimer();

  // spawn controller
  STATE.spawner = makeSpawner(mount);

  // AI Prediction Director (PLAY only)
  startDirectorIfPlay();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}