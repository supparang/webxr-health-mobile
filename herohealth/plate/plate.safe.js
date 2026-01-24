// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION, Latest)
// ✅ Uses mode-factory (decorateTarget + shoot + TTL)
// ✅ Emoji by Thai food groups 1–5
// ✅ Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:end

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

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

/* -----------------------------
   Emoji packs (Plate)
   หมู่ 1 โปรตีน / หมู่ 2 คาร์บ / หมู่ 3 ผัก / หมู่ 4 ผลไม้ / หมู่ 5 ไขมัน
------------------------------ */
const EMOJI_GROUP = [
  ['🥚','🥛','🍗','🐟','🥜','🫘'],       // g1
  ['🍚','🍞','🥔','🍠','🍜','🥨'],       // g2
  ['🥦','🥬','🥒','🌽','🥕','🍄'],       // g3
  ['🍌','🍎','🍊','🍉','🍇','🍍'],       // g4
  ['🥑','🧈','🥥','🫒','🍳','🧀']        // g5 (บางตัวซ้อนหมู่ได้ แต่ใช้เป็น “สัญลักษณ์” ได้)
];

const EMOJI_JUNK = ['🍩','🍟','🍔','🥤','🍰','🍫','🧁','🍕'];

function pickFrom(rng, arr){
  return arr[Math.floor(rng() * arr.length)] || arr[0];
}

/* -----------------------------
   Engine state
------------------------------ */
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

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null
};

function emitQuest(){
  emit('quest:update', {
    goal:{ name:STATE.goal.name, sub:STATE.goal.sub, cur:STATE.goal.cur, target:STATE.goal.target },
    mini:{ name:STATE.mini.name, sub:STATE.mini.sub, cur:STATE.mini.cur, target:STATE.mini.target, done:STATE.mini.done },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

function addScore(v){
  STATE.score += v;
  emit('hha:score', { score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}

  emit('hha:end', {
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: Math.round(accuracy()*100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* -----------------------------
   Hit handlers
------------------------------ */
function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  // อัปเดต mini ด้วย (accuracy เปลี่ยน)
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  emitQuest();
}

/* -----------------------------
   decorateTarget (emoji)
------------------------------ */
function decorateTarget(el, t){
  // ทำให้เห็นชัดว่าเป็น “เป้า”
  // good: emoji ตามหมู่ / junk: emoji junk
  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const emoji = pickFrom(t.rng || STATE.rng, EMOJI_GROUP[gi]);
    el.textContent = emoji;
    el.dataset.group = String(gi+1);
  }else{
    el.textContent = pickFrom(t.rng || STATE.rng, EMOJI_JUNK);
  }
}

function makeSpawner(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const spawnRate =
    diff === 'hard' ? 650 :
    diff === 'easy' ? 980 :
    820;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[46,72],
    kinds:[
      { kind:'good', weight:0.70 },
      { kind:'junk', weight:0.30 }
    ],
    decorateTarget, // ✅ HERE
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else onHitJunk();
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

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

  // RNG: research => deterministic
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
  startTimer();

  STATE.engine = makeSpawner(mount);
  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}