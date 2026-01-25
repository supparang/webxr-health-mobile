// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (soft)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (spawn targets) + decorateTarget emoji by group
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

/* ---------------- Utilities ---------------- */
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

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function pickFrom(arr, rng=Math.random){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng() || 0) * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, i))];
}

/* ---------------- Emoji packs (5 food groups) ----------------
   หมู่ 1 โปรตีน: เนื้อ นม ไข่ ถั่วเมล็ดแห้ง
   หมู่ 2 คาร์โบไฮเดรต: ข้าว แป้ง เผือก มัน น้ำตาล
   หมู่ 3 ผัก
   หมู่ 4 ผลไม้
   หมู่ 5 ไขมัน
-------------------------------------------------------------- */
const EMOJI_BY_GROUP = {
  g1: ['🥚','🥛','🐟','🍗','🫘','🥜'],             // โปรตีน
  g2: ['🍚','🍞','🥖','🍜','🥔','🍠'],             // คาร์บ
  g3: ['🥦','🥬','🥒','🥕','🌽','🍆'],             // ผัก
  g4: ['🍎','🍌','🍇','🍊','🍍','🍉'],             // ผลไม้
  g5: ['🥑','🫒','🧈','🥥','🌰'],                   // ไขมัน
};

const EMOJI_JUNK = ['🍟','🍔','🍩','🍰','🍫','🧁','🥤','🍕'];

/* ---------------- Engine state ---------------- */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups counters (index 0-4)
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0, target:5, done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg/rng
  cfg:null,
  rng:Math.random,

  // spawner instance
  spawner:null,

  // soft adaptive knobs (play only)
  curSpawnRate:900,
  curJunkWeight:0.30,
  ddTick:null,
};

/* ---------------- Quest/Coach ---------------- */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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

/* ---------------- Score/Combo ---------------- */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += Number(v) || 0;
  emitScore();
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ---------------- Accuracy ---------------- */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ---------------- End game ---------------- */
function cleanup(){
  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  try{ clearInterval(STATE.ddTick); }catch{}
  STATE.ddTick = null;

  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  cleanup();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,

    // Miss definition for Plate: hit junk + expire good (เหมือนแนว HHA)
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

/* ---------------- Timer ---------------- */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ---------------- Judge event ---------------- */
function judge(type, extra={}){
  // type: 'good' | 'junk' | 'expire'
  emit('hha:judge', {
    type,
    score: STATE.score,
    combo: STATE.combo,
    timeLeft: STATE.timeLeft,
    ...extra
  });
}

/* ---------------- Hit handlers ---------------- */
function updateGoalProgress(){
  if(STATE.goal.done) return;

  // goal = ได้อย่างน้อย 1 ชิ้นในทุกหมู่
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgress(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalProgress();
  updateMiniProgress();
  emitQuest();

  judge('good', { groupIndex });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;        // miss++
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  updateMiniProgress();
  emitQuest();

  judge('junk');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;        // miss++
  resetCombo();

  updateMiniProgress();
  emitQuest();

  judge('expire');
}

/* ---------------- decorateTarget (emoji/icon) ---------------- */
function decorateTarget(el, t){
  // t.kind: good/junk
  // t.groupIndex: 0..4
  const rng = t.rng || STATE.rng || Math.random;

  if(t.kind === 'junk'){
    el.textContent = pickFrom(EMOJI_JUNK, rng);
    el.dataset.icon = 'junk';
    return;
  }

  const key = ['g1','g2','g3','g4','g5'][t.groupIndex] || 'g1';
  const pool = EMOJI_BY_GROUP[key] || EMOJI_BY_GROUP.g1;
  el.textContent = pickFrom(pool, rng);
  el.dataset.icon = key;
}

/* ---------------- Soft Adaptive (play only) ----------------
   แนวคิด: ถ้าเก่งมาก → เร็วขึ้นเล็กน้อย + junk เพิ่มนิด
         ถ้าเริ่มพลาดมาก → ชะลอลง + junk ลดนิด
   *research/study = ปิด (คงที่ + deterministic)
------------------------------------------------------------ */
function computeDD(){
  const acc = accuracy();          // 0..1
  const c = STATE.comboMax || 0;
  const miss = STATE.miss || 0;

  // score-like signal
  let s = 0;
  if(acc >= 0.90) s += 2;
  else if(acc >= 0.80) s += 1;
  else if(acc < 0.65) s -= 2;
  else if(acc < 0.75) s -= 1;

  if(c >= 18) s += 2;
  else if(c >= 10) s += 1;

  if(miss >= 10) s -= 2;
  else if(miss >= 6) s -= 1;

  return clamp(s, -3, 3);
}

function applyDD(dd){
  // base
  const baseRate = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860);
  const baseJunk = (STATE.cfg.diff === 'hard') ? 0.34 : (STATE.cfg.diff === 'easy' ? 0.24 : 0.30);

  // dd -> nudge
  const rate = clamp(baseRate - dd * 55, 560, 1100);
  const junk = clamp(baseJunk + dd * 0.02, 0.18, 0.42);

  // update knobs
  STATE.curSpawnRate = rate;
  STATE.curJunkWeight = junk;

  emit('hha:ai', { dd, spawnRate: rate, junkWeight: junk });
}

/* ---------------- Spawner (mode-factory) ---------------- */
function startSpawner(mount){
  // ensure previous spawner cleared
  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch{}
  STATE.spawner = null;

  const kinds = [
    { kind:'good', weight: 1 - STATE.curJunkWeight },
    { kind:'junk', weight: STATE.curJunkWeight }
  ];

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safePrefix: 'plate',                     // ✅ IMPORTANT (match CSS vars)
    spawnRate: STATE.curSpawnRate,
    sizeRange: [48, 72],
    ttlMsGood: 2300,
    ttlMsJunk: 1700,
    kinds,

    decorateTarget,                          // ✅ emoji/icon by group

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }

      // quick win: ถ้าทำครบทั้ง goal+mini ก่อนหมดเวลา → จบได้เลย (optional)
      if(STATE.goal.done && STATE.mini.done){
        // ให้เด็ก ป.5 รู้สึก “ผ่านแล้วจบเลย” (ไว/เร้าใจ)
        endGame('cleared');
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ---------------- Main boot ---------------- */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset base
  cleanup();

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
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isStudy ? seededRng(cfg.seed || Date.now()) : Math.random;

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

  // init soft adaptive knobs
  STATE.curSpawnRate = (cfg.diff === 'hard') ? 720 : (cfg.diff === 'easy' ? 980 : 860);
  STATE.curJunkWeight = (cfg.diff === 'hard') ? 0.34 : (cfg.diff === 'easy' ? 0.24 : 0.30);

  // start spawner
  startSpawner(mount);

  // play-only: soft adaptive tick (every 1s) + restart spawner when dd changes “พอดีๆ”
  if(!isStudy){
    let lastDD = 999;
    STATE.ddTick = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;

      const dd = computeDD();
      if(dd !== lastDD){
        lastDD = dd;
        applyDD(dd);
        // restart spawner with new weights/rate (play mode only)
        startSpawner(mount);
      }
    }, 1000);
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}