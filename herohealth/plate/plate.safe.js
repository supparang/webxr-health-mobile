// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss/Storm hooks (CSS ids exist): #bossFx #stormFx (optional)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * Utils
 * ------------------------------------------------ */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0) || 1;
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * State
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
  g:[0,0,0,0,0],

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },

  // ✅ mini: “รักษาความแม่น ≥80% ต่อเนื่อง 8 ครั้ง”
  mini:{
    name:'ความแม่นต่อเนื่อง',
    sub:'ทำถูกติดกัน 8 ครั้ง (≥ 80%)',
    cur:0,
    target:8,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mini streak helper
  goodStreak:0,

  // cfg/rng
  cfg:null,
  rng:Math.random,

  // spawner engine
  engine:null,

  // crosshair shooter
  shootHandler:null,
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
 * Score
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
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){
  STATE.combo = 0;
}

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
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
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // cleanup shoot handler
  if(STATE.shootHandler){
    WIN.removeEventListener('hha:shoot', STATE.shootHandler);
    STATE.shootHandler = null;
  }

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
 * Hit logic
 * ------------------------------------------------ */
function updateGoalProgress(){
  // goal = “ครบ 5 หมู่” -> นับว่าหมู่ไหนเคยได้อย่างน้อย 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgressGood(){
  // mini = streak good hits
  STATE.goodStreak++;
  STATE.mini.cur = clamp(STATE.goodStreak, 0, STATE.mini.target);

  if(!STATE.mini.done && STATE.mini.cur >= STATE.mini.target){
    STATE.mini.done = true;
    coach('สุดยอด! ทำถูกติดกันครบแล้ว 👍');
  }
}

function breakMiniProgressBad(){
  STATE.goodStreak = 0;
  STATE.mini.cur = 0;
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  // คะแนนแบบเด็กเข้าใจง่าย: base 100 + combo bonus นิด ๆ
  addScore(100 + Math.min(STATE.combo, 25) * 6);

  updateGoalProgress();

  // ถ้า accuracy โดยรวมยังต่ำมาก ให้ช่วยสะกิด
  const accPct = accuracy() * 100;
  if(accPct < 60 && STATE.hitGood >= 6 && (STATE.hitGood % 6 === 0)){
    coach('ลองเล็งให้ชัดขึ้นนะ จะได้คอมโบยาว ๆ ✨');
  }

  // mini (streak)
  updateMiniProgressGood();

  emitQuest();

  // ถ้าครบทั้ง goal+mini ก่อนหมดเวลา ให้จบแบบ “win”
  if(STATE.goal.done && STATE.mini.done && STATE.timeLeft > 0){
    endGame('all-done');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  breakMiniProgressBad();

  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  breakMiniProgressBad();
  emitQuest();
}

/* ------------------------------------------------
 * Crosshair shooter: pick nearest target to (x,y)
 * ------------------------------------------------ */
function attachShooter(mount){
  const pickNearest = (x, y, lockPx=28)=>{
    const list = mount ? mount.querySelectorAll('.plateTarget') : [];
    let best = null;
    let bestD = Infinity;

    for(const el of list){
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.hypot(dx, dy);
      if(d < bestD){
        bestD = d;
        best = el;
      }
    }
    if(best && bestD <= Math.max(18, Number(lockPx)||28)){
      best.click();
      return true;
    }
    return false;
  };

  STATE.shootHandler = (e)=>{
    const d = e.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx ?? 28);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    // Try pick nearest within lockPx
    pickNearest(x, y, lockPx);
  };

  WIN.addEventListener('hha:shoot', STATE.shootHandler);
}

/* ------------------------------------------------
 * Spawner config
 * ------------------------------------------------ */
function calcSpawnRate(diff){
  // ✅ “เร่งนิด ๆ” แต่ยังคุมได้สำหรับ ป.5
  // easy: 950ms, normal: 820ms, hard: 720ms
  if(diff === 'easy') return 950;
  if(diff === 'hard') return 720;
  return 820;
}

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // spawn pacing
    spawnRate: calcSpawnRate(diff),

    // sizes
    sizeRange: diff === 'hard' ? [42,60] : [46,66],

    // good vs junk balance
    kinds:[
      { kind:'good', weight: diff === 'hard' ? 0.68 : 0.72 },
      { kind:'junk', weight: diff === 'hard' ? 0.32 : 0.28 }
    ],

    // hooks
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;

      if(t.kind === 'good'){
        const gi = (t.groupIndex != null)
          ? clamp(t.groupIndex, 0, 4)
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
 * Boot
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
  STATE.goodStreak = 0;

  // RNG
  const rm = (STATE.cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time: DO NOT extend time here; trust cfg
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: rm,
    diff: (STATE.cfg.diff || 'normal'),
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // attach shooter (crosshair)
  attachShooter(mount);

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // hint for kids early
  setTimeout(()=>{
    if(!STATE.running || STATE.ended) return;
    coach('ทิป: เล็ง “ของดี” ก่อน แล้วค่อยหลบของหวาน/ทอด 😄', 'Coach');
  }, 1200);
}