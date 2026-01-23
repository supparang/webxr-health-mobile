// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION) — PATCH C
// ✅ Uses mode-factory boot + decorateTarget (emoji pack)
// ✅ Powerups: ⭐ Star (reduce miss 1) / 🛡 Shield (block junk 1) / ⏱ Time+ (+3s)
// ✅ AI Prediction Coach (pass probability + missing groups hint)
// ✅ Research: deterministic seed; Play: fun + powerups

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
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

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

/* ------------------------------------------------
 * Emoji packs (หลากหลาย ไม่เบื่อ)
 * g[0..4] => 5 หมู่ (ปรับตามที่คุณใช้ในโปรเจกต์ได้)
 * ------------------------------------------------ */
const EMOJI = {
  g0: ['🍚','🍞','🥖','🥣','🍜','🍝','🥔','🌽'],               // ข้าว-แป้ง
  g1: ['🥩','🍗','🐟','🍳','🫘','🥜','🧀','🥛'],               // โปรตีน
  g2: ['🥦','🥬','🥕','🌶️','🍅','🥒','🧅','🍄'],             // ผัก
  g3: ['🍎','🍌','🍇','🍊','🍉','🍓','🥭','🍍'],               // ผลไม้
  g4: ['🥛','🧀','🍶','🧈','🥣','🧋'],                         // นม/แคลเซียม (ซ้ำได้)
  junk: ['🍟','🍔','🍕','🍩','🍪','🧁','🍬','🥤','🍫'],        // ของหวาน/ทอด
  star: ['⭐','🌟'],
  shield: ['🛡️'],
  time: ['⏱️','⏳']
};

function pickFrom(rng, arr){
  return arr[Math.floor(rng()*arr.length)];
}

function groupIcon(i){
  return i===0?'🍚':i===1?'🥩':i===2?'🥦':i===3?'🍎':'🥛';
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

  miss:0,       // miss = expireGood + junkHit (แต่ถ้ามี shield แล้ว block -> ไม่เพิ่ม miss)
  shield:0,     // 🛡 blocks junk
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  timeLeft:0,
  timer:null,

  // 5 groups
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

  // AI coach pacing
  lastAiAt:0,

  cfg:null,
  rng:Math.random,
  engine:null
};

function emitQuest(){
  emit('quest:update', {
    goal:{ name: STATE.goal.name, sub: STATE.goal.sub, cur: STATE.goal.cur, target: STATE.goal.target },
    mini:{ name: STATE.mini.name, sub: STATE.mini.sub, cur: STATE.mini.cur, target: STATE.mini.target, done: STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    shield: STATE.shield
  });
}

/* ------------------------------------------------
 * Accuracy (good/(good+junk+expiredGood))
 * ------------------------------------------------ */
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

/* ------------------------------------------------
 * AI Prediction (เบา แต่โคตร useful)
 * ------------------------------------------------ */
function predictPassProb(){
  // base on missing groups + time + accuracy
  const filled = STATE.g.filter(v=>v>0).length;
  const missing = 5 - filled;
  const a = accuracy(); // 0..1
  const t = Math.max(0, STATE.timeLeft);

  // heuristic: เวลามาก + แม่น + เหลือหมู่น้อย => prob สูง
  // scale: need ~ (missing * 10s) min time
  const timeNeed = missing * 10;
  const timeFactor = clamp((t - timeNeed + 20) / 40, 0, 1); // 0..1
  const accFactor = clamp((a - 0.55) / 0.35, 0, 1);         // 0..1
  const prob = 0.15 + 0.55*timeFactor + 0.30*accFactor;
  return clamp(prob, 0, 0.98);
}

function aiCoachTick(){
  const now = performance.now();
  if(now - STATE.lastAiAt < 9000) return; // rate-limit
  STATE.lastAiAt = now;

  const filled = STATE.g.filter(v=>v>0).length;
  const missingIdx = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingIdx.push(i);

  const p = predictPassProb();
  const pPct = Math.round(p*100);

  if(missingIdx.length > 0){
    const hintIcons = missingIdx.slice(0,2).map(groupIcon).join(' ');
    coach(`โอกาสผ่านตอนนี้ ~${pPct}% • โฟกัสหมู่ที่ขาด: ${hintIcons}`, 'AI');
  }else{
    coach(`สุดยอด! ครบ 5 หมู่แล้ว 🎉 โอกาสผ่าน ~${pPct}%`, 'AI');
  }
}

/* ------------------------------------------------
 * Score/Combo
 * ------------------------------------------------ */
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
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct2(accuracy() * 100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer (supports Time+)
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // AI coach tick (ไม่ถี่)
    aiCoachTick();

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
  addScore(100 + STATE.combo * 6);

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
  emitScore();
}

function onHitJunk(){
  STATE.hitJunk++;

  // 🛡 shield blocks junk once (no miss)
  if(STATE.shield > 0){
    STATE.shield--;
    resetCombo();
    addScore(-10);
    coach('🛡️ กันพลาดไว้แล้ว! ระวังต่อไปนะ', 'Coach');
    emitScore();
    return;
  }

  STATE.miss++;
  resetCombo();
  addScore(-55);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitScore();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitScore();
}

/* powerups */
function onHitStar(){
  // ⭐ ลด miss 1 (floor 0) + bonus
  STATE.miss = Math.max(0, STATE.miss - 1);
  addScore(140);
  coach('⭐ เก่งมาก! ลด Miss ลง 1', 'Power');
  emitScore();
}

function onHitShield(){
  STATE.shield = Math.min(3, STATE.shield + 1);
  addScore(60);
  coach('🛡️ ได้โล่! กันของหวาน/ทอดได้ 1 ครั้ง', 'Power');
  emitScore();
}

function onHitTime(){
  STATE.timeLeft = Math.min(180, STATE.timeLeft + 3);
  emit('hha:time', { leftSec: STATE.timeLeft });
  addScore(40);
  coach('⏱️ +3 วิ! เร่งต่อ!', 'Power');
  emitScore();
}

/* ------------------------------------------------
 * decorateTarget: set emoji/icon by kind/group
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // set emoji
  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const arr = gi===0?EMOJI.g0:gi===1?EMOJI.g1:gi===2?EMOJI.g2:gi===3?EMOJI.g3:EMOJI.g4;
    el.textContent = pickFrom(t.rng, arr);
  }else if(t.kind === 'junk'){
    el.textContent = pickFrom(t.rng, EMOJI.junk);
  }else if(t.kind === 'star'){
    el.textContent = pickFrom(t.rng, EMOJI.star);
  }else if(t.kind === 'shield'){
    el.textContent = pickFrom(t.rng, EMOJI.shield);
  }else if(t.kind === 'time'){
    el.textContent = pickFrom(t.rng, EMOJI.time);
  }else{
    el.textContent = '•';
  }

  // subtle size boost for powerups
  if(t.kind === 'star' || t.kind === 'shield' || t.kind === 'time'){
    const s = (t.size || 54);
    el.style.width = `${Math.round(s * 1.08)}px`;
    el.style.height = `${Math.round(s * 1.08)}px`;
  }
}

/* ------------------------------------------------
 * Spawn logic
 * ------------------------------------------------ */
function makeSpawner(mount){
  // base spawn
  const diff = STATE.cfg.diff;
  const baseRate = diff === 'hard' ? 720 : diff === 'easy' ? 980 : 860;

  // powerups appear rarely (play only)
  const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
  const kinds = isResearch
    ? [
        { kind:'good', weight:0.72 },
        { kind:'junk', weight:0.28 },
      ]
    : [
        { kind:'good', weight:0.70 },
        { kind:'junk', weight:0.26 },
        { kind:'star', weight:0.02 },
        { kind:'shield', weight:0.01 },
        { kind:'time', weight:0.01 },
      ];

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: baseRate,
    sizeRange:[44,64],
    kinds,

    decorateTarget, // ✅ key

    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? (Math.floor(STATE.rng()*5));
        onHitGood(gi);
      }else if(t.kind === 'junk'){
        onHitJunk();
      }else if(t.kind === 'star'){
        onHitStar();
      }else if(t.kind === 'shield'){
        onHitShield();
      }else if(t.kind === 'time'){
        onHitTime();
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
  STATE.shield = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.lastAiAt = 0;

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

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

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}