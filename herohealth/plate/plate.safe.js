// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - study/research: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ FIX: endGame stops spawner => no target "blink"
// ✅ NEW: decorateTarget => emoji by Thai food group 1..5 + junk emoji
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

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

  // plate groups (5 หมู่) — index 0..4 => groupId 1..5
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
    sub:'คุมความแม่น ≥ 80% (โดนของดี / ทั้งหมด)',
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

  // spawner
  engine:null,

  // adaptive knobs (play only)
  adaptive:{
    enabled:true,
    spawnRateMs: 900,   // will adapt
    goodWeight: 0.72,   // will adapt
    junkWeight: 0.28
  }
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
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracyGood(){
  // accuracy = good hits / (good hits + junk hits + expired good)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Adaptive (play mode only)
 * ------------------------------------------------ */
function applyAdaptiveTuning(){
  if(!STATE.adaptive.enabled) return;

  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const base =
    diff === 'easy' ? 980 :
    diff === 'hard' ? 740 :
    900;

  // use rolling signals
  const acc = accuracyGood();        // 0..1
  const combo = STATE.comboMax;      // proxy
  const miss = STATE.miss;

  // make it a bit more exciting but fair:
  // - high accuracy -> faster spawns + a tiny more junk
  // - low accuracy / many misses -> slow down + reduce junk
  const accBoost = clamp((acc - 0.78) * 320, -180, 180); // ms adjust
  const missPenalty = clamp(miss * 18, 0, 140);          // ms slow down
  const comboBoost = clamp(combo * 6, 0, 90);            // ms faster

  const rate = clamp(base - accBoost - comboBoost + missPenalty, 620, 1150);

  // junk weight adapt
  let jw = 0.28;
  if(acc > 0.86) jw += 0.05;
  if(acc < 0.70) jw -= 0.08;
  if(diff === 'hard') jw += 0.04;
  if(diff === 'easy') jw -= 0.05;
  jw = clamp(jw, 0.12, 0.42);

  STATE.adaptive.spawnRateMs = Math.round(rate);
  STATE.adaptive.junkWeight = jw;
  STATE.adaptive.goodWeight = 1 - jw;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function'){
      STATE.engine.stop();
    }
  }catch{}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  // ✅ critical: stop spawning / stop listeners
  stopSpawner();

  const accPct = Math.round(accuracyGood() * 100);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accPct,

    // group totals
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

    // keep adaptive in play
    if(STATE.adaptive.enabled && (STATE.timeLeft % 3 === 0)){
      // soft tuning loop
      applyAdaptiveTuning();
      // NOTE: mode-factory uses fixed spawnRate per boot,
      // so to *apply* rate changes, we re-boot spawner occasionally in play.
      // keep it rare to avoid flicker: every 9 sec
      if(STATE.timeLeft % 9 === 0){
        rebootSpawner();
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalFromGroups(){
  // cur = how many groups already collected at least 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniFromAccuracy(){
  const acc = accuracyGood() * 100;
  STATE.mini.cur = Math.round(acc);
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(groupId){
  // groupId is 1..5 (Thai fixed)
  STATE.hitGood++;

  const idx = clamp(groupId,1,5) - 1;
  STATE.g[idx]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoalFromGroups();
  updateMiniFromAccuracy();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  updateMiniFromAccuracy();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateMiniFromAccuracy();
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // t.kind: good/junk
  // t.groupIndex: 0..4 => groupId 1..5
  // t.rng: seeded rng from mode-factory (deterministic per seed)

  const rng = t?.rng || STATE.rng;
  const kind = t?.kind || 'good';

  if(kind === 'junk'){
    el.textContent = pickEmoji(rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.title = JUNK.labelTH;
    return;
  }

  const groupId = clamp((Number(t?.groupIndex)||0) + 1, 1, 5);
  el.textContent = emojiForGroup(rng, groupId);
  el.dataset.group = String(groupId);
  el.title = labelForGroup(groupId);

  // OPTIONAL: hint ring by group id (no hard colors here; CSS can style by [data-group])
}

/* ------------------------------------------------
 * Spawner boot/reboot
 * ------------------------------------------------ */
function makeSpawner(mount){
  const kinds = [
    { kind:'good', weight: STATE.adaptive.goodWeight },
    { kind:'junk', weight: STATE.adaptive.junkWeight }
  ];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.adaptive.spawnRateMs,
    sizeRange:[44,64],
    kinds,
    decorateTarget, // ✅ NEW: emoji/icon per group
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        // force groupId 1..5 from groupIndex 0..4
        const groupId = clamp((Number(t.groupIndex)||0) + 1, 1, 5);
        onHitGood(groupId);
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

function rebootSpawner(){
  // Avoid reboot when ending
  if(!STATE.running || STATE.ended) return;
  const mount = STATE.cfg?.__mount;
  if(!mount) return;

  // stop old
  stopSpawner();

  // boot new with updated adaptive knobs
  STATE.engine = makeSpawner(mount);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous if any
  stopSpawner();
  clearInterval(STATE.timer);

  STATE.cfg = cfg;
  STATE.cfg.__mount = mount; // internal for rebootSpawner only

  STATE.running = true;
  STATE.ended = false;

  // reset counters
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

  // RNG policy
  const runMode = (cfg.runMode || 'play').toLowerCase();
  const isResearch = (runMode === 'research' || runMode === 'study');
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // adaptive policy
  STATE.adaptive.enabled = !isResearch; // ✅ research/study => adaptive OFF
  applyAdaptiveTuning(); // initialize knobs from cfg/diff

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // boot spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}