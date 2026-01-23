// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive phases ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:phase, hha:predict, hha:end, hha:celebrate
// ✅ Supports: Star + Shield powerups
// ✅ Crosshair / tap-to-shoot via vr-ui.js (hha:shoot)
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};
const pct2 = (n)=> Math.round((Number(n)||0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
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

const FOOD_GROUP_EMOJI = [
  // หมู่ 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
  ['🥩','🍗','🐟','🥚','🥛','🫘'],
  // หมู่ 2 คาร์บ (ข้าว แป้ง เผือก มัน น้ำตาล)
  ['🍚','🍞','🍜','🥔','🍠','🥖'],
  // หมู่ 3 ผัก
  ['🥦','🥬','🥕','🥒','🌽','🍆'],
  // หมู่ 4 ผลไม้
  ['🍎','🍌','🍊','🍉','🍇','🥭'],
  // หมู่ 5 ไขมัน
  ['🥑','🥜','🧈','🧀','🫒','🌰'],
];

const JUNK_EMOJI = ['🍩','🍟','🍔','🍕','🍫','🧋','🍰','🍪'];

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่) index 0-4
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

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // powerups
  shield:0,

  // mode / cfg
  cfg:null,
  rng:Math.random,

  // spawn controller
  engine:null,

  // phase
  wave:'normal',
  storm:false,
  boss:false,

  // bonus time budget
  __extraTime:0,
  __predTick:0,
};

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
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

function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    shield: STATE.shield
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

function addTime(sec, reason='bonus'){
  sec = Number(sec)||0;
  if(sec<=0) return;

  const maxExtra = 25; // เพิ่มได้รวมไม่เกิน 25 วิ ต่อรอบ
  const can = Math.max(0, maxExtra - (STATE.__extraTime||0));
  const add = Math.min(sec, can);
  if(add<=0) return;

  STATE.__extraTime += add;
  STATE.timeLeft += add;
  emit('hha:time', { leftSec: STATE.timeLeft, bonus:add, reason });
}

function setWave(name){
  STATE.wave = name;
  STATE.storm = (name === 'storm');
  STATE.boss  = (name === 'boss');
  emit('hha:phase', { wave:name, storm:STATE.storm, boss:STATE.boss });
  emit('hha:judge', { type:'wave', wave:name });
}

function stopSpawner(){
  try{ STATE.engine && STATE.engine.stop && STATE.engine.stop(); }catch{}
  STATE.engine = null;
}

function pick(arr, rng){
  return arr[Math.floor((rng() * arr.length))];
}

function decorateTarget(el, t){
  // ใส่ emoji ตามหมู่ / junk / power
  if(t.kind === 'good'){
    const gi = clamp(t.groupIndex ?? 0, 0, 4);
    const e = pick(FOOD_GROUP_EMOJI[gi], t.rng || STATE.rng);
    el.textContent = e;
    el.setAttribute('aria-label', `อาหารหมู่ ${gi+1}`);
  }else if(t.kind === 'junk'){
    el.textContent = pick(JUNK_EMOJI, t.rng || STATE.rng);
    el.setAttribute('aria-label', 'ของหวาน/ทอด');
  }else if(t.kind === 'star'){
    el.textContent = '⭐';
    el.setAttribute('aria-label', 'ดาวลด Miss');
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.setAttribute('aria-label', 'โล่กันพลาด');
  }
}

function makeSpawner(mount, profile){
  // profile = { spawnRate, sizeRange, weights }
  const p = profile || {};
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: p.spawnRate ?? 900,
    sizeRange: p.sizeRange ?? [44,64],
    kinds: p.kinds ?? [
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.24 },
      { kind:'star', weight:0.02 },
      { kind:'shield', weight:0.02 },
    ],
    decorateTarget,
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = clamp(t.groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
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

function checkWin(){
  if(STATE.goal.done && STATE.mini.done){
    addScore(500);
    emit('hha:celebrate', { kind:'win' });
    endGame('win');
  }
}

function updateQuestsAfterGood(){
  // goal = เก็บครบทุกหมู่ (นับ unique groups)
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      addTime(5, 'goal');
    }
  }

  // mini = accuracy
  const accPct = accuracy() * 100;
  STATE.mini.cur = Math.round(accPct);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
    addTime(8, 'mini');
  }

  emitQuest();
  checkWin();
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  updateQuestsAfterGood();
}

function onHitJunk(){
  // shield blocks junk hit
  if(STATE.shield > 0){
    STATE.shield--;
    coach('🛡️ โล่ป้องกันสำเร็จ!', 'Power');
    emitScore();
    return;
  }

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

function onHitStar(){
  // ลด miss ลง 1 (floor 0)
  if(STATE.miss > 0) STATE.miss--;
  addScore(120);
  coach('⭐ ลด Miss ลง 1!', 'Power');
  emitScore();
}

function onHitShield(){
  STATE.shield++;
  addScore(90);
  coach('🛡️ ได้โล่! กันพลาดของหวาน/ทอด 1 ครั้ง', 'Power');
  emitScore();
}

function predictWinProb(){
  const acc = accuracy(); // 0..1
  const time = Math.max(0, STATE.timeLeft);
  const missing = 5 - STATE.g.filter(v=>v>0).length;
  const elapsed = Math.max(1, (STATE.cfg.durationPlannedSec||90) - time + 1);
  const pace = (STATE.hitGood + 1) / elapsed; // hits/sec

  let p = 0.15;
  p += (acc - 0.6) * 0.9;
  p += Math.min(0.35, pace * 0.12);
  p += (time/90) * 0.25;
  p -= missing * 0.10;
  p = clamp(p, 0, 1);

  return { p, accPct: Math.round(acc*100), missing, timeLeft: time, pace: pct2(pace) };
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);
  stopSpawner();

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

function startTimer(mount){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.__predTick = 0;

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // AI prediction event every 5s
    STATE.__predTick++;
    if(STATE.__predTick % 5 === 0){
      const pr = predictWinProb();
      emit('hha:predict', {
        pWin: pct2(pr.p),
        accPct: pr.accPct,
        missingGroups: pr.missing,
        timeLeft: pr.timeLeft,
        pace: pr.pace
      });
    }

    // phases (play mode only)
    const isResearch = (STATE.cfg.runMode === 'research' || STATE.cfg.runMode === 'study');
    if(!isResearch){
      if(STATE.timeLeft === 45){
        setWave('storm');
        stopSpawner();
        STATE.engine = makeSpawner(mount, {
          spawnRate: 700,
          sizeRange: [42,62],
          kinds: [
            { kind:'good', weight:0.62 },
            { kind:'junk', weight:0.32 },
            { kind:'star', weight:0.03 },
            { kind:'shield', weight:0.03 },
          ]
        });
      }
      if(STATE.timeLeft === 20){
        setWave('boss');
        stopSpawner();
        STATE.engine = makeSpawner(mount, {
          spawnRate: 620,
          sizeRange: [40,58],
          kinds: [
            { kind:'good', weight:0.58 },
            { kind:'junk', weight:0.36 },
            { kind:'star', weight:0.03 },
            { kind:'shield', weight:0.03 },
          ]
        });
      }
    }

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
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

  STATE.shield = 0;
  STATE.__extraTime = 0;

  // RNG
  const isResearch = (cfg.runMode === 'research' || cfg.runMode === 'study');
  STATE.rng = isResearch ? seededRng(cfg.seed || Date.now()) : Math.random;

  // default 90s in boot (ควบคุมง่ายสำหรับ ป.5)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // initial wave
  setWave('normal');

  emit('hha:start', {
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft
  });

  emitQuest();
  emitScore();
  startTimer(mount);

  // spawner profile (research = stable, play = lively)
  stopSpawner();
  if(isResearch){
    STATE.engine = makeSpawner(mount, {
      spawnRate: (cfg.diff === 'hard') ? 800 : 900,
      sizeRange:[44,64],
      kinds:[
        { kind:'good', weight:0.70 },
        { kind:'junk', weight:0.26 },
        { kind:'star', weight:0.02 },
        { kind:'shield', weight:0.02 },
      ]
    });
  }else{
    STATE.engine = makeSpawner(mount, {
      spawnRate: (cfg.diff === 'hard') ? 780 : 880,
      sizeRange:[44,64],
      kinds:[
        { kind:'good', weight:0.72 },
        { kind:'junk', weight:0.24 },
        { kind:'star', weight:0.02 },
        { kind:'shield', weight:0.02 },
      ]
    });
  }

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}