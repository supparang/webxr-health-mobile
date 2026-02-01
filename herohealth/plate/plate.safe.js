// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON (lightweight director)
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ✅ FIX: ensure "ครบ 5 หมู่" is realistically achievable (bias missing groups)
// ✅ End: stop spawner to prevent targets flashing after end
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { FOOD5, JUNK, emojiForGroup, pickEmoji } from '../vr/food5-th.js';

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

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // counts by group index (0..4 => groupId 1..5)
  g:[0,0,0,0,0],

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

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

  cfg:null,
  rng:Math.random,

  spawner:null,

  director:{
    junkWeight:0.30,
    spawnRate:900,
    lastTuneAt:0,
  }
};

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax
  });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

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

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
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

function updateGoalProgress(){
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(!STATE.goal.done && STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function updateMiniProgress(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

function isResearchMode(){
  const m = (STATE.cfg?.runMode || '').toLowerCase();
  return (m === 'research' || m === 'study');
}

function tuneDirector(){
  if(isResearchMode()) return;

  const now = performance.now ? performance.now() : Date.now();
  if(now - STATE.director.lastTuneAt < 1500) return;
  STATE.director.lastTuneAt = now;

  const acc = accuracy();
  const left = STATE.timeLeft;

  const diff = (STATE.cfg?.diff || 'normal').toLowerCase();
  let baseRate = (diff === 'hard') ? 720 : (diff === 'easy') ? 980 : 860;
  let baseJunk = (diff === 'hard') ? 0.36 : (diff === 'easy') ? 0.22 : 0.30;

  const perf = (acc - 0.80);
  baseJunk = clamp(baseJunk + perf * 0.35, 0.12, 0.50);
  baseRate = clamp(baseRate - perf * 260, 650, 1100);

  if(left <= 20){
    baseRate = clamp(baseRate * 0.88, 600, 1000);
  }

  STATE.director.junkWeight = baseJunk;
  STATE.director.spawnRate = baseRate;
}

function missingGroupIndices(){
  const miss = [];
  for(let i=0;i<5;i++){
    if((STATE.g[i]||0) <= 0) miss.push(i);
  }
  return miss;
}

// ✅ FIX core: bias missing groups so "ครบ 5 หมู่" happens
function chooseGroupIndex(rng){
  const miss = missingGroupIndices();
  if(miss.length > 0){
    const dur = Math.max(1, Number(STATE.cfg?.durationPlannedSec || 90));
    const urgency = clamp(1 - (STATE.timeLeft / dur), 0, 1);
    const pForce = clamp(0.72 + urgency * 0.22, 0.70, 0.95);
    if(rng() < pForce){
      return miss[Math.floor(rng() * miss.length)];
    }
  }
  return Math.floor(rng() * 5);
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateGoalProgress();
  updateMiniProgress();
  emitQuest();

  if(STATE.goal.done && STATE.mini.done){
    endGame('clear');
  }else{
    tuneDirector();
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();
  addScore(-50);
  coach('ระวัง! ของหวาน/ทอด ⚠️');
  tuneDirector();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  tuneDirector();
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  // ✅ stop spawner to prevent flashing targets
  try{ STATE.spawner?.stop?.(); }catch{}
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

    accuracyGoodPct: Math.round((accuracy() * 100) * 100) / 100,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4],
  });
}

function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emitTime();
    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

// ✅ decorate targets with emoji by group (good) / junk
function decorateTarget(el, target){
  if(!el || !target) return;

  if(target.kind === 'good'){
    const gi = chooseGroupIndex(target.rng || STATE.rng);
    target.groupIndex = gi;

    const groupId = gi + 1;
    el.dataset.group = String(groupId);

    const emo = emojiForGroup(target.rng || STATE.rng, groupId);
    el.textContent = emo;
    el.title = (FOOD5[groupId]?.labelTH || `หมู่ ${groupId}`);
  }else{
    el.dataset.group = 'junk';
    el.textContent = pickEmoji(target.rng || STATE.rng, JUNK.emojis);
    el.title = (JUNK.labelTH || 'JUNK');
  }
}

function makeSpawner(mount){
  const cfg = STATE.cfg || {};
  const diff = (cfg.diff || 'normal').toLowerCase();

  let spawnRate = (diff === 'hard') ? 760 : (diff === 'easy') ? 980 : 880;
  let junkW = (diff === 'hard') ? 0.36 : (diff === 'easy') ? 0.22 : 0.30;

  if(!isResearchMode()){
    STATE.director.spawnRate = spawnRate;
    STATE.director.junkWeight = junkW;
    tuneDirector();
    spawnRate = STATE.director.spawnRate;
    junkW = STATE.director.junkWeight;
  }

  const goodW = Math.max(0.05, 1 - junkW);

  return spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate,
    sizeRange:[46, 70],
    kinds:[
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    decorateTarget,
    onHit:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? 0, 0, 4);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(!STATE.running || STATE.ended) return;
      if(t.kind === 'good') onExpireGood();
    }
  });
}

export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

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

  if(isResearchMode()){
    STATE.rng = seededRng(STATE.cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  const planned = Number(STATE.cfg.durationPlannedSec) || 90;
  STATE.timeLeft = clamp(planned, 10, 999);

  emit('hha:start', {
    game:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitScore();
  emitQuest();
  startTimer();

  try{
    try{ STATE.spawner?.stop?.(); }catch{}
    STATE.spawner = makeSpawner(mount);
  }catch(err){
    console.error('[PlateVR] spawner init error', err);
    coach('สปอว์นเป้าไม่สำเร็จ (ดู console)', 'System');
    endGame('error');
    return;
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}