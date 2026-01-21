// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + AI Shadow Pack (A)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (future) / coach tips ON (soft)
//   - research/study: deterministic seed + adaptive OFF + coach tips OFF (predict-only)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ NEW AI PACK (A):
//   ai:features (every 5s), ai:pred (every 5s), ai:coach_tip (optional play only)
//   + bundled into hha:end.detail.aiWindows + aiSummary (so cloud logger that only listens hha:end still captures)
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
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
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return performance && performance.now ? performance.now() : Date.now(); }

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

  // spawn
  engine:null,

  // --- AI window tracking ---
  ai:{
    enabled:true,
    tickMs:5000,            // every 5s
    lastTickMs:0,
    startMs:0,
    // rolling stats for frustration proxy
    missAtLast:0,
    comboAtLast:0,
    // rate limit tips
    lastTipMs:0,
    tipCooldownMs:9000,
    // keep small buffer, send in hha:end
    windows:[],             // [{t, features, pred, tip}]
    maxWindows:32
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
  STATE.score += v;
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
 * AI PACK (A) — features/pred/tip
 * ------------------------------------------------ */
function getRunMode(){
  const rm = (STATE.cfg && STATE.cfg.runMode) ? String(STATE.cfg.runMode).toLowerCase() : 'play';
  return rm;
}
function isResearchMode(){
  const rm = getRunMode();
  return (rm === 'research' || rm === 'study');
}
function timeElapsedSec(){
  const t = (nowMs() - STATE.ai.startMs) / 1000;
  return Math.max(0, t);
}
function goalProgress01(){
  const tar = Math.max(1, Number(STATE.goal.target)||1);
  return clamp((STATE.goal.cur || 0) / tar, 0, 1);
}
function miniProgress01(){
  // mini is accuracy >= target. We use current mini.cur / target
  const tar = Math.max(1, Number(STATE.mini.target)||1);
  return clamp((Number(STATE.mini.cur)||0) / tar, 0, 1);
}
function featuresWindow(){
  const acc = accuracy() * 100;
  const tLeft = Math.max(0, Number(STATE.timeLeft)||0);

  // proxy streak signals
  const missDelta = Math.max(0, STATE.miss - STATE.ai.missAtLast);
  const comboDelta = (STATE.combo - STATE.ai.comboAtLast);

  const f = {
    tSec: Math.round(timeElapsedSec()),
    timeLeftSec: tLeft,

    score: STATE.score,
    comboNow: STATE.combo,
    comboMax: STATE.comboMax,

    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,
    missTotal: STATE.miss,

    missDelta5s: missDelta,        // in last tick window (approx)
    comboDelta5s: comboDelta,

    goalCur: STATE.goal.cur,
    goalTarget: STATE.goal.target,
    goalProgress01: Math.round(goalProgress01()*1000)/1000,

    miniCur: STATE.mini.cur,
    miniTarget: STATE.mini.target,
    miniProgress01: Math.round(miniProgress01()*1000)/1000,

    accPct: Math.round(acc),
    gFilledCount: STATE.g.filter(v=>v>0).length
  };

  // update rolling base
  STATE.ai.missAtLast = STATE.miss;
  STATE.ai.comboAtLast = STATE.combo;

  return f;
}

/**
 * Heuristic predictor (baseline) — deterministic, no ML yet
 * Outputs:
 *  - p_pass (0..1), p_drop (0..1), eta_fail_sec (>=0 or null)
 */
function predictFromFeatures(f){
  // pass: driven by goal progress + time left + accuracy
  const gp = clamp(f.goalProgress01, 0, 1);
  const mp = clamp(f.miniProgress01, 0, 1);

  // urgency factor (less time => harder)
  const urgency = clamp(1 - (f.timeLeftSec / Math.max(1, Number(STATE.cfg.durationPlannedSec)||90)), 0, 1);

  // if already done
  const allDone = (STATE.goal.done && STATE.mini.done);
  if(allDone){
    return { p_pass: 0.999, p_drop: 0.05, eta_fail_sec: null };
  }

  // simple scoring
  let p_pass = 0.25 + 0.45*gp + 0.25*mp - 0.20*urgency;

  // penalty if accuracy is low
  if(f.accPct < 70) p_pass -= 0.12;
  if(f.accPct < 55) p_pass -= 0.18;

  // penalty if frequent misses recently
  if(f.missDelta5s >= 2) p_pass -= 0.10;
  if(f.missDelta5s >= 4) p_pass -= 0.18;

  p_pass = clamp(p_pass, 0.02, 0.98);

  // drop risk: miss bursts + combo collapses + low accuracy late game
  let p_drop = 0.10;
  p_drop += clamp(f.missDelta5s / 6, 0, 0.45);
  if(f.comboNow === 0 && f.comboMax >= 6) p_drop += 0.12;
  if(f.accPct < 65) p_drop += 0.10;
  if(urgency > 0.65 && f.accPct < 70) p_drop += 0.12;

  p_drop = clamp(p_drop, 0.02, 0.95);

  // eta_fail: rough if pass is very low late game
  let eta = null;
  if(p_pass < 0.20 && urgency > 0.55){
    // estimate "time remaining until likely fail": proportional to remaining time
    eta = Math.round(Math.max(3, f.timeLeftSec * 0.6));
  }

  return {
    p_pass: Math.round(p_pass*1000)/1000,
    p_drop: Math.round(p_drop*1000)/1000,
    eta_fail_sec: eta
  };
}

/**
 * tip policy (play only) — explainable & rate-limited
 */
function chooseTip(f, pred){
  // rate limit
  const t = nowMs();
  if(t - STATE.ai.lastTipMs < STATE.ai.tipCooldownMs) return null;

  // do not spam if doing fine
  if(pred.p_drop < 0.35 && pred.p_pass > 0.55) return null;

  // Tip candidates
  // 1) accuracy low
  if(f.accPct < 70){
    return {
      id:'TIP_ACC',
      text:'คุมความแม่นก่อนนะ 🎯 เล็งดี ๆ แล้วค่อยยิง จะผ่านมินิเควสง่ายขึ้น!',
      why:{ accPct:f.accPct }
    };
  }

  // 2) goal not progressing (missing a group)
  if(f.gFilledCount < 5 && f.timeLeftSec < 45){
    return {
      id:'TIP_GROUPS',
      text:'ยังไม่ครบ 5 หมู่ 🍽️ โฟกัสหมู่ที่ยังไม่มีเลยก่อน จะผ่าน Goal ทัน!',
      why:{ gFilledCount:f.gFilledCount, timeLeftSec:f.timeLeftSec }
    };
  }

  // 3) misses burst / drop risk
  if(f.missDelta5s >= 3 || pred.p_drop >= 0.55){
    return {
      id:'TIP_CALM',
      text:'ใจเย็น ๆ 👀 ถ้าเริ่มพลาดรัว ๆ ให้หยุดรีบ เลือกยิงเฉพาะของดีที่ชัด ๆ ก่อน',
      why:{ missDelta5s:f.missDelta5s, p_drop:pred.p_drop }
    };
  }

  // fallback
  if(pred.p_pass < 0.30){
    return {
      id:'TIP_FOCUS',
      text:'โฟกัสภารกิจหลักก่อน ✅ เติมให้ครบ 5 หมู่ แล้วค่อยไล่คะแนนนะ',
      why:{ p_pass:pred.p_pass }
    };
  }

  return null;
}

function emitAI(name, detail){
  // emit as events
  emit(name, detail);
  // optional hook for any external event logger (if later you add one)
  try{
    if(WIN.HHA_EVENT_LOGGER && typeof WIN.HHA_EVENT_LOGGER.log === 'function'){
      WIN.HHA_EVENT_LOGGER.log(name, detail);
    }
  }catch(_){}
}

function aiTick(force=false){
  if(!STATE.running || STATE.ended) return;
  if(!STATE.ai.enabled) return;

  const t = nowMs();
  if(!force && (t - STATE.ai.lastTickMs < STATE.ai.tickMs)) return;
  STATE.ai.lastTickMs = t;

  const f = featuresWindow();
  emitAI('ai:features', f);

  const pred = predictFromFeatures(f);
  emitAI('ai:pred', pred);

  // store window snapshot (bounded)
  const snap = { tSec: f.tSec, features:f, pred, tip:null };
  STATE.ai.windows.push(snap);
  if(STATE.ai.windows.length > STATE.ai.maxWindows) STATE.ai.windows.shift();

  // coach tips: play only
  if(!isResearchMode()){
    const tip = chooseTip(f, pred);
    if(tip){
      STATE.ai.lastTipMs = t;
      snap.tip = tip;
      emitAI('ai:coach_tip', tip);
      // also show to player via existing coach UI
      coach(tip.text, 'AI Coach');
    }
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

  // final AI tick snapshot (force)
  aiTick(true);

  // build ai summary (small)
  const lastWin = STATE.ai.windows.length ? STATE.ai.windows[STATE.ai.windows.length-1] : null;
  const aiSummary = lastWin ? {
    p_pass:lastWin.pred && lastWin.pred.p_pass,
    p_drop:lastWin.pred && lastWin.pred.p_drop,
    eta_fail_sec:lastWin.pred && lastWin.pred.eta_fail_sec,
    lastTipId:lastWin.tip && lastWin.tip.id
  } : null;

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round((accuracy() * 100) * 100) / 100,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],

    // ✅ bundle AI windows into end payload (so existing hha-cloud-logger captures)
    aiWindows: STATE.ai.windows,
    aiSummary
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

    // AI tick schedule (every 5s)
    aiTick(false);

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
  addScore(100 + STATE.combo * 5);

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
  pushScore();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: STATE.cfg.diff === 'hard' ? 700 : 900,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : (Math.floor(STATE.rng()*5));
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

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // AI init
  STATE.ai.startMs = nowMs();
  STATE.ai.lastTickMs = 0;
  STATE.ai.lastTipMs = 0;
  STATE.ai.missAtLast = 0;
  STATE.ai.comboAtLast = 0;
  STATE.ai.windows = [];
  // always collect AI windows, but coach tips only in play
  STATE.ai.enabled = true;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  pushScore();

  // first AI tick right away
  aiTick(true);

  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}