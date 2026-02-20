// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (SAFE ENGINE) — PRODUCTION v20260220a
// ✅ export function boot({ mount, cfg })
// ✅ integrate shot_miss from mode-factory.js:
//    - callback: onShotMiss() from spawnBoot options
//    - event: listens to hha:judge {kind:'shot_miss'} (emit path)
// ✅ STATE.shotMiss canonical counter
// ✅ emits: hha:start, hha:time, hha:score, quest:update, hha:features_1s, hha:labels, hha:end
// ✅ deterministic in study/research (seeded RNG + adaptive OFF)
// ✅ safe if AI / logger missing

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

const WIN = window;

// ---------------- utils ----------------
const clamp = (v,a,b)=>{ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); };
const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

const $ = (id)=>document.getElementById(id);
const setText = (id,v)=>{ const el=$(id); if(el) el.textContent = String(v); };

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function accuracy01(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function gradeFrom(score, accPct){
  score = Number(score)||0;
  accPct = Number(accPct)||0;
  if(score >= 2200 && accPct >= 88) return 'S';
  if(score >= 1700 && accPct >= 82) return 'A';
  if(score >= 1200 && accPct >= 75) return 'B';
  if(score >= 700  && accPct >= 68) return 'C';
  return 'D';
}

function playedSec(){
  return Math.max(0, (STATE.timePlannedSec - STATE.timeLeft)|0);
}

// ---------------- HHA storage ----------------
const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function loadJson(key, fallback){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
  catch{ return fallback; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}

async function flushHardened(reason){
  try{
    const L = WIN.HHA_LOGGER || WIN.HHACloudLogger || WIN.HHA_CloudLogger || null;
    if(L && typeof L.flush === 'function'){
      await Promise.race([ Promise.resolve(L.flush(reason||'flush')), new Promise(res=>setTimeout(res, 650)) ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([ Promise.resolve(L.flushNow({reason})), new Promise(res=>setTimeout(res, 650)) ]);
    }
  }catch{}
}

// ---------------- AI hooks (optional) ----------------
function createAI(){
  const mk = (WIN.HHA && typeof WIN.HHA.createAIHooks === 'function') ? WIN.HHA.createAIHooks : null;
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');

  if(!mk){
    return {
      deterministic,
      onEvent(){},
      getTip(){ return null; },
      reset(){},
    };
  }

  try{
    const ai = mk({
      game:'plate',
      runMode: STATE.cfg?.runMode || 'play',
      diff: STATE.cfg?.diff || 'normal',
      seed: STATE.cfg?.seed || 0,
      deterministic
    });
    return ai || { deterministic, onEvent(){}, getTip(){return null;}, reset(){} };
  }catch{
    return { deterministic, onEvent(){}, getTip(){return null;}, reset(){} };
  }
}

function coach(msg, mood='neutral'){
  emit('hha:coach', { game:'plate', msg, mood });
}

function emitLabels(type, data){
  emit('hha:labels', {
    game:'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,
    type,
    ...data
  });
}

// ---------------- state ----------------
const STATE = {
  __booted:false,
  __shotMissWired:false,

  mountEl:null,
  engine:null,

  cfg:null,
  rng:Math.random,
  AI:null,

  running:false,
  ended:false,
  paused:false,

  score:0,
  combo:0,
  comboMax:0,

  // canonical miss (good expired + junk hit)
  miss:0,

  hitGood:0,
  hitJunk:0,
  expireGood:0,

  // ✅ canonical shot miss (ยิงพลาด / click miss)
  shotMiss:0,

  // 5 groups counters
  g:[0,0,0,0,0],
  spawnSeen:[false,false,false,false,false],

  timePlannedSec:90,
  timeLeft:90,
  startIso:'',

  goal:{ title:'เติมจานให้ครบ 5 หมู่', cur:0, target:5, done:false },

  // mini logic (simple)
  accMini:{ title:'ความแม่นยำ', cur:0, target:80, done:false },
  miniTotal:1,
  miniCleared:0,

  // ML-1 buffers for features_1s
  ML:{
    lastHitGood:0, lastHitJunk:0, lastExpireGood:0, lastMiss:0, lastScore:0,
    bufMiss:[], bufAcc:[], bufDensity:[],
    spawnCount:0, lastSpawnCount:0, lastSpawnTs:0
  }
};

// ---------------- shot_miss wiring (emit path) ----------------
function wireShotMiss(){
  if(STATE.__shotMissWired) return;
  STATE.__shotMissWired = true;

  // Accept shot_miss as judge event (emit path)
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if(String(d.kind||'').toLowerCase() === 'shot_miss'){
      if(!STATE.running || STATE.paused || STATE.ended) return;
      STATE.shotMiss++;
      try{ STATE.AI?.onEvent?.('judge', { kind:'shot_miss' }); }catch{}
    }
  }, { passive:true });
}

// ---------------- quests ----------------
function recomputeGoal(){
  const distinct = STATE.g.filter(v=>v>0).length;
  STATE.goal.cur = distinct;

  if(!STATE.goal.done && distinct >= STATE.goal.target){
    STATE.goal.done = true;
    coach('เยี่ยม! เติมครบทุกหมู่แล้ว 🎉', 'happy');
    emitLabels('milestone', { name:'all5', tPlayedSec: playedSec() });
  }
}

function updateAccMini(){
  const accPct = accuracy01()*100;
  STATE.accMini.cur = clamp(Math.round(accPct), 0, 100);
  if(!STATE.accMini.done && accPct >= STATE.accMini.target){
    STATE.accMini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'happy');
    emitLabels('milestone', { name:'acc80', tPlayedSec: playedSec() });
  }
}

function emitQuest(){
  emit('quest:update', {
    game:'plate',
    goal:{ name:STATE.goal.title, cur:STATE.goal.cur, target:STATE.goal.target, done:STATE.goal.done },
    mini:{ name:STATE.accMini.title, cur:STATE.accMini.cur, target:STATE.accMini.target, done:STATE.accMini.done }
  });
}

// ---------------- HUD (events + best-effort DOM updates) ----------------
function updateHUD(){
  const accPct = Math.round(accuracy01()*1000)/10;
  const grade = gradeFrom(STATE.score, accPct);

  emit('hha:score', {
    game:'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    score: STATE.score|0,
    combo: STATE.combo|0,
    comboMax: STATE.comboMax|0,
    miss: STATE.miss|0,
    shotMiss: STATE.shotMiss|0,
    accuracyPct: accPct,
    grade,
    gCount:[...STATE.g],
    timeLeftSec: STATE.timeLeft|0
  });

  setText('uiScore', STATE.score|0);
  setText('uiCombo', STATE.combo|0);
  setText('uiComboMax', STATE.comboMax|0);
  setText('uiMiss', STATE.miss|0);
  setText('uiAcc', `${Math.round(accPct)}%`);
  setText('uiGrade', grade);
  setText('uiTime', STATE.timeLeft|0);

  setText('uiG1', STATE.g[0]);
  setText('uiG2', STATE.g[1]);
  setText('uiG3', STATE.g[2]);
  setText('uiG4', STATE.g[3]);
  setText('uiG5', STATE.g[4]);

  setText('uiPlateHave', STATE.g.filter(v=>v>0).length);

  emitQuest();
}

// ---------------- spawner decorate + director ----------------
function pickGroupIndexForGood(t){
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  // ensure 5 groups appear early
  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);
  if(missingSpawn.length && rng() < 0.88){
    return missingSpawn[Math.floor(rng()*missingSpawn.length)];
  }

  // otherwise random
  return Math.floor(rng()*5);
}

function decorateTarget(el, t){
  el.classList.add('plateTarget');
  STATE.ML.spawnCount++;

  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t);
    t.groupIndex = gi;

    STATE.spawnSeen[gi] = true;
    const groupId = gi + 1;

    el.dataset.kind = 'good';
    el.dataset.group = String(groupId);
    el.textContent = emojiForGroup(t.rng, groupId);
    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
    el.dataset.kind = 'junk';
    el.dataset.group = 'junk';
    el.textContent = pickEmoji(t.rng, JUNK.emojis);
    try{ el.setAttribute('aria-label', JUNK.labelTH); }catch{}
  }
}

function stopSpawner(){
  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function makeSpawner(mount){
  const diff = String(STATE.cfg?.diff || 'normal').toLowerCase();
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');

  let spawnRate = 900;
  if(diff === 'hard') spawnRate = 720;
  else if(diff === 'easy') spawnRate = 1020;

  // adaptive only in play mode and not deterministic
  if(!deterministic){
    const acc = accuracy01();
    if(acc > 0.88 && STATE.comboMax >= 10) spawnRate = Math.max(620, spawnRate - 120);
    if(acc < 0.70) spawnRate = Math.min(1100, spawnRate + 120);
  }

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange: (diff==='hard' ? [40,60] : [44,64]),
    kinds:[
      { kind:'good', weight:0.72 },
      { kind:'junk', weight:0.28 }
    ],
    decorateTarget,

    onHit:(hit)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(hit.kind === 'good') onHitGood(hit.groupIndex ?? 0);
      else onHitJunk();
    },

    onExpire:(t)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(t.kind === 'good') onExpireGood(t.groupIndex ?? 0);
    },

    // ✅ callback path for shot_miss from mode-factory.js
    onShotMiss:(m)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      STATE.shotMiss++;
      try{ STATE.AI?.onEvent?.('judge', { kind:'shot_miss' }); }catch{}
      // If you want to also broadcast as judge event (optional):
      emit('hha:judge', { kind:'shot_miss', ...m });
    }
  });
}

// ---------------- judge handlers ----------------
function addCombo(){ STATE.combo++; STATE.comboMax = Math.max(STATE.comboMax, STATE.combo); }
function resetCombo(){ STATE.combo = 0; }
function addScore(v){ STATE.score += (Number(v)||0); }

function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex,0,4);
  STATE.g[gi]++;

  addCombo();
  addScore(100 + STATE.combo*5);

  emit('hha:judge', { kind:'good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'good', groupId: gi+1 }); }catch{}

  recomputeGoal();
  updateAccMini();
  updateHUD();
}

function onHitJunk(){
  STATE.hitJunk++;
  STATE.miss++; // canonical miss
  resetCombo();
  addScore(-50);

  emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'junk' }); }catch{}

  updateAccMini();
  updateHUD();
}

function onExpireGood(groupIndex){
  STATE.expireGood++;
  STATE.miss++; // canonical miss
  resetCombo();

  const gi = clamp(groupIndex,0,4);

  emit('hha:judge', { kind:'expire_good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'expire_good', groupId: gi+1 }); }catch{}

  updateAccMini();
  updateHUD();
}

// ---------------- ML-1 features_1s ----------------
function targetDensity01(){
  const n = document.querySelectorAll('#plate-layer .plateTarget').length;
  return clamp(n/18, 0, 1);
}

function groupImbalance01(){
  const a = STATE.g.map(x=>Number(x)||0);
  const sum = a.reduce((s,v)=>s+v,0);
  if(sum <= 0) return 1;
  const mean = sum/5;
  let mad = 0;
  for(const v of a) mad += Math.abs(v-mean);
  mad /= 5;
  return clamp(mean>0 ? (mad/(mean*2)) : 1, 0, 1);
}

function emitFeatures1s(){
  const tPlayed = playedSec();
  const accNowPct = Math.round(accuracy01()*1000)/10;

  const hitGoodD = STATE.hitGood - STATE.ML.lastHitGood;
  const hitJunkD = STATE.hitJunk - STATE.ML.lastHitJunk;
  const expGoodD = STATE.expireGood - STATE.ML.lastExpireGood;
  const missD    = STATE.miss - STATE.ML.lastMiss;

  STATE.ML.lastHitGood = STATE.hitGood;
  STATE.ML.lastHitJunk = STATE.hitJunk;
  STATE.ML.lastExpireGood = STATE.expireGood;
  STATE.ML.lastMiss = STATE.miss;

  STATE.ML.bufMiss.push(missD);
  STATE.ML.bufAcc.push(accNowPct);
  STATE.ML.bufDensity.push(targetDensity01());
  while(STATE.ML.bufMiss.length > 3) STATE.ML.bufMiss.shift();
  while(STATE.ML.bufAcc.length > 3) STATE.ML.bufAcc.shift();
  while(STATE.ML.bufDensity.length > 3) STATE.ML.bufDensity.shift();

  const missDelta3s = STATE.ML.bufMiss.reduce((s,v)=>s+v,0);
  const accAvg3s = STATE.ML.bufAcc.length ? (STATE.ML.bufAcc.reduce((s,v)=>s+v,0) / STATE.ML.bufAcc.length) : accNowPct;
  const densAvg3s = STATE.ML.bufDensity.length ? (STATE.ML.bufDensity.reduce((s,v)=>s+v,0) / STATE.ML.bufDensity.length) : targetDensity01();

  // spawn rate estimate
  const ts = nowMs();
  if(!STATE.ML.lastSpawnTs) STATE.ML.lastSpawnTs = ts;
  const dt = Math.max(0.001, (ts - STATE.ML.lastSpawnTs)/1000);
  const spawns = STATE.ML.spawnCount - (STATE.ML.lastSpawnCount||0);
  const spawnRatePerSec = spawns / dt;
  STATE.ML.lastSpawnCount = STATE.ML.spawnCount;
  STATE.ML.lastSpawnTs = ts;

  const feat = {
    game:'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,

    tPlayedSec: tPlayed,
    timeLeftSec: STATE.timeLeft|0,

    scoreNow: STATE.score|0,
    scoreDelta1s: (STATE.score - (STATE.ML.lastScore||0))|0,
    comboNow: STATE.combo|0,
    comboMax: STATE.comboMax|0,

    missNow: STATE.miss|0,
    missDelta1s: missD|0,
    missDelta3s: missDelta3s|0,

    // ✅ include shot_miss canonical
    shotMissNow: STATE.shotMiss|0,

    hitGoodDelta1s: hitGoodD|0,
    hitJunkDelta1s: hitJunkD|0,
    expireGoodDelta1s: expGoodD|0,

    accNowPct,
    accAvg3s: Math.round(accAvg3s*10)/10,

    g:[...STATE.g],
    groupImbalance01: Math.round(groupImbalance01()*1000)/1000,

    targetDensity: Math.round(targetDensity01()*1000)/1000,
    targetDensityAvg3s: Math.round(densAvg3s*1000)/1000,
    spawnRatePerSec: Math.round(spawnRatePerSec*100)/100
  };

  STATE.ML.lastScore = STATE.score;

  emit('hha:features_1s', feat);
  try{ STATE.AI?.onEvent?.('features_1s', feat); }catch{}

  // non-deterministic coach tips only in play
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');
  if(!deterministic){
    try{
      const tip = STATE.AI?.getTip?.(feat);
      if(tip && tip.msg){
        coach(tip.msg, tip.mood||'neutral');
        emit('hha:ai', { game:'plate', type:'coach-tip', ...tip, tPlayedSec:tPlayed });
      }
    }catch{}
  }
}

// ---------------- loop + end ----------------
let _tick = null;

function startLoop(){
  if(_tick) clearInterval(_tick);
  _tick = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    if(STATE.paused) return;

    emitFeatures1s();

    STATE.timeLeft--;
    emit('hha:time', { game:'plate', leftSec: STATE.timeLeft|0, timeLeftSec: STATE.timeLeft|0 });

    updateHUD();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(_tick); }catch{}
  _tick = null;

  stopSpawner();

  const accPct = Math.round(accuracy01()*1000)/10;
  const grade = gradeFrom(STATE.score, accPct);
  const endIso = new Date().toISOString();

  const summary = {
    timestampIso: endIso,
    sessionId: `PLATE_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    projectTag:'HHA',
    game:'plate',
    gameMode:'plate',

    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    seed: STATE.cfg?.seed || 0,

    pid: STATE.cfg?.pid || 'anon',
    studyId: STATE.cfg?.studyId || '',
    phase: STATE.cfg?.phase || '',
    conditionGroup: STATE.cfg?.conditionGroup || '',
    view: STATE.cfg?.view || '',
    log: STATE.cfg?.log || '',

    timePlannedSec: Number(STATE.timePlannedSec||0)||0,
    durationPlannedSec: Number(STATE.timePlannedSec||0)||0,
    durationPlayedSec: Number(STATE.timePlannedSec||0)||0,

    scoreFinal: STATE.score|0,
    comboMax: STATE.comboMax|0,

    // canonical miss
    miss: STATE.miss|0,
    missJunk: STATE.hitJunk|0,
    missExpire: STATE.expireGood|0,

    // ✅ canonical shot_miss in summary
    shotMiss: STATE.shotMiss|0,

    accuracyPct: accPct,
    grade,

    goalsCleared: STATE.goal.done ? 1 : 0,
    goalsTotal: 1,
    miniCleared: STATE.miniCleared|0,
    miniTotal: STATE.miniTotal|0,

    g1: STATE.g[0], g2: STATE.g[1], g3: STATE.g[2], g4: STATE.g[3], g5: STATE.g[4],
    reason
  };

  saveJson(LS_LAST, summary);
  const hist = loadJson(LS_HIST, []);
  const arr = Array.isArray(hist) ? hist : [];
  arr.unshift(summary);
  while(arr.length > 50) arr.pop();
  saveJson(LS_HIST, arr);

  emit('hha:end', summary);

  emitLabels('end', { reason, grade, accPct, miss: summary.miss, shotMiss: summary.shotMiss, scoreFinal: summary.scoreFinal });
  emitLabels('targets', {
    y_grade: grade,
    y_score: summary.scoreFinal,
    y_miss: summary.miss,
    y_shotMiss: summary.shotMiss,
    y_acc: accPct,
    y_all5: summary.goalsCleared ? 1 : 0
  });

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', (grade==='D'?'sad':'happy'));
  flushHardened(reason);
}

// ---------------- boot({mount,cfg}) ----------------
function normalizeCfg(cfg){
  const c = cfg || {};
  const runRaw = String(c.runMode || c.run || 'play').toLowerCase();
  const diff   = String(c.diff || 'normal').toLowerCase();
  const isDet  = (runRaw === 'study' || runRaw === 'research');

  const seed = isDet ? (Number(c.seed)||13579)
                     : (c.seed!=null ? (Number(c.seed)||13579) : ((Date.now() ^ (Math.random()*1e9))|0));

  const time = clamp((c.durationPlannedSec ?? c.time ?? 90), 20, 9999);

  return {
    runMode: isDet ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff) ? diff : 'normal',
    seed,
    durationPlannedSec: time,

    pid: c.pid || 'anon',
    studyId: c.studyId || '',
    phase: c.phase || '',
    conditionGroup: c.conditionGroup || '',
    log: c.log || '',
    view: c.view || '',
    hub: c.hub || ''
  };
}

function startGame(){
  // reset state
  STATE.running = true;
  STATE.ended = false;
  STATE.paused = false;

  STATE.score=0; STATE.combo=0; STATE.comboMax=0;
  STATE.miss=0;
  STATE.hitGood=0; STATE.hitJunk=0; STATE.expireGood=0;
  STATE.shotMiss=0;

  STATE.g=[0,0,0,0,0];
  STATE.spawnSeen=[false,false,false,false,false];

  STATE.goal.done=false; STATE.goal.cur=0;
  STATE.accMini.done=false; STATE.accMini.cur=0;
  STATE.miniTotal=1; STATE.miniCleared=0;

  STATE.ML.lastHitGood=0; STATE.ML.lastHitJunk=0; STATE.ML.lastExpireGood=0;
  STATE.ML.lastMiss=0; STATE.ML.lastScore=0;
  STATE.ML.bufMiss=[]; STATE.ML.bufAcc=[]; STATE.ML.bufDensity=[];
  STATE.ML.spawnCount=0; STATE.ML.lastSpawnCount=0; STATE.ML.lastSpawnTs=0;

  // rng by mode
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  STATE.rng = (runMode === 'study' || runMode === 'research') ? seededRng(STATE.cfg.seed) : Math.random;

  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 90) || 90;
  STATE.timeLeft = STATE.timePlannedSec;
  STATE.startIso = new Date().toISOString();

  // ai
  STATE.AI = createAI();
  try{ STATE.AI.reset?.(); }catch{}

  emit('hha:start', {
    projectTag:'HHA',
    game:'plate',
    gameMode:'plate',
    runMode: STATE.cfg.runMode,
    diff: STATE.cfg.diff,
    seed: STATE.cfg.seed,
    timePlannedSec: STATE.timePlannedSec,
    durationPlannedSec: STATE.timePlannedSec,
    startTimeIso: STATE.startIso,

    pid: STATE.cfg?.pid || 'anon',
    studyId: STATE.cfg?.studyId || '',
    phase: STATE.cfg?.phase || '',
    conditionGroup: STATE.cfg?.conditionGroup || '',
    view: STATE.cfg?.view || ''
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'neutral');

  stopSpawner();
  STATE.engine = makeSpawner(STATE.mountEl);

  updateHUD();
  startLoop();
}

export function boot({ mount, cfg }){
  if(!mount) throw new Error('[PlateVR] boot: mount missing');
  if(STATE.__booted) return;
  STATE.__booted = true;

  STATE.mountEl = mount;
  STATE.cfg = normalizeCfg(cfg);

  // ✅ wire shot_miss emit path listener once
  wireShotMiss();

  // (optional) expose pause hook for external UI
  WIN.HHA_PLATE_PAUSE = (p)=>{ STATE.paused = !!p; };

  startGame();
}

// flush safety
WIN.addEventListener?.('beforeunload', ()=>{ try{ flushHardened('beforeunload'); }catch{} });
document.addEventListener?.('visibilitychange', ()=>{ if(document.hidden) try{ flushHardened('hidden'); }catch{} }, {passive:true});