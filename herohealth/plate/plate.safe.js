// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive pacing ON (realtime spawn pace)
//   - research/study: deterministic seed + pacing OFF (fixed base)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ FIX: mode-factory loaded as global (no ES export)
// ------------------------------------------------

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

// deterministic rng for study/research
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
 * Get ModeFactory (global)
 * ------------------------------------------------ */
function getModeFactoryBoot(){
  // preferred namespace used in other games
  const mf = WIN.GAME_MODULES?.ModeFactory || WIN.ModeFactory || null;
  const boot = mf?.boot || mf?.make?.boot || null;
  if(typeof boot !== 'function'){
    throw new Error('PlateVR: ModeFactory.boot not found (did you load ../vr/mode-factory.js with <script>?)');
  }
  return boot;
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

  // quest (1 goal + 1 mini)
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

  // spawner instance
  engine:null
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
 * Coach helper
 * ------------------------------------------------ */
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
  STATE.score += v;
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
 * Spawn pace (realtime)
 * - play: เร่งช่วงท้าย 15s (factor 0.85 = เร่งนิด ๆ)
 * - research/study: คงที่
 * ------------------------------------------------ */
function computeSpawnMs(){
  const run  = (STATE.cfg?.runMode || 'play').toLowerCase();
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  const base = (diff === 'hard') ? 700 : 900;

  // research/study = fixed pacing
  if(run === 'research' || run === 'study') return base;

  const left = Number(STATE.timeLeft) || 0;

  // เร่งนิด ๆ (0.85) ช่วงท้าย
  const factor = (left <= 15) ? 0.85 : 1.0;

  // floor กันโหดเกิน
  const floorMs = (diff === 'hard') ? 560 : 580;

  return Math.max(floorMs, Math.round(base * factor));
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);

  // stop spawner
  try{ STATE.engine?.stop?.(); }catch(_){}

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

    // ✅ ช่วงท้าย: อาจปล่อย coach hint 1 ครั้ง
    if(STATE.timeLeft === 15){
      const run = (STATE.cfg?.runMode || 'play').toLowerCase();
      if(run !== 'research' && run !== 'study'){
        coach('⏳ 15 วิสุดท้าย! เป้าเร็วขึ้นนิดนึงแล้วนะ!', 'System');
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
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = จำนวนหมู่ที่มีอย่างน้อย 1 ชิ้น
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini (accuracy)
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
  emitScore();
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitScore();
  emitQuest();
}

/* ------------------------------------------------
 * Spawner (ModeFactory)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const mfBoot = getModeFactoryBoot();

  return mfBoot({
    mount,
    seed: Number(STATE.cfg?.seed || Date.now()),

    // ✅ realtime spawn pace
    getSpawnRate: ()=> computeSpawnMs(),

    // fallback (if ModeFactory ignores getSpawnRate, still has a base)
    spawnRate: computeSpawnMs(),

    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],

    // IMPORTANT: ModeFactory will pass target info back
    onHit:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(clamp(gi,0,4));
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

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset state
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
  const runMode = (STATE.cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(Number(STATE.cfg.seed || Date.now()));
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: STATE.cfg.runMode || 'play',
    diff: STATE.cfg.diff || 'normal',
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}