// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (Difficulty Director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses: mode-factory.js (boot) with decorateTarget(el,target)
// ✅ Uses: food5-th.js mapping (STABLE group 1..5 + JUNK emojis)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End: stops spawner so targets do NOT keep spawning
// ------------------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji, labelForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

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

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
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

  // plate groups (5 หมู่): index 0..4
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
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

  // spawn controller
  spawner:null,

  // coaching
  lastCoachAt:0
};

/* ------------------------------------------------
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', minGapMs=1100){
  const t = nowMs();
  if(t - STATE.lastCoachAt < minGapMs) return;
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
  STATE.score = Math.max(0, (STATE.score + (Number(v)||0)));
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
 * Accuracy (GOOD over {good+junk+expireGood})
 * ------------------------------------------------ */
function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy01() * 100);
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
 * End game (stop spawner!)
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
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
    }
  }, 1000);
}

/* ------------------------------------------------
 * Adaptive Difficulty Director (play only)
 * - Adjusts spawnRate + junk weight gently
 * - Keeps it fair for ป.5: readable & not spammy
 * ------------------------------------------------ */
function directorParams(){
  const acc = accuracyPct();     // 0..100
  const c = STATE.combo;         // current combo
  const t = STATE.timeLeft;      // remaining sec
  const d = String(STATE.cfg?.diff || 'normal');

  // base by diff
  let baseRate = (d === 'hard') ? 720 : (d === 'easy' ? 980 : 860);
  let baseJunk = (d === 'hard') ? 0.34 : (d === 'easy' ? 0.26 : 0.30);

  // if player is doing great, increase challenge a bit
  if(acc >= 88 && c >= 6){
    baseRate -= 140; // faster spawns
    baseJunk += 0.05;
  }else if(acc >= 82 && c >= 3){
    baseRate -= 80;
    baseJunk += 0.03;
  }

  // if struggling, ease off
  if(acc <= 70 || STATE.miss >= 6){
    baseRate += 140;
    baseJunk -= 0.05;
  }else if(acc <= 78 || STATE.miss >= 3){
    baseRate += 80;
    baseJunk -= 0.03;
  }

  // slight ramp-up near end (keeps “เร้าใจ”)
  if(t <= 18){
    baseRate -= 60;
    baseJunk += 0.02;
  }

  const spawnRate = clamp(baseRate, 520, 1100);
  const junkW = clamp(baseJunk, 0.18, 0.42);
  const goodW = 1 - junkW;

  return {
    spawnRate,
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ]
  };
}

/* ------------------------------------------------
 * Target decoration (emoji + label by group)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // good => group 1..5, junk => JUNK
  const kind = target.kind || 'good';

  // groupIndex from mode-factory: 0..4
  const gid = clamp((target.groupIndex ?? 0) + 1, 1, 5);

  // pick emoji deterministically with provided rng
  const rng = target.rng || STATE.rng;

  let emoji = '🍽️';
  let title = '';

  if(kind === 'junk'){
    emoji = pickEmoji(rng, JUNK.emojis);
    title = `${JUNK.labelTH}`;
    el.dataset.group = 'junk';
  }else{
    emoji = emojiForGroup(rng, gid);
    title = `${labelForGroup(gid)}`;
    el.dataset.group = `g${gid}`;
  }

  el.textContent = emoji;
  el.setAttribute('role','button');
  el.setAttribute('aria-label', title);
  el.title = title;

  // small extra: size-based font scaling
  const s = Number(target.size)||54;
  const fs = clamp(Math.round(s * 0.55), 20, 40);
  el.style.fontSize = `${fs}px`;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex0){
  STATE.hitGood++;
  const gi = clamp(groupIndex0 ?? 0, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress: number of groups touched at least once
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }else if(STATE.goal.cur === 3){
      coach('เหลืออีก 2 หมู่! ลุยต่อ 👀', 'Coach');
    }
  }

  // mini (accuracy)
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emit('hha:judge', { type:'good', group: gi+1, combo: STATE.combo, accPct: acc });
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  const acc = accuracyPct();
  STATE.mini.cur = acc;

  emit('hha:judge', { type:'junk', combo: STATE.combo, accPct: acc });
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 1200);
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  const acc = accuracyPct();
  STATE.mini.cur = acc;

  emit('hha:judge', { type:'expire', accPct: acc });
  // ไม่สแปมโค้ชตอนหมดอายุ — แค่บางครั้ง
  if(STATE.expireGood % 3 === 0) coach('เร็วเข้า! ของดีหายไปแล้ว 😅', 'Coach', 1400);
  emitQuest();
}

/* ------------------------------------------------
 * Spawner
 * ------------------------------------------------ */
function makeSpawner(mount){
  const cfg = STATE.cfg || {};
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');

  // research: fixed params, no adaptive
  const base = {
    spawnRate: (cfg.diff === 'hard') ? 720 : (cfg.diff === 'easy' ? 980 : 860),
    kinds: [
      { kind:'good', weight: 0.70 },
      { kind:'junk', weight: 0.30 }
    ]
  };

  const params = isStudy ? base : directorParams();

  return spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate: params.spawnRate,
    sizeRange: [46, 68],
    kinds: params.kinds,

    decorateTarget, // ✅ emoji by group + junk

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Adaptive loop (play only): update spawner by restarting it
 * - cheap & safe for DOM spawner
 * ------------------------------------------------ */
function startAdaptiveLoop(mount){
  const cfg = STATE.cfg || {};
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');
  if(isStudy) return;

  // every ~4s, re-create spawner with new params (smooth enough)
  const tickMs = 4000;
  const adaptiveTimer = setInterval(()=>{
    if(STATE.ended || !STATE.running){ clearInterval(adaptiveTimer); return; }

    // restart spawner with new params
    stopSpawner();
    STATE.spawner = makeSpawner(mount);

  }, tickMs);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset core state
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

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.lastCoachAt = 0;

  // RNG: always seeded for stability (even play) — adaptive decisions are still reproducible per seed
  STATE.rng = seededRng(STATE.cfg.seed || Date.now());

  // duration
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // start spawner
  stopSpawner();
  STATE.spawner = makeSpawner(mount);

  // adaptive loop (play only)
  startAdaptiveLoop(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 0);
}