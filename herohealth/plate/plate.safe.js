// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION + AI PACK)
// ------------------------------------------------
// ✅ Plate core + decorateTarget emoji (food5-th.js)
// ✅ AI Pack (Prediction + ML-lite difficulty + pattern generator + explainable coach)
//   - play: AI ON by default (can disable via ?ai=0)
//   - research/study: AI OFF always (deterministic research)
// ✅ Emits: hha:ai, hha:boss, hha:storm (hooks)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { emojiForGroup, pickEmoji, labelForGroup, JUNK } from '../vr/food5-th.js';
import { createAIHooks } from '../vr/ai-hooks.js';

const WIN = window;

const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };
const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0);
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

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

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null,

  // AI
  ai:null,
  tuned:null,
  stormUntil:0,
  bossOn:false
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitQuest(){
  emit('quest:update', {
    goal:{ name: STATE.goal.name, sub: STATE.goal.sub, cur: STATE.goal.cur, target: STATE.goal.target },
    mini:{ name: STATE.mini.name, sub: STATE.mini.sub, cur: STATE.mini.cur, target: STATE.mini.target, done: STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}

function addScore(v){ STATE.score += v; emitScore(); }
function addCombo(){ STATE.combo++; STATE.comboMax = Math.max(STATE.comboMax, STATE.combo); }
function resetCombo(){ STATE.combo = 0; }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function metricsSnapshot(extra={}){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  const missRate = total > 0 ? (STATE.miss / total) : 0;
  const junkRate = total > 0 ? (STATE.hitJunk / total) : 0;
  return {
    leftSec: STATE.timeLeft,
    totalSec: Number(STATE.cfg?.durationPlannedSec || 90),
    accuracy: accuracy(),
    missRate,
    junkRate,
    combo: STATE.combo,
    score: STATE.score,
    ...extra
  };
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

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

  try{ STATE.engine?.stop?.(); }catch{}
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // AI pattern tick every sec (cheap)
    try{
      STATE.ai?.patternTick?.(metricsSnapshot());
    }catch{}

    // storm expiry
    if(STATE.stormUntil && performance.now() > STATE.stormUntil){
      STATE.stormUntil = 0;
      emit('hha:storm', { on:false });
      const stormFx = document.getElementById('stormFx');
      if(stormFx) stormFx.classList.remove('storm-on');
    }

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function decorateTarget(el, target){
  // storm visual: slight shake + cyan glow
  const inStorm = STATE.stormUntil && performance.now() < STATE.stormUntil;
  if(inStorm){
    el.style.animationDuration = '1.0s';
    el.style.boxShadow += ', 0 0 22px rgba(34,211,238,.22)';
  }

  if(target.kind === 'junk'){
    const emo = pickEmoji(target.rng, JUNK.emojis);
    el.innerHTML = `<span class="fg-emoji">${emo}</span>`;
    el.dataset.group = 'junk';
    el.title = 'ขยะอาหาร';
    return;
  }

  const groupId = (Number(target.groupIndex)||0) + 1;
  const emo = emojiForGroup(target.rng, groupId);
  const label = labelForGroup(groupId);

  el.innerHTML = `
    <span class="fg-emoji">${emo}</span>
    <span class="fg-label">${label.replace('หมู่ ', 'หมู่')}</span>
  `;
  el.dataset.group = String(groupId);
  el.title = label;
}

/* ------------------------------------------------
 * Hit handlers (AI updates included)
 * ------------------------------------------------ */
function afterEventAI(extra){
  try{
    STATE.ai?.updateAfterEvent?.(metricsSnapshot(extra));
    const tune = STATE.ai?.tuneDifficulty?.();
    if(tune) STATE.tuned = tune;
  }catch{}
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
  afterEventAI({ justHit:true, kind:'good' });

  if(STATE.goal.done && STATE.mini.done){
    addScore(250);
    coach('ผ่านภารกิจครบ! 🌟', 'System');
    endGame('cleared');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
  afterEventAI({ justHit:true, kind:'junk' });

  // if junk hits too much -> short storm warning (fun pressure)
  if(STATE.ai?.enabled && STATE.hitJunk >= 3 && (accuracy() < 0.8)){
    const stormFx = document.getElementById('stormFx');
    if(stormFx) stormFx.classList.add('storm-on');
    STATE.stormUntil = performance.now() + 1400;
    emit('hha:storm', { on:true, ms: 1400, reason:'junk_combo' });
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  afterEventAI({ kind:'expire' });
}

/* ------------------------------------------------
 * Spawn tuning (AI Difficulty Director)
 * ------------------------------------------------ */
function baseSpawn(diff){
  if(diff === 'hard') return { spawnRate: 650, sizeRange:[42,58], ttlGood: 1900, ttlJunk: 1550, junkW: 0.30 };
  if(diff === 'easy') return { spawnRate: 980, sizeRange:[48,72], ttlGood: 2300, ttlJunk: 1750, junkW: 0.22 };
  return { spawnRate: 820, sizeRange:[44,64], ttlGood: 2100, ttlJunk: 1700, junkW: 0.28 };
}

function makeSpawner(mount){
  const diff = STATE.cfg.diff;
  const base = baseSpawn(diff);

  // apply AI tuning (if any)
  const tuned = STATE.tuned;
  const spawnRate = tuned ? Math.round(base.spawnRate / tuned.spawnRateMul) : base.spawnRate;
  const ttlMul = tuned ? tuned.ttlMul : 1.0;
  const junkMul = tuned ? tuned.junkWeightMul : 1.0;

  const junkW = clamp(base.junkW * junkMul, 0.16, 0.40);
  const goodW = 1.0 - junkW;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange: base.sizeRange,
    kinds:[
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
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
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

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
  const seed = Number(cfg.seed || Date.now());
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(seed);
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // AI enable rules
  const wantAI = (cfg.aiEnabled === true);
  const autoAI = (cfg.runMode === 'play');         // play on by default
  const aiEnabled = (cfg.runMode === 'research' || cfg.runMode === 'study') ? false : (wantAI || autoAI);

  STATE.ai = createAIHooks({
    enabled: aiEnabled,
    seed,
    difficulty: cfg.diff,
    emit: (n,d)=>emit(n,d),
    coachEmit: (msg,tag)=>coach(msg,tag)
  });

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    ai: aiEnabled ? 'on' : 'off'
  });

  emitScore();
  emitQuest();
  startTimer();

  // start spawner
  STATE.tuned = null;
  STATE.stormUntil = 0;
  STATE.engine = makeSpawner(mount);

  coach(aiEnabled ? 'เริ่มเลย! โหมด AI พร้อมช่วยปรับความยาก 🤖🍽️' : 'เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}