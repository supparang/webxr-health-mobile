// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + FUN PATCH (Boss/Storm/Speed-up)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss/Storm hooks: toggles + judge events
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Emoji targets via hha-emoji-pack + mode-factory decorateTarget
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { decorateEmojiTarget } from '../vr/hha-emoji-pack.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
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

function qsel(id){ return DOC.getElementById(id); }

/* ------------------------------------------------
 * Difficulty tuning (kid-friendly)
 * ------------------------------------------------ */
const DIFF = Object.freeze({
  easy:   { spawn: 980, size:[46,66], wGood:.76, ttlG:2350, ttlJ:1850, scoreGood:95,  scoreJunk:-40 },
  normal: { spawn: 900, size:[44,64], wGood:.72, ttlG:2150, ttlJ:1750, scoreGood:100, scoreJunk:-50 },
  hard:   { spawn: 820, size:[42,62], wGood:.68, ttlG:1950, ttlJ:1650, scoreGood:110, scoreJunk:-60 },
});

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

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn controller
  spawner:null,

  // phase
  phase:'warmup', // warmup | boss | storm
  bossOn:false,
  stormOn:false,

  // ai hooks (light prediction + ML/DL hooks)
  ai:{
    enabled:false,
    // rule-based “prediction” for fun UX (NOT ML)
    predictNextGroup(){
      // suggest missing group first
      const have = STATE.g.map(v=>v>0);
      const missing = [];
      for(let i=0;i<5;i++) if(!have[i]) missing.push(i);
      if(missing.length) return missing[0]; // index 0..4
      // otherwise: keep balance by lowest count
      let minI = 0, minV = STATE.g[0];
      for(let i=1;i<5;i++){ if(STATE.g[i] < minV){ minV = STATE.g[i]; minI = i; } }
      return minI;
    },
    // ML/DL future: consume events for dataset (kept deterministic-safe)
    onEvent(_name,_payload){ /* no-op */ },
  }
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
  STATE.ai.onEvent('coach', { msg, tag });
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
  STATE.score += v;
  emitScore();
  STATE.ai.onEvent('score', { score: STATE.score, delta:v, combo:STATE.combo });
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
 * Phase FX (DOM optional)
 * ------------------------------------------------ */
function setBoss(on){
  STATE.bossOn = !!on;
  const fx = qsel('bossFx');
  if(fx){
    fx.classList.toggle('boss-on', STATE.bossOn);
    fx.classList.toggle('boss-panic', STATE.bossOn && STATE.timeLeft <= 18);
  }
  emit('hha:judge', { type:'boss', on: STATE.bossOn });
}

function setStorm(on){
  STATE.stormOn = !!on;
  const fx = qsel('stormFx');
  if(fx) fx.classList.toggle('storm-on', STATE.stormOn);
  emit('hha:judge', { type:'storm', on: STATE.stormOn });
}

/* ------------------------------------------------
 * Rebuild spawner when speed changes
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;
}

function makeSpawner(mount, tuning){
  stopSpawner();

  const kinds = [
    { kind:'good', weight: tuning.wGood },
    { kind:'junk', weight: 1 - tuning.wGood }
  ];

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: tuning.spawn,
    sizeRange: tuning.size,
    kinds,
    ttlMs: { good: tuning.ttlG, junk: tuning.ttlJ },
    cooldownMs: 90,
    decorateTarget: (el, t)=>decorateEmojiTarget(el, t),
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? (Math.floor(STATE.rng()*5)));
        onHitGood(gi, tuning);
      }else{
        onHitJunk(tuning);
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  return STATE.spawner;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex, tuning){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  const bonus = Math.min(80, STATE.combo * 6);
  addScore((tuning.scoreGood ?? 100) + bonus);

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      emit('hha:judge', { type:'goal', done:true });
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
    emit('hha:judge', { type:'mini', done:true });
  }

  // fun prediction hint (play mode only)
  if(STATE.ai.enabled && !STATE.goal.done && STATE.combo % 4 === 0){
    const next = STATE.ai.predictNextGroup(); // 0..4
    coach(`ทริค! ลองหา “หมู่ ${next+1}” ต่อเลย 🔮`, 'AI Hint');
  }

  emitQuest();
  STATE.ai.onEvent('hit_good', { groupIndex, g:STATE.g.slice(), combo:STATE.combo });
}

function onHitJunk(tuning){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(tuning.scoreJunk ?? -50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  STATE.ai.onEvent('hit_junk', { miss:STATE.miss });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  STATE.ai.onEvent('expire_good', { miss:STATE.miss });
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  stopSpawner();
  setBoss(false);
  setStorm(false);

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

  STATE.ai.onEvent('end', { reason });
}

/* ------------------------------------------------
 * Timer + phase control
 * ------------------------------------------------ */
function startTimer(mount){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // phase triggers
    if(STATE.timeLeft === 30){
      STATE.phase = 'boss';
      setBoss(true);

      // speed up a bit
      const base = DIFF[STATE.cfg.diff] || DIFF.normal;
      const tune = { ...base, spawn: Math.max(540, Math.round(base.spawn * 0.78)), ttlG: Math.max(1400, base.ttlG - 260) };
      makeSpawner(mount, tune);
      coach('⚡ BOSS TIME! เร็วขึ้นแล้วนะ!', 'Boss');
    }
    if(STATE.timeLeft === 15){
      STATE.phase = 'storm';
      setStorm(true);

      const base = DIFF[STATE.cfg.diff] || DIFF.normal;
      const tune = { ...base, spawn: Math.max(460, Math.round(base.spawn * 0.66)), ttlG: Math.max(1200, base.ttlG - 420), wGood: Math.max(.58, base.wGood - .06) };
      makeSpawner(mount, tune);
      coach('🌪️ STORM! ระวังของไม่ดีเยอะขึ้น!', 'Storm');
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
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

  STATE.phase = 'warmup';
  STATE.bossOn = false;
  STATE.stormOn = false;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
    STATE.ai.enabled = false; // keep research clean
  }else{
    STATE.rng = Math.random;
    STATE.ai.enabled = true; // prediction hints in play
  }

  const planned = Number(cfg.durationPlannedSec) || 90;
  STATE.timeLeft = planned;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  setBoss(false);
  setStorm(false);

  // base spawner
  const base = DIFF[cfg.diff] || DIFF.normal;
  makeSpawner(mount, base);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Start');
  startTimer(mount);
}