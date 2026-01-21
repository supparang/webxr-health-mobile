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
// ✅ Supports: Boss/Storm hooks (placeholders)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses /vr/mode-factory.js (DOM target spawner)
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

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function now(){ return Date.now(); }

/* ------------------------------------------------
 * Content pools (ทำให้ไม่น่าเบื่อ)
 * ------------------------------------------------ */
// 5 หมู่ (ปรับ emoji ได้ตามต้องการ)
const GROUP_POOLS = [
  { name:'ข้าว-แป้ง',  icons:['🍚','🍞','🥖','🍜','🥟','🥔','🥨'] },
  { name:'ผัก',        icons:['🥦','🥬','🥕','🍅','🥒','🌽','🫑'] },
  { name:'ผลไม้',      icons:['🍎','🍌','🍊','🍇','🍉','🍍','🥭'] },
  { name:'โปรตีน',     icons:['🥚','🐟','🍗','🥩','🫘','🍤','🥜'] },
  { name:'นม',         icons:['🥛','🧀','🍶','🥣'] },
];

const JUNK_POOL = ['🍩','🍟','🍔','🍕','🍫','🧋','🍭','🥤'];

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
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำต่อเนื่อง',
    sub:'รักษาความแม่น ≥ 80% ต่อเนื่อง 8 วินาที',
    cur:0,          // current accuracy (0-100)
    target:80,
    done:false,
    streakSec:0,    // seconds maintaining >= target
    streakNeed:8
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner
  spawner:null,

  // adaptive knobs (play mode only)
  spawnRate:900,
  ttlMs:2200,
  maxAlive:8,

  // rate-limit coach
  lastCoachAt:0,

  // track last action (for fun/adaptive)
  lastHitAt:0,
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
      sub: `${STATE.mini.sub} • ตอนนี้ ${STATE.mini.streakSec}/${STATE.mini.streakNeed}s`,
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
function coach(msg, tag='Coach', minGapMs=900){
  const t = now();
  if(t - STATE.lastCoachAt < minGapMs) return;
  STATE.lastCoachAt = t;
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

function accPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  try{ STATE.spawner?.destroy?.(); }catch{}
  STATE.spawner = null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct(),

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

    // mini streak update (ทุกวินาที)
    if(!STATE.mini.done){
      const a = accPct();
      STATE.mini.cur = a;
      if(a >= STATE.mini.target){
        STATE.mini.streakSec++;
        if(STATE.mini.streakSec >= STATE.mini.streakNeed){
          STATE.mini.done = true;
          coach('สุดยอด! ความแม่นยำต่อเนื่องผ่านแล้ว ✅', 'Coach');
        }
      }else{
        // reset streak (แต่ให้ผ่อนนิดเดียว)
        STATE.mini.streakSec = Math.max(0, STATE.mini.streakSec - 2);
      }
      emitQuest();
    }

    // simple adaptive tick (play only)
    if(isAdaptive()){
      adaptiveTick();
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Adaptive control (เล่นสนุกขึ้นในโหมด play)
 * ------------------------------------------------ */
function isResearch(){
  const rm = (STATE.cfg?.runMode || 'play').toLowerCase();
  return (rm === 'research' || rm === 'study');
}
function isAdaptive(){ return !isResearch(); }

function adaptiveTick(){
  // ปรับความเร็ว spawn/ttl ตามผลงานแบบนุ่ม ๆ
  const a = accPct();
  const pressure = clamp(STATE.combo / 12, 0, 1);      // เล่นดีขึ้น -> เร่ง
  const sloppy   = clamp((70 - a) / 40, 0, 1);         // แม่นต่ำ -> ผ่อน
  const missP    = clamp(STATE.miss / 10, 0, 1);

  // spawnRate ต่ำ = เร็วขึ้น
  const base = (STATE.cfg?.diff === 'hard') ? 720 : (STATE.cfg?.diff === 'easy') ? 980 : 880;
  const faster = base - (pressure * 180);
  const slower = base + (sloppy * 140) + (missP * 120);

  STATE.spawnRate = clamp((faster + slower) / 2, 520, 1200);

  // ttl ปรับเล็กน้อย
  const baseTtl = (STATE.cfg?.diff === 'hard') ? 2000 : 2200;
  STATE.ttlMs = clamp(baseTtl - pressure*240 + sloppy*180, 1500, 2600);

  // maxAlive ปรับตามเวลา (ท้ายเกมเร่ง)
  const late = clamp((90 - STATE.timeLeft)/60, 0, 1);
  STATE.maxAlive = clamp(Math.round(8 + late*3 - sloppy*2), 6, 11);

  // apply to spawner
  try{
    STATE.spawner?.setSpawnRate?.(STATE.spawnRate);
  }catch{}
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }else{
      // ช่วยบอกว่าขาดหมู่ไหน
      const missing = [];
      for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missing.push(GROUP_POOLS[i].name);
      if(missing.length && (STATE.goal.cur === 3 || STATE.goal.cur === 4)){
        coach(`ใกล้ครบแล้ว! ยังขาด: ${missing.join(' • ')}`, 'Coach', 1200);
      }
    }
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // feedback
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 800);

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Kinds builder (หลากหลาย)
 * ------------------------------------------------ */
function buildKinds(){
  // สร้าง good 5 หมู่ (weight รวม ~0.72) + junk (0.28)
  const goods = [];
  for(let gi=0; gi<5; gi++){
    const pool = GROUP_POOLS[gi];
    goods.push({
      kind:'good',
      weight: 0.14,              // 0.14 * 5 = 0.70
      groupIndex: gi,
      // icon แบบสุ่มใน pool ตอน spawn
      icon: null,
      poolIcons: pool.icons
    });
  }
  const junk = { kind:'junk', weight:0.30, poolIcons: JUNK_POOL };
  return [...goods, junk];
}

function pickIconForKind(k, rng){
  const arr = k.poolIcons || null;
  if(!arr || !arr.length) return (k.kind === 'junk') ? '🍩' : '🥗';
  return arr[Math.floor(rng()*arr.length)];
}

/* ------------------------------------------------
 * Spawn logic (via mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const kinds = buildKinds();

  // research: spawn stable
  const baseRate = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy') ? 980 : 880;
  STATE.spawnRate = baseRate;
  STATE.ttlMs = (STATE.cfg.diff === 'hard') ? 2000 : 2200;
  STATE.maxAlive = (STATE.cfg.diff === 'hard') ? 9 : 8;

  const margins = {
    // กัน HUD ด้านบน (คุณปรับได้ตาม plate-vr.css/hud)
    top: 140,
    right: 16,
    bottom: 18,
    left: 16
  };

  // pattern hook: ถ้าจะเสียบ AI Pattern Generator ภายหลัง
  const patternNext = null; // ปิดไว้ก่อน

  // แปลง kinds ให้มี icon จริงตอน spawn
  const decoratedKinds = kinds.map(k => {
    return Object.assign({}, k, {
      icon: pickIconForKind(k, STATE.rng),
      ttlMs: (k.kind === 'junk') ? Math.round(STATE.ttlMs * 0.92) : STATE.ttlMs
    });
  });

  const sp = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRate,
    sizeRange:[44, 66],
    ttlMs: STATE.ttlMs,
    maxAlive: STATE.maxAlive,
    margins,
    kinds: decoratedKinds,
    patternNext,

    onHit:(t)=>{
      STATE.lastHitAt = now();
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  return sp;
}

/* ------------------------------------------------
 * Prime spawns (แก้ “ไม่โผล่/โผล่แว้บ”)
 * ------------------------------------------------ */
function primeCoach(){
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);
  // tip สั้น ๆ ให้เด็ก ป.5
  setTimeout(()=>coach('เล็งกลางจอแล้ว “แตะ/ยิง” ที่อาหารได้เลย 🎯', 'Coach', 0), 900);
}

function primeSpawnBurst(){
  // ทำให้เห็นเป้าทันทีหลังเข้าเกม
  // (mode-factory จะเริ่ม schedule เอง แต่ burst ช่วย “ไม่ดูโล่ง”)
  // ใช้วิธีเพิ่ม maxAlive ชั่วคราว
  try{
    if(STATE.spawner && typeof STATE.spawner.setSpawnRate === 'function'){
      STATE.spawner.setSpawnRate(Math.max(420, Math.round(STATE.spawnRate*0.7)));
      setTimeout(()=>STATE.spawner?.setSpawnRate?.(STATE.spawnRate), 1200);
    }
  }catch{}
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
  STATE.mini.streakSec = 0;

  STATE.lastCoachAt = 0;
  STATE.lastHitAt = 0;

  // RNG
  if((cfg.runMode || '').toLowerCase() === 'research' || (cfg.runMode || '').toLowerCase() === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // เวลา: ถ้าไม่ได้ส่งมา ให้ default 90 (ตามที่คุณถามว่า 90 ดีไหม)
  // เหตุผล: เด็ก ป.5 มีจังหวะเล็ง/อ่านภารกิจ + เก็บครบ 5 หมู่ (5 ขั้น) + mini streak 8s
  const planned = Number(cfg.durationPlannedSec ?? cfg.time ?? 90) || 90;
  STATE.timeLeft = clamp(planned, 30, 180);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();

  // start spawner first (so targets can appear early)
  STATE.spawner = makeSpawner(mount);

  // prime
  primeCoach();
  primeSpawnBurst();

  // timer
  startTimer();
}