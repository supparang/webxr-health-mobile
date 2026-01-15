// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (เร่งนิด ๆ แบบยุติธรรม)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks (อนาคต)
// ✅ Works with vr-ui.js crosshair + tap-to-shoot (hha:shoot) via mode-factory
// ✅ SPAWN SAFE: avoid HUD overlap + avoid edges
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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // ✅ miss = hitJunk + expireGood (Plate ไม่มี shield ในแพ็คนี้)
  miss:0,

  timeLeft:0,
  timer:null,

  // 5 food groups progress
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

  // cfg/mode
  cfg:null,
  rng:Math.random,

  // spawner engine (mode-factory)
  engine:null,

  // adaptive director (play only)
  adaptiveOn:false,
  baseSpawnMs:900,
  curSpawnMs:900,
  lastAdaptAt:0
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
  STATE.score += (Number(v)||0);
  emitScore();
}

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}

function resetCombo(){
  STATE.combo = 0;
  emitScore();
}

/* ------------------------------------------------
 * Accuracy (good vs total interactions)
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return clamp(Math.round(accuracy()*100), 0, 100);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // stop spawner if exposed
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch(_){}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: round2(accuracy()*100),

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
 * Adaptive director (play only): “เร่งนิด ๆ”
 * - ถ้าแม่น + คอมโบดี -> spawn ถี่ขึ้นเล็กน้อย
 * - ถ้าพลาดติด ๆ -> ผ่อนลงนิด (ไม่ลงโทษเด็ก)
 * - Research/Study: ปิด adaptive เพื่อ deterministic
 * ------------------------------------------------ */
function computeBaseSpawnMs(diff){
  // base ตาม diff (ยืดหยุ่น)
  if(diff === 'hard') return 780;
  if(diff === 'easy') return 980;
  return 880; // normal
}

function adaptTick(){
  if(!STATE.adaptiveOn || !STATE.running || STATE.ended) return;

  const t = now();
  if(t - STATE.lastAdaptAt < 1400) return; // rate-limit
  STATE.lastAdaptAt = t;

  const acc = accuracyPct();         // 0..100
  const combo = STATE.combo;         // current streak
  const miss = STATE.miss;

  // เป้าหมาย: ให้เด็ก “รู้สึกไหล” แต่ไม่ล้น
  // good: acc>=85 และ combo>=6 => เร่ง ~5-10%
  // warn: acc<70 หรือ missเพิ่มเร็ว => ผ่อน ~6-12%

  let target = STATE.curSpawnMs;

  if(acc >= 88 && combo >= 7){
    target = STATE.curSpawnMs * 0.92; // เร่ง
  }else if(acc >= 82 && combo >= 4){
    target = STATE.curSpawnMs * 0.96;
  }else if(acc < 68 && miss >= 3){
    target = STATE.curSpawnMs * 1.08; // ผ่อน
  }else if(acc < 75 && miss >= 2){
    target = STATE.curSpawnMs * 1.04;
  }else{
    // ค่อย ๆ กลับเข้า base
    target = (STATE.curSpawnMs * 0.8) + (STATE.baseSpawnMs * 0.2);
  }

  // clamp ให้ไม่สุดโต่ง
  const minMs = Math.max(520, STATE.baseSpawnMs * 0.70);
  const maxMs = Math.min(1400, STATE.baseSpawnMs * 1.35);
  target = clamp(target, minMs, maxMs);

  // apply ถ้าเปลี่ยนชัดพอ
  if(Math.abs(target - STATE.curSpawnMs) >= 18){
    STATE.curSpawnMs = target;
    try{
      // mode-factory อาจมี API อัปเดต spawnRate; ถ้าไม่มีจะไม่พัง
      if(STATE.engine && typeof STATE.engine.setSpawnRate === 'function'){
        STATE.engine.setSpawnRate(Math.round(STATE.curSpawnMs));
      }else if(STATE.engine && typeof STATE.engine.update === 'function'){
        STATE.engine.update({ spawnRate: Math.round(STATE.curSpawnMs) });
      }
    }catch(_){}
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6); // ✅ เร่งนิด ๆ (คอมโบมีความหมาย)

  // goal progress: นับว่าครบ 5 หมู่หรือยัง (มีอย่างน้อย 1 ในแต่ละหมู่)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy >= 80%
  const accPct = accuracy()*100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
  adaptTick();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;          // ✅ miss ตามนิยาม Plate
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  adaptTick();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;          // ✅ miss ตามนิยาม Plate
  resetCombo();
  adaptTick();
}

/* ------------------------------------------------
 * Spawn: SAFE layout helper
 * - กันเป้าโดน HUD/ขอบจอ
 * - โยน safezone selector ให้ mode-factory (ถ้ารองรับ) + fallback inset
 * ------------------------------------------------ */
function getSafeInsets(){
  // inset พื้นฐาน (กันชิดขอบ + safe-area)
  const sat = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px','')) || 0;
  const sar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sar').replace('px','')) || 0;
  const sab = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sab').replace('px','')) || 0;
  const sal = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sal').replace('px','')) || 0;

  // กันชิดขอบเพิ่ม (เป้าไม่ไปติดมุม)
  const edge = 14;

  // กันแถบ HUD ด้านบน/ขวา (เผื่อ notch + ชิป)
  const hudTop = 132;  // ปรับตาม layout HUD จริง
  const hudRight = 8;

  return {
    top: hudTop + sat + edge,
    right: hudRight + sar + edge,
    bottom: sab + edge,
    left: sal + edge
  };
}

/* ------------------------------------------------
 * Spawner creation
 * ------------------------------------------------ */
function makeSpawner(mount){
  const cfg = STATE.cfg || {};
  const diff = (cfg.diff || 'normal').toLowerCase();

  STATE.baseSpawnMs = computeBaseSpawnMs(diff);
  STATE.curSpawnMs  = STATE.baseSpawnMs;

  const insets = getSafeInsets();

  // weights: เด็ก ป.5 ควร good เยอะกว่า
  const junkW = (diff === 'hard') ? 0.34 : (diff === 'easy' ? 0.22 : 0.28);
  const goodW = 1 - junkW;

  // NOTE: mode-factory ในโปรเจกต์ HHA รองรับ SAFEZONE/EDGE-FIX อยู่แล้ว
  // เราส่งทั้ง inset + selector เพื่อกัน HUD บัง (ถ้ารองรับ)
  return spawnBoot({
    mount,

    // deterministic spawn if seed given (mode-factory จะใช้ cfg.seed)
    seed: cfg.seed,

    // ✅ เร่งนิด ๆ ผ่าน adaptive; base เริ่มตรงนี้
    spawnRate: Math.round(STATE.curSpawnMs),

    // size: ให้พอดีพื้นที่และไม่ใหญ่เกิน (ภาพที่ส่งก่อนหน้า “ใหญ่ไป”)
    sizeRange: diff === 'easy' ? [46, 66] : (diff === 'hard' ? [40, 60] : [44, 64]),

    // ✅ กันชิดขอบ + กันชน HUD
    // ถ้า mode-factory รองรับ: playRectInset / safezoneSelector จะช่วยมาก
    playRectInset: insets,
    safezoneSelector: '#hud, #coachCard, #endOverlay',

    // spawn style (ถ้ารองรับ): กระจายสม่ำเสมอขึ้น ไม่กองจุดเดียว
    spawnStrategy: 'grid9',
    spawnAroundCrosshair: false,

    // distribution
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],

    // callbacks
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? (t.groupIndex|0) : Math.floor(STATE.rng()*5);
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

  // cfg normalize
  cfg = cfg || {};
  cfg.runMode = (cfg.runMode || 'play').toLowerCase();
  cfg.diff = (cfg.diff || 'normal').toLowerCase();

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

  // RNG
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');
  if(isStudy){
    STATE.rng = seededRng(cfg.seed || Date.now());
    STATE.adaptiveOn = false; // ✅ deterministic
  }else{
    STATE.rng = Math.random;
    STATE.adaptiveOn = true;  // ✅ play: adaptive ON
  }

  // time
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

  // spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}