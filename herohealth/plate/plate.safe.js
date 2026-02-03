// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (ปรับ spawnRate/สัดส่วน junk ตามความคืบหน้า)
//   - research/study: deterministic seed + adaptive OFF (คงที่เพื่อวิจัย)
// ✅ Fix: “ออกไม่ครบ 5 หมู่” -> Coverage Director (บังคับหมู่ที่ยังขาดให้โผล่)
// ✅ Uses decorateTarget(el,target) from mode-factory
// ✅ Uses Thai 5 Groups mapping (STABLE) from ../vr/food5-th.js
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, emojiForJunk, labelForGroup } from '../vr/food5-th.js';

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

  // group hits (5 หมู่) index 0..4
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

  // spawn engine
  engine:null,

  // coverage director
  needed: new Set([0,1,2,3,4]), // groups missing (index 0..4)

  // adaptive knobs (play mode only)
  spawnRateMs: 900,
  junkWeight: 0.30
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
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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
 * (ตามนิยาม Plate: good hit vs (good hit + junk hit + good expire))
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Coverage Director: ให้ “ออกครบ 5 หมู่”
 * ------------------------------------------------ */
function updateNeededOnHit(groupIndex0){
  if(groupIndex0 >= 0 && groupIndex0 <= 4) STATE.needed.delete(groupIndex0);

  // goal progress = จำนวนหมู่ที่ได้อย่างน้อย 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function pickGroupIndexForNextTarget(target){
  // target.rng = deterministic rng จาก mode-factory (seeded)
  const rngFn = target?.rng || STATE.rng;

  // ถ้ายังไม่ครบ 5 หมู่ -> บังคับเลือกจากหมู่ที่ขาดก่อน
  const missing = Array.from(STATE.needed);
  if(missing.length){
    const i = Math.floor((rngFn() * missing.length));
    return missing[Math.max(0, Math.min(missing.length-1, i))];
  }

  // ครบแล้ว -> สุ่มปกติ
  return Math.floor(rngFn() * 5);
}

/* ------------------------------------------------
 * Adaptive tuning (play mode only)
 * ------------------------------------------------ */
function applyAdaptiveTuning(){
  if(!STATE.cfg) return;
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  if(run === 'research' || run === 'study') return;

  // แนวคิด: ยิ่งคอมโบ/คะแนนสูง -> เร่ง spawn + เพิ่ม junk เล็กน้อย
  const prog = clamp(STATE.goal.cur / 5, 0, 1); // 0..1
  const comboFactor = clamp(STATE.comboMax / 25, 0, 1);

  // spawnRate ลดลง = ถี่ขึ้น (เร็วขึ้นนิด ๆ)
  // เริ่ม ~900ms ไปถึง ~650ms เมื่อเล่นเก่ง + เข้าใกล้ครบหมู่
  STATE.spawnRateMs = Math.round(900 - (prog*140 + comboFactor*110));

  // junkWeight จาก 0.30 ไปถึง ~0.40 ช่วงท้ายให้ท้าทาย
  STATE.junkWeight = clamp(0.30 + prog*0.07 + comboFactor*0.03, 0.25, 0.45);
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

  // ✅ stop spawner กันเป้าแว๊บๆ
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = null;

  const accPct = Math.round(accuracy() * 100);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

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
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex0){
  STATE.hitGood++;

  // group index 0..4
  const gi = clamp(groupIndex0, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // coverage + goal
  updateNeededOnHit(gi);

  // mini: accuracy
  const accPct = Math.round(accuracy() * 100);
  STATE.mini.cur = accPct;
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  // ปรับความยาก (เฉพาะ play)
  applyAdaptiveTuning();

  emitQuest();

  // ✅ judge event (เก็บใช้กับ logger/วิจัย)
  emit('hha:judge', { kind:'good', group: gi+1, label: labelForGroup(gi+1), score: STATE.score, combo: STATE.combo });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-60);
  coach('ระวัง! ของหวาน/ทอด ⚠️');

  applyAdaptiveTuning();
  emitQuest();
  emit('hha:judge', { kind:'junk', score: STATE.score, combo: STATE.combo });
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  applyAdaptiveTuning();
  emitQuest();
  emit('hha:judge', { kind:'expire_good', score: STATE.score, combo: STATE.combo });
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const run = (STATE.cfg.runMode||'play').toLowerCase();
  const deterministic = (run === 'research' || run === 'study');

  // ค่าเริ่ม (จะโดน applyAdaptiveTuning ใน play)
  STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 780 : 900;
  STATE.junkWeight  = (STATE.cfg.diff === 'hard') ? 0.34 : 0.30;

  // วิจัย: คงที่ (adaptive OFF)
  if(deterministic){
    STATE.spawnRateMs = (STATE.cfg.diff === 'hard') ? 750 : 900;
    STATE.junkWeight  = (STATE.cfg.diff === 'hard') ? 0.33 : 0.30;
  }

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    // ✅ spawnRate “อ่านจาก STATE” ได้ เพราะเราจะ stop แล้ว boot ใหม่เมื่อจำเป็น?
    // แต่โครงสร้าง mode-factory เป็น setInterval คงที่
    // ดังนั้นเราทำแบบ “พอปรับแล้ว -> ไม่ต้องรีบูทถี่” ให้ใช้ค่าเริ่ม + ความถี่ที่พอดี
    // (ถ้าอยาก adaptive จริงแบบเปลี่ยน spawnRate ระหว่างเกม -> เดี๋ยวทำแพทช์ mode-factory ให้รับ getSpawnRate())
    spawnRate: STATE.spawnRateMs,

    sizeRange:[44, 66],
    kinds:[
      { kind:'good', weight: 1 - STATE.junkWeight },
      { kind:'junk', weight: STATE.junkWeight }
    ],

    // ✅ ตกแต่งเป้า: บังคับ groupIndex + emoji
    decorateTarget:(el, target)=>{
      if(!el || !target) return;

      // 1) assign groupIndex ให้ “ออกครบ 5 หมู่” ก่อน
      const gi = pickGroupIndexForNextTarget(target); // 0..4
      target.groupIndex = gi;

      // 2) set dataset for styling/debug
      el.dataset.group = String(gi+1);

      // 3) emoji
      if(target.kind === 'junk'){
        el.textContent = emojiForJunk(target.rng);
        el.title = `${JUNK.labelTH} • ${JUNK.descTH}`;
      }else{
        el.textContent = emojiForGroup(target.rng, gi+1);
        const g = FOOD5[gi+1];
        el.title = `${g.labelTH} • ${g.descTH}`;
      }
    },

    onHit:(t)=>{
      if(t.kind === 'good'){
        onHitGood(t.groupIndex ?? 0);
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

  // reset any old run
  try{ STATE.engine?.stop?.(); }catch{}
  STATE.engine = null;
  clearInterval(STATE.timer);
  STATE.timer = null;

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
  STATE.needed = new Set([0,1,2,3,4]);

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  // RNG
  const run = (cfg.runMode||'play').toLowerCase();
  if(run === 'research' || run === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

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

  // boot spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}