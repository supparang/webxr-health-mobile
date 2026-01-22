// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive pacing ON (gentle)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Boss/Storm hooks (lightweight triggers)
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

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Emoji sets (หลากหลาย ไม่เบื่อ)
 * g1..g5 = 5 หมู่ (ตามแนวอาหารไทย)
 *  0: ข้าว-แป้ง  1: ผัก  2: ผลไม้  3: เนื้อสัตว์/โปรตีน  4: นม
------------------------------------------------ */
const EMOJI_BY_GROUP = [
  ['🍚','🍞','🥖','🥪','🍜','🍝','🥟','🥯'],     // g1 carbs
  ['🥦','🥬','🥕','🥒','🌽','🍅','🫑','🍆'],     // g2 veg
  ['🍎','🍌','🍊','🍇','🍉','🍍','🥭','🍓'],     // g3 fruit
  ['🥚','🐟','🍗','🍖','🫘','🧆','🥜','🍤'],     // g4 protein
  ['🥛','🧀','🍦','🍨','🧁'],                   // g5 dairy (คุมให้ไม่หวานเกิน)
];

// junk (เลี่ยง)
const EMOJI_JUNK = ['🍟','🍔','🍩','🍰','🧋','🥤','🍫','🍿','🍕'];

function pickFrom(arr, rng){
  return arr[Math.floor(rng() * arr.length)] || arr[0];
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
  g:[0,0,0,0,0], // counts
  seen:[false,false,false,false,false], // at least 1 each group

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    // mini แบบเร้าใจ + เข้าใจง่ายสำหรับ ป.5
    name:'สปีดคอมโบ',
    sub:'ทำคอมโบให้ถึง 8 (ห้ามพลาด!)',
    cur:0,
    target:8,
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

  // pacing
  spawnRateMs:900,
  ttlMs:1800,

  // fx flags
  stormOn:false,
  bossOn:false
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
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
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
 * (วัดจาก good hit เทียบกับทั้งหมดที่เกิดผล)
 * total = hitGood + hitJunk + expireGood
------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Hooks: Storm/Boss (เบา ๆ แต่เห็นผล)
 * - Storm: ช่วงท้าย 25s เร่ง spawn rate (สนุก+ตื่นเต้น)
 * - Boss: ถ้าใกล้ครบ 5 หมู่แต่เหลือ 1 หมู่ จะเน้น spawn หมู่นั้น
------------------------------------------------ */
function setStorm(on){
  if(STATE.stormOn === on) return;
  STATE.stormOn = on;
  emit('hha:judge', { tag:'storm', on });
  // (ถ้าคุณมี #stormFx class toggles ใน CSS/HTML เพิ่มได้ แต่ไม่บังคับ)
  const fx = document.getElementById('stormFx');
  if(fx){
    fx.classList.toggle('storm-on', on);
  }
}

function setBoss(on){
  if(STATE.bossOn === on) return;
  STATE.bossOn = on;
  emit('hha:judge', { tag:'boss', on });
  const fx = document.getElementById('bossFx');
  if(fx){
    fx.classList.toggle('boss-on', on);
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  try{ STATE.spawner?.stop?.(); }catch{}

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
 * Timer + pacing updates
------------------------------------------------ */
function updatePacing(){
  const t = STATE.timeLeft;

  // research/study: คงที่เพื่อ deterministic
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  if(isResearch) return;

  // play mode: ปรับนิด ๆ ให้ "เร่งช่วงท้าย" + feedback สนุก
  if(t <= 25){
    setStorm(true);
  }else{
    setStorm(false);
  }

  // spawnRate by difficulty + storm
  let base = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860);
  if(STATE.stormOn) base = Math.max(420, base - 260);

  // TTL ลดนิดใน storm ให้กดดัน
  let ttl = 1800;
  if(STATE.stormOn) ttl = 1400;

  STATE.spawnRateMs = base;
  STATE.ttlMs = ttl;
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;

    updatePacing();
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
------------------------------------------------ */
function refreshGoalProgress(){
  // count unique groups collected
  STATE.goal.cur = STATE.seen.filter(Boolean).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function maybeBossFocus(){
  // Boss trigger: ใกล้ครบ (เหลือหมู่เดียว)
  const left = 5 - STATE.seen.filter(Boolean).length;
  setBoss(left === 1 && !STATE.goal.done);
}

function onHitGood(groupIndex){
  groupIndex = clamp(groupIndex, 0, 4);

  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.seen[groupIndex] = true;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress
  refreshGoalProgress();
  maybeBossFocus();

  // mini: combo reach target
  STATE.mini.cur = STATE.comboMax;
  if(!STATE.mini.done && STATE.comboMax >= STATE.mini.target){
    STATE.mini.done = true;
    coach('สุดยอด! คอมโบถึงเป้าหมายแล้ว ⚡', 'Coach');
    // bonus: time + small score
    STATE.timeLeft += 4;
    addScore(120);
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Spawner dataFactory
 * - ใส่ groupIndex + emoji ให้ target
 * - Boss focus: ถ้าเหลือหมู่เดียว ให้สุ่มหมู่นั้นหนักขึ้น
------------------------------------------------ */
function chooseGoodGroup(rng){
  const seenCount = STATE.seen.filter(Boolean).length;
  const leftIdx = [];
  for(let i=0;i<5;i++) if(!STATE.seen[i]) leftIdx.push(i);

  // boss: if only one group left -> always that
  if(STATE.bossOn && leftIdx.length === 1) return leftIdx[0];

  // early game: encourage diversity (prefer unseen)
  if(seenCount <= 2 && leftIdx.length > 0 && rng() < 0.7){
    return leftIdx[Math.floor(rng()*leftIdx.length)];
  }

  // otherwise uniform
  return Math.floor(rng()*5);
}

/* ------------------------------------------------
 * Main boot
------------------------------------------------ */
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
  STATE.seen = [false,false,false,false,false];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.stormOn = false;
  STATE.bossOn = false;

  // RNG
  const isResearch = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // เวลา: 90s เป็น default ที่เหมาะกับ ป.5 (พอให้เก็บครบ 5 หมู่ + มีเวลาพลาด/เรียนรู้)
  // แต่ยังรองรับ ?time=70 ได้ (โหมดเร่ง)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // initial pacing
  updatePacing();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner
  STATE.spawner = spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate: STATE.spawnRateMs,
    ttlMs: STATE.ttlMs,
    sizeRange:[46,68],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],

    // attach payload per target
    dataFactory: ({ kind, rng })=>{
      if(kind === 'junk'){
        return { emoji: pickFrom(EMOJI_JUNK, rng) };
      }
      const gi = chooseGoodGroup(rng);
      const emoji = pickFrom(EMOJI_BY_GROUP[gi], rng);
      return { groupIndex: gi, emoji };
    },

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      // refresh dynamic pacing into spawner (cheap trick: stop+restart rarely)
      // เราไม่ restart ทุกวินาทีเพื่อกันกระตุก — ใช้แค่ตอน storm toggle / diff
      // (ถ้าอยากละเอียดกว่านี้ เดี๋ยวแพ็คถัดไปทำ "controller.setRate()" ได้)
      // ตอนนี้ให้ mode-factory spawnRate คงที่จากตอน boot (พอแล้วสำหรับ production v1)

      if(t.kind === 'good'){
        const gi = Number(t.groupIndex);
        onHitGood(Number.isFinite(gi) ? gi : Math.floor(STATE.rng()*5));
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}