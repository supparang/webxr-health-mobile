// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Uses ../vr/mode-factory.js (export boot) as spawner
// ✅ decorateTarget: emoji by Thai 5 food groups + junk emojis
// ✅ Play / Research modes
//   - play: adaptive ON (light, fair)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Supports: Boss phase, Storm phase (hooks)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) — handled in mode-factory
// ✅ More fun: rotating mini-quests + streak + time bonus
// ✅ AI hooks: simple Prediction (risk) + placeholders for ML/DL (disabled by default)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng=Math.random){
  if(!arr || !arr.length) return '';
  const i = Math.floor((rng() * arr.length));
  return arr[i] ?? arr[0];
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * Emoji packs (Thai 5 food groups)
 * Keep it varied so it won't be boring.
 * Mapping fixed (ห้ามแปลผัน):
 * 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * 2 คาร์โบ (ข้าว แป้ง เผือก มัน น้ำตาล)
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
 * ------------------------------------------------ */
const EMOJI_G = {
  g1: ['🥚','🥛','🧀','🍗','🍖','🥩','🐟','🫘','🥜','🍤'], // โปรตีน
  g2: ['🍚','🍞','🥖','🍜','🍝','🥔','🍠','🥨','🧁','🍯'], // คาร์โบ + น้ำตาล (ในเกม “good” เราจะเลือกตัวดี ๆ เช่น ข้าว/แป้ง/เผือก/มัน; น้ำตาลเอาไปอยู่ junk ได้)
  g3: ['🥦','🥬','🥒','🥕','🍅','🌽','🫑','🧄','🧅','🍆'], // ผัก
  g4: ['🍎','🍌','🍊','🍉','🍍','🍇','🍓','🥭','🥝','🍒'], // ผลไม้
  g5: ['🥑','🫒','🥥','🧈','🌰','🥜','🍳'], // ไขมัน (ใส่ไข่ได้เพราะมีไขมันด้วย แต่ยังคงหลัก 5 หมู่ตามเกม)
};

const EMOJI_JUNK = ['🍟','🍔','🍕','🌭','🍩','🍪','🍰','🧋','🥤','🍭'];

// For "group focus" mini quest labels
const GROUP_LABEL_TH = ['หมู่ 1 โปรตีน','หมู่ 2 คาร์โบ','หมู่ 3 ผัก','หมู่ 4 ผลไม้','หมู่ 5 ไขมัน'];

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // Miss = hit junk + expired good (แนวเดียวกับ HHA miss definition)
  miss:0,

  timeLeft:0,
  timer:null,
  tick:null,

  // plate groups (5 หมู่)
  g:[0,0,0,0,0], // index 0-4

  // quest (Goal)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },

  // mini quest (rotating)
  mini:{
    kind:'acc', // 'acc' | 'streak' | 'focus'
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false,

    // for streak / focus
    streakNeed:6,
    streakNow:0,
    focusGroup:0,
    focusNeed:3,
    focusNow:0,

    // rotate pacing
    nextRotateAtSec:0
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner
  spawner:null,
  currentSpawnRate:900,
  currentJunkWeight:0.30,

  // ai hooks flags (keep OFF by default)
  ai:{
    enabled:false,          // master toggle (default false)
    predictionEnabled:true, // cheap "risk" predictor (still only used if ai.enabled true)
    mlEnabled:false,        // placeholder
    dlEnabled:false         // placeholder
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
------------------------------------------------- */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Mini quest rotate
 * ------------------------------------------------ */
function setMini(kind){
  STATE.mini.kind = kind;
  STATE.mini.done = false;

  if(kind === 'acc'){
    STATE.mini.name = 'ความแม่นยำ';
    STATE.mini.sub  = 'คุมความแม่น ≥ 80%';
    STATE.mini.target = 80;
    STATE.mini.cur = accPct();
  }else if(kind === 'streak'){
    STATE.mini.streakNeed = 6;
    STATE.mini.streakNow = 0;
    STATE.mini.name = 'สตรีค';
    STATE.mini.sub  = 'เก็บ GOOD ติดกัน 6 ครั้ง';
    STATE.mini.target = STATE.mini.streakNeed;
    STATE.mini.cur = STATE.mini.streakNow;
  }else{ // focus
    STATE.mini.focusGroup = Math.floor(STATE.rng()*5);
    STATE.mini.focusNeed = 3;
    STATE.mini.focusNow = 0;
    STATE.mini.name = 'ภารกิจเจาะหมู่';
    STATE.mini.sub  = `เก็บ ${GROUP_LABEL_TH[STATE.mini.focusGroup]} ให้ได้ 3 ชิ้น`;
    STATE.mini.target = STATE.mini.focusNeed;
    STATE.mini.cur = STATE.mini.focusNow;
  }

  emitQuest();
}

function awardMiniClear(){
  // reward: +score + time bonus
  addScore(250);
  STATE.timeLeft += 5; // เวลาเพิ่มแบบเร้าใจ (ทำให้ “อยากทำมินิเควส”)
  emit('hha:time', { leftSec: STATE.timeLeft });
  coach('มินิเควสสำเร็จ! +เวลา 5 วิ ⏱️ +คะแนน 250 ✨', 'Reward');
}

/* ------------------------------------------------
 * Goal progress
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
  }
}

/* ------------------------------------------------
 * AI Prediction / ML / DL hooks (optional)
 * - "Prediction" here is a lightweight risk estimate (no training)
 * - ML/DL placeholders for future research (do not activate by default)
 * ------------------------------------------------ */
function aiTick(){
  if(!STATE.ai.enabled) return;

  // Simple risk prediction: high junk/expire rate + low accuracy + low time -> risk high
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total < 6) return;

  const a = accuracy(); // 0..1
  const missRate = (STATE.hitJunk + STATE.expireGood) / Math.max(1, total);
  const timeFactor = 1 - clamp(STATE.timeLeft / Math.max(1, STATE.cfg.durationPlannedSec), 0, 1);

  const risk = clamp((missRate*0.55) + ((1-a)*0.35) + (timeFactor*0.10), 0, 1);

  emit('hha:ai', {
    type:'prediction',
    risk, // 0..1
    acc:a,
    missRate,
    timeLeft: STATE.timeLeft
  });

  // Example: coach micro-tip on high risk (rate-limited)
  if(risk > 0.72 && (STATE.combo < 2)){
    // keep it gentle: avoid spamming
    if(!WIN.__PLATE_AI_TIP_AT__ || (Date.now() - WIN.__PLATE_AI_TIP_AT__ > 6500)){
      WIN.__PLATE_AI_TIP_AT__ = Date.now();
      coach('ลองโฟกัส “หมู่ที่ยังขาด” ก่อนนะ จะผ่านเร็วขึ้น 😊', 'AI Coach');
    }
  }

  // ML/DL placeholders:
  // emit('hha:ai', { type:'ml', ... })  // disabled
  // emit('hha:ai', { type:'dl', ... })  // disabled
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
  clearInterval(STATE.tick);
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

    accuracyGoodPct: accPct(),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood
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
 * Judge helper (feedback per hit)
 * ------------------------------------------------ */
function judge(type, extra={}){
  emit('hha:judge', { type, ...extra });
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // judge tiers
  if(STATE.combo >= 10) judge('perfect', { combo: STATE.combo });
  else judge('good', { combo: STATE.combo });

  // update goal
  updateGoal();

  // mini quest progress
  if(!STATE.mini.done){
    if(STATE.mini.kind === 'acc'){
      const ap = accPct();
      STATE.mini.cur = ap;
      if(ap >= STATE.mini.target){
        STATE.mini.done = true;
        awardMiniClear();
      }
    }else if(STATE.mini.kind === 'streak'){
      STATE.mini.streakNow++;
      STATE.mini.cur = STATE.mini.streakNow;
      if(STATE.mini.streakNow >= STATE.mini.streakNeed){
        STATE.mini.done = true;
        awardMiniClear();
      }
    }else{ // focus
      if(groupIndex === STATE.mini.focusGroup){
        STATE.mini.focusNow++;
        STATE.mini.cur = STATE.mini.focusNow;
        if(STATE.mini.focusNow >= STATE.mini.focusNeed){
          STATE.mini.done = true;
          awardMiniClear();
        }
      }
    }
  }

  emitQuest();

  // If both done -> extra celebration & optional early finish
  if(STATE.goal.done && STATE.mini.done){
    coach('ครบแล้ว! ไปต่อให้สุด หรือรอหมดเวลาได้เลย 🚀', 'Clear');
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;           // miss = junk hit
  resetCombo();
  addScore(-60);
  judge('miss', { reason:'junk' });

  // streak mini reset
  if(STATE.mini.kind === 'streak' && !STATE.mini.done){
    STATE.mini.streakNow = 0;
    STATE.mini.cur = 0;
    emitQuest();
  }

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;           // miss = good expired
  resetCombo();
  judge('miss', { reason:'expire' });

  // streak mini reset
  if(STATE.mini.kind === 'streak' && !STATE.mini.done){
    STATE.mini.streakNow = 0;
    STATE.mini.cur = 0;
    emitQuest();
  }
}

/* ------------------------------------------------
 * Decorate target (emoji & style)
 * Called from mode-factory.js per spawn
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // Always clear
  el.textContent = '';

  if(t.kind === 'junk'){
    // Junk emoji
    const em = pick(EMOJI_JUNK, t.rng || STATE.rng);
    const span = document.createElement('span');
    span.className = 'emoji';
    span.textContent = em;
    el.appendChild(span);

    el.dataset.group = 'junk';
    return;
  }

  // Good -> group emoji by Thai 5 หมู่
  const gi = clamp(t.groupIndex ?? 0, 0, 4);
  const key = ['g1','g2','g3','g4','g5'][gi];
  const arr = EMOJI_G[key] || EMOJI_G.g1;

  // In group2, keep "good carb" more than sugar: bias picks
  let em = pick(arr, t.rng || STATE.rng);
  if(gi === 1){
    // if accidentally picked sweetish emoji, re-roll once
    if(em === '🧁' || em === '🍯'){
      em = pick(['🍚','🍞','🍜','🥔','🍠','🥨'], t.rng || STATE.rng);
    }
  }

  const span = document.createElement('span');
  span.className = 'emoji';
  span.textContent = em;
  el.appendChild(span);

  el.dataset.group = key;
}

/* ------------------------------------------------
 * Adaptive tuning (play mode only, fair & simple)
 * - adjust spawnRate & junk weight by performance
 * - to apply, rebuild spawner occasionally
 * ------------------------------------------------ */
function computeAdaptive(){
  // base by diff
  const base = (STATE.cfg.diff === 'hard') ? 760 : (STATE.cfg.diff === 'easy' ? 980 : 880);
  const a = accuracy(); // 0..1
  const c = clamp(STATE.combo / 12, 0, 1);

  // If doing well -> faster + a bit more junk, else ease up
  let spawnRate = base;
  let junkW = (STATE.cfg.diff === 'hard') ? 0.36 : 0.30;

  if(a > 0.84 && c > 0.55){
    spawnRate = Math.max(620, base - 120);
    junkW = Math.min(0.42, junkW + 0.06);
  }else if(a < 0.70){
    spawnRate = Math.min(1080, base + 120);
    junkW = Math.max(0.22, junkW - 0.06);
  }

  return { spawnRate: Math.round(spawnRate), junkW };
}

function rebuildSpawner(mount, spawnRate, junkW){
  stopSpawner();
  STATE.currentSpawnRate = spawnRate;
  STATE.currentJunkWeight = junkW;

  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight: 1 - junkW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget, // ✅ emoji by group
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
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

  // reset state
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

  // RNG: deterministic only in research/study
  const isStudy = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isStudy ? seededRng(cfg.seed || Date.now()) : Math.random;

  // AI default OFF (can be enabled by cfg.ai=1 later if you want)
  // keep this safe: never affect research unless explicitly enabled
  STATE.ai.enabled = !!cfg.aiEnabled && !isStudy;

  // duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // mini quest schedule
  STATE.mini.nextRotateAtSec = Math.max(10, STATE.timeLeft - 20); // rotate once near mid
  setMini('acc'); // start with accuracy

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  startTimer();

  // initial spawner
  const initial = isStudy
    ? { spawnRate: (cfg.diff === 'hard' ? 760 : 880), junkW: (cfg.diff === 'hard' ? 0.36 : 0.30) }
    : computeAdaptive();

  rebuildSpawner(mount, initial.spawnRate, initial.junkW);

  // tick loop: rotate mini quest + adaptive + ai prediction
  STATE.tick = setInterval(()=>{
    if(!STATE.running) return;

    // rotate mini quest once (avoid spamming)
    if(!STATE.mini.done && STATE.timeLeft === STATE.mini.nextRotateAtSec){
      // rotate to something more exciting if still not done
      const next = (STATE.mini.kind === 'acc') ? 'streak' : 'focus';
      setMini(next);
      coach(`เปลี่ยนมินิเควส! ${STATE.mini.name} 🎯`, 'Quest');
    }

    // play-only adaptive (research must be stable)
    if(!isStudy){
      const a = computeAdaptive();
      // only rebuild if meaningfully changed
      if(Math.abs(a.spawnRate - STATE.currentSpawnRate) >= 80 || Math.abs(a.junkW - STATE.currentJunkWeight) >= 0.05){
        rebuildSpawner(mount, a.spawnRate, a.junkW);
      }
    }

    aiTick();
  }, 1000);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Start');
}