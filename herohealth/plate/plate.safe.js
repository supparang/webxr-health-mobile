// =========================================================
// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PATCH
// HHA Standard
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (เบาๆ)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm hooks (CSS layers exist)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ PATCH: uses mode-factory.js (spawn system) + decorateTarget()
// ✅ PATCH: emoji mapping 5 หมู่ + junk emoji variety
// =========================================================

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

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * Icons / Emoji sets (Plate)
 * ------------------------------------------------
 * หมู่ 1 โปรตีน: เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
 * หมู่ 2 คาร์บ: ข้าว แป้ง เผือก มัน น้ำตาล
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 */
const EMOJI_GROUPS = [
  // 1 โปรตีน
  ['🥩','🍗','🍳','🥚','🥛','🫘','🐟'],
  // 2 คาร์บ
  ['🍚','🍞','🥖','🍜','🍝','🥔','🍠'],
  // 3 ผัก
  ['🥦','🥬','🥕','🌽','🍆','🥒','🫑'],
  // 4 ผลไม้
  ['🍎','🍌','🍊','🍇','🍉','🍍','🍓'],
  // 5 ไขมัน
  ['🥑','🫒','🧈','🥥','🥜'],
];

// junk/ของหวานทอด (Plate ต้องชัดเจน)
const EMOJI_JUNK = ['🍩','🍪','🧁','🍰','🍟','🍔','🥤','🍫'];

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
    sub:'แตะอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% (แตะดี/พลาด/หมดเวลา)',
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

  // spawn controller
  spawner:null,

  // hooks
  bossOn:false,
  stormOn:false,
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
function pushScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += v;
  pushScore();
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
  STATE.timer = null;

  try{ STATE.spawner?.stop?.(); }catch{}
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

    accuracyGoodPct: pct2(accuracy() * 100),

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
 * Difficulty (Play only)
 * เบาๆ: ปรับ spawnRate ตาม performance
 * - ถ้าแม่น+คอมโบดี -> เร็วขึ้นนิด
 * - ถ้าพลาดเยอะ -> ช้าลงนิด
 * Research/Study: ปิด adaptive (คงที่)
 * ------------------------------------------------ */
function computeAdaptiveSpawnRate(base){
  const acc = accuracy();
  const miss = STATE.miss;

  let rate = base;
  if(acc >= 0.88 && STATE.comboMax >= 8) rate *= 0.85;      // เร็วขึ้นนิด
  else if(acc >= 0.80 && STATE.comboMax >= 5) rate *= 0.92;

  if(miss >= 8) rate *= 1.18;                               // ช้าลงช่วยผู้เล่น
  else if(miss >= 5) rate *= 1.10;

  return clamp(rate, 520, 1400);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: count distinct groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      // (optional) ให้รางวัล: เพิ่มเวลาเล็กน้อย
      if(STATE.cfg?.runMode === 'play'){
        STATE.timeLeft += 5;
        coach('บวกเวลา +5 วิ ⏱️', 'Bonus');
      }
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

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji)
 * ------------------------------------------------ */
function pickFrom(arr, r){
  if(!arr || !arr.length) return '⭐';
  const i = Math.floor(r() * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

function decorateTarget(el, t){
  // Ensure centered emoji text (your CSS already grid-center)
  if(!el) return;

  let emoji = '🍽️';
  if(t.kind === 'junk'){
    emoji = pickFrom(EMOJI_JUNK, t.rng);
    el.dataset.emoji = emoji;
    el.textContent = emoji;
    return;
  }

  // good: map to groupIndex 0..4
  const gi = clamp(t.groupIndex ?? 0, 0, 4);
  emoji = pickFrom(EMOJI_GROUPS[gi], t.rng);

  el.dataset.g = String(gi+1); // 1..5
  el.dataset.emoji = emoji;
  el.textContent = emoji;
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function startSpawner(mount){
  const baseRate = (STATE.cfg.diff === 'hard') ? 680 : (STATE.cfg.diff === 'easy' ? 980 : 860);

  // play: adaptive, research: fixed
  const spawnRate =
    (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study')
      ? baseRate
      : baseRate; // initial; we can restart spawner when adapt (light approach)

  const sp = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,66],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget, // ✅ PATCH entry

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }

      // light adaptive: every hit, maybe adjust by restarting spawner (play only)
      if(STATE.cfg.runMode === 'play'){
        const desired = computeAdaptiveSpawnRate(baseRate);
        // only restart if differs meaningfully
        if(Math.abs(desired - sp.__spawnRate) > 70){
          try{ sp.stop(); }catch{}
          STATE.spawner = startSpawnerWithRate(mount, desired);
        }
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
      // junk expire no penalty
    }
  });

  // annotate for adaptive compare
  sp.__spawnRate = spawnRate;
  return sp;
}

function startSpawnerWithRate(mount, rate){
  const sp = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange:[44,66],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
  sp.__spawnRate = rate;
  return sp;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous if any
  try{ STATE.spawner?.stop?.(); }catch{}
  clearInterval(STATE.timer);

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

  // RNG: research/study deterministic
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
    durationPlannedSec: STATE.timeLeft
  });

  // initial HUD pushes
  pushScore();
  emitQuest();
  startTimer();

  // spawn
  STATE.spawner = startSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}