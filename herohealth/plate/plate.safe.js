// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------
// ✅ Uses mode-factory.js (export boot) for DOM targets
// ✅ Play / Research modes
//   - play: adaptive ON (mild)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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

function pct2(n){ return Math.round((Number(n)||0) * 100) / 100; }

function seededRng(seed){
  let t = (Number(seed) || 0) >>> 0;
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
 * Emoji sets (ไม่เบื่อ: 1 หมู่มีหลายตัว แต่ยังสื่อความหมายชัด)
 * ------------------------------------------------ */
// 5 หมู่ (ตัวอย่างชุดที่ “เด็ก ป.5 เข้าใจง่าย” + สีสันพอ)
const G_EMOJI = [
  ['🥦','🥬','🥒','🥕','🌽'],   // หมู่ 1 ผัก
  ['🍎','🍌','🍊','🍉','🍇'],   // หมู่ 2 ผลไม้
  ['🐟','🍗','🥚','🦐','🥛'],   // หมู่ 3 โปรตีน/นม (ผสมให้จำง่าย)
  ['🍚','🍞','🥔','🍜','🥨'],   // หมู่ 4 ข้าว-แป้ง
  ['🥑','🫒','🥜','🧈','🧀']    // หมู่ 5 ไขมันดี/ถั่ว/นมบางส่วน (ยังโอเคสำหรับเกม)
];

// junk / ควรเลี่ยง
const JUNK_EMOJI = ['🍩','🍟','🍔','🧋','🍭','🍫','🥤','🧁'];

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

  // cfg/rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null
};

/* ------------------------------------------------
 * Coach / Quest emit
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
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
 * Score helpers
 * ------------------------------------------------ */
function pushScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}
function addScore(v){
  STATE.score = Math.max(0, STATE.score + (Number(v)||0));
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
function accuracy(){
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
  try{ STATE.spawner?.stop?.(); }catch(_){}

  const accPct = pct2(accuracy() * 100);

  emit('hha:end', {
    projectTag: 'HeroHealth',
    game: 'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed ?? '',

    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

    accuracyGoodPct: accPct,

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
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalProgress(){
  // goal.cur = number of groups collected at least 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniAccuracy(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function onHitGood(t){
  STATE.hitGood++;

  const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
  STATE.g[gi]++;

  addCombo();

  // scoring: base + combo spice
  const base = 90;
  const bonus = Math.min(80, STATE.combo * 6);
  addScore(base + bonus);

  updateGoalProgress();
  updateMiniAccuracy();
  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // penalty
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  updateMiniAccuracy();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateMiniAccuracy();
  emitQuest();
}

/* ------------------------------------------------
 * Spawn tuning (เร่งนิด ๆ / 90s ดีไหม)
 * ------------------------------------------------ */
function buildSpawnConfig(){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();

  // 90 วินาที: ดีสำหรับ ป.5 (ไม่สั้นจนไม่เข้าใจ, ไม่ยาวจนเหนื่อย)
  // ถ้าต้อง “เร่งนิด ๆ” ให้ทำผ่าน spawnRate/ttl มากกว่าบังคับยืดเวลา
  const base = {
    spawnRate: 850,          // ms (normal)
    maxTargets: 6,
    sizeRange: [46, 68],
    ttlRange: [1200, 2400]
  };

  if(diff === 'easy'){
    base.spawnRate = 950;
    base.maxTargets = 5;
    base.sizeRange = [52, 78];
    base.ttlRange = [1400, 2800];
  }else if(diff === 'hard'){
    base.spawnRate = 720;
    base.maxTargets = 8;
    base.sizeRange = [42, 62];
    base.ttlRange = [900, 2000];
  }

  // research/study: ลดความผันผวนเล็กน้อย (คุมคุณภาพข้อมูล)
  if(run === 'research' || run === 'study'){
    base.maxTargets = Math.min(base.maxTargets, 6);
    base.ttlRange = [1200, 2200];
  }

  return base;
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // state reset
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

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  // RNG
  const run = (cfg?.runMode || 'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(cfg?.seed ?? Date.now());
  }else{
    // play: allow mild randomness (more fun)
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg?.durationPlannedSec) || 90;

  // Emit start
  emit('hha:start', {
    projectTag:'HeroHealth',
    game:'plate',
    runMode: cfg?.runMode || 'play',
    diff: cfg?.diff || 'normal',
    seed: cfg?.seed ?? '',
    durationPlannedSec: STATE.timeLeft,
    view: cfg?.view || ''
  });

  // Quest + score init
  emitQuest();
  pushScore();
  emit('hha:time', { leftSec: STATE.timeLeft });

  // start timer
  startTimer();

  // spawn controller
  const sp = buildSpawnConfig();

  STATE.spawner = spawnBoot({
    mount,
    seed: (run === 'research' || run === 'study') ? (cfg?.seed ?? 1) : undefined,
    spawnRate: sp.spawnRate,
    maxTargets: sp.maxTargets,
    sizeRange: sp.sizeRange,
    ttlRange: sp.ttlRange,

    kinds: [
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],

    onHit:(t)=>{
      // IMPORTANT: set emoji at creation time is in mode-factory default,
      // but we override per target here (more variety, less boring)
      if(t?.el){
        if(t.kind === 'good'){
          const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
          t.groupIndex = gi;
          const arr = G_EMOJI[gi];
          t.el.textContent = arr[Math.floor(STATE.rng()*arr.length)];
        }else{
          t.el.textContent = JUNK_EMOJI[Math.floor(STATE.rng()*JUNK_EMOJI.length)];
        }
      }

      // scoring logic
      if(t.kind === 'good') onHitGood(t);
      else onHitJunk();

      // win condition (optional): ถ้าทำครบทั้งคู่ก่อนเวลา -> ปิดเกมให้เลย
      if(STATE.goal.done && STATE.mini.done){
        endGame('all-clear');
      }
    },

    onExpire:(t)=>{
      // Only count expire on good targets
      if(t && t.kind === 'good') onExpireGood();
    }
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}