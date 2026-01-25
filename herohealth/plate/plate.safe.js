// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (hook-ready)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Uses mode-factory boot() + decorateTarget (emoji)
// ✅ Mini Quest: "เติมหมู่ที่ขาด (12 วิ) 0/2" -> ⭐ reduce Miss by 1
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { HHA_EMOJI, pickFrom } from '../vr/hha-emoji-pack.js'; // ใช้ชุดเดียวกับเกมอื่น

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = (Number(seed) || Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUP_KEYS = ['g1','g2','g3','g4','g5'];
// emoji 대표 1 ตัว/หมู่ (ใช้โชว์ “ยังขาด:”)
const GROUP_BADGES = ['🍗','🍚','🥦','🍎','🥑'];
const JUNK_EMOJI = ['🍟','🍩','🧁','🍔','🥤'];

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
    // จะ “ติด” เมื่อเก็บครบ 3 หมู่ครั้งแรก
    active:false,
    name:'เติมหมู่ที่ขาด',
    sub:'พลาดได้ ไม่เป็นไร! ลองใหม่รอบหน้า ...',
    cur:0,
    target:2,
    leftSec:0,
    windowSec:12,
    done:false,
    touchedMissingSet:new Set(), // เก็บกี่หมู่จากที่ขาด
  },

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn engine
  engine:null
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function missingGroups(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(i);
  }
  return miss;
}

function updateGoalSub(){
  const miss = missingGroups();
  if(miss.length === 0){
    STATE.goal.sub = 'ครบแล้ว! เก่งมาก 🎉';
    return;
  }
  const badges = miss.map(i=>GROUP_BADGES[i]).join(' ');
  STATE.goal.sub = `ยังขาด: ${badges}`;
}

function emitQuest(){
  // mini title shows countdown when active
  const miniName = STATE.mini.active
    ? `${STATE.mini.name} (${STATE.mini.leftSec} วิ)`
    : STATE.mini.name;

  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini:{
      name: miniName,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

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

function maybeStartMiniQuest(){
  if(STATE.mini.done || STATE.mini.active) return;
  // เริ่มเมื่อเก็บครบ 3 หมู่ (ตามภาพที่คุณส่ง)
  if(STATE.goal.cur >= 3 && STATE.goal.cur < 5){
    STATE.mini.active = true;
    STATE.mini.leftSec = STATE.mini.windowSec;
    STATE.mini.cur = 0;
    STATE.mini.touchedMissingSet = new Set();
    coach('⏱️ มินิเควสมาแล้ว! เติมหมู่ที่ขาดให้ไว!', 'Coach');
  }
}

function winMiniQuest(){
  if(STATE.mini.done) return;
  STATE.mini.done = true;
  STATE.mini.active = false;

  // ⭐ reward: reduce miss by 1
  STATE.miss = Math.max(0, (STATE.miss||0) - 1);
  coach('⭐ ลด Miss ลง 1! Power', 'Power');

  // small score bonus
  addScore(250);

  emitQuest();
}

function failMiniQuest(){
  if(!STATE.mini.active || STATE.mini.done) return;
  STATE.mini.active = false;
  coach('มินิเควสหมดเวลา! ไม่เป็นไร รอบหน้าทำได้ 💪', 'Coach');
  emitQuest();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal progress = จำนวนหมู่ที่มีอย่างน้อย 1
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
    }
  }

  // update goal sub (missing badges)
  updateGoalSub();

  // start mini quest at 3/5
  maybeStartMiniQuest();

  // mini quest logic: ต้องเก็บ “หมู่ที่ขาด” ให้ครบ 2 ภายในเวลา
  if(STATE.mini.active && !STATE.mini.done){
    // ถ้าเพิ่งเป็นหมู่ที่ขาดก่อนหน้า ให้ count
    // (นับ unique groups ที่ขาด เพื่อกันฟลุคเก็บหมู่เดิมรัว ๆ)
    const missBefore = missingGroups(); // หลังเพิ่มแล้ว, หมู่นี้อาจไม่ขาดแล้ว
    // วิธีง่าย: ถือว่าหมู่ที่เพิ่งเก็บ ถ้าเคยเป็น 0 มาก่อน จะเป็น “หมู่ที่ขาด” ที่เพิ่งเติม
    // (ตรวจย้อนด้วย g[groupIndex] == 1 แปลว่าเพิ่งเติมหมู่นี้ครั้งแรก)
    if(STATE.g[groupIndex] === 1){
      STATE.mini.touchedMissingSet.add(groupIndex);
      STATE.mini.cur = clamp(STATE.mini.touchedMissingSet.size, 0, 99);
      if(STATE.mini.cur >= STATE.mini.target){
        winMiniQuest();
      }
    }
  }

  emitQuest();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
}

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

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    // main timer
    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // mini quest countdown
    if(STATE.mini.active && !STATE.mini.done){
      STATE.mini.leftSec--;
      if(STATE.mini.leftSec <= 0){
        failMiniQuest();
      }else{
        emitQuest(); // refresh "(xx วิ)"
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Target decoration (emoji)
 * ------------------------------------------------ */
function decorateTarget(el, t){
  // good -> emoji by group
  if(t.kind === 'good'){
    const key = GROUP_KEYS[t.groupIndex] || 'g1';
    const emoji = pickFrom(HHA_EMOJI[key] || ['🍽️'], t.rng || STATE.rng);
    el.dataset.group = key;
    el.innerHTML = `<span class="emoji" aria-hidden="true">${emoji}</span>`;
    return;
  }

  // junk -> junk emoji
  const j = (t.rng || STATE.rng)();
  const emoji = JUNK_EMOJI[Math.floor(j * JUNK_EMOJI.length)] || '🍩';
  el.innerHTML = `<span class="emoji" aria-hidden="true">${emoji}</span>`;
}

function makeSpawner(mount){
  return spawnBoot({
    mount,
    safePrefix: 'plate',
    seed: STATE.cfg.seed,
    spawnRate: STATE.cfg.diff === 'hard' ? 650 : (STATE.cfg.diff === 'easy' ? 980 : 820),
    sizeRange: STATE.cfg.view === 'pc' ? [52, 78] : [58, 92],
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = (t.groupIndex ?? Math.floor(STATE.rng()*5));
        onHitGood(clamp(gi,0,4));
      }else{
        onHitJunk();
      }
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

  STATE.mini.active = false;
  STATE.mini.done = false;
  STATE.mini.cur = 0;
  STATE.mini.leftSec = 0;
  STATE.mini.touchedMissingSet = new Set();

  // RNG
  if(cfg.runMode === 'research' || cfg.runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // initial goal sub
  updateGoalSub();

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