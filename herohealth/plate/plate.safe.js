// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION PATCH)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (future hook)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory.js (spawn DOM targets)
// ✅ decorateTarget: emoji/icon skin by Thai 5 food groups
// ✅ Anti-repeat emoji per group (less boring)
// ✅ AI hooks ready (feature snapshots), but OFF by default
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
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

/* ------------------------------------------------
 * Thai 5 Food Groups (DO NOT CHANGE)
 * mapping: index 0..4 => g1..g5
 * ------------------------------------------------ */
const TH_GROUPS = [
  { key:'g1', name:'หมู่ 1 โปรตีน',    hint:'เนื้อ นม ไข่ ถั่ว' }, // protein
  { key:'g2', name:'หมู่ 2 คาร์บ',     hint:'ข้าว แป้ง เผือก มัน น้ำตาล' }, // carbs
  { key:'g3', name:'หมู่ 3 ผัก',       hint:'ผักสีเขียว/เหลือง' }, // veg
  { key:'g4', name:'หมู่ 4 ผลไม้',     hint:'ผลไม้หลากสี' }, // fruit
  { key:'g5', name:'หมู่ 5 ไขมัน',     hint:'ไขมันให้พลัง/อบอุ่น' }, // fats
];

/* ------------------------------------------------
 * Emoji Packs (variety to avoid boring)
 * ------------------------------------------------ */
const EMOJI_PACK = {
  g1: ['🥚','🥛','🍗','🐟','🫘','🥜','🍖','🧀'],
  g2: ['🍚','🍞','🍜','🥖','🥔','🍠','🍪','🍯'],
  g3: ['🥦','🥬','🥒','🌽','🥕','🫑','🍆','🥗'],
  g4: ['🍎','🍌','🍇','🍉','🍍','🍊','🥭','🍓'],
  g5: ['🥑','🫒','🧈','🥥','🌰','🍳','🧀','🥜'],
};

const JUNK_EMOJI = ['🍰','🍩','🍟','🍔','🥤','🍫','🧁','🍭'];

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

  // cfg / rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // anti-repeat memory
  lastEmojiByGroup: { g1:'', g2:'', g3:'', g4:'', g5:'', junk:'' },

  // AI hooks (OFF)
  ai: {
    enabled:false,          // keep OFF unless you explicitly turn on later
    snapshotEveryMs:1000,
    lastSnapAt:0,
    snaps:[],               // ephemeral (if needed, send to logger later)
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
  STATE.score += (Number(v) || 0);
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
 * AI snapshot (OFF by default)
 * (point for ML/DL later: difficulty prediction, churn risk, skill estimate)
 * ------------------------------------------------ */
function maybeSnapAI(){
  if(!STATE.ai.enabled) return;
  const t = nowMs();
  if(t - STATE.ai.lastSnapAt < STATE.ai.snapshotEveryMs) return;
  STATE.ai.lastSnapAt = t;

  const acc = accuracy();
  const uniqueGroups = STATE.g.filter(v=>v>0).length;

  STATE.ai.snaps.push({
    tMs: Math.round(t),
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,
    acc,
    uniqueGroups,
    timeLeft: STATE.timeLeft,
    diff: STATE.cfg?.diff || 'normal',
    runMode: STATE.cfg?.runMode || 'play',
    seed: STATE.cfg?.seed || 0,
  });

  // keep buffer small
  if(STATE.ai.snaps.length > 120) STATE.ai.snaps.shift();
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  STATE.timer = null;

  try{ STATE.spawner?.stop?.(); }catch{}
  STATE.spawner = null;

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

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // AI payload (still small; logger may ignore)
    aiSnaps: STATE.ai.enabled ? STATE.ai.snaps : undefined,
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

    maybeSnapAI();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Emoji picker with anti-repeat
 * ------------------------------------------------ */
function pickEmoji(arr, last){
  if(!arr || arr.length === 0) return '🍽️';
  if(arr.length === 1) return arr[0];
  // try up to 6 times to avoid same as last
  for(let i=0;i<6;i++){
    const e = arr[Math.floor(STATE.rng() * arr.length)];
    if(e !== last) return e;
  }
  return arr[Math.floor(STATE.rng() * arr.length)];
}

/* ------------------------------------------------
 * decorateTarget (emoji/icon)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // ensure baseline
  el.innerHTML = '';

  // wrapper to allow "target like in image"
  const wrap = DOC.createElement('div');
  wrap.className = 'ptWrap';

  const ring = DOC.createElement('div');
  ring.className = 'ptRing';

  const icon = DOC.createElement('div');
  icon.className = 'ptIcon';

  const badge = DOC.createElement('div');
  badge.className = 'ptBadge';

  if(t.kind === 'junk'){
    const last = STATE.lastEmojiByGroup.junk || '';
    const em = pickEmoji(JUNK_EMOJI, last);
    STATE.lastEmojiByGroup.junk = em;

    icon.textContent = em;
    badge.textContent = '⚠️';
    el.dataset.kind = 'junk';
  }else{
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const key = TH_GROUPS[gi]?.key || 'g1';

    const last = STATE.lastEmojiByGroup[key] || '';
    const em = pickEmoji(EMOJI_PACK[key], last);
    STATE.lastEmojiByGroup[key] = em;

    icon.textContent = em;
    badge.textContent = String(gi + 1); // show group number 1..5
    el.dataset.kind = 'good';
    el.dataset.group = key;
  }

  ring.appendChild(icon);
  wrap.appendChild(ring);
  wrap.appendChild(badge);
  el.appendChild(wrap);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal: unique groups filled
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

  // fun feedback hook (optional)
  emit('hha:judge', { kind:'good', groupIndex, score:STATE.score, combo:STATE.combo });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  emit('hha:judge', { kind:'junk', score:STATE.score, combo:STATE.combo });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  emit('hha:judge', { kind:'expire', score:STATE.score, combo:STATE.combo });
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  // speed by diff (tune later)
  const rate =
    (STATE.cfg.diff === 'hard') ? 700 :
    (STATE.cfg.diff === 'easy') ? 980 :
    860;

  // TTL is inside mode-factory; we tune via spawnRate only for now
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safePrefix: 'plate',          // uses --plate-*-safe vars
    spawnRate: rate,
    sizeRange: [46, 72],
    kinds: [
      { kind:'good', weight: 0.74 },
      { kind:'junk', weight: 0.26 }
    ],
    decorateTarget,               // ✅ key patch
    onHit: (t)=>{
      if(t.kind === 'good'){
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

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg normalize
  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset
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

  STATE.lastEmojiByGroup = { g1:'', g2:'', g3:'', g4:'', g5:'', junk:'' };

  // RNG: deterministic in research/study
  const runMode = (cfg.runMode || 'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
    // keep adaptive OFF in research
    STATE.ai.enabled = false;
  }else{
    STATE.rng = Math.random;
    // play: keep AI hooks OFF by default; enable later if you want
    STATE.ai.enabled = false;
  }

  // duration (recommendation: 70 for quick, 90 for standard, 110 for mastery)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game: 'plate',
    runMode,
    diff: (cfg.diff || 'normal'),
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  pushScore();
  startTimer();

  // start spawner
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}