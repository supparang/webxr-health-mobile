// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses: ../vr/mode-factory.js (spawnBoot)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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

const pct0 = (n)=> `${Math.round(Number(n)||0)}%`;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return (performance?.now?.() ?? Date.now()); }

/* ------------------------------------------------
 * Icons / Groups
 * ------------------------------------------------
 * 5 หมู่ (ไทย): 1) ข้าวแป้ง 2) ผัก 3) ผลไม้ 4) เนื้อสัตว์/ไข่/ถั่ว 5) นม
 * (ทำให้ในเกมดูไม่ “มีแค่อย่างเดียว” โดยสุ่ม emoji ต่อหมู่)
 */
const GROUPS = [
  { name:'ข้าว-แป้ง', emojis:['🍚','🍞','🍜','🥐','🥖'] },
  { name:'ผัก',       emojis:['🥦','🥬','🥕','🥒','🌽'] },
  { name:'ผลไม้',     emojis:['🍎','🍌','🍇','🍍','🍉'] },
  { name:'โปรตีน',    emojis:['🍗','🥚','🐟','🫘','🥜'] },
  { name:'นม',        emojis:['🥛','🧀','🍶','🥣'] }
];

// junk pool (หลายแบบ)
const JUNK = ['🍩','🍟','🍔','🍭','🧋','🥤','🍫','🍰'];

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

  // per group counts
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอย่างน้อย 1 ชิ้นต่อหมู่',
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

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // light adaptive (play only)
  adaptiveOn:false,
  lastCoachAt:0
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
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
  // rate-limit coach a bit
  const t = nowMs();
  if(t - STATE.lastCoachAt < 700) return;
  STATE.lastCoachAt = t;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Scoring
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += (Number(v)||0);
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
  // count “attempts” as: good hit + junk hit + good expired
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function updateMiniFromAccuracy(){
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = clamp(accPct, 0, 100);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // stop spawner + clear remaining targets
  try{ STATE.spawner?.stop?.(); }catch{}
  try{ STATE.spawner?.clear?.(); }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracy() * 100),

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
  emitTime();

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  groupIndex = clamp(groupIndex, 0, 4);

  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();

  // score scale per diff + combo
  const base = (STATE.cfg.diff === 'hard') ? 120 : (STATE.cfg.diff === 'easy' ? 90 : 100);
  addScore(base + STATE.combo * 6);

  // goal progress: number of groups that have >=1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }else{
      // gentle hint
      if(STATE.goal.cur === 3) coach('อีกนิด! ลองเก็บหมู่ที่ยังขาดนะ 🧠', 'Coach');
    }
  }

  updateMiniFromAccuracy();
  emitQuest();

  // light adaptive (play mode only): if accuracy high, nudge speed a bit
  if(STATE.adaptiveOn){
    maybeAdjustDifficulty();
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // penalty depends diff
  const pen = (STATE.cfg.diff === 'hard') ? -70 : (STATE.cfg.diff === 'easy' ? -35 : -50);
  addScore(pen);

  updateMiniFromAccuracy();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  if(STATE.adaptiveOn){
    maybeAdjustDifficulty();
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMiniFromAccuracy();
  emitQuest();

  // no spam coach on expire
  if(STATE.adaptiveOn){
    maybeAdjustDifficulty();
  }
}

/* ------------------------------------------------
 * Adaptive-ish (PLAY only)
 * ------------------------------------------------
 * ไม่ใช่ ML จริง แต่ “สนุก/ลื่น” ขึ้น:
 * - ถ้าแม่นมาก + miss ต่ำ → เพิ่ม spawnRate นิด
 * - ถ้าพลาดเยอะ → ผ่อน spawnRate นิด
 */
function maybeAdjustDifficulty(){
  if(!STATE.spawner) return;

  // NOTE: mode-factory.js v นี้ spawnRate ถูกเซ็ตตอน boot; เพื่อ keep simple:
  // เรา "ไม่ปรับ interval แบบ real-time" ที่ตัว factory (ยังไม่มี API setRate)
  // แต่เราปรับผ่าน hint/coach เท่านั้น + พร้อม hook ต่อไป
  const acc = accuracy();
  if(acc >= 0.86 && STATE.miss <= 2 && STATE.timeLeft > 20){
    // encourage speed
    coach('ทำได้ดีมาก! ลองทำให้เร็วขึ้นอีกนิด ⚡', 'Coach');
  }else if(acc < 0.7 && STATE.miss >= 4){
    coach('ช้า ๆ ได้ ลองเล็งให้ชัวร์ขึ้นนะ 🎯', 'Coach');
  }
}

/* ------------------------------------------------
 * Spawner: connect to mode-factory.js
 * ------------------------------------------------ */
function applySpawnSafeVars(){
  // ให้ factory อ่าน safe-area ได้แน่นอน
  // (คุณจะปรับค่าจริงได้ใน CSS ด้วยเช่นกัน)
  const root = document.documentElement;
  // top: เผื่อ HUD แถวบน + quest card
  root.style.setProperty('--hud-top-safe', '110px');
  // bottom: เผื่อ coach card / end overlay area
  root.style.setProperty('--hud-bottom-safe', '210px');
}

function makeSpawner(mount){
  // tune by diff
  const diff = (STATE.cfg.diff || 'normal');

  const spawnRate =
    diff === 'hard' ? 650 :
    diff === 'easy' ? 980 :
    820;

  const lifeGoodMs =
    diff === 'hard' ? 1200 :
    diff === 'easy' ? 1700 :
    1450;

  const lifeJunkMs =
    diff === 'hard' ? 1050 :
    diff === 'easy' ? 1500 :
    1250;

  // weights: hard has more junk
  const wGood = diff === 'hard' ? 0.62 : (diff === 'easy' ? 0.75 : 0.70);
  const wJunk = 1 - wGood;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    spawnRate,
    lifeGoodMs,
    lifeJunkMs,

    sizeRange:[44, 68],
    maxTargets: diff === 'hard' ? 16 : 14,

    className:'plateTarget',

    kinds:[
      { kind:'good', weight:wGood },
      { kind:'junk', weight:wJunk }
    ],

    pickGroupIndex: ()=>{
      // bias towards missing groups (makes it feel fair for kids)
      const have = STATE.g.map(v=>v>0);
      const missing = [];
      for(let i=0;i<5;i++) if(!have[i]) missing.push(i);
      if(missing.length){
        // 70% spawn missing group
        if(STATE.rng() < 0.70) return missing[Math.floor(STATE.rng()*missing.length)];
      }
      return Math.floor(STATE.rng()*5);
    },

    renderText:(kind)=>{
      if(kind === 'junk'){
        return JUNK[Math.floor(STATE.rng()*JUNK.length)];
      }
      // good: pick group emoji based on groupIndex that will be assigned later
      // mode-factory sets data-group after createEl; so here we can just return a random "healthy" emoji,
      // but we can also pre-pick with missing-group bias by reading from pickGroupIndex again:
      const gi = Math.floor(STATE.rng()*5);
      const g = GROUPS[gi];
      const e = g.emojis[Math.floor(STATE.rng()*g.emojis.length)];
      return e;
    },

    onHit:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
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

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG mode
  const rm = (cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
    STATE.adaptiveOn = false;
  }else{
    STATE.rng = Math.random;
    STATE.adaptiveOn = true; // light adaptive
  }

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // safe vars for spawn
  applySpawnSafeVars();

  emit('hha:start', {
    game:'plate',
    runMode: rm,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner
  try{
    STATE.spawner?.destroy?.();
  }catch{}
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  emitScore();
}