// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION PATCH A22)
// HHA Standard
// --------------------------------------------------------
// ✅ Works with /herohealth/vr/mode-factory.js (A21) export boot()
// ✅ Play / Research modes
//   - play: adaptive-ish ON (storm/boss intensity can scale)
//   - research/study: deterministic seed + stable settings (no adaptive spikes)
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end
// ✅ Crosshair/tap-to-shoot via vr-ui.js => mode-factory listens hha:shoot
// --------------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;

const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function seededRng(seed){
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

const STATE = {
  running:false,
  ended:false,

  // core
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  // time
  startAtMs:0,
  timeLeft:0,
  timer:null,

  // plate groups (5 หมู่)
  g:[0,0,0,0,0], // index 0..4

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // spawn counters (from engine events)
  spawnGood:0,
  spawnJunk:0,

  // phases
  bossOn:false,
  stormOn:false,
  bossUntil:0,
  stormUntil:0,

  // quest
  goal:{
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อย 1 ต่อหมู่)',
    cur:0, target:5, done:false
  },
  mini:{
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    cur:0, target:80, done:false
  },

  // cfg
  cfg:null,
  rng:Math.random,

  // spawner controller
  spawner:null
};

function coach(msg, tag='Coach'){
  emit('hha:coach', { msg, tag });
}

function emitScore(){
  emit('hha:score', { score: STATE.score, combo: STATE.combo, comboMax: STATE.comboMax });
}

function emitTime(){
  emit('hha:time', { leftSec: STATE.timeLeft });
}

function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function pct1(n){
  // keep 1 decimal max (stable)
  return Math.round((Number(n)||0) * 10) / 10;
}

function setBoss(on){
  STATE.bossOn = !!on;
  // optional UI fx hooks if page has #bossFx
  const el = document.getElementById('bossFx');
  if(el){
    el.classList.toggle('boss-on', STATE.bossOn);
    el.classList.toggle('boss-panic', STATE.bossOn && STATE.timeLeft <= 20);
  }
  emit('hha:judge', { kind:'boss', on: STATE.bossOn });
}

function setStorm(on){
  STATE.stormOn = !!on;
  const el = document.getElementById('stormFx');
  if(el) el.classList.toggle('storm-on', STATE.stormOn);
  emit('hha:judge', { kind:'storm', on: STATE.stormOn });
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
    allDone: (STATE.goal.done && STATE.mini.done)
  });
}

// ---- scoring ----
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

function addScore(v){
  STATE.score += (Number(v)||0);
  emitScore();
}

// ---- quest logic ----
function updateGoal(){
  if(STATE.goal.done) return;
  STATE.goal.cur = STATE.g.filter(v => v > 0).length;
  if(STATE.goal.cur >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Coach');
  }
}

function updateMini(){
  const accPct = accuracy() * 100;
  STATE.mini.cur = clamp(Math.round(accPct), 0, 100);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'Coach');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex ?? Math.floor(STATE.rng()*5), 0, 4);
  STATE.g[gi]++;

  addCombo();

  // score feels better: base + combo ramp + boss multiplier
  const mult = STATE.bossOn ? 1.35 : 1.0;
  addScore(Math.round((100 + STATE.combo * 6) * mult));

  updateGoal();
  updateMini();
  emitQuest();

  // tiny coach nudges
  if(STATE.combo === 10) coach('คอมโบสวยมาก! 🔥', 'Coach');
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++;
  resetCombo();

  // junk penalty stronger during boss (tension)
  const pen = STATE.bossOn ? -80 : -60;
  addScore(pen);

  // warning nudge
  if(STATE.miss % 3 === 1) coach('ระวังของหวาน/ทอด! ⚠️', 'Coach');

  updateMini();
  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;
  STATE.miss++;
  resetCombo();
  updateMini();
  emitQuest();
}

// ---- phases scheduling (play only) ----
function maybeStartStormBoss(){
  const cfg = STATE.cfg || {};
  const playLike = (cfg.runMode === 'play');

  // research/study => keep stable (no spikes)
  if(!playLike) return;

  // Storm: quick burst mid-game
  // Boss: near the end for excitement
  if(!STATE.stormOn && STATE.timeLeft === 55){
    STATE.stormOn = true;
    STATE.stormUntil = STATE.timeLeft - 8; // last ~8s
    setStorm(true);
    coach('STORM! 🌪️ เป้าโผล่รัวขึ้น!', 'System');

    // speed up spawning temporarily
    try{
      STATE.spawner?.destroy?.(); // rebuild with faster rate
    }catch(_){}
    STATE.spawner = makeSpawner(cfg.mountEl, { storm:true, boss:false });
  }

  if(STATE.stormOn && STATE.timeLeft <= STATE.stormUntil){
    STATE.stormOn = false;
    setStorm(false);

    // back to normal spawning
    try{ STATE.spawner?.destroy?.(); }catch(_){}
    STATE.spawner = makeSpawner(cfg.mountEl, { storm:false, boss:STATE.bossOn });
  }

  if(!STATE.bossOn && STATE.timeLeft === 22){
    STATE.bossOn = true;
    STATE.bossUntil = 0;
    setBoss(true);
    coach('BOSS! 👹 Junk เยอะขึ้น—คุมสติให้ดี!', 'System');

    // rebuild spawner with more junk
    try{ STATE.spawner?.destroy?.(); }catch(_){}
    STATE.spawner = makeSpawner(cfg.mountEl, { storm:STATE.stormOn, boss:true });
  }

  if(STATE.bossOn && STATE.timeLeft <= 4){
    // panic flash handled in setBoss()
    setBoss(true);
  }
}

// ---- timer ----
function startTimer(){
  emitTime();
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emitTime();

    // phase triggers
    maybeStartStormBoss();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

// ---- spawner factory ----
function makeSpawner(mount, phase={storm:false,boss:false}){
  const cfg = STATE.cfg || {};
  const diff = (cfg.diff || 'normal');

  // base difficulty
  const baseRate =
    (diff === 'hard') ? 760 :
    (diff === 'easy') ? 980 :
    880;

  // storm => faster
  const spawnRate = phase.storm ? Math.max(420, baseRate - 360) : baseRate;

  // ttl shorter in storm (pressure)
  const ttl = phase.storm ? 980 : 1300;

  // boss => more junk
  const goodW = phase.boss ? 0.58 : 0.70;
  const junkW = 1 - goodW;

  // emoji sets (simple, readable; can expand later)
  const GOOD = ['🥦','🍎','🐟','🍚','🥑'];
  const JUNK = ['🍟','🍩','🧁','🍔','🥤'];

  return spawnBoot({
    mount,
    seed: cfg.seed,
    spawnRate,
    ttl,
    sizeRange:[44, 64],
    kinds:[
      { kind:'good', weight: goodW, emoji: GOOD[Math.floor(STATE.rng()*GOOD.length)] },
      { kind:'junk', weight: junkW, emoji: JUNK[Math.floor(STATE.rng()*JUNK.length)] }
    ],
    onHit:(t)=>{
      if(t.kind === 'good'){
        onHitGood(t.groupIndex);
      }else{
        onHitJunk();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good') onExpireGood();
    }
  });
}

// ---- end game ----
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch(_){}
  STATE.timer = null;

  try{ STATE.spawner?.destroy?.(); }catch(_){}
  STATE.spawner = null;

  const playedSec = Math.max(0, Math.round((nowMs() - STATE.startAtMs)/1000));

  // build summary (compatible with hha-cloud-logger mapping)
  const summary = {
    projectTag: 'HeroHealth',
    game: 'plate',
    gameVersion: 'A22',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || '',
    durationPlannedSec: STATE.cfg?.durationPlannedSec || 90,
    durationPlayedSec: playedSec,

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    accuracyGoodPct: pct1(accuracy()*100),

    // group results
    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],

    // counters (for logger)
    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    // context passthrough
    studyId: STATE.cfg?.studyId || '',
    phase: STATE.cfg?.phase || '',
    conditionGroup: STATE.cfg?.conditionGroup || '',
    sessionOrder: STATE.cfg?.sessionOrder || '',
    blockLabel: STATE.cfg?.blockLabel || '',
    siteCode: STATE.cfg?.siteCode || '',
    device: STATE.cfg?.view || ''
  };

  emit('hha:end', summary);
}

// ---- public boot ----
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');
  cfg = cfg || {};

  // reset
  STATE.cfg = cfg;
  STATE.cfg.mountEl = mount; // keep for phase rebuild
  STATE.running = true;
  STATE.ended = false;

  STATE.score = 0;
  STATE.combo = 0;
  STATE.comboMax = 0;
  STATE.miss = 0;

  STATE.hitGood = 0;
  STATE.hitJunk = 0;
  STATE.expireGood = 0;

  STATE.spawnGood = 0;
  STATE.spawnJunk = 0;

  STATE.g = [0,0,0,0,0];

  STATE.goal.cur = 0;
  STATE.goal.done = false;
  STATE.mini.cur = 0;
  STATE.mini.done = false;

  STATE.startAtMs = nowMs();

  // RNG: research/study deterministic
  const mode = (cfg.runMode || 'play').toLowerCase();
  if(mode === 'research' || mode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    // play: still seeded-ish for variety but not deterministic requirement
    STATE.rng = seededRng(cfg.seed || Date.now());
  }

  // planned time (default 90)
  STATE.timeLeft = clamp(cfg.durationPlannedSec ?? cfg.time ?? 90, 20, 240);

  // init FX flags
  setStorm(false);
  setBoss(false);

  // fire start
  emit('hha:start', {
    projectTag: 'HeroHealth',
    game: 'plate',
    gameVersion: 'A22',
    runMode: mode,
    diff: cfg.diff || 'normal',
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,

    // passthrough
    studyId: cfg.studyId || '',
    phase: cfg.phase || '',
    conditionGroup: cfg.conditionGroup || '',
    sessionOrder: cfg.sessionOrder || '',
    blockLabel: cfg.blockLabel || '',
    siteCode: cfg.siteCode || '',
    device: cfg.view || ''
  });

  emitScore();
  emitQuest();
  startTimer();

  // build initial spawner
  STATE.spawner = makeSpawner(mount, { storm:false, boss:false });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}