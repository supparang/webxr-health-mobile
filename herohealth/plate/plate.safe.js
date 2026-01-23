// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// ✅ AI Pack 1–4 (DD + Coach + Pattern + Power-ups)
// ✅ Deterministic in research/study (seeded RNG + no DD)
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:power, hha:end

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

/* ---------------- Utilities ---------------- */
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const pct2 = (n)=> Math.round((Number(n)||0)*100)/100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pickFrom(rng, arr){
  if(!arr || !arr.length) return '❓';
  return arr[Math.floor(rng()*arr.length)];
}
function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

/* ---------------- Emoji sets (ไทย 5 หมู่) ---------------- */
const EMOJI_GROUPS = [
  ['🍗','🥚','🥛','🫘','🐟'], // หมู่ 1 โปรตีน
  ['🍚','🍞','🥔','🍠','🍜'], // หมู่ 2 คาร์บ
  ['🥦','🥬','🥕','🥒','🌽'], // หมู่ 3 ผัก
  ['🍎','🍌','🍊','🍉','🍇'], // หมู่ 4 ผลไม้
  ['🥑','🥜','🧈','🫒','🥥'], // หมู่ 5 ไขมัน
];
const EMOJI_JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🧁','🍰'];
const EMOJI_STAR = ['⭐','🌟'];
const EMOJI_SHIELD = ['🛡️','🛡'];

/* ---------------- State ---------------- */
const STATE = {
  running:false,
  ended:false,

  cfg:null,
  rng:Math.random,

  score:0,
  combo:0,
  comboMax:0,

  miss:0,
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  timeLeft:0,
  timer:null,

  g:[0,0,0,0,0],

  goal:{ name:'เติมจานให้ครบ 5 หมู่', sub:'เก็บอาหารให้ครบทุกหมู่', cur:0, target:5, done:false },
  mini:{ name:'ความแม่นยำ', sub:'คุมความแม่น ≥ 80%', cur:0, target:80, done:false },

  shield:0,
  stars:0,

  dd: { level:0.35 },
  coach: { lastAt:0, coolMs:2400 },

  pat: { wave:'warmup', waveUntil:0, seq:0, stormOn:false, bossOn:false },

  engine:null,
};

/* ---------------- Core helpers ---------------- */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total<=0) return 1;
  return STATE.hitGood / total;
}
function emitScore(){
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}
function emitPower(){
  emit('hha:power', { shield:STATE.shield, stars:STATE.stars });
}
function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target, done:STATE.goal.done },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function coach(msg, tag='Coach', force=false){
  const t = Date.now();
  if(!force && (t - STATE.coach.lastAt) < STATE.coach.coolMs) return;
  STATE.coach.lastAt = t;
  emit('hha:coach', { msg, tag });
}

/* ---------------- Scoring ---------------- */
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){
  STATE.combo = 0;
}
function addScore(v){
  STATE.score += v;
  emitScore();
}

/* ---------------- End ---------------- */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  try{ STATE.engine?.stop?.(); }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct2(accuracy()*100),

    shield: STATE.shield,
    stars: STATE.stars,

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
  });
}

/* ---------------- Timer ---------------- */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    aiDirectorTick(); // every 1s
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* =========================================================
   4) Power-ups
========================================================= */
function gainShield(n=1){
  STATE.shield = clamp(STATE.shield + (Number(n)||0), 0, 9);
  emitPower();
  coach('ได้โล่! 🛡️ บล็อกของหวาน/ทอดได้ 1 ครั้ง', 'Power');
}
function useStarReduceMiss(){
  if(STATE.miss <= 0) return false;
  STATE.miss = Math.max(0, STATE.miss - 1);
  addScore(120);
  coach('⭐ ลด Miss ลง 1!', 'Power');
  return true;
}
function blockJunkIfShield(){
  if(STATE.shield > 0){
    STATE.shield--;
    emitPower();
    addScore(10);
    coach('🛡️ บล็อกของหวาน/ทอด!', 'Power');
    return true;
  }
  return false;
}

/* =========================================================
   Hit handlers
========================================================= */
function updateQuestsAfterGood(){
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal', true);
    }
  }

  const accPct = accuracy()*100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Mini', true);
    gainShield(1);
  }

  emitQuest();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateQuestsAfterGood();
}

function onHitJunk(){
  STATE.hitJunk++;

  if(blockJunkIfShield()){
    resetCombo();
    emitScore();
    emitQuest();
    return;
  }

  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitScore();
  emitQuest();
}

function onHitStar(){
  if(!useStarReduceMiss()) addScore(150);
}
function onHitShield(){
  gainShield(1);
}

/* =========================================================
   3) Pattern Generator (seeded)
========================================================= */
function setWave(name, durSec){
  STATE.pat.wave = name;
  STATE.pat.waveUntil = Date.now() + (durSec*1000);
  STATE.pat.seq = 0;

  const storm = (name === 'storm');
  const boss  = (name === 'boss');
  STATE.pat.stormOn = storm;
  STATE.pat.bossOn  = boss;

  emit('hha:judge', { phase:name, storm, boss });
}
function ensureWave(){
  const t = Date.now();
  if(t < STATE.pat.waveUntil) return;

  if(STATE.pat.wave === 'warmup') setWave('normal', 18);
  else if(STATE.pat.wave === 'normal') setWave('storm', 10);
  else if(STATE.pat.wave === 'storm') setWave('boss', 8);
  else setWave('normal', 18);
}
function pickMissingGroupBias(){
  const missing = [];
  for(let i=0;i<5;i++) if((STATE.g[i]||0) <= 0) missing.push(i);
  if(!missing.length) return null;
  return missing[Math.floor(STATE.rng()*missing.length)];
}

function nextTargetPattern({ rng, params }){
  ensureWave();
  STATE.pat.seq++;

  const runMode = (STATE.cfg?.runMode || 'play');
  const L = clamp(STATE.dd.level, 0, 1);
  const wave = STATE.pat.wave;

  let pJ = 0.26 + (L*0.18);
  if(wave === 'storm') pJ += 0.14;
  if(wave === 'boss')  pJ += 0.18;
  if(runMode !== 'play') pJ = Math.min(pJ, 0.55);

  const pStar   = (runMode==='play') ? 0.045 : 0.0;
  const pShield = (runMode==='play') ? 0.035 : 0.0;

  const r = rng();
  if(r < pStar) return { kind:'star', ttlMs:1200, size:52 };
  if(r < pStar + pShield) return { kind:'shield', ttlMs:1250, size:54 };

  const kind = (rng() < pJ) ? 'junk' : 'good';

  if(kind === 'junk'){
    const ttl = clamp(params.ttlMsJunk - (L*400), 850, 1800);
    return { kind:'junk', ttlMs: ttl };
  }

  let gi = Math.floor(rng()*5);

  if(runMode === 'play' && !STATE.goal.done){
    const miss = pickMissingGroupBias();
    if(miss != null && STATE.rng() < 0.70) gi = miss;
  }

  const ttl = clamp(params.ttlMsGood - (L*260), 950, 2400);
  return { kind:'good', groupIndex:gi, ttlMs: ttl };
}

/* =========================================================
   2) AI Coach
========================================================= */
function aiCoachTick(){
  const accPct = accuracy()*100;

  if(accPct < 55 && (STATE.hitGood + STATE.hitJunk + STATE.expireGood) >= 8){
    coach('ลอง “หยุดนิ่ง 0.5 วิ” แล้วค่อยยิง จะแม่นขึ้นนะ 🎯', 'AI Coach');
    return;
  }
  if(STATE.hitJunk >= 2 && (STATE.hitJunk > STATE.hitGood)){
    coach('ของหวาน/ทอดโผล่ถี่—เล็งให้ชัวร์ก่อนแตะ 🧠', 'AI Coach');
    return;
  }
  if(!STATE.goal.done){
    const missing = [];
    for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missing.push(i+1);
    if(missing.length && STATE.timeLeft <= 25){
      coach(`ใกล้หมดเวลา! โฟกัสหมู่ที่ยังขาด: ${missing.join(', ')} ⚡`, 'AI Coach', true);
      return;
    }
  }
}

/* =========================================================
   1) AI Difficulty Director
========================================================= */
function aiDirectorTick(){
  if(!STATE.running || !STATE.engine?.setParams) return;

  const runMode = (STATE.cfg?.runMode || 'play');
  if(runMode === 'research' || runMode === 'study'){
    aiCoachTick();
    return;
  }

  const acc = accuracy();
  const elapsed = Math.max(1, ((STATE.cfg.durationPlannedSec||90) - STATE.timeLeft + 1));
  const missRate = (STATE.miss / elapsed);
  const comboN = STATE.combo;

  let level = STATE.dd.level;

  const wantUp = (acc > 0.78 && missRate < 0.16 && comboN >= 3);
  const wantDown = (acc < 0.60 || missRate > 0.28);

  if(wantUp) level += 0.06;
  else if(wantDown) level -= 0.08;
  else level += (acc - 0.70) * 0.02;

  level = clamp(level, 0.05, 0.95);
  STATE.dd.level = level;

  const spawnRate = Math.round(980 - level*340);
  const goodW = clamp(0.78 - level*0.20, 0.55, 0.82);
  const ttlGood = Math.round(2350 - level*520);
  const ttlJunk = Math.round(1900 - level*640);
  const sizeMin = Math.round(52 - level*10);
  const sizeMax = Math.round(76 - level*12);

  STATE.engine.setParams({
    spawnRate,
    ttlMsGood: ttlGood,
    ttlMsJunk: ttlJunk,
    sizeRange:[sizeMin, sizeMax],
    kinds:[
      { kind:'good', weight:goodW },
      { kind:'junk', weight:1-goodW },
      { kind:'star', weight:0.001 },
      { kind:'shield', weight:0.001 },
    ]
  });

  aiCoachTick();
}

/* =========================================================
   Decorate targets (emoji)
========================================================= */
function decorateTarget(el, t){
  const r = (typeof t.rng === 'function') ? t.rng : STATE.rng;

  let emoji = '🍽️';
  if(t.kind === 'junk'){
    emoji = pickFrom(r, EMOJI_JUNK);
  }else if(t.kind === 'good'){
    emoji = pickFrom(r, EMOJI_GROUPS[t.groupIndex||0] || []);
  }else if(t.kind === 'star'){
    emoji = pickFrom(r, EMOJI_STAR);
  }else if(t.kind === 'shield'){
    emoji = pickFrom(r, EMOJI_SHIELD);
  }

  el.innerHTML = `<span class="tEmoji" aria-hidden="true">${emoji}</span>`;
  el.setAttribute('role','button');
}

/* =========================================================
   Spawn boot
========================================================= */
function makeSpawner(mount){
  const diff = (STATE.cfg?.diff || 'normal');

  const baseSpawn =
    diff === 'easy' ? 980 :
    diff === 'hard' ? 740 :
    860;

  const baseGoodW =
    diff === 'hard' ? 0.64 :
    diff === 'easy' ? 0.80 :
    0.72;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    safePrefix: '--plate',

    spawnRate: baseSpawn,
    sizeRange:[46,72],

    kinds:[
      { kind:'good', weight:baseGoodW },
      { kind:'junk', weight:1-baseGoodW },
      { kind:'star', weight:0.001 },
      { kind:'shield', weight:0.001 },
    ],

    ttlMsGood: 2200,
    ttlMsJunk: 1750,

    decorateTarget,
    nextTarget: nextTargetPattern,

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else if(t.kind === 'junk'){
        onHitJunk();
      }else if(t.kind === 'star'){
        onHitStar();
      }else if(t.kind === 'shield'){
        onHitShield();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

/* =========================================================
   Main boot
========================================================= */
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

  STATE.goal.cur = 0; STATE.goal.done = false;
  STATE.mini.cur = 0; STATE.mini.done = false;

  STATE.shield = 0;
  STATE.stars = 0;

  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  STATE.pat.wave = 'warmup';
  STATE.pat.waveUntil = Date.now() + 12000;

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitPower();
  emitQuest();

  STATE.engine = makeSpawner(mount);

  aiDirectorTick();
  startTimer();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach', true);
}