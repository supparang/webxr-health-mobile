// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (Stereo Cardboard + Gaze + Shield/Mini)
// ✅ DOM targets spawn (mono + cardboard L/R)
// ✅ Faster + more accurate aim-assist (crosshair pick by weighted distance)
// ✅ Gaze dwell auto-shoot (default ON in Cardboard)
// ✅ Water gauge 0–100 (ui-water.js)
// ✅ Targets: 💧(+), 🚻(-), 🍟(BAD), 🛡️(Shield), ⭐(Bonus), 💎(Fever)
// ✅ Storm + End-window + Mini: block BAD with Shield (easier + clear progress)
// ✅ End summary + localStorage + hha:end payload

'use strict';

import WaterUI, { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// optional Particles (IIFE from ./vr/particles.js)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
}
function qint(name, def){
  const v = parseInt(qs(name, def), 10);
  return Number.isFinite(v) ? v : def;
}
function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return performance.now(); }

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s){
  s = String(s ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- UI helpers (support duplicated HUD via data-*) ----------
function setAllText(selector, value){
  try{
    DOC.querySelectorAll(selector).forEach(el=>{ try{ el.textContent = String(value); }catch{} });
  }catch{}
}
function setIdText(id, value){
  const el = DOC.getElementById(id);
  if (!el) return;
  try{ el.textContent = String(value); }catch{}
}
function setPill(key, value){
  setAllText(`[data-pill="${key}"]`, value);
}
function setQuest(key, value){
  setAllText(`[data-quest="${key}"]`, value);
}

// ---------- DOM/hosts ----------
function getMode(){
  return DOC.body.classList.contains('cardboard') ? 'cardboard' : 'mono';
}
function hostSet(){
  if (getMode() === 'cardboard'){
    return {
      boundsL: DOC.getElementById('cbPlayL'),
      boundsR: DOC.getElementById('cbPlayR'),
      layerL:  DOC.getElementById('hvr-layerL'),
      layerR:  DOC.getElementById('hvr-layerR'),
      monoBounds: null,
      monoLayer: null
    };
  }
  return {
    monoBounds: DOC.getElementById('playfield'),
    monoLayer:  DOC.getElementById('hvr-layer'),
    boundsL:null, boundsR:null, layerL:null, layerR:null
  };
}

function rectOf(el){
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r || r.width < 20 || r.height < 20) return null;
  return r;
}

function dispatch(name, detail){
  ROOT.dispatchEvent(new CustomEvent(name, { detail }));
}

// ---------- Game tune ----------
const diff = String(qs('diff','normal')).toLowerCase();
const runMode = String(qs('run', qs('runMode','play'))).toLowerCase() === 'research' ? 'research' : 'play';
const timeLimit = clamp(qint('time', qint('durationPlannedSec', 70)), 30, 600);

const hub = String(qs('hub','./hub.html') || './hub.html');
const sessionId = String(qs('sessionId', ''));
const ts = String(qs('ts', Date.now()));
const seedStr = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const rng = mulberry32(hashStr(seedStr));

const TUNE = {
  diff,
  runMode,
  timeLimitSec: timeLimit,

  // spawn & sizes
  baseSize: diff === 'easy' ? 76 : (diff === 'hard' ? 60 : 68),
  stormSizeMul: diff === 'easy' ? 0.78 : (diff === 'hard' ? 0.66 : 0.72),

  spawnInterval: diff === 'easy' ? 720 : (diff === 'hard' ? 520 : 620),
  stormSpawnInterval: diff === 'easy' ? 520 : (diff === 'hard' ? 360 : 440),

  // water changes
  waterStart: 50,
  plusAmt: diff === 'easy' ? 9 : (diff === 'hard' ? 7 : 8),
  minusAmt: diff === 'easy' ? 8 : (diff === 'hard' ? 7 : 8),
  badPenalty: diff === 'easy' ? 10 : (diff === 'hard' ? 12 : 11),

  // goal
  greenNeedSec: Math.round(timeLimit * (diff==='easy' ? 0.45 : (diff==='hard' ? 0.55 : 0.50))), // ~ครึ่งเวลา

  // storm
  stormEverySec: diff === 'easy' ? 20 : (diff === 'hard' ? 16 : 18),
  stormLenSec:   diff === 'easy' ? 10 : (diff === 'hard' ? 12 : 11),
  endWindowSec:  2.6, // ช่วงท้ายพายุ

  // mini
  pressureNeed: diff === 'easy' ? 55 : (diff === 'hard' ? 70 : 62), // % (ง่ายขึ้นให้ผ่านจริง)
  blockNeed:    diff === 'easy' ? 1 : (diff === 'hard' ? 2 : 1),   // บล็อก BAD ใน end-window
  gazeDwellMs:  520,  // เร็วขึ้น
  gazeRadiusMul: 0.62,

  // aim assist
  aimRadiusMul: 0.75,

  // scoring
  scoreGood: 120,
  scoreStar: 220,
  scoreDiamond: 260,
  scoreShield: 80,
  scoreBlock: 180
};

// ---------- State ----------
const S = {
  started:false,
  ended:false,
  mode:'mono',

  startTime:0,
  endTime:0,

  leftSec: TUNE.timeLimitSec,

  score:0,
  combo:0,
  comboMax:0,
  misses:0,
  shots:0,
  hits:0,

  waterPct: TUNE.waterStart,
  shield:0,
  fever:0, // 0..100

  // goal
  greenSec:0,
  goalDone:false,

  // storm/minis
  stormActive:false,
  stormLeftSec:0,
  nextStormInSec:TUNE.stormEverySec,
  pressure:0,     // 0..100
  blocksInEnd:0,
  miniCleared:0,

  // targets list (single list with meta; DOM nodes stored per host)
  targets:[], // {id, type, x, y, s, born, life, nodes:[mono or L/R], dead}
  nextId:1,

  // gaze
  gazeOn:true,
  gazeP:0,
  gazeHoldMs:0,
  gazeTargetId:0,

  // last time
  lastTick:0,
  lastSpawn:0
};

ROOT.__HVR__ = { S, TUNE };

// ---------- Audio (beep/tick/thunder) ----------
const AudioFx = (() => {
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function resume(){
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
  }
  function beep(freq=880, dur=0.06, gain=0.04){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type='sine';
    o.frequency.value=freq;
    g.gain.value=0.0001;
    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.start(t0);
    o.stop(t0+dur+0.01);
  }
  function tick(){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type='square';
    o.frequency.value=1200;
    g.gain.value=0.0001;
    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.040);
    o.start(t0);
    o.stop(t0 + 0.05);
  }
  function thunder(gain=0.08){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.7);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.02, gain), c.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.85);
    o.connect(g); g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.9);
  }
  return { resume, beep, tick, thunder };
})();

// ---------- Target defs ----------
function pickType(){
  // probabilities vary in storm
  const inStorm = S.stormActive;
  const r = rng();

  if (inStorm){
    // more BAD + shield + diamond in storm
    if (r < 0.34) return (rng() < 0.62 ? 'goodPlus' : 'goodMinus');
    if (r < 0.58) return 'bad';
    if (r < 0.72) return 'shield';
    if (r < 0.86) return 'star';
    return 'diamond';
  } else {
    if (r < 0.58) return (rng() < 0.60 ? 'goodPlus' : 'goodMinus');
    if (r < 0.70) return 'star';
    if (r < 0.80) return 'shield';
    if (r < 0.90) return 'diamond';
    return 'bad';
  }
}

function emojiFor(type){
  switch(type){
    case 'goodPlus': return '💧';
    case 'goodMinus': return '🚻';
    case 'bad': return '🍟';
    case 'shield': return '🛡️';
    case 'star': return '⭐';
    case 'diamond': return '💎';
    default: return '💧';
  }
}
function classFor(type){
  if (type === 'bad') return 'bad';
  if (type === 'shield') return 'shield';
  if (type === 'star') return 'star';
  if (type === 'diamond') return 'diamond';
  return 'good';
}
function lifeMsFor(type){
  // faster in storm
  const base = S.stormActive ? 1800 : 2300;
  if (type === 'bad') return base - 120;
  if (type === 'diamond') return base - 180;
  return base;
}

function spawnOne(){
  const hs = hostSet();
  const mode = getMode();
  const bounds = (mode === 'cardboard') ? hs.boundsL : hs.monoBounds; // use L for percent; mirror to R
  const r = rectOf(bounds);
  if (!r) return;

  // safe margins (avoid edges and HUD feel)
  const pad = 0.10; // 10%
  const x = pad + (1 - pad*2) * rng();
  const y = pad + (1 - pad*2) * rng();

  const type = pickType();
  const sizeBase = TUNE.baseSize * (S.stormActive ? TUNE.stormSizeMul : 1.0);
  const jitter = 0.86 + rng()*0.34;
  const s = Math.round(sizeBase * jitter);

  const id = S.nextId++;
  const t = {
    id, type, x, y, s,
    born: now(),
    life: lifeMsFor(type),
    dead:false,
    nodes:[]
  };

  function makeNode(){
    const el = DOC.createElement('div');
    el.className = `tgt ${classFor(type)} pop`;
    el.setAttribute('data-id', String(id));
    el.setAttribute('data-type', type);
    el.style.setProperty('--x', (x*100).toFixed(3) + '%');
    el.style.setProperty('--y', (y*100).toFixed(3) + '%');
    el.style.setProperty('--s', s + 'px');
    el.textContent = emojiFor(type);
    // allow tap directly too (optional)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      shoot({ reason:'tap', pickId:id });
    }, { passive:false });
    return el;
  }

  if (mode === 'cardboard'){
    if (hs.layerL){
      const elL = makeNode();
      hs.layerL.appendChild(elL);
      t.nodes.push(elL);
    }
    if (hs.layerR){
      const elR = makeNode();
      hs.layerR.appendChild(elR);
      t.nodes.push(elR);
    }
  } else {
    if (hs.monoLayer){
      const el = makeNode();
      hs.monoLayer.appendChild(el);
      t.nodes.push(el);
    }
  }

  S.targets.push(t);
}

function cleanupDead(){
  const tnow = now();
  for (const t of S.targets){
    if (t.dead) continue;
    if ((tnow - t.born) >= t.life){
      t.dead = true;
      for (const n of t.nodes){
        try{
          n.classList.remove('pop');
          n.classList.add('out');
          setTimeout(()=>{ try{ n.remove(); }catch{} }, 190);
        }catch{}
      }
    }
  }
  // prune
  if (S.targets.length > 160){
    S.targets = S.targets.filter(x => !x.dead);
  }
}

// ---------- Aim pick & shoot ----------
function aimPick(){
  const hs = hostSet();
  const mode = getMode();
  const bounds = (mode === 'cardboard') ? hs.boundsL : hs.monoBounds;
  const r = rectOf(bounds);
  if (!r) return null;

  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  let best = null;
  let bestScore = 1e18;

  for (const t of S.targets){
    if (t.dead) continue;
    // center in screen pixels (use L rect mapping)
    const tx = r.left + t.x * r.width;
    const ty = r.top  + t.y * r.height;
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy);

    const rad = Math.max(18, (t.s * TUNE.aimRadiusMul));
    if (dist > rad) continue;

    // weighted: smaller dist & smaller target gets priority
    const w = dist / Math.max(26, t.s);
    if (w < bestScore){
      bestScore = w;
      best = t;
    }
  }
  return best;
}

function scorePopAtBounds(xPct, yPct, text){
  const hs = hostSet();
  const mode = getMode();
  if (mode === 'cardboard'){
    const r = rectOf(hs.boundsL);
    if (!r) return;
    const x = r.left + xPct * r.width;
    const y = r.top  + yPct * r.height;
    try{ Particles.scorePop(x, y, text); }catch{}
  } else {
    const r = rectOf(hs.monoBounds);
    if (!r) return;
    const x = r.left + xPct * r.width;
    const y = r.top  + yPct * r.height;
    try{ Particles.scorePop(x, y, text); }catch{}
  }
}

function hitRemove(t){
  t.dead = true;
  for (const n of t.nodes){
    try{
      n.classList.remove('pop');
      n.classList.add('out');
      setTimeout(()=>{ try{ n.remove(); }catch{} }, 190);
    }catch{}
  }
}

function shoot(opts = {}){
  if (!S.started || S.ended) return;

  AudioFx.resume();

  S.shots++;
  const forcedId = opts.pickId || 0;
  const t = forcedId ? S.targets.find(x=>x.id===forcedId && !x.dead) : aimPick();

  if (!t){
    S.misses++;
    S.combo = 0;
    AudioFx.beep(280, 0.06, 0.035);
    scorePopAtBounds(0.5, 0.5, 'MISS');
    uiSync();
    return;
  }

  S.hits++;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  const z = zoneFrom(S.waterPct);
  let scoreAdd = 0;

  if (t.type === 'goodPlus'){
    S.waterPct = clamp(S.waterPct + TUNE.plusAmt, 0, 100);
    scoreAdd = TUNE.scoreGood;
    AudioFx.beep(980, 0.05, 0.045);
    scorePopAtBounds(t.x, t.y, '+WATER');
    S.fever = clamp(S.fever + 3, 0, 100);
  }
  else if (t.type === 'goodMinus'){
    S.waterPct = clamp(S.waterPct - TUNE.minusAmt, 0, 100);
    scoreAdd = TUNE.scoreGood;
    AudioFx.beep(820, 0.05, 0.042);
    scorePopAtBounds(t.x, t.y, '-WATER');
    S.fever = clamp(S.fever + 3, 0, 100);
  }
  else if (t.type === 'shield'){
    S.shield = clamp(S.shield + 1, 0, 6);
    scoreAdd = TUNE.scoreShield;
    AudioFx.beep(720, 0.06, 0.040);
    scorePopAtBounds(t.x, t.y, 'SHIELD+1');
  }
  else if (t.type === 'star'){
    scoreAdd = TUNE.scoreStar;
    AudioFx.beep(1200, 0.05, 0.040);
    scorePopAtBounds(t.x, t.y, 'BONUS');
    S.fever = clamp(S.fever + 10, 0, 100);
  }
  else if (t.type === 'diamond'){
    scoreAdd = TUNE.scoreDiamond;
    AudioFx.beep(1380, 0.05, 0.040);
    scorePopAtBounds(t.x, t.y, 'FEVER+');
    S.fever = clamp(S.fever + 18, 0, 100);
  }
  else if (t.type === 'bad'){
    // BAD: if shield available => block, else penalize
    const inEnd = !!(S.stormActive && S.stormLeftSec <= (TUNE.endWindowSec + 0.02));

    if (S.shield > 0){
      S.shield--;
      scoreAdd = TUNE.scoreBlock;
      AudioFx.beep(1050, 0.06, 0.045);
      scorePopAtBounds(t.x, t.y, 'BLOCK!');
      if (inEnd) S.blocksInEnd++;
    } else {
      S.misses++;
      S.combo = 0;
      S.waterPct = clamp(S.waterPct - TUNE.badPenalty, 0, 100);
      AudioFx.beep(240, 0.06, 0.045);
      scorePopAtBounds(t.x, t.y, 'BAD!');
    }
    S.fever = clamp(S.fever + 6, 0, 100);
  }

  // fever score bump
  const feverMul = (S.fever >= 90) ? 1.25 : (S.fever >= 70 ? 1.15 : 1.0);
  scoreAdd = Math.round(scoreAdd * feverMul);

  // combo multiplier (soft)
  if (S.combo >= 10) scoreAdd = Math.round(scoreAdd * 1.12);
  if (S.combo >= 20) scoreAdd = Math.round(scoreAdd * 1.22);

  S.score += scoreAdd;

  try{ Particles.burstAt(); }catch{}
  hitRemove(t);

  // update UI immediately
  setWaterGauge(S.waterPct);
  uiSync();
}

// ---------- Storm / mini / goal ----------
function stormTick(dt){
  if (S.stormActive){
    S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);
    if (S.stormLeftSec <= 0){
      S.stormActive = false;
      S.nextStormInSec = TUNE.stormEverySec;
      S.blocksInEnd = 0;
      DOC.body.classList.remove('endwindow');
      DOC.documentElement.style.setProperty('--endamp', '0');
      DOC.documentElement.style.setProperty('--endflash', '0');
    }
  } else {
    S.nextStormInSec = Math.max(0, S.nextStormInSec - dt);
    if (S.nextStormInSec <= 0){
      S.stormActive = true;
      S.stormLeftSec = TUNE.stormLenSec;
      AudioFx.thunder(0.07);
      // mini resets each storm
      S.pressure = Math.max(0, S.pressure * 0.25);
      S.blocksInEnd = 0;
    }
  }

  // pressure: builds only in storm when NOT GREEN (force challenge)
  if (S.stormActive){
    const z = zoneFrom(S.waterPct);
    const k = (z === 'GREEN') ? -18 : 28; // green reduces pressure fast; non-green builds
    S.pressure = clamp(S.pressure + k*dt, 0, 100);

    // end-window cinematic intensity
    const inEnd = (S.stormLeftSec <= TUNE.endWindowSec);
    if (inEnd){
      DOC.body.classList.add('endwindow');
      const k2 = clamp(1 - (S.stormLeftSec / TUNE.endWindowSec), 0, 1);
      DOC.documentElement.style.setProperty('--endamp', String(0.25 + 0.75*k2));
      // flash pulse driven by tick sound in HTML if you keep it; here keep mild
      DOC.documentElement.style.setProperty('--endflash', String(0.25*k2));
      AudioFx.tick(); // reinforce urgency
    } else {
      DOC.body.classList.remove('endwindow');
      DOC.documentElement.style.setProperty('--endamp', '0');
      DOC.documentElement.style.setProperty('--endflash', '0');
    }
  } else {
    // relax pressure out of storm
    S.pressure = clamp(S.pressure - 22*dt, 0, 100);
    DOC.body.classList.remove('endwindow');
    DOC.documentElement.style.setProperty('--endamp', '0');
    DOC.documentElement.style.setProperty('--endflash', '0');
  }

  // mini clear check (easier + deterministic)
  // conditions to pass within any storm:
  // - must reach pressureNeed at some point (we treat as "pressure >= need" now)
  // - must block blockNeed BAD during end-window
  // - water zone must be LOW/HIGH during end-window moment (not GREEN)
  const inEnd = !!(S.stormActive && S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  const zNow = zoneFrom(S.waterPct);
  const zoneOk = (zNow !== 'GREEN');
  const pressureOk = (S.pressure >= TUNE.pressureNeed);
  const blocksOk = (S.blocksInEnd >= TUNE.blockNeed);

  if (!S.ended){
    if (pressureOk && inEnd){
      // show that you're "eligible" now
      setQuest('state', blocksOk && zoneOk ? 'BLOCK NOW!' : (zoneOk ? 'READY: need BLOCK' : 'READY: not GREEN'));
    }
    if (blocksOk && pressureOk && zoneOk){
      // clear mini once per storm
      // to avoid multi-trigger, require stormActive and miniCleared==0 or last clear older than storm start;
      // simplest: when cleared, set pressure=0 so it won't instantly clear again
      if (S.stormActive){
        S.miniCleared = 1;
        S.score += 350;
        AudioFx.beep(1400, 0.08, 0.05);
        setQuest('state', 'MINI CLEARED!');
        setPill('mini', '✅ CLEARED');
        S.pressure = 0;
      }
    }
  }
}

function goalTick(dt){
  // goal: stay GREEN for greenNeedSec (accumulated)
  const z = zoneFrom(S.waterPct);
  if (!S.goalDone && z === 'GREEN'){
    S.greenSec = Math.min(TUNE.greenNeedSec, S.greenSec + dt);
    if (S.greenSec >= TUNE.greenNeedSec){
      S.goalDone = true;
      S.score += 600;
      AudioFx.beep(1600, 0.10, 0.05);
      setPill('goal', '✅ DONE');
      setQuest('goal', 'อยู่ใน GREEN ครบแล้ว!');
    }
  }
}

// ---------- Grade ----------
function gradeOf(){
  // combine: score + accuracy + goal + mini
  const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;
  const base = S.score
    + (S.goalDone ? 800 : 0)
    + (S.miniCleared ? 450 : 0)
    + Math.round(acc * 400);

  if (base >= 4200) return 'SSS';
  if (base >= 3400) return 'SS';
  if (base >= 2700) return 'S';
  if (base >= 1900) return 'A';
  if (base >= 1200) return 'B';
  return 'C';
}

// ---------- UI sync ----------
function uiSync(){
  // stats (ids + data copies)
  setAllText('[data-stat="score"]', S.score|0);
  setAllText('[data-stat="combo"]', S.combo|0);
  setAllText('[data-stat="miss"]',  S.misses|0);
  setAllText('[data-stat="time"]',  Math.ceil(S.leftSec));
  setAllText('[data-stat="shield"]', S.shield|0);

  const press = Math.round(S.pressure) + '%';
  setAllText('[data-stat="press"]', press);
  setIdText('press-pct', press);

  const g = gradeOf();
  setAllText('[data-stat="grade"]', g);

  // pills
  const goalLeft = Math.max(0, Math.ceil(TUNE.greenNeedSec - S.greenSec));
  setPill('goal', S.goalDone ? '✅ DONE' : (goalLeft + 's GREEN'));
  setPill('storm', S.stormActive ? (Math.ceil(S.stormLeftSec) + 's') : ('in ' + Math.ceil(S.nextStormInSec) + 's'));
  if (!S.stormActive && !S.miniCleared) setPill('mini', 'WAIT STORM');
  if (S.stormActive && !S.miniCleared){
    const needB = TUNE.blockNeed;
    setPill('mini', `BLOCK ${S.blocksInEnd}/${needB}`);
  }

  // quest lines
  setQuest('goal', S.goalDone ? 'อยู่ใน GREEN ครบแล้ว!' : `อยู่ใน GREEN ให้ครบ ${TUNE.greenNeedSec|0}s`);
  setQuest('prog', `${Math.floor(S.greenSec)}/${TUNE.greenNeedSec}s GREEN`);
  setQuest('mini', S.miniCleared ? '✅ Mini cleared' : `PRESS ≥ ${TUNE.pressureNeed}% + End-window BLOCK`);
  if (!S.stormActive) setQuest('state', 'CALM');
  if (S.stormActive){
    const inEnd = (S.stormLeftSec <= TUNE.endWindowSec);
    setQuest('state', inEnd ? 'END-WINDOW!' : 'STORM!');
  }

  // storm left id
  setIdText('storm-left', S.stormActive ? Math.ceil(S.stormLeftSec) : 0);

  // events for external HUD/loggers if needed
  dispatch('hha:score', {
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    left: Math.ceil(S.leftSec),
    grade: g
  });
  dispatch('hha:time', { left: Math.ceil(S.leftSec) });
}

// ---------- Gaze dwell ----------
function gazeTick(dt){
  const gazeEnabled = (S.mode === 'cardboard') && (ROOT.__HVR_GAZE_ON__ !== false);
  S.gazeOn = !!gazeEnabled;

  if (!S.gazeOn){
    S.gazeHoldMs = 0;
    S.gazeP = 0;
    S.gazeTargetId = 0;
    dispatch('hvr:gaze', { p:0 });
    return;
  }

  const t = aimPick();
  if (!t){
    S.gazeHoldMs = Math.max(0, S.gazeHoldMs - dt*1000*2.0);
    S.gazeP = clamp(S.gazeHoldMs / TUNE.gazeDwellMs, 0, 1);
    dispatch('hvr:gaze', { p:S.gazeP });
    return;
  }

  if (S.gazeTargetId !== t.id){
    S.gazeTargetId = t.id;
    S.gazeHoldMs = 0;
  }

  // must be close enough (tighter than aim assist)
  // reuse bounds L
  const hs = hostSet();
  const r = rectOf(hs.boundsL);
  if (!r) return;

  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;
  const tx = r.left + t.x * r.width;
  const ty = r.top  + t.y * r.height;
  const dist = Math.hypot(tx-cx, ty-cy);
  const rad = Math.max(18, t.s * TUNE.gazeRadiusMul);

  if (dist <= rad){
    S.gazeHoldMs += dt*1000;
  } else {
    S.gazeHoldMs = Math.max(0, S.gazeHoldMs - dt*1000*2.2);
  }

  S.gazeP = clamp(S.gazeHoldMs / TUNE.gazeDwellMs, 0, 1);
  dispatch('hvr:gaze', { p:S.gazeP });

  if (S.gazeP >= 1){
    S.gazeHoldMs = 0;
    S.gazeP = 0;
    dispatch('hvr:gaze', { p:0 });
    shoot({ reason:'gaze' });
  }
}

// ---------- Main loop ----------
function tick(t){
  if (!S.started || S.ended){
    requestAnimationFrame(tick);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (t - (S.lastTick||t))/1000));
  S.lastTick = t;

  // time
  const elapsed = (t - S.startTime)/1000;
  S.leftSec = Math.max(0, TUNE.timeLimitSec - elapsed);

  // goal/minis
  goalTick(dt);
  stormTick(dt);
  gazeTick(dt);

  // water gauge & theme
  setWaterGauge(S.waterPct);

  // spawn
  const interval = S.stormActive ? TUNE.stormSpawnInterval : TUNE.spawnInterval;
  if ((t - S.lastSpawn) >= interval){
    S.lastSpawn = t;
    spawnOne();
    // keep density higher in storm
    if (S.stormActive && rng() < 0.35) spawnOne();
  }

  // expire
  cleanupDead();

  // UI
  uiSync();

  // end
  if (S.leftSec <= 0){
    endGame('timeup');
  }

  requestAnimationFrame(tick);
}

function buildEndPayload(reason='end'){
  const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;
  const grade = gradeOf();

  const payload = {
    // base schema-ish
    timestampIso: String(qs('timestampIso', new Date().toISOString())),
    projectTag: String(qs('projectTag','HeroHealth')),
    runMode: String(qs('runMode', runMode)),
    studyId: String(qs('studyId','')),
    phase: String(qs('phase','')),
    conditionGroup: String(qs('conditionGroup','')),
    sessionOrder: Number(qs('sessionOrder','0')) || 0,
    blockLabel: String(qs('blockLabel','')),
    siteCode: String(qs('siteCode','')),
    schoolYear: String(qs('schoolYear','')),
    semester: String(qs('semester','')),
    sessionId: String(qs('sessionId', sessionId)),
    gameMode: 'hydration',
    gameVersion: String(qs('gameVersion','20251228-hydration')),
    diff: diff,
    durationPlannedSec: Number(qs('durationPlannedSec', TUNE.timeLimitSec)) || TUNE.timeLimitSec,
    durationPlayedSec: Math.round((S.endTime - S.startTime)/1000),

    // performance
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    goalsCleared: S.goalDone ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.miniCleared ? 1 : 0,
    miniTotal: 1,
    accuracyGoodPct: Math.round(acc*100),

    // hydration-specific
    waterEndPct: Math.round(S.waterPct),
    greenSec: Math.round(S.greenSec),
    greenNeedSec: TUNE.greenNeedSec,
    pressureMaxApprox: Math.round(S.pressure),
    blocksInEnd: S.blocksInEnd,

    // grade
    grade,

    // meta
    device: (navigator.userAgent || ''),
    reason,

    startTimeIso: new Date(Date.now() - Math.round((TUNE.timeLimitSec - S.leftSec)*1000)).toISOString(),
    endTimeIso: new Date().toISOString(),

    // student info passthrough
    studentKey: String(qs('studentKey','')),
    studentNo: String(qs('studentNo','')),
    age: String(qs('age','')),
    gradeLevel: String(qs('gradeLevel','')),
  };

  return payload;
}

function endGame(reason='end'){
  if (S.ended) return;
  S.ended = true;
  S.endTime = now();

  const payload = buildEndPayload(reason);

  // store last summary
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    localStorage.setItem('hha_last_summary', JSON.stringify(payload));
  }catch{}

  // notify logger / others
  dispatch('hha:end', payload);

  // show end UI (hydration-vr.html listens to hvr:endui)
  dispatch('hvr:endui', payload);

  // stop gaze ring
  dispatch('hvr:gaze', { p:0 });
}

// ---------- Start/Stop wiring ----------
function start(mode){
  if (S.started) return;
  S.started = true;
  S.mode = mode === 'cardboard' ? 'cardboard' : 'mono';
  S.startTime = now();
  S.lastTick = 0;
  S.lastSpawn = 0;

  ensureWaterGauge();
  setWaterGauge(S.waterPct);

  AudioFx.resume();
  AudioFx.beep(980, 0.08, 0.045);

  uiSync();
  requestAnimationFrame(tick);
}

ROOT.addEventListener('hvr:start', (ev)=>{
  const mode = (ev && ev.detail && ev.detail.mode) ? ev.detail.mode : getMode();
  start(mode);
}, { passive:true });

ROOT.addEventListener('hvr:stop', ()=>{
  try{ endGame('stop'); }catch{}
}, { passive:true });

ROOT.addEventListener('hvr:shoot', ()=>{
  shoot({ reason:'btn' });
}, { passive:true });

// also allow click/tap anywhere on playfield to shoot (mono + cardboard)
function bindShootPads(){
  const mono = DOC.getElementById('playfield');
  if (mono){
    mono.addEventListener('pointerdown', (ev)=>{
      // avoid tapping on target node itself (already handled)
      if (ev.target && String(ev.target.className||'').includes('tgt')) return;
      shoot({ reason:'pad' });
    }, { passive:true });
  }
  const l = DOC.getElementById('cbPlayL');
  const r = DOC.getElementById('cbPlayR');
  if (l) l.addEventListener('pointerdown', (ev)=>{ if(String(ev.target.className||'').includes('tgt')) return; shoot({ reason:'pad' }); }, { passive:true });
  if (r) r.addEventListener('pointerdown', (ev)=>{ if(String(ev.target.className||'').includes('tgt')) return; shoot({ reason:'pad' }); }, { passive:true });
}
bindShootPads();

// If autostart=1
if (qs('autostart','0') === '1'){
  DOC.body.classList.remove('cardboard');
  start('mono');
}
