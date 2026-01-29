// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — LATEST
// HHA Standard
// ------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON + coach tips (predictor-lite)
//   - research/study: deterministic seed + adaptive OFF + tips minimal
// ✅ Uses mode-factory boot() with decorateTarget(el,target)
// ✅ Emoji mapping fixed Thai 5 groups (food5-th.js)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ End game: stop spawner (no “แว๊บๆ”)
// ✅ Miss rule: miss = hit junk + expire good (consistent)
// ------------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){
  try{ return performance.now(); }catch{ return Date.now(); }
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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

  // plate groups (5 หมู่): index 0..4 => groupId 1..5
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

  // cfg/rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive difficulty director (play only)
  diffLevel: 0, // 0..3
  lastAdaptAt: 0,

  // predictor-lite window (for “AI Prediction” tips)
  recent: [], // {t, type:'good'|'junk'|'expire', combo}
  lastCoachAt: 0
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
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', cooldownMs=1400){
  const t = nowMs();
  if(t - STATE.lastCoachAt < cooldownMs) return;
  STATE.lastCoachAt = t;
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

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Predictor-lite (AI Prediction)
 * - ไม่ใช่ DL จริง แต่เป็น “risk predictor” แบบ online features
 * - play เท่านั้น (research ปิด)
 * ------------------------------------------------ */
function pushRecent(type){
  const t = nowMs();
  STATE.recent.push({ t, type, combo: STATE.combo });
  // keep 20s window
  const cut = t - 20000;
  while(STATE.recent.length && STATE.recent[0].t < cut) STATE.recent.shift();
}

function predictMissRisk(){
  // features: recent junk/expire rate + combo volatility + accuracy trend
  const t = nowMs();
  const w = STATE.recent;
  if(!w.length) return 0;

  let bad = 0, good = 0;
  for(const it of w){
    if(it.type === 'good') good++;
    else bad++;
  }

  // bad ratio
  const ratioBad = bad / Math.max(1, (bad + good));

  // combo volatility: count times combo reset-ish (approx)
  let resets = 0;
  for(let i=1;i<w.length;i++){
    if(w[i].combo === 0 && w[i-1].combo > 0) resets++;
  }
  const vol = resets / Math.max(1, w.length/4);

  // low accuracy boosts risk
  const acc = accuracy();
  const lowAcc = Math.max(0, 0.85 - acc); // only penalize if <85%

  // combine (bounded 0..1)
  let risk = ratioBad*0.55 + vol*0.25 + lowAcc*1.2;
  risk = Math.max(0, Math.min(1, risk));
  // soften early game
  if(t < (STATE.cfg?.__startAt || 0) + 8000) risk *= 0.6;
  return risk;
}

function maybeCoachTip(){
  if(STATE.cfg?.runMode !== 'play') return;
  const t = nowMs();
  if(t - STATE.lastCoachAt < 1600) return;

  const risk = predictMissRisk();
  const accP = accuracyPct();

  if(risk >= 0.72){
    coach('ใกล้พลาดแล้วนะ! โฟกัส “ของหวาน/ทอด” ก่อน แล้วค่อยเก็บให้ครบหมู่ 👀', 'AI Coach', 1600);
  }else if(accP < 80 && (STATE.hitGood + STATE.hitJunk + STATE.expireGood) >= 6){
    coach('ทริค: รอให้เป้า “นิ่ง” นิดเดียวก่อนแตะ จะคุมความแม่นได้ดีขึ้น 🎯', 'AI Coach', 1600);
  }else if(STATE.combo >= 6 && t - STATE.lastCoachAt > 1800){
    coach('คอมโบกำลังมา! เก็บหมู่ที่ยัง “ไม่เคยเก็บ” ให้ครบเร็วขึ้น 🔥', 'AI Coach', 1600);
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{
    if(STATE.spawner && typeof STATE.spawner.stop === 'function') STATE.spawner.stop();
  }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
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

    accuracyGoodPct: accuracyPct(),

    // group counts
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
    }else{
      // play-only coach
      maybeCoachTip();
      // play-only adaptive
      maybeAdapt();
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function updateMini(){
  const accP = accuracyPct();
  STATE.mini.cur = accP;
  if(!STATE.mini.done && accP >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  pushRecent('good');
  updateGoal();
  updateMini();
  emitQuest();

  // win-fast in play (optional): ถ้าครบ goal+mini แล้วให้โบนัสเวลาเล็กน้อย
  if(STATE.cfg?.runMode === 'play' && STATE.goal.done && STATE.mini.done){
    // one-time bonus
    if(!STATE.__bonusGiven){
      STATE.__bonusGiven = true;
      STATE.timeLeft += 6;
      coach('โบนัสเวลา +6s! ไปต่อให้สุด 🔥', 'System', 900);
      emit('hha:time', { leftSec: STATE.timeLeft });
    }
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  pushRecent('junk');

  resetCombo();
  addScore(-60);

  updateMini();
  emitQuest();

  if(STATE.cfg?.runMode === 'play'){
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 900);
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  pushRecent('expire');

  resetCombo();
  updateMini();
  emitQuest();
}

/* ------------------------------------------------
 * Adaptive director (play only)
 * - เปลี่ยนระดับความยากด้วยการ “restart spawner” เป็นช่วง ๆ
 * - research/study ปิด
 * ------------------------------------------------ */
function baseSpawnRateByDiff(diff){
  if(diff === 'hard') return 760;
  if(diff === 'easy') return 980;
  return 880;
}

function makeKinds(level){
  // level 0..3 : เพิ่ม junk weight เมื่อเล่นแม่น/คอมโบสูง
  const jw = [0.26, 0.30, 0.34, 0.38][clamp(level,0,3)];
  return [
    { kind:'good', weight: 1 - jw },
    { kind:'junk', weight: jw }
  ];
}

function makeSpawnRate(level){
  const base = baseSpawnRateByDiff(STATE.cfg?.diff || 'normal');
  const factor = [1.00, 0.92, 0.86, 0.80][clamp(level,0,3)];
  return Math.round(base * factor);
}

function shouldLevelUp(){
  const acc = accuracy();
  return acc >= 0.86 && STATE.comboMax >= 8 && (STATE.hitGood + STATE.hitJunk + STATE.expireGood) >= 10;
}

function shouldLevelDown(){
  const acc = accuracy();
  return acc < 0.74 && (STATE.hitGood + STATE.hitJunk + STATE.expireGood) >= 10;
}

function restartSpawner(newLevel){
  stopSpawner();

  const mount = STATE.__mount;
  if(!mount) return;

  const sr = makeSpawnRate(newLevel);
  const kinds = makeKinds(newLevel);

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: sr,
    sizeRange:[44,64],
    kinds,
    decorateTarget: decorateTargetFn,
    onHit: onHitFromSpawner,
    onExpire: onExpireFromSpawner
  });

  // แจ้งเบา ๆ ไม่รบกวน
  if(STATE.cfg.runMode === 'play'){
    if(newLevel > STATE.diffLevel) coach('เพิ่มความท้าทายขึ้นนิดนึง! 😄', 'AI Director', 1200);
    else if(newLevel < STATE.diffLevel) coach('ลดความยากลงให้เล่นลื่นขึ้น 👍', 'AI Director', 1200);
  }

  STATE.diffLevel = newLevel;
}

function maybeAdapt(){
  if(!STATE.cfg || STATE.cfg.runMode !== 'play') return;
  const t = nowMs();
  if(t - STATE.lastAdaptAt < 6000) return;
  STATE.lastAdaptAt = t;

  let level = STATE.diffLevel;

  if(shouldLevelUp()) level = Math.min(3, level + 1);
  else if(shouldLevelDown()) level = Math.max(0, level - 1);

  if(level !== STATE.diffLevel){
    restartSpawner(level);
  }
}

/* ------------------------------------------------
 * Target decoration (emoji / label)
 * - good: emoji by group 1..5 (deterministic rng)
 * - junk: emoji from JUNK
 * ------------------------------------------------ */
function setTargetContent(el, emoji, title){
  // clear
  while(el.firstChild) el.removeChild(el.firstChild);

  const span = DOC.createElement('span');
  span.className = 'emoji';
  span.textContent = emoji;

  // optional tiny label (tooltip only)
  el.title = title || '';

  el.appendChild(span);
}

function decorateTargetFn(el, target){
  // groupIndex 0..4 => groupId 1..5
  const groupId = (Number(target.groupIndex)||0) + 1;

  if(target.kind === 'good'){
    const em = emojiForGroup(target.rng || STATE.rng, groupId);
    el.dataset.groupId = String(groupId);
    setTargetContent(el, em, `${labelForGroup(groupId)} • แตะเพื่อเก็บ`);
  }else{
    const em = pickEmoji(target.rng || STATE.rng, JUNK.emojis);
    el.dataset.groupId = 'junk';
    setTargetContent(el, em, `${JUNK.labelTH} • เลี่ยง!`);
  }
}

/* ------------------------------------------------
 * Spawner callbacks
 * ------------------------------------------------ */
function onHitFromSpawner(t){
  if(STATE.ended) return;

  if(t.kind === 'good'){
    const gi = clamp((t.groupIndex ?? 0), 0, 4);
    onHitGood(gi);
  }else{
    onHitJunk();
  }
}

function onExpireFromSpawner(t){
  if(STATE.ended) return;
  if(t.kind === 'good') onExpireGood();
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset state
  STATE.cfg = cfg || {};
  STATE.__mount = mount;

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

  STATE.__bonusGiven = false;

  STATE.recent = [];
  STATE.lastCoachAt = 0;

  STATE.lastAdaptAt = 0;
  STATE.diffLevel = 0;

  // deterministic RNG in research/study
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;
  STATE.cfg.__startAt = nowMs();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // spawn config
  const spawnRate = baseSpawnRateByDiff((cfg.diff||'normal').toLowerCase());

  // play: adaptive ON => start at level 0 but allow adjust
  // research/study: fixed weights & no adapt
  const kinds = (cfg.runMode === 'play') ? makeKinds(0) : [
    { kind:'good', weight: 0.72 },
    { kind:'junk', weight: 0.28 }
  ];

  STATE.spawner = spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds,
    decorateTarget: decorateTargetFn,
    onHit: onHitFromSpawner,
    onExpire: onExpireFromSpawner
  });

  // minimal tip
  if(cfg.runMode === 'play'){
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 700);
  }else{
    // research: ลดการรบกวน
    emit('hha:coach', { msg:'เริ่มบันทึกการทดลอง (โหมดวิจัย)', tag:'System' });
  }

  // harden: stop when leaving page
  const onHide = ()=>{
    if(STATE.ended) return;
    // ไม่ยิง end ใน research ถ้าไม่อยาก แต่ตอนนี้ให้ปิดสวย ๆ
    stopSpawner();
    clearInterval(STATE.timer);
  };
  WIN.addEventListener('pagehide', onHide, { once:true });

  // return controller for boot.js
  return {
    stop(){
      stopSpawner();
      clearInterval(STATE.timer);
      STATE.running = false;
      STATE.ended = true;
    },
    end(reason='stop'){
      endGame(reason);
    }
  };
}