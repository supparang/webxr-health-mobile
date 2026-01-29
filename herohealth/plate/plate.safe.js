// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (dynamic spawnRate/ttl by performance)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses: mode-factory.js (boot) with decorateTarget
// ✅ Uses: food5-th.js mapping (Thai Food 5 groups stable)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss/Storm FX hooks (CSS layers) + coach hints
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ End game: stops spawner + clears timers (no target "blink")
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, labelForGroup, emojiForGroup } from '../vr/food5-th.js';

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
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function nowMs(){
  try{ return performance.now(); }catch(_){ return Date.now(); }
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

  // plate groups (5 หมู่) — store counts per group
  // index 0..4 => groupId 1..5
  g:[0,0,0,0,0],

  // quests
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'ทำความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // accuracy components
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive knobs
  adaptiveOn:false,
  baseSpawnRate:900,
  baseTTLGood:2200,
  baseTTLJunk:1700,
  curSpawnRate:900,
  goodWeight:0.72,
  junkWeight:0.28,

  // phase FX
  bossOn:false,
  stormOn:false,

  // coach rate limit
  coachLastAt:0
};

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  const t = nowMs();
  if(t - STATE.coachLastAt < 800) return; // rate-limit
  STATE.coachLastAt = t;
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

function accuracyPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * FX helpers (optional layers exist in CSS/HTML)
 * ------------------------------------------------ */
function setFx(id, clsOn, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(clsOn);
  else el.classList.remove(clsOn);
}

function boss(on){
  STATE.bossOn = !!on;
  setFx('bossFx','boss-on',STATE.bossOn);
}
function storm(on){
  STATE.stormOn = !!on;
  setFx('stormFx','storm-on',STATE.stormOn);
}

/* ------------------------------------------------
 * End game (stop everything)
 * ------------------------------------------------ */
function stopSpawner(){
  try{
    if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
      STATE.spawner.stop();
    }
  }catch(_){}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  // stop timers + spawner (prevents "blink" targets after end)
  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;
  stopSpawner();

  // turn off FX
  boss(false);
  storm(false);

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

    // group counts (Thai fixed ids)
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

    // last 12s => storm hint
    if(STATE.timeLeft === 12){
      storm(true);
      coach('โค้งสุดท้าย! รีบเติมให้ครบ 5 หมู่ 💨', 'Coach');
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Adaptive (play mode)
 * ------------------------------------------------ */
function updateAdaptive(){
  if(!STATE.adaptiveOn) return;

  const acc = accuracyPct(); // 0..100
  const combo = STATE.combo;

  // spawn faster if doing well; slower if struggling
  // clamp to keep kid-friendly
  let rate = STATE.baseSpawnRate;

  if(acc >= 90 && combo >= 6) rate -= 220;
  else if(acc >= 85 && combo >= 4) rate -= 140;
  else if(acc <= 65) rate += 160;
  else if(acc <= 75) rate += 80;

  rate = clamp(rate, 520, 1050);

  // adjust junk pressure slightly
  let junkW = STATE.junkWeight;
  if(acc >= 90 && combo >= 6) junkW = 0.34;
  else if(acc <= 70) junkW = 0.24;
  junkW = clamp(junkW, 0.20, 0.36);

  STATE.curSpawnRate = rate;
  STATE.goodWeight = 1 - junkW;
  STATE.junkWeight = junkW;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupId){
  // groupId is 1..5
  STATE.hitGood++;
  const idx = clamp(groupId,1,5) - 1;
  STATE.g[idx]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // goal progress: count how many groups have at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      boss(true);
      coach('สุดยอด! ครบ 5 หมู่แล้ว 🎉 ตอนนี้คุมความแม่นให้ได้!', 'Coach');
    }
  }

  // mini quest: accuracy
  const acc = accuracyPct();
  STATE.mini.cur = acc;
  if(!STATE.mini.done && acc >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นผ่านแล้ว! เก่งมาก ✅', 'Coach');
  }

  // if both done => end early (kid-friendly win)
  if(STATE.goal.done && STATE.mini.done){
    endGame('all_done');
    return;
  }

  emitQuest();
  updateAdaptive();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  addScore(-60);

  // gentle warning (rate limited)
  if(STATE.hitJunk % 2 === 1){
    coach('ระวังของหวาน/ทอดนะ ⚠️', 'Coach');
  }

  emitQuest();
  updateAdaptive();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  updateAdaptive();
}

/* ------------------------------------------------
 * Target decoration (emoji + label)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: good/junk
  // target.groupIndex: 0..4
  // target.rng: deterministic rng from spawner
  if(!el || !target) return;

  // clear
  el.textContent = '';

  // build inner
  const inner = DOC.createElement('div');
  inner.className = 'plateInner';

  const badge = DOC.createElement('div');
  badge.className = 'plateEmoji';

  const meta = DOC.createElement('div');
  meta.className = 'plateMeta';

  if(target.kind === 'junk'){
    const emo = pickEmoji(target.rng, JUNK.emojis);
    badge.textContent = emo;
    meta.textContent = 'JUNK';
    el.dataset.group = 'junk';
  }else{
    const groupId = (Number(target.groupIndex)||0) + 1; // 1..5
    const emo = emojiForGroup(target.rng, groupId);
    badge.textContent = emo;
    meta.textContent = `หมู่ ${groupId}`;
    el.dataset.group = String(groupId);
  }

  inner.appendChild(badge);
  inner.appendChild(meta);
  el.appendChild(inner);

  // subtle accessibility label
  try{
    if(target.kind === 'junk') el.setAttribute('aria-label','อาหารขยะ');
    else{
      const gid = (Number(target.groupIndex)||0) + 1;
      el.setAttribute('aria-label', labelForGroup(gid));
    }
  }catch(_){}
}

/* ------------------------------------------------
 * Build spawner (rebuildable controller)
 * ------------------------------------------------ */
function buildSpawner(mount){
  const cfg = STATE.cfg;

  // in research mode: fixed params (no adaptive)
  const spawnRate = STATE.adaptiveOn ? STATE.curSpawnRate : STATE.baseSpawnRate;

  const sizeRange = (cfg.diff === 'hard')
    ? [46, 72]
    : (cfg.diff === 'easy')
      ? [52, 80]
      : [48, 76];

  // TTL can be slightly longer on easy, shorter on hard
  const ttlGood = (cfg.diff === 'hard') ? 2000 : (cfg.diff === 'easy' ? 2400 : 2200);
  const ttlJunk = (cfg.diff === 'hard') ? 1650 : (cfg.diff === 'easy' ? 1850 : 1750);

  // weights
  const goodW = STATE.goodWeight;
  const junkW = STATE.junkWeight;

  return spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate,
    sizeRange,
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget, // ✅ attach emoji UI
    onHit:(t)=>{
      if(t.kind === 'good'){
        // groupId 1..5 (deterministic from spawner: groupIndex fixed)
        const groupId = (Number(t.groupIndex)||0) + 1;
        onHitGood(groupId);
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
 * Boot entry
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // base cfg
  STATE.cfg = cfg || {};
  const runMode = String(cfg.runMode || 'play').toLowerCase();

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

  STATE.coachLastAt = 0;

  // mode RNG + adaptive toggle
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
    STATE.adaptiveOn = false; // ✅ OFF for deterministic research
  }else{
    STATE.rng = Math.random;
    STATE.adaptiveOn = true;  // ✅ ON for fun play
  }

  // base knobs by diff
  const diff = String(cfg.diff || 'normal').toLowerCase();
  if(diff === 'hard'){
    STATE.baseSpawnRate = 760;
    STATE.goodWeight = 0.66;
    STATE.junkWeight = 0.34;
  }else if(diff === 'easy'){
    STATE.baseSpawnRate = 980;
    STATE.goodWeight = 0.78;
    STATE.junkWeight = 0.22;
  }else{
    STATE.baseSpawnRate = 880;
    STATE.goodWeight = 0.72;
    STATE.junkWeight = 0.28;
  }

  STATE.curSpawnRate = STATE.baseSpawnRate;

  // time
  STATE.timeLeft = clamp(cfg.durationPlannedSec ?? 90, 10, 999);

  // FX off at start
  boss(false);
  storm(false);

  // start events
  emit('hha:start', {
    game:'plate',
    runMode,
    diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  // build spawner
  stopSpawner();
  STATE.spawner = buildSpawner(mount);

  // coach opening
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}
