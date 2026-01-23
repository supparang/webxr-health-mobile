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
  const L = clamp(STATE.dd