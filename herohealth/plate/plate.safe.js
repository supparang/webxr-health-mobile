// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ✅ Fix: ModeFactory is GLOBAL (no ESM import) -> avoids export error
// ✅ Mini accuracy: track live, decide PASS at end (fair + less instant-clear)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end

'use strict';

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

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * ModeFactory resolver (GLOBAL)
 * ------------------------------------------------ */
function getModeFactoryBoot(){
  const gm = WIN.GAME_MODULES || {};
  const fn =
    gm?.ModeFactory?.boot ||
    gm?.modeFactory?.boot ||
    WIN?.ModeFactory?.boot ||
    null;

  if (typeof fn === 'function') return fn;

  console.error('[PlateVR] ModeFactory boot not found', {
    GAME_MODULES_keys: Object.keys(gm || {}),
    GAME_MODULES: gm
  });

  throw new Error('ModeFactory boot not found. Ensure ../vr/mode-factory.js is loaded (defer) BEFORE plate.boot.js.');
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

  // 5 groups
  g:[0,0,0,0,0],

  // quests
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ชิ้น/หมู่)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80% จนจบเกม',
    cur:0,          // live accuracy %
    target:80,      // threshold
    done:false      // decide at end
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  // mode-factory instance
  spawner:null,
};

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;

  // ✅ Decide mini at end
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  STATE.mini.done = accPct >= STATE.mini.target;

  if(STATE.mini.done) coach('จบเกมแล้ว! ความแม่นยำผ่าน ✅', 'Coach');
  else coach('เกือบแล้ว! ลองคุมความแม่นเพิ่มอีกนิดนะ 💪', 'Coach');

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

    accuracyGoodPct: pct(accPct),

    // optional group counts
    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],
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
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = number of groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉');
    }
  }

  // mini live display only (do not lock done mid-game)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  // update mini live %
  STATE.mini.cur = Math.round(accuracy() * 100);
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // update mini live %
  STATE.mini.cur = Math.round(accuracy() * 100);
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic (via ModeFactory GLOBAL)
 * ------------------------------------------------ */
function makeSpawner(mount){
  const modeBoot = getModeFactoryBoot();

  // NOTE: use parameters that your mode-factory supports
  return modeBoot({
    mount,
    seed: STATE.cfg.seed,

    // pace: “เร่งนิด ๆ” (normal เร็วขึ้นนิด)
    spawnRate: (STATE.cfg.diff === 'hard') ? 650 : (STATE.cfg.diff === 'easy' ? 950 : 820),

    sizeRange:[46,66],

    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 },
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