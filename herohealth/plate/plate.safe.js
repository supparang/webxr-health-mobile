// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — LATEST
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (dynamic spawn + junk weight + storm/boss spice)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Uses mode-factory.js decorateTarget(el,target)
// ✅ Emoji mapping: Thai 5 Food Groups (food5-th.js) + JUNK
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ End game: stop spawner (no "blink targets")
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji, labelForGroup } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function ensureFxLayer(id){
  let el = DOC.getElementById(id);
  if(el) return el;
  el = DOC.createElement('div');
  el.id = id;
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '55';
  el.style.display = 'none';
  DOC.body.appendChild(el);
  return el;
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

  // groups 1..5
  g:[0,0,0,0,0], // index 0-4 -> groupId 1-5

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

  // spawner controller
  spawner:null,

  // adaptive (play only)
  adaptiveOn:false,
  baseSpawnRate:900,
  curSpawnRate:900,
  junkWeightBase:0.30,
  junkWeightCur:0.30,
  adaptTimer:null,

  // phases
  stormOn:false,
  bossOn:false,
  bossPanic:false,
  missStreak:0,

  // fx dom
  bossFx:null,
  stormFx:null
};

/* ------------------------------------------------
 * Quest + coach
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Score / accuracy
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

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * FX phases (Storm/Boss)
 * ------------------------------------------------ */
function setStorm(on){
  STATE.stormOn = !!on;
  if(!STATE.stormFx) STATE.stormFx = ensureFxLayer('stormFx');
  if(on){
    STATE.stormFx.style.display = 'block';
    STATE.stormFx.classList.add('storm-on');
  }else{
    STATE.stormFx.classList.remove('storm-on');
    STATE.stormFx.style.display = 'none';
  }
}

function setBoss(on){
  STATE.bossOn = !!on;
  if(!STATE.bossFx) STATE.bossFx = ensureFxLayer('bossFx');
  if(on){
    STATE.bossFx.style.display = 'block';
    STATE.bossFx.classList.add('boss-on');
  }else{
    STATE.bossFx.classList.remove('boss-on','boss-panic');
    STATE.bossFx.style.display = 'none';
  }
}

function setBossPanic(on){
  STATE.bossPanic = !!on;
  if(!STATE.bossFx) return;
  if(on) STATE.bossFx.classList.add('boss-panic');
  else STATE.bossFx.classList.remove('boss-panic');
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function stopSpawner(){
  try{ STATE.spawner && STATE.spawner.stop && STATE.spawner.stop(); }catch{}
  STATE.spawner = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  clearInterval(STATE.timer);
  clearInterval(STATE.adaptTimer);
  STATE.timer = null;
  STATE.adaptTimer = null;

  // ✅ IMPORTANT: stop spawner so targets don't "blink" after end overlay
  stopSpawner();

  // stop FX
  setStorm(false);
  setBoss(false);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracy() * 100),

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

    // playful phases (play only)
    if(STATE.adaptiveOn){
      // Storm: last 22s
      if(!STATE.stormOn && STATE.timeLeft <= 22){
        setStorm(true);
        coach('พายุมาแล้ว! เร่งมือหน่อย 🌪️', 'Coach');
      }
      // Boss: last 12s
      if(!STATE.bossOn && STATE.timeLeft <= 12){
        setBoss(true);
        coach('โหมดท้ายเกม! โฟกัสให้แม่น 🟣', 'Coach');
      }
    }

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------------------------------
 * Decorate target (emoji + group tag)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  // target.kind: good/junk
  // target.groupIndex: 0..4 (assigned in mode-factory)
  if(!el || !target) return;

  el.innerHTML = '';
  el.style.position = 'fixed'; // mode-factory uses left/top (viewport)
  el.style.display = 'grid';
  el.style.placeItems = 'center';

  if(target.kind === 'junk'){
    const emo = pickEmoji(target.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.groupId = 'junk';
    el.title = `${JUNK.labelTH} • ${JUNK.descTH}`;
    return;
  }

  const groupId = clamp((target.groupIndex ?? 0) + 1, 1, 5);
  el.dataset.groupId = String(groupId);

  const emo = emojiForGroup(target.rng, groupId);
  el.textContent = emo;

  // tooltip = ช่วยเด็กจำ
  const g = FOOD5[groupId];
  el.title = g ? `${g.labelTH} • ${g.descTH}` : labelForGroup(groupId);
}

/* ------------------------------------------------
 * Adaptive director (play only)
 * ------------------------------------------------ */
function computeAdaptive(){
  // signals
  const acc = accuracy();                 // 0..1
  const miss = STATE.miss;                // int
  const combo = STATE.comboMax;           // int
  const left = STATE.timeLeft;            // sec

  // base difficulty by diff
  let base = 900;
  if(STATE.cfg.diff === 'easy') base = 980;
  if(STATE.cfg.diff === 'hard') base = 780;

  // “fun pressure” curve: tighten near end
  const endBoost = (left <= 25) ? 0.85 : 1.0;

  // adjust: if player is very accurate, increase speed; if struggling, ease a bit
  let k = 1.0;
  if(acc >= 0.86) k *= 0.80;
  else if(acc >= 0.78) k *= 0.90;
  else if(acc <= 0.60) k *= 1.15;

  // combo reward -> more pace
  if(combo >= 12) k *= 0.88;

  // miss penalty -> slow down slightly
  if(miss >= 8) k *= 1.10;

  // storm/boss spice
  if(STATE.stormOn) k *= 0.88;
  if(STATE.bossOn)  k *= 0.82;

  const spawnRate = clamp(base * k * endBoost, 520, 1100);

  // junk weight
  let jw = 0.30;
  if(STATE.cfg.diff === 'easy') jw = 0.25;
  if(STATE.cfg.diff === 'hard') jw = 0.34;

  if(acc >= 0.86) jw += 0.04;
  if(acc <= 0.60) jw -= 0.05;
  if(STATE.stormOn) jw += 0.05;
  if(STATE.bossOn)  jw += 0.05;

  jw = clamp(jw, 0.18, 0.48);

  return { spawnRate: Math.round(spawnRate), junkWeight: Number(jw.toFixed(2)) };
}

function restartSpawnerWith(rate, junkWeight, mount){
  // stop old
  stopSpawner();

  // build kinds
  const kinds = [
    { kind:'good', weight: Math.max(0.01, 1 - junkWeight) },
    { kind:'junk', weight: Math.max(0.01, junkWeight) }
  ];

  STATE.curSpawnRate = rate;
  STATE.junkWeightCur = junkWeight;

  // (optional) emit judge info (for UI/log)
  emit('hha:judge', {
    spawnRateMs: rate,
    junkWeight,
    stormOn: STATE.stormOn,
    bossOn: STATE.bossOn
  });

  // start new spawner
  STATE.spawner = spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: rate,
    sizeRange: (STATE.bossOn ? [52,74] : [44,64]),
    kinds,
    decorateTarget, // ✅ emoji/icons
    onHit:(t)=>handleHit(t),
    onExpire:(t)=>handleExpire(t)
  });
}

function startAdaptiveLoop(mount){
  // refresh every ~1.2s (smooth but not too heavy)
  const apply = ()=>{
    if(!STATE.running || STATE.ended) return;
    const a = computeAdaptive();

    // if changes are meaningful, restart spawner
    const diffRate = Math.abs(a.spawnRate - STATE.curSpawnRate);
    const diffJw = Math.abs(a.junkWeight - STATE.junkWeightCur);

    if(diffRate >= 60 || diffJw >= 0.05){
      restartSpawnerWith(a.spawnRate, a.junkWeight, mount);
    }
  };

  clearInterval(STATE.adaptTimer);
  STATE.adaptTimer = setInterval(apply, 1200);

  // apply once quickly after start
  setTimeout(apply, 150);
}

/* ------------------------------------------------
 * Hit / expire handlers
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;

  // count distinct groups collected at least 1
  STATE.goal.cur = STATE.g.filter(v=>v>0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function updateMini(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function handleHit(t){
  if(!STATE.running || STATE.ended) return;

  if(t.kind === 'good'){
    STATE.hitGood++;
    STATE.missStreak = 0;
    setBossPanic(false);

    // groupId from spawner: groupIndex 0..4
    const gi = clamp((t.groupIndex ?? 0), 0, 4);
    STATE.g[gi]++;

    addCombo();
    addScore(100 + STATE.combo * 6);

    updateGoal();
    updateMini();
    emitQuest();
    return;
  }

  // junk hit
  STATE.hitJunk++;
  STATE.miss++;
  STATE.missStreak++;
  resetCombo();
  addScore(-60);

  // boss panic feedback (late game + streak)
  if(STATE.bossOn && STATE.missStreak >= 2){
    setBossPanic(true);
  }

  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');

  updateMini();
  emitQuest();
}

function handleExpire(t){
  if(!STATE.running || STATE.ended) return;

  if(t.kind === 'good'){
    STATE.expireGood++;
    STATE.miss++;
    STATE.missStreak++;
    resetCombo();

    // late game small hint (rate-limited-ish)
    if(STATE.timeLeft <= 18 && (STATE.expireGood % 2 === 1)){
      coach('อย่าปล่อยให้อาหารหายไปนะ 👀', 'Coach');
    }

    updateMini();
    emitQuest();
  }
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset
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

  STATE.goal.cur = 0;
  STATE.goal.done = false;

  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.stormOn = false;
  STATE.bossOn = false;
  STATE.bossPanic = false;
  STATE.missStreak = 0;

  // rng
  const runMode = (cfg.runMode || 'play').toLowerCase();
  const research = (runMode === 'research' || runMode === 'study');
  STATE.rng = research ? seededRng(cfg.seed || Date.now()) : Math.random;

  // duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // adaptive (play only)
  STATE.adaptiveOn = !research;

  // base tuning by diff
  STATE.baseSpawnRate = (cfg.diff === 'easy') ? 980 : (cfg.diff === 'hard' ? 780 : 900);
  STATE.curSpawnRate = STATE.baseSpawnRate;
  STATE.junkWeightBase = (cfg.diff === 'easy') ? 0.25 : (cfg.diff === 'hard' ? 0.34 : 0.30);
  STATE.junkWeightCur = STATE.junkWeightBase;

  // fire start
  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff || 'normal',
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  // initial quest
  emitQuest();

  // start timer
  startTimer();

  // start FX layers ready (off)
  STATE.bossFx = ensureFxLayer('bossFx');
  STATE.stormFx = ensureFxLayer('stormFx');
  setStorm(false);
  setBoss(false);

  // initial spawner
  restartSpawnerWith(STATE.curSpawnRate, STATE.junkWeightCur, mount);

  // adaptive loop
  if(STATE.adaptiveOn){
    startAdaptiveLoop(mount);
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
  }else{
    coach('เริ่มโหมดวิจัย (คงที่ + deterministic) 🧪', 'Coach');
  }

  // fail-safe: if something ends early
  pushScore();
  emit('hha:time', { leftSec: STATE.timeLeft });
}