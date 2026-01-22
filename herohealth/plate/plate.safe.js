// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION A4-5)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (hooks-ready)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks (future)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ A4-5: FX/SFX/Shake + Coach rate-limit (no spam)
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
 * FX / SFX helpers (safe)
 * ------------------------------------------------ */
function getFx(){
  // particles.js exposes window.Particles optionally
  const P = WIN.Particles || null;
  return {
    pop(x,y,text,cls){
      try{
        if(P?.popText) P.popText(x,y,text,cls);
      }catch{}
    },
    burst(x,y){
      try{
        if(P?.burst) P.burst(x,y);
      }catch{}
    }
  };
}

let __ac = null;
function audioCtx(){
  try{
    if(__ac) return __ac;
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return null;
    __ac = new AC();
    return __ac;
  }catch{ return null; }
}
function beep(freq=440, dur=0.06, gain=0.05){
  try{
    const ac = audioCtx();
    if(!ac) return;
    // iOS/Android often needs gesture; harmless if blocked
    if(ac.state === 'suspended') ac.resume().catch(()=>{});
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }catch{}
}

function vibrate(ms=20){
  try{
    if(navigator?.vibrate) navigator.vibrate(ms);
  }catch{}
}

function shakeBody(){
  try{
    const b = DOC.body;
    if(!b) return;
    b.classList.remove('shake');
    // force reflow
    void b.offsetWidth;
    b.classList.add('shake');
    setTimeout(()=>{ try{ b.classList.remove('shake'); }catch{} }, 220);
  }catch{}
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
  engine:null,

  // fx
  fx:null,

  // coach anti-spam
  coachLastAt:0,
  coachCooldownMs:900
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
 * Coach helper (rate-limit)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', force=false){
  const now = Date.now();
  if(!force && (now - STATE.coachLastAt) < STATE.coachCooldownMs) return;
  STATE.coachLastAt = now;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += v;
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
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
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // stop spawner
  try{ STATE.engine?.stop?.(); }catch{}

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
 * Hit handlers + FX/SFX
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();

  // “เร้าใจ”: คอมโบสูงขึ้น คะแนนเด้งขึ้นเล็กน้อย
  addScore(100 + STATE.combo * 8);

  // FX/SFX
  beep(620 + Math.min(STATE.combo,12)*18, 0.05, 0.045);
  vibrate(10);

  // pop text (ถ้ามี particles.js)
  try{
    const msg = STATE.combo >= 6 ? `COMBO x${STATE.combo}` : `+${100 + STATE.combo*8}`;
    // ไม่มีพิกัดจาก engine => ใช้กลางจอแบบ safe
    STATE.fx?.pop?.(innerWidth*0.5, innerHeight*0.45, msg, 'ok');
    if(STATE.combo % 5 === 0) STATE.fx?.burst?.(innerWidth*0.5, innerHeight*0.45);
  }catch{}

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', true);
      beep(820, 0.07, 0.06);
      beep(980, 0.08, 0.06);
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach', true);
    beep(740, 0.07, 0.055);
  }

  emitQuest();

  // win condition: ถ้า 2 เควสครบ → จบก่อนเวลา (optional “เร็วขึ้น”)
  if(STATE.goal.done && STATE.mini.done){
    coach('ผ่านด่าน! 🎯', 'Coach', true);
    endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // FX/SFX: สั่น + เสียงทึบ
  shakeBody();
  vibrate(25);
  beep(180, 0.08, 0.06);

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // เบา ๆ ไม่รบกวน
  beep(260, 0.04, 0.03);
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // เร่งนิด ๆ: spawn ถี่ขึ้นนิดหน่อย
    spawnRate: STATE.cfg.diff === 'hard' ? 650 : 850,
    sizeRange:[46,66],

    // A4-4 separation (กันซ้อน)
    minSeparationPx: 18,
    spawnTries: 18,
    lifetimeMs: 2600,
    maxAlive: 10,

    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? (Math.floor(STATE.rng()*5));
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

  STATE.cfg = cfg;
  STATE.fx = getFx();

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

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // เวลา: ถ้า “เร้าใจ/รีบขึ้น” แนะนำ 70–80, ถ้าป.5 เก็บครบจริง 90 ก็โอเค
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

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', true);
}