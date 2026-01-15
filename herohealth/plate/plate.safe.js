// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (optional light adapt)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks placeholders)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

// keep % as number (not string)
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowIso(){ return new Date().toISOString(); }

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
  timePlanned:90,
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
    // IMPORTANT: end-judged
    sub:'คุมความแม่น ≥ 80% (ตัดสินตอนจบ)',
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
  rngSeed:0,

  // spawn engine instance
  engine:null,

  // mount
  mount:null,
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
  emitScore();
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracyRatio(){
  // "attempts" = hitGood + hitJunk + expireGood
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accuracyPct(){
  return round2(accuracyRatio() * 100);
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function recomputeGoal(){
  // goal: unique groups collected >= 1 each
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function recomputeMiniLive(){
  // mini: show progress live, but DO NOT set done here (end-judged)
  const acc = accuracyPct();
  STATE.mini.cur = Math.round(acc);
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // final mini judge (end-judged)
  const acc = accuracyPct();
  STATE.mini.cur = Math.round(acc);
  STATE.mini.done = (acc >= STATE.mini.target);

  // A little feedback at end
  if(STATE.mini.done) coach('สรุป: ความแม่นยำผ่านแล้ว! ✅', 'Coach');
  else coach('สรุป: ลองคุมความแม่นให้สูงขึ้นอีกนิดนะ 💪', 'Coach');

  emitQuest();

  // emit end summary (match cloud logger fields where possible)
  emit('hha:end', {
    projectTag: 'herohealth',
    gameMode: 'plate',

    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',
    seed: STATE.rngSeed,

    durationPlannedSec: STATE.timePlanned,
    durationPlayedSec: STATE.timePlanned - Math.max(0, STATE.timeLeft),

    reason,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    accuracyGoodPct: acc,

    // 5 หมู่ (optional breakdown)
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // timestamps (optional)
    startTimeIso: STATE.cfg?._startTimeIso || '',
    endTimeIso: nowIso()
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
function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress
  recomputeGoal();

  // mini progress live
  recomputeMiniLive();

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  recomputeMiniLive();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  recomputeMiniLive();
  emitQuest();
}

/* ------------------------------------------------
 * Crosshair shooting support (vr-ui.js emits hha:shoot)
 * We do a small "lock radius" click test around (x,y).
 * Targets are DOM elements spawned inside mount with style transform/left/top.
 * We can use elementFromPoint for reliability.
 * ------------------------------------------------ */
function wireShoot(){
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!STATE.running || STATE.ended) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx ?? 28) || 28;

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // try center point first
    let el = DOC.elementFromPoint(x, y);

    // if not a target, try a few offsets inside lock radius (cheap, deterministic)
    if(!el || !(el.classList && el.classList.contains('plateTarget'))){
      const offsets = [
        [0,0],[lockPx,0],[-lockPx,0],[0,lockPx],[0,-lockPx],
        [lockPx*0.7,lockPx*0.7],[-lockPx*0.7,lockPx*0.7],[lockPx*0.7,-lockPx*0.7],[-lockPx*0.7,-lockPx*0.7]
      ];
      for(const [ox,oy] of offsets){
        el = DOC.elementFromPoint(x+ox, y+oy);
        if(el && el.classList && el.classList.contains('plateTarget')) break;
      }
    }

    if(el && el.classList && el.classList.contains('plateTarget')){
      // simulate hit (engine in mode-factory should also listen click; but we force click)
      try { el.click(); } catch(_){}
    }
  }, { passive:true });
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  // light "เร่งนิด ๆ": spawnRate slightly faster
  const base = (STATE.cfg.diff === 'hard') ? 650 : 820;

  return spawnBoot({
    mount,
    seed: STATE.rngSeed,
    spawnRate: base,
    sizeRange:[44,64],

    // optional: tune density by device/view
    spawnAroundCrosshair: false,

    kinds:[
      { kind:'good',   weight:0.72 },
      { kind:'junk',   weight:0.28 }
    ],

    // NOTE: mode-factory should create DOM nodes with class "plateTarget"
    // and include target object with {kind, groupIndex?}
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        // if mode-factory doesn't set groupIndex, pick deterministically from rng
        const gi = (t.groupIndex != null)
          ? t.groupIndex
          : Math.floor(STATE.rng() * 5);
        onHitGood(gi);
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

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // store
  STATE.mount = mount;
  STATE.cfg = cfg || {};

  // defaults (kid-friendly)
  const planned = Number(cfg.durationPlannedSec ?? 90) || 90;
  STATE.timePlanned = clamp(planned, 10, 999);
  STATE.timeLeft = STATE.timePlanned;

  // reset run state
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
  STATE.mini.target = clamp(cfg.miniTarget ?? 80, 50, 95); // allow experiments but keep sane

  // RNG
  const seed = Number(cfg.seed ?? Date.now()) || Date.now();
  STATE.rngSeed = seed;

  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(seed);
  }else{
    STATE.rng = Math.random;
  }

  // stamp start time for logger
  STATE.cfg._startTimeIso = nowIso();

  // Emit start meta (cloud logger picks up)
  emit('hha:start', {
    projectTag: 'herohealth',
    gameMode: 'plate',
    runMode: cfg.runMode || 'play',
    diff: cfg.diff || 'normal',
    seed: seed,
    durationPlannedSec: STATE.timePlanned,
    view: cfg.view || '',
    startTimeIso: STATE.cfg._startTimeIso
  });

  // initial quest state
  recomputeGoal();
  recomputeMiniLive();
  emitQuest();

  // timer
  startTimer();

  // spawner
  STATE.engine = makeSpawner(mount);

  // crosshair shoot
  wireShoot();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}