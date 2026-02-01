// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + UI Feedback + AI-lite Prediction (Explainable)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON + Storm/Boss ON + AI Coach ON
//   - research/study: deterministic seed + adaptive OFF + no Storm/Boss + AI Coach minimal
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji, labelForGroup } from '../vr/food5-th.js';

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const WIN = window;
const DOC = document;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function isResearch(){
  return (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
}

function setStormFx(on){
  const el = DOC.getElementById('stormFx');
  if(!el) return;
  el.classList.toggle('storm-on', !!on);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function setBossFx(on, panic=false){
  const el = DOC.getElementById('bossFx');
  if(!el) return;
  el.classList.toggle('boss-on', !!on);
  el.classList.toggle('boss-panic', !!panic);
  el.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function setSpawnSafePadding(px){
  const v = `${Math.max(0, Math.round(Number(px)||0))}px`;
  const root = DOC.documentElement;
  if(!root) return;
  root.style.setProperty('--plate-top-safe', v);
  root.style.setProperty('--plate-bottom-safe', v);
  root.style.setProperty('--plate-left-safe', v);
  root.style.setProperty('--plate-right-safe', v);
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function judge(type, msg, meta={}){
  emit('hha:judge', { type, msg, ...meta });
}

function popText(x, y, text, cls=''){
  try{
    const P = WIN.Particles;
    if(!P || typeof P.popText !== 'function') return;
    const px = isFinite(Number(x)) ? Number(x) : Math.round(innerWidth*0.5);
    const py = isFinite(Number(y)) ? Number(y) : Math.round(innerHeight*0.35);
    P.popText(Math.round(px), Math.round(py), text, cls);
  }catch{}
}

/* ------------------------------------------------
 * AI-lite predictor (Explainable, rate-limited)
 * ------------------------------------------------ */
const AI = {
  lastCoachAt: 0,
  cooldownMs: 2800,
  // simple counters
  missByGroup: [0,0,0,0,0],
  hitByGroup: [0,0,0,0,0],
  junkHits: 0,
  expiredGood: 0,
  suggestCount: 0,

  reset(){
    this.lastCoachAt = 0;
    this.missByGroup = [0,0,0,0,0];
    this.hitByGroup = [0,0,0,0,0];
    this.junkHits = 0;
    this.expiredGood = 0;
    this.suggestCount = 0;
  },

  maybeCoach(reason){
    if(isResearch()) return; // keep research cleaner
    const t = nowMs();
    if(t - this.lastCoachAt < this.cooldownMs) return;

    // 1) if missing groups exist, push that first
    const missing = [];
    for(let i=0;i<5;i++) if((STATE.g[i]||0) <= 0) missing.push(i);
    if(missing.length){
      const gi = missing[0];
      this.lastCoachAt = t;
      this.suggestCount++;
      coach(`ลองโฟกัส “${labelForGroup(gi+1)}” ก่อนนะ (ยังขาดอยู่)`, 'AI');
      return;
    }

    // 2) highlight most-missed group
    let worst = -1, worstV = 0;
    for(let i=0;i<5;i++){
      const v = this.missByGroup[i] || 0;
      if(v > worstV){ worstV = v; worst = i; }
    }
    if(worst >= 0 && worstV >= 2){
      this.lastCoachAt = t;
      this.suggestCount++;
      coach(`AI เห็นว่าพลาด “${labelForGroup(worst+1)}” บ่อย ลองช้าลงนิด + เล็งกลางเป้า`, 'AI');
      return;
    }

    // 3) too much junk
    if(this.junkHits >= 3){
      this.lastCoachAt = t;
      this.suggestCount++;
      coach('AI เตือน: ช่วงนี้โดนของหวาน/ทอดบ่อย ลองรอ “ของดี” แล้วค่อยยิง', 'AI');
      return;
    }

    // fallback: don’t spam
    if(reason && this.suggestCount < 2){
      this.lastCoachAt = t;
      this.suggestCount++;
      coach(reason, 'AI');
    }
  }
};

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
  spawner:null,

  // Boss
  bossOn:false,
  bossDone:false,
  bossEndsAt:0,
  bossPerGroupTarget:2,
  bossDurationMs:12000,
  bossTimeBonusSec:10,

  // Storm
  stormOn:false,
  stormEndsAt:0,
  stormDurationMs:8000,
  stormEverySec:22,
  stormNextAtSec:0
};

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
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

/* ------------------------------------------------
 * Accuracy
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Quest update
 * ------------------------------------------------ */
function bossProgressCount(){
  const t = STATE.bossPerGroupTarget;
  let ok = 0;
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) >= t) ok++;
  }
  return ok;
}

function emitQuest(){
  const goal = (STATE.bossOn && !STATE.bossDone)
    ? {
        name: '👾 BOSS: ทำให้ “บาลานซ์”',
        sub: `เติมแต่ละหมู่ ≥ ${STATE.bossPerGroupTarget}`,
        cur: bossProgressCount(),
        target: 5
      }
    : {
        name: STATE.goal.name,
        sub: STATE.goal.sub,
        cur: STATE.goal.cur,
        target: STATE.goal.target
      };

  emit('quest:update', {
    goal,
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: (STATE.goal.done && STATE.mini.done) || (STATE.bossDone && STATE.mini.done)
  });
}

/* ------------------------------------------------
 * Spawner control
 * ------------------------------------------------ */
function stopSpawner(){
  if(STATE.spawner && typeof STATE.spawner.stop === 'function'){
    try{ STATE.spawner.stop(); }catch{}
  }
  STATE.spawner = null;
}

function restartSpawner(mount){
  stopSpawner();
  STATE.spawner = makeSpawner(mount);
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  stopSpawner();

  setBossFx(false,false);
  setStormFx(false);
  setSpawnSafePadding(0);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: (STATE.goal.done || STATE.bossDone) ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Boss
 * ------------------------------------------------ */
function startBoss(mount){
  if(isResearch()) return;
  if(STATE.bossOn || STATE.bossDone) return;

  STATE.bossOn = true;
  STATE.bossEndsAt = nowMs() + STATE.bossDurationMs;

  setBossFx(true,false);
  coach('👾 บอสมาแล้ว! เติมแต่ละหมู่ให้ได้อย่างน้อย 2 ชิ้น!', 'Boss');
  judge('BOSS','เริ่มบอส!', { stage:'boss' });

  restartSpawner(mount);
  emitQuest();
}

function clearBoss(){
  if(!STATE.bossOn || STATE.bossDone) return;

  STATE.bossDone = true;
  STATE.bossOn = false;
  setBossFx(false,false);

  STATE.timeLeft += STATE.bossTimeBonusSec;
  addScore(350);

  coach(`ผ่านบอส! +${STATE.bossTimeBonusSec} วิ ⏱️`, 'Boss');
  judge('CLEAR',`ผ่านบอส +${STATE.bossTimeBonusSec}s`, { stage:'boss' });

  emitQuest();
}

/* ------------------------------------------------
 * Storm
 * ------------------------------------------------ */
function startStorm(mount){
  if(isResearch()) return;
  if(STATE.stormOn) return;
  if(STATE.bossOn && !STATE.bossDone) return;

  STATE.stormOn = true;
  STATE.stormEndsAt = nowMs() + STATE.stormDurationMs;

  setStormFx(true);
  setSpawnSafePadding(24);

  coach('🌪️ STORM! เป้าไวขึ้น—ตั้งใจนะ!', 'Storm');
  judge('STORM','STORM!', { stage:'storm' });

  restartSpawner(mount);
}

function clearStorm(mount){
  if(!STATE.stormOn) return;

  STATE.stormOn = false;
  setStormFx(false);
  setSpawnSafePadding(0);

  coach('พายุจบแล้ว! ไปต่อ 👊', 'Storm');
  judge('OK','พายุจบ', { stage:'storm' });

  restartSpawner(mount);
}

/* ------------------------------------------------
 * Decorate target (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  if(target.kind === 'junk'){
    el.textContent = pickEmoji(target.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    return;
  }
  const gid = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  el.textContent = emojiForGroup(target.rng, gid);
  el.dataset.group = String(gid);
  el.title = labelForGroup(gid);
}

/* ------------------------------------------------
 * Choose group index (guarantee 5 groups achievable)
 * ------------------------------------------------ */
function chooseGoodGroupIndex(rng){
  // ✅ guarantee missing groups first
  const missing = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) missing.push(i);
  }
  if(missing.length){
    return missing[Math.floor(rng() * missing.length)];
  }

  // boss bias: fill groups below target
  if(STATE.bossOn && !STATE.bossDone){
    const need = [];
    const t = STATE.bossPerGroupTarget;
    for(let i=0;i<5;i++){
      if((STATE.g[i]||0) < t) need.push(i);
    }
    if(need.length) return need[Math.floor(rng()*need.length)];
  }

  return Math.floor(rng()*5);
}

/* ------------------------------------------------
 * Spawn factory
 * ------------------------------------------------ */
function makeSpawner(mount){
  const hard = STATE.cfg.diff === 'hard';

  const baseRate  = hard ? 680 : 880;
  const stormRate = hard ? 520 : 640;
  const bossRate  = hard ? 520 : 620;

  let rate = baseRate;
  if(!isResearch() && STATE.bossOn && !STATE.bossDone) rate = bossRate;
  else if(!isResearch() && STATE.stormOn) rate = stormRate;

  const baseJunk  = hard ? 0.32 : 0.28;
  const stormJunk = hard ? 0.42 : 0.36;
  const bossJunk  = hard ? 0.40 : 0.36;

  let jw = baseJunk;
  if(!isResearch() && STATE.bossOn && !STATE.bossDone) jw = bossJunk;
  else if(!isResearch() && STATE.stormOn) jw = stormJunk;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:1 - jw },
      { kind:'junk', weight:jw }
    ],
    decorateTarget,

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = chooseGoodGroupIndex(t.rng || STATE.rng);
        onHitGood(gi, t, mount);
      }else{
        onHitJunk(t);
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood(t);
    },

    // shoot tuning (optional)
    shootLockPx: 28,
    shootCooldownMs: 90,
    safeVarPrefix: '--plate'
  });
}

/* ------------------------------------------------
 * UI feedback scoring multipliers
 * ------------------------------------------------ */
function currentMultiplier(){
  let m = 1;

  // combo gives small lift
  m += Math.min(0.6, (STATE.combo * 0.03)); // up to +0.6

  // storm/boss are exciting: give extra
  if(STATE.stormOn) m += 0.25;
  if(STATE.bossOn && !STATE.bossDone) m += 0.35;

  return m;
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function onHitGood(groupIndex, t, mount){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  AI.hitByGroup[groupIndex]++;

  addCombo();

  // base score
  const base = 100 + STATE.combo * 5;
  const mult = currentMultiplier();
  addScore(Math.round(base * mult));

  popText(t?.x, t?.y, `+${Math.round(base*mult)}`, 'good');
  judge('GOOD', 'ถูก!', { x:t?.x, y:t?.y, group: groupIndex+1 });

  // goal progress
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🎉', 'Goal');
      judge('PERFECT','ครบ 5 หมู่!', { stage:'goal' });

      // trigger boss (play only)
      startBoss(mount);
    }
  }

  // mini (accuracy)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Mini');
    judge('BONUS','ความแม่นถึงเป้า!', { stage:'mini' });

    // tiny time bonus makes it feel rewarding
    if(!isResearch()){
      STATE.timeLeft += 4;
      popText(innerWidth*0.5, innerHeight*0.25, '+4s', 'good');
    }
  }

  // boss clear check
  if(STATE.bossOn && !STATE.bossDone){
    if(bossProgressCount() >= 5){
      clearBoss();
    }
  }

  emitQuest();

  // AI coach hint occasionally
  if(!isResearch() && (STATE.hitGood % 6 === 0)){
    AI.maybeCoach('');
  }
}

function onHitJunk(t){
  STATE.hitJunk++;
  STATE.miss++;
  AI.junkHits++;

  resetCombo();
  addScore(-50);

  popText(t?.x, t?.y, '-50', 'bad');
  judge('OOPS', 'ของหวาน/ทอด!', { x:t?.x, y:t?.y });

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Warn');

  AI.maybeCoach('ลองรอของดีชัด ๆ แล้วค่อยยิงนะ');
}

function onExpireGood(t){
  STATE.expireGood++;
  STATE.miss++;

  // guess group (if available)
  const gi = clamp(t?.groupIndex ?? 0, 0, 4);
  AI.missByGroup[gi]++;

  resetCombo();

  judge('MISS', 'พลาด!', {});
  AI.maybeCoach('');
}

/* ------------------------------------------------
 * Timer loop
 * ------------------------------------------------ */
function startTimer(mount){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // boss panic last 3 sec
    if(STATE.bossOn && !STATE.bossDone){
      const left = STATE.bossEndsAt - nowMs();
      setBossFx(true, left <= 3000);
      if(left <= 0){
        // boss ends
        STATE.bossOn = false;
        setBossFx(false,false);
        coach('บอสจบเวลา! ลองใหม่อีกรอบนะ 😆', 'Boss');
        emitQuest();
        restartSpawner(mount);
      }
    }

    // storm end
    if(STATE.stormOn){
      const left = STATE.stormEndsAt - nowMs();
      if(left <= 0) clearStorm(mount);
    }

    // storm schedule (play only)
    if(!isResearch() && !STATE.stormOn && !STATE.bossOn){
      const elapsed = (STATE.cfg.durationPlannedSec - STATE.timeLeft);
      if(elapsed >= STATE.stormNextAtSec){
        startStorm(mount);
        STATE.stormNextAtSec = elapsed + STATE.stormEverySec;
      }
    }

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
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

  // Boss reset
  STATE.bossOn = false;
  STATE.bossDone = false;
  STATE.bossEndsAt = 0;
  setBossFx(false,false);

  // Storm reset
  STATE.stormOn = false;
  STATE.stormEndsAt = 0;
  setStormFx(false);
  setSpawnSafePadding(0);
  STATE.stormNextAtSec = 14;

  // AI reset
  AI.reset();

  // RNG
  STATE.rng = isResearch() ? seededRng(cfg.seed || Date.now()) : Math.random;

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();

  // spawner
  STATE.spawner = makeSpawner(mount);

  // timer
  startTimer(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'System');
}