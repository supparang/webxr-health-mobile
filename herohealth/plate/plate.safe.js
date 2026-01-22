// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (lite) + variety ON
//   - research/study: deterministic seed + adaptive OFF + deterministic variety
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Boss/Storm hooks (future)
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses ../vr/mode-factory.js boot() spawner
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const roundPct = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
 * Emoji sets (variety pack)
 * ------------------------------------------------ */
const FOOD_GROUP_EMOJI = [
  // g1: ข้าว-แป้ง
  ['🍚','🍞','🥖','🥨','🍜','🥔','🌽'],
  // g2: ผัก
  ['🥦','🥬','🥕','🥒','🍅','🫑','🌶️'],
  // g3: ผลไม้
  ['🍎','🍌','🍇','🍊','🍉','🍓','🥭'],
  // g4: โปรตีน (เนื้อ/ไข่/ถั่ว)
  ['🍗','🥚','🐟','🫘','🥜','🍤','🥩'],
  // g5: นม
  ['🥛','🧀','🍶','🥣','🧈']
];

const JUNK_EMOJI = ['🍟','🍔','🍕','🌭','🍩','🧁','🍪','🍫','🍬','🍭','🥤','🧋'];

function pickFrom(arr, rng){
  return arr[Math.floor(rng() * arr.length)];
}

function pickNoRepeat(arr, rng, last){
  if(arr.length <= 1) return arr[0];
  let x = pickFrom(arr, rng);
  if(x === last){
    // try a couple times
    for(let i=0;i<3;i++){
      const y = pickFrom(arr, rng);
      if(y !== last){ x = y; break; }
    }
    // still same? pick next index
    if(x === last){
      const idx = arr.indexOf(x);
      x = arr[(idx + 1) % arr.length];
    }
  }
  return x;
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
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },

  // mini quest (switchable)
  mini:{
    type:'accuracy', // 'accuracy' | 'noJunkStreak'
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

  // streaks (for mini)
  noJunkStreak:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // variety memory
  lastEmojiByGroup:['','','','',''],
  lastJunkEmoji:'',

  // spawner
  engine:null
};

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

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: roundPct(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    miniType: STATE.mini.type
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
 * Mini quest selector (variety)
 * ------------------------------------------------ */
function chooseMiniQuest(){
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');

  // research: deterministic choice from seed
  // play: still deterministic per session (seeded rng), but you can later randomize from Date.now if you want
  const r = STATE.rng();

  const type = (r < 0.5) ? 'accuracy' : 'noJunkStreak';

  if(type === 'accuracy'){
    STATE.mini.type = 'accuracy';
    STATE.mini.name = 'ความแม่นยำ';
    STATE.mini.sub  = 'คุมความแม่น ≥ 80%';
    STATE.mini.cur = 0;
    STATE.mini.target = 80;
    STATE.mini.done = false;
  }else{
    STATE.mini.type = 'noJunkStreak';
    STATE.mini.name = 'สายคลีน';
    STATE.mini.sub  = 'อย่าโดน junk ติดกัน 8 ครั้ง';
    STATE.mini.cur = 0;
    STATE.mini.target = 8;
    STATE.mini.done = false;
  }

  // for research clarity, announce
  if(isResearch){
    coach(`Mini Quest: ${STATE.mini.name}`, 'System');
  }
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }
}

function updateMini(){
  if(STATE.mini.done) return;

  if(STATE.mini.type === 'accuracy'){
    const accPct = accuracy() * 100;
    STATE.mini.cur = Math.round(accPct);
    if(accPct >= STATE.mini.target){
      STATE.mini.done = true;
      coach('ความแม่นยำดีมาก! 👍');
    }
  }else if(STATE.mini.type === 'noJunkStreak'){
    STATE.mini.cur = STATE.noJunkStreak;
    if(STATE.noJunkStreak >= STATE.mini.target){
      STATE.mini.done = true;
      coach('สุดยอด! เล่นคลีนมาก 🥦✨');
    }
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  STATE.noJunkStreak++; // streak grows on good
  addCombo();

  addScore(100 + STATE.combo * 5);

  updateGoal();
  updateMini();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  STATE.noJunkStreak = 0;

  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  updateMini();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  STATE.noJunkStreak = 0;

  resetCombo();
  updateMini();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn config (variety pack)
 * ------------------------------------------------ */
function buildKinds(){
  // We create weighted list with per-group emoji variety for "good"
  // and junk emoji variety.
  const goods = [];
  for(let gi=0; gi<5; gi++){
    goods.push({
      kind:'good',
      weight: 0.14,          // total good ~0.70
      groupIndex: gi,
      emoji: null // filled per spawn by enrich()
    });
  }

  const junks = [
    { kind:'junk', weight: 0.30, emoji: null }
  ];

  return [...goods, ...junks];
}

function enrichTarget(t){
  // t has {kind, groupIndex, ...} from mode-factory
  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const pool = FOOD_GROUP_EMOJI[gi] || ['🥗'];
    const last = STATE.lastEmojiByGroup[gi] || '';
    const em = pickNoRepeat(pool, STATE.rng, last);
    STATE.lastEmojiByGroup[gi] = em;
    t.groupIndex = gi;
    t.emoji = em;
    if(t.el) t.el.textContent = em;
  }else{
    const last = STATE.lastJunkEmoji || '';
    const em = pickNoRepeat(JUNK_EMOJI, STATE.rng, last);
    STATE.lastJunkEmoji = em;
    t.emoji = em;
    if(t.el) t.el.textContent = em;
  }
  return t;
}

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // spawnRate: make plate feel active but not chaotic
  // - easy: 950ms
  // - normal: 820ms
  // - hard: 700ms
  let spawnRate = 820;
  if(diff === 'easy') spawnRate = 950;
  if(diff === 'hard') spawnRate = 700;

  // ttl: a bit longer so kids can react (Plate requires thinking)
  // - easy: 1900
  // - normal: 1700
  // - hard: 1450
  let ttlMs = 1700;
  if(diff === 'easy') ttlMs = 1900;
  if(diff === 'hard') ttlMs = 1450;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    ttlMs,
    sizeRange:[44,66],

    // weights already encode group distribution
    kinds: buildKinds(),

    // customize per spawn
    enrich: enrichTarget,

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
  STATE.noJunkStreak = 0;

  STATE.g = [0,0,0,0,0];
  STATE.lastEmojiByGroup = ['','','','',''];
  STATE.lastJunkEmoji = '';

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play mode: still keep session variety stable (not jittery)
    // if you want "fresh every reload", set seed to Date.now() in boot cfg
    STATE.rng = seededRng(cfg.seed || Date.now());
  }

  // quests reset
  STATE.goal.name = 'เติมจานให้ครบ 5 หมู่';
  STATE.goal.sub  = 'เก็บอาหารให้ครบทุกหมู่';
  STATE.goal.cur = 0;
  STATE.goal.target = 5;
  STATE.goal.done = false;

  chooseMiniQuest(); // sets STATE.mini.*

  // time: Plate ต้องคิด+เลี่ยง junk + ครบ 5 หมู่
  // default: 90 (ถ้าไม่ส่งมา)
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

  // start spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}