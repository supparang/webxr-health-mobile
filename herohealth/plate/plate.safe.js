// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: boss+storm ON (fun), adaptive-ish via phase switching
//   - research/study: deterministic seed + boss/storm OFF by default (still can display FX if you want)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;

function seededRng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

  // groups
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

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null,
  engineMount:null,

  // phases
  bossOn:false,
  stormOn:false,
  _bossApplied:false,
  _stormApplied:false,
};

function emit(name, detail){
  WIN.dispatchEvent(new CustomEvent(name, { detail }));
}

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function setFx(id, clsOn, on){
  const el = document.getElementById(id);
  if(!el) return;
  if(on) el.classList.add(clsOn);
  else el.classList.remove(clsOn);
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
  STATE.score += v;
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
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

function maybeLogEvent(type, data={}){
  if(!STATE.cfg?.logEvents) return;
  emit('hha:event', Object.assign({
    game:'plate',
    type,
    t: Date.now(),
    leftSec: STATE.timeLeft,
    score: STATE.score,
    combo: STATE.combo
  }, data));
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  emit('hha:end', {
    reason,
    gameMode:'plate',

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

    // helpful phase flags (logger เอาไปเก็บได้)
    bossOn: STATE.bossOn,
    stormOn: STATE.stormOn
  });
}

function rebuildSpawner({ spawnRate, goodW, junkW }){
  // stop old
  try{
    if(STATE.engine && typeof STATE.engine.destroy === 'function') STATE.engine.destroy();
    else if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch(_){}

  // boot new
  STATE.engine = spawnBoot({
    mount: STATE.engineMount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight: goodW },
      { kind:'junk', weight: junkW }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
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

function applyBossIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(STATE._bossApplied) return;

  const trigger = (STATE.goal.done === true) || (STATE.timeLeft <= 35);
  if(!trigger) return;

  STATE._bossApplied = true;
  STATE.bossOn = true;

  // boss tuning: เร็วขึ้น + junk มากขึ้น (แต่ไม่โหดเกิน)
  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const bossRate = Math.max(620, Math.round(baseRate * 0.92));
  const goodW = 0.58;
  const junkW = 0.42;

  setFx('bossFx','boss-on', true);
  coach('👿 BOSS มาแล้ว! ระวังของหวาน/ทอดให้ดี', 'Boss');

  // rebuild (ปลอดภัยสุด ไม่พึ่ง api แปลกของ mode-factory)
  rebuildSpawner({ spawnRate: bossRate, goodW, junkW });

  maybeLogEvent('phase_boss_on', { bossRate, goodW, junkW });
}

function applyStormIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(STATE._stormApplied) return;
  if(STATE.timeLeft > 15) return;

  STATE._stormApplied = true;
  STATE.stormOn = true;

  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const stormRate = Math.max(580, Math.round(baseRate * 0.85));

  setFx('stormFx','storm-on', true);
  setFx('bossFx','boss-panic', true);
  coach('⏱️ ช่วงท้าย! เร่งนิด ๆ แล้วนะ', 'System');

  // ถ้ากำลัง boss อยู่แล้วก็ rebuild ด้วย rate ใหม่ + junk เดิม
  if(STATE.bossOn){
    rebuildSpawner({ spawnRate: stormRate, goodW:0.58, junkW:0.42 });
  }else{
    rebuildSpawner({ spawnRate: stormRate, goodW:0.70, junkW:0.30 });
  }

  maybeLogEvent('phase_storm_on', { stormRate });
}

function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;

    // phases
    applyBossIfNeeded();
    applyStormIfNeeded();

    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  STATE.g[groupIndex]++;

  addCombo();
  addScore(100 + STATE.combo * 5);

  // goal
  if(!STATE.goal.done){
    STATE.goal.cur = STATE.g.filter(v=>v>0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
      // boss can trigger immediately after goal is done
      applyBossIfNeeded();
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
  maybeLogEvent('hit_good', { groupIndex });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // boss โทษแรงขึ้นนิดนึง
  addScore(STATE.bossOn ? -70 : -50);

  coach('ระวัง! ของหวาน/ทอด ⚠️');
  emitQuest();
  maybeLogEvent('hit_junk', {});
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  emitQuest();
  maybeLogEvent('expire_good', {});
}

function makeSpawner(mount){
  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: baseRate,
    sizeRange:[44,64],
    kinds:[
      { kind:'good', weight:0.7 },
      { kind:'junk', weight:0.3 }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
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

export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  STATE.cfg = cfg;
  STATE.engineMount = mount;

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

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE._bossApplied = false;
  STATE._stormApplied = false;

  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  const run = (cfg.runMode || 'play').toLowerCase();
  STATE.rng = (run === 'research' || run === 'study')
    ? seededRng(cfg.seed || Date.now())
    : Math.random;

  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    gameMode:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,

    // pass context for logger friendliness
    studyId: cfg.studyId || '',
    phase: cfg.phase || '',
    conditionGroup: cfg.conditionGroup || '',
    sessionOrder: cfg.sessionOrder || '',
    blockLabel: cfg.blockLabel || '',
    siteCode: cfg.siteCode || '',
    schoolCode: cfg.schoolCode || '',
    schoolName: cfg.schoolName || '',
    gradeLevel: cfg.gradeLevel || '',
    studentKey: cfg.studentKey || ''
  });

  emitQuest();
  startTimer();

  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');
}