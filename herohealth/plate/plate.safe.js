// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (soft director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js decorateTarget => emoji targets
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ End = stop spawner (no target flash)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

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

function ensureFxLayers(){
  // optional (CSS มีอยู่แล้ว) — ถ้า HTML ไม่มี เราสร้างให้
  if(!DOC.getElementById('bossFx')){
    const b = DOC.createElement('div');
    b.id = 'bossFx';
    DOC.body.appendChild(b);
  }
  if(!DOC.getElementById('stormFx')){
    const s = DOC.createElement('div');
    s.id = 'stormFx';
    DOC.body.appendChild(s);
  }
}

function setFx(id, cls, on){
  const el = DOC.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(cls);
  else el.classList.remove(cls);
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

  // plate groups (เก็บจำนวน hit good ของแต่ละหมู่)
  g:[0,0,0,0,0], // index 0..4 => หมู่ 1..5

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

  // spawn
  mount:null,
  engine:null,

  // adaptive (play only)
  adaptiveLevel: 0,
  adaptiveTick: null,
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
  STATE.score += (Number(v) || 0);
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
  // total = goodHit + junkHit + goodExpired
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accuracyPctInt(){
  return Math.max(0, Math.min(100, Math.round(accuracy() * 100)));
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{
    if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch(_){}
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  try{ clearInterval(STATE.adaptiveTick); }catch(_){}
  STATE.timer = null;
  STATE.adaptiveTick = null;

  // ✅ stop spawner now (no "flash")
  stopSpawner();

  // fx off
  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: accuracyPctInt(),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,

    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed
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

    // simple boss/storm feel (optional)
    if(STATE.timeLeft <= 20) setFx('bossFx','boss-on', true);
    if(STATE.timeLeft <= 12) setFx('bossFx','boss-panic', true);

    if(STATE.cfg?.diff === 'hard' && STATE.timeLeft <= 35){
      setFx('stormFx','storm-on', true);
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateQuestsAfterHit(){
  // goal: count unique groups touched at least once
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy >= target
  const accPct = accuracyPctInt();
  STATE.mini.cur = accPct;
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitGood(groupIndex0){
  STATE.hitGood++;

  const gi0 = clamp(groupIndex0, 0, 4);
  STATE.g[gi0]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  emit('hha:judge', {
    kind:'good',
    groupId: gi0 + 1,
    groupLabel: labelForGroup(gi0 + 1),
    accPct: accuracyPctInt(),
    combo: STATE.combo,
    score: STATE.score
  });

  updateQuestsAfterHit();
}

function onHitJunk(emojiUsed){
  STATE.hitJunk++;
  STATE.miss++; // miss = junk hit + good expired (ตามสไตล์ HHA)
  resetCombo();
  addScore(-60);

  emit('hha:judge', {
    kind:'junk',
    emoji: emojiUsed || '',
    accPct: accuracyPctInt(),
    combo: STATE.combo,
    score: STATE.score
  });

  coach('ระวัง! ของหวาน/ทอด ⚠️');
  updateQuestsAfterHit();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  emit('hha:judge', {
    kind:'expire-good',
    accPct: accuracyPctInt(),
    combo: STATE.combo,
    score: STATE.score
  });

  updateQuestsAfterHit();
}

/* ------------------------------------------------
 * Spawner config (adaptive)
 * ------------------------------------------------ */
function computeSpawnParams(){
  const diff = (STATE.cfg?.diff || 'normal');

  // base by diff
  let baseRate = (diff === 'hard') ? 760 : (diff === 'easy' ? 980 : 880);
  let junkW = (diff === 'hard') ? 0.34 : (diff === 'easy' ? 0.22 : 0.28);
  let minS = (diff === 'hard') ? 42 : 46;
  let maxS = (diff === 'hard') ? 62 : 66;

  // play-adaptive: tweak by level (0..4)
  const L = clamp(STATE.adaptiveLevel, 0, 4);
  baseRate = Math.round(baseRate - L * 60);      // faster spawns
  junkW = Math.min(0.45, junkW + L * 0.03);      // more junk pressure
  minS = Math.max(34, minS - L * 2);             // slightly smaller targets
  maxS = Math.max(minS + 10, maxS - L * 2);

  // clamp safety
  baseRate = clamp(baseRate, 520, 1400);

  return {
    spawnRate: baseRate,
    sizeRange: [minS, maxS],
    kinds: [
      { kind:'good', weight: (1 - junkW) },
      { kind:'junk', weight: junkW }
    ]
  };
}

function decorateTarget(el, target){
  const kind = target.kind;
  const rng = target.rng; // deterministic from spawner seed

  if(kind === 'good'){
    // mode-factory groupIndex is 0..4 => convert to 1..5
    const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
    const em = emojiForGroup(rng, groupId);

    el.dataset.group = String(groupId);
    el.textContent = em;

    // small hint (optional)
    el.setAttribute('aria-label', `${FOOD5[groupId]?.labelTH || 'อาหาร'} ${em}`);
  }else{
    const em = pickEmoji(rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.textContent = em;
    el.setAttribute('aria-label', `ขยะอาหาร ${em}`);
  }
}

function makeSpawner(){
  const mount = STATE.mount;
  if(!mount) throw new Error('PlateVR: mount missing');

  const p = computeSpawnParams();

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: p.spawnRate,
    sizeRange: p.sizeRange,
    kinds: p.kinds,
    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi0 = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi0);
      }else{
        // grab emoji from element if possible (so judge log has it)
        const em = (t?.el && t.el.textContent) ? String(t.el.textContent) : '';
        onHitJunk(em);
      }
    },

    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

function restartSpawner(){
  // ใช้ตอน adaptive ปรับพารามิเตอร์: stop แล้วสร้างใหม่
  stopSpawner();
  if(!STATE.ended) STATE.engine = makeSpawner();
}

/* ------------------------------------------------
 * Adaptive director (play only)
 * ------------------------------------------------ */
function startAdaptiveIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play');
  if(run === 'research' || run === 'study') return;

  // ปรับทุก ~12 วิ (นุ่ม ๆ)
  STATE.adaptiveTick = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;

    // ประเมินจาก accuracy + comboMax ที่ “กำลังไปได้ดี”
    const acc = accuracyPctInt();
    const c = STATE.comboMax;

    let targetLevel = 0;

    // เก่งขึ้น -> เพิ่มแรงกดดัน
    if(acc >= 92 && c >= 8) targetLevel = 4;
    else if(acc >= 88 && c >= 6) targetLevel = 3;
    else if(acc >= 84 && c >= 4) targetLevel = 2;
    else if(acc >= 78) targetLevel = 1;
    else targetLevel = 0;

    // กันสวิง: เปลี่ยนทีละ 1 ขั้น
    if(targetLevel > STATE.adaptiveLevel) STATE.adaptiveLevel++;
    else if(targetLevel < STATE.adaptiveLevel) STATE.adaptiveLevel--;

    // รีสตาร์ท spawner เมื่อ level เปลี่ยนจริง ๆ
    restartSpawner();
  }, 12000);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.mount = mount;
  STATE.cfg = cfg;

  ensureFxLayers();
  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

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

  // RNG: research/study deterministic
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive reset
  STATE.adaptiveLevel = 0;
  try{ clearInterval(STATE.adaptiveTick); }catch(_){}
  STATE.adaptiveTick = null;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer();

  // create spawner
  STATE.engine = makeSpawner();

  // play adaptive
  startAdaptiveIfNeeded();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}