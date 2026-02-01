// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + Boss Phase (FUN & PASSABLE)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase (REAL), Storm phase (hook)
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

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}

function setBossFx(on, panic=false){
  const el = DOC.getElementById('bossFx');
  if(!el) return;
  el.classList.toggle('boss-on', !!on);
  el.classList.toggle('boss-panic', !!panic);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
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
  bossPerGroupTarget:2,      // ✅ บอส: ให้แต่ละหมู่ >= 2
  bossDurationMs:12000,      // ✅ บอสยาว 12 วิ
  bossTimeBonusSec:10        // ✅ ผ่านบอส +10 วิ
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function bossProgressCount(){
  // how many groups reached boss target
  const t = STATE.bossPerGroupTarget;
  let ok = 0;
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) >= t) ok++;
  }
  return ok; // 0..5
}

function emitQuest(){
  // Goal changes during boss
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
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
    try{ STATE.spawner.stop(); }catch{}
  }
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  stopSpawner();
  setBossFx(false,false);

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
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // boss countdown (panic effect last 3 sec)
    if(STATE.bossOn && !STATE.bossDone){
      const leftMs = STATE.bossEndsAtMs - (performance.now ? performance.now() : Date.now());
      setBossFx(true, leftMs <= 3000);
      if(leftMs <= 0){
        // boss ends whether pass or not
        if(bossProgressCount() >= 5){
          // should already be done; just safety
          STATE.bossDone = true;
        }else{
          coach('บอสหนีไปก่อน! ลองใหม่อีกรอบนะ 😆', 'Boss');
        }
        STATE.bossOn = false;
        setBossFx(false,false);
        emitQuest();
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
 * Boss trigger / clear
 * ------------------------------------------------ */
function startBoss(){
  if(STATE.bossOn || STATE.bossDone) return;

  // only in play mode (research can keep calm)
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  if(isResearch) return;

  STATE.bossOn = true;
  const nowMs = performance.now ? performance.now() : Date.now();
  STATE.bossEndsAtMs = nowMs + STATE.bossDurationMs;

  setBossFx(true,false);
  coach('👾 บอสมาแล้ว! ทำให้ “บาลานซ์” — แต่ละหมู่ให้ได้อย่างน้อย 2 ชิ้น!', 'Boss');
  emitQuest();
}

function clearBoss(){
  if(!STATE.bossOn || STATE.bossDone) return;

  STATE.bossDone = true;
  STATE.bossOn = false;
  setBossFx(false,false);

  // reward
  STATE.timeLeft += STATE.bossTimeBonusSec;
  addScore(350);

  coach(`ผ่านบอส! +${STATE.bossTimeBonusSec} วิ ⏱️`, 'Boss');
  emitQuest();
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalAndMiniAfterGood(){
  // goal progress (base goal: collect all 5 at least once)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉');
      // ✅ trigger boss immediately (play mode)
      startBoss();
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  // boss clear check
  if(STATE.bossOn && !STATE.bossDone){
    if(bossProgressCount() >= 5){
      clearBoss();
    }
  }

  emitQuest();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalAndMiniAfterGood();
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
 * Decorate target (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: good/junk
  if(target.kind === 'junk'){
    el.textContent = pickEmoji(target.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    return;
  }
  // good
  const gid = clamp((target.groupIndex ?? 0) + 1, 1, 5); // 1..5
  el.textContent = emojiForGroup(target.rng, gid);
  el.dataset.group = String(gid);

  // optional: tooltip-ish
  el.title = labelForGroup(gid);
}

/* ------------------------------------------------
 * Spawn logic helpers
 * ------------------------------------------------ */
function chooseGoodGroupIndex(rng){
  // ✅ Make “ครบ 5 หมู่” achievable:
  // If some groups are 0, bias strongly to missing groups.
  const missing = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) missing.push(i);
  }
  if(missing.length){
    return missing[Math.floor(rng() * missing.length)];
  }

  // During boss: bias toward groups that are below boss target
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

  // otherwise uniform
  return Math.floor(rng()*5);
}

function makeSpawner(mount){
  // Adaptive for play mode only
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  const isHard = STATE.cfg.diff === 'hard';

  const baseRate = isHard ? 680 : 880;      // default speed
  const bossRate = isHard ? 520 : 620;      // boss faster
  const rate = (!isResearch && STATE.bossOn && !STATE.bossDone) ? bossRate : baseRate;

  // junk weight increases a bit in boss (fun), but not too much
  const baseJunk = isHard ? 0.32 : 0.28;
  const bossJunk = isHard ? 0.40 : 0.36;
  const jw = (!isResearch && STATE.bossOn && !STATE.bossDone) ? bossJunk : baseJunk;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:1 - jw },
      { kind:'junk', weight:jw }
    ],
    decorateTarget, // ✅ emoji
    onHit:(t)=>{
      if(t.kind === 'good'){
        // group index picked with “missing/boss needs” bias
        const gi = chooseGoodGroupIndex(t.rng || STATE.rng);
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

  // boss reset
  STATE.bossOn = false;
  STATE.bossDone = false;
  STATE.bossEndsAtMs = 0;
  setBossFx(false,false);

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
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
  startTimer();

  // spawner
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}