// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (future hook)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js (DOM spawner) with groupIndex meta
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

const roundPct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (seed >>> 0) || 1;
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
 * Emoji sets
 * ------------------------------------------------ */
// 5 หมู่: (ตัวอย่าง) 1) ข้าวแป้ง 2) ผัก 3) เนื้อ/ถั่ว 4) นม 5) ผลไม้
const GROUP_EMOJI = [
  ['🍚','🍞','🥔','🍜'],      // 0 carbs
  ['🥦','🥬','🥕','🌽'],      // 1 veg
  ['🍗','🥚','🐟','🫘'],      // 2 protein
  ['🥛','🧀','🥣'],          // 3 dairy
  ['🍌','🍎','🍉','🍇']       // 4 fruit
];

const JUNK_EMOJI = ['🍩','🍟','🍭','🍔','🧋','🍰'];

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

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner instance
  spawner:null,

  // future hooks (boss/storm)
  bossOn:false,
  stormOn:false
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
 * ------------------------------------------------ */
function accuracy(){
  // ตัวนี้ตั้งใจรวม expireGood เป็น miss ด้วย (เหมือนเกมอื่น)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  try{ STATE.spawner && STATE.spawner.stop(); }catch(_){}

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
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalMiniAfterGood(){
  // goal progress = จำนวนหมู่ที่มีอย่างน้อย 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini = accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex ?? 0, 0, 4) | 0;
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  updateGoalMiniAfterGood();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  // accuracy mini ต้อง update ด้วย
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  // accuracy mini update
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();
}

/* ------------------------------------------------
 * Spawn integration (mode-factory)
 * ------------------------------------------------ */
function pickGroupIndexBalanced(){
  // ให้เกม “พยายาม” เติมหมู่ที่ขาดก่อน เพื่อช่วยเด็กผ่าน goal (kids-friendly)
  const need = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) need.push(i);
  if(need.length){
    return need[Math.floor(STATE.rng()*need.length)];
  }
  // ถ้าครบแล้วสุ่มปกติ
  return Math.floor(STATE.rng()*5);
}

function makeTargetEl(t){
  const el = document.createElement('div');
  el.className = 'plateTarget';

  // emoji
  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4) | 0;
    const arr = GROUP_EMOJI[gi] || ['🍽️'];
    const emo = arr[Math.floor(STATE.rng()*arr.length)] || '🍽️';
    el.textContent = emo;
  }else{
    el.textContent = JUNK_EMOJI[Math.floor(STATE.rng()*JUNK_EMOJI.length)] || '🍩';
  }

  // size/pos
  el.style.left = `${t.cx}px`;
  el.style.top  = `${t.cy}px`;
  el.style.width = `${t.size}px`;
  el.style.height = `${t.size}px`;

  // dataset for css
  el.dataset.kind = t.kind;
  if(t.groupIndex != null) el.dataset.group = String(t.groupIndex);

  return el;
}

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // เวลา 90 วินาที “เหมาะมาก” สำหรับเด็ก ป.5 ถ้าเป้าไม่แน่นเกิน
  // (คุณเปลี่ยนได้จาก query ?time=90)
  const spawnRate =
    diff === 'hard' ? 680 :
    diff === 'easy' ? 980 :
    840;

  const lifeMs =
    diff === 'hard' ? 1500 :
    diff === 'easy' ? 2100 :
    1800;

  return spawnBoot({
    mount,

    // RNG
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    // dynamics
    spawnRate,
    lifeMs,
    sizeRange: [46, 70],

    // Safezones (กันเป้าไปทับ HUD) — เลือกโซนที่คุณมีจริงใน HTML/CSS
    safezones: ['#hud', '#coachCard'],

    // weights
    kinds: [
      { kind:'good', weight: 0.72 },
      { kind:'junk', weight: 0.28 }
    ],

    // ✅ attach groupIndex/meta
    pickExtra: (t)=>{
      if(t.kind !== 'good') return {};
      const gi = pickGroupIndexBalanced();
      return { groupIndex: gi };
    },

    // ✅ custom element (emoji by group)
    makeEl: (t)=> makeTargetEl(t),

    // hit/expire
    onHit: (t)=>{
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
      } else {
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

  // stop old
  try{ STATE.spawner && STATE.spawner.stop(); }catch(_){}

  STATE.cfg = cfg || {};
  STATE.running = true;
  STATE.ended = false;

  // reset scores
  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  // counters
  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  // groups
  STATE.g = [0,0,0,0,0];

  // quests
  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG mode
  const rm = (cfg.runMode || 'play').toLowerCase();
  if(rm === 'research' || rm === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
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

  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}