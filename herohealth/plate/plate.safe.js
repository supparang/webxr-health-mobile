// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ✅ Play / Research
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)

'use strict';

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
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------
 * Find ModeFactory boot (GLOBAL)
 * ------------------------------------------------ */
function getSpawnBoot(){
  // Common patterns we use across HHA:
  // window.GAME_MODULES.ModeFactory.boot
  // window.ModeFactory.boot
  // window.GAME_MODULES.modeFactory.boot (fallback)
  const gm = WIN.GAME_MODULES || {};
  const cand =
    (gm.ModeFactory && gm.ModeFactory.boot) ||
    (gm.modeFactory && gm.modeFactory.boot) ||
    (WIN.ModeFactory && WIN.ModeFactory.boot) ||
    null;

  if (typeof cand === 'function') return cand;

  // Give a very clear error
  throw new Error(
    'ModeFactory boot not found. Ensure ../vr/mode-factory.js is loaded (script defer) BEFORE plate.boot.js / plate.safe.js.'
  );
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
  g:[0,0,0,0,0],

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

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score += v;
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}

function resetCombo(){ STATE.combo = 0; }

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

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
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
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal: count unique groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic (ModeFactory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const spawnBoot = getSpawnBoot();

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    // “เร่งนิด ๆ” ตามที่ขอ: ปรับ rate ให้ไวขึ้นเล็กน้อย
    spawnRate: STATE.cfg.diff === 'hard' ? 600 : (STATE.cfg.diff === 'easy' ? 850 : 720),
    sizeRange:[46, 66],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
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

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time: 90 วินาที “ดีมาก” สำหรับ ป.5 (พอให้ครบ 5 หมู่ + มีลุ้น mini)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    projectTag:'HeroHealth',
    game:'plate',
    gameMode:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}