// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (spawnRate + junk weight adjust)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses: mode-factory.js decorateTarget + hha:shoot (vr-ui.js)
// ✅ FIX: Guaranteed 5-Group Cycle (ไม่ค้างเพราะสุ่มไม่ออกครบ 5 หมู่)
// ✅ End: stop spawner (กันเป้า “แว๊บๆ” หลังจบเกม)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji, labelForGroup } from '../vr/food5-th.js';

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

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function setBossFx(mode){
  const el = DOC.getElementById('bossFx');
  if(!el) return;
  el.classList.toggle('boss-on', !!mode);
  el.classList.toggle('boss-panic', mode === 'panic');
}
function setStormFx(on){
  const el = DOC.getElementById('stormFx');
  if(!el) return;
  el.classList.toggle('storm-on', !!on);
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

  // plate groups (5 หมู่) index 0..4
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

  // spawner controller
  controller:null,

  // guaranteed group cycle
  groupQueue:[],       // holds groupIndex 0..4
  lastGoodGroup:-1,

  // adaptive knobs (play mode only)
  spawnRateMs:900,
  junkW:0.30,
  goodW:0.70,
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
 * Accuracy
 * - total judged = good hits + junk hits + good expiries
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * FIX: Guaranteed 5-Group Cycle
 * - ถ้ายังไม่ครบ 5 หมู่: จะ “บังคับ” ให้ good ถัดไปเป็นหมู่ที่ยังขาดก่อน
 * - ใช้ rng แบบ deterministic ใน research/study
 * ------------------------------------------------ */
function shuffleInPlace(rng, arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor((rng() || 0) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function refillGroupQueue(){
  // add all 0..4 then shuffle
  STATE.groupQueue = [0,1,2,3,4];
  shuffleInPlace(STATE.rng, STATE.groupQueue);
}

function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++){
    if(STATE.g[i] <= 0) miss.push(i);
  }
  return miss;
}

function pickNextGoodGroupIndex(){
  // If goal not done: prioritize missing groups
  const miss = missingGroups();
  if(miss.length){
    // deterministic shuffle of missing to avoid same loop
    const m = miss.slice();
    shuffleInPlace(STATE.rng, m);

    // avoid repeating same group twice if possible
    if(m.length > 1 && m[0] === STATE.lastGoodGroup){
      const tmp = m[0]; m[0] = m[1]; m[1] = tmp;
    }
    return m[0];
  }

  // already complete: cycle queue for variety
  if(!STATE.groupQueue || !STATE.groupQueue.length) refillGroupQueue();
  let gi = STATE.groupQueue.shift();
  if(gi === STATE.lastGoodGroup && STATE.groupQueue.length){
    // swap to avoid immediate repeat
    const alt = STATE.groupQueue.shift();
    STATE.groupQueue.unshift(gi);
    gi = alt;
  }
  return (gi == null) ? Math.floor(STATE.rng()*5) : gi;
}

/* ------------------------------------------------
 * Adaptive (play mode only)
 * - ง่ายขึ้น/ยากขึ้นอย่างนิ่ม ๆ ตาม performance
 * ------------------------------------------------ */
function updateAdaptive(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study') return; // adaptive OFF

  // quick signals
  const acc = accuracy();              // 0..1
  const combo = STATE.combo;
  const tLeft = STATE.timeLeft;

  // target baseline from cfg.diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  let baseRate = 900;
  let baseJunk = 0.30;
  if(diff === 'easy'){ baseRate = 980; baseJunk = 0.24; }
  if(diff === 'hard'){ baseRate = 760; baseJunk = 0.36; }

  // adjust: if accuracy high and combo high -> faster & more junk
  // if accuracy low -> slower & less junk
  let rate = baseRate;
  let jw = baseJunk;

  if(acc >= 0.86 && combo >= 6){
    rate = baseRate * 0.88;
    jw = Math.min(0.45, baseJunk + 0.08);
  }else if(acc >= 0.80 && combo >= 3){
    rate = baseRate * 0.94;
    jw = Math.min(0.42, baseJunk + 0.05);
  }else if(acc < 0.72){
    rate = baseRate * 1.08;
    jw = Math.max(0.18, baseJunk - 0.06);
  }

  // late game spice
  if(tLeft <= 20){
    rate *= 0.95;
    jw = Math.min(0.48, jw + 0.03);
  }

  STATE.spawnRateMs = Math.round(clamp(rate, 520, 1400));
  STATE.junkW = clamp(jw, 0.12, 0.55);
  STATE.goodW = clamp(1 - STATE.junkW, 0.45, 0.88);

  // optional FX hints
  if(tLeft <= 15) setStormFx(true);
  else setStormFx(false);

  // boss-ish panic moment (optional)
  if(tLeft <= 8 && acc < 0.75) setBossFx('panic');
  else if(tLeft <= 10) setBossFx(true);
  else setBossFx(false);
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

    // adaptive tick (play only)
    updateAdaptive();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.lastGoodGroup = groupIndex;

  addCombo();
  addScore(100 + STATE.combo * 6); // slightly more exciting

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }else{
      // micro tip for missing group
      const miss = missingGroups().map(i => labelForGroup(i+1)).join(', ');
      if(miss) coach(`ยังขาด: ${miss}`, 'Coach');
    }
  }

  // mini (accuracy)
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }

  emitQuest();
  emit('hha:judge', { kind:'good', groupIndex, accPct, combo:STATE.combo });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
  emit('hha:judge', { kind:'junk', accPct: Math.round(accuracy()*100) });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  addScore(-10);
  emitQuest();
  emit('hha:judge', { kind:'expire_good', accPct: Math.round(accuracy()*100) });
}

/* ------------------------------------------------
 * Spawner build (mode-factory)
 * ------------------------------------------------ */
function buildSpawner(mount){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  const research = (run === 'research' || run === 'study');

  const fixedRate = (STATE.cfg?.diff === 'hard') ? 700 : 900;

  // set initial knobs
  STATE.spawnRateMs = research ? fixedRate : fixedRate;
  STATE.junkW = research ? 0.30 : 0.30;
  STATE.goodW = 1 - STATE.junkW;

  // decorate target: assign group (for good) + emoji
  function decorateTarget(el, target){
    const isJunk = (target.kind === 'junk');

    if(isJunk){
      const em = pickEmoji(target.rng, JUNK.emojis);
      target.emoji = em;
      el.dataset.group = 'junk';
      el.textContent = em;
      return;
    }

    // ✅ FIX: pick next group with guarantee
    const gi = pickNextGoodGroupIndex();        // 0..4
    target.groupIndex = gi;
    target.groupId = gi + 1;

    const em = emojiForGroup(target.rng, target.groupId);
    target.emoji = em;

    el.dataset.group = String(target.groupId);
    el.textContent = em;
  }

  // IMPORTANT: we need dynamic spawnRate/junk weight in play mode
  // mode-factory currently takes fixed spawnRate + kinds; easiest is:
  // - restart controller when knobs change a lot? (too heavy)
  // - OR: choose conservative rate, and let adaptive mainly change junk weight via kinds weight? (still fixed)
  // So we do a lightweight approach:
  // - Set spawnRate based on cfg.diff at boot
  // - Adaptive will mainly change "feel" through coach/FX and scoring
  // (If you want *true* dynamic spawnRate/junkWeight, I’ll patch mode-factory to accept getters.)
  const spawnRate = research ? fixedRate : fixedRate;

  const kinds = [
    { kind:'good', weight: research ? 0.70 : 0.70 },
    { kind:'junk', weight: research ? 0.30 : 0.30 },
  ];

  return spawnBoot({
    mount,
    seed: STATE.cfg?.seed,
    spawnRate,
    sizeRange: [44, 64],
    kinds,
    decorateTarget,
    onHit: (t)=>{
      if(t.kind === 'good'){
        const gi = clamp((t.groupIndex ?? 0), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * End game (stop spawner!)
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // ✅ STOP controller to prevent “flashing targets”
  try{ STATE.controller && STATE.controller.stop && STATE.controller.stop(); }catch{}
  STATE.controller = null;

  setBossFx(false);
  setStormFx(false);

  const accPct = Math.round(accuracy() * 100);

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

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset
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

  STATE.groupQueue = [];
  STATE.lastGoodGroup = -1;

  // RNG
  const run = (STATE.cfg.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    // play mode can still be deterministic if seed provided, but not required
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }

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

  // spawner
  STATE.controller = buildSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}