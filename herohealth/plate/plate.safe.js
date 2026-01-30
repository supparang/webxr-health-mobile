// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — LATEST
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON + predictor ON (DL-lite heuristic)
//   - research/study: deterministic seed + adaptive OFF + predictor OFF
// ✅ Uses mode-factory.js spawn engine (boot)
//   - decorateTarget(el,target) => emoji per Thai 5 groups + junk
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End game: stop spawner (กันเป้า “แว๊บๆ” หลังจบ)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

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

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
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

  // Thai groups counters (index 0..4 => group 1..5)
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

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawn engine instance
  spawner:null,

  // adaptive knobs (play only)
  spawnRateMs: 900,
  goodWeight: 0.72,
  junkWeight: 0.28,
  ttlGood: 2100,
  ttlJunk: 1700,

  // predictor (play only): EWMA features
  pred:{
    on:false,
    emaAcc: 0.85,
    emaCombo: 2.0,
    emaMissRate: 0.10,
    lastTickMs: 0,
    lastTipAt: 0
  },

  // anti-spam coach
  coach:{
    lastAt:0
  }
};

/* ------------------------------------------------
 * FX helpers (optional)
 * ------------------------------------------------ */
function fxPop(x, y, text, cls){
  try{
    if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
      WIN.Particles.popText(x, y, text, cls);
    }
  }catch(_){}
}

/* ------------------------------------------------
 * Coach helper (rate-limit)
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  const t = nowMs();
  if(t - (STATE.coach.lastAt||0) < 900) return;
  STATE.coach.lastAt = t;
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
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
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
 * DL-lite predictor (heuristic) — play only
 * predicts “risk of miss soon” based on EMA
 * ------------------------------------------------ */
function predictorReset(){
  STATE.pred.emaAcc = 0.85;
  STATE.pred.emaCombo = 2.0;
  STATE.pred.emaMissRate = 0.10;
  STATE.pred.lastTickMs = nowMs();
  STATE.pred.lastTipAt = 0;
}

function predictorUpdate(){
  if(!STATE.pred.on) return;
  const a = accuracy(); // 0..1
  const combo = clamp(STATE.combo, 0, 50);
  const missRate = clamp(STATE.miss / Math.max(1, (STATE.hitGood+STATE.hitJunk+STATE.expireGood)), 0, 1);

  // EMA
  const k = 0.08;
  STATE.pred.emaAcc = STATE.pred.emaAcc*(1-k) + a*k;
  STATE.pred.emaCombo = STATE.pred.emaCombo*(1-k) + combo*k;
  STATE.pred.emaMissRate = STATE.pred.emaMissRate*(1-k) + missRate*k;

  // risk score (0..1)
  let risk = 0.0;
  risk += (1 - clamp(STATE.pred.emaAcc, 0, 1)) * 0.55;
  risk += clamp(STATE.pred.emaMissRate, 0, 1) * 0.35;
  risk += (STATE.pred.emaCombo < 2 ? 0.10 : 0);
  risk = clamp(risk, 0, 1);

  emit('hha:judge', {
    model:'dl-lite',
    riskSoon: Math.round(risk*100),
    emaAcc: Math.round(STATE.pred.emaAcc*100),
    emaMissRate: Math.round(STATE.pred.emaMissRate*100),
    emaCombo: Math.round(STATE.pred.emaCombo*10)/10
  });

  // micro-tip
  const t = nowMs();
  if(t - (STATE.pred.lastTipAt||0) > 6000){
    if(risk >= 0.68) {
      coach('ช้าลงนิดนึง แล้วเล็งให้ชัวร์ 🎯', 'AI Coach');
      STATE.pred.lastTipAt = t;
    } else if(risk <= 0.25 && STATE.combo >= 6) {
      coach('โห คอมโบดีมาก! เพิ่มสปีดได้อีก 🔥', 'AI Coach');
      STATE.pred.lastTipAt = t;
    }
  }
}

/* ------------------------------------------------
 * Adaptive difficulty (play only)
 * ------------------------------------------------ */
function baseByDiff(diff){
  // defaults
  let spawnRateMs = 900;
  let goodW = 0.72, junkW = 0.28;
  let ttlGood = 2200, ttlJunk = 1750;

  if(diff === 'easy'){
    spawnRateMs = 980;
    goodW = 0.78; junkW = 0.22;
    ttlGood = 2350; ttlJunk = 1800;
  } else if(diff === 'hard'){
    spawnRateMs = 760;
    goodW = 0.66; junkW = 0.34;
    ttlGood = 2000; ttlJunk = 1650;
  }
  return { spawnRateMs, goodW, junkW, ttlGood, ttlJunk };
}

function adaptTick(){
  if(!STATE.running || STATE.ended) return;
  if(!(STATE.cfg && (STATE.cfg.runMode || '').toLowerCase() === 'play')) return;

  const a = accuracy();
  const combo = STATE.combo;
  const miss = STATE.miss;

  let d = 0;
  if(a >= 0.88) d += 0.35;
  if(a <= 0.72) d -= 0.35;
  if(combo >= 7) d += 0.25;
  if(miss >= 6) d -= 0.25;
  d = clamp(d, -1, 1);

  const base = baseByDiff((STATE.cfg.diff||'normal').toLowerCase());
  const rate = base.spawnRateMs + (-140 * d);
  const junkW = clamp(base.junkW + (0.08 * d), 0.14, 0.46);
  const goodW = clamp(1 - junkW, 0.54, 0.86);

  const ttlGood = clamp(base.ttlGood + (-220 * d), 1500, 2800);
  const ttlJunk = clamp(base.ttlJunk + (-160 * d), 1200, 2400);

  STATE.spawnRateMs = Math.round(rate);
  STATE.goodWeight = goodW;
  STATE.junkWeight = junkW;
  STATE.ttlGood = Math.round(ttlGood);
  STATE.ttlJunk = Math.round(ttlJunk);
}

/* ------------------------------------------------
 * End game (stop spawner)
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch(_){}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.__ADAPT_TICK__);
  clearInterval(STATE.__PRED_TICK__);

  stopSpawner(); // ✅ กันเป้าแว๊บหลังจบ

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
function onHitGood(groupIndex, meta){
  STATE.hitGood++;
  if(groupIndex < 0 || groupIndex > 4) groupIndex = clamp(groupIndex, 0, 4);
  STATE.g[groupIndex]++;

  addCombo();

  const bonus = clamp(STATE.combo, 0, 30) * 6;
  addScore(100 + bonus);

  try{
    const r = meta && meta.rect;
    if(r) fxPop(r.left + r.width/2, r.top + r.height/2, '+', 'good');
  }catch(_){}

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitQuest();
  predictorUpdate();

  if((STATE.cfg.runMode || '').toLowerCase() === 'play' && STATE.goal.done && STATE.mini.done){
    addScore(250);
    coach('ผ่านด่าน! เก่งมาก 🏆', 'System');
    endGame('cleared');
  }
}

function onHitJunk(meta){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  try{
    const r = meta && meta.rect;
    if(r) fxPop(r.left + r.width/2, r.top + r.height/2, '✖', 'bad');
  }catch(_){}

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();

  predictorUpdate();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();

  predictorUpdate();
}

/* ------------------------------------------------
 * Target decorator (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  const groupId = (Number(target.groupIndex)||0) + 1; // 1..5
  const rng = target && target.rng ? target.rng : STATE.rng;

  if(target.kind === 'junk'){
    el.textContent = pickEmoji(rng, JUNK.emojis);
    el.title = `${JUNK.labelTH} • ${JUNK.descTH}`;
    el.dataset.gid = 'junk';
  }else{
    const emoji = emojiForGroup(rng, groupId);
    el.textContent = emoji;
    el.title = `${labelForGroup(groupId)} • ${FOOD5[groupId]?.descTH || ''}`;
    el.dataset.gid = String(groupId);
  }
}

/* ------------------------------------------------
 * Spawn engine factory
 * ------------------------------------------------ */
function buildSpawner(mount){
  stopSpawner();

  const kinds = [
    { kind:'good', weight: STATE.goodWeight },
    { kind:'junk', weight: STATE.junkWeight }
  ];

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange:[44,64],
    kinds,
    decorateTarget,

    onHit:(t)=>{
      // meta rect for FX (best-effort)
      let rect = null;
      try{
        if(t && t.el && t.el.getBoundingClientRect) rect = t.el.getBoundingClientRect();
      }catch(_){}

      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi, { source:t.source, rect });
      }else{
        onHitJunk({ source:t.source, rect });
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  return STATE.spawner;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

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

  clearInterval(STATE.timer);
  clearInterval(STATE.__ADAPT_TICK__);
  clearInterval(STATE.__PRED_TICK__);
  stopSpawner();

  const runMode = (STATE.cfg.runMode || 'play').toLowerCase();

  // RNG
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // base tuning
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const base = baseByDiff(diff);
  STATE.spawnRateMs = base.spawnRateMs;
  STATE.goodWeight = base.goodW;
  STATE.junkWeight = base.junkW;
  STATE.ttlGood = base.ttlGood;
  STATE.ttlJunk = base.ttlJunk;

  // predictor/adaptive switches
  STATE.pred.on = (runMode === 'play');
  predictorReset();

  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // create spawner
  buildSpawner(mount);

  // adaptive + predictor pulses (play only)
  if(runMode === 'play'){
    STATE.__ADAPT_TICK__ = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;

      const prevRate = STATE.spawnRateMs;
      const prevJunk = STATE.junkWeight;

      adaptTick();

      const dRate = Math.abs(STATE.spawnRateMs - prevRate);
      const dJunk = Math.abs(STATE.junkWeight - prevJunk);

      if(dRate >= 60 || dJunk >= 0.04){
        buildSpawner(mount);
      }
    }, 1200);

    STATE.__PRED_TICK__ = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;
      predictorUpdate();
    }, 1000);
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'System');
}