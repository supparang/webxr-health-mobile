// =========================================================
// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ---------------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (soft)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:shield, hha:end
// ✅ Shield: blocks junk hit (blocked => NOT count as Miss)
// ✅ Mini Quest: "เติมหมู่ที่ขาดใน 12 วิ" + reward time bonus
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot) handled by mode-factory
// =========================================================

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
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return Date.now(); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function pct2(n){
  // keep 2 decimals max for logs
  n = Number(n) || 0;
  return Math.round(n * 100) / 100;
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

  // Miss definition (HHA): miss = good expired + junk hit (blocked junk NOT count)
  miss:0,

  // shield
  shield:0,

  // time
  timeLeft:0,
  timer:null,
  startedAtMs:0,
  endedAtMs:0,

  // groups (5 หมู่)
  g:[0,0,0,0,0], // index 0-4
  // hits/exp
  hitGood:0,
  hitJunk:0,
  hitJunkBlocked:0,
  expireGood:0,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    cur:0,
    target:5,
    done:false
  },

  mini:{
    // Mini quest แบบ “เติมหมู่ที่ขาด”
    name:'มินิเควส: เติมหมู่ที่ขาด',
    sub:'เก็บเฉพาะหมู่ที่ยังไม่มีให้ครบ ภายใน 12 วิ',
    cur:0,
    target:0, // จะตั้งตอนเริ่ม mini
    done:false,
    active:false,
    timeLeft:0,
    windowSec:12,
    missingMask:[false,false,false,false,false],
    rewardTimeSec:6, // ✅ รางวัลเพิ่มเวลา (เหตุผลของ “ยืดเวลา”)
    rewardScore:250
  },

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawner handle
  engine:null,

  // adaptive knobs (soft)
  baseSpawnRateMs:900,
  curSpawnRateMs:900
};

/* ------------------------------------------------
 * Score / HUD emits
 * ------------------------------------------------ */
function pushScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    shield: STATE.shield
  });
}

function pushShield(){
  emit('hha:shield', { left: STATE.shield });
  pushScore();
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function judge(kind, note=''){
  // kind: good/junk/block/miss/perfect/bonus
  emit('hha:judge', { kind, note, score: STATE.score, combo: STATE.combo, shield: STATE.shield });
}

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  // "good accuracy" = good hits / (good hits + junk hits + good expires)
  const denom = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(denom <= 0) return 1;
  return STATE.hitGood / denom;
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target,
      done: STATE.goal.done
    },
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: Math.max(1, Number(STATE.mini.target)||1),
      done: STATE.mini.done,
      active: STATE.mini.active,
      timeLeft: STATE.mini.timeLeft
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Combo / Score helpers
 * ------------------------------------------------ */
function addScore(v){
  STATE.score = Math.max(-999999, STATE.score + (Number(v)||0));
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
 * Mini quest control
 * ------------------------------------------------ */
function computeMissingMask(){
  const mask = [false,false,false,false,false];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) mask[i] = true;
  }
  return mask;
}

function countMissing(mask){
  let c = 0;
  for(let i=0;i<5;i++) if(mask[i]) c++;
  return c;
}

function startMiniIfEligible(){
  if(STATE.mini.done || STATE.mini.active) return;

  // เริ่ม mini เมื่อผู้เล่นเริ่มมี progress แล้ว (กันเริ่มตั้งแต่ยังไม่เล่น)
  if(STATE.hitGood < 2) return;

  const mask = computeMissingMask();
  const need = countMissing(mask);

  // ถ้าเหลือขาด 0 หรือ 1 หมู่ ก็ไม่ต้อง mini (มันง่ายเกิน)
  if(need <= 1) return;

  STATE.mini.active = true;
  STATE.mini.timeLeft = STATE.mini.windowSec;
  STATE.mini.missingMask = mask;
  STATE.mini.target = need;
  STATE.mini.cur = 0;

  coach('มินิเควสมาแล้ว! เติม “หมู่ที่ขาด” ให้ครบใน 12 วิ ⏱️', 'Mini');
  emitQuest();
}

function tickMini(){
  if(!STATE.mini.active) return;
  STATE.mini.timeLeft = Math.max(0, (STATE.mini.timeLeft||0) - 1);

  if(STATE.mini.timeLeft <= 0){
    // fail mini (ไม่ทำให้จบเกม แค่จบมินิ)
    STATE.mini.active = false;
    coach('มินิเควสหมดเวลา! ไม่เป็นไร ลุยต่อได้ 💪', 'Mini');
    emitQuest();
  }else{
    emitQuest();
  }
}

function miniHit(groupIndex){
  if(!STATE.mini.active) return;
  if(STATE.mini.done) return;

  const gi = clamp(groupIndex, 0, 4);
  if(STATE.mini.missingMask[gi]){
    // ทำหมู่ที่ขาดสำเร็จครั้งแรกของหมู่นั้น
    STATE.mini.missingMask[gi] = false;
    STATE.mini.cur = clamp((STATE.mini.cur||0) + 1, 0, 999);

    judge('bonus', 'เติมหมู่ที่ขาด!');
    emitQuest();

    if(STATE.mini.cur >= STATE.mini.target){
      STATE.mini.done = true;
      STATE.mini.active = false;

      // ✅ Reward: เพิ่มเวลา + คะแนน + (โอกาสได้ Shield 1)
      const addT = Number(STATE.mini.rewardTimeSec)||0;
      if(addT > 0){
        STATE.timeLeft += addT; // <<<<<< เหตุผล “ยืดเวลา”
        emit('hha:time', { leftSec: STATE.timeLeft, bonus:addT });
      }
      addScore(Number(STATE.mini.rewardScore)||0);

      // โบนัส Shield เล็กน้อยให้เด็กเล่นสนุก/รู้สึกปลอดภัย
      STATE.shield = clamp(STATE.shield + 1, 0, 9);
      pushShield();

      coach(`เยี่ยม! มินิเควสผ่าน ✅ +${addT}s +Shield`, 'Mini');
      emitQuest();
    }
  }
}

/* ------------------------------------------------
 * Adaptive (soft)
 * ------------------------------------------------ */
function updateAdaptive(){
  if(!STATE.cfg) return;
  const isStudy = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  if(isStudy) return; // ✅ ปิด adaptive ในวิจัย

  // ปรับเบา ๆ ตาม performance: ถ้าแม่น+คอมโบสูง -> เร่งเล็กน้อย
  const acc = accuracy();          // 0..1
  const c   = STATE.comboMax || 0;

  let rate = STATE.baseSpawnRateMs;
  if(acc >= 0.85 && c >= 6) rate *= 0.85;
  else if(acc >= 0.80 && c >= 4) rate *= 0.90;
  else if(acc <= 0.60) rate *= 1.08;

  STATE.curSpawnRateMs = clamp(rate, 520, 1200);
  if(STATE.engine && typeof STATE.engine.setSpawnRate === 'function'){
    STATE.engine.setSpawnRate(STATE.curSpawnRateMs);
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  STATE.endedAtMs = nowMs();

  clearInterval(STATE.timer);

  const durationPlayedSec = Math.max(0, Math.round((STATE.endedAtMs - STATE.startedAtMs)/1000));

  emit('hha:end', {
    reason,

    // basic
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    // quest
    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    // metrics
    accuracyGoodPct: pct2(accuracy() * 100),
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    hitJunkBlocked: STATE.hitJunkBlocked,
    expireGood: STATE.expireGood,

    // group coverage
    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // timing
    durationPlannedSec: Number(STATE.cfg?.durationPlannedSec)||0,
    durationPlayedSec,

    // context passthrough
    runMode: STATE.cfg?.runMode || '',
    diff: STATE.cfg?.diff || '',
    seed: Number(STATE.cfg?.seed)||0,
    deviceView: STATE.cfg?.view || ''
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

    // ✅ Mini tick
    tickMini();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
      return;
    }

    // ✅ ลองเริ่ม mini หลังผ่านไปนิดนึง (กันขึ้นเร็วเกิน)
    // เริ่มได้ช่วงเวลาเหลือ <= 2/3 ของทั้งหมด
    const planned = Number(STATE.cfg?.durationPlannedSec)||90;
    if(STATE.timeLeft <= Math.round(planned * 0.66)){
      startMiniIfEligible();
    }

    // ✅ adaptive update (soft)
    if((STATE.timeLeft % 3) === 0){
      updateAdaptive();
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateGoalProgress(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v => (v||0) > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi] = (STATE.g[gi] || 0) + 1;

  addCombo();

  // ✅ คะแนน: ให้รู้สึก “เร่งนิด ๆ” ตามคอมโบ
  addScore(100 + Math.min(80, STATE.combo * 6));
  judge('good', 'เก่งมาก!');

  // goal progress
  updateGoalProgress();

  // mini quest progress (เติมหมู่ที่ขาด)
  miniHit(gi);

  // อัปเดต quest
  emitQuest();
}

function onHitJunk(){
  // ✅ Shield block
  if((STATE.shield||0) > 0){
    STATE.shield--;
    STATE.hitJunkBlocked++;
    pushShield();

    resetCombo();
    judge('block', 'Shield กันไว้!');
    coach('Shield กันของทอด/หวานไว้แล้ว 🛡️', 'Shield');

    // blocked junk => NOT miss, NOT hitJunk
    emitQuest();
    return;
  }

  // real junk hit
  STATE.hitJunk++;
  STATE.miss++;          // ✅ miss counts here
  resetCombo();

  addScore(-60);
  judge('junk', 'ของทอด/หวาน!');
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  emitQuest();
}

function onHitShield(){
  // pickup
  STATE.shield = clamp((STATE.shield||0) + 1, 0, 9);
  pushShield();
  addScore(80);
  judge('bonus', '+Shield');
  coach('ได้ Shield! ครั้งหน้าพลาดจะถูกกันไว้ 🛡️', 'Power');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;          // ✅ miss counts here
  resetCombo();
  judge('miss', 'พลาด!');
  emitQuest();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();

  STATE.baseSpawnRateMs = (diff === 'hard') ? 720 : (diff === 'easy' ? 980 : 860);
  STATE.curSpawnRateMs  = STATE.baseSpawnRateMs;

  // โอกาส shield pickup เล็กน้อย
  const shieldW = (diff === 'hard') ? 0.08 : 0.10;

  return spawnBoot({
    mount,

    // IMPORTANT: mode-factory supports seeded RNG by cfg.seed
    seed: Number(STATE.cfg?.seed) || Date.now(),

    // pass view if your mode-factory uses it (safe if ignored)
    view: STATE.cfg?.view || 'pc',

    spawnRate: STATE.curSpawnRateMs,
    sizeRange: [44, 66],

    // Kinds: good/junk/shield
    kinds: [
      { kind:'good',   weight: 0.70 },
      { kind:'junk',   weight: 0.30 - shieldW },
      { kind:'shield', weight: shieldW }
    ],

    // hooks
    onHit:(t)=>{
      if(!t) return;
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? Number(t.groupIndex) : Math.floor(STATE.rng()*5);
        onHitGood(gi);
      }else if(t.kind === 'shield'){
        onHitShield();
      }else{
        onHitJunk();
      }
    },

    onExpire:(t)=>{
      if(t && t.kind === 'good') onExpireGood();
    }
  });
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // cfg
  STATE.cfg = cfg || {};
  const runMode = (STATE.cfg.runMode || 'play').toLowerCase();

  // init
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.shield = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.hitJunkBlocked = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.target = 0;
  STATE.mini.done = false;
  STATE.mini.active = false;
  STATE.mini.timeLeft = 0;
  STATE.mini.missingMask = [false,false,false,false,false];

  // RNG
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(Number(STATE.cfg.seed) || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // Time: default 90 (แต่ boot.js จะส่ง durationPlannedSec มาแล้ว)
  STATE.timeLeft = Number(STATE.cfg.durationPlannedSec) || 90;

  // start times
  STATE.startedAtMs = nowMs();
  STATE.endedAtMs = 0;

  emit('hha:start', {
    game:'plate',
    runMode,
    diff: (STATE.cfg.diff || 'normal'),
    seed: Number(STATE.cfg.seed) || 0,
    durationPlannedSec: STATE.timeLeft,
    view: STATE.cfg.view || 'pc'
  });

  // initial UI
  pushScore();
  pushShield();
  emitQuest();

  // boot spawner
  STATE.engine = makeSpawner(mount);

  // timer
  startTimer();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}