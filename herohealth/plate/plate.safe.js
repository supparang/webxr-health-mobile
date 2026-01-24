// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION, PATCHED)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js boot() + decorateTarget() for emoji/icon targets
// ✅ DD (rule-based) tick every 1s in play mode
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

function pick(rng, arr){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

/* ------------------------------------------------
 * Emoji sets (Thai 5 food groups: fixed mapping)
 * หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * หมู่ 2 คาร์โบ (ข้าว แป้ง เผือก มัน น้ำตาล)
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
-------------------------------------------------- */
const EMOJI_G = {
  g1: ['🥩','🍗','🍳','🥚','🥛','🫘','🥜','🧀'],
  g2: ['🍚','🍞','🥖','🍜','🍝','🥔','🍠','🥨'],
  g3: ['🥦','🥬','🥒','🥕','🌽','🍆','🫑','🥗'],
  g4: ['🍎','🍌','🍊','🍇','🍉','🍍','🥭','🍓'],
  g5: ['🥑','🫒','🧈','🥥','🌰','🧄','🍯'] // ไขมัน/น้ำมันดี (เพิ่มความหลากหลาย)
};

const EMOJI_JUNK = ['🍩','🍟','🍔','🍰','🧋','🥤','🍫','🍪','🧁','🍭','🍕'];

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

  // cfg + rng
  cfg:null,
  rng:Math.random,

  // spawn engine
  engine:null,

  // DD / AI
  ddTimer:null,
  ddSpawnRateMs: 900,
  ddGoodWeight: 0.70,
  ddJunkWeight: 0.30,
  ddTtlGood: 2100,
  ddTtlJunk: 1700,

  // coach rate-limit
  coachCooldownUntil: 0
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
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', minGapMs=900){
  const t = performance.now ? performance.now() : Date.now();
  if(t < STATE.coachCooldownUntil) return;
  STATE.coachCooldownUntil = t + minGapMs;
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
 * DD (AI Difficulty Director — rule-based, play mode only)
 * - ปรับ spawnRate / สัดส่วน junk / TTL ตาม performance
-------------------------------------------------- */
function ddTick(){
  if(!STATE.running || STATE.ended) return;
  if(!STATE.cfg) return;
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study') return;

  const acc = accuracy();           // 0..1
  const c = STATE.combo || 0;
  const m = STATE.miss || 0;

  // base by diff
  let baseSpawn = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 880);
  let junkW     = (STATE.cfg.diff === 'hard') ? 0.36 : (STATE.cfg.diff === 'easy' ? 0.24 : 0.30);

  // performance adjust
  // เล่นเก่ง -> เร็วขึ้น + junk เพิ่มนิด
  if(acc >= 0.86 && c >= 6){
    baseSpawn = Math.max(620, baseSpawn - 80);
    junkW = Math.min(0.42, junkW + 0.04);
  }

  // พลาดเยอะ -> ช้าลง + junk ลด
  if(m >= 6 || acc <= 0.68){
    baseSpawn = Math.min(1120, baseSpawn + 90);
    junkW = Math.max(0.18, junkW - 0.05);
  }

  // TTL (ให้เป้าไม่แว้บเกินไป)
  const ttlGood = clamp(2100 + (acc <= 0.70 ? 250 : 0) - (acc >= 0.90 ? 180 : 0), 1750, 2600);
  const ttlJunk = clamp(1700 + (acc <= 0.70 ? 200 : 0) - (acc >= 0.90 ? 140 : 0), 1400, 2300);

  STATE.ddSpawnRateMs = Math.round(baseSpawn);
  STATE.ddJunkWeight = pct2(junkW);
  STATE.ddGoodWeight = pct2(1 - junkW);
  STATE.ddTtlGood = Math.round(ttlGood);
  STATE.ddTtlJunk = Math.round(ttlJunk);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.ddTimer);
  stopSpawner();

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
 * Quest / mini update
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', 400);
  }
}

function updateMini(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach', 500);
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoal();
  updateMini();
  emitQuest();

  // micro-tip sometimes
  if(STATE.combo === 4) coach('คอมโบมาแล้ว! เก็บต่อเนื่องเลย ✨', 'Coach', 1200);

  // optional: if both done early => bonus + end
  if(STATE.goal.done && STATE.mini.done){
    addScore(250);
    coach('ผ่านด่าน! เก่งมาก ✅', 'Coach', 500);
    endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  updateMini();
  emitQuest();
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 900);
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMini();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji centered like your image)
 * - uses target.rng for deterministic picks
-------------------------------------------------- */
function decorateTarget(el, t){
  // clear
  el.textContent = '';

  // add a centered emoji span
  const span = document.createElement('span');
  span.className = 'emoji';

  if(t.kind === 'good'){
    const key = ['g1','g2','g3','g4','g5'][t.groupIndex] || 'g1';
    span.textContent = pick(t.rng, EMOJI_G[key]);
    el.dataset.group = key;
    el.title = `อาหารหมู่ ${key.slice(1)}`;
  }else{
    span.textContent = pick(t.rng, EMOJI_JUNK);
    el.title = 'ของหวาน/ทอด/น้ำหวาน';
  }

  el.appendChild(span);
}

/* ------------------------------------------------
 * Spawn logic
 * - rebuild spawner when DD params change a lot (lightweight)
-------------------------------------------------- */
function buildSpawner(mount){
  // weights
  const kinds = [
    { kind:'good', weight: STATE.ddGoodWeight },
    { kind:'junk', weight: STATE.ddJunkWeight }
  ];

  const spawnRate = STATE.ddSpawnRateMs;

  // NOTE: TTL is inside mode-factory target object by default,
  // but we can override by patching target.ttlMs in decorateTarget stage if needed.
  // Here we keep default and only “soft influence” by DD through spawnRate/weights.

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[52,78], // slightly bigger for kids (and your screenshot feel)
    kinds,
    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

function rebuildSpawner(mount){
  stopSpawner();
  STATE.engine = buildSpawner(mount);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous run if any
  clearInterval(STATE.timer);
  clearInterval(STATE.ddTimer);
  stopSpawner();

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

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // init DD params baseline
  STATE.ddSpawnRateMs = (cfg.diff === 'hard') ? 720 : (cfg.diff === 'easy' ? 980 : 880);
  STATE.ddGoodWeight  = (cfg.diff === 'hard') ? 0.64 : (cfg.diff === 'easy' ? 0.76 : 0.70);
  STATE.ddJunkWeight  = 1 - STATE.ddGoodWeight;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // build spawner
  STATE.engine = buildSpawner(mount);

  // DD tick every 1s (play mode only)
  STATE.ddTimer = setInterval(()=>{
    const before = STATE.ddSpawnRateMs;
    ddTick();
    // if spawnRate changed meaningfully -> rebuild spawner for effect
    if(Math.abs(STATE.ddSpawnRateMs - before) >= 60 && STATE.running && !STATE.ended){
      rebuildSpawner(mount);
    }
  }, 1000);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 200);
}