// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// PATCH A3
// ✅ Uses ../vr/mode-factory.js export boot
// ✅ Applies cfg.speed => spawn faster / TTL shorter / size tweak
// ✅ Emoji pack for 5 groups + junk (less boring)
// ✅ Supports hha:shoot via mode-factory

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

/* ------------------------------------------------
 * Emoji Pack (Plate)
 * 5 หมู่: [ข้าวแป้ง, ผัก, โปรตีน, นม, ผลไม้]
 * + junk: ของหวาน/ทอด/น้ำอัดลม
------------------------------------------------- */
const PLATE_EMOJI = {
  g0: ['🍚','🍞','🥔','🍜','🍙'],      // ข้าว-แป้ง
  g1: ['🥦','🥕','🥬','🍅','🥒'],      // ผัก
  g2: ['🍗','🥚','🐟','🫘','🥩'],      // โปรตีน
  g3: ['🥛','🧀','🥣','🍦'],          // นม (มีไอศกรีมปนได้นิด—แต่ engine จะไม่ถือเป็น junk)
  g4: ['🍌','🍎','🍇','🍉','🍊'],      // ผลไม้
  junk: ['🍟','🍔','🍩','🍰','🥤']     // junk
};

function pick(arr, rng){
  if(!arr || !arr.length) return '❓';
  return arr[Math.floor(rng()*arr.length)];
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
  g:[0,0,0,0,0],

  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอย่างน้อย 1 ชิ้นในแต่ละหมู่',
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

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

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
    g5: STATE.g[4],

    // passthrough (ช่วย logger)
    seed: STATE.cfg?.seed,
    diff: STATE.cfg?.diff,
    runMode: STATE.cfg?.runMode,
    durationPlannedSec: STATE.cfg?.durationPlannedSec
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
 * Spawn logic (speed applied)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const speed = clamp(STATE.cfg?.speed ?? 1.0, 0.85, 1.35);

  // “เร่งนิด ๆ”: spawn ถี่ขึ้น, TTL สั้นลงนิด, เป้าเล็กลงนิด
  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const spawnRate = clamp(Math.round(baseRate / speed), 220, 2500);

  const baseTtl = 1650;
  const ttlMs = clamp(Math.round(baseTtl / (0.92 + (speed-1)*0.7)), 650, 3500);

  const s0 = 52, s1 = 76;
  const sizeRange = [
    clamp(Math.round(s0 / (0.98 + (speed-1)*0.25)), 34, 90),
    clamp(Math.round(s1 / (0.98 + (speed-1)*0.25)), 44, 110),
  ];

  // weight: good 70%, junk 30% (คงเดิม)
  const kinds = [
    // good: สุ่ม groupIndex 0-4 ตอนเกิด เพื่อให้หมู่หลากหลายจริง
    { kind:'good', weight:0.70 },
    { kind:'junk', weight:0.30 },
  ];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    ttlMs,
    sizeRange,
    kinds,

    labeler:(t)=>{
      if(t.kind === 'junk') return pick(PLATE_EMOJI.junk, STATE.rng);
      const gi = (t.groupIndex ?? 0);
      const key = `g${gi}`;
      return pick(PLATE_EMOJI[key] || PLATE_EMOJI.g1, STATE.rng);
    },

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null)
          ? t.groupIndex
          : Math.floor(STATE.rng()*5);
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
    durationPlannedSec: STATE.timeLeft,
    speed: cfg.speed ?? 1.0
  });

  emitQuest();
  startTimer();

  // (re)spawn engine
  STATE.engine = makeSpawner(mount);

  coach(`เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️ (speed ${cfg.speed ?? 1.0})`);
}