// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------
// ✅ Uses mode-factory boot() (DOM spawner)
// ✅ Play / Research modes
//   - play: adaptive-ish feel + FX ON (A+B+C)
//   - research/study: deterministic seed + FX OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair/tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Summary schema compatible with hha-cloud-logger.js
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};
const round = (v)=> Math.round(Number(v)||0);

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

/* -------------------------------
 * Emoji set (HHA standard-ish)
 * (ไม่เพิ่มชนิดอาหารใหม่ — หมู่ละ 1 emoji)
 * ----------------------------- */
const GROUP_EMOJI = ['🥦','🍎','🐟','🍚','🥑']; // G1..G5
const JUNK_EMOJI  = '🍩'; // junk
const SHIELD_EMOJI= '🛡️'; // optional bonus shield

/* -------------------------------
 * Engine state
 * ----------------------------- */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  g:[0,0,0,0,0],

  hitGood:0,
  hitJunk:0,
  hitShield:0,
  expireGood:0,

  shieldLeft:0, // hits blocked (future hook)
  shieldActive:false,

  // quest
  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  cfg:null,
  rng:Math.random,
  spawner:null,

  // FX flags
  FX:{ bonus:false, trick:false, panic:false }
};

/* -------------------------------
 * Coach (rate-limit เบา ๆ)
 * ----------------------------- */
let lastCoachAt = 0;
function coach(msg, tag='Coach'){
  const now = Date.now();
  if(now - lastCoachAt < 700) return;
  lastCoachAt = now;
  emit('hha:coach', { msg, tag });
}

/* -------------------------------
 * Accuracy
 * ----------------------------- */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function accPct(){
  return clamp(Math.round(accuracy()*100), 0, 100);
}

/* -------------------------------
 * Quest update
 * ----------------------------- */
function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* -------------------------------
 * Score helpers
 * ----------------------------- */
function pushScore(){
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}

function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){
  STATE.combo = 0;
}

function addScore(v){
  STATE.score = Math.max(0, STATE.score + Number(v||0));
  pushScore();
}

/* -------------------------------
 * End game
 * ----------------------------- */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  try{ clearInterval(STATE.timer); }catch(_){}
  try{ STATE.spawner?.stop?.(); }catch(_){}

  const a = accPct();

  emit('hha:end', {
    projectTag:'herohealth',
    game:'plate',
    gameVersion: STATE.cfg?.gameVersion || '',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed ?? '',
    durationPlannedSec: STATE.cfg?.durationPlannedSec ?? 0,
    durationPlayedSec: (STATE.cfg?.durationPlannedSec ?? 0) - Math.max(0, STATE.timeLeft),

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: a,

    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nHitShield: STATE.hitShield,
    nExpireGood: STATE.expireGood,

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],
    gTotal: STATE.g.reduce((s,v)=>s+v,0),

    reason
  });
}

/* -------------------------------
 * Timer
 * ----------------------------- */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // PANIC: 12s สุดท้าย (เฉพาะ play + plate)
    if(STATE.FX.panic && STATE.timeLeft === 12){
      try{
        STATE.spawner?.setRate?.(Math.max(400, STATE.cfg.spawnRateMs * 0.7));
      }catch(_){}
      coach('⚠️ PANIC! ช่วงท้ายแล้ว เร็วขึ้นนิดนึง!', 'System');
      // ใส่ class fx ถ้ามี (plate-vr.css มี bossFx/stormFx แต่เราไม่ใช้ก็ได้)
      try{ DOC.body.classList.add('plate-panic'); }catch(_){}
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* -------------------------------
 * Hit handlers
 * ----------------------------- */
function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();

  // คะแนน: base + combo bonus
  addScore(90 + STATE.combo*6);

  // goal: unique groups count
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini: accuracy
  const a = accPct();
  STATE.mini.cur = a;
  if(!STATE.mini.done && a >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;

  resetCombo();
  // โทษ: ลดคะแนนเล็กน้อยแต่ไม่ติดลบ
  addScore(-60);

  // mini อาจตก
  STATE.mini.cur = accPct();
  emitQuest();

  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onHitShield(){
  STATE.hitShield++;
  STATE.shieldLeft = Math.min(3, STATE.shieldLeft + 1);
  coach('ได้โล่! 🛡️', 'Power');
  pushScore();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();

  // ไม่ต้อง coach บ่อย
  STATE.mini.cur = accPct();
  emitQuest();
}

/* -------------------------------
 * Target element generator (หน้าตาแบบภาพ)
 * ----------------------------- */
function makeTargetEl(kind, sizePx){
  const el = DOC.createElement('div');
  el.className = 'plateTarget';
  el.dataset.kind = kind;

  // emoji
  if(kind === 'junk'){
    el.textContent = JUNK_EMOJI;
  }else if(kind === 'shield'){
    el.textContent = SHIELD_EMOJI;
  }else{
    // good: groupIndex จะถูก set ใน mode-factory ก่อนเรียก onHit (ผ่าน dataset)
    // แต่ตอน makeEl ยังไม่รู้ -> ใส่ placeholder แล้วค่อยอัปเดตหลัง mount
    el.textContent = '🍽️';
  }

  // BONUS/TRICK (เฉพาะ play)
  // โยน class ไว้ก่อน แล้ว mode-factory จะ position ให้
  if(STATE.FX.bonus && STATE.rng() < 0.15){
    el.classList.add('fx-bonus');
  }
  if(STATE.FX.trick && STATE.timeLeft < 60){
    el.classList.add('fx-trick');
  }

  // เพิ่มความคมชัด
  el.style.fontSize = (sizePx >= 60) ? '30px' : (sizePx >= 50 ? '28px' : '26px');
  return el;
}

/* -------------------------------
 * Spawn / Spawner config
 * ----------------------------- */
function buildSpawner(mount){
  const diff = STATE.cfg.diff || 'normal';

  // rate base
  const baseRate =
    diff === 'hard' ? 700 :
    diff === 'easy' ? 980 : 860;

  // ให้ store ไว้ เผื่อ PANIC ปรับ
  STATE.cfg.spawnRateMs = baseRate;

  // น้ำหนัก junk ตาม diff
  const junkW =
    diff === 'hard' ? 0.36 :
    diff === 'easy' ? 0.24 : 0.30;

  // shield เป็น BONUS นิด ๆ (เฉพาะ play)
  const shieldW = (STATE.cfg.runMode === 'play') ? 0.06 : 0.0;

  const kinds = [
    { kind:'good', weight: 1 - junkW - shieldW },
    { kind:'junk', weight: junkW },
  ];
  if(shieldW > 0) kinds.push({ kind:'shield', weight: shieldW });

  const sp = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    rng: STATE.rng,

    spawnRate: baseRate,
    maxAlive: diff === 'hard' ? 11 : 10,
    sizeRange: diff === 'hard' ? [44, 64] : [46, 66],

    kinds,

    makeEl: (kind, size)=> makeTargetEl(kind, size),

    onHit: (t)=>{
      if(t.kind === 'good'){
        // groupIndex มาจาก mode-factory dataset หรือสุ่ม fallback
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        onHitGood(gi);

        // update emoji ให้ตรงหมู่ (หลังรู้ gi)
        try{
          if(t.el) t.el.textContent = GROUP_EMOJI[clamp(gi,0,4)];
        }catch(_){}
      }else if(t.kind === 'shield'){
        onHitShield();
      }else{
        onHitJunk();
      }
    },

    onExpire: (t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });

  return sp;
}

/* -------------------------------
 * Main boot
 * ----------------------------- */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

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
  STATE.hitShield = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  // mode
  const runMode = (cfg.runMode || 'play').toLowerCase();
  const isResearch = (runMode === 'research' || runMode === 'study');

  // RNG
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // FX flags (A+B+C)
  STATE.FX = {
    bonus: (!isResearch),
    trick: (!isResearch),
    panic: (!isResearch) // เฉพาะ plate อยู่แล้ว (ไฟล์นี้คือ plate)
  };

  // time
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    projectTag:'herohealth',
    game:'plate',
    runMode,
    diff: cfg.diff || 'normal',
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    device: cfg.view || '',
    gameVersion: cfg.gameVersion || ''
  });

  // UI init
  pushScore();
  emitQuest();
  emit('hha:time', { leftSec: STATE.timeLeft });

  // start
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // spawner
  STATE.spawner = buildSpawner(mount);

  // timer
  startTimer();
}