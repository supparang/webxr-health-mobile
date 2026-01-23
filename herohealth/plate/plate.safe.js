// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION + PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive-ish ON (phases + tips; deterministic OFF)
//   - research/study: deterministic seed + adaptive OFF (still emits AI events deterministically)
// ✅ Uses mode-factory boot() with decorateTarget (emoji/icon)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:ai, hha:end
// ✅ Supports: Boss phase, Storm phase (simple + fun)
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

function round2(n){
  n = Number(n) || 0;
  return Math.round(n * 100) / 100;
}

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
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

/* ------------------------------------------------
 * Thai 5 food groups mapping (DO NOT MUTATE)
 * ------------------------------------------------ */
const GROUPS = [
  {
    id: 1,
    name: 'หมู่ 1 โปรตีน',
    rhyme: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
    icons: ['🥚','🥛','🐟','🍗','🥜','🫘','🧀'] // protein-ish
  },
  {
    id: 2,
    name: 'หมู่ 2 คาร์โบไฮเดรต',
    rhyme: 'ข้าว แป้ง เผือก มัน น้ำตาล',
    icons: ['🍚','🍞','🍜','🥔','🍠','🥣','🍙']
  },
  {
    id: 3,
    name: 'หมู่ 3 ผัก',
    rhyme: 'ผักสีเขียวเหลือง วิตามิน',
    icons: ['🥦','🥬','🥕','🥒','🌽','🍆','🫑']
  },
  {
    id: 4,
    name: 'หมู่ 4 ผลไม้',
    rhyme: 'ผลไม้สารอาหารมากมาย',
    icons: ['🍎','🍌','🍉','🍊','🍇','🍍','🥭']
  },
  {
    id: 5,
    name: 'หมู่ 5 ไขมัน',
    rhyme: 'ไขมันให้ความอบอุ่น',
    icons: ['🥑','🫒','🧈','🥥','🌰','🧀'] // fat-ish
  }
];

const JUNK = {
  name: 'ของหวาน/ทอด',
  icons: ['🍟','🍩','🍰','🍫','🥤','🧋','🍪']
};

function pickIcon(rng, arr){
  if(!arr || !arr.length) return '❓';
  const i = Math.floor((rng ? rng() : Math.random()) * arr.length);
  return arr[clamp(i, 0, arr.length-1)];
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

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    // will be chosen per run (deterministic in study)
    type:'accuracy', // 'accuracy' | 'combo'
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

  // spawn engine instance
  engine:null,

  // phases
  bossOn:false,
  stormOn:false,
  bossUntilT:0,
  stormUntilT:0,

  // coach rate limit
  coachCooldownT:0,

  // AI tick
  aiCooldownT:0
};

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

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
      done: STATE.mini.done,
      type: STATE.mini.type
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach', force=false){
  const t = nowMs();
  if(!force && t < STATE.coachCooldownT) return;
  STATE.coachCooldownT = t + 1400; // rate limit
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
  STATE.score = Math.max(0, (STATE.score + (Number(v)||0))); // clamp non-negative (kid-friendly)
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

function uniqueGroupsFilled(){
  return STATE.g.filter(v=>v>0).length;
}

/* ------------------------------------------------
 * FX layers (Boss/Storm)
 * ------------------------------------------------ */
function ensureFxLayer(id){
  let el = DOC.getElementById(id);
  if(el) return el;
  el = DOC.createElement('div');
  el.id = id;
  // matches CSS selectors: #bossFx / #stormFx
  DOC.body.appendChild(el);
  return el;
}

function setBossFx(on, panic=false){
  const el = ensureFxLayer('bossFx');
  el.classList.toggle('boss-on', !!on);
  el.classList.toggle('boss-panic', !!panic);
}

function setStormFx(on){
  const el = ensureFxLayer('stormFx');
  el.classList.toggle('storm-on', !!on);
}

/* ------------------------------------------------
 * Phases
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;
}

function startSpawner({ mount, spawnRate, goodW, junkW, sizeRange }){
  stopSpawner();

  STATE.engine = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange: sizeRange || [46, 68],
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget: decorateTargetEmoji,
    onHit: (t)=>{
      if(t.kind === 'good'){
        // IMPORTANT: use factory groupIndex (deterministic per target)
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

function maybeEnterBossPhase(mount){
  // Boss: last 25s, once per game, play-mode only
  if(STATE.bossOn || STATE.ended) return;
  if(STATE.cfg.runMode !== 'play') return;
  if(STATE.timeLeft > 25) return;

  STATE.bossOn = true;
  STATE.bossUntilT = nowMs() + 9000; // 9s boss window

  setBossFx(true, false);
  coach('🔥 BOSS TIME! ของทอด/หวานจะมาถี่ขึ้น—ตั้งสติ!', 'Boss', true);

  // Harder: faster spawn + more junk
  startSpawner({
    mount,
    spawnRate: (STATE.cfg.diff === 'hard') ? 520 : 620,
    goodW: 0.58,
    junkW: 0.42,
    sizeRange: [44, 66]
  });
}

function maybeEnterStormPhase(mount){
  // Storm: occasional chaos window, play-mode only, deterministic by STATE.rng
  if(STATE.stormOn || STATE.ended) return;
  if(STATE.cfg.runMode !== 'play') return;
  if(STATE.timeLeft < 15) return; // avoid too late
  if(STATE.timeLeft > 65) return; // avoid too early

  // chance per second (diff based)
  const p = (STATE.cfg.diff === 'hard') ? 0.10 : 0.07;
  if(STATE.rng() > p) return;

  STATE.stormOn = true;
  STATE.stormUntilT = nowMs() + 6500; // 6.5s

  setStormFx(true);
  coach('🌪️ STORM! เป้าจะมาไวขึ้น—เก็บให้ทัน!', 'Storm', true);

  startSpawner({
    mount,
    spawnRate: (STATE.cfg.diff === 'hard') ? 480 : 560,
    goodW: 0.68,
    junkW: 0.32,
    sizeRange: [42, 62]
  });
}

function updatePhaseTimers(mount){
  const t = nowMs();

  if(STATE.bossOn && t >= STATE.bossUntilT){
    STATE.bossOn = false;
    setBossFx(false, false);
    coach('จบ BOSS! กลับสู่โหมดปกติ 👍', 'Boss');

    startSpawner({
      mount,
      spawnRate: baseSpawnRate(),
      goodW: baseGoodWeight(),
      junkW: baseJunkWeight(),
      sizeRange: baseSizeRange()
    });
  }

  if(STATE.stormOn && t >= STATE.stormUntilT){
    STATE.stormOn = false;
    setStormFx(false);
    coach('พายุหยุดแล้ว! ไปต่อเลย 😄', 'Storm');

    startSpawner({
      mount,
      spawnRate: baseSpawnRate(),
      goodW: baseGoodWeight(),
      junkW: baseJunkWeight(),
      sizeRange: baseSizeRange()
    });
  }

  // boss panic flash near end
  if(STATE.bossOn){
    const left = Math.max(0, STATE.bossUntilT - t);
    setBossFx(true, left < 2200);
  }
}

function baseSpawnRate(){
  if(STATE.cfg.diff === 'hard') return 720;
  if(STATE.cfg.diff === 'easy') return 980;
  return 860; // normal
}
function baseGoodWeight(){
  if(STATE.cfg.diff === 'hard') return 0.66;
  return 0.72;
}
function baseJunkWeight(){
  return 1 - baseGoodWeight();
}
function baseSizeRange(){
  if(STATE.cfg.view === 'mobile' || STATE.cfg.view === 'cvr') return [48, 72];
  return [46, 70];
}

/* ------------------------------------------------
 * Target decoration: emoji per group / junk
 * ------------------------------------------------ */
function decorateTargetEmoji(el, target){
  // Ensure stable center glyph + optional tiny badge
  const rng = target.rng || STATE.rng || Math.random;

  let glyph = '❓';
  let badge = '';

  if(target.kind === 'junk'){
    glyph = pickIcon(rng, JUNK.icons);
    badge = '⚠️';
    el.dataset.group = '0';
  }else{
    const gi = clamp(target.groupIndex ?? 0, 0, 4);
    const g = GROUPS[gi];
    glyph = pickIcon(rng, g.icons);
    badge = String(g.id);
    el.dataset.group = String(g.id);
    el.title = `${g.name} • ${g.rhyme}`;
  }

  // Make it pretty but simple: big emoji + corner badge
  // (CSS can style .tEmoji / .tBadge if you want later, but works without)
  el.innerHTML = `
    <span class="tEmoji" aria-hidden="true">${glyph}</span>
    <span class="tBadge" aria-hidden="true">${badge}</span>
  `;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(90 + STATE.combo * 6);

  // goal progress (unique groups)
  if(!STATE.goal.done){
    STATE.goal.cur = uniqueGroupsFilled();
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal', true);
    }
  }

  // mini quest
  if(STATE.mini.type === 'accuracy'){
    const accPct = accuracy() * 100;
    STATE.mini.cur = Math.round(accPct);
    if(!STATE.mini.done && accPct >= STATE.mini.target){
      STATE.mini.done = true;
      coach('ความแม่นยำดีมาก! 👍', 'Mini', true);
    }
  }else if(STATE.mini.type === 'combo'){
    STATE.mini.cur = STATE.comboMax;
    if(!STATE.mini.done && STATE.comboMax >= STATE.mini.target){
      STATE.mini.done = true;
      coach('คอมโบสุดยอด! ⚡', 'Mini', true);
    }
  }

  emitQuest();
  emitScore();

  emit('hha:judge', {
    kind:'good',
    group: groupIndex + 1,
    score: STATE.score,
    combo: STATE.combo
  });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // small penalty (kid-friendly)
  addScore(-40);

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');

  emit('hha:judge', {
    kind:'junk',
    score: STATE.score,
    combo: STATE.combo
  });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // no score penalty (less frustrating), but still counts miss
  emitScore();
}

/* ------------------------------------------------
 * AI Prediction hooks (simple + deterministic in study)
 * ------------------------------------------------ */
function sigmoid(x){
  x = Number(x) || 0;
  if(x < -30) return 0;
  if(x > 30) return 1;
  return 1 / (1 + Math.exp(-x));
}

function aiPredict(){
  const t = nowMs();
  if(t < STATE.aiCooldownT) return;
  STATE.aiCooldownT = t + 980; // ~1s

  const acc = accuracy();
  const groups = uniqueGroupsFilled();
  const timeNorm = clamp(STATE.timeLeft / Math.max(1, STATE.cfg.durationPlannedSec), 0, 1);

  // Very simple logistic-ish score (tunable later / ML-ready)
  const z =
    -1.2
    + 2.2 * acc
    + 0.55 * (groups / 5)
    + 0.35 * timeNorm
    - 0.12 * (STATE.miss)
    + 0.03 * (STATE.comboMax);

  const passProb = sigmoid(z);

  // Tips (explainable)
  let tip = '';
  if(groups < 5 && STATE.timeLeft > 10){
    const missing = [];
    for(let i=0;i<5;i++){
      if((STATE.g[i]||0) <= 0) missing.push(GROUPS[i].id);
    }
    if(missing.length) tip = `ยังขาดหมู่ ${missing.join(', ')} — โฟกัสเก็บให้ครบ!`;
  }else if(acc < 0.78){
    tip = 'ช้าลงนิดเดียวแล้วแม่นขึ้น จะคุมความแม่นได้! 🎯';
  }else if(STATE.hitJunk > 0 && (STATE.hitJunk / Math.max(1, STATE.hitGood)) > 0.35){
    tip = 'เลี่ยง 🍟🍩🍫 ให้มากขึ้น—คะแนนจะไหลลื่นกว่า!';
  }

  emit('hha:ai', {
    model:'baseline-logit-v1',
    passProb: round2(passProb),
    features: {
      timeLeft: STATE.timeLeft,
      score: STATE.score,
      miss: STATE.miss,
      accuracy: round2(acc),
      groupsFilled: groups,
      comboMax: STATE.comboMax,
      hitGood: STATE.hitGood,
      hitJunk: STATE.hitJunk,
      expireGood: STATE.expireGood
    },
    tip
  });

  // Optional coach (play-mode only)
  if(STATE.cfg.runMode === 'play' && tip){
    // show sometimes (deterministic-ish using rng)
    if(STATE.rng() < 0.35) coach(tip, 'AI');
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  stopSpawner();

  // turn off FX
  try{ setBossFx(false,false); }catch{}
  try{ setStormFx(false); }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: round2(accuracy() * 100),

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
function startTimer(mount){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // Phase logic + AI tick (1s)
    updatePhaseTimers(mount);
    maybeEnterBossPhase(mount);
    maybeEnterStormPhase(mount);
    aiPredict();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Mini quest selection (deterministic in study)
 * ------------------------------------------------ */
function chooseMiniQuest(){
  // deterministic in research/study, random in play
  const r = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study')
    ? STATE.rng()
    : Math.random();

  if(r < 0.50){
    STATE.mini.type = 'accuracy';
    STATE.mini.name = 'ความแม่นยำ';
    STATE.mini.sub  = 'คุมความแม่น ≥ 80%';
    STATE.mini.target = 80;
    STATE.mini.cur = 0;
    STATE.mini.done = false;
  }else{
    STATE.mini.type = 'combo';
    STATE.mini.name = 'คอมโบสายฟ้า';
    STATE.mini.sub  = 'ทำคอมโบสูงสุด ≥ 12';
    STATE.mini.target = 12;
    STATE.mini.cur = 0;
    STATE.mini.done = false;
  }
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
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

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE.bossUntilT = 0;
  STATE.stormUntilT = 0;

  STATE.coachCooldownT = 0;
  STATE.aiCooldownT = 0;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // choose mini quest
  chooseMiniQuest();

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    miniType: STATE.mini.type
  });

  emitQuest();
  emitScore();

  // start spawner (base)
  startSpawner({
    mount,
    spawnRate: baseSpawnRate(),
    goodW: baseGoodWeight(),
    junkW: baseJunkWeight(),
    sizeRange: baseSizeRange()
  });

  // start timer
  startTimer(mount);

  // intro coach
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️ (เลี่ยงของหวาน/ทอด)', 'Coach', true);
}