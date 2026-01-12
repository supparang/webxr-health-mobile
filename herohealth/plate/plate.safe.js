// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION)
// HHA Standard + FUN PACK (Boss Decoy + Boss Survival Mini + Celebrate)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: boss+storm ON (fun), phase switching
//   - research/study: deterministic seed + boss/storm OFF by default (no surprise difficulty)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Optional event stream when ?events=1 via hha:event
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

  // quest (goal + mini)
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่',
    cur:0,
    target:5,
    done:false
  },
  mini:{
    // default mini (accuracy) before boss overrides it
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0,
    target:80,
    done:false
  },

  // boss mini (survive without junk)
  bossMini:{
    active:false,
    done:false,
    cur:0,
    target:10,  // seconds
    timer:null
  },

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  cfg:null,
  rng:Math.random,

  engine:null,
  engineMount:null,

  bossOn:false,
  stormOn:false,
  _bossApplied:false,
  _stormApplied:false,

  // decoy system
  decoyOn:false,
  decoyUntil:0,        // ms epoch
  decoyCooldownUntil:0 // ms epoch
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

function celebrate(){
  try{
    if(WIN.Particles && typeof WIN.Particles.celebrate === 'function'){
      WIN.Particles.celebrate();
    }
  }catch(_){}
}

function maybeLogEvent(type, data={}){
  if(!STATE.cfg?.logEvents) return;
  emit('hha:event', Object.assign({
    game:'plate',
    type,
    t: Date.now(),
    leftSec: STATE.timeLeft,
    score: STATE.score,
    combo: STATE.combo,
    bossOn: STATE.bossOn,
    stormOn: STATE.stormOn,
    decoyOn: STATE.decoyOn
  }, data));
}

function emitQuest(){
  // During boss: show boss mini as "mini quest" for clarity
  const useBossMini = STATE.bossMini.active && !STATE.bossMini.done;

  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target
    },
    mini: useBossMini ? {
      name: '🛡️ รอดบอส',
      sub: '10 วิ ห้ามโดนของหวาน/ทอด',
      cur: STATE.bossMini.cur,
      target: STATE.bossMini.target,
      done: STATE.bossMini.done
    } : {
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done
    },
    allDone: STATE.goal.done && (useBossMini ? STATE.bossMini.done : STATE.mini.done)
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

  // clear boss mini timer
  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = null;

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
    miniCleared: (STATE.bossMini.done || STATE.mini.done) ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct(accuracy() * 100),

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

    bossOn: STATE.bossOn,
    stormOn: STATE.stormOn
  });
}

/* -----------------------------
   Spawner rebuild helpers
------------------------------*/
function rebuildSpawner({ spawnRate, goodW, junkW }){
  try{
    if(STATE.engine && typeof STATE.engine.destroy === 'function') STATE.engine.destroy();
    else if(STATE.engine && typeof STATE.engine.stop === 'function') STATE.engine.stop();
  }catch(_){}

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
      // ✅ decoy flip: temporarily invert kind when decoyOn
      const kind = (STATE.decoyOn)
        ? (t.kind === 'good' ? 'junk' : 'good')
        : t.kind;

      if(kind === 'good'){
        const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      // expire handling: if decoyOn and this is a "good" visually but treated as junk, we should not count expireGood
      // keep it simple: expire only penalizes if underlying t.kind is good AND decoy is OFF.
      if(!STATE.decoyOn && t.kind === 'good') onExpireGood();
    }
  });
}

/* -----------------------------
   Boss / Storm
------------------------------*/
function startBossMini(){
  if(STATE.bossMini.active || STATE.bossMini.done) return;

  STATE.bossMini.active = true;
  STATE.bossMini.cur = 0;

  // clear existing
  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    if(!STATE.bossMini.active || STATE.bossMini.done) return;

    STATE.bossMini.cur++;
    emitQuest();

    if(STATE.bossMini.cur >= STATE.bossMini.target){
      STATE.bossMini.done = true;
      STATE.bossMini.active = false;

      // big reward + celebrate
      addScore(350);
      celebrate();
      coach('สุดยอด! รอดบอสครบ 10 วิ 🎉 +350', 'Boss');

      maybeLogEvent('bossmini_complete', { bonus:350 });
      emitQuest();
    }
  }, 1000);

  coach('🛡️ มินิเควส: รอด 10 วิ ห้ามโดนของหวาน/ทอด!', 'Boss');
  maybeLogEvent('bossmini_start', { target: STATE.bossMini.target });
  emitQuest();
}

function applyBossIfNeeded(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(STATE._bossApplied) return;

  const trigger = (STATE.goal.done === true) || (STATE.timeLeft <= 35);
  if(!trigger) return;

  STATE._bossApplied = true;
  STATE.bossOn = true;

  const baseRate = (STATE.cfg.diff === 'hard') ? 700 : 900;
  const bossRate = Math.max(620, Math.round(baseRate * 0.92));

  setFx('bossFx','boss-on', true);
  coach('👿 BOSS มาแล้ว! ของหวาน/ทอดเยอะขึ้น!', 'Boss');

  // boss mix
  rebuildSpawner({ spawnRate: bossRate, goodW:0.58, junkW:0.42 });
  maybeLogEvent('phase_boss_on', { bossRate, goodW:0.58, junkW:0.42 });

  // start boss mini right away (once)
  startBossMini();
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

  if(STATE.bossOn) rebuildSpawner({ spawnRate: stormRate, goodW:0.58, junkW:0.42 });
  else rebuildSpawner({ spawnRate: stormRate, goodW:0.70, junkW:0.30 });

  maybeLogEvent('phase_storm_on', { stormRate });
}

/* -----------------------------
   Decoy (Boss trick)
   - every ~7-11s in boss: turn ON for 2-3s
   - cooldown so it doesn't spam
------------------------------*/
function maybeDecoyTick(){
  const run = (STATE.cfg?.runMode || 'play').toLowerCase();
  if(run !== 'play') return;
  if(!STATE.bossOn) return;

  const now = Date.now();

  // turn off if expired
  if(STATE.decoyOn && now >= STATE.decoyUntil){
    STATE.decoyOn = false;
    coach('✅ ของลวงหายไปแล้ว เล่นต่อได้', 'Boss');
    maybeLogEvent('decoy_off', {});
    return;
  }

  // if still on, do nothing
  if(STATE.decoyOn) return;

  // cooldown
  if(now < STATE.decoyCooldownUntil) return;

  // random trigger chance (gentle): about once every ~7-11 seconds
  // we use RNG but keep it stable-ish
  const p = 0.14; // tick per second => expected ~7s
  if(STATE.rng() > p) return;

  // enable decoy for 2-3s
  const dur = 2000 + Math.floor(STATE.rng()*1200);
  STATE.decoyOn = true;
  STATE.decoyUntil = now + dur;

  // cooldown next window 7-11s
  const cd = 7000 + Math.floor(STATE.rng()*4000);
  STATE.decoyCooldownUntil = now + cd;

  coach('😵 ของลวงมา! ระวังดี ๆ (สลับดี/ไม่ดีชั่วคราว)', 'Boss');
  maybeLogEvent('decoy_on', { durMs: dur, cooldownMs: cd });
}

/* -----------------------------
   Timer
------------------------------*/
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;

    // phases
    applyBossIfNeeded();
    applyStormIfNeeded();

    // decoy tick (boss trick)
    maybeDecoyTick();

    emit('hha:time', { leftSec: STATE.timeLeft });

    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* -----------------------------
   Hit handlers
------------------------------*/
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
      celebrate();
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');

      // boss can trigger immediately after goal done
      applyBossIfNeeded();
    }
  }

  // mini (accuracy) only when bossMini not active
  if(!(STATE.bossMini.active || STATE.bossMini.done)){
    const accPct = accuracy() * 100;
    STATE.mini.cur = Math.round(accPct);
    if(!STATE.mini.done && accPct >= STATE.mini.target){
      STATE.mini.done = true;
      celebrate();
      coach('ความแม่นยำดีมาก! 👍', 'Coach');
    }
  }

  emitQuest();
  maybeLogEvent('hit_good', { groupIndex });
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  addScore(STATE.bossOn ? -70 : -50);

  // if boss mini active, fail it immediately
  if(STATE.bossMini.active && !STATE.bossMini.done){
    STATE.bossMini.active = false;
    try{ clearInterval(STATE.bossMini.timer); }catch(_){}
    STATE.bossMini.timer = null;

    coach('❌ โดนของหวาน/ทอด! มินิเควสล้มเหลว', 'Boss');
    maybeLogEvent('bossmini_fail', {});
  } else {
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Coach');
  }

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

/* -----------------------------
   Base spawner
------------------------------*/
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
      const kind = (STATE.decoyOn)
        ? (t.kind === 'good' ? 'junk' : 'good')
        : t.kind;

      if(kind === 'good'){
        const gi = t.groupIndex ?? Math.floor(STATE.rng()*5);
        onHitGood(gi);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(!STATE.decoyOn && t.kind === 'good') onExpireGood();
    }
  });
}

/* -----------------------------
   Boot
------------------------------*/
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

  STATE.bossMini.active = false;
  STATE.bossMini.done = false;
  STATE.bossMini.cur = 0;
  try{ clearInterval(STATE.bossMini.timer); }catch(_){}
  STATE.bossMini.timer = null;

  STATE.bossOn = false;
  STATE.stormOn = false;
  STATE._bossApplied = false;
  STATE._stormApplied = false;

  STATE.decoyOn = false;
  STATE.decoyUntil = 0;
  STATE.decoyCooldownUntil = 0;

  setFx('bossFx','boss-on', false);
  setFx('bossFx','boss-panic', false);
  setFx('stormFx','storm-on', false);

  const run = (cfg.runMode || 'play').toLowerCase();
  STATE.rng = (run === 'research' || run === 'study')
    ? seededRng(cfg.seed || Date.now())
    : Math.random;

  // ✅ keep 90 as friendly default (boot.js sets time=90 already)
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  emit('hha:start', {
    game:'plate',
    gameMode:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,

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

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}