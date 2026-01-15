// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Emits:
//   hha:start, hha:score, hha:time, quest:update,
//   hha:coach, hha:judge, hha:end, hha:storm, hha:boss
// ✅ Fun packs (kid-friendly, fast loop):
//   - Goal + Mini (mini clears -> rotate immediately)
//   - Storm phase (pressure, short, readable)
//   - Boss Plate Rush (decoy + speed spike)
//   - Shield pickup (blocks 1 miss on junk/expire good)
// ✅ Input:
//   - Click/tap on target (pc/mobile)
//   - Crosshair shoot: window 'hha:shoot' (cVR/VR) -> aim assist lockPx via vr-ui.js
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';

const WIN = window;
const DOC = document;

/* ------------------------------------------------
 * Utilities
 * ------------------------------------------------ */
const clamp = (v, a, b) => {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
};

function nowMs(){ return Date.now(); }

function pctInt(n){
  n = Number(n) || 0;
  return Math.round(n);
}

function seededRng(seed){
  let t = (seed >>> 0) || 1;
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
 * Engine state
 * ------------------------------------------------ */
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
  gNeedMask:[1,1,1,1,1], // used for goal "ครบ 5 หมู่"

  // counters
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shots:0,
  hits:0,

  // shield
  shield:0,

  // runtime cfg
  cfg:null,
  rng:Math.random,

  // spawner engine
  engine:null,

  // difficulty director (play only)
  dd:{
    spawnMsBase: 900,
    spawnMs: 900,
    sizeMin: 44,
    sizeMax: 64,
    junkW: 0.30,
    goodW: 0.70
  },

  // phases
  storm:{
    active:false,
    endsAt:0,
    mode:'none' // 'wind' | 'blink' | 'mix'
  },
  boss:{
    active:false,
    endsAt:0,
    decoyW:0.0
  },

  // quest director
  goal:null,
  mini:null,

  // mini rotation index
  miniIdx:0,

  // rt tracking (optional)
  lastSpawnAtById:new Map(),
  rtSamples:[],

  // ai hooks (OFF by default)
  ai:{
    enabled:false,
    // placeholders for future modules
    onEvent:null
  }
};

/* ------------------------------------------------
 * Accuracy + grade
 * ------------------------------------------------ */
function accuracy(){
  // include expireGood as "missed good"
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function gradeFromAcc(acc){
  // acc in [0..1]
  if(acc >= 0.92) return 'A';
  if(acc >= 0.84) return 'B';
  if(acc >= 0.72) return 'C';
  return 'D';
}

/* ------------------------------------------------
 * Quest templates
 * ------------------------------------------------ */
const GOALS = [
  {
    key:'fill5',
    name:'เติมจานให้ครบ 5 หมู่',
    sub:'เก็บอาหารให้ครบทุกหมู่ (อย่างน้อยหมู่ละ 1)',
    target:5
  },
  {
    key:'score',
    name:'ทำคะแนนให้ถึงเป้า',
    sub:'เก็บให้แม่นแล้วคอมโบจะช่วย',
    targetByDiff:{ easy:2200, normal:3200, hard:4200 }
  },
  {
    key:'survive',
    name:'อยู่รอดแบบพลาดน้อย',
    sub:'พลาดไม่เกิน 5 ครั้ง',
    targetByDiff:{ easy:6, normal:5, hard:4 }
  }
];

const MINIS = [
  {
    key:'acc80',
    name:'ความแม่นยำ',
    sub:'คุมความแม่น ≥ 80%',
    target:80,
    kind:'metric'
  },
  {
    key:'combo6',
    name:'คอมโบพุ่ง!',
    sub:'ทำคอมโบ ≥ 6',
    target:6,
    kind:'metric'
  },
  {
    key:'noJunk10',
    name:'ห้ามพลาดของหวาน',
    sub:'เก็บ “ดี” 10 ครั้ง โดยไม่โดน junk',
    target:10,
    kind:'sequence'
  },
  {
    key:'speed3',
    name:'มือไว!',
    sub:'เก็บดี 3 ครั้งติดแบบไว (RT < 650ms)',
    target:3,
    kind:'speed'
  }
];

/* ------------------------------------------------
 * Quest state helpers
 * ------------------------------------------------ */
function pickGoal(){
  // for now: always start with fill5 (kid friendly), then rotate based on progress
  // In research: keep deterministic ordering
  const diff = (STATE.cfg.diff || 'normal');
  const idx = 0; // always fill5
  const g0 = GOALS[idx];

  const goal = {
    key: g0.key,
    name: g0.name,
    sub: g0.sub,
    cur: 0,
    target: g0.target ?? (g0.targetByDiff?.[diff] ?? 1),
    done:false
  };
  return goal;
}

function pickMini(){
  const m = MINIS[STATE.miniIdx % MINIS.length];
  STATE.miniIdx++;
  return {
    key:m.key,
    name:m.name,
    sub:m.sub,
    kind:m.kind,
    cur:0,
    target:m.target,
    done:false,
    // sequence mini needs state
    seqGood:0,
    seqNoJunkOk:true,
    speedSeq:0
  };
}

function emitQuest(){
  emit('quest:update', {
    goal:{
      name: STATE.goal.name,
      sub: STATE.goal.sub,
      cur: STATE.goal.cur,
      target: STATE.goal.target,
      done: STATE.goal.done,
      key: STATE.goal.key
    },
    mini:{
      name: STATE.mini.name,
      sub: STATE.mini.sub,
      cur: STATE.mini.cur,
      target: STATE.mini.target,
      done: STATE.mini.done,
      key: STATE.mini.key
    },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------------------------------
 * Score + combo
 * ------------------------------------------------ */
function emitScore(){
  emit('hha:score', {
    score: STATE.score,
    combo: STATE.combo,
    comboMax: STATE.comboMax,
    miss: STATE.miss,
    shield: STATE.shield,
    accPct: pctInt(accuracy()*100),
    grade: gradeFromAcc(accuracy())
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

/* ------------------------------------------------
 * Miss / shield logic
 * ------------------------------------------------ */
function applyMiss(reason){
  // shield blocks 1 miss (except if reason is "system")
  if(STATE.shield > 0){
    STATE.shield--;
    emit('hha:judge', { kind:'shield-block', reason });
    coach('โล่ช่วยไว้! 🛡️', 'Shield');
    emitScore();
    return false;
  }

  STATE.miss++;
  resetCombo();
  emit('hha:judge', { kind:'miss', reason });
  emitScore();
  return true;
}

/* ------------------------------------------------
 * Storm + Boss phases
 * ------------------------------------------------ */
function stormStart(mode='mix', durationMs=6500){
  if(STATE.storm.active) return;
  STATE.storm.active = true;
  STATE.storm.mode = mode;
  STATE.storm.endsAt = nowMs() + durationMs;

  // visual hooks (CSS classes)
  const fx = DOC.getElementById('stormFx');
  if(fx) fx.classList.add('storm-on');

  emit('hha:storm', { on:true, mode, durationMs });
  coach('พายุมาแล้ว! 🌪️ จับตาให้ดี', 'Storm');

  // temporary pressure
  if(STATE.cfg.runMode === 'play'){
    STATE.dd.spawnMs = Math.max(520, Math.round(STATE.dd.spawnMs * 0.78));
    STATE.dd.junkW = Math.min(0.42, STATE.dd.junkW + 0.06);
  }
}

function stormStop(){
  if(!STATE.storm.active) return;
  STATE.storm.active = false;

  const fx = DOC.getElementById('stormFx');
  if(fx) fx.classList.remove('storm-on');

  emit('hha:storm', { on:false });
  coach('พายุผ่านไปแล้ว 😮‍💨', 'Storm');
}

function bossStart(durationMs=9000){
  if(STATE.boss.active) return;
  STATE.boss.active = true;
  STATE.boss.endsAt = nowMs() + durationMs;

  const fx = DOC.getElementById('bossFx');
  if(fx){
    fx.classList.add('boss-on');
    // add panic later near end
    fx.classList.remove('boss-panic');
  }

  // boss pressure: more spawns + add decoys
  if(STATE.cfg.runMode === 'play'){
    STATE.dd.spawnMs = Math.max(460, Math.round(STATE.dd.spawnMs * 0.72));
    STATE.boss.decoyW = 0.14; // decoy weight
  }

  emit('hha:boss', { on:true, durationMs });
  coach('บอสมา! 👹 Plate Rush!', 'Boss');
}

function bossStop(){
  if(!STATE.boss.active) return;
  STATE.boss.active = false;
  STATE.boss.decoyW = 0;

  const fx = DOC.getElementById('bossFx');
  if(fx){
    fx.classList.remove('boss-on');
    fx.classList.remove('boss-panic');
  }

  emit('hha:boss', { on:false });
  coach('ผ่านบอสแล้ว! 🎉', 'Boss');
}

/* ------------------------------------------------
 * Adaptive director (play only)
 * ------------------------------------------------ */
function initDD(){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  // base by diff
  const base = (diff === 'easy') ? 980 : (diff === 'hard' ? 760 : 880);
  const sizeMin = (diff === 'hard') ? 40 : 44;
  const sizeMax = (diff === 'hard') ? 60 : 64;
  const junkW = (diff === 'easy') ? 0.24 : (diff === 'hard' ? 0.34 : 0.30);

  STATE.dd.spawnMsBase = base;
  STATE.dd.spawnMs = base;
  STATE.dd.sizeMin = sizeMin;
  STATE.dd.sizeMax = sizeMax;
  STATE.dd.junkW = junkW;
  STATE.dd.goodW = 1 - junkW;
}

function ddTick(){
  if(STATE.cfg.runMode !== 'play') return;

  // simple pressure: if combo high and misses low -> speed up a bit
  const acc = accuracy();
  const speedUp = (STATE.combo >= 5 && STATE.miss <= 2 && acc >= 0.78);
  const slowDown = (STATE.miss >= 5 || acc < 0.60);

  let target = STATE.dd.spawnMsBase;

  if(speedUp) target = Math.round(target * 0.86);
  if(slowDown) target = Math.round(target * 1.12);

  // also time pressure near end
  if(STATE.timeLeft <= 18) target = Math.round(target * 0.88);

  // clamp
  target = clamp(target, 520, 1200);

  // smooth approach
  STATE.dd.spawnMs = Math.round(STATE.dd.spawnMs * 0.85 + target * 0.15);

  // junk weight slightly rises if player too accurate (keep excitement)
  if(acc >= 0.86 && STATE.miss <= 3){
    STATE.dd.junkW = Math.min(0.40, STATE.dd.junkW + 0.004);
  }else{
    // relax back to base
    const diff = (STATE.cfg.diff || 'normal').toLowerCase();
    const baseJ = (diff === 'easy') ? 0.24 : (diff === 'hard' ? 0.34 : 0.30);
    STATE.dd.junkW = STATE.dd.junkW * 0.92 + baseJ * 0.08;
  }
  STATE.dd.goodW = 1 - STATE.dd.junkW;
}

/* ------------------------------------------------
 * Goal + mini update
 * ------------------------------------------------ */
function updateGoal(){
  if(STATE.goal.done) return;

  if(STATE.goal.key === 'fill5'){
    STATE.goal.cur = STATE.g.filter(v => v > 0).length;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      emit('hha:judge', { kind:'goal-complete', key:STATE.goal.key });
      coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'Goal');
    }
  }else if(STATE.goal.key === 'score'){
    STATE.goal.cur = STATE.score;
    if(STATE.goal.cur >= STATE.goal.target){
      STATE.goal.done = true;
      emit('hha:judge', { kind:'goal-complete', key:STATE.goal.key });
      coach('คะแนนถึงเป้าแล้ว! 🏆', 'Goal');
    }
  }else if(STATE.goal.key === 'survive'){
    // target = max misses allowed (reverse logic)
    STATE.goal.cur = clamp(STATE.goal.target - STATE.miss, 0, STATE.goal.target);
    if(STATE.miss <= STATE.goal.target){
      // done only at end? keep it simple: done when time left < 10 and misses ok
      if(STATE.timeLeft <= 10){
        STATE.goal.done = true;
        emit('hha:judge', { kind:'goal-complete', key:STATE.goal.key });
        coach('อยู่รอดได้! เก่งมาก 😮‍💨', 'Goal');
      }
    }
  }
}

function miniRotate(){
  STATE.mini = pickMini();
  emit('hha:judge', { kind:'mini-rotate', key:STATE.mini.key });
  coach(`มินิเควสใหม่: ${STATE.mini.name} ⚡`, 'Mini');
  emitQuest();
}

function updateMini(){
  if(STATE.mini.done) return;

  const m = STATE.mini;

  if(m.key === 'acc80'){
    const ap = accuracy()*100;
    m.cur = pctInt(ap);
    if(ap >= m.target){
      m.done = true;
      emit('hha:judge', { kind:'mini-complete', key:m.key });
      coach('ความแม่นยำดีมาก! 👍', 'Mini');
      miniRotate();
    }
  }
  else if(m.key === 'combo6'){
    m.cur = STATE.comboMax;
    if(m.cur >= m.target){
      m.done = true;
      emit('hha:judge', { kind:'mini-complete', key:m.key });
      coach('คอมโบทะลุ! 🔥', 'Mini');
      miniRotate();
    }
  }
  else if(m.key === 'noJunk10'){
    // succeed: 10 good hits without junk hit since mini start
    m.cur = m.seqGood;
    if(m.cur >= m.target){
      m.done = true;
      emit('hha:judge', { kind:'mini-complete', key:m.key });
      coach('สุดยอด! ไม่โดน junk เลย 😎', 'Mini');
      miniRotate();
    }
  }
  else if(m.key === 'speed3'){
    m.cur = m.speedSeq;
    if(m.cur >= m.target){
      m.done = true;
      emit('hha:judge', { kind:'mini-complete', key:m.key });
      coach('มือไวมาก! ⚡', 'Mini');
      miniRotate();
    }
  }
}

/* ------------------------------------------------
 * End game
 * ------------------------------------------------ */
function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;
  clearInterval(STATE.timer);

  // stop phases
  stormStop();
  bossStop();

  const accPct = pctInt(accuracy()*100);
  const grade = gradeFromAcc(accuracy());

  emit('hha:end', {
    reason,
    gameMode:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    durationPlannedSec: STATE.cfg.durationPlannedSec,
    durationPlayedSec: (STATE.cfg.durationPlannedSec - STATE.timeLeft),

    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: 0,   // we rotate minis; for summary we can expose count
    miniTotal: 0,

    accuracyGoodPct: accPct,
    grade,

    nHitGood: STATE.hitGood,
    nHitJunk: STATE.hitJunk,
    nExpireGood: STATE.expireGood,

    shieldLeft: STATE.shield,

    g1: STATE.g[0],
    g2: STATE.g[1],
    g3: STATE.g[2],
    g4: STATE.g[3],
    g5: STATE.g[4]
  });
}

/* ------------------------------------------------
 * Timer
 * ------------------------------------------------ */
function startTimer(){
  emit('hha:time', { leftSec: STATE.timeLeft });

  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;

    STATE.timeLeft--;
    emit('hha:time', { leftSec: STATE.timeLeft });

    // tick director
    ddTick();

    // schedule phases in play (not in study/research)
    if(STATE.cfg.runMode === 'play'){
      // storm around mid
      if(!STATE.storm.active && STATE.timeLeft === Math.floor(STATE.cfg.durationPlannedSec * 0.55)){
        stormStart('mix', 6500);
      }
      // boss near end
      if(!STATE.boss.active && STATE.timeLeft === Math.floor(STATE.cfg.durationPlannedSec * 0.28)){
        bossStart(9000);
      }
    }

    // phase expiry
    if(STATE.storm.active && nowMs() >= STATE.storm.endsAt) stormStop();
    if(STATE.boss.active){
      // panic last 2.2s
      const fx = DOC.getElementById('bossFx');
      if(fx && !fx.classList.contains('boss-panic') && (STATE.boss.endsAt - nowMs() <= 2200)){
        fx.classList.add('boss-panic');
      }
      if(nowMs() >= STATE.boss.endsAt) bossStop();
    }

    // goal/mini update
    updateGoal();
    updateMini();
    emitQuest();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

/* ------------------------------------------------
 * Hit handlers + FX
 * ------------------------------------------------ */
function maybeSpawnShield(){
  // small chance after good hit (play only); deterministic in study due to seeded rng
  if(STATE.cfg.runMode !== 'play') return false;
  const roll = STATE.rng();
  if(roll < 0.06 && STATE.shield < 2){
    STATE.shield++;
    emit('hha:judge', { kind:'shield-gain' });
    coach('ได้โล่! 🛡️', 'Shield');
    emitScore();
    return true;
  }
  return false;
}

function onHitGood(groupIndex, meta={}){
  STATE.hitGood++;
  STATE.hits++;

  // RT sample if provided
  if(meta && meta.rtMs != null){
    STATE.rtSamples.push(Number(meta.rtMs)||0);
  }

  // group
  const gi = clamp(groupIndex, 0, 4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo * 6);

  // mini state updates
  if(STATE.mini.key === 'noJunk10'){
    STATE.mini.seqGood++;
  }
  if(STATE.mini.key === 'speed3'){
    if(meta && meta.rtMs != null && Number(meta.rtMs) < 650){
      STATE.mini.speedSeq++;
    }else{
      STATE.mini.speedSeq = 0;
    }
  }

  // goal/mini update
  updateGoal();
  updateMini();
  emitQuest();

  // reward
  maybeSpawnShield();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.hits++;

  // mini "noJunk10" fails reset counter
  if(STATE.mini.key === 'noJunk10'){
    STATE.mini.seqGood = 0;
  }

  const missed = applyMiss('hit-junk');
  if(missed){
    addScore(-60);
    coach('ระวัง! ของหวาน/ทอด ⚠️', 'Hint');
  }else{
    // shield blocked, do not punish score
  }

  emitQuest();
}

function onExpireGood(){
  STATE.expireGood++;

  // expire good counts as miss unless shield blocks
  const missed = applyMiss('good-expire');
  if(missed){
    // no score gain, slight penalty
    addScore(-20);
  }
  emitQuest();
}

/* ------------------------------------------------
 * Input: crosshair shoot support
 * ------------------------------------------------ */
function installShootListener(){
  // mode-factory should also listen to clicks; here we forward hha:shoot as a synthetic click
  // but only if engine exposes a "shootAt" method
  WIN.addEventListener('hha:shoot', (e)=>{
    const d = e.detail || {};
    if(!STATE.running || STATE.ended) return;
    if(!STATE.engine || typeof STATE.engine.shootAt !== 'function') return;

    // expected normalized coords OR pixels; engine decides
    STATE.shots++;
    STATE.engine.shootAt({
      x: d.x, y: d.y,
      lockPx: d.lockPx,
      source: d.source || 'shoot'
    });
  }, { passive:true });
}

/* ------------------------------------------------
 * Spawn logic wrapper
 * ------------------------------------------------ */
function buildSpawnConfig(mount){
  const diff = (STATE.cfg.diff || 'normal').toLowerCase();
  const baseMs = (diff === 'easy') ? 980 : (diff === 'hard' ? 760 : 880);

  // if play -> adaptive director; else fixed
  const spawnMs = (STATE.cfg.runMode === 'play') ? STATE.dd.spawnMs : baseMs;

  const kinds = [];

  // decoy kind (boss only)
  if(STATE.boss.active && STATE.boss.decoyW > 0){
    kinds.push({ kind:'decoy', weight: STATE.boss.decoyW });
  }

  // shield kind (rare, mainly play)
  if(STATE.cfg.runMode === 'play' && STATE.shield < 2){
    kinds.push({ kind:'shield', weight: 0.06 });
  }

  // main kinds
  kinds.push({ kind:'good', weight: (STATE.cfg.runMode === 'play') ? STATE.dd.goodW : 0.70 });
  kinds.push({ kind:'junk', weight: (STATE.cfg.runMode === 'play') ? STATE.dd.junkW : 0.30 });

  return {
    mount,
    seed: STATE.cfg.seed,
    spawnRate: spawnMs, // ms
    sizeRange: [
      (STATE.cfg.runMode === 'play') ? STATE.dd.sizeMin : 44,
      (STATE.cfg.runMode === 'play') ? STATE.dd.sizeMax : 64
    ],
    kinds,

    // optional storm behavior flags (mode-factory may ignore)
    stormMode: STATE.storm.active ? STATE.storm.mode : 'none',

    // on hit / expire
    onHit:(t)=>{
      // t = { kind, groupIndex?, id?, spawnedAt?, ... }
      if(t.kind === 'good'){
        const gi = (t.groupIndex != null) ? t.groupIndex : Math.floor(STATE.rng()*5);
        const rtMs = (t.spawnedAt != null) ? (nowMs() - Number(t.spawnedAt)) : null;
        onHitGood(gi, { rtMs });
        emit('hha:judge', { kind:'hit-good', groupIndex:gi, rtMs });
      }else if(t.kind === 'junk'){
        onHitJunk();
        emit('hha:judge', { kind:'hit-junk' });
      }else if(t.kind === 'shield'){
        STATE.shield = Math.min(3, STATE.shield + 1);
        emit('hha:judge', { kind:'hit-shield' });
        coach('รับโล่เพิ่ม! 🛡️', 'Shield');
        emitScore();
      }else if(t.kind === 'decoy'){
        // decoy punishes only combo
        resetCombo();
        emit('hha:judge', { kind:'hit-decoy' });
        coach('อุ๊ย! ตัวหลอก 😵', 'Boss');
        emitScore();
      }
    },
    onExpire:(t)=>{
      if(t.kind === 'good'){
        onExpireGood();
        emit('hha:judge', { kind:'expire-good' });
      }
    }
  };
}

function rebuildSpawner(){
  if(!STATE.engine) return;

  // if mode-factory provides updateConfig, use it; else recreate
  const mount = STATE.engine.__mount || DOC.getElementById('plate-layer');
  const cfg = buildSpawnConfig(mount);

  if(typeof STATE.engine.updateConfig === 'function'){
    STATE.engine.updateConfig(cfg);
    return;
  }
  if(typeof STATE.engine.destroy === 'function'){
    STATE.engine.destroy();
  }
  STATE.engine = spawnBoot(cfg);
}

/* ------------------------------------------------
 * Main boot
 * ------------------------------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  // reset runtime
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
  STATE.shots = 0;
  STATE.hits = 0;

  STATE.shield = 0;

  STATE.g = [0,0,0,0,0];
  STATE.gNeedMask = [1,1,1,1,1];

  STATE.rtSamples = [];
  STATE.lastSpawnAtById = new Map();

  // rng
  const runMode = (String(cfg.runMode||'play')).toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || 13579);
  }else{
    // allow seed in play for replay if provided
    STATE.rng = (cfg.seed != null) ? seededRng(Number(cfg.seed)||Date.now()) : Math.random;
  }

  // dd init
  initDD();

  // timer duration
  STATE.timeLeft = Number(cfg.durationPlannedSec) || 90;

  // quest init
  STATE.miniIdx = 0;
  STATE.goal = pickGoal();
  STATE.mini = pickMini();

  // phases reset
  STATE.storm.active = false;
  STATE.boss.active = false;
  stormStop();
  bossStop();

  // emit start
  emit('hha:start', {
    game:'plate',
    runMode,
    diff: cfg.diff || 'normal',
    seed: cfg.seed,
    durationPlannedSec: STATE.timeLeft,
    view: cfg.view || ''
  });

  emitQuest();
  emitScore();

  // start spawner
  const spawnCfg = buildSpawnConfig(mount);
  STATE.engine = spawnBoot(spawnCfg);

  // install crosshair shoot hook (if engine supports shootAt)
  installShootListener();

  // start timer
  startTimer();

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'Coach');
}