// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (hooks ready)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js (decorateTarget supported)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss phase, Storm phase (hooks)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Emoji variety by Thai 5 food groups (ไม่แปลผัน)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

/* ------------------------------------------------
 * Thai 5 food groups — fixed mapping (do not mutate)
 * หมู่ 1 โปรตีน, หมู่ 2 คาร์บ, หมู่ 3 ผัก, หมู่ 4 ผลไม้, หมู่ 5 ไขมัน
 * ------------------------------------------------ */
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

/* Emoji sets per group (variety) */
const EMOJI_GROUP = {
  g1: ['🥩','🥛','🥚','🫘','🐟'],          // โปรตีน
  g2: ['🍚','🍞','🥔','🍠','🍜'],          // คาร์บ/แป้ง/เผือกมัน
  g3: ['🥦','🥬','🥒','🫑','🥕'],          // ผัก
  g4: ['🍎','🍌','🍇','🍉','🍍'],          // ผลไม้
  g5: ['🥑','🫒','🧈','🥜','🧀'],          // ไขมัน (ชี้เชิงสัญลักษณ์)
};

/* Junk (ของหวาน/ทอด) */
const EMOJI_JUNK = ['🍟','🍩','🍰','🧁','🥤','🍔'];

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

function pickFrom(rng, arr, lastValue=null){
  if(!arr || !arr.length) return '';
  if(arr.length === 1) return arr[0];

  // avoid same-as-last if possible
  let tries = 0;
  let val = arr[Math.floor(rng() * arr.length)];
  while(val === lastValue && tries < 6){
    val = arr[Math.floor(rng() * arr.length)];
    tries++;
  }
  return val;
}

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
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

  // plate groups (5 หมู่) count hits
  g:[0,0,0,0,0],

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

  // spawn engine instance
  engine:null,

  // variety memory (avoid boring repeats)
  lastEmojiByGroup: { g1:null,g2:null,g3:null,g4:null,g5:null },
  lastJunkEmoji: null,

  // fun phases
  bossOn:false,
  stormOn:false,

  // AI hooks (optional)
  ai:{
    // rolling features
    last10: [],     // store recent outcomes: 'G'|'J'|'E'
    predict:{
      junkRisk:0,   // 0..1
      nextTip:''
    }
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
 * Coach helper (rate-limit)
 * ------------------------------------------------ */
let __coachTO = 0;
function coach(msg, tag='Coach'){
  const t = Date.now();
  if(t < __coachTO) return;
  __coachTO = t + 650; // quick but not spam
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
  pushScore();
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
 * Fun phases hooks (Boss / Storm)
 * ------------------------------------------------ */
function setBoss(on){
  if(STATE.bossOn === !!on) return;
  STATE.bossOn = !!on;
  emit('hha:judge', { tag:'boss', on:STATE.bossOn });
  // optional: toggle CSS fx layers if present
  try{
    const el = document.getElementById('bossFx');
    if(el) el.classList.toggle('boss-on', STATE.bossOn);
  }catch{}
}

function setStorm(on){
  if(STATE.stormOn === !!on) return;
  STATE.stormOn = !!on;
  emit('hha:judge', { tag:'storm', on:STATE.stormOn });
  try{
    const el = document.getElementById('stormFx');
    if(el) el.classList.toggle('storm-on', STATE.stormOn);
  }catch{}
}

/* ------------------------------------------------
 * AI Prediction hooks (lightweight, deterministic in research)
 * ------------------------------------------------ */
function aiUpdate(outcome /* 'G' good hit | 'J' junk hit | 'E' good expired */){
  STATE.ai.last10.push(outcome);
  if(STATE.ai.last10.length > 10) STATE.ai.last10.shift();

  // simple risk estimate: higher junk+expire -> risk up
  const n = STATE.ai.last10.length || 1;
  const j = STATE.ai.last10.filter(x=>x==='J').length;
  const e = STATE.ai.last10.filter(x=>x==='E').length;

  const risk = clamp((j*1.0 + e*0.8) / n, 0, 1);
  STATE.ai.predict.junkRisk = risk;

  // pick tip
  if(risk >= 0.55) STATE.ai.predict.nextTip = 'เล็งให้ชัดก่อนยิง ลดพลาด!';
  else if(STATE.combo >= 6) STATE.ai.predict.nextTip = 'สุดยอด! รักษาคอมโบไว้!';
  else if(accuracy()*100 < 80) STATE.ai.predict.nextTip = 'ช้าลงนิด ความแม่นจะดีขึ้น';
  else STATE.ai.predict.nextTip = '';

  // emit optional telemetry
  emit('hha:judge', {
    tag:'ai',
    junkRisk: STATE.ai.predict.junkRisk,
    tip: STATE.ai.predict.nextTip
  });

  // show tip sometimes (not every hit)
  if(STATE.ai.predict.nextTip && (STATE.rng() < 0.28)){
    coach(STATE.ai.predict.nextTip, 'AI Coach');
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

  // stop spawner
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracy() * 100),

    // group hits
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // ai snapshot
    aiJunkRisk: STATE.ai.predict.junkRisk
  });
}

/* ------------------------------------------------
 * Timer + phase scheduler
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // phases (simple): storm mid, boss near end (play mode only)
    const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
    if(!isStudy){
      const total = Number(STATE.cfg.durationPlannedSec) || 90;
      const elapsed = total - STATE.timeLeft;

      // storm for 12s around 35% time
      if(elapsed === Math.floor(total*0.35)) { setStorm(true); coach('พายุมา! เป้าไวขึ้น 🌪️','System'); }
      if(elapsed === Math.floor(total*0.35) + 12) setStorm(false);

      // boss for last 12s
      if(STATE.timeLeft === 12) { setBoss(true); coach('บอสมา! โฟกัสให้ดี 👾','System'); }
      if(STATE.timeLeft === 0) setBoss(false);
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

  // scoring: reward combo more during boss
  const base = 100;
  const comboBonus = (STATE.bossOn ? 9 : 5) * STATE.combo;
  addScore(base + comboBonus);

  // goal progress: number of groups that have at least 1 hit
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy >= 80%
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
  aiUpdate('G');
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);

  // if boss/storm -> harsher feedback
  if(STATE.bossOn || STATE.stormOn) coach('พลาดตอนจังหวะยาก! ระวังของทอด/หวาน ⚠️','Coach');
  else coach('ระวัง! ของหวาน/ทอด ⚠️');

  emitQuest();
  aiUpdate('J');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  aiUpdate('E');
}

/* ------------------------------------------------
 * Decorate target: emoji by group / kind
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // ensure inner emoji node
  let emojiEl = el.querySelector('.plateEmoji');
  if(!emojiEl){
    emojiEl = document.createElement('div');
    emojiEl.className = 'plateEmoji';
    el.appendChild(emojiEl);
  }

  if(t.kind === 'junk'){
    const em = pickFrom(STATE.rng, EMOJI_JUNK, STATE.lastJunkEmoji);
    STATE.lastJunkEmoji = em;
    emojiEl.textContent = em;
    return;
  }

  // good: group-based emoji variety
  const gi = clamp(t.groupIndex ?? 0, 0, 4);
  const key = GROUP_KEYS[gi] || 'g1';
  const arr = EMOJI_GROUP[key] || EMOJI_GROUP.g1;

  const last = STATE.lastEmojiByGroup[key] || null;
  const em = pickFrom(STATE.rng, arr, last);
  STATE.lastEmojiByGroup[key] = em;
  emojiEl.textContent = em;
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');

  // speed tuning:
  // - base spawnRate depends diff
  // - storm phase can be simulated via higher spawn rate (handled by timer hooks by toggling STATE.stormOn)
  const baseRate =
    STATE.cfg.diff === 'hard' ? 700 :
    STATE.cfg.diff === 'easy' ? 980 : 860;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate: baseRate,
    sizeRange: [44, 64],

    kinds: [
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],

    decorateTarget, // ✅ PATCH: emoji/icon renderer

    onHit:(t)=>{
      // if storm ON -> treat as slightly harder (just scoring/feedback; spawnRate change optional)
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

  // init cfg + mode rng
  STATE.cfg = cfg || {};
  const runMode = (cfg.runMode || 'play').toLowerCase();
  STATE.cfg.runMode = runMode;

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

  STATE.bossOn = false;
  STATE.stormOn = false;

  STATE.lastEmojiByGroup = { g1:null,g2:null,g3:null,g4:null,g5:null };
  STATE.lastJunkEmoji = null;

  STATE.ai.last10 = [];
  STATE.ai.predict.junkRisk = 0;
  STATE.ai.predict.nextTip = '';

  // RNG: deterministic for research/study; normal random for play
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time (default 90 is good for Plate)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  pushScore();
  startTimer();

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}