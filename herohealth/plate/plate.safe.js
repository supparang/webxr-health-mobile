// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (help user finish goals faster)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js spawner with decorateTarget(el,target)
// ✅ FIX: guarantee "ครบ 5 หมู่" shows up reliably (goal assist)
// ✅ End: stop() spawner + clear timers (no target flashing after end)
// ------------------------------------------------

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

function pct2(n){
  // keep 2 decimals (for research), but UI can round
  return Math.round((Number(n) || 0) * 100) / 100;
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

  // plate groups (หมู่ 1..5)
  g:[0,0,0,0,0], // index 0..4

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ชิ้นต่อหมู่)',
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
  adaptive:false,

  // spawn engine
  engine:null,

  // coach rate-limit
  coachCooldownUntil:0,
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * Coach helper (rate-limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach', cooldownMs=900){
  const now = (performance.now ? performance.now() : Date.now());
  if(now < STATE.coachCooldownUntil) return;
  STATE.coachCooldownUntil = now + cooldownMs;
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
 * Group picking (FIX: help finish all 5 groups)
 * ------------------------------------------------ */
function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(i+1); // groupId 1..5
  }
  return miss;
}

function pickFromArray(rng, arr){
  if(!arr || !arr.length) return null;
  const r = (typeof rng === 'function') ? rng() : Math.random();
  return arr[Math.max(0, Math.min(arr.length-1, Math.floor(r*arr.length)))];
}

function pickGroupForGood(rngFn){
  // Research: deterministic but NO adaptive
  if(!STATE.adaptive){
    return 1 + Math.floor((typeof rngFn === 'function' ? rngFn() : Math.random()) * 5);
  }

  // Play: adaptive ON
  // If goal not done, strongly prefer missing groups so player can finish "ครบ 5 หมู่"
  if(!STATE.goal.done){
    const miss = missingGroups();
    if(miss.length){
      // 85% pick from missing, 15% random among all
      const r = (typeof rngFn === 'function') ? rngFn() : Math.random();
      if(r < 0.85) return pickFromArray(rngFn, miss);
    }
  }
  return 1 + Math.floor((typeof rngFn === 'function' ? rngFn() : Math.random()) * 5);
}

/* ------------------------------------------------
 * End game + cleanup
 * ------------------------------------------------ */
function cleanup(){
  STATE.running = false;
  clearInterval(STATE.timer); STATE.timer = null;

  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;

  cleanup();

  // judge event (optional hook for research logger)
  emit('hha:judge', {
    reason,
    score: STATE.score,
    miss: STATE.miss,
    accuracyGood: pct2(accuracy()*100),
    g: [...STATE.g]
  });

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

    // group counts (for analytics)
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
function updateGoalProgress(){
  if(STATE.goal.done) return;

  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach', 1200);
  }
}

function updateMiniProgress(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach', 1200);
  }
}

function onHitGood(groupId){
  STATE.hitGood++;

  const gi = clamp(groupId, 1, 5) - 1;
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoalProgress();
  updateMiniProgress();

  emitQuest();

  // optional: end early if both quests done (fast win in play mode)
  if(STATE.cfg && (STATE.cfg.runMode === 'play') && STATE.goal.done && STATE.mini.done){
    // small celebration + end
    coach('ผ่านไวมาก! 🏁', 'Coach', 1200);
    endGame('allquests');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  updateMiniProgress();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 900);
}

function onExpireGood(groupId){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMiniProgress();
  emitQuest();

  // gentle hint when missing groups exist
  if(STATE.adaptive && !STATE.goal.done){
    const miss = missingGroups();
    if(miss.length){
      const need = miss.map(id=>labelForGroup(id)).join(' / ');
      coach(`ยังขาด: ${need}`, 'Hint', 900);
    }
  }
}

/* ------------------------------------------------
 * Target decorator (emoji ring like your mock)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // default emoji
  let emo = '🍽️';

  if(t.kind === 'junk'){
    emo = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.kind = 'junk';
    el.title = `${JUNK.labelTH}`;
  }else{
    const gid = clamp((t.groupIndex ?? 1), 1, 5);
    emo = emojiForGroup(t.rng, gid);
    el.dataset.kind = 'good';
    el.dataset.group = String(gid);
    el.title = `${FOOD5[gid]?.labelTH || 'หมู่ ?'} • ${FOOD5[gid]?.descTH || ''}`;
  }

  // apply a consistent inner structure for CSS (.emo)
  el.innerHTML = `<div class="emo" aria-hidden="true">${emo}</div>`;
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // speed tuning
  const spawnRate =
    diff === 'hard' ? 620 :
    diff === 'easy' ? 980 :
    820;

  const sizeRange =
    diff === 'hard' ? [40, 60] :
    diff === 'easy' ? [48, 72] :
    [44, 66];

  // good/junk ratio (hard => more junk)
  const kinds =
    diff === 'hard'
      ? [{ kind:'good', weight:0.62 }, { kind:'junk', weight:0.38 }]
      : diff === 'easy'
        ? [{ kind:'good', weight:0.78 }, { kind:'junk', weight:0.22 }]
        : [{ kind:'good', weight:0.70 }, { kind:'junk', weight:0.30 }];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange,
    kinds,

    // decorate target as ring+emoji (can be swapped later)
    decorateTarget,

    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        // IMPORTANT: pick groupId here to guarantee 5 groups appear
        const gid = pickGroupForGood(t.rng);
        onHitGood(gid);
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        const gid = clamp((t.groupIndex ?? 1), 1, 5);
        onExpireGood(gid);
      }
    }
  });
}

/* ------------------------------------------------
 * Public boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cleanup previous run if any
  cleanup();

  // cfg
  const runMode = (cfg?.runMode || 'play').toLowerCase();
  const diff = (cfg?.diff || 'normal').toLowerCase();
  const seed = Number(cfg?.seed || Date.now()) || Date.now();
  const dur = clamp(cfg?.durationPlannedSec ?? 90, 10, 999);

  STATE.cfg = { ...(cfg||{}), runMode, diff, seed, durationPlannedSec: dur };
  STATE.running = true;
  STATE.ended = false;

  // reset stats
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

  STATE.timeLeft = dur;
  STATE.coachCooldownUntil = 0;

  // RNG + adaptive policy
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(seed);
    STATE.adaptive = false;
  }else{
    STATE.rng = Math.random;
    STATE.adaptive = true; // ✅ play mode: assist goal completion
  }

  // start events
  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed,
    durationPlannedSec: dur
  });

  emitScore();
  emitQuest();
  startTimer();

  // spawn engine
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 900);
}