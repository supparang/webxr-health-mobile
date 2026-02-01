// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + Boss + Storm (FUN & PASSABLE)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON + Storm ON
//   - research/study: deterministic seed + adaptive OFF + Storm OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase (REAL), Storm phase (REAL)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function setBossFx(on, panic=false){
  const el = DOC.getElementById('bossFx');
  if(!el) return;
  el.classList.toggle('boss-on', !!on);
  el.classList.toggle('boss-panic', !!panic);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function setStormFx(on){
  const el = DOC.getElementById('stormFx');
  if(!el) return;
  el.classList.toggle('storm-on', !!on);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function popCenterText(text, cls=''){
  try{
    const P = WIN.Particles;
    if(!P || typeof P.popText !== 'function') return;
    P.popText(Math.round(innerWidth*0.5), Math.round(innerHeight*0.35), text, cls);
  }catch{}
}

function setSpawnSafePadding(px){
  // used by mode-factory.js readSafeVars()
  const v = `${Math.max(0, Math.round(Number(px)||0))}px`;
  const root = DOC.documentElement;
  if(!root) return;
  root.style.setProperty('--plate-top-safe', v);
  root.style.setProperty('--plate-bottom-safe', v);
  root.style.setProperty('--plate-left-safe', v);
  root.style.setProperty('--plate-right-safe', v);
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

  // spawn
  spawner:null,

  // --- Boss phase ---
  bossOn:false,
  bossDone:false,
  bossEndsAtMs:0,
  bossPerGroupTarget:2,
  bossDurationMs:12000,
  bossTimeBonusSec:10,

  // --- Storm phase ---
  stormOn:false,
  stormEndsAtMs:0,
  stormDurationMs:8000,     // 8 sec
  stormEverySec:22,         // every ~22 sec (play mode only)
  stormNextAtSec:0
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function isResearch(){
  return (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function bossProgressCount(){
  const t = STATE.bossPerGroupTarget;
  let ok = 0;
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) >= t) ok++;
  }
  return ok;
}

function emitQuest(){
  const goal = (STATE.bossOn && !STATE.bossDone)
    ? {
        name: '👾 BOSS: ทำให้ “บาลานซ์”',
        sub: `เติมแต่ละหมู่ให้ได้อย่างน้อย ${STATE.bossPerGroupTarget} ชิ้น`,
        cur: bossProgressCount(),
        target: 5
      }
    : {
        name: STATE.goal.name,
        sub: STATE.goal.sub,
        cur: STATE.goal.cur,
        target: STATE.goal.target
      };

  emit('quest:update', {
    goal,
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: (STATE.goal.done && STATE.mini.done) || (STATE.bossDone && STATE.mini.done)
  });
}

/* ------------------------------------------------
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += v;
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
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
 * Spawner control
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
    try{ STATE.spawner.stop(); }catch{}
  }
  STATE.spawner = null;
}

function restartSpawner(mount){
  // stop then recreate with current mode flags (boss/storm)
  stopSpawner();
  STATE.spawner = makeSpawner(mount);
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

  // reset FX
  setBossFx(false,false);
  setStormFx(false);
  setSpawnSafePadding(0);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: (STATE.goal.done || STATE.bossDone) ? 1 : 0,
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
}

/* ------------------------------------------------
 * Boss trigger / clear
 * ------------------------------------------------ */
function startBoss(mount){
  if(STATE.bossOn || STATE.bossDone) return;
  if(isResearch()) return;

  STATE.bossOn = true;
  const nowMs = performance.now ? performance.now() : Date.now();
  STATE.bossEndsAtMs = nowMs + STATE.bossDurationMs;

  setBossFx(true,false);
  coach('👾 บอสมาแล้ว! ทำให้ “บาลานซ์” — แต่ละหมู่ให้ได้อย่างน้อย 2 ชิ้น!', 'Boss');
  popCenterText('👾 BOSS!', 'boss');

  // boss usually intensifies spawn
  restartSpawner(mount);
  emitQuest();
}

function clearBoss(){
  if(!STATE.bossOn || STATE.bossDone) return;

  STATE.bossDone = true;
  STATE.bossOn = false;
  setBossFx(false,false);

  STATE.timeLeft += STATE.bossTimeBonusSec;
  addScore(350);

  coach(`ผ่านบอส! +${STATE.bossTimeBonusSec} วิ ⏱️`, 'Boss');
  popCenterText(`+${STATE.bossTimeBonusSec}s`, 'good');

  emitQuest();
}

/* ------------------------------------------------
 * Storm trigger / clear
 * ------------------------------------------------ */
function startStorm(mount){
  if(STATE.stormOn) return;
  if(isResearch()) return;          // research: no storm
  if(STATE.bossOn && !STATE.bossDone) return; // avoid overlapping with boss

  STATE.stormOn = true;
  const nowMs = performance.now ? performance.now() : Date.now();
  STATE.stormEndsAtMs = nowMs + STATE.stormDurationMs;

  setStormFx(true);
  setSpawnSafePadding(24);          // ✅ squeeze play area
  coach('🌪️ STORM! เป้าจะไวขึ้น—ตั้งใจนะ!', 'Storm');
  popCenterText('🌪️ STORM!', 'warn');

  restartSpawner(mount);
}

function clearStorm(mount){
  if(!STATE.stormOn) return;

  STATE.stormOn = false;
  setStormFx(false);
  setSpawnSafePadding(0);

  coach('พายุจบแล้ว! ไปต่อ 👊', 'Storm');
  popCenterText('OK!', 'good');

  restartSpawner(mount);
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(mount){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // boss panic last 3 sec
    if(STATE.bossOn && !STATE.bossDone){
      const leftMs = STATE.bossEndsAtMs - (performance.now ? performance.now() : Date.now());
      setBossFx(true, leftMs <= 3000);
      if(leftMs <= 0){
        if(bossProgressCount() >= 5) STATE.bossDone = true;
        else coach('บอสหนีไปก่อน! ลองใหม่อีกรอบนะ 😆', 'Boss');
        STATE.bossOn = false;
        setBossFx(false,false);
        emitQuest();
      }
    }

    // storm end check
    if(STATE.stormOn){
      const leftMs = STATE.stormEndsAtMs - (performance.now ? performance.now() : Date.now());
      if(leftMs <= 0){
        clearStorm(mount);
      }
    }

    // storm schedule (play only)
    if(!isResearch() && !STATE.stormOn && !STATE.bossOn){
      // trigger at a certain remaining-time pattern (simple & reliable)
      // we schedule by "elapsed sec"
      const elapsed = (STATE.cfg.durationPlannedSec - STATE.timeLeft);
      if(elapsed >= STATE.stormNextAtSec){
        startStorm(mount);
        STATE.stormNextAtSec = elapsed + STATE.stormEverySec;
      }
    }

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Decorate target (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  if(target.kind === 'junk'){
    el.textContent = pickEmoji(target.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    return;
  }
  const gid = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  el.textContent = emojiForGroup(target.rng, gid);
  el.dataset.group = String(gid);
  el.title = labelForGroup(gid);
}

/* ------------------------------------------------
 * Spawn logic helpers
 * ------------------------------------------------ */
function chooseGoodGroupIndex(rng){
  // ✅ guarantee "ครบ 5 หมู่" achievable:
  const missing = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) missing.push(i);
  }
  if(missing.length){
    return missing[Math.floor(rng() * missing.length)];
  }

  // boss: bias toward groups below target
  if(STATE.bossOn && !STATE.bossDone){
    const need = [];
    const t = STATE.bossPerGroupTarget;
    for(let i=0;i<5;i++){
      if((STATE.g[i]||0) < t) need.push(i);
    }
    if(need.length){
      return need[Math.floor(rng() * need.length)];
    }
  }

  return Math.floor(rng()*5);
}

function makeSpawner(mount){
  const hard = STATE.cfg.diff === 'hard';

  // rates
  const baseRate  = hard ? 680 : 880;
  const stormRate = hard ? 520 : 640;
  const bossRate  = hard ? 520 : 620;

  let rate = baseRate;
  if(!isResearch() && STATE.bossOn && !STATE.bossDone) rate = bossRate;
  else if(!isResearch() && STATE.stormOn) rate = stormRate;

  // junk weights
  const baseJunk  = hard ? 0.32 : 0.28;
  const stormJunk = hard ? 0.42 : 0.36;
  const bossJunk  = hard ? 0.40 : 0.36;

  let jw = baseJunk;
  if(!isResearch() && STATE.bossOn && !STATE.bossDone) jw = bossJunk;
  else if(!isResearch() && STATE.stormOn) jw = stormJunk;

  // TTL feel: in storm, make targets disappear quicker
  const goodTtl = (!isResearch() && STATE.stormOn) ? 1650 : 2100;
  const junkTtl = (!isResearch() && STATE.stormOn) ? 1350 : 1700;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:1 - jw },
      { kind:'junk', weight:jw }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = chooseGoodGroupIndex(t.rng || STATE.rng);
        onHitGood(gi, mount);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    },

    // ⚠️ mode-factory.js currently owns ttlMs by kind.
    // If you want ttl per mode, add ttl overrides there later.
    // For now: we simulate via faster spawn + squeeze area + heavier junk.
  });
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalAndMiniAfterGood(mount){
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉');
      startBoss(mount);
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  if(STATE.bossOn && !STATE.bossDone){
    if(bossProgressCount() >= 5){
      clearBoss();
    }
  }

  emitQuest();
}

function onHitGood(groupIndex, mount){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalAndMiniAfterGood(mount);
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
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

  // boss reset
  STATE.bossOn = false;
  STATE.bossDone = false;
  STATE.bossEndsAtMs = 0;
  setBossFx(false,false);

  // storm reset
  STATE.stormOn = false;
  STATE.stormEndsAtMs = 0;
  setStormFx(false);
  setSpawnSafePadding(0);
  STATE.stormNextAtSec = 14; // first storm around 14s in (play only)

  // RNG
  if(isResearch()){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();

  // spawner
  STATE.spawner = makeSpawner(mount);

  // timer includes storm scheduling
  startTimer(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}