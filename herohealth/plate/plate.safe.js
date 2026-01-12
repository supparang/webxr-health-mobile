// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PACK H
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) — LOCK HITTEST (cVR strict)
// ✅ PACK H: aim-lock glow + miss FX + tiny beep
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

// ✅ FIX: percent helper
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

  // spawn
  spawner:null,

  // shoot
  shootBound:false,
  lastLockEl:null,
  missFxAt:0
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
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // stop spawner
  try{ STATE.spawner?.stop?.(); }catch(_){}

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
 * PACK H: tiny beep + miss flash
 * ------------------------------------------------ */
let __HHA_AC = null;
function beep(freq=520, ms=55, gain=0.04){
  try{
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return;
    __HHA_AC = __HHA_AC || new AC();
    const ctx = __HHA_AC;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g);
    g.connect(ctx.destination);

    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

    o.start(t0);
    o.stop(t0 + ms/1000);
  }catch(_){}
}

function flashMiss(){
  const now = Date.now();
  if(now - STATE.missFxAt < 140) return; // rate-limit
  STATE.missFxAt = now;

  DOC.body.classList.add('fx-miss');
  clearTimeout(WIN.__HHA_PLATE_MISS_TO__);
  WIN.__HHA_PLATE_MISS_TO__ = setTimeout(()=>{
    DOC.body.classList.remove('fx-miss');
  }, 120);

  // Particles text (if present)
  try{
    const P = WIN.Particles;
    if(P && typeof P.popText === 'function'){
      P.popText(innerWidth*0.5, innerHeight*0.52, 'MISS', 'fx-missText');
    }
  }catch(_){}

  beep(460, 60, 0.045);
}

/* ------------------------------------------------
 * SHOOT (Crosshair lock) — PACK H
 * ------------------------------------------------ */
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function pickTargetNearPoint(px, py, lockPx){
  const layer = DOC.getElementById('plate-layer');
  if(!layer) return null;
  const els = layer.querySelectorAll('.plateTarget');
  if(!els || !els.length) return null;

  const rLock = (Number(lockPx)||28);
  const lock2 = rLock * rLock;

  let bestEl = null;
  let bestD2 = Infinity;

  for(const el of els){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const d2 = dist2(px, py, cx, cy);
    if(d2 < bestD2){
      bestD2 = d2;
      bestEl = el;
    }
  }
  if(bestEl && bestD2 <= lock2) return bestEl;
  return null;
}

function glowLock(el){
  if(!el) return;
  if(STATE.lastLockEl && STATE.lastLockEl !== el){
    try{ STATE.lastLockEl.classList.remove('aim-lock'); }catch(_){}
  }
  STATE.lastLockEl = el;

  el.classList.add('aim-lock');
  clearTimeout(el.__aimLockTO__);
  el.__aimLockTO__ = setTimeout(()=>{
    try{ el.classList.remove('aim-lock'); }catch(_){}
  }, 120);
}

function bindShootOnce(){
  if(STATE.shootBound) return;
  STATE.shootBound = true;

  WIN.addEventListener('hha:shoot', (e)=>{
    if(!STATE.running || STATE.ended) return;

    const d = e.detail || {};
    const lockPx = Number(d.lockPx ?? 28) || 28;

    // cVR strict: aim from center always
    let aimX = Number(d.x);
    let aimY = Number(d.y);

    if(STATE.cfg?.view === 'cvr' || (DOC.body && DOC.body.classList.contains('view-cvr'))){
      aimX = innerWidth * 0.5;
      aimY = innerHeight * 0.5;
    }else{
      if(!isFinite(aimX)) aimX = innerWidth * 0.5;
      if(!isFinite(aimY)) aimY = innerHeight * 0.5;
    }

    const el = pickTargetNearPoint(aimX, aimY, lockPx);
    if(el){
      glowLock(el);
      try{ el.click(); }catch(_){}
    }else{
      flashMiss();
    }
  }, { passive:true });
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate: STATE.cfg.diff === 'hard' ? 700 : 900,
    expireMs: 1800,

    targetClass: 'plateTarget',
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],

    safeSelectors: ['#hud', '#endOverlay', '.hha-vr-ui', '.vr-ui', '#vrui'],

    assignGroupIndex: ({ kind, rng })=>{
      if(kind !== 'good') return null;
      const rr = (typeof rng === 'function') ? rng() : Math.random();
      return Math.floor(rr * 5);
    },

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? (Math.floor(STATE.rng()*5));
        onHitGood(clamp(gi,0,4));
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

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng((Number(cfg.seed) || Date.now()) >>> 0);
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  bindShootOnce();

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

  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}