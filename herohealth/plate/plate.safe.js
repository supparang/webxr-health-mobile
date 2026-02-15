// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION+) — v5.3-ML1 (FULL)
// HHA Standard + Storm + Boss + AI hooks + features_1s + labels + flush-hardened
//
// ✅ emits hha:features_1s every 1s
// ✅ emits hha:labels on end + milestones + mini start/end
// ✅ integrates /vr/ai-hooks.js if present (never crashes if missing)
// ✅ study/research: deterministic seed + AI/adaptive OFF by default
// ✅ supports miss-shot stream via mode-factory onShotMiss -> hha:judge shot_miss
// ✅ fixes UI event keys: hha:time emits both timeLeftSec and leftSec; quest uses title fields

'use strict';

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

const ROOT = window;

// ---------------- Utilities ----------------
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

function seededRng(seed){
  let t = (Number(seed)||Date.now()) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

function qs(id){ return document.getElementById(id); }
function setText(id, v){ const el=qs(id); if(el) el.textContent = String(v); }

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
    const L = ROOT.HHA_LOGGER || ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || null;
    if(L && typeof L.flush === 'function'){
      await Promise.race([
        Promise.resolve(L.flush(reason||'manual')),
        new Promise(res=>setTimeout(res, 650))
      ]);
    }else if(L && typeof L.flushNow === 'function'){
      await Promise.race([
        Promise.resolve(L.flushNow({reason})),
        new Promise(res=>setTimeout(res, 650))
      ]);
    }
  }catch{}
}

// ---------------- AI Hooks (ML-1) ----------------
function createAI(){
  const H = ROOT.HHA && typeof ROOT.HHA.createAIHooks === 'function'
    ? ROOT.HHA.createAIHooks
    : null;

  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const deterministic = (runMode === 'study' || runMode === 'research');

  if(!H){
    return {
      enabled: !deterministic,
      deterministic,
      onEvent(){},
      getTip(){ return null; },
      getPrediction(){ return null; },
      getDifficultySignal(){ return null; },
      reset(){},
    };
  }

  try{
    const ai = H({
      game:'plate',
      runMode: STATE.cfg?.runMode || 'play',
      diff: STATE.cfg?.diff || 'normal',
      seed: STATE.cfg?.seed || 0,
      deterministic
    });
    return ai || {
      enabled: !deterministic, deterministic,
      onEvent(){}, getTip(){return null;}, getPrediction(){return null;}, getDifficultySignal(){return null;}, reset(){}
    };
  }catch{
    return {
      enabled: !deterministic,
      deterministic,
      onEvent(){},
      getTip(){ return null; },
      getPrediction(){ return null; },
      getDifficultySignal(){ return null; },
      reset(){},
    };
  }
}

// ---------------- State ----------------
const STATE = {
  running:false,
  ended:false,
  paused:false,

  score:0,
  combo:0,
  comboMax:0,

  // HHA canonical miss = good expired + junk hit
  miss:0,

  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shotMiss:0,

  g:[0,0,0,0,0],
  spawnSeen:[false,false,false,false,false],
  collectedSeen:[false,false,false,false,false],

  cfg:null,
  rng:Math.random,

  engine:null,
  mountEl:null,

  timeLeft:0,
  timePlannedSec:0,
  tStartIso:'',

  goal:{ title:'เติมจานให้ครบ 5 หมู่', cur:0, target:5, done:false },

  // accuracy mini (ยังคงใช้เพื่อ UI/learning, แต่ “miniTotal” จะนับ storm+boss ตามเดิม)
  accMini:{ title:'ความแม่นยำ', cur:0, target:80, done:false },

  miniTotal: 1,
  miniCleared: 0,

  storm:{
    active:false, startedAt:0, durationSec:7, needGood:9, hitGood:0,
    forbidJunk:false, cycleIndex:0, cyclesPlanned:0, lastRebootAt:0
  },

  boss:{
    active:false, startedAt:0, durationSec:10, needGood:8, hitGood:0,
    forbidJunk:true, done:false, lastRebootAt:0, triggered:false
  },

  // ML-1 rolling stats window
  ML:{
    tickN:0,
    lastHitGood:0,
    lastHitJunk:0,
    lastExpireGood:0,
    lastMiss:0,
    lastScore:0,
    lastCombo:0,
    lastTLeft:0,
    // deltas over 3s
    bufMiss: [],
    bufAcc: [],
    bufDensity: [],
    lastSpawnCount: 0,
    lastSpawnTs: 0,
    spawnCount: 0
  },

  AI:null,

  __shotMissWired:false,
};

// ---------------- Public boot() ----------------
// plate-vr.html calls: plateBoot({ mount, cfg })
export function boot({ mount, cfg } = {}){
  if(!mount) throw new Error('plate.safe: mount missing');
  STATE.mountEl = mount;

  // cfg can be passed from runner; else fallback URL parse
  STATE.cfg = cfg && typeof cfg === 'object' ? normalizeCfg(cfg) : parseCfgFromUrl();

  // init UI baseline
  computeMinisPlanned();
  wireShotMiss();
  bindShootOnce();

  // show start overlay already handled by runner;
  // we only prep state and listen to controls if used in standalone mode.

  // If runner wants auto-start, they can call start() on returned api.
  // But to keep compatibility, we do not auto-start.
  return {
    start: startGame,
    pause: (p)=> setPaused(!!p),
    stop: ()=> endGame('stop'),
    getState: ()=> ({ ...STATE })
  };
}

function normalizeCfg(cfg){
  const runRaw = String(cfg.runMode || cfg.run || 'play').toLowerCase();
  const diff   = String(cfg.diff || 'normal').toLowerCase();
  const isStudy = (runRaw === 'study' || runRaw === 'research');

  const time = clamp(cfg.durationPlannedSec ?? cfg.time ?? 90, 20, 9999);
  const seedIn = cfg.seed;

  const seed = isStudy
    ? (Number(seedIn)||13579)
    : (seedIn!=null ? (Number(seedIn)||13579) : ((Date.now() ^ (Math.random()*1e9))|0));

  return {
    ...cfg,
    runMode: isStudy ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff)?diff:'normal',
    seed,
    durationPlannedSec: time
  };
}

// ---------------- Accuracy / Quests ----------------
function accuracy(){
  const total = STATE.hitGood + STATE.hitJunk + STATE.expireGood;
  if(total <= 0) return 1;
  return STATE.hitGood / total;
}

function playedSec(){
  return Math.max(0, (STATE.timePlannedSec - STATE.timeLeft)|0);
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
  const accPct = accuracy() * 100;
  STATE.accMini.cur = clamp(Math.round(accPct), 0, 100);
  if(!STATE.accMini.done && accPct >= STATE.accMini.target){
    STATE.accMini.done = true;
    coach('ความแม่นยำดีมาก! 👍', 'happy');
    emitLabels('milestone', { name:'acc80', tPlayedSec: playedSec() });
  }
}

function currentMiniTitle(){
  if(STATE.boss.active) return `BOSS (GOOD ${STATE.boss.hitGood}/${STATE.boss.needGood})`;
  if(STATE.storm.active) return `STORM ${STATE.storm.cycleIndex+1}/${STATE.storm.cyclesPlanned}`;
  return STATE.accMini.title;
}
function currentMiniCur(){
  if(STATE.boss.active) return STATE.boss.hitGood;
  if(STATE.storm.active) return STATE.storm.hitGood;
  return STATE.accMini.cur;
}
function currentMiniTarget(){
  if(STATE.boss.active) return STATE.boss.needGood;
  if(STATE.storm.active) return STATE.storm.needGood;
  return STATE.accMini.target;
}
function currentMiniDone(){
  if(STATE.boss.active) return false;
  if(STATE.storm.active) return false;
  return STATE.accMini.done;
}
function currentMiniTimeText(){
  if(STATE.boss.active) return `${Math.ceil(bossTimeLeft())}s`;
  if(STATE.storm.active) return `${Math.ceil(stormTimeLeft())}s`;
  return '--';
}
function currentMiniFillPct(){
  if(STATE.boss.active) return clamp(STATE.boss.needGood ? (STATE.boss.hitGood/STATE.boss.needGood*100) : 0, 0, 100);
  if(STATE.storm.active) return clamp(STATE.storm.needGood ? (STATE.storm.hitGood/STATE.storm.needGood*100) : 0, 0, 100);
  return clamp(STATE.accMini.target ? (STATE.accMini.cur/STATE.accMini.target*100) : 0, 0, 100);
}

function emitQuest(){
  const payload = {
    game:'plate',
    goal:{ title: STATE.goal.title, cur: STATE.goal.cur, target: STATE.goal.target, done: STATE.goal.done },
    mini:{
      title: currentMiniTitle(),
      cur: currentMiniCur(),
      target: currentMiniTarget(),
      done: currentMiniDone(),
      timeText: currentMiniTimeText(),
      fillPct: currentMiniFillPct()
    },
    allDone: STATE.goal.done && STATE.accMini.done
  };

  emit('quest:update', payload);

  // optional: bind to ids if present (runner already does it, but safe)
  setText('uiGoalTitle', STATE.goal.title);
  setText('uiGoalCount', `${STATE.goal.cur}/${STATE.goal.target}`);
  const gf = qs('uiGoalFill'); if(gf) gf.style.width = `${STATE.goal.target ? (STATE.goal.cur/STATE.goal.target*100) : 0}%`;

  setText('uiMiniTitle', payload.mini.title);
  setText('uiMiniTime', payload.mini.timeText);
  setText('uiMiniCount', `${STATE.miniCleared}/${STATE.miniTotal}`);
  const mf = qs('uiMiniFill'); if(mf) mf.style.width = `${payload.mini.fillPct}%`;
}

// ---------------- Coach ----------------
function coach(msg, mood='neutral'){
  emit('hha:coach', { game:'plate', msg, mood });
}

// ---------------- Spawn director (fix “ไม่ออกครบ 5 หมู่”) ----------------
function pickGroupIndexForGood(t){
  const rng = (t && typeof t.rng === 'function') ? t.rng : STATE.rng;

  const missingSpawn = [];
  for(let i=0;i<5;i++) if(!STATE.spawnSeen[i]) missingSpawn.push(i);
  if(missingSpawn.length && rng() < 0.88){
    return missingSpawn[Math.floor(rng()*missingSpawn.length)];
  }

  const missingCollect = [];
  for(let i=0;i<5;i++) if(STATE.g[i] <= 0) missingCollect.push(i);
  if(missingCollect.length && rng() < 0.78){
    return missingCollect[Math.floor(rng()*missingCollect.length)];
  }

  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play' && !STATE.AI?.deterministic);

  if(adaptiveOn){
    const counts = STATE.g.map((c,i)=>({i,c})).sort((a,b)=>a.c-b.c);
    const pool = counts.slice(0,2).map(x=>x.i);
    if(rng() < 0.70) return pool[Math.floor(rng()*pool.length)];
  }

  return Math.floor(rng()*5);
}

function decorateTarget(el, t){
  el.classList.add('plateTarget');

  // track spawn density estimator
  STATE.ML.spawnCount++;

  if(t.kind === 'good'){
    const gi = pickGroupIndexForGood(t);
    t.groupIndex = gi;
    STATE.spawnSeen[gi] = true;

    const groupId = gi + 1;
    const emoji = emojiForGroup(t.rng, groupId);

    el.dataset.kind = 'good';
    el.dataset.group = String(groupId);
    el.textContent = emoji;

    try{ el.setAttribute('aria-label', labelForGroup(groupId)); }catch{}
  }else{
    const emoji = pickEmoji(t.rng, JUNK.emojis);
    el.dataset.kind = 'junk';
    el.dataset.group = 'junk';
    el.textContent = emoji;
    try{ el.setAttribute('aria-label', JUNK.labelTH); }catch{}
  }
}

// ---------------- HUD ----------------
function updateHUD(){
  const accPct = accuracy()*100;
  const grade = gradeFrom(STATE.score, accPct);

  emit('hha:score', {
    game:'plate',
    runMode: STATE.cfg?.runMode || 'play',
    diff: STATE.cfg?.diff || 'normal',
    timeLeftSec: STATE.timeLeft,
    leftSec: STATE.timeLeft, // ✅ compat with runner
    score: STATE.score|0,
    combo: STATE.combo|0,
    comboMax: STATE.comboMax|0,
    miss: STATE.miss|0,
    accuracyPct: Math.round(accPct*10)/10,
    grade,
    gCount: [...STATE.g]
  });

  setText('uiScore', STATE.score|0);
  setText('uiCombo', STATE.combo|0);
  setText('uiComboMax', STATE.comboMax|0);
  setText('uiMiss', STATE.miss|0);
  setText('uiPlateHave', STATE.g.filter(v=>v>0).length);
  setText('uiAcc', `${Math.round(accPct)}%`);
  setText('uiGrade', grade);
  setText('uiTime', STATE.timeLeft|0);

  setText('uiG1', STATE.g[0]);
  setText('uiG2', STATE.g[1]);
  setText('uiG3', STATE.g[2]);
  setText('uiG4', STATE.g[3]);
  setText('uiG5', STATE.g[4]);
}

// ---------------- Crosshair shoot -> nearest target (extra safety) ----------------
function bindShootOnce(){
  if(ROOT.__PLATE_SHOOT_BOUND__) return;
  ROOT.__PLATE_SHOOT_BOUND__ = true;

  ROOT.addEventListener('hha:shoot', (ev)=>{
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const d = ev?.detail || {};
    const x = Number(d.x) || (innerWidth/2);
    const y = Number(d.y) || (innerHeight/2);
    const lockPx = Math.max(8, Number(d.lockPx||28)||28);

    const els = document.querySelectorAll('#plate-layer .plateTarget');
    let best = null, bestD2 = Infinity;

    for(const el of els){
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = x - cx, dy = y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){ bestD2 = d2; best = el; }
    }

    if(best && bestD2 <= lockPx*lockPx){
      try{ best.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true })); }catch{}
      try{ best.click(); }catch{}
    }
  }, { passive:true });
}

// ---------------- miss-shot stream ----------------
function wireShotMiss(){
  if(STATE.__shotMissWired) return;
  STATE.__shotMissWired = true;

  ROOT.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if(String(d.kind||'').toLowerCase() === 'shot_miss'){
      STATE.shotMiss++;
    }
  }, { passive:true });
}

// ---------------- Storm/Boss helpers ----------------
function stormTimeLeft(){
  if(!STATE.storm.active) return 0;
  const el = (now() - STATE.storm.startedAt)/1000;
  return Math.max(0, STATE.storm.durationSec - el);
}
function bossTimeLeft(){
  if(!STATE.boss.active) return 0;
  const el = (now() - STATE.boss.startedAt)/1000;
  return Math.max(0, STATE.boss.durationSec - el);
}

// (HUD functions kept even if elements not present; safe)
function updateStormHud(){
  const hud = qs('stormHud');
  const title = qs('stormTitle');
  const hint  = qs('stormHint');
  const prog  = qs('stormProg');
  const fx    = qs('stormFx');
  if(!hud && !fx && !title && !hint && !prog) return;

  if(STATE.storm.active){
    if(hud) hud.style.display='block';
    if(fx){ fx.classList.add('storm-on'); fx.style.display='block'; }
    if(title) title.textContent = `🌪️ STORM ${STATE.storm.cycleIndex+1}/${STATE.storm.cyclesPlanned}`;
    const tl = stormTimeLeft();
    if(hint){
      const a = STATE.storm.forbidJunk ? ' (ห้ามโดนขยะ!)' : '';
      hint.textContent = `เก็บ GOOD ${STATE.storm.needGood} ชิ้นใน ${STATE.storm.durationSec}s${a}`;
    }
    if(prog) prog.textContent = `${Math.ceil(tl)}s • GOOD ${STATE.storm.hitGood}/${STATE.storm.needGood}`;
    if(fx){
      if(tl <= 2.5) fx.classList.add('storm-panic'); else fx.classList.remove('storm-panic');
    }
  }else{
    if(hud) hud.style.display='none';
    if(fx){ fx.classList.remove('storm-on','storm-panic'); fx.style.display='none'; }
  }
}

function updateBossHud(){
  const hud = qs('bossHud');
  const title = qs('bossTitle');
  const hint  = qs('bossHint');
  const prog  = qs('bossProg');
  const fx    = qs('bossFx');
  if(!hud && !fx && !title && !hint && !prog) return;

  if(STATE.boss.active){
    if(hud) hud.style.display='block';
    if(fx){ fx.classList.add('boss-on'); fx.style.display='block'; }
    if(title) title.textContent='👹 BOSS';
    const tl = bossTimeLeft();
    if(hint){
      hint.textContent = STATE.boss.forbidJunk
        ? `เก็บ GOOD ${STATE.boss.needGood} ชิ้นใน ${STATE.boss.durationSec}s (ห้ามโดนขยะ!)`
        : `เก็บ GOOD ${STATE.boss.needGood} ชิ้นใน ${STATE.boss.durationSec}s`;
    }
    if(prog) prog.textContent = `${Math.ceil(tl)}s • GOOD ${STATE.boss.hitGood}/${STATE.boss.needGood}`;
    if(fx){
      if(tl <= 3) fx.classList.add('boss-panic'); else fx.classList.remove('boss-panic');
    }
  }else{
    if(hud) hud.style.display='none';
    if(fx){ fx.classList.remove('boss-on','boss-panic'); fx.style.display='none'; }
  }
}

function computeMinisPlanned(){
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');

  STATE.storm.cyclesPlanned = isStudy ? 2 : 3;
  const bossCount = isStudy ? 0 : 1;

  STATE.miniTotal = STATE.storm.cyclesPlanned + bossCount;
}

// ---------------- Spawner ----------------
function stopSpawner(){
  if(STATE.engine && typeof STATE.engine.stop === 'function'){
    try{ STATE.engine.stop(); }catch{}
  }
  STATE.engine = null;
}

function restartSpawner(){
  const t = now();
  const last = Math.max(STATE.storm.lastRebootAt||0, STATE.boss.lastRebootAt||0);
  if(t - last < 250) return;

  STATE.storm.lastRebootAt = t;
  STATE.boss.lastRebootAt = t;

  stopSpawner();
  if(!STATE.mountEl) return;
  STATE.engine = makeSpawner(STATE.mountEl);
}

function makeSpawner(mount){
  const diff = String(STATE.cfg?.diff || 'normal').toLowerCase();
  const runMode = String(STATE.cfg?.runMode || 'play').toLowerCase();
  const adaptiveOn = (runMode === 'play' && !STATE.AI?.deterministic);

  let spawnRate = 900;
  if(diff === 'hard') spawnRate = 720;
  else if(diff === 'easy') spawnRate = 1020;

  if(adaptiveOn){
    const acc = accuracy();
    const cmb = STATE.comboMax;
    if(acc > 0.88 && cmb >= 10) spawnRate = Math.max(620, spawnRate - 120);
    if(acc < 0.70) spawnRate = Math.min(1100, spawnRate + 120);
  }

  const stormOn = !!STATE.storm.active;
  const bossOn  = !!STATE.boss.active;

  if(stormOn) spawnRate = Math.max(520, Math.floor(spawnRate * 0.70));
  if(bossOn)  spawnRate = Math.max(480, Math.floor(spawnRate * 0.62));

  let wGood = 0.72;
  if(stormOn) wGood = 0.64;
  if(bossOn)  wGood = 0.76;
  const wJunk = 1 - wGood;

  const sizeRange =
    bossOn  ? [40,58] :
    stormOn ? [40,60] :
              (diff === 'hard' ? [40,60] : [44,64]);

  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,
    spawnRate,
    sizeRange,
    kinds:[
      { kind:'good', weight:wGood },
      { kind:'junk', weight:wJunk }
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

    // ✅ NEW: miss-shot
    onShotMiss: (m)=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      emit('hha:judge', { kind:'shot_miss', x:m.x, y:m.y, lockPx:m.lockPx, score: STATE.score|0, combo: STATE.combo|0 });
      try{ STATE.AI?.onEvent?.('judge', { kind:'shot_miss' }); }catch{}
    }
  });
}

// ---------------- ML-1: features_1s + labels ----------------
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

function targetDensity01(){
  const n = document.querySelectorAll('#plate-layer .plateTarget').length;
  return clamp(n/18, 0, 1);
}

function emitFeatures1s(){
  const tPlayed = playedSec();
  const accNowPct = Math.round(accuracy()*1000)/10;

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

  const ts = now();
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

    hitGoodDelta1s: hitGoodD|0,
    hitJunkDelta1s: hitJunkD|0,
    expireGoodDelta1s: expGoodD|0,

    shotMissNow: STATE.shotMiss|0,

    accNowPct,
    accAvg3s: Math.round(accAvg3s*10)/10,

    g: [...STATE.g],
    groupImbalance01: Math.round(groupImbalance01()*1000)/1000,

    targetDensity: Math.round(targetDensity01()*1000)/1000,
    targetDensityAvg3s: Math.round(densAvg3s*1000)/1000,
    spawnRatePerSec: Math.round(spawnRatePerSec*100)/100,

    stormActive: !!STATE.storm.active,
    bossActive:  !!STATE.boss.active,
  };

  STATE.ML.lastScore = STATE.score;

  emit('hha:features_1s', feat);

  try{ STATE.AI?.onEvent?.('features_1s', feat); }catch{}

  const run = String(STATE.cfg?.runMode||'play').toLowerCase();
  const deterministic = (run === 'study' || run === 'research');
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

// ---------------- Hits ----------------
function addCombo(){ STATE.combo++; STATE.comboMax = Math.max(STATE.comboMax, STATE.combo); }
function resetCombo(){ STATE.combo = 0; }
function addScore(v){ STATE.score += (Number(v)||0); }

function onHitGood(groupIndex){
  STATE.hitGood++;

  const gi = clamp(groupIndex,0,4);
  STATE.g[gi]++;
  STATE.collectedSeen[gi] = true;

  addCombo();
  addScore(100 + STATE.combo*5);

  if(STATE.boss.active && !STATE.boss.done){
    STATE.boss.hitGood++;
    updateBossHud();
    if(STATE.boss.hitGood >= STATE.boss.needGood){
      finishBoss(true, 'need_met');
      return;
    }
  }

  if(STATE.storm.active){
    STATE.storm.hitGood++;
    updateStormHud();
    if(STATE.storm.hitGood >= STATE.storm.needGood){
      finishStorm(true, 'need_met');
      return;
    }
  }

  recomputeGoal();
  updateAccMini();

  emit('hha:judge', { kind:'good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'good', groupId: gi+1 }); }catch{}

  updateHUD();
  emitQuest();
}

function onHitJunk(){
  if(STATE.boss.active && STATE.boss.forbidJunk){
    STATE.hitJunk++; STATE.miss++; resetCombo(); addScore(-80);
    emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
    try{ STATE.AI?.onEvent?.('judge', { kind:'junk' }); }catch{}
    coach('❌ โดนขยะตอนบอส! แพ้บอสทันที!', 'sad');
    finishBoss(false, 'hit_junk');
    return;
  }

  if(STATE.storm.active && STATE.storm.forbidJunk){
    STATE.hitJunk++; STATE.miss++; resetCombo(); addScore(-70);
    emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
    try{ STATE.AI?.onEvent?.('judge', { kind:'junk' }); }catch{}
    coach('❌ STORM ห้ามโดนขยะ! พลาดแล้ว!', 'sad');
    finishStorm(false, 'hit_junk');
    return;
  }

  STATE.hitJunk++; STATE.miss++; resetCombo(); addScore(-50);
  emit('hha:judge', { kind:'junk', score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'junk' }); }catch{}
  coach('ระวัง! ของหวาน/ทอด ⚠️', 'neutral');

  updateAccMini();
  updateHUD();
  emitQuest();
}

function onExpireGood(groupIndex){
  STATE.expireGood++; STATE.miss++; resetCombo();
  const gi = clamp(groupIndex,0,4);
  emit('hha:judge', { kind:'expire_good', groupId: gi+1, score: STATE.score|0, combo: STATE.combo|0 });
  try{ STATE.AI?.onEvent?.('judge', { kind:'expire_good', groupId: gi+1 }); }catch{}
  updateAccMini();
  updateHUD();
  emitQuest();
}

// ---------------- Storm/Boss start/finish ----------------
function startStorm(){
  if(STATE.storm.active) return;
  STATE.storm.active = true;
  STATE.storm.startedAt = now();
  STATE.storm.hitGood = 0;

  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');

  const accPct = accuracy()*100;
  STATE.storm.durationSec = isStudy ? 6 : 7;
  STATE.storm.needGood = clamp(Math.round(8 + accPct/25), 8, 12);
  STATE.storm.forbidJunk = !isStudy && (accPct >= 82);

  coach('🌪️ พายุมาแล้ว! เก็บ GOOD ให้ทัน!', (STATE.storm.forbidJunk?'fever':'neutral'));
  emitLabels('mini_start', { name:'storm', cycle:STATE.storm.cycleIndex+1, needGood:STATE.storm.needGood, durationSec:STATE.storm.durationSec, forbidJunk:STATE.storm.forbidJunk });

  updateStormHud();
  restartSpawner();
  emitQuest();
}

function finishStorm(ok, reason){
  if(!STATE.storm.active) return;
  STATE.storm.active = false;

  if(ok){
    STATE.miniCleared++;
    addScore(160);
    coach('ผ่านพายุแล้ว! +160 คะแนน 🔥', 'happy');
    emit('hha:judge', { kind:'storm_clear', reason });
    emitLabels('mini_end', { name:'storm', cycle:STATE.storm.cycleIndex+1, ok:true, reason });
  }else{
    coach('พายุแรงไปนิด! เดี๋ยวเอาใหม่ 💪', 'sad');
    emit('hha:judge', { kind:'storm_fail', reason });
    emitLabels('mini_end', { name:'storm', cycle:STATE.storm.cycleIndex+1, ok:false, reason });
  }

  updateStormHud();
  STATE.storm.cycleIndex++;
  restartSpawner();
  updateHUD();
  emitQuest();
}

function startBoss(){
  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  const isStudy = (runMode === 'study' || runMode === 'research');
  if(isStudy) return;
  if(STATE.boss.active || STATE.boss.done) return;

  STATE.boss.active = true;
  STATE.boss.startedAt = now();
  STATE.boss.hitGood = 0;
  STATE.boss.triggered = true;

  const accPct = accuracy()*100;
  STATE.boss.needGood = clamp(Math.round(7 + accPct/25), 7, 11);
  STATE.boss.durationSec = 10;
  STATE.boss.forbidJunk = true;

  coach('👹 บอสมาแล้ว! โฟกัสเก็บ GOOD ให้ครบก่อนหมดเวลา!', 'neutral');
  emitLabels('mini_start', { name:'boss', needGood:STATE.boss.needGood, durationSec:STATE.boss.durationSec, forbidJunk:true });

  updateBossHud();
  restartSpawner();
  emitQuest();
}

function finishBoss(ok, reason){
  if(!STATE.boss.active) return;
  STATE.boss.active = false;
  STATE.boss.done = true;

  if(ok){
    STATE.miniCleared++;
    addScore(220);
    coach('ชนะบอส! +220 คะแนน 🔥', 'happy');
    emit('hha:judge', { kind:'boss_win', reason });
    emitLabels('mini_end', { name:'boss', ok:true, reason });
  }else{
    coach('บอสโหด! รอบหน้าเอาใหม่ 💪', 'sad');
    emit('hha:judge', { kind:'boss_lose', reason });
    emitLabels('mini_end', { name:'boss', ok:false, reason });
  }

  updateBossHud();
  restartSpawner();
  updateHUD();
  emitQuest();
}

// ---------------- Timer loop ----------------
let _tickTimer = null;

function setPaused(p){
  STATE.paused = !!p;
  const hudPaused = qs('hudPaused');
  if(hudPaused) hudPaused.style.display = STATE.paused ? 'grid' : 'none';
}

function startLoop(){
  if(_tickTimer) clearInterval(_tickTimer);

  _tickTimer = setInterval(()=>{
    if(!STATE.running || STATE.ended) return;
    if(STATE.paused) return;

    emitFeatures1s();

    STATE.timeLeft--;
    emit('hha:time', {
      game:'plate',
      timeLeftSec: STATE.timeLeft,
      leftSec: STATE.timeLeft // ✅ compat
    });

    const played = playedSec();
    const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
    const isStudy = (runMode === 'study' || runMode === 'research');
    const marks = isStudy ? [18, 42] : [20, 45, 70];

    if(!STATE.storm.active && STATE.storm.cycleIndex < marks.length && played >= marks[STATE.storm.cycleIndex]){
      startStorm();
    }

    if(STATE.storm.active){
      updateStormHud();
      if(stormTimeLeft() <= 0){
        finishStorm(false, 'timeout');
      }
    }

    if(!STATE.boss.triggered && !STATE.boss.done && !STATE.boss.active){
      const startAt = Math.max(20, Math.floor(STATE.timePlannedSec * 0.55));
      const mustHaveTimeLeft = Math.min(35, Math.floor(STATE.timePlannedSec * 0.45));
      if(played >= startAt && STATE.timeLeft <= mustHaveTimeLeft){
        startBoss();
      }
    }

    if(STATE.boss.active){
      updateBossHud();
      if(bossTimeLeft() <= 0){
        finishBoss(false, 'timeout');
      }
    }

    updateHUD();
    emitQuest();

    if(STATE.timeLeft <= 0){
      endGame('timeup');
    }
  }, 1000);
}

// ---------------- End summary + labels ----------------
function endGame(reason='end'){
  if(STATE.ended) return;
  STATE.ended = true;
  STATE.running = false;

  try{ clearInterval(_tickTimer); }catch{}
  _tickTimer = null;

  stopSpawner();

  const accPct = Math.round(accuracy()*1000)/10;
  const grade = gradeFrom(STATE.score, accPct);
  const endIso = new Date().toISOString();

  const summary = {
    timestampIso: endIso,
    projectTag: 'HHA',
    sessionId: `PLATE_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    game: 'plate',
    gameMode: 'plate',
    runMode: (STATE.cfg?.runMode || 'play'),
    diff: (STATE.cfg?.diff || 'normal'),
    seed: (STATE.cfg?.seed || 0),

    timePlannedSec: Number(STATE.timePlannedSec || 0) || 0,
    durationPlannedSec: Number(STATE.timePlannedSec || 0) || 0,
    durationPlayedSec: Number(STATE.timePlannedSec || 0) || 0,

    scoreFinal: STATE.score|0,
    comboMax: STATE.comboMax|0,

    miss: STATE.miss|0,
    misses: STATE.miss|0,
    missJunk: STATE.hitJunk|0,
    missExpire: STATE.expireGood|0,
    shotMiss: STATE.shotMiss|0,

    accuracyPct: accPct,
    accuracyGoodPct: accPct,
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
  const next = Array.isArray(hist) ? hist : [];
  next.unshift(summary);
  while(next.length > 50) next.pop();
  saveJson(LS_HIST, next);

  emit('hha:end', summary);

  emitLabels('end', {
    reason,
    grade,
    accPct,
    miss: summary.miss,
    scoreFinal: summary.scoreFinal,
    bossWin: null
  });

  emitLabels('targets', {
    y_grade: grade,
    y_score: summary.scoreFinal,
    y_miss: summary.miss,
    y_acc: accPct,
    y_all5: summary.goalsCleared ? 1 : 0,
    y_minis: summary.miniCleared
  });

  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', (grade==='D'?'sad':'happy'));
  flushHardened(reason);
}

// ---------------- Config + Controls ----------------
function parseCfgFromUrl(){
  const U = new URL(location.href);
  const runRaw = (U.searchParams.get('run') || U.searchParams.get('runMode') || 'play').toLowerCase();
  const diff   = (U.searchParams.get('diff') || 'normal').toLowerCase();
  const time   = clamp(U.searchParams.get('time') || 90, 20, 9999);
  const seedP  = U.searchParams.get('seed');

  const isStudy = (runRaw === 'study' || runRaw === 'research');
  const seed = isStudy ? (Number(seedP)||13579) : (seedP!=null ? (Number(seedP)||13579) : ((Date.now() ^ (Math.random()*1e9))|0));

  return {
    runMode: isStudy ? runRaw : 'play',
    diff: ['easy','normal','hard'].includes(diff)?diff:'normal',
    seed,
    durationPlannedSec: time
  };
}

function startGame(){
  if(!STATE.mountEl){
    console.error('[PlateVR] missing mount');
    return;
  }

  STATE.running=true; STATE.ended=false; STATE.paused=false;

  STATE.score=0; STATE.combo=0; STATE.comboMax=0;
  STATE.miss=0; STATE.hitGood=0; STATE.hitJunk=0; STATE.expireGood=0; STATE.shotMiss=0;

  STATE.g=[0,0,0,0,0];
  STATE.spawnSeen=[false,false,false,false,false];
  STATE.collectedSeen=[false,false,false,false,false];

  STATE.goal.done=false; STATE.goal.cur=0;
  STATE.accMini.done=false; STATE.accMini.cur=0;
  STATE.miniCleared=0;

  STATE.storm.active=false; STATE.storm.hitGood=0; STATE.storm.cycleIndex=0;
  STATE.boss.active=false; STATE.boss.done=false; STATE.boss.triggered=false; STATE.boss.hitGood=0;

  STATE.ML.tickN=0;
  STATE.ML.lastHitGood=0; STATE.ML.lastHitJunk=0; STATE.ML.lastExpireGood=0;
  STATE.ML.lastMiss=0; STATE.ML.lastScore=0;
  STATE.ML.bufMiss=[]; STATE.ML.bufAcc=[]; STATE.ML.bufDensity=[];
  STATE.ML.lastSpawnCount=0; STATE.ML.lastSpawnTs=0;
  STATE.ML.spawnCount = 0;

  computeMinisPlanned();

  const runMode = String(STATE.cfg?.runMode||'play').toLowerCase();
  STATE.rng = (runMode === 'study' || runMode === 'research') ? seededRng(STATE.cfg.seed) : Math.random;

  STATE.timePlannedSec = Number(STATE.cfg?.durationPlannedSec || 90) || 90;
  STATE.timeLeft = STATE.timePlannedSec;
  STATE.tStartIso = new Date().toISOString();

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
    startTimeIso: STATE.tStartIso,
    aiDeterministic: !!STATE.AI?.deterministic
  });

  coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 🍽️', 'neutral');
  setText('uiHint', 'เติมครบ 5 หมู่ แล้วรักษาความแม่นยำ!');

  stopSpawner();
  STATE.engine = makeSpawner(STATE.mountEl);

  emit('hha:time', { game:'plate', timeLeftSec: STATE.timeLeft, leftSec: STATE.timeLeft });

  updateStormHud();
  updateBossHud();
  emitQuest();
  updateHUD();
  startLoop();
}

// ---------------- Init (standalone safety) ----------------
(function init(){
  // If boot() is used by runner, cfg will be set there; still safe for standalone.
  if(!STATE.cfg) STATE.cfg = parseCfgFromUrl();

  if(!STATE.mountEl){
    // try infer
    const mount = qs('plate-layer');
    if(mount) STATE.mountEl = mount;
  }

  computeMinisPlanned();
  wireShotMiss();
  bindShootOnce();

  // do NOT auto start (runner controls). Standalone page can call window.PlateStart()
  ROOT.PlateStart = ()=> startGame();
})();
