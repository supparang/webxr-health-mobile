// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// ✅ 1) Last 15s Rush: more junk + slightly faster spawn
// ✅ 2) Coach rate-limit (no spam)
// ✅ 3) End summary includes miss breakdown: hitJunk vs expireGood

'use strict';

const WIN = window;

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
  throw new Error('ModeFactory boot not found. Load ../vr/mode-factory.js (defer) before plate.boot.js');
}

/* ------------------------------------------------
 * Coach rate-limit (no spam)
 * ------------------------------------------------ */
const COACH = { lastAt:0, lastMsg:'', lastKey:'' };
function coach(msg, tag='Coach', key='msg', minGapMs=900){
  const now = Date.now();
  const text = String(msg||'');
  if(!text) return;

  // same msg/key too soon -> skip
  if((key && key === COACH.lastKey) && (now - COACH.lastAt) < minGapMs) return;
  if(text === COACH.lastMsg && (now - COACH.lastAt) < minGapMs) return;

  COACH.lastAt = now;
  COACH.lastMsg = text;
  COACH.lastKey = key;

  emit('hha:coach', { msg:text, tag });
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

  g:[0,0,0,0,0],

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ชิ้น/หมู่)', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80% จนจบเกม', cur:0, target:80, done:false },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  mount:null,
  spawner:null,

  // ✅ rush flag
  rush:false
};

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function addScore(v){
  STATE.score += v;
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

/* ------------------------------------------------
 * Spawner control (rush tune)
 * ------------------------------------------------ */
function baseSpawnRate(diff){
  if(diff === 'hard') return 650;
  if(diff === 'easy') return 950;
  return 820; // normal
}
function makeSpawnerParams(rush=false){
  // rush: more junk + faster spawn
  const goodW = rush ? 0.58 : 0.72;
  const junkW = rush ? 0.42 : 0.28;

  return {
    mount: STATE.mount,
    seed: STATE.cfg.seed,
    spawnRate: rush ? Math.max(520, baseSpawnRate(STATE.cfg.diff) - 140) : baseSpawnRate(STATE.cfg.diff),
    sizeRange:[46,66],
    kinds:[
      { kind:'good', weight:goodW },
      { kind:'junk', weight:junkW },
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
  };
}

function startSpawner(rush=false){
  const modeBoot = getModeFactoryBoot();
  const params = makeSpawnerParams(rush);
  return modeBoot(params);
}

function stopSpawner(sp){
  if(!sp) return;
  try{ sp.stop?.(); }catch(_){}
  try{ sp.destroy?.(); }catch(_){}
  try{ sp.dispose?.(); }catch(_){}
}

function applyRushIfPossible(){
  if(STATE.rush) return;
  STATE.rush = true;

  // 2) โค้ชเตือนแบบไม่สแปม
  coach('ช่วงท้ายแล้ว! ของหวาน/ทอดเยอะขึ้น — ตั้งสติ! 🔥', 'Coach', 'rush', 2000);

  const sp = STATE.spawner;

  // ถ้า spawner รองรับปรับสด -> ใช้เลย
  try{
    if(sp?.setWeights){
      sp.setWeights({ good:0.58, junk:0.42 });
      sp.setSpawnRate?.(Math.max(520, baseSpawnRate(STATE.cfg.diff) - 140));
      return;
    }
    if(sp?.setConfig){
      sp.setConfig({
        spawnRate: Math.max(520, baseSpawnRate(STATE.cfg.diff) - 140),
        kinds:[{kind:'good',weight:0.58},{kind:'junk',weight:0.42}],
      });
      return;
    }
  }catch(_){}

  // fallback: restart spawner ใหม่ (ถ้ามี stop/destroy จะเรียกก่อน)
  stopSpawner(STATE.spawner);
  STATE.spawner = startSpawner(true);
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

  // decide mini at end
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  STATE.mini.done = accPct >= STATE.mini.target;

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

    // ✅ 3) breakdown
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

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

    // ✅ 1) Rush at last 15s
    if(STATE.timeLeft === 15){
      applyRushIfPossible();
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

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉', 'Coach', 'goal', 1400);
    }
  }

  // live accuracy display only
  STATE.mini.cur = Math.round(accuracy() * 100);
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // penalty (rush จะกดดันมากขึ้นนิด)
  addScore(STATE.rush ? -70 : -50);

  STATE.mini.cur = Math.round(accuracy() * 100);
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach', 'junk', 1100);
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // optional: hint บางจังหวะ ไม่สแปม
  if(STATE.expireGood % 2 === 0){
    coach('รีบแตะอาหารดี อย่าปล่อยให้หมดเวลา ⏳', 'Coach', 'expire', 1500);
  }

  STATE.mini.cur = Math.round(accuracy() * 100);
  emitQuest();
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.mount = mount;
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

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  STATE.rush = false;

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

  // start spawner (normal)
  stopSpawner(STATE.spawner);
  STATE.spawner = startSpawner(false);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', 'start', 1200);
}