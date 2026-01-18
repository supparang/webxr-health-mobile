// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION, PATCHED)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish ON (spawn tuning)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses: ../vr/mode-factory.js (export boot)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) handled by mode-factory
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || 1) >>> 0;
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

function pctInt(n){
  n = Number(n) || 0;
  return Math.round(n);
}

/* ------------------------------------------------
 * Emoji sets (ไม่น่าเบื่อ: หมู่ละหลายตัว)
 * ------------------------------------------------ */
const EMOJI = {
  g1: ['🥦','🥬','🥒','🥕','🍅'],        // ผัก
  g2: ['🍎','🍌','🍇','🍊','🍉'],        // ผลไม้
  g3: ['🐟','🍗','🥚','🫘','🥩'],        // โปรตีน
  g4: ['🍚','🍞','🥔','🍜','🌽'],        // แป้ง/คาร์บ
  g5: ['🥑','🥜','🧀','🫒','🥥'],        // ไขมันดี/นม
  junk: ['🍩','🍟','🥤','🍫','🧁'],      // ของหวาน/ทอด
  shield: ['🛡️']                        // ไอเท็ม
};

function pick(rng, arr){
  if(!arr || !arr.length) return '❓';
  return arr[Math.floor(rng() * arr.length)];
}

/* ------------------------------------------------
 * Engine State
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // hits
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // time
  timeLeft:0,
  timer:null,

  // shield
  shield:0,

  // groups collected count (raw)
  g:[0,0,0,0,0], // 0..4

  // quests
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บให้ครบทุกหมู่ (อย่างน้อย 1 ชิ้นต่อหมู่)',
    cur:0, target:5, done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false
  },

  cfg:null,
  rng:Math.random,
  spawner:null,

  // for UI/logic
  lastCoachAt:0
};

/* ------------------------------------------------
 * Coach
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  // rate-limit เล็กน้อย กันเด้งถี่
  const t = Date.now();
  if(t - STATE.lastCoachAt < 550) return;
  STATE.lastCoachAt = t;
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * HUD events
 * ------------------------------------------------ */
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
    allDone: (STATE.goal.done && STATE.mini.done)
  });
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracyGood(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += Number(v)||0;
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  try{ STATE.spawner?.stop?.(); }catch(_){}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pctInt(accuracyGood() * 100),

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
 * Logic: update quests
 * ------------------------------------------------ */
function updateGoal(){
  // จำนวนหมู่ที่มีอย่างน้อย 1
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMini(){
  const accPct = accuracyGood() * 100;
  STATE.mini.cur = pctInt(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoal();
  updateMini();
  emitQuest();
}

function onHitJunk(){
  // shield blocks junk hit -> no miss
  if(STATE.shield > 0){
    STATE.shield--;
    coach('โล่ป้องกันไว้แล้ว! 🛡️', 'Shield');
    // ให้คะแนนนิดหน่อยเพื่อรู้สึกดี
    addScore(10);
    return;
  }

  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-55);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  updateMini();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateMini();
  emitQuest();
}

function onHitShield(){
  STATE.shield = clamp(STATE.shield + 1, 0, 5);
  coach('ได้โล่แล้ว! กันพลาดได้ 1 ครั้ง 🛡️', 'Shield');
  addScore(25);
}

/* ------------------------------------------------
 * Spawner config (tuned)
 * ------------------------------------------------ */
function makeKinds(){
  // groupIndex 0..4 for good foods
  const goodWeights = [
    { kind:'good', weight:1, data:{ groupIndex:0, emoji: pick(STATE.rng, EMOJI.g1) } },
    { kind:'good', weight:1, data:{ groupIndex:1, emoji: pick(STATE.rng, EMOJI.g2) } },
    { kind:'good', weight:1, data:{ groupIndex:2, emoji: pick(STATE.rng, EMOJI.g3) } },
    { kind:'good', weight:1, data:{ groupIndex:3, emoji: pick(STATE.rng, EMOJI.g4) } },
    { kind:'good', weight:1, data:{ groupIndex:4, emoji: pick(STATE.rng, EMOJI.g5) } },
  ];

  // junk + shield
  const junk = { kind:'junk', weight:2.0, data:{ emoji: pick(STATE.rng, EMOJI.junk) } };
  const shield = { kind:'shield', weight:0.35, data:{ emoji: '🛡️' } };

  // total mix
  return [...goodWeights, junk, shield];
}

function makeSpawner(mount){
  const view = (STATE.cfg.view || '').toLowerCase();

  // มือถือ/cVR: เป้าต้องไม่เล็กเกิน และไม่หายไวเกิน
  const sizeRange = (view === 'mobile' || view === 'cvr' || view === 'vr')
    ? [52, 78]
    : [46, 70];

  // play: เร็วนิด ๆ (ให้สนุก), research: คงที่ (deterministic)
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  let spawnRate = 900;
  if(diff === 'easy') spawnRate = 980;
  if(diff === 'hard') spawnRate = 760;

  // play mode เร่งนิด ๆ ให้มันส์ขึ้น
  if(!isResearch) spawnRate = Math.max(680, spawnRate - 70);

  const ttlMs = (view === 'mobile' || view === 'cvr' || view === 'vr') ? 1700 : 1500;
  const maxAlive = (view === 'mobile' || view === 'cvr' || view === 'vr') ? 7 : 6;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    spawnRate,
    ttlMs,
    maxAlive,
    sizeRange,

    kinds: makeKinds(),

    onHit: (t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else if(t.kind === 'shield'){
        onHitShield();
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(t.kind === 'good'){
        onExpireGood();
      }
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset state
  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.shield = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const runMode = (STATE.cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    // play: non-deterministic ok
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = clamp(STATE.cfg.durationPlannedSec ?? 90, 10, 999);

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: STATE.cfg.diff || 'normal',
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // sanity check mount rect
  const r = mount.getBoundingClientRect();
  if(!r || r.width < 40 || r.height < 40){
    console.warn('[PlateVR] mount rect too small', r);
    coach('พื้นที่เล่นเล็กไป — ตรวจว่า #plate-layer ไม่โดนซ่อน/ทับ', 'System');
  }

  emitQuest();
  startTimer();

  // start spawner
  try{
    STATE.spawner = makeSpawner(mount);
  }catch(err){
    console.error('[PlateVR] spawner error', err);
    coach('Spawner เริ่มไม่สำเร็จ (เช็ค mode-factory.js)', 'System');
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}