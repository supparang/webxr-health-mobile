// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive/DD ON (mild, restart spawner occasionally)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (spawn + tap + crosshair shoot hha:shoot)
// ✅ NEW: decorateTarget => emoji/icon by 5 food groups + junk emoji
// ------------------------------------------------

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

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
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

function pick(arr, rng=Math.random){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng() * arr.length));
  return arr[Math.max(0, Math.min(arr.length-1, i))];
}

/* ------------------------------------------------
 * Emoji/Icon packs (shared feel with Groups/Plate)
 * Mapping 5 หมู่ (คงที่ตามที่ตกลง)
 * 1 โปรตีน: เนื้อ นม ไข่ ถั่ว
 * 2 คาร์บ: ข้าว แป้ง เผือก มัน น้ำตาล
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI_GROUPS = {
  g1: ['🥩','🥚','🥛','🫘','🐟','🍗'],     // โปรตีน
  g2: ['🍚','🍞','🥔','🍠','🍜','🍬'],     // คาร์บ
  g3: ['🥦','🥬','🥒','🥕','🌽','🍅'],     // ผัก
  g4: ['🍎','🍌','🍇','🍊','🍉','🍍'],     // ผลไม้
  g5: ['🥑','🫒','🧈','🥥','🧀','🥜'],     // ไขมัน
};

const EMOJI_JUNK = ['🍟','🍔','🍩','🧁','🍰','🍕','🥤','🍫'];

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0, // miss = good expired + junk hit

  timeLeft:0,
  timer:null,

  // plate groups counts (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
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

  // spawner
  spawner:null,

  // DD (play only)
  dd:{
    enabled:false,
    lastTuneAt:0,
    spawnRate:900,     // current
    junkWeight:0.30,   // current
  }
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
 * Coach helper
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function pushScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += (Number(v)||0);
  pushScore();
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
function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner();

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct2(accuracy01() * 100),

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
    }else{
      // light DD tick (play only)
      if(STATE.dd.enabled) maybeTuneDifficulty();
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

  emit('hha:judge', { kind:'good', combo:STATE.combo });

  // goal progress: count distinct groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini (accuracy)
  const accPct = accuracy01() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;        // miss includes junk hit
  resetCombo();
  addScore(-50);
  emit('hha:judge', { kind:'junk' });
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;        // miss includes good expired
  resetCombo();
  emit('hha:judge', { kind:'expire' });
  emitQuest();
}

/* ------------------------------------------------
 * Target decoration (emoji by group)
 * ------------------------------------------------ */
function groupKeyByIndex(i){
  return (['g1','g2','g3','g4','g5'][i] || 'g1');
}

function decorateTarget(el, t){
  // ensure clean
  el.textContent = '';

  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  if(t.kind === 'junk'){
    const emo = pick(EMOJI_JUNK, rng);
    const span = document.createElement('span');
    span.className = 'emoji';
    span.textContent = emo;
    el.appendChild(span);
    return;
  }

  // GOOD: choose by group index
  const gi = clamp(t.groupIndex ?? 0, 0, 4);
  const key = groupKeyByIndex(gi);
  const emo = pick(EMOJI_GROUPS[key] || EMOJI_GROUPS.g1, rng);

  const span = document.createElement('span');
  span.className = 'emoji';
  span.textContent = emo;
  el.appendChild(span);
}

/* ------------------------------------------------
 * Spawn / (Re)create spawner
 * ------------------------------------------------ */
function buildKinds(){
  // weights might be tuned by DD
  const junkW = clamp(STATE.dd.junkWeight, 0.18, 0.45);
  const goodW = Math.max(0.05, 1 - junkW);
  return [
    { kind:'good', weight: goodW },
    { kind:'junk', weight: junkW }
  ];
}

function createSpawner(mount){
  stopSpawner();

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.dd.spawnRate,
    sizeRange: [44, 64],
    kinds: buildKinds(),
    decorateTarget, // ✅ PATCH: emoji/icon

    onHit:(t)=>{
      if(!STATE.running) return;

      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }

      // optional: end early if both goal+mini done (for “ผ่านทันที”)
      if(STATE.goal.done && STATE.mini.done){
        coach('ผ่านแล้ว! เก่งมาก ✅', 'Coach');
        endGame('cleared');
      }
    },

    onExpire:(t)=>{
      if(!STATE.running) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * DD (play only): mild tuning by performance
 * - Faster spawn if player is doing great
 * - Slow down if accuracy low / many misses
 * NOTE: mode-factory spawnRate is fixed at boot, so we restart spawner sometimes.
 * ------------------------------------------------ */
function maybeTuneDifficulty(){
  const nowMs = Date.now();
  if(nowMs - STATE.dd.lastTuneAt < 2500) return; // not too often
  STATE.dd.lastTuneAt = nowMs;

  const acc = accuracy01();         // 0..1
  const miss = STATE.miss;
  const combo = STATE.comboMax;

  // baseline by diff
  const base =
    (STATE.cfg.diff === 'hard') ? 720 :
    (STATE.cfg.diff === 'easy') ? 980 : 860;

  // performance factor
  // - good: acc high + combo high => faster (lower ms)
  // - bad: acc low + many miss => slower (higher ms)
  let rate = base;

  if(acc >= 0.86) rate -= 120;
  if(acc >= 0.92) rate -= 80;
  if(combo >= 12) rate -= 60;
  if(combo >= 20) rate -= 60;

  if(acc < 0.75) rate += 140;
  if(acc < 0.65) rate += 160;
  if(miss >= 8)  rate += 80;
  if(miss >= 14) rate += 120;

  rate = clamp(rate, 560, 1100);

  // junk weight tuning (tiny)
  let junkW = 0.30;
  if(acc >= 0.90) junkW = 0.34;
  if(acc < 0.70)  junkW = 0.26;
  junkW = clamp(junkW, 0.20, 0.40);

  const changed = (Math.abs(rate - STATE.dd.spawnRate) >= 40) || (Math.abs(junkW - STATE.dd.junkWeight) >= 0.03);

  STATE.dd.spawnRate = rate;
  STATE.dd.junkWeight = junkW;

  if(changed){
    // restart spawner so new spawnRate/weights take effect
    createSpawner(STATE.cfg.__mount);
    emit('hha:coach', { msg:`ปรับความท้าทาย: ${Math.round(rate)}ms`, tag:'AI DD' });
  }
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
  STATE.cfg = cfg;
  STATE.cfg.__mount = mount; // internal
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

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // DD enable only in play
  STATE.dd.enabled = !(cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.dd.lastTuneAt = 0;

  // initial DD params by diff
  STATE.dd.spawnRate =
    (cfg.diff === 'hard') ? 740 :
    (cfg.diff === 'easy') ? 980 : 880;

  STATE.dd.junkWeight =
    (cfg.diff === 'hard') ? 0.33 :
    (cfg.diff === 'easy') ? 0.26 : 0.30;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    adaptive: STATE.dd.enabled
  });

  // initial UI state
  emitQuest();
  pushScore();
  startTimer();

  // spawner
  createSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}