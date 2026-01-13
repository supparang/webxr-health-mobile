// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — HHA Standard
// ------------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish pace ON (non-deterministic spawn vibe; still seeded spawner)
//   - research/study: deterministic seed + fixed pace (fair & replicable)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Hooks: Boss/Storm placeholders
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) supported by mode-factory
// ------------------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = seed >>> 0;
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

  // ✅ mini quest ใหม่: “ความแม่นต่อเนื่อง”
  mini:{
    name:'ความแม่นต่อเนื่อง',
    sub:'ยิงถูก ≥ 80% ต่อเนื่อง 10 ครั้ง',
    cur:0,        // streak progress
    target:10,
    done:false
  },

  // streak accuracy tracker
  streakHits:0,
  streakGood:0,

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner
  spawner:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Coach / Judge
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}
function judge(type, msg){
  // type: 'good' | 'bad' | 'warn' | 'perfect' etc.
  emit('hha:judge', { type, msg });
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function allDone(){
  return !!(STATE.goal.done && STATE.mini.done);
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
    allDone: allDone()
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
  STATE.score = Math.max(0, (STATE.score + (Number(v)||0))); // ✅ เด็ก: ไม่ปล่อยติดลบ
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
 * Accuracy (overall)
 * ------------------------------------------------ */
function accuracyOverall(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Mini quest: streak accuracy ≥80% for 10 hits
 * ------------------------------------------------ */
function updateStreak(isGood){
  STATE.streakHits++;
  if(isGood) STATE.streakGood++;

  // use rolling streak window = last 10 hits; simplest: reset when below threshold
  const acc = (STATE.streakGood / Math.max(1, STATE.streakHits)) * 100;

  // If accuracy dips too low during streak, reset streak
  if(acc < 80 && STATE.streakHits >= 3){
    STATE.streakHits = 0;
    STATE.streakGood = 0;
    STATE.mini.cur = 0;
    return;
  }

  // progress: count good hits toward target, but require acc >= 80
  if(acc >= 80){
    STATE.mini.cur = clamp(STATE.mini.cur + (isGood ? 1 : 0), 0, STATE.mini.target);
  }

  if(!STATE.mini.done && STATE.mini.cur >= STATE.mini.target){
    STATE.mini.done = true;
    coach('สุดยอด! ความแม่นต่อเนื่องผ่านแล้ว ✅', 'Coach');
    judge('perfect','ACCURACY STREAK!');
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  emit('hha:end', {
    reason,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracyOverall() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // passthrough meta (useful for logger)
    game:'plate',
    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',
    seed: STATE.cfg?.seed || '',
    durationPlannedSec: STATE.cfg?.durationPlannedSec || ''
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

    // optional low-time pressure
    if(STATE.timeLeft === 15) coach('เหลือ 15 วิ! เร่งเก็บให้ครบ 🔥', 'Coach');

    if(STATE.timeLeft <= 0){
      endGame(allDone() ? 'win' : 'timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(95 + STATE.combo * 6);

  // goal progress = number of groups collected at least once
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
      judge('good','ครบ 5 หมู่!');
    }
  }

  // mini streak
  if(!STATE.mini.done) updateStreak(true);

  // quick judge feedback
  if(STATE.combo > 0 && (STATE.combo % 6 === 0)) judge('perfect', `COMBO x${STATE.combo}!`);

  emitQuest();

  // ✅ win condition: done both -> end early
  if(allDone()){
    coach('ผ่านภารกิจครบ! เก่งมาก 🏁', 'Coach');
    endGame('win');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // ✅ ลดโทษนิด: เด็กไม่ท้อ
  addScore(-40);

  // streak collapses
  STATE.streakHits = 0;
  STATE.streakGood = 0;
  if(!STATE.mini.done) STATE.mini.cur = 0;

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  judge('warn','JUNK!');

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // streak decay (soft)
  STATE.streakHits = 0;
  STATE.streakGood = 0;
  if(!STATE.mini.done) STATE.mini.cur = 0;

  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic (mode-factory)
 * ------------------------------------------------ */
function spawnerConfigByDiff(diff){
  // “เร่งนิด ๆ” แต่ยังคุมได้
  if(diff === 'hard'){
    return { spawnRate: 650, sizeRange:[42,60], junkW:0.34 };
  }
  if(diff === 'easy'){
    return { spawnRate: 900, sizeRange:[50,70], junkW:0.24 };
  }
  return { spawnRate: 780, sizeRange:[46,66], junkW:0.30 }; // normal
}

function makeSpawner(mount){
  const d = spawnerConfigByDiff(STATE.cfg.diff);

  return spawnBoot({
    mount,

    // keep determinism for research; for play it still can be seeded, but gameplay feel is ok
    seed: STATE.cfg.seed,

    spawnRate: d.spawnRate,
    sizeRange: d.sizeRange,

    // kinds (good / junk)
    kinds:[
      { kind:'good', weight:(1 - d.junkW) },
      { kind:'junk', weight:d.junkW }
    ],

    // optional: groupIndex assigned by engine; if not, pick rng
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(clamp(gi,0,4));
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

  STATE.cfg = cfg;

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

  STATE.streakHits = 0;
  STATE.streakGood = 0;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: non-deterministic feel
    STATE.rng = Math.random;
  }

  // time (boot gives default 90)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}