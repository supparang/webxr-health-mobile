// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (lite)  // ตอนนี้ยังเป็น lite เพื่อความเสถียร
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses: ../vr/mode-factory.js (export boot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
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

  // quest (GOAL = เติมครบ 5 หมู่)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ต่อหมู่)',
    cur:0,
    target:5,
    done:false
  },

  // MINI: accuracy threshold (ตัดสิน “ตอนจบเกม”)
  mini:{
    name:'ความแม่นยำ',
    sub:'จบเกมต้อง ≥ 80% (อย่าให้พลาดเยอะ)',
    cur:0,         // realtime display
    target:80,
    done:false     // final decision at end
  },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  spawner:null, // controller from mode-factory
};

/* ------------------------------------------------
 * Helpers
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function accuracy(){
  // ตามนิยาม miss ของคุณ: good expired (miss good) + junk hit (hit junk)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPct(){
  return Math.round(accuracy()*100);
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss
  });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target,
      done: STATE.goal.done
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
 * Scoring
 * ------------------------------------------------ */
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
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex ?? 0, 0, 4);
  STATE.g[gi]++;

  // scoring
  addCombo();
  addScore(100 + STATE.combo * 6); // เร่งนิด ๆ ให้มันส์ขึ้น

  // goal progress: count distinct groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('สุดยอด! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
    }
  }

  // mini realtime display only (final judge at end)
  STATE.mini.cur = accuracyPct();

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();
  addScore(-60); // junk โดนแล้วเจ็บกว่าเดิมนิดนึง

  // update mini display
  STATE.mini.cur = accuracyPct();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;

  resetCombo();

  // เบากว่าโดน junk แต่ยังเจ็บ
  addScore(-25);

  STATE.mini.cur = accuracyPct();
  emitQuest();
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch(_){}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  stopSpawner();

  // Final judge mini (accuracy)
  const accP = accuracyPct();
  STATE.mini.cur = accP;
  STATE.mini.done = (accP >= STATE.mini.target);

  // Judge packet
  emit('hha:judge', {
    reason,
    goalDone: STATE.goal.done,
    miniDone: STATE.mini.done,
    accuracyGoodPct: accP,
    miss: STATE.miss
  });

  emitQuest();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accP,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
  });

  // Coach final
  if(STATE.goal.done && STATE.mini.done) coach('ผ่าน! เก่งมาก 👏', 'Coach');
  else if(STATE.goal.done && !STATE.mini.done) coach('เติมครบแล้ว แต่ความแม่นยังไม่ถึงนะ ลองใหม่! 🎯', 'Coach');
  else coach('ยังไม่ครบ 5 หมู่ ลองใหม่อีกครั้ง! 🍽️', 'Coach');
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Spawner config by difficulty
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // “เร่งนิด ๆ”: normal เร็วขึ้นจากเดิม, hard เร็วขึ้นชัด
  const spawnRate =
    (diff === 'easy') ? 900 :
    (diff === 'hard') ? 560 :
    720; // normal

  const ttlMs =
    (diff === 'easy') ? 2200 :
    (diff === 'hard') ? 1400 :
    1700;

  const sizeRange =
    (diff === 'easy') ? [54,74] :
    (diff === 'hard') ? [42,62] :
    [48,68];

  // junk weight เร่งความตึง
  const kinds =
    (diff === 'easy')
      ? [{ kind:'good', weight:0.78 }, { kind:'junk', weight:0.22 }]
      : (diff === 'hard')
        ? [{ kind:'good', weight:0.62 }, { kind:'junk', weight:0.38 }]
        : [{ kind:'good', weight:0.70 }, { kind:'junk', weight:0.30 }];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    ttlMs,
    sizeRange,
    kinds,
    onHit:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? Math.floor(STATE.rng()*5));
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset state
  STATE.cfg = cfg || {};
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

  // RNG
  const run = (cfg?.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: random
    STATE.rng = Math.random;
  }

  // time (90 ดีมากสำหรับ ป.5: มีเวลาทำ goal + mini แบบไม่อึดอัด)
  STATE.timeLeft = clamp(cfg?.durationPlannedSec ?? 90, 10, 999);

  emit('hha:start', {
    game:'plate',
    runMode: run,
    diff: (cfg?.diff || 'normal'),
    seed: cfg?.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial UI
  emitScore();
  emitQuest();
  startTimer();

  // start spawner
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}