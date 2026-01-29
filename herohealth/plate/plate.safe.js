// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (สนุกขึ้นเรื่อยๆ แบบยุติธรรม)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (DOM spawner)
//   - decorateTarget(el,target) => emoji/icon
//   - hha:shoot crosshair/tap-to-shoot
//   - stop() on end => no “target flash”
// ✅ Thai food groups mapping (STABLE): food5-th.js
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss / Storm hooks (lightweight + CSS layers: #bossFx #stormFx)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
}

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

function setFx(id, on, clsOn){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(clsOn);
  else el.classList.remove(clsOn);
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Engine State
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  // scoring
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  timeLeft:0,
  timer:null,

  // group counters (หมู่ 1..5)
  g:[0,0,0,0,0], // index 0..4

  // hit stats
  hitGood:0,
  hitJunk:0,
  expireGood:0,

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

  // mode/cfg
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,
  spawnerParams:null,
  adaptTimer:null,

  // boss/storm
  bossOn:false,
  stormOn:false,
  stormUntil:0,

  // coach throttle
  lastCoachAt:0
};

/* ------------------------------------------------
 * Derived metrics
 * ------------------------------------------------ */
function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accuracyPct(){
  return Math.round(accuracy01() * 100);
}
function safeCoach(msg, tag='Coach', minGapMs=1600){
  const t = nowMs();
  if(t - STATE.lastCoachAt < minGapMs) return;
  STATE.lastCoachAt = t;
  coach(msg, tag);
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

function recomputeGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    safeCoach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function recomputeMini(){
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    safeCoach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
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

function addCombo(){
  STATE.combo++;
  if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
}
function resetCombo(){
  STATE.combo = 0;
}

function addScore(v){
  STATE.score += (Number(v) || 0);
  emitScore();
}

/* ------------------------------------------------
 * Boss / Storm logic (fun hooks)
 * ------------------------------------------------ */
function updateBossStorm(){
  if(STATE.ended) return;

  // Boss: last 15s OR goal already done (makes ending exciting)
  const wantBoss = (STATE.timeLeft <= 15) || (STATE.goal.done && STATE.timeLeft <= 30);
  if(wantBoss !== STATE.bossOn){
    STATE.bossOn = wantBoss;
    setFx('bossFx', STATE.bossOn, 'boss-on');
    if(STATE.bossOn) safeCoach('🔥 โหมดบอส! ระวังของทอด/หวานเยอะขึ้น!', 'Coach');
  }

  // Storm: short bursts when combo is high (reward risk)
  const t = nowMs();
  const wantStorm = (STATE.combo >= 8 && t < STATE.stormUntil);
  if(!STATE.stormOn && STATE.combo >= 8){
    // start storm burst
    STATE.stormUntil = t + 2600;
  }
  const stormNow = (t < STATE.stormUntil);
  if(stormNow !== STATE.stormOn){
    STATE.stormOn = stormNow;
    setFx('stormFx', STATE.stormOn, 'storm-on');
  }

  // panic effect when accuracy low late game
  const panic = (STATE.bossOn && accuracyPct() < 65);
  const bossEl = DOC.getElementById('bossFx');
  if(bossEl){
    if(panic) bossEl.classList.add('boss-panic');
    else bossEl.classList.remove('boss-panic');
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch(_){}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;

  try{ clearInterval(STATE.adaptTimer); }catch(_){}
  STATE.adaptTimer = null;

  // IMPORTANT: stop spawner to prevent “flash targets”
  stopSpawner();

  // turn off fx
  STATE.bossOn = false;
  STATE.stormOn = false;
  setFx('bossFx', false, 'boss-on');
  setFx('stormFx', false, 'storm-on');

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

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // for later ML/DL feature engineering (ready-to-log)
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    updateBossStorm();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Target decorate (emoji)
 * ------------------------------------------------ */
function decoratePlateTarget(el, target){
  // target.groupIndex is 0..4 (for good)
  if(!el || !target) return;

  const kind = target.kind || 'good';
  if(kind === 'junk'){
    const em = pickEmoji(target.rng, JUNK.emojis);
    el.textContent = em;
    el.title = JUNK.labelTH;
    el.dataset.group = 'junk';
  }else{
    const groupId = (Number(target.groupIndex) || 0) + 1; // 1..5
    const em = emojiForGroup(target.rng, groupId);
    el.textContent = em;
    el.title = labelForGroup(groupId);
    el.dataset.group = String(groupId);
  }
}

/* ------------------------------------------------
 * Adaptive difficulty (Play mode only)
 * - adjusts spawnRate + junk weight based on performance/time/boss
 * ------------------------------------------------ */
function baseParamsByDiff(diff){
  const d = String(diff || 'normal').toLowerCase();
  if(d === 'easy')   return { spawnRate: 980, junkW: 0.22, sizeMin: 52, sizeMax: 76, ttlGood: 2400, ttlJunk: 1900 };
  if(d === 'hard')   return { spawnRate: 760, junkW: 0.36, sizeMin: 44, sizeMax: 64, ttlGood: 2050, ttlJunk: 1700 };
  return             { spawnRate: 880, junkW: 0.28, sizeMin: 48, sizeMax: 70, ttlGood: 2250, ttlJunk: 1800 };
}

function computeSpawnerParams(){
  const base = baseParamsByDiff(STATE.cfg.diff);

  // research/study => no adaptive changes, fixed
  const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  if(isStudy){
    return {
      spawnRate: base.spawnRate,
      junkW: base.junkW,
      sizeMin: base.sizeMin,
      sizeMax: base.sizeMax,
      ttlGood: base.ttlGood,
      ttlJunk: base.ttlJunk
    };
  }

  // play => adaptive (fair + exciting)
  let spawnRate = base.spawnRate;
  let junkW = base.junkW;
  let ttlGood = base.ttlGood;
  let ttlJunk = base.ttlJunk;
  let sizeMin = base.sizeMin;
  let sizeMax = base.sizeMax;

  const acc = accuracyPct();
  const pressure = clamp((100 - acc) / 100, 0, 0.35); // if low accuracy => ease a bit
  const progress = clamp(1 - (STATE.timeLeft / Math.max(1, STATE.cfg.durationPlannedSec || 90)), 0, 1);

  // gently speed up over time (more exciting), but ease if struggling
  spawnRate = spawnRate * (1 - progress * 0.22) * (1 + pressure * 0.35);

  // boss mode: increase junk & speed a bit
  if(STATE.bossOn){
    spawnRate *= 0.88;
    junkW = clamp(junkW + 0.08, 0.18, 0.48);
    ttlGood *= 0.95;
    ttlJunk *= 0.92;
  }

  // if combo high => slightly smaller targets + faster spawn (challenge)
  if(STATE.combo >= 10){
    spawnRate *= 0.90;
    sizeMin = Math.max(40, Math.round(sizeMin * 0.92));
    sizeMax = Math.max(sizeMin + 8, Math.round(sizeMax * 0.94));
  }

  // if accuracy low => increase size a bit + reduce junk
  if(acc < 70){
    sizeMin = Math.round(sizeMin * 1.08);
    sizeMax = Math.round(sizeMax * 1.08);
    junkW = clamp(junkW - 0.06, 0.14, 0.44);
    spawnRate *= 1.06;
  }

  return {
    spawnRate: Math.round(clamp(spawnRate, 540, 1400)),
    junkW: clamp(junkW, 0.14, 0.48),
    sizeMin: clamp(sizeMin, 40, 92),
    sizeMax: clamp(sizeMax, 48, 110),
    ttlGood: Math.round(clamp(ttlGood, 1500, 3200)),
    ttlJunk: Math.round(clamp(ttlJunk, 1300, 2600))
  };
}

function sameSpawnerParams(a, b){
  if(!a || !b) return false;
  return (
    a.spawnRate === b.spawnRate &&
    a.junkW === b.junkW &&
    a.sizeMin === b.sizeMin &&
    a.sizeMax === b.sizeMax &&
    a.ttlGood === b.ttlGood &&
    a.ttlJunk === b.ttlJunk
  );
}

function createSpawner(mount, params){
  const goodW = 1 - params.junkW;
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safePrefix: '--plate',
    spawnRate: params.spawnRate,
    sizeRange: [params.sizeMin, params.sizeMax],
    ttlGoodMs: params.ttlGood,
    ttlJunkMs: params.ttlJunk,
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: params.junkW }
    ],
    decorateTarget: decoratePlateTarget,
    onHit: (t)=>{
      // Translate group
      if(t.kind === 'good'){
        const groupIndex = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(groupIndex);
      }else{
        onHitJunk();
      }

      emit('hha:judge', {
        kind: t.kind,
        groupIndex: t.groupIndex ?? null,
        source: t.source || 'tap',
        score: STATE.score,
        combo: STATE.combo,
        acc: accuracyPct(),
        miss: STATE.miss,
        timeLeft: STATE.timeLeft
      });

      // small real-time excitement updates
      updateBossStorm();
    },
    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

function ensureSpawner(mount){
  const desired = computeSpawnerParams();
  if(STATE.spawner && sameSpawnerParams(desired, STATE.spawnerParams)) return;

  // restart spawner with new params
  stopSpawner();
  STATE.spawnerParams = desired;
  STATE.spawner = createSpawner(mount, desired);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // quest progress
  recomputeGoal();
  recomputeMini();
  emitQuest();

  // micro tips
  if(!STATE.goal.done){
    const need = [];
    for(let i=0;i<5;i++) if(STATE.g[i] <= 0) need.push(i+1);
    if(need.length >= 3 && STATE.timeLeft <= (STATE.cfg.durationPlannedSec||90) - 10){
      safeCoach(`ยังขาดหมู่ ${need.slice(0,3).join(', ')} ลองหาให้ครบก่อนนะ!`, 'Coach', 1900);
    }
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // mini quest may drop effectively by lowering accuracy
  recomputeMini();
  emitQuest();

  safeCoach('⚠️ ระวัง! ของหวาน/ทอด', 'Coach', 1700);
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  recomputeMini();
  emitQuest();
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg
  STATE.cfg = cfg || {};
  STATE.cfg.runMode = (STATE.cfg.runMode || 'play').toLowerCase();
  STATE.cfg.diff = (STATE.cfg.diff || 'normal').toLowerCase();

  const dur = Number(STATE.cfg.durationPlannedSec || STATE.cfg.time || 90);
  STATE.cfg.durationPlannedSec = clamp(dur, 10, 999);

  // reset state
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

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE.stormUntil = 0;

  STATE.lastCoachAt = 0;

  // RNG: research/study deterministic, play may still use random for variety
  if(STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // start time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // emit start
  emit('hha:start', {
    game:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial UI
  emitScore();
  emitQuest();
  setFx('bossFx', false, 'boss-on');
  setFx('stormFx', false, 'storm-on');

  // create spawner once (and adapt later if play)
  ensureSpawner(mount);

  // adaptive tick (play only)
  const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  if(!isStudy){
    STATE.adaptTimer = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;
      ensureSpawner(mount);
    }, 1200);
  }

  // timer
  startTimer();

  // intro coach
  safeCoach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 1);

  // hard end safety (if page hidden/back)
  WIN.addEventListener('beforeunload', ()=>{
    try{ stopSpawner(); }catch(_){}
  }, { once:true });

  // optional: end early if both quests done (fun: “ผ่านทันที”)
  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    if(d.allDone && !STATE.ended){
      // short celebrate then end
      safeCoach('ครบแล้ว! เก่งมาก ✨', 'Coach', 1);
      setTimeout(()=>{ if(!STATE.ended) endGame('allDone'); }, 450);
    }
  }, { passive:true });

  // allow external end (optional)
  WIN.__HHA_PLATE_END__ = endGame;
}