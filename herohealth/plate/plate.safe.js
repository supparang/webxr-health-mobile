// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard (PATCH: Mini Spotlight + Missing Guidance + Plate Rush)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks placeholders
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ NEW:
//   A) Mini Quest = "เติมหมู่ที่ขาด (12 วิ) 0/2" (spotlight + bonus)
//   B) Guidance: bias good hit -> missing groups during Mini (soft assist, no auto-aim)
//   C) Plate Rush: last 15s => score x2, miss won't break combo (still counts miss)
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

function pickOne(arr, rng=Math.random){
  if(!arr || !arr.length) return null;
  return arr[Math.floor(rng()*arr.length)];
}

/* ------------------------------------------------
 * Group metadata (5 หมู่) — ใช้สำหรับ guidance/ข้อความ
 * หมายเหตุ: icon ไม่ได้บังคับ UI แต่ส่งให้ HUD ได้ถ้าจะใช้ภายหลัง
 * ------------------------------------------------ */
const GROUPS = [
  { key:'g1', name:'ข้าว-แป้ง', icon:'🍚' },
  { key:'g2', name:'ผัก',      icon:'🥦' },
  { key:'g3', name:'ผลไม้',    icon:'🍎' },
  { key:'g4', name:'โปรตีน',   icon:'🍗' },
  { key:'g5', name:'นม',       icon:'🥛' },
];

function missingGroupIndices(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(i);
  }
  return miss;
}

function missingIcons(){
  return missingGroupIndices().map(i=>GROUPS[i]?.icon || '•').join(' ');
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

  // quest (Goal = เติมครบ 5 หมู่)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },

  // mini quest (จะถูก “เปลี่ยนรูปแบบ” ให้ตรงภาพ: เติมหมู่ที่ขาด (12 วิ) 0/2)
  mini:{
    name:'เติมหมู่ที่ขาด (12 วิ)',
    sub:'พลาดได้ ไม่เป็นไร! ลองใหม่รอบหน้า ...',
    cur:0,
    target:2,
    done:false,

    // runtime
    active:false,
    windowSec:12,
    leftSec:0,
    hitsNeed:2,     // เท่ากับ target
    hitsGot:0
  },

  // phases
  rush:{
    on:false,
    startAtSec:15,   // last 15s
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn
  engine:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Coach helper (rate-limit เบา ๆ)
 * ------------------------------------------------ */
let __coachTo = 0;
function coach(msg, tag='Coach', coolMs=650){
  const now = Date.now();
  if(now - __coachTo < coolMs) return;
  __coachTo = now;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function emitQuest(){
  const missIdx = missingGroupIndices();
  const missTxt = missIdx.length ? `ยังขาด: ${missingIcons()}` : 'ครบแล้ว!';
  // Goal.sub อัปเดตตามสิ่งที่ขาด (เหมือนภาพ)
  const goalSub = STATE.goal.done ? 'ครบทุกหมู่แล้ว 🎉' : missTxt;

  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: goalSub,
      cur: STATE.goal.cur,
      target: STATE.goal.target,
      missing: missIdx,         // เผื่อ UI อยากใช้ภายหลัง
      missingIcons: missingIcons()
    },
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done,
      active: STATE.mini.active,
      leftSec: STATE.mini.leftSec
    },
    rush:{
      on: STATE.rush.on,
      leftSec: Math.max(0, Math.min(STATE.timeLeft, STATE.rush.startAtSec))
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
    comboMax: STATE.comboMax,
    rushOn: STATE.rush.on
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
 * Mini Quest controls (เติมหมู่ที่ขาด 12 วิ 0/2)
 * ------------------------------------------------ */
function startMiniWindow(){
  if(STATE.mini.done) return;
  if(STATE.mini.active) return;

  STATE.mini.active = true;
  STATE.mini.leftSec = STATE.mini.windowSec;
  STATE.mini.hitsGot = 0;

  STATE.mini.name = `เติมหมู่ที่ขาด (${STATE.mini.windowSec} วิ)`;
  STATE.mini.target = STATE.mini.hitsNeed;
  STATE.mini.cur = 0;

  coach('โอกาสโบนัส! รีบเติมหมู่ที่ขาด ✨', 'Coach', 0);
  emitQuest();
}

function stopMiniWindow(failed=false){
  if(!STATE.mini.active) return;
  STATE.mini.active = false;
  STATE.mini.leftSec = 0;

  if(failed && !STATE.mini.done){
    // โทนตามภาพ: “พลาดได้ ไม่เป็นไร...”
    STATE.mini.sub = 'พลาดได้ ไม่เป็นไร! ลองใหม่รอบหน้า ...';
    coach('ไม่เป็นไร รอบหน้าลองใหม่ได้ 👍', 'Coach');
  }
  emitQuest();
}

function completeMiniWindow(){
  if(STATE.mini.done) return;
  STATE.mini.done = true;
  STATE.mini.active = false;
  STATE.mini.leftSec = 0;
  STATE.mini.cur = STATE.mini.target;

  // โบนัส (เบา ๆ แต่รู้สึกคุ้ม): +250 คะแนน + เพิ่มเวลา +5 วิ (ถ้าไม่ใช่ research ก็ได้เหมือนกัน)
  addScore(250);
  STATE.timeLeft = clamp(STATE.timeLeft + 5, 0, 999);
  emit('hha:time', { leftSec: STATE.timeLeft, bonus:true });

  coach('สุดยอด! โบนัสคะแนน + เวลาเพิ่ม 🎁', 'Coach', 0);
  emitQuest();
}

/* ------------------------------------------------
 * Rush controls (15 วิท้าย)
 * ------------------------------------------------ */
function startRush(){
  if(STATE.rush.on) return;
  STATE.rush.on = true;
  coach('PLATE RUSH! 15 วิท้าย 🔥 คะแนน x2', 'Coach', 0);
  emitQuest();
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // ถ้า mini กำลังรันอยู่ ให้ปิด
  if(STATE.mini.active && !STATE.mini.done){
    stopMiniWindow(true);
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

    accuracyGoodPct: pct2(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    rushOn: STATE.rush.on
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });
  emitQuest();

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // Rush trigger
    if(!STATE.rush.on && STATE.timeLeft === STATE.rush.startAtSec){
      startRush();
    }

    // Mini countdown
    if(STATE.mini.active){
      STATE.mini.leftSec--;
      // update mini nums live
      STATE.mini.cur = STATE.mini.hitsGot;
      emitQuest();

      if(STATE.mini.leftSec <= 0){
        // หมดเวลา mini แล้วยังไม่ครบ => fail แล้วจบช่วง
        if(!STATE.mini.done){
          stopMiniWindow(true);
        }
      }else if(STATE.mini.leftSec <= 3){
        coach('อีกนิดเดียว! ⏳', 'Coach', 900);
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function scoreGoodBase(){
  // base 100 + combo scaling
  const base = 100 + STATE.combo * 5;
  // Rush: x2
  return STATE.rush.on ? Math.round(base * 2) : base;
}

function scoreJunkPenalty(){
  // Rush: เบาลงนิด (เด็กไม่ท้อ) แต่ยังโดนลบ
  return STATE.rush.on ? -30 : -50;
}

function onHitGood(groupIndex){
  STATE.hitGood++;

  // บันทึกหมู่
  STATE.g[groupIndex]++;
  addCombo();

  addScore(scoreGoodBase());

  // Goal progress = จำนวนหมู่ที่ “เคยได้แล้ว”
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', 0);
      // ถ้าครบ goal แล้ว mini ยังไม่เริ่ม/ไม่จบ ก็ไม่บังคับ
    }
  }

  // Mini progress (ต้อง “ยิงโดนหมู่ที่ขาด” ในช่วง 12 วิ)
  if(STATE.mini.active && !STATE.mini.done){
    // mini: นับเฉพาะการเติมหมู่ที่ยังขาด (ก่อนยิงครั้งนี้)
    // แต่เราเลือก groupIndex จาก missing อยู่แล้วตอน mini (ดู makeSpawner/onHit)
    // เพื่อความชัวร์: ถ้าหมู่ก่อนหน้า "เคยมีแล้ว" ก็ไม่นับ
    // วิธี: ถ้าหลังเพิ่มแล้วค่ากลายเป็น 1 แปลว่า "เพิ่งเติมหมู่นี้"
    if(STATE.g[groupIndex] === 1){
      STATE.mini.hitsGot++;
      STATE.mini.cur = STATE.mini.hitsGot;
      if(STATE.mini.hitsGot >= STATE.mini.hitsNeed){
        completeMiniWindow();
      }else{
        emitQuest();
      }
    }else{
      // ยิงซ้ำหมู่เดิมใน mini -> ไม่เสีย แต่ไม่เพิ่ม
      emitQuest();
    }
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  // Rush: "Miss ไม่ตัด Combo" แต่ยังนับ miss
  if(!STATE.rush.on){
    resetCombo();
  }

  addScore(scoreJunkPenalty());
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;

  // Rush: ไม่ตัด combo
  if(!STATE.rush.on){
    resetCombo();
  }

  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // ความเร็ว baseline
  const baseRate =
    diff === 'hard' ? 700 :
    diff === 'easy' ? 980 :
    880;

  // note: เราไม่เดา API ของ mode-factory เกินจำเป็น
  // => ใช้ spawnBoot แบบเดิม แต่ “soft guidance” ทำที่ groupIndex assignment ตอน hit good

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate: baseRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],

    onHit:(t)=>{
      if(t.kind === 'good'){
        // --- Soft Guidance (B):
        // ถ้าอยู่ใน Mini (12 วิ) => bias ให้ไปหมู่ที่ขาด (เพื่อให้เด็ก "ผ่าน mini" ได้จริง)
        // ไม่ได้ auto-aim แค่ตอนบันทึกหมู่ที่ได้จากการยิง
        let gi = t.groupIndex;

        const missIdx = missingGroupIndices();
        if(STATE.mini.active && missIdx.length){
          // เลือกจากหมู่ที่ขาดเป็นหลัก (85%)
          gi = (STATE.rng() < 0.85) ? pickOne(missIdx, STATE.rng) : (gi ?? Math.floor(STATE.rng()*5));
        }else if(gi == null){
          // นอก mini ก็สุ่มปกติ (หรือใช้ที่มากับ target ถ้ามี)
          gi = Math.floor(STATE.rng()*5);
        }

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

  // reset stats
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;
  STATE.g = [0,0,0,0,0];

  // reset goal
  STATE.goal.cur = 0;
  STATE.goal.done = false;

  // reset mini
  STATE.mini.done = false;
  STATE.mini.active = false;
  STATE.mini.leftSec = 0;
  STATE.mini.hitsGot = 0;
  STATE.mini.hitsNeed = 2;
  STATE.mini.windowSec = 12;
  STATE.mini.name = `เติมหมู่ที่ขาด (${STATE.mini.windowSec} วิ)`;
  STATE.mini.sub = 'พลาดได้ ไม่เป็นไร! ลองใหม่รอบหน้า ...';
  STATE.mini.target = STATE.mini.hitsNeed;
  STATE.mini.cur = 0;

  // rush
  STATE.rush.on = false;
  STATE.rush.startAtSec = 15;

  // RNG: research => deterministic
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // เวลา: ถ้าคุณลังเล 70 vs 90
  // - เด็ก ป.5: 90 ดีมากสำหรับ "เก็บครบ 5 หมู่ + เจอ Mini 12 วิ + Rush 15 วิท้าย"
  // - แต่ยังคงให้ query time override ได้
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);

  // Trigger mini แบบ “เหมือนภาพ”:
  // เมื่อ goal progress ถึง 3/5 (เริ่มรู้สึกใกล้สำเร็จ) จะเปิด Mini 12 วิ
  // เพื่อเร่งให้ “เติมหมู่ที่ขาด” (target=2 หมู่)
  // (ถ้าคุณอยากให้เริ่มที่ 2/5 หรือ 4/5 บอกได้)
  const __miniTriggerCheck = ()=>{
    if(STATE.ended || !STATE.running) return;
    if(STATE.goal.done || STATE.mini.done) return;

    // ถ้าครบ 3 หมู่แล้ว และยังขาดอย่างน้อย 2 หมู่ => เปิด mini
    if(STATE.goal.cur >= 3){
      const missIdx = missingGroupIndices();
      if(missIdx.length >= 2){
        startMiniWindow();
      }
    }
  };

  // hook: หลังเริ่มเกม 1 วิ ตรวจ trigger ครั้งแรก (กัน goal.cur ยัง 0)
  setTimeout(__miniTriggerCheck, 1000);

  // hook: ทุกครั้งที่ quest update (จาก hit) ก็ตรวจ trigger
  // (ง่ายสุด: แทรกใน onHitGood ตอน emitQuest ก็พอ แต่กันพลาดด้วย listener เล็ก ๆ)
  WIN.addEventListener('quest:update', __miniTriggerCheck, { passive:true });
}