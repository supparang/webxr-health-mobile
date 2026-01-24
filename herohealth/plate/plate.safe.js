// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Uses mode-factory.js (boot + decorateTarget)
// ✅ Emoji by Thai 5 food groups (fixed mapping)
// ✅ Play / Research modes
//   - play: adaptive ON (soft restart spawner)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end, hha:ai:features
// ✅ Supports: Boss/Storm hooks (CSS layers optional)
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
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

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
}

function setFx(id, cls, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(cls); else el.classList.remove(cls);
}

/* ------------------------------------------------
 * Emoji packs (Thai 5 food groups — fixed mapping)
 * หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 * ------------------------------------------------ */
const G_EMOJI = {
  g1: ['🥩','🥛','🥚','🫘','🐟','🧀'],
  g2: ['🍚','🍞','🥔','🍠','🍜','🥖','🍙'],
  g3: ['🥬','🥦','🥕','🌽','🥒','🍅'],
  g4: ['🍎','🍌','🍊','🍉','🍇','🍍'],
  g5: ['🥑','🫒','🥜','🧈','🌰']
};

const JUNK_EMOJI = ['🍟','🍔','🍕','🍩','🍰','🍭','🍫','🥤'];

function pickFrom(arr, rng){
  if(!arr || !arr.length) return '⭐';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[clamp(i,0,arr.length-1)];
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

  // plate groups (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ + สตรีค',
    sub:'ความแม่น ≥ 80% และเก็บดีติดกัน ≥ 6',
    cur:0,
    target:80,
    done:false,
    streak:0,
    streakTarget:6
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg / rng
  cfg:null,
  rng:Math.random,
  adaptiveOn:false,

  // spawner
  spawner:null,
  spawnRate:900,
  weights:{ good:0.72, junk:0.28 },
  lastAdaptAt:0,

  // ai tick
  aiTimer:null,
  startAt:0,
};

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
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
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
  emitScore();
}

/* ------------------------------------------------
 * FX hooks (optional)
 * ------------------------------------------------ */
function updateFx(){
  // Boss feel: combo high => bossFx on
  setFx('bossFx', 'boss-on', STATE.combo >= 10);
  // Panic: too many misses quickly
  setFx('bossFx', 'boss-panic', STATE.miss >= 6 && accuracy() < 0.65);

  // Storm feel: late game + hard
  const late = STATE.timeLeft <= Math.max(10, Math.floor((STATE.cfg?.durationPlannedSec||90) * 0.25));
  const isHard = (STATE.cfg?.diff === 'hard');
  setFx('stormFx', 'storm-on', late && isHard);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.aiTimer);

  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;

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

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
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
    updateFx();
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Decorate targets (emoji by group)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // Good: emoji by groupIndex 0..4 => g1..g5
  if(t.kind === 'good'){
    const key = ['g1','g2','g3','g4','g5'][t.groupIndex] || 'g1';
    const em = pickFrom(G_EMOJI[key], t.rng);
    el.textContent = em; // simple + crisp
    el.dataset.group = key;
  }else{
    // Junk
    el.textContent = pickFrom(JUNK_EMOJI, t.rng);
    el.dataset.group = 'junk';
  }
}

/* ------------------------------------------------
 * Adaptive difficulty (Play only)
 * - Soft: adjust spawnRate + junk weight
 * - Apply by restarting spawner at most every ~6s
 * ------------------------------------------------ */
function maybeAdapt(){
  if(!STATE.adaptiveOn || !STATE.running || STATE.ended) return;

  const t = nowMs();
  if(t - STATE.lastAdaptAt < 6000) return;

  const acc = accuracy();
  const pace = (STATE.hitGood + STATE.hitJunk + STATE.expireGood) / Math.max(1, (t - STATE.startAt) / 1000);
  const goodStreak = STATE.mini.streak;

  // baseline by diff
  const baseRate = (STATE.cfg.diff === 'hard') ? 720 : (STATE.cfg.diff === 'easy' ? 980 : 860);

  let rate = baseRate;
  let junkW = (STATE.cfg.diff === 'hard') ? 0.34 : (STATE.cfg.diff === 'easy' ? 0.24 : 0.28);

  // If player is doing well -> faster + slightly more junk
  if(acc >= 0.86 && (STATE.combo >= 6 || goodStreak >= 6)){
    rate = Math.max(620, baseRate - 110);
    junkW = Math.min(0.42, junkW + 0.04);
  }
  // If struggling -> slower + less junk
  if(acc <= 0.70 || STATE.miss >= 5){
    rate = Math.min(1050, baseRate + 130);
    junkW = Math.max(0.18, junkW - 0.05);
  }

  // If super slow pace -> give chance (slower)
  if(pace < 0.9){
    rate = Math.min(1100, rate + 80);
  }

  // Apply only if meaningful change
  const changed = (Math.abs(rate - STATE.spawnRate) >= 50) || (Math.abs(junkW - STATE.weights.junk) >= 0.03);
  if(!changed) return;

  STATE.spawnRate = rate;
  STATE.weights.junk = junkW;
  STATE.weights.good = 1 - junkW;
  STATE.lastAdaptAt = t;

  restartSpawner();
}

/* ------------------------------------------------
 * Spawn / Restart spawner
 * ------------------------------------------------ */
function buildSpawnerOpts(mount){
  const kinds = [
    { kind:'good', weight: STATE.weights.good },
    { kind:'junk', weight: STATE.weights.junk }
  ];

  const sizeRange = (STATE.cfg.diff === 'hard')
    ? [42, 62]
    : (STATE.cfg.diff === 'easy' ? [48, 70] : [44, 66]);

  return {
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRate,
    sizeRange,
    kinds,
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  };
}

function restartSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;

  const mount = STATE.cfg?._mount;
  if(!mount) return;

  STATE.spawner = spawnBoot(buildSpawnerOpts(mount));
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.mini.streak++;
  addCombo();

  // score (combo bonus)
  addScore(100 + STATE.combo * 6);

  // goal progress: count unique groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini: accuracy + streak
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done){
    if(accPct >= STATE.mini.target && STATE.mini.streak >= STATE.mini.streakTarget){
      STATE.mini.done = true;

      // Play reward only (research strict)
      if(STATE.cfg.runMode === 'play'){
        const bonus = 8; // ⭐ time bonus
        STATE.timeLeft += bonus;
        coach(`สุดยอด! +${bonus}s (ความแม่น & สตรีคผ่านแล้ว) ✅`, 'Coach');

        // Optional celebrate hook
        emit('hha:celebrate', { kind:'mini', bonusSec: bonus });
      }else{
        coach('ผ่านมินิเควสแล้ว ✅', 'Coach');
      }
    }
  }

  emitQuest();
  updateFx();
  maybeAdapt();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  STATE.mini.streak = 0;

  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  emitQuest();
  updateFx();
  maybeAdapt();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  STATE.mini.streak = 0;

  resetCombo();
  // no score penalty (optional), but counts miss
  emitQuest();
  updateFx();
  maybeAdapt();
}

/* ------------------------------------------------
 * AI hooks (Prediction/ML/DL-ready)
 * - Emits compact features every 2s (play+research)
 * - Deterministic-safe (no random influence)
 * ------------------------------------------------ */
function startAiTicker(){
  clearInterval(STATE.aiTimer);

  STATE.aiTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    const t = nowMs();
    const elapsed = Math.max(0, (t - STATE.startAt) / 1000);

    const feat = {
      game:'plate',
      tSec: Math.round(elapsed),
      diff: STATE.cfg.diff,
      runMode: STATE.cfg.runMode,

      score: STATE.score,
      combo: STATE.combo,
      comboMax: STATE.comboMax,
      miss: STATE.miss,

      hitGood: STATE.hitGood,
      hitJunk: STATE.hitJunk,
      expireGood: STATE.expireGood,
      acc: Math.round(accuracy()*1000)/1000,

      g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

      spawnRate: STATE.spawnRate,
      junkW: Math.round(STATE.weights.junk*1000)/1000
    };

    emit('hha:ai:features', feat);
  }, 2000);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.cfg._mount = mount;

  // mode
  const runMode = (STATE.cfg.runMode || 'play').toLowerCase();
  STATE.adaptiveOn = (runMode === 'play'); // ✅ research/study OFF

  // RNG: deterministic for research/study, free for play
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // reset
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
  STATE.mini.streak = 0;

  // time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // difficulty baseline
  STATE.spawnRate = (STATE.cfg.diff === 'hard') ? 760 : (STATE.cfg.diff === 'easy' ? 980 : 860);
  STATE.weights = {
    junk: (STATE.cfg.diff === 'hard') ? 0.34 : (STATE.cfg.diff === 'easy' ? 0.24 : 0.28),
    good: 0.0
  };
  STATE.weights.good = 1 - STATE.weights.junk;

  STATE.startAt = nowMs();
  STATE.lastAdaptAt = 0;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();
  startAiTicker();

  // start spawner
  restartSpawner();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}