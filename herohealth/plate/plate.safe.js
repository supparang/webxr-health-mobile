// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION vNEXT)
// HHA Standard
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive + waves/storm/boss ON (seeded)
//   - research/study: deterministic seed + adaptive OFF + waves OFF
// ✅ Fix: spawn bias toward missing groups early game
// ✅ Uses decorateTarget(el,target) from mode-factory.js
// ✅ Counts shot_miss as miss + included in accuracy
// ✅ End summary schema: miss + missJunk/missExpire/missShot + accuracyPct + grade + timePlannedSec
// ------------------------------------------------

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

const WIN = window;

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gradeFromScore(score){
  score = Number(score)||0;
  if(score >= 2600) return 'S';
  if(score >= 1900) return 'A';
  if(score >= 1300) return 'B';
  if(score >= 800)  return 'C';
  return 'D';
}

const STATE = {
  running:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,

  // ✅ miss breakdown
  miss:0,
  missJunk:0,
  missExpire:0,
  missShot:0,

  timeLeft:0,
  timePlannedSec:0,
  timer:null,

  // plate groups counts (index 0..4 => groupId 1..5)
  g:[0,0,0,0,0],

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

  // judged counters (for accuracy)
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shotMiss:0,

  cfg:null,
  rng:Math.random,

  engine:null,

  // spawn director
  spawnSeen:[false,false,false,false,false],

  // wave director
  wave:{
    on:false,
    phase:'base',   // base | storm | boss
    t0:0,
    nextAt:0,
    until:0,
    baseSpawn:900,
    baseTTLGood:2100,
    baseTTLJunk:1700,
    baseLockPx:28
  },
};

/* ------------------------ events ------------------------ */
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name,{ detail })); }catch{}
}
function coach(msg, tag='Coach'){ emit('hha:coach',{ msg, tag }); }

function emitQuest(){
  emit('quest:update',{
    goal:{ ...STATE.goal },
    mini:{ ...STATE.mini },
    allDone: STATE.goal.done && STATE.mini.done
  });
}

/* ------------------------ scoring ------------------------ */
function addScore(v){
  STATE.score += (Number(v)||0);
  emit('hha:score',{ score:STATE.score, combo:STATE.combo, comboMax:STATE.comboMax });
}
function addCombo(){
  STATE.combo++;
  STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
}
function resetCombo(){ STATE.combo = 0; }

/* ------------------------ accuracy ------------------------ */
// ✅ include shot miss in judged total (challenge!)
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood + STATE.shotMiss;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}
function updateMiniFromAccuracy(){
  const accPct = accuracy()*100;
  STATE.mini.cur = clamp(Math.round(accPct),0,100);
  if(!STATE.mini.done && accPct >= STATE.mini.target){
    STATE.mini.done = true;
    coach('ความแม่นยำดีมาก! 👍');
  }
}

/* ------------------------ end ------------------------ */
function stopSpawner(){
  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function endGame(reason='timeup'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  stopSpawner();

  const accPct1Dec = Math.round(accuracy()*1000)/10;
  const grade = gradeFromScore(STATE.score);

  emit('hha:end',{
    reason,
    runMode:(STATE.cfg?.runMode||'play'),
    diff:(STATE.cfg?.diff||'normal'),
    seed:(STATE.cfg?.seed||0),
    timePlannedSec:Number(STATE.timePlannedSec||0)||0,

    scoreFinal: STATE.score|0,
    comboMax: STATE.comboMax|0,

    // ✅ canonical miss + breakdown
    miss: STATE.miss|0,
    missJunk: STATE.missJunk|0,
    missExpire: STATE.missExpire|0,
    missShot: STATE.missShot|0,

    accuracyPct: accPct1Dec,
    grade,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.mini.done ? 1 : 0,
    miniTotal: 1,

    g1:STATE.g[0], g2:STATE.g[1], g3:STATE.g[2], g4:STATE.g[3], g5:STATE.g[4],

    // legacy compat
    misses: STATE.miss|0,
    accuracyGoodPct: accPct1Dec,
    durationPlannedSec: Number(STATE.timePlannedSec||0)||0,

    // extra debug-ish
    hitGood:STATE.hitGood|0,
    hitJunk:STATE.hitJunk|0,
    expireGood:STATE.expireGood|0,
    shotMiss:STATE.shotMiss|0,
  });
}

/* ------------------------ timer ------------------------ */
function startTimer(){
  emit('hha:time',{ leftSec: STATE.timeLeft });
  STATE.timer = setInterval(()=>{
    if(!STATE.running) return;
    STATE.timeLeft--;
    emit('hha:time',{ leftSec: STATE.timeLeft });
    if(STATE.timeLeft <= 0) endGame('timeup');
  }, 1000);
}

/* ------------------------ gameplay handlers ------------------------ */
function recomputeGoal(){
  const distinct = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = distinct;
  if(!STATE.goal.done && distinct >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉');
  }
}

function onHitGood(groupIndex){
  STATE.hitGood++;
  const gi = clamp(groupIndex,0,4);
  STATE.g[gi]++;

  addCombo();
  // ✅ reward combo more in play-heavy phases
  const phase = STATE.wave.phase;
  const phaseBoost = (phase==='boss') ? 1.35 : (phase==='storm' ? 1.15 : 1.0);
  addScore(Math.round((100 + STATE.combo*6) * phaseBoost));

  recomputeGoal();
  updateMiniFromAccuracy();
  emitQuest();

  emit('hha:judge',{ kind:'good', groupId:gi+1, score:STATE.score, combo:STATE.combo });

  // ✅ early end policy: OFF by default in play, can enable via ?earlyEnd=1
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const allowEarlyEnd = !!STATE.cfg?.allowEarlyEnd;
  if(runMode === 'play' && allowEarlyEnd){
    if(STATE.goal.done && STATE.mini.done){
      setTimeout(()=>{ if(!STATE.ended) endGame('all_done'); }, 420);
    }
  }
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++; STATE.missJunk++;
  resetCombo();
  addScore(-80);
  updateMiniFromAccuracy();
  emitQuest();
  emit('hha:judge',{ kind:'junk', score:STATE.score, combo:STATE.combo });
  coach('ระวัง! ของหวาน/ทอด ⚠️');
}

function onExpireGood(groupIndex){
  STATE.expireGood++;
  STATE.miss++; STATE.missExpire++;
  resetCombo();
  updateMiniFromAccuracy();
  emitQuest();
  emit('hha:judge',{ kind:'expire_good', groupId:clamp(groupIndex,0,4)+1, score:STATE.score, combo:STATE.combo });
}

/* ✅ NEW: shot miss from mode-factory judge stream */
function onShotMiss(){
  STATE.shotMiss++;
  STATE.miss++; STATE.missShot++;
  resetCombo();
  addScore(-30); // ยิงพลาดเจ็บนิด ๆ
  updateMiniFromAccuracy();
  emitQuest();
}

/* ------------------------ spawn director ------------------------ */
function pickGroupIndexForGood(t){
  const rng = (t && typeof t.rng==='function') ? t.rng : STATE.rng;

  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);

  const missingCollect = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingCollect.push(i);

  if(missingSpawn.length && rng() < 0.85){
    return missingSpawn[Math.floor(rng()*missingSpawn.length)];
  }
  if(missingCollect.length && rng() < 0.75){
    return missingCollect[Math.floor(rng()*missingCollect.length)];
  }

  // play adaptive: bias 2 least collected
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  if(runMode === 'play'){
    const counts = STATE.g.map((c,i)=>({i,c})).sort((a,b)=>a.c-b.c);
    const pool = [counts[0].i, counts[1].i];
    if(rng() < 0.70) return pool[Math.floor(rng()*pool.length)];
  }

  return Math.floor(rng()*5);
}

function decorateTarget(el, t){
  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t);
    t.groupIndex = gi;
    STATE.spawnSeen[gi] = true;

    const groupId = gi+1;
    const emoji = emojiForGroup(t.rng, groupId);
    el.dataset.group = String(groupId);
    el.dataset.kind = 'good';
    el.textContent = emoji;
    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
    const emoji = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.group = 'junk';
    el.dataset.kind = 'junk';
    el.textContent = emoji;
    try{ el.setAttribute('aria-label', JUNK.labelTH); }catch{}
  }
}

/* ------------------------ wave director (play-heavy) ------------------------ */
function waveEnabled(){
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  return runMode === 'play'; // only play
}

function wavePlanInit(){
  const now = performance.now();
  STATE.wave.on = waveEnabled();
  STATE.wave.phase = 'base';
  STATE.wave.t0 = now;
  STATE.wave.nextAt = now + 12000;      // storm starts after 12s
  STATE.wave.until  = now + 9999999;
}

function waveUpdate(){
  if(!STATE.wave.on || STATE.ended) return;

  const t = performance.now();
  const diff = String(STATE.cfg?.diff||'normal').toLowerCase();

  // Boss window near end (last 18s) in play-heavy
  const bossWindowSec = 18;
  const isNearEnd = (STATE.timeLeft <= bossWindowSec);

  if(isNearEnd){
    if(STATE.wave.phase !== 'boss'){
      STATE.wave.phase = 'boss';
      emit('plate:fx', { phase:'boss', on:true });
      coach('🔥 โหมดบอส! ทำคอมโบให้สุด!', 'Plate');
    }
    return;
  }

  // STORM cycles
  if(t >= STATE.wave.nextAt && STATE.wave.phase === 'base'){
    STATE.wave.phase = 'storm';
    STATE.wave.until = t + (diff==='hard' ? 7000 : 5500);
    emit('plate:fx', { phase:'storm', on:true });
    coach('🌪️ STORM! เป้าถี่ขึ้น!', 'Plate');
    return;
  }

  if(STATE.wave.phase === 'storm' && t >= STATE.wave.until){
    STATE.wave.phase = 'base';
    emit('plate:fx', { phase:'storm', on:false });
    // next storm
    const gap = (diff==='hard' ? 9000 : 12000);
    STATE.wave.nextAt = t + gap;
    return;
  }
}

/* ------------------------ spawner config by phase ------------------------ */
function phaseSpawnRateBase(){
  const diff = String(STATE.cfg?.diff||'normal').toLowerCase();
  if(diff === 'hard') return 760;
  if(diff === 'easy') return 980;
  return 900;
}

function getPhaseTuning(){
  const phase = STATE.wave.phase;

  // defaults
  let spawnRate = STATE.wave.baseSpawn;
  let ttlGood = STATE.wave.baseTTLGood;
  let ttlJunk = STATE.wave.baseTTLJunk;
  let lockPx = STATE.wave.baseLockPx;
  let sizeRange = [44,64];

  if(phase === 'storm'){
    spawnRate = Math.max(520, spawnRate - 220);
    ttlGood = Math.max(1200, ttlGood - 650);
    ttlJunk = Math.max(1100, ttlJunk - 450);
    lockPx = Math.max(18, lockPx - 6);
    sizeRange = [42,60];
  }else if(phase === 'boss'){
    spawnRate = Math.max(480, spawnRate - 260);
    ttlGood = Math.max(1100, ttlGood - 750);
    ttlJunk = Math.max(1050, ttlJunk - 520);
    lockPx = Math.max(16, lockPx - 8);
    sizeRange = [40,58];
  }

  return { spawnRate, ttlGood, ttlJunk, lockPx, sizeRange };
}

function makeSpawner(mount){
  STATE.wave.baseSpawn = phaseSpawnRateBase();
  STATE.wave.baseTTLGood = 2100;
  STATE.wave.baseTTLJunk = 1700;
  STATE.wave.baseLockPx = Number(STATE.cfg?.lockPx ?? 28) || 28;

  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const adaptiveOn = (runMode === 'play');

  // adaptive tweak only in play
  if(adaptiveOn){
    const acc = accuracy();
    const combo = STATE.comboMax;
    if(acc > 0.88 && combo >= 10) STATE.wave.baseSpawn = Math.max(620, STATE.wave.baseSpawn - 120);
    if(acc < 0.70) STATE.wave.baseSpawn = Math.min(1100, STATE.wave.baseSpawn + 120);
  }

  // dynamic params updated each spawn tick inside mode-factory? (we don't have hook)
  // workaround: we recreate spawner on phase change (lightweight) — done via waveTick().
  const tuning = getPhaseTuning();

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate: tuning.spawnRate,
    cooldownMs: Number(STATE.cfg?.cooldownMs ?? 90) || 90,
    sizeRange: tuning.sizeRange,
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget,

    onHit:(hit)=>{
      if(hit.kind === 'good') onHitGood(hit.groupIndex ?? 0);
      else onHitJunk();
    },

    onExpire:(t)=>{
      // respect per-phase ttl? mode-factory currently sets ttl internally.
      // We'll still count expire_good as usual.
      if(t.kind === 'good') onExpireGood(t.groupIndex ?? 0);
    }
  });
}

function restartSpawnerIfNeeded(prevPhase){
  const phase = STATE.wave.phase;
  if(!STATE.running || STATE.ended) return;
  if(prevPhase === phase) return;

  // Recreate spawner to apply new spawnRate/size/cooldown feel
  stopSpawner();
  const mount = STATE.cfg?.mountEl;
  if(mount) STATE.engine = makeSpawner(mount);
}

/* ------------------------ public boot ------------------------ */
export function boot({ mount, cfg }){
  if(!mount) throw new Error('PlateVR: mount missing');

  stopSpawner();
  try{ clearInterval(STATE.timer); }catch{}
  STATE.timer = null;

  STATE.cfg = cfg || {};
  STATE.cfg.mountEl = mount; // internal reference for phase spawner restart

  STATE.running = true;
  STATE.ended = false;

  // reset counters
  STATE.score=0; STATE.combo=0; STATE.comboMax=0;

  STATE.miss=0; STATE.missJunk=0; STATE.missExpire=0; STATE.missShot=0;

  STATE.hitGood=0; STATE.hitJunk=0; STATE.expireGood=0; STATE.shotMiss=0;

  STATE.g=[0,0,0,0,0];
  STATE.spawnSeen=[false,false,false,false,false];

  STATE.goal.cur=0; STATE.goal.done=false;
  STATE.mini.cur=0; STATE.mini.done=false;

  // RNG policy
  const runMode = String(cfg?.runMode||'play').toLowerCase();
  if(runMode === 'research' || runMode === 'study'){
    STATE.rng = seededRng(cfg.seed || Date.now());
  }else{
    STATE.rng = Math.random;
  }

  // duration defaults by mode if not provided
  let dur = Number(cfg?.durationPlannedSec);
  if(!Number.isFinite(dur) || dur <= 0){
    if(runMode === 'research' || runMode === 'study') dur = 60;
    else if(runMode === 'practice') dur = 20;
    else {
      const diff = String(cfg?.diff||'normal').toLowerCase();
      dur = (diff === 'hard') ? 120 : 90;
    }
  }
  STATE.timeLeft = clamp(dur, 10, 999);
  STATE.timePlannedSec = STATE.timeLeft;

  // early end policy (default OFF)
  STATE.cfg.allowEarlyEnd = String(cfg?.allowEarlyEnd||'0') === '1';

  // listen shot miss from mode-factory
  const onJudge = (e)=>{
    const d = e.detail || {};
    if(String(d.kind||'').toLowerCase() === 'shot_miss'){
      onShotMiss();
    }
  };
  WIN.removeEventListener('hha:judge', onJudge);
  WIN.addEventListener('hha:judge', onJudge);

  // start
  emit('hha:start',{
    game:'plate',
    runMode: cfg.runMode,
    diff: cfg.diff,
    seed: cfg.seed,
    timePlannedSec: STATE.timePlannedSec,

    // legacy
    durationPlannedSec: STATE.timePlannedSec
  });

  emitQuest();
  startTimer();

  // wave director init (play only)
  wavePlanInit();

  // spawner
  STATE.engine = makeSpawner(mount);

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️');

  // wave tick: update phase + restart spawner if phase flips
  let prevPhase = STATE.wave.phase;
  const waveTick = ()=>{
    if(!STATE.running || STATE.ended) return;
    waveUpdate();
    if(prevPhase !== STATE.wave.phase){
      restartSpawnerIfNeeded(prevPhase);
      prevPhase = STATE.wave.phase;
    }
    requestAnimationFrame(waveTick);
  };
  requestAnimationFrame(waveTick);

  // safety on pagehide
  const onHide = ()=>{
    if(STATE.ended) return;
    stopSpawner();
  };
  WIN.removeEventListener('pagehide', onHide);
  WIN.addEventListener('pagehide', onHide, { once:false });
}