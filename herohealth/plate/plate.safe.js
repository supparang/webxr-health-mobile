// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION + AI PACK)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive AI Director ON
//   - research/study: deterministic seed + adaptive OFF (but pattern is seeded)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end, hha:ai
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ Uses mode-factory.js boot + decorateTarget (emoji)
// ✅ AI PACK:
//   (1) AI Difficulty Director (fair, smooth, explainable)
//   (2) AI Coach micro-tips (rate-limited)
//   (3) AI Pattern Generator (storm/boss) seeded
//   (4) AI Prediction (success probability heuristic)
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

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

/* ------------------------------------------------
 * Thai 5 food groups (DO NOT SHIFT)
 * 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
 * 2 คาร์บ (ข้าว แป้ง เผือก มัน น้ำตาล)
 * 3 ผัก
 * 4 ผลไม้
 * 5 ไขมัน
------------------------------------------------ */
const EMOJI_GROUP = {
  1: ['🥚','🥛','🐟','🍗','🫘','🥜','🧀'],
  2: ['🍚','🍞','🥖','🍜','🥔','🍠','🍯'],
  3: ['🥬','🥦','🥕','🌽','🥒','🍆','🫑'],
  4: ['🍎','🍌','🍇','🍉','🍍','🍊','🥭'],
  5: ['🥑','🫒','🧈','🥥','🌰']
};
const EMOJI_JUNK = ['🍟','🍔','🍕','🍩','🍪','🧁','🍫','🥤','🧋'];

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
  rng:Math.random,       // game rng (play)
  drng:Math.random,      // director rng (seeded always for reproducibility)
  startAtMs:0,

  // spawn
  engine:null,
  spawnerParams:null,

  // AI Director
  director:{
    enabled:false,
    tier:1,           // 0..3
    lastEvalAt:0,
    lastTipAt:0,
    tipCooldownMs:3200,
    lastTierChangeAt:0,
    minTierHoldMs:4500
  },

  // Pattern (storm/boss)
  pattern:{
    enabled:true,
    mode:'none',       // none | storm | boss
    untilMs:0,
    nextAtMs:0
  }
};

/* ------------------------------------------------
 * Events
 * ------------------------------------------------ */
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ------------------------------------------------
 * UI FX helpers
 * ------------------------------------------------ */
function setFx(mode){
  const storm = DOC.getElementById('stormFx');
  const boss  = DOC.getElementById('bossFx');

  if(storm){
    storm.classList.toggle('storm-on', mode === 'storm');
    storm.setAttribute('aria-hidden', mode === 'storm' ? 'false' : 'true');
  }
  if(boss){
    boss.classList.toggle('boss-on', mode === 'boss');
    boss.setAttribute('aria-hidden', mode === 'boss' ? 'false' : 'true');
    boss.classList.toggle('boss-panic', false);
  }
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
 * Coach (rate limited)
 * ------------------------------------------------ */
function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}
function coachRL(msg, tag='AI Coach'){
  const t = nowMs();
  if(t - STATE.director.lastTipAt < STATE.director.tipCooldownMs) return;
  STATE.director.lastTipAt = t;
  coach(msg, tag);
}

/* ------------------------------------------------
 * Score helpers
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}
function addScore(v){
  STATE.score += v;
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
 * good / (good + junk + expire good)
------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * Prediction (heuristic but useful)
 * - P(goal success) from progress speed + time left
 * - P(accuracy>=80) from current acc + stability factor
------------------------------------------------ */
function predict(){
  const tSpent = Math.max(1, (nowMs() - STATE.startAtMs) / 1000);
  const left = Math.max(0, STATE.timeLeft);

  // unique groups rate
  const uniqueNow = STATE.g.filter(v=>v>0).length;
  const need = Math.max(0, 5 - uniqueNow);
  const rateUnique = uniqueNow / tSpent; // groups/sec (rough)
  const expAdd = rateUnique * left;

  let pGoal = 0.15;
  if(need <= 0) pGoal = 0.98;
  else{
    // if expected additional unique groups covers remaining -> high
    const margin = expAdd - need;
    pGoal = clamp(0.5 + margin * 0.22, 0.05, 0.98);
  }

  const acc = accuracy(); // 0..1
  const stability = clamp((STATE.hitGood + STATE.hitJunk + STATE.expireGood) / 18, 0.2, 1.0);
  let pAcc = clamp(0.35 + (acc - 0.80) * 1.25, 0.05, 0.98);
  pAcc = clamp(pAcc * (0.7 + 0.3*stability), 0.05, 0.98);

  return { pGoal, pAcc, pWin: clamp(pGoal * pAcc, 0.02, 0.98) };
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  try{ STATE.engine?.stop?.(); }catch{}

  setFx('none');

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
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
 * Timer + AI frame (DL-ready hooks)
------------------------------------------------ */
function emitAIFrame(){
  // lightweight feature frame (good for ML/DL later)
  const acc = accuracy();
  const uniqueNow = STATE.g.filter(v=>v>0).length;
  const pr = predict();
  emit('hha:ai', {
    tLeft: STATE.timeLeft,
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    hitGood: STATE.hitGood,
    hitJunk: STATE.hitJunk,
    expireGood: STATE.expireGood,
    acc,
    uniqueGroups: uniqueNow,
    g: [...STATE.g],
    tier: STATE.director.tier,
    mode: STATE.pattern.mode,
    pGoal: pr.pGoal,
    pAcc: pr.pAcc,
    pWin: pr.pWin
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // DL-ready frame each 1s
    emitAIFrame();

    // Pattern tick
    patternTick();

    // Director tick (play only)
    directorTick();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers
 * ------------------------------------------------ */
function updateQuestsAfterGood(){
  // goal: count unique groups collected at least 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coachRL('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'AI Coach');
    }
  }
  // mini: accuracy >= 80
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coachRL('ความแม่นยำดีมาก! 👍', 'AI Coach');
  }
  emitQuest();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  emit('hha:judge', { kind:'good', group: groupIndex+1, combo: STATE.combo });

  updateQuestsAfterGood();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);

  emit('hha:judge', { kind:'junk', miss:true });

  coachRL('ระวัง! ของหวาน/ทอด ⚠️ เล็งให้ตรงก่อนยิงนะ', 'AI Coach');
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emit('hha:judge', { kind:'expire', miss:true });
}

/* ------------------------------------------------
 * Target decorator (emoji + group tint)
 * ------------------------------------------------ */
function decorateTarget(el, target){
  const gi = clamp((target.groupIndex ?? 0), 0, 4); // 0-4
  const groupNo = gi + 1;

  // deterministic pick in research/study via target.rng (seeded in mode-factory)
  const r = typeof target.rng === 'function' ? target.rng : STATE.rng;

  let emoji = '🍽️';
  if(target.kind === 'junk'){
    emoji = EMOJI_JUNK[Math.floor(r() * EMOJI_JUNK.length)] || '🍟';
  }else{
    const pool = EMOJI_GROUP[groupNo] || ['🍽️'];
    emoji = pool[Math.floor(r() * pool.length)] || pool[0] || '🍽️';
  }

  el.dataset.group = String(groupNo);
  el.setAttribute('role','button');
  el.setAttribute('aria-label', target.kind === 'junk' ? 'อาหารหวาน/ทอด' : `อาหารหมู่ที่ ${groupNo}`);
  el.innerHTML = `<span class="emoji" aria-hidden="true">${emoji}</span>`;
}

/* ------------------------------------------------
 * Spawner params by tier + diff + pattern mode
 * tier 0..3 : easy -> spicy
------------------------------------------------ */
function buildSpawnerParams(tier, mode='none'){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();

  // base by diff
  let baseSpawn = diff === 'hard' ? 780 : (diff === 'easy' ? 980 : 860);
  let goodW = diff === 'hard' ? 0.68 : (diff === 'easy' ? 0.76 : 0.72);
  let sizeRange = [44,64];

  // tier adjust (Director)
  if(tier === 0){ baseSpawn += 120; goodW += 0.06; sizeRange = [48,70]; }
  if(tier === 1){ /* baseline */ }
  if(tier === 2){ baseSpawn -= 90;  goodW -= 0.05; sizeRange = [44,64]; }
  if(tier === 3){ baseSpawn -= 150; goodW -= 0.08; sizeRange = [42,62]; }

  // pattern adjust
  let ttlGood = 2150, ttlJunk = 1750;
  if(mode === 'storm'){
    baseSpawn = Math.max(520, baseSpawn - 180);
    goodW = Math.max(0.56, goodW - 0.12);
    ttlGood = 1850; ttlJunk = 1550;
  }
  if(mode === 'boss'){
    // boss = smaller targets + faster spawn but mostly good (skill check)
    sizeRange = [40,58];
    baseSpawn = Math.max(540, baseSpawn - 120);
    goodW = Math.min(0.78, goodW + 0.05);
    ttlGood = 1800; ttlJunk = 1600;
  }

  const junkW = 1 - goodW;

  return {
    spawnRate: baseSpawn,
    sizeRange,
    kinds: [
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    ttlMs: { good: ttlGood, junk: ttlJunk }
  };
}

function makeSpawner(mount, params){
  const p = params || buildSpawnerParams(STATE.director.tier, STATE.pattern.mode);
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: p.spawnRate,
    sizeRange: p.sizeRange,
    kinds: p.kinds,
    ttlMs: p.ttlMs,
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
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

function restartSpawner(reason='update'){
  try{ STATE.engine?.stop?.(); }catch{}
  const mount = DOC.getElementById('plate-layer');
  STATE.engine = makeSpawner(mount, STATE.spawnerParams);
  // explainable (ไม่สแปม)
  if(reason === 'tier'){
    coachRL(`AI ปรับความยาก: ระดับ ${STATE.director.tier+1}/4`, 'AI Director');
  }
}

/* ------------------------------------------------
 * AI Difficulty Director (ML-style online control)
 * - only in play mode
 * - fair: changes slowly + hold time
------------------------------------------------ */
function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++) if((STATE.g[i]||0) <= 0) miss.push(i+1);
  return miss;
}

function directorTick(){
  const d = STATE.director;
  if(!d.enabled) return;

  const t = nowMs();
  if(t - d.lastEvalAt < 2000) return; // eval every 2s
  d.lastEvalAt = t;

  // don't thrash tiers
  if(t - d.lastTierChangeAt < d.minTierHoldMs) return;

  const acc = accuracy();
  const uniqueNow = STATE.g.filter(v=>v>0).length;

  // simple signals
  const doingGreat = (acc >= 0.86 && STATE.comboMax >= 7 && STATE.miss <= 3 && uniqueNow >= 2);
  const struggling = (acc <= 0.66 || STATE.miss >= 6);

  let tier = d.tier;

  if(doingGreat && STATE.timeLeft > 18) tier = Math.min(3, tier + 1);
  else if(struggling) tier = Math.max(0, tier - 1);

  if(tier !== d.tier){
    d.tier = tier;
    d.lastTierChangeAt = t;

    // rebuild spawner params with current pattern mode
    STATE.spawnerParams = buildSpawnerParams(d.tier, STATE.pattern.mode);
    restartSpawner('tier');
  }

  // Coach micro tips (explainable)
  if(STATE.timeLeft % 6 === 0){ // not too often
    const missG = missingGroups();
    if(missG.length > 0){
      const pick = missG[Math.floor(STATE.drng()*missG.length)];
      coachRL(`ยังขาด “หมู่ ${pick}” อยู่เลย ลองมองหาอาหารหมู่นั้นนะ`, 'AI Coach');
    }else if(acc < 0.80){
      coachRL('ความแม่นยังต่ำกว่า 80%: เล็งให้ตรงก่อนแตะ/ยิง แล้วค่อยเก็บ 👍', 'AI Coach');
    }
  }

  // Prediction callout near end (optional)
  if(STATE.timeLeft === 25 || STATE.timeLeft === 15){
    const pr = predict();
    coachRL(`คาดการณ์ผ่านด่าน ~${Math.round(pr.pWin*100)}% (ภารกิจ ${Math.round(pr.pGoal*100)}% • ความแม่น ${Math.round(pr.pAcc*100)}%)`, 'AI Prediction');
  }
}

/* ------------------------------------------------
 * Pattern Generator (seeded): storm/boss
 * - deterministic schedule (uses drng seeded)
 * - works in play + research (still deterministic)
------------------------------------------------ */
function scheduleNextPattern(){
  const t = nowMs();
  // next in 10..18s (seeded)
  const dt = 10000 + Math.floor(STATE.drng()*8000);
  STATE.pattern.nextAtMs = t + dt;
}

function startPattern(mode, durMs){
  STATE.pattern.mode = mode;
  STATE.pattern.untilMs = nowMs() + durMs;

  setFx(mode);

  // rebuild spawner params for this mode but keep tier
  STATE.spawnerParams = buildSpawnerParams(STATE.director.tier, mode);
  restartSpawner('pattern');

  if(mode === 'storm') coachRL('⚡ Storm มาแล้ว! เป้าจะถี่ขึ้น 10 วิ', 'AI Pattern');
  if(mode === 'boss')  coachRL('👾 Boss มา! เป้าจะเล็กลง ลองคุมคอมโบ!', 'AI Pattern');
}

function endPattern(){
  STATE.pattern.mode = 'none';
  STATE.pattern.untilMs = 0;
  setFx('none');

  // back to normal params
  STATE.spawnerParams = buildSpawnerParams(STATE.director.tier, 'none');
  restartSpawner('pattern');

  scheduleNextPattern();
}

function patternTick(){
  if(!STATE.pattern.enabled) return;

  const t = nowMs();

  // end current pattern
  if(STATE.pattern.mode !== 'none' && t >= STATE.pattern.untilMs){
    endPattern();
    return;
  }

  // start new if time
  if(STATE.pattern.mode === 'none' && t >= STATE.pattern.nextAtMs){
    // choose pattern deterministically
    const r = STATE.drng();
    if(r < 0.55) startPattern('storm', 10000);
    else startPattern('boss', 8000);
  }

  // near end: spice up (but not in last 8s)
  if(STATE.pattern.mode === 'none' && STATE.timeLeft === 30){
    startPattern('storm', 9000);
  }
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.running = true;
  STATE.ended = false;

  STATE.startAtMs = nowMs();

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

  // RNG: research/study deterministic, play random
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // Director RNG always seeded so schedule is reproducible across devices when seed fixed
  STATE.drng = seededRng((cfg.seed || Date.now()) + 17);

  // time: default 90 sec
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // Director enable
  STATE.director.enabled = !(cfg.runMode === 'research' || cfg.runMode === 'study');

  // initial tier by diff
  const diff = (cfg.diff || 'normal').toLowerCase();
  STATE.director.tier = (diff === 'easy') ? 0 : (diff === 'hard' ? 2 : 1);
  STATE.director.lastEvalAt = 0;
  STATE.director.lastTipAt = 0;
  STATE.director.lastTierChangeAt = 0;

  // pattern scheduling
  STATE.pattern.enabled = true;
  STATE.pattern.mode = 'none';
  STATE.pattern.untilMs = 0;
  scheduleNextPattern();
  setFx('none');

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

  // build initial spawner
  STATE.spawnerParams = buildSpawnerParams(STATE.director.tier, 'none');
  STATE.engine = makeSpawner(mount, STATE.spawnerParams);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}