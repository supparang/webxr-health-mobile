// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PATCH A3
// HHA Standard + FUN PACK (Emoji Groups + Boss/Storm + AI Hooks)
//
// ✅ Fix import: uses ../vr/mode-factory.js (export boot)
// ✅ decorateTarget: emoji bubble + 5 food groups mapping (ไทย) + junk
// ✅ Anti-boring: bias spawn towards missing groups until complete
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Supports: bossFx/stormFx DOM hooks (pure CSS classes)
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
//
// Notes:
// - play: adaptive FUN ON
// - research/study: deterministic seed + adaptive OFF (fair/reproducible)

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

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr){
  if(!arr || !arr.length) return null;
  return arr[Math.floor(rng()*arr.length)];
}

function uniq(arr){ return Array.from(new Set(arr)); }

/* ------------------------------------------------
 * Food group emoji mapping (ไทย 5 หมู่) — FIXED
 * หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * หมู่ 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
 * หมู่ 3 ผัก
 * หมู่ 4 ผลไม้
 * หมู่ 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI = {
  g1: ['🍗','🥚','🥛','🫘','🐟','🍖'],          // โปรตีน
  g2: ['🍚','🍞','🍜','🍠','🥔','🥖','🍪'],     // คาร์บ (มี 🍪 โทนหวานนิด แต่ยังเป็นพลัง)
  g3: ['🥦','🥬','🥕','🌽','🥒','🍆'],          // ผัก
  g4: ['🍎','🍌','🍊','🍇','🍉','🍓','🥭'],     // ผลไม้
  g5: ['🥑','🧈','🥜','🫒','🧀'],               // ไขมัน
  junk: ['🍩','🍟','🍔','🍕','🍰','🧋','🥤','🍫','🍿'] // ของหวาน/ทอด/น้ำหวาน
};

const GROUP_NAME_TH = [
  'หมู่ 1 โปรตีน',
  'หมู่ 2 คาร์โบไฮเดรต',
  'หมู่ 3 ผัก',
  'หมู่ 4 ผลไม้',
  'หมู่ 5 ไขมัน'
];

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

  // 5 groups counters
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

  // fx dom
  bossFx:null,
  stormFx:null,

  // phases
  bossOn:false,
  stormOn:false,
  bossTo:null,
  stormTo:null,

  // spawner
  spawner:null
};

/* ------------------------------------------------
 * Event helpers
 * ------------------------------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function updateGoalProgress(){
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    judge('goal', { ok:true });
    // optional: tiny reward
    addScore(250);
  }
}

function updateMiniAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
    judge('mini', { ok:true });
    addScore(150);
  }
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
 * Coach + Judge
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}
function judge(type, data={}){
  emit('hha:judge', { type, ...data });
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
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  // นับ “เป้าดีหมดอายุ” เป็นความผิดพลาดด้วย (fair)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * FX: Boss / Storm (CSS classes only)
 * ------------------------------------------------ */
function fxInit(){
  STATE.bossFx = DOC.getElementById('bossFx');
  STATE.stormFx = DOC.getElementById('stormFx');
}

function bossOn(ms=6500){
  if(STATE.bossFx){
    STATE.bossFx.classList.add('boss-on');
    // panic flash when low time
    if(STATE.timeLeft <= 12) STATE.bossFx.classList.add('boss-panic');
    else STATE.bossFx.classList.remove('boss-panic');
  }
  STATE.bossOn = true;
  clearTimeout(STATE.bossTo);
  STATE.bossTo = setTimeout(()=>bossOff(), ms);
}

function bossOff(){
  STATE.bossOn = false;
  if(STATE.bossFx){
    STATE.bossFx.classList.remove('boss-on','boss-panic');
  }
}

function stormOn(ms=6500){
  if(STATE.stormFx) STATE.stormFx.classList.add('storm-on');
  STATE.stormOn = true;
  clearTimeout(STATE.stormTo);
  STATE.stormTo = setTimeout(()=>stormOff(), ms);
}

function stormOff(){
  STATE.stormOn = false;
  if(STATE.stormFx) STATE.stormFx.classList.remove('storm-on');
}

/* ------------------------------------------------
 * “AI” hooks (ready-to-plug; default OFF in research)
 * ------------------------------------------------ */
function aiEnabled(){
  const m = (STATE.cfg?.runMode||'play').toLowerCase();
  return !(m === 'research' || m === 'study'); // research: keep deterministic fairness (no adaptive)
}

// AI Prediction: predict “risk of fail mini quest” from recent accuracy trend
function aiPredictRisk(){
  // super-light heuristic (replace with ML later)
  const acc = accuracy();
  const t = STATE.timeLeft;
  const need = STATE.mini.target/100;
  // risk rises when low acc & low time
  const risk = clamp((need - acc) * 1.2 + (t < 18 ? 0.25 : 0), 0, 1);
  return risk;
}

// AI Difficulty Director (play mode only): tweak spawnRate + junkWeight for fun
function aiTuneDifficulty(base){
  if(!aiEnabled()) return base;

  const risk = aiPredictRisk();
  const combo = STATE.combo;
  const goalDone = STATE.goal.done;

  // If struggling (high risk): lower junk a bit & slow spawn slightly
  // If doing great (combo high & low risk): speed up + more junk -> exciting
  const struggling = risk > 0.55;
  const excelling = (combo >= 10 && risk < 0.20);

  let spawnRate = base.spawnRate;
  let junkW = base.junkW;

  if(struggling){
    spawnRate = Math.round(spawnRate * 1.10);
    junkW = Math.max(0.18, junkW - 0.06);
  }else if(excelling){
    spawnRate = Math.round(spawnRate * 0.88);
    junkW = Math.min(0.42, junkW + 0.08);
  }

  // After goal complete, turn it into “score chase”: slightly more junk
  if(goalDone) junkW = Math.min(0.46, junkW + 0.05);

  return { spawnRate, junkW };
}

// AI Coach micro-tips (rate-limited)
let __aiCoachCoolUntil = 0;
function aiCoachTick(){
  if(!aiEnabled()) return;
  const t = performance.now();
  if(t < __aiCoachCoolUntil) return;

  const risk = aiPredictRisk();
  if(risk > 0.70){
    coach('โฟกัสเป้าดี! อย่ารีบกดมั่ว ๆ 😄', 'AI Coach');
    __aiCoachCoolUntil = t + 5200;
  }else if(STATE.combo >= 12){
    coach('คอมโบสวย! ระวังของทอด/หวานนะ 💥', 'AI Coach');
    __aiCoachCoolUntil = t + 5200;
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();

  // score: base + combo bonus (feel-good)
  addScore(100 + STATE.combo * 6);

  judge('hit', { kind:'good', groupIndex, combo:STATE.combo });

  updateGoalProgress();
  updateMiniAccuracy();
  emitQuest();

  // Boss trigger: combo streak
  if(aiEnabled() && STATE.combo === 12){
    coach('⚔️ BOSS PHASE! เป้าจะไวขึ้น!', 'System');
    bossOn(6500);
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  judge('hit', { kind:'junk' });

  updateMiniAccuracy();
  emitQuest();

  // Storm trigger occasionally in play
  if(aiEnabled() && !STATE.stormOn && (STATE.rng() < 0.12)){
    coach('🌪️ STORM! เป้าจะถี่ขึ้น!', 'System');
    stormOn(6500);
  }
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  judge('expire', { kind:'good' });

  updateMiniAccuracy();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn strategy: avoid boring (help complete 5 groups)
 * - If some groups missing, bias those groups for GOOD targets
 * ------------------------------------------------ */
function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++) if((STATE.g[i]||0) <= 0) miss.push(i);
  return miss;
}

function pickGroupForGood(target){
  const miss = missingGroups();
  if(!miss.length) return target.groupIndex ?? Math.floor(target.rng()*5);

  // 70% chance force a missing group (so goal is achievable & not boring)
  const force = (aiEnabled() ? 0.70 : 0.55);
  if(target.rng() < force){
    return pick(target.rng, miss);
  }
  return target.groupIndex ?? Math.floor(target.rng()*5);
}

function decorateTarget(el, target){
  // IMPORTANT: make sure target position works even if css missed it
  // (If your mode-factory already sets position, this is harmless)
  el.style.position = el.style.position || 'fixed';

  if(target.kind === 'junk'){
    el.textContent = pick(target.rng, EMOJI.junk) || '🍩';
    el.setAttribute('aria-label', 'junk');
    return;
  }

  // good -> pick group (bias missing groups)
  const gi = pickGroupForGood(target);
  target.groupIndex = gi;

  const pool = gi===0 ? EMOJI.g1
            : gi===1 ? EMOJI.g2
            : gi===2 ? EMOJI.g3
            : gi===3 ? EMOJI.g4
            : EMOJI.g5;

  el.textContent = pick(target.rng, pool) || '🍽️';
  el.setAttribute('aria-label', GROUP_NAME_TH[gi] || 'good');

  // optional: tiny “spark” effect by class (you can style more later)
  if(STATE.combo >= 10) el.classList.add('spark');
}

/* ------------------------------------------------
 * Build spawner config (adaptive fun)
 * ------------------------------------------------ */
function buildSpawnerConfig(){
  const diff = (STATE.cfg?.diff||'normal').toLowerCase();

  // base
  let baseSpawnRate = (diff === 'easy') ? 980 : (diff === 'hard' ? 720 : 860);
  let baseJunkW = (diff === 'easy') ? 0.24 : (diff === 'hard' ? 0.34 : 0.30);

  // phase modifiers
  if(STATE.bossOn){
    baseSpawnRate = Math.round(baseSpawnRate * 0.82);
    baseJunkW = Math.min(0.46, baseJunkW + 0.08);
  }
  if(STATE.stormOn){
    baseSpawnRate = Math.round(baseSpawnRate * 0.78);
    baseJunkW = Math.min(0.44, baseJunkW + 0.06);
  }

  // AI tune (play only)
  const tuned = aiTuneDifficulty({ spawnRate: baseSpawnRate, junkW: baseJunkW });

  return {
    spawnRate: tuned.spawnRate,
    junkW: tuned.junkW
  };
}

/* ------------------------------------------------
 * Spawn boot
 * ------------------------------------------------ */
function startSpawner(mount){
  const tuned = buildSpawnerConfig();

  // stop previous
  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: tuned.spawnRate,
    sizeRange: [44, 66],
    kinds: [
      { kind:'good', weight: 1 - tuned.junkW },
      { kind:'junk', weight: tuned.junkW }
    ],
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
    },
    decorateTarget
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  clearInterval(STATE.timer);
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // keep boss panic synced
    if(STATE.bossFx && STATE.bossOn){
      if(STATE.timeLeft <= 12) STATE.bossFx.classList.add('boss-panic');
      else STATE.bossFx.classList.remove('boss-panic');
    }

    // periodic AI coach tips
    aiCoachTick();

    // re-tune spawner every ~3 sec in play (not research)
    if(aiEnabled() && (STATE.timeLeft % 3 === 0)){
      // soft rebuild to reflect tuned spawnRate/junkW
      if(STATE.cfg?.__mountEl) startSpawner(STATE.cfg.__mountEl);
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;

  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearTimeout(STATE.bossTo);
  clearTimeout(STATE.stormTo);

  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;

  bossOff();
  stormOff();

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

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย ✅', 'System');
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg + mount reference for retune
  STATE.cfg = cfg || {};
  STATE.cfg.__mountEl = mount;

  // reset state
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
  const rm = (cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: still stable enough (but not strict deterministic)
    STATE.rng = Math.random;
  }

  // time: 90 sec is a sweet spot for ป.5 (พอให้ครบ 5 หมู่ + มี boss/storm 1-2 รอบ)
  // - 70 sec: เร็วมาก เด็กบางคน “ยังไม่ทันครบ 5 หมู่”
  // - 90 sec: สนุก+มีเวลาปรับตัว เหมาะกับการเรียนรู้
  // - 120 sec: เสี่ยงยืด/เบื่อ (เว้นแต่ทำเป็นด่านยาว)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  fxInit();

  emit('hha:start', {
    game:'plate',
    runMode: rm,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // start spawner
  startSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}