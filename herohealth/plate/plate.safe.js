// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (AI Director light)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (DOM target spawner)
// ✅ decorateTarget: emoji by Thai 5 food groups + anti-boring variety
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
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function pct2(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

function pickOne(rng, arr){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[Math.max(0, Math.min(arr.length - 1, i))];
}

/* ------------------------------------------------
 * Thai 5 Food Groups (emoji sets)
 * Mapping fixed:
 * 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
 * ------------------------------------------------ */
const GROUP_EMOJI = [
  // 1 Protein
  ['🍗','🥚','🥛','🫘','🥜','🐟'],
  // 2 Carbs
  ['🍚','🍞','🥔','🍠','🥖','🍜'],
  // 3 Veg
  ['🥦','🥬','🥕','🌽','🍅','🫑'],
  // 4 Fruit
  ['🍎','🍌','🍉','🍊','🍇','🍍'],
  // 5 Fat
  ['🥑','🧈','🫒','🥥','🧀']
];

const JUNK_EMOJI = ['🍟','🍔','🍕','🍩','🍰','🍪','🍭','🧋','🥤','🍫'];

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

  // plate groups collected counts
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
    sub:'คุมความแม่น ≥ 80% (Good / ทั้งหมด)',
    cur:0,
    target:80,
    done:false
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner
  engine:null,
  curSpawnRate:900,

  // AI director tick
  aiTick:null,
};

/* ------------------------------------------------
 * Quest / Coach
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
  STATE.score += Number(v) || 0;
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
 * Accuracy (Good / total actions)
 * total = hitGood + hitJunk + expireGood
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * AI Director (light, fun) — play mode only
 * ปรับ spawnRate ตามความแม่น/มิส/คอมโบ
 * ------------------------------------------------ */
function aiDirectorEnabled(){
  const m = (STATE.cfg?.runMode || 'play').toLowerCase();
  return (m === 'play'); // research/study => OFF
}

function computeTargetSpawnRate(){
  // baseline by diff
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  let base = 900;
  if(diff === 'easy') base = 980;
  if(diff === 'hard') base = 760;

  // performance shaping
  const acc = accuracy();                 // 0..1
  const miss = STATE.miss;
  const combo = STATE.combo;

  // if doing well => faster, if struggling => slower
  // (keep within safe bounds)
  let adj = 0;
  if(acc >= 0.85) adj -= 120;
  else if(acc >= 0.75) adj -= 60;
  else if(acc < 0.60) adj += 120;
  else if(acc < 0.70) adj += 60;

  if(combo >= 10) adj -= 60;
  if(miss >= 6) adj += 60;

  return clamp(base + adj, 650, 1100);
}

function restartSpawnerIfNeeded(nextRate){
  const cur = STATE.curSpawnRate;
  if(Math.abs(nextRate - cur) < 50) return; // avoid jitter

  STATE.curSpawnRate = nextRate;

  // restart spawner (simple + stable)
  try{ if(STATE.engine && STATE.engine.stop) STATE.engine.stop(); }catch{}
  STATE.engine = makeSpawner(DOC.getElementById('plate-layer'));
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.aiTick);

  try{ if(STATE.engine && STATE.engine.stop) STATE.engine.stop(); }catch{}
  STATE.engine = null;

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
 * Group picking to reduce boredom
 * - bias missing groups (ยังขาดหมู่ไหน ให้โผล่บ่อยขึ้น)
 * - still has randomness
 * ------------------------------------------------ */
function pickGroupIndex(rng){
  const weights = [1,1,1,1,1];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) weights[i] = 2.4;       // missing -> boost
    else if((STATE.g[i]||0) === 1) weights[i] = 1.4; // barely started
  }
  // small spice: if close to goal, boost remaining missing harder
  const have = STATE.g.filter(v=>v>0).length;
  if(have >= 3){
    for(let i=0;i<5;i++){
      if((STATE.g[i]||0) <= 0) weights[i] = 3.0;
    }
  }

  const sum = weights.reduce((a,b)=>a+b,0);
  let x = (rng ? rng() : Math.random()) * sum;
  for(let i=0;i<5;i++){
    x -= weights[i];
    if(x <= 0) return i;
  }
  return 4;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');

      // Optional: end early if you want "ผ่านทันที"
      // endGame('goal_done');
    }
  }
}

function updateMini(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);

  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoal();
  updateMini();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  updateMini();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  updateMini();
  emitQuest();
}

/* ------------------------------------------------
 * Decorate target (emoji/icon)
 * - GOOD => emoji ตามหมู่ 1-5
 * - JUNK => emoji ของหวาน/ทอด
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // allow overriding groupIndex for GOOD (reduce boredom)
  if(target.kind === 'good'){
    target.groupIndex = pickGroupIndex(target.rng);

    const gi = clamp(target.groupIndex, 0, 4);
    el.dataset.group = String(gi + 1);

    const emoji = pickOne(target.rng, GROUP_EMOJI[gi]);
    el.textContent = emoji || '🍽️';
    el.setAttribute('aria-label', `อาหารหมู่ ${gi+1}`);

  }else{
    el.dataset.group = 'junk';
    el.textContent = pickOne(target.rng, JUNK_EMOJI) || '🍩';
    el.setAttribute('aria-label', 'อาหารหวาน/ทอด');
  }
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  // spawn rate uses AI director current setting
  const spawnRate = STATE.curSpawnRate;

  // size
  const sizeRange = (diff === 'easy') ? [52, 74]
                 : (diff === 'hard') ? [44, 64]
                 : [48, 70];

  // weight junk by diff
  const kinds = (diff === 'easy')
    ? [{kind:'good', weight:0.78},{kind:'junk', weight:0.22}]
    : (diff === 'hard')
      ? [{kind:'good', weight:0.62},{kind:'junk', weight:0.38}]
      : [{kind:'good', weight:0.70},{kind:'junk', weight:0.30}];

  return spawnBoot({
    mount,
    seed: STATE.cfg?.seed ?? Date.now(),
    safePrefix: 'plate',
    spawnRate,
    sizeRange,
    kinds,
    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
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

  // RNG (deterministic for research/study)
  const rm = (cfg?.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(cfg?.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time default: use cfg duration (boot.js decides)
  STATE.timeLeft = Number(cfg?.durationPlannedSec) || 90;

  // initial spawn rate baseline
  STATE.curSpawnRate = computeTargetSpawnRate();

  emit('hha:start', {
    game:'plate',
    runMode: cfg?.runMode,
    diff: cfg?.diff,
    seed: cfg?.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  // spawn engine
  STATE.engine = makeSpawner(mount);

  // AI Director loop (play only)
  clearInterval(STATE.aiTick);
  if(aiDirectorEnabled()){
    STATE.aiTick = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;
      const next = computeTargetSpawnRate();
      restartSpawnerIfNeeded(next);

      // micro coach hints (rate-limited)
      const have = STATE.g.filter(v=>v>0).length;
      if(have < 5 && (STATE.timeLeft % 12 === 0)){
        // find a missing group to hint
        const missIdx = STATE.g.findIndex(v=>v<=0);
        if(missIdx >= 0){
          coach(`ลองเก็บหมู่ ${missIdx+1} ให้ครบด้วยนะ!`, 'AI Coach');
        }
      }
      if((accuracy()*100) < 70 && (STATE.timeLeft % 15 === 0)){
        coach('ใจเย็น ๆ เล็งให้ตรงก่อนแตะ/ยิง 🎯', 'AI Coach');
      }
    }, 1000);
  }else{
    STATE.aiTick = null;
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}