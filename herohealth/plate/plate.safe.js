// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (สปีด/สัดส่วน/TTL ปรับตามฟอร์มผู้เล่นแบบ "สนุก-ท้าทาย-ยุติธรรม")
//   - research/study: deterministic seed + adaptive OFF (คงที่เพื่อวิจัย)
// ✅ Uses: mode-factory.js (decorateTarget + hha:shoot)
// ✅ Uses: food5-th.js (emoji ตามหมู่ 1–5 แบบไม่แปลผัน)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End game: stop spawner (กันเป้าแว๊บ ๆ หลังจบ)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;

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

/* ------------------------------------------------
 * Engine state
 * ------------------------------------------------ */
const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // miss definition (Plate): hitJunk + expireGood
  miss:0,

  timeLeft:0,
  timer:null,

  // food groups collected (ไทย 5 หมู่)
  // g[0]=หมู่1, g[1]=หมู่2, ...
  g:[0,0,0,0,0],

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

  // cfg + rng
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null,

  // adaptive knobs (play mode only)
  adapt:{
    spawnRateMs: 900,
    goodWeight: 0.72,
    ttlGoodMs: 2100,
    ttlJunkMs: 1700,
    sizeMin: 44,
    sizeMax: 64
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
 * Score + combo
 * ------------------------------------------------ */
function pushScoreEvent(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function addScore(v){
  STATE.score += Number(v)||0;
  pushScoreEvent();
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
  // accuracyGood = goodHit / (goodHit + junkHit + goodExpire)
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function accPct(){
  return Math.round(accuracy() * 100);
}

/* ------------------------------------------------
 * Adaptive difficulty (PLAY only)
 * ------------------------------------------------ */
function isResearchMode(){
  const m = (STATE.cfg?.runMode || 'play').toLowerCase();
  return (m === 'research' || m === 'study');
}

function applyAdaptiveTuning(){
  if(isResearchMode()) return; // ✅ OFF for research

  // เป้าหมาย: ป.5 สนุก ไม่โหดเกิน แต่ให้ท้าทาย
  // ใช้สัญญาณง่าย ๆ: accuracy + combo
  const a = accPct();
  const c = STATE.comboMax;

  // 1) spawnRate: คนเก่ง -> เร็วขึ้นนิด, คนพลาดเยอะ -> ช้าลงนิด
  // (คุมเพดานไว้)
  let sr = STATE.adapt.spawnRateMs;

  if(a >= 85 && c >= 8) sr -= 40;
  else if(a >= 80) sr -= 20;
  else if(a <= 60) sr += 35;
  else if(a <= 70) sr += 15;

  STATE.adapt.spawnRateMs = clamp(sr, 620, 1100);

  // 2) good/junk weight: ถ้าเริ่มพลาดเยอะ ลด junk ลงนิดเพื่อไม่ให้ท้อ
  let gw = STATE.adapt.goodWeight;
  if(a <= 65) gw += 0.02;
  else if(a >= 85) gw -= 0.015;

  STATE.adapt.goodWeight = clamp(gw, 0.62, 0.78);

  // 3) TTL: คนเก่ง -> เป้าหมดไวขึ้นนิด, คนยังไม่คล่อง -> อยู่ให้นานขึ้นนิด
  let tg = STATE.adapt.ttlGoodMs;
  let tj = STATE.adapt.ttlJunkMs;

  if(a >= 85 && c >= 10){ tg -= 60; tj -= 40; }
  else if(a <= 65){ tg += 70; tj += 40; }

  STATE.adapt.ttlGoodMs = clamp(tg, 1600, 2500);
  STATE.adapt.ttlJunkMs = clamp(tj, 1200, 2100);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;

  // ✅ STOP SPAWNER to prevent "flash targets" after end
  try{ STATE.spawner?.stop?.(); }catch(_){}
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

    accuracyGoodPct: accPct(),

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

    // อัปเดต adaptive เป็นช่วง ๆ (กันแกว่ง)
    if(!isResearchMode() && (STATE.timeLeft % 5 === 0)){
      applyAdaptiveTuning();
      // NOTE: spawnRate/weights/ttl จะถูกใช้รอบ "สร้าง spawner ใหม่" เท่านั้น
      // ในเวอร์ชันนี้ เราทำให้มันเนียนโดย "รีสตาร์ทสปอว์นเนอร์แบบปลอดภัย" เบา ๆ
      restartSpawnerSoft();
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Judge FX hook (optional)
 * ------------------------------------------------ */
function judge(type, extra={}){
  // type: 'good' | 'junk' | 'goal' | 'mini'
  emit('hha:judge', { type, ...extra });
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex0to4){
  STATE.hitGood++;
  const gi = clamp(groupIndex0to4, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal: count distinct groups collected
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      judge('goal', { ok:true });
    }
  }

  // mini: accuracy
  const a = accPct();
  STATE.mini.cur = a;
  if(!STATE.mini.done && a >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
    judge('mini', { ok:true });
  }

  judge('good', { groupId: gi+1 });
  emitQuest();
  pushScoreEvent();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;           // miss includes junk hit
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  judge('junk', { ok:false });
  pushScoreEvent();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;           // miss includes good expired
  resetCombo();
  pushScoreEvent();
}

/* ------------------------------------------------
 * Target decoration (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.groupIndex = 0..4  -> groupId 1..5
  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);

  if(target.kind === 'good'){
    const em = emojiForGroup(target.rng || STATE.rng, groupId);
    el.textContent = em;
    el.dataset.group = String(groupId);
    // tooltip (optional)
    try{
      const g = FOOD5[groupId];
      el.title = g ? `${g.labelTH} • ${g.descTH}` : 'อาหารหลัก 5 หมู่';
    }catch(_){}
  }else{
    const em = pickEmoji(target.rng || STATE.rng, JUNK.emojis);
    el.textContent = em;
    el.dataset.group = 'junk';
    try{ el.title = `${JUNK.labelTH} • ${JUNK.descTH}`; }catch(_){}
  }
}

/* ------------------------------------------------
 * Spawner (create / restart)
 * ------------------------------------------------ */
function makeSpawner(mount){
  // spawn profile: research = fixed, play = adaptive
  const research = isResearchMode();

  const spawnRate = research
    ? (STATE.cfg?.diff === 'hard' ? 720 : 900)
    : STATE.adapt.spawnRateMs;

  const sizeRange = research
    ? [44, 64]
    : [STATE.adapt.sizeMin, STATE.adapt.sizeMax];

  const goodW = research ? 0.70 : STATE.adapt.goodWeight;
  const junkW = clamp(1 - goodW, 0.22, 0.38);

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,

    spawnRate,
    sizeRange,

    ttlGoodMs: research ? 2100 : STATE.adapt.ttlGoodMs,
    ttlJunkMs: research ? 1700 : STATE.adapt.ttlJunkMs,

    kinds:[
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],

    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'good'){
        // groupIndex is already 0..4 from mode-factory
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

function restartSpawnerSoft(){
  // เฉพาะ play mode และตอนเกมยังรันอยู่: รีเฟรชโปรไฟล์สปอว์นแบบนุ่ม ๆ
  if(isResearchMode()) return;
  if(!STATE.running || STATE.ended) return;
  if(!STATE.cfg?.mountEl) return;

  // stop เดิม + สร้างใหม่ (ปลอดภัย)
  try{ STATE.spawner?.stop?.(); }catch(_){}
  STATE.spawner = makeSpawner(STATE.cfg.mountEl);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // stop previous if any
  try{ STATE.spawner?.stop?.(); }catch(_){}
  STATE.spawner = null;

  // set cfg
  STATE.cfg = cfg || {};
  STATE.cfg.mountEl = mount;

  STATE.running = true;
  STATE.ended = false;

  // reset counters
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

  // RNG
  if(isResearchMode()){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // initial adaptive defaults (play only)
  STATE.adapt.spawnRateMs = (cfg.diff === 'hard') ? 780 : (cfg.diff === 'easy' ? 980 : 900);
  STATE.adapt.goodWeight  = 0.72;
  STATE.adapt.ttlGoodMs   = 2100;
  STATE.adapt.ttlJunkMs   = 1700;
  STATE.adapt.sizeMin     = 44;
  STATE.adapt.sizeMax     = 64;

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

  // spawn
  STATE.spawner = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // safety: if tab hidden and game ended already, no action needed
  // (keep minimal; researcher can add pause/resume later)
}