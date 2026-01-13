// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return performance?.now?.() ?? Date.now(); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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

  // RT (optional research)
  lastSpawnAt: new Map(), // id -> time
  rtGood: [],

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner handle
  engine:null,

  // adaptive knobs (play mode only)
  spawnRateMs: 900,
  junkWeight: 0.30,

  // crosshair lock
  lockPx: 28,
  shootCooldownUntil: 0
};

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
 * Coach helper (rate-limit แบบเบา ๆ)
 * ------------------------------------------------ */
let COACH_TO = 0;
function coach(msg, tag='Coach'){
  const t = Date.now();
  if(t < COACH_TO) return;
  COACH_TO = t + 650; // กันสแปม
  emit('hha:coach', { msg, tag });
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
  emitScore();
}

function resetCombo(){
  STATE.combo = 0;
  emitScore();
}

/* ------------------------------------------------
 * Accuracy
 * - นับ: hitGood + hitJunk + expireGood
 * - accuracy = hitGood / total
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Adaptive (PLAY MODE) — เร่งนิด ๆ + ยุติธรรม
 * - เร่ง spawnRate เมื่อเล่นดี (combo/accuracy)
 * - ลดความโหดเมื่อ miss ถี่
 * ------------------------------------------------ */
function adaptiveTick(){
  if(!STATE.cfg || (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study')) return;

  const acc = accuracy();
  const c = STATE.comboMax;

  // base ตาม diff
  const base = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860);

  // เร่งตามฝีมือ (ค่อย ๆ)
  let rate = base;
  if(acc >= 0.85) rate -= 80;
  if(c >= 8) rate -= 70;
  if(c >= 14) rate -= 60;

  // ผ่อนเมื่อพลาดเยอะ
  if(STATE.miss >= 6) rate += 120;
  if(STATE.miss >= 10) rate += 160;

  STATE.spawnRateMs = clamp(rate, 520, 1200);

  // สัดส่วน junk ปรับเล็กน้อย (ไม่แกว่งมาก)
  let jw = (STATE.cfg.diff === 'hard') ? 0.34 : 0.30;
  if(acc >= 0.88) jw += 0.03;
  if(STATE.miss >= 8) jw -= 0.04;
  STATE.junkWeight = clamp(jw, 0.22, 0.42);

  // สะท้อนลง spawner ถ้ารองรับ (defensive)
  try{
    if(STATE.engine?.setTuning){
      STATE.engine.setTuning({ spawnRate: STATE.spawnRateMs, junkWeight: STATE.junkWeight });
    }
  }catch(_){}
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

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

    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    avgRtGoodMs: (STATE.rtGood.length
      ? Math.round(STATE.rtGood.reduce((a,b)=>a+b,0)/STATE.rtGood.length)
      : null),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });

  // cleanup listeners
  WIN.removeEventListener('hha:shoot', onShootEvent);
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

    // adaptive tick ทุกวินาที (เบามาก)
    adaptiveTick();

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex, t){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  // RT (ถ้ามี id)
  try{
    const id = t?.id;
    if(id && STATE.lastSpawnAt.has(id)){
      const rt = Math.max(0, nowMs() - STATE.lastSpawnAt.get(id));
      STATE.rtGood.push(rt);
      STATE.lastSpawnAt.delete(id);
    }
  }catch(_){}

  addCombo();
  addScore(100 + STATE.combo * 6); // เร่งนิด ๆ ให้สนุกขึ้น

  // goal progress = จำนวนหมู่ที่มีอย่างน้อย 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini = accuracy ≥ 80%
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitQuest();

  // จบเร็วถ้าทำครบทั้ง goal+mini (โหมดเล่น)
  if(STATE.cfg.runMode === 'play' && STATE.goal.done && STATE.mini.done){
    coach('ผ่านภารกิจครบ! ✅', 'Coach');
    endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-55);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(t){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  try{
    const id = t?.id;
    if(id) STATE.lastSpawnAt.delete(id);
  }catch(_){}

  emitQuest();
}

/* ------------------------------------------------
 * Crosshair shooting: hha:shoot
 * - vr-ui.js จะ emit {x,y,lockPx,source}
 * - เราหา target ที่อยู่ใกล้จุดยิงสุดในรัศมี lockPx
 * ------------------------------------------------ */
function dist2(ax,ay,bx,by){
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy;
}

function pickTargetNear(x,y,lockPx){
  const layer = DOC.getElementById('plate-layer');
  if(!layer) return null;
  const nodes = layer.querySelectorAll('.plateTarget');
  const r2 = lockPx*lockPx;

  let best = null;
  let bestD = Infinity;

  nodes.forEach(el=>{
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const d = dist2(x,y,cx,cy);
    if(d <= r2 && d < bestD){
      bestD = d;
      best = el;
    }
  });

  return best;
}

function fireAt(x,y,lockPx){
  const t = Date.now();
  if(t < STATE.shootCooldownUntil) return;
  STATE.shootCooldownUntil = t + 90; // กันยิงรัวเกิน

  const el = pickTargetNear(x,y,lockPx);
  if(!el) return;

  // emulate click (mode-factory จะจับ)
  el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:x, clientY:y }));
}

function onShootEvent(e){
  if(!STATE.running || STATE.ended) return;
  const d = e.detail || {};
  const x = Number(d.x), y = Number(d.y);
  if(!Number.isFinite(x) || !Number.isFinite(y)) return;
  const lockPx = clamp(d.lockPx ?? STATE.lockPx, 12, 80);
  fireAt(x,y,lockPx);
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * - ให้ mode-factory กระจายตำแหน่งให้ (seeded + safezone)
 * - ปรับพารามิเตอร์ตาม diff + adaptive
 * ------------------------------------------------ */
function makeSpawner(mount){
  const baseRate =
    (STATE.cfg.diff === 'hard') ? 720 :
    (STATE.cfg.diff === 'easy') ? 980 : 860;

  STATE.spawnRateMs = baseRate;
  STATE.junkWeight  = (STATE.cfg.diff === 'hard') ? 0.34 : 0.30;

  const spawner = spawnBoot({
    mount,
    cfg: {
      seed: STATE.cfg.seed,
      // สำคัญ: ให้ mode-factory ใช้ boundsHost rect ในการสุ่ม (แก้ “โผล่ที่เดียว”)
      boundsHost: mount,
      spawnHost: mount,

      spawnRate: STATE.spawnRateMs,
      sizeRange: [46, 70],

      // กระจายเต็ม playRect
      spawnAroundCrosshair: false,
      spawnStrategy: 'grid9', // กระจายเสมอ + เด็กเห็นทั่วจอ

      // safezone กัน HUD บัง (mode-factory จะ auto-relax ถ้าพื้นที่เล็ก)
      safezoneSelectors: ['#hud', '#coachCard', '.hha-vrui', '#endOverlay'],

      kinds: [
        { kind:'good',  weight: 1 - STATE.junkWeight },
        { kind:'junk',  weight: STATE.junkWeight }
      ],

      decorateTarget: (t, el)=>{
        // ใส่ group index ให้ good
        if(t.kind === 'good'){
          const gi = (t.groupIndex ?? Math.floor(STATE.rng()*5));
          t.groupIndex = gi;
          el.dataset.group = String(gi);
        }
        // track spawn time for RT
        try{
          if(t.id) STATE.lastSpawnAt.set(t.id, nowMs());
        }catch(_){}
      },

      onHit: (t)=>{
        if(t.kind === 'good'){
          const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
          onHitGood(gi, t);
        }else{
          onHitJunk();
        }
      },
      onExpire: (t)=>{
        if(t.kind === 'good') onExpireGood(t);
      }
    }
  });

  // optional tuning hook (เผื่อ mode-factory รองรับ)
  if(spawner && typeof spawner.setTuning !== 'function'){
    spawner.setTuning = ()=>{};
  }

  return spawner;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
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
  STATE.rtGood = [];
  STATE.lastSpawnAt.clear();

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isStudy ? seededRng(cfg.seed || Date.now()) : Math.random;

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // crosshair lock (อ่านจาก vr-ui config ถ้ามี)
  try{
    STATE.lockPx = Number(WIN.HHA_VRUI_CONFIG?.lockPx ?? 28) || 28;
  }catch(_){}

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // spawner
  STATE.engine = makeSpawner(mount);

  // listen shoot (crosshair)
  WIN.addEventListener('hha:shoot', onShootEvent);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}