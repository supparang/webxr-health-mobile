// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (เลื่อนความยากให้สนุกขึ้น)
//   - research/study: deterministic seed + adaptive OFF (คงที่เพื่อวิจัย)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks) (ยังเป็น hook ไว้)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory decorateTarget => emoji ตามหมู่ 1–5 + junk
// ✅ End: stop spawner กันเป้า “แว๊บๆ”
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

const pct0 = (n)=> `${Math.round(Number(n)||0)}%`;

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
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
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

  // plate groups (5 หมู่): store count per group id 1..5
  g: { 1:0, 2:0, 3:0, 4:0, 5:0 },

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

  // counters for accuracy
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive (play mode only)
  adaptive:{
    on:false,
    baseRate:900,
    rateNow:900,
    ttlGood:2100,
    ttlJunk:1700,
    sizeMin:44,
    sizeMax:64,
    lastN:[],        // recent results: 1=good hit, 0=miss/junk/expire
    maxN:18,
  },

  // phases (hooks)
  bossOn:false,
  stormOn:false,
  bossAtSec:0,
  stormAtSec:0,
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
 * Adaptive tuning (Play mode)
 * ------------------------------------------------ */
function pushRecent(ok){
  const a = STATE.adaptive.lastN;
  a.push(ok ? 1 : 0);
  if(a.length > STATE.adaptive.maxN) a.shift();
}

function recentSkill(){
  const a = STATE.adaptive.lastN;
  if(!a.length) return 0.6;
  const s = a.reduce((p,c)=>p+c,0) / a.length;
  return clamp(s, 0, 1);
}

function computeAdaptive(){
  if(!STATE.adaptive.on) return;

  const skill = recentSkill(); // 0..1
  // skill สูง => เร่ง spawn, ลด TTL, ลด size
  // skill ต่ำ => ช้าลง, TTL ยาวขึ้น, size ใหญ่ขึ้น
  const hard = clamp((skill - 0.55) / 0.35, -1, 1); // -1..1

  const base = STATE.adaptive.baseRate;

  // spawn rate (ms): lower = harder
  const rate = clamp(base - hard * 260, 520, 1150);

  // ttl
  const ttlGood = clamp(2100 - hard * 320, 1450, 2400);
  const ttlJunk = clamp(1700 - hard * 220, 1200, 2100);

  // size
  const sizeMin = clamp(44 - hard * 8, 34, 60);
  const sizeMax = clamp(64 - hard * 10, 42, 78);

  STATE.adaptive.rateNow = rate;
  STATE.adaptive.ttlGood = ttlGood;
  STATE.adaptive.ttlJunk = ttlJunk;
  STATE.adaptive.sizeMin = sizeMin;
  STATE.adaptive.sizeMax = sizeMax;
}

/* ------------------------------------------------
 * Phase hooks (Boss / Storm) — lightweight + optional
 * ------------------------------------------------ */
function setBoss(on){
  STATE.bossOn = !!on;
  const el = document.getElementById('bossFx');
  if(el){
    el.classList.toggle('boss-on', STATE.bossOn);
    el.classList.toggle('boss-panic', false);
  }
}

function setStorm(on){
  STATE.stormOn = !!on;
  const el = document.getElementById('stormFx');
  if(el) el.classList.toggle('storm-on', STATE.stormOn);
}

/* ------------------------------------------------
 * End game
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

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;

  // ✅ stop spawner กันเป้า “แว๊บๆ”
  stopSpawner();

  const accPct = accuracy() * 100;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accPct),

    g1: STATE.g[1],
    g2: STATE.g[2],
    g3: STATE.g[3],
    g4: STATE.g[4],
    g5: STATE.g[5]
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

    // ตัวอย่าง phase hook: เปิด boss/storm ช่วงท้าย (play mode เท่านั้น)
    if(STATE.cfg && STATE.cfg.runMode === 'play'){
      const left = STATE.timeLeft;

      // Boss: ช่วงท้าย 20s
      if(!STATE.bossOn && left <= 20){
        setBoss(true);
        coach('บอสมาแล้ว! โฟกัสให้ดี 🔥', 'Boss');
      }

      // Storm: ช่วงท้าย 35s
      if(!STATE.stormOn && left <= 35){
        setStorm(true);
        coach('พายุมา! เป้าเริ่มถี่ขึ้น 🌪️', 'Storm');
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
function recomputeGoalCur(){
  // goal: ต้องมีอย่างน้อย 1 ชิ้นในทุกหมู่
  let c = 0;
  for(let i=1; i<=5; i++) if((STATE.g[i]||0) > 0) c++;
  STATE.goal.cur = c;
}

function updateMiniFromAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function onHitGood(groupId){
  STATE.hitGood++;
  STATE.g[groupId] = (STATE.g[groupId]||0) + 1;

  addCombo();

  // bonus: combo
  addScore(100 + STATE.combo * 5);

  // adaptive signal
  pushRecent(true);
  computeAdaptive();

  // goal progress
  if(!STATE.goal.done){
    recomputeGoalCur();
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini quest: accuracy
  updateMiniFromAccuracy();

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  pushRecent(false);
  computeAdaptive();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  pushRecent(false);
  computeAdaptive();

  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // kind: good/junk
  // groupIndex: 0..4 (from factory)
  // rng: deterministic seeded rng from factory
  const rng = t.rng || STATE.rng;

  if(t.kind === 'junk'){
    el.textContent = pickEmoji(rng, JUNK.emojis);
    el.title = `${JUNK.labelTH} • ${JUNK.descTH}`;
    return;
  }

  // good => map 0..4 -> groupId 1..5
  const groupId = clamp((Number(t.groupIndex)||0) + 1, 1, 5);
  el.dataset.group = String(groupId);

  // emoji by group
  el.textContent = emojiForGroup(rng, groupId);

  const g = FOOD5[groupId];
  const name = g ? g.labelTH : `หมู่ ${groupId}`;
  const desc = g ? g.descTH : '';
  el.title = `${name}${desc ? ' • ' + desc : ''}`;
}

/* ------------------------------------------------
 * Spawn / Rebuild spawner
 * ------------------------------------------------ */
function buildSpawner(mount){
  const ad = STATE.adaptive;

  const spawnRate = ad.on ? ad.rateNow : (STATE.cfg.diff === 'hard' ? 700 : 900);
  const sizeRange = ad.on ? [ad.sizeMin, ad.sizeMax] : [44, 64];
  const ttlGoodMs = ad.on ? ad.ttlGood : 2100;
  const ttlJunkMs = ad.on ? ad.ttlJunk : 1700;

  // weights (สามารถขยับให้ท้ายเกม junk ถี่ขึ้นนิดหน่อยใน play)
  let wGood = 0.70, wJunk = 0.30;
  if(STATE.cfg.runMode === 'play'){
    const left = STATE.timeLeft || 999;
    if(left <= 35){ wGood = 0.66; wJunk = 0.34; }
    if(left <= 20){ wGood = 0.62; wJunk = 0.38; }
  }

  // stop old spawner if any
  stopSpawner();

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    jitterMs: 120,
    sizeRange,
    kinds:[
      { kind:'good', weight:wGood },
      { kind:'junk', weight:wJunk }
    ],
    ttlGoodMs,
    ttlJunkMs,

    decorateTarget, // ✅ emoji decoration

    onHit:(meta)=>{
      if(meta.kind === 'good'){
        const gi0 = (meta.groupIndex ?? Math.floor((STATE.rng||Math.random)()*5));
        const groupId = clamp(Number(gi0)+1, 1, 5);
        onHitGood(groupId);
      }else{
        onHitJunk();
      }
    },
    onExpire:(meta)=>{
      if(meta.kind === 'good') onExpireGood();
      // junk expire ไม่คิด miss
    }
  });
}

/**
 * In play mode, as difficulty adapts we rebuild spawner occasionally
 * (cheap because DOM targets are short-lived anyway)
 */
function maybeRebuildSpawner(mount){
  if(!STATE.adaptive.on) return;
  const t = nowMs();
  if(!STATE.__lastRebuildAt) STATE.__lastRebuildAt = 0;
  if(t - STATE.__lastRebuildAt < 1200) return; // throttle rebuild
  STATE.__lastRebuildAt = t;
  buildSpawner(mount);
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

  STATE.g = { 1:0, 2:0, 3:0, 4:0, 5:0 };

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG: research/study => deterministic
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive config
  STATE.adaptive.on = (cfg.runMode === 'play'); // ✅ play only
  STATE.adaptive.baseRate = (cfg.diff === 'hard') ? 820 : (cfg.diff === 'easy' ? 980 : 900);
  STATE.adaptive.rateNow = STATE.adaptive.baseRate;
  STATE.adaptive.ttlGood = 2100;
  STATE.adaptive.ttlJunk = 1700;
  STATE.adaptive.sizeMin = 44;
  STATE.adaptive.sizeMax = 64;
  STATE.adaptive.lastN = [];
  STATE.__lastRebuildAt = 0;

  // phases
  STATE.bossOn = false;
  STATE.stormOn = false;
  setBoss(false);
  setStorm(false);

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  // build spawner
  buildSpawner(mount);

  // in play mode: rebuild spawner occasionally when adaptive changes
  if(STATE.adaptive.on){
    // light hook: after each quest update we might rebuild (throttled)
    WIN.addEventListener('quest:update', ()=> maybeRebuildSpawner(mount));
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}