// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: step-up difficulty (no ML/DL; deterministic-friendly)
//   - research/study: deterministic seed + step-up OFF
// ✅ Uses mode-factory.js (decorateTarget) + food5-th.js emoji pack
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

  // plate groups (5 หมู่) index 0..4 => g1..g5
  g:[0,0,0,0,0],

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

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn engine instance
  engine:null,

  // play step-up director
  directorTimer:null,
  step:0,
  spawnRateNow:900,
  junkWeightNow:0.30,
  goodWeightNow:0.70
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  // ตามนิยามเดิมของคุณ: good hit vs (good hit + junk hit + good expired)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function cleanupSpawner(){
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = null;
}

function cleanupDirector(){
  clearInterval(STATE.directorTimer);
  STATE.directorTimer = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  cleanupDirector();
  cleanupSpawner();

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
function onHitGood(groupIndex0){
  STATE.hitGood++;
  STATE.g[groupIndex0]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress: “ครบ 5 หมู่” = มีอย่างน้อย 1 ชิ้นในแต่ละหมู่
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
 * Target decoration (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // groupIndex in factory: 0..4 (we convert to 1..5 for FOOD5)
  const gid = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  const isGood = (target.kind === 'good');

  let emoji = '❓';
  if(isGood){
    emoji = emojiForGroup(target.rng, gid);
  }else{
    emoji = pickEmoji(target.rng, JUNK.emojis);
  }

  el.dataset.group = String(gid);
  el.setAttribute('aria-label', isGood ? (FOOD5[gid]?.labelTH || 'อาหาร') : (JUNK.labelTH || 'ขยะอาหาร'));

  // simple, crisp center emoji
  el.innerHTML = `<span class="plateEmoji" aria-hidden="true">${emoji}</span>`;
}

/* ------------------------------------------------
 * Spawner build/rebuild
 * ------------------------------------------------ */
function buildKinds(){
  return [
    { kind:'good', weight: STATE.goodWeightNow },
    { kind:'junk', weight: STATE.junkWeightNow }
  ];
}

function startSpawner(mount){
  cleanupSpawner();
  STATE.engine = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateNow,
    sizeRange:[44,64],
    kinds: buildKinds(),
    decorateTarget, // ✅ key patch
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi0 = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi0);
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
 * Play-mode step-up director (สนุก/ท้าทายแบบค่อยๆโหด)
 * - ไม่ใช่ ML/DL: เป็น heuristic ที่ predictable + research-friendly
 * ------------------------------------------------ */
function startDirector(mount){
  cleanupDirector();

  // research/study: ปิด step-up เพื่อคุมความแปรผัน
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study') return;

  STATE.step = 0;

  // ทุก 15 วิ เพิ่มความเร็ว + เพิ่ม junk นิดหน่อย
  STATE.directorTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.step++;

    // step-up caps
    const maxStep = 6;

    // เร่ง spawn: 900 -> 820 -> 760 -> 700 -> 650 -> 610 -> 580
    const rateTable = [900, 820, 760, 700, 650, 610, 580];
    const s = clamp(STATE.step, 0, maxStep);
    STATE.spawnRateNow = rateTable[s];

    // เพิ่ม junk weight: 0.30 -> 0.34 -> 0.38 -> 0.42 -> 0.46 -> 0.50 -> 0.52
    const junkTable = [0.30, 0.34, 0.38, 0.42, 0.46, 0.50, 0.52];
    STATE.junkWeightNow = junkTable[s];
    STATE.goodWeightNow = Math.max(0.48, 1 - STATE.junkWeightNow);

    // rebuild spawner with new params
    startSpawner(mount);

    // โค้ชบอกเป็นช่วงๆ
    if(s === 1) coach('เริ่มเร็วขึ้นแล้วนะ! 😄', 'Coach');
    else if(s === 3) coach('เข้มขึ้นอีกนิด! โฟกัสให้ดี 👀', 'Coach');
    else if(s === 5) coach('โหมดเร้าใจ! ของทอด/หวานมาไว ⚡', 'Coach');
  }, 15000);
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

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // baseline difficulty by diff
  // (diff affects starting spawnRate/junk mix; play director will push further)
  const diff = (cfg.diff || 'normal').toLowerCase();
  if(diff === 'easy'){
    STATE.spawnRateNow = 950;
    STATE.junkWeightNow = 0.26;
  }else if(diff === 'hard'){
    STATE.spawnRateNow = 820;
    STATE.junkWeightNow = 0.36;
  }else{
    STATE.spawnRateNow = 900;
    STATE.junkWeightNow = 0.30;
  }
  STATE.goodWeightNow = 1 - STATE.junkWeightNow;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner + director
  startSpawner(mount);
  startDirector(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}