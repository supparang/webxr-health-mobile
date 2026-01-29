// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (difficulty director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory boot() with decorateTarget(el,target)
// ✅ Emoji targets: Thai Food 5 groups (1..5) + JUNK
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End-game: stop spawner to prevent “targets flashing”
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const nowMs = () => {
  try { return performance.now(); } catch { return Date.now(); }
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

  // plate groups (5 หมู่) index 0..4 => groupId 1..5
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

  // spawner + adaptive director
  spawner:null,
  directorTimer:null,
  spawnParams:null,

  // hooks (boss/storm placeholders)
  bossOn:false,
  stormOn:false
};

/* ------------------------------------------------
 * Quest + Coach
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score + Combo
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
}

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}

function resetCombo(){
  STATE.combo = 0;
  emitScore();
}

/* ------------------------------------------------
 * Accuracy (ตามมาตรฐาน: good expired + junk hit = miss)
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
 * End-game (stop spawner ไม่ให้ “แว๊บๆ”)
 * ------------------------------------------------ */
function stopAllSpawners(){
  try{
    if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
      STATE.spawner.stop();
    }
  }catch(err){
    console.error('[PlateVR] spawner.stop error', err);
  }
  STATE.spawner = null;

  try{ clearInterval(STATE.directorTimer); }catch{}
  STATE.directorTimer = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  stopAllSpawners();

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
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalAndMini(){
  // goal: count unique groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
      emit('hha:judge', { type:'goal', ok:true, goal:'food5_complete' });
    }
  }

  // mini: accuracy
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Mini');
    emit('hha:judge', { type:'mini', ok:true, mini:'accuracy_80' });
  }

  emitQuest();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoalAndMini();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');
  updateGoalAndMini();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateGoalAndMini();
}

/* ------------------------------------------------
 * Adaptive difficulty director (play mode only)
 * ------------------------------------------------ */
function baseSpawnRateByDiff(diff){
  if(diff === 'hard') return 740;
  if(diff === 'easy') return 980;
  return 860; // normal
}

function baseSizeRangeByDiff(diff){
  if(diff === 'hard') return [42,60];
  if(diff === 'easy') return [48,70];
  return [44,64];
}

function computeSpawnParams(){
  const diff = (STATE.cfg?.diff || 'normal');
  const baseRate = baseSpawnRateByDiff(diff);
  const sizeRange = baseSizeRangeByDiff(diff);

  // research/study: fixed params (no adaptive)
  const isResearch = (STATE.cfg?.runMode === 'research' || STATE.cfg?.runMode === 'study');
  if(isResearch){
    return {
      spawnRate: baseRate,
      sizeRange,
      goodW: 0.72,
      junkW: 0.28,
      ttlGood: 2100,
      ttlJunk: 1700
    };
  }

  // play: adaptive
  const acc = accuracy();
  const accPct = acc * 100;
  const combo = STATE.combo;
  const miss = STATE.miss;

  // ramp by time progress
  const dur = Math.max(10, Number(STATE.cfg?.durationPlannedSec)||90);
  const prog = clamp(1 - (STATE.timeLeft / dur), 0, 1); // 0..1

  // difficulty pressure (higher => harder)
  let pressure = 0;
  if(accPct >= 88) pressure += 0.45;
  else if(accPct >= 82) pressure += 0.25;
  else if(accPct <= 70) pressure -= 0.30;

  if(combo >= 10) pressure += 0.25;
  if(combo >= 18) pressure += 0.20;
  if(miss >= 8) pressure -= 0.20;

  pressure += (prog * 0.35);

  // clamp
  pressure = clamp(pressure, -0.45, 0.75);

  // apply
  const spawnRate = Math.round(baseRate * (1 - pressure * 0.28)); // harder => faster
  const goodW = clamp(0.74 - pressure * 0.18, 0.58, 0.82);
  const junkW = clamp(1 - goodW, 0.18, 0.42);

  const ttlGood = Math.round(2100 * (1 - pressure * 0.20));
  const ttlJunk = Math.round(1700 * (1 - pressure * 0.22));

  return {
    spawnRate: clamp(spawnRate, 520, 1200),
    sizeRange,
    goodW,
    junkW,
    ttlGood: clamp(ttlGood, 1200, 2600),
    ttlJunk: clamp(ttlJunk, 900, 2200)
  };
}

function restartSpawner(mount){
  stopAllSpawners();

  STATE.spawnParams = computeSpawnParams();

  const kinds = [
    { kind:'good', weight: STATE.spawnParams.goodW },
    { kind:'junk', weight: STATE.spawnParams.junkW }
  ];

  // ✅ decorate target: set emoji + group selection + TTL
  function decorateTarget(el, target){
    // choose groupIndex (0..4)
    const isResearch = (STATE.cfg?.runMode === 'research' || STATE.cfg?.runMode === 'study');

    let gi = target.groupIndex; // default from factory

    if(target.kind === 'good'){
      if(!isResearch){
        // bias towards missing groups to keep game exciting & goal-driven
        const missing = [];
        for(let i=0;i<5;i++){
          if((STATE.g[i]||0) <= 0) missing.push(i);
        }
        if(missing.length){
          // 70% pick missing, else random
          const r = (typeof target.rng === 'function') ? target.rng() : STATE.rng();
          if(r < 0.70){
            gi = missing[Math.floor(((typeof target.rng==='function')?target.rng():STATE.rng()) * missing.length)];
          }else{
            gi = Math.floor(((typeof target.rng==='function')?target.rng():STATE.rng()) * 5);
          }
        }else{
          gi = Math.floor(((typeof target.rng==='function')?target.rng():STATE.rng()) * 5);
        }
      }else{
        // research: uniform deterministic (already deterministic via seed)
        gi = clamp(gi, 0, 4);
      }

      target.groupIndex = gi;

      // emoji by groupId 1..5
      const groupId = gi + 1;
      const emoji = emojiForGroup(target.rng, groupId);

      // make it “pop” but still safe with existing CSS
      el.textContent = emoji;
      el.dataset.groupId = String(groupId);
      el.setAttribute('aria-label', labelForGroup(groupId));

      // TTL from adaptive params
      target.ttlMs = STATE.spawnParams?.ttlGood ?? target.ttlMs;

    }else{
      // junk
      const emoji = pickEmoji(target.rng, JUNK.emojis);
      el.textContent = emoji;
      el.dataset.groupId = 'junk';
      el.setAttribute('aria-label', JUNK.labelTH || 'Junk');

      target.ttlMs = STATE.spawnParams?.ttlJunk ?? target.ttlMs;
    }
  }

  // create spawner
  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnParams.spawnRate,
    sizeRange: STATE.spawnParams.sizeRange,
    kinds,
    decorateTarget,
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }

      // optional early finish if both quests done
      if(STATE.goal.done && STATE.mini.done){
        // ให้เด็กได้ “รู้สึกชนะ” แบบไวขึ้น (แต่ไม่บังคับ)
        // ยังเหลือเวลาให้เล่นต่อได้ ถ้าอยาก: ปิดบรรทัดนี้
        endGame('all_done');
      }
    },
    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });

  // adaptive director: refresh params occasionally (play mode)
  const isResearch = (STATE.cfg?.runMode === 'research' || STATE.cfg?.runMode === 'study');
  if(!isResearch){
    STATE.directorTimer = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;

      // if params change a lot, restart spawner to apply new spawnRate/weights
      const prev = STATE.spawnParams;
      const next = computeSpawnParams();

      const dr = Math.abs((next.spawnRate||0) - (prev?.spawnRate||0));
      const dw = Math.abs((next.junkW||0) - (prev?.junkW||0));

      // avoid too frequent restarts (only when meaningful)
      if(dr >= 90 || dw >= 0.08){
        restartSpawner(mount);
      }
    }, 1400);
  }
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

  // spawn (with adaptive director if play)
  restartSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Start');
}