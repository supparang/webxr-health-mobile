// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PATCHED
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (hook-ready; not used here)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ PATCH:
//   - clearInterval before starting timer (no double timer)
//   - harden timeLeft parsing (min 10s, integer)
//   - safe reboot: stop previous spawner if exists
//   - emit initial score/time once on start
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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function toInt(v, def){
  const n = Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.trunc(n);
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

  // spawn engine instance
  engine:null,

  // boot guard
  bootNonce:0
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
 * End game (flush-hardened)
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  if(STATE.timer){
    clearInterval(STATE.timer);
    STATE.timer = null;
  }

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
 * Timer (no double interval)
 * ------------------------------------------------ */
function startTimer(){
  // ✅ prevent stacked timers
  if(STATE.timer){
    clearInterval(STATE.timer);
    STATE.timer = null;
  }

  // emit initial time immediately
  emit('hha:time', { leftSec: STATE.timeLeft });

  const myNonce = STATE.bootNonce;

  STATE.timer = setInterval(()=>{
    // if reboot happened, kill this timer
    if(myNonce !== STATE.bootNonce){
      clearInterval(STATE.timer);
      STATE.timer = null;
      return;
    }

    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft = Math.max(0, (toInt(STATE.timeLeft, 0) - 1));
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  if(STATE.ended) return;

  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress
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
  if(STATE.ended) return;

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  // optional: keep mini accuracy live on junk hit too
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  if(STATE.ended) return;

  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // update mini accuracy too
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.cfg.diff === 'hard' ? 700 : 900,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],
    onHit:(t)=>{
      if(STATE.ended) return;

      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(clamp(gi, 0, 4));
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot (safe reboot)
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // ✅ safe reboot: stop old spawner if exists
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function'){
      STATE.engine.stop();
    }else if(STATE.engine && typeof STATE.engine.destroy === 'function'){
      STATE.engine.destroy();
    }
  }catch(err){
    console.warn('[PlateVR] stop old engine failed', err);
  }
  STATE.engine = null;

  // ✅ clear old timer
  if(STATE.timer){
    clearInterval(STATE.timer);
    STATE.timer = null;
  }

  // bump nonce to invalidate old timers
  STATE.bootNonce++;

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

  // reset quests
  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const runMode = String(cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(toInt(cfg.seed, Date.now()) || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // ✅ Hardened timeLeft:
  // prefer cfg.durationPlannedSec; fallback to ?time passes through boot.js anyway
  const rawTime = (cfg.durationPlannedSec != null) ? cfg.durationPlannedSec : 90;
  STATE.timeLeft = clamp(toInt(rawTime, 90), 10, 999);

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: String(cfg.diff || 'normal').toLowerCase(),
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial UI state
  emitQuest();
  emitScore();
  startTimer();

  // start spawner LAST (after timer/UI ready)
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}