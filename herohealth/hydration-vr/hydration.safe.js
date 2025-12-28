// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (Stereo Cardboard + Gaze + BossStorm + Perfect + Adaptive)
// ✅ Boss Storm (End-window): 🍟 BOSS ต้องบล็อกด้วย Shield ต่อเนื่อง N ครั้ง
// ✅ Perfect window: ยิงเร็ว (RT <= window) ได้ PERFECT + ลด pressure + โบนัส
// ✅ Adaptive (PLAY MODE ONLY): ปรับ size/spawn/life ตามความสามารถ (research ไม่ปรับ)
// ✅ DOM targets spawn (mono + cardboard L/R)
// ✅ Gaze dwell auto-shoot (default ON in Cardboard)
// ✅ Water gauge 0–100 (ui-water.js)
// ✅ Targets: 💧(+), 🚻(-), 🍟(BAD), 🛡️(Shield), ⭐(Bonus), 💎(Fever), 🍟(BOSS)
// ✅ End summary + localStorage + hha:end payload

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

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

function dispatch(name, detail){
  ROOT.dispatchEvent(new CustomEvent(name, { detail }));
}

// ---------- Query / tune ----------
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

  // base target size & spawn (will be adapted in PLAY)
  baseSize: diff === 'easy' ? 76 : (diff === 'hard' ? 60 : 68),
  stormSizeMul: diff === 'easy' ? 0.78 : (diff === 'hard' ? 0.66 : 0.72),

  spawnInterval: diff === 'easy' ? 720 : (diff === 'hard' ? 520 : 620),
  stormSpawnInterval: diff === 'easy' ? 520 : (diff === 'hard' ? 360 : 440),

  // water changes
  waterStart: 50,
  plusAmt: diff === 'easy' ? 9 : (diff === 'hard' ? 7 : 8),
  minusAmt: diff === 'easy' ? 8 : (diff === 'hard' ? 7 : 8),
  badPenalty: diff === 'easy' ? 10 : (diff === 'hard' ? 12 : 11),

  // goal: stay GREEN
  greenNeedSec: Math.round(timeLimit * (diff==='easy' ? 0.45 : (diff==='hard' ? 0.55 : 0.50))),

  // storm cadence
  stormEverySec: diff === 'easy' ? 20 : (diff === 'hard' ? 16 : 18),
  stormLenSec:   diff === 'easy' ? 10 : (diff === 'hard' ? 12 : 11),
  endWindowSec:  2.6, // ช่วงท้ายพายุ

  // Boss Storm (Feature #1)
  bossBlockNeed: diff === 'easy' ? 1 : 2,   // ⭐ ต้องบล็อกต่อเนื่องกี่ครั้ง
  bossPenalty:   diff === 'easy' ? 14 : 18, // โดนบอสไม่มีชิลด์ = โดนหนัก
  bossSizeMul:   1.55,                      // บอสใหญ่ขึ้น

  // Perfect window (Feature #2)
  perfectWindowMs: diff === 'easy' ? 420 : (diff === 'hard' ? 320 : 360),
  perfectBonus: diff === 'easy' ? 90 : (diff === 'hard' ? 130 : 110),
  perfectPressureDrop: diff === 'easy' ? 22 : (diff === 'hard' ? 18 : 20), // ลด pressure ต่อ perfect

  // Gaze
  gazeDwellMs:  520,
  gazeRadiusMul: 0.62,

  // aim assist
  aimRadiusMul: 0.75,

  // scoring
  scoreGood: 120,
  scoreStar: 220,
  scoreDiamond: 260,
  scoreShield: 80,
  scoreBlock: 180,
  scoreBossBlock: diff === 'easy' ? 220 : 260, // บล็อกบอสให้คุ้ม
};

// ---------- Audio ----------
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

// ---------- Hosts / rect ----------
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

// ---------- UI helpers (dup HUD via data-*) ----------
function setAllText(selector, value){
  try{
    DOC.querySelectorAll(selector).forEach(el=>{ try{ el.textContent = String(value); }catch{} });
  }catch{}
}
function setPill(key, value){
  setAllText(`[data-pill="${key}"]`, value);
}
function setQuest(key, value){
  setAllText(`[data-quest="${key}"]`, value);
}

// ---------- Adaptive controller (Feature #3) ----------
function clamp01(x){ return x<0?0:(x>1?1:x); }

const Adaptive = {
  enabled: (runMode === 'play'),     // ✅ research ไม่ปรับ
  level: 0.0,                        // 0..1
  sizeMul: 1.0,
  spawnMul: 1.0,
  lifeMul: 1.0,
  lastEvalT: 0,
  shotsAtEval: 0,
  hitsAtEval: 0,
  missAtEval: 0,
  perfectAtEval: 0,

  apply(){
    // map level -> multipliers
    // level↑ => เป้าเล็กลง + spawn ถี่ขึ้น + อายุสั้นลง
    const L = clamp01(this.level);
    this.sizeMul  = 1.0 - 0.18*L;
    this.spawnMul = 1.0 + 0.30*L;
    this.lifeMul  = 1.0 - 0.10*L;
  },

  eval(tNow, S){
    if (!this.enabled) return;
    if (!this.lastEvalT) this.lastEvalT = tNow;
    const dt = (tNow - this.lastEvalT) / 1000;
    if (dt < 5.0) return; // ประเมินทุก ~5s

    const dShots = (S.shots - this.shotsAtEval);
    const dHits  = (S.hits  - this.hitsAtEval);
    const dMiss  = (S.misses - this.missAtEval);
    const dPerf  = (S.perfectCount - this.perfectAtEval);

    const acc = dShots > 0 ? (dHits / dShots) : 0;
    const perfRate = dShots > 0 ? (dPerf / dShots) : 0;

    // simple rules:
    // - เล่นดี (acc high + perf some) => level up
    // - เล่นเริ่มพัง (acc low หรือ miss เยอะ) => level down
    let delta = 0;

    if (dShots >= 6){
      if (acc >= 0.78) delta += 0.08;
      if (acc >= 0.85) delta += 0.06;
      if (perfRate >= 0.18) delta += 0.06;

      if (acc <= 0.55) delta -= 0.10;
      if (dMiss >= 4)  delta -= 0.08;
      if (acc <= 0.45) delta -= 0.12;
    }

    // storm already hard: dampen changes in storm
    if (S.stormActive) delta *= 0.55;

    this.level = clamp01(this.level + delta);
    this.apply();

    this.lastEvalT = tNow;
    this.shotsAtEval = S.shots;
    this.hitsAtEval  = S.hits;
    this.missAtEval  = S.misses;
    this.perfectAtEval = S.perfectCount;

    // debug event (optional)
    dispatch('hha:adaptive', {
      level: this.level,
      sizeMul: this.sizeMul,
      spawnMul: this.spawnMul,
      lifeMul: this.lifeMul
    });
  }
};

// ---------- State ----------
const S = {
  started:false,
  ended:false,
  mode:'mono',

  startTime:0,
  endTime:0,
  lastTick:0,
  lastSpawn:0,

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

  // storm/boss/mini
  stormActive:false,
  stormLeftSec:0,
  nextStormInSec:TUNE.stormEverySec,

  inEndWindow:false,
  bossId:0,
  bossBlocks:0,
  bossCleared:false,
  miniCleared:0,

  // pressure
  pressure:0,

  // perfect stats
  perfectCount:0,
  rtSumMs:0,
  rtCount:0,

  // targets list
  targets:[], // {id,type,x,y,s,born,life,dead,nodes:[]}
  nextId:1,

  // gaze
  gazeOn:true,
  gazeP:0,
  gazeHoldMs:0,
  gazeTargetId:0,
};

ROOT.__HVR__ = { S, TUNE, Adaptive };

// ---------- Target defs ----------
function emojiFor(type){
  switch(type){
    case 'goodPlus': return '💧';
    case 'goodMinus': return '🚻';
    case 'bad': return '🍟';
    case 'shield': return '🛡️';
    case 'star': return '⭐';
    case 'diamond': return '💎';
    case 'bossbad': return '🍟'; // boss uses class boss for styling
    default: return '💧';
  }
}
function classFor(type){
  if (type === 'bossbad') return 'bad boss';
  if (type === 'bad') return 'bad';
  if (type === 'shield') return 'shield';
  if (type === 'star') return 'star';
  if (type === 'diamond') return 'diamond';
  return 'good';
}

function lifeMsFor(type, inStorm){
  const base = inStorm ? 1800 : 2300;
  let life = base;
  if (type === 'bad') life = base - 120;
  if (type === 'diamond') life = base - 180;
  if (type === 'bossbad') life = Math.max(900, Math.round((inStorm ? 1800 : 1900))); // boss lives through end-window logic anyway
  // adaptive life
  life = Math.round(life * (Adaptive.enabled ? Adaptive.lifeMul : 1.0));
  return life;
}

function pickType(inStorm){
  // if boss is alive => reduce random bad a bit (avoid clutter)
  if (S.bossId && !S.bossCleared) {
    const r = rng();
    if (r < 0.62) return (rng() < 0.62 ? 'goodPlus' : 'goodMinus');
    if (r < 0.76) return 'shield';
    if (r < 0.90) return 'star';
    return 'diamond';
  }

  const r = rng();
  if (inStorm){
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

function spawnNodeTo(layer, id, type, x, y, s){
  const el = DOC.createElement('div');
  el.className = `tgt ${classFor(type)} pop`;
  el.setAttribute('data-id', String(id));
  el.setAttribute('data-type', type);
  el.style.setProperty('--x', (x*100).toFixed(3) + '%');
  el.style.setProperty('--y', (y*100).toFixed(3) + '%');
  el.style.setProperty('--s', s + 'px');
  el.textContent = emojiFor(type);

  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    shoot({ reason:'tap', pickId:id });
  }, { passive:false });

  layer.appendChild(el);
  return el;
}

function spawnTarget(typeOverride=null, opts={}){
  const hs = hostSet();
  const mode = getMode();
  const bounds = (mode === 'cardboard') ? hs.boundsL : hs.monoBounds;
  const r = rectOf(bounds);
  if (!r) return null;

  const pad = 0.10;
  const x = clamp(opts.x ?? (pad + (1 - pad*2) * rng()), 0.02, 0.98);
  const y = clamp(opts.y ?? (pad + (1 - pad*2) * rng()), 0.02, 0.98);

  const inStorm = S.stormActive;
  const type = typeOverride || pickType(inStorm);

  const base = TUNE.baseSize * (Adaptive.enabled ? Adaptive.sizeMul : 1.0) * (inStorm ? TUNE.stormSizeMul : 1.0);
  const jitter = (type === 'bossbad') ? 1.0 : (0.86 + rng()*0.34);
  let s = Math.round(base * jitter);

  if (type === 'bossbad'){
    s = Math.round(TUNE.baseSize * (inStorm ? TUNE.stormSizeMul : 1.0) * TUNE.bossSizeMul);
  }

  const id = S.nextId++;
  const t = {
    id, type, x, y, s,
    born: now(),
    life: lifeMsFor(type, inStorm),
    dead:false,
    nodes:[]
  };

  if (mode === 'cardboard'){
    if (hs.layerL) t.nodes.push(spawnNodeTo(hs.layerL, id, type, x, y, s));
    if (hs.layerR) t.nodes.push(spawnNodeTo(hs.layerR, id, type, x, y, s));
  } else {
    if (hs.monoLayer) t.nodes.push(spawnNodeTo(hs.monoLayer, id, type, x, y, s));
  }

  S.targets.push(t);
  return t;
}

function removeTarget(t){
  if (!t || t.dead) return;
  t.dead = true;
  for (const n of t.nodes){
    try{
      n.classList.remove('pop');
      n.classList.add('out');
      setTimeout(()=>{ try{ n.remove(); }catch{} }, 190);
    }catch{}
  }
}

function cleanupDead(){
  const tnow = now();
  for (const t of S.targets){
    if (t.dead) continue;
    if ((tnow - t.born) >= t.life){
      removeTarget(t);
    }
  }
  if (S.targets.length > 180){
    S.targets = S.targets.filter(x => !x.dead);
  }
}

function scorePopAt(xPct, yPct, text){
  const hs = hostSet();
  const mode = getMode();
  const bounds = (mode === 'cardboard') ? hs.boundsL : hs.monoBounds;
  const r = rectOf(bounds);
  if (!r) return;
  const x = r.left + xPct * r.width;
  const y = r.top  + yPct * r.height;
  try{ Particles.scorePop(x, y, text); }catch{}
}

// ---------- Aim pick ----------
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

    const tx = r.left + t.x * r.width;
    const ty = r.top  + t.y * r.height;
    const dist = Math.hypot(tx - cx, ty - cy);

    const rad = Math.max(18, (t.s * TUNE.aimRadiusMul));
    if (dist > rad) continue;

    // weighted: closer + smaller target priority (boss is large but still pickable)
    const w = dist / Math.max(28, t.s);
    if (w < bestScore){
      bestScore = w;
      best = t;
    }
  }
  return best;
}

// ---------- Perfect window (Feature #2) ----------
function onPerfect(rtMs, t){
  S.perfectCount++;
  S.score += TUNE.perfectBonus;
  S.fever = clamp(S.fever + 6, 0, 100);
  S.pressure = clamp(S.pressure - TUNE.perfectPressureDrop, 0, 100);

  AudioFx.beep(1500, 0.06, 0.04);
  scorePopAt(t.x, t.y, 'PERFECT');
}

// ---------- Boss Storm (Feature #1) ----------
function ensureBossSpawn(){
  if (!S.inEndWindow) return;
  if (S.bossId && !S.bossCleared) return;

  // spawn boss near center-ish
  const bx = clamp(0.38 + rng()*0.24, 0.20, 0.80);
  const by = clamp(0.42 + rng()*0.22, 0.20, 0.85);

  const boss = spawnTarget('bossbad', { x: bx, y: by });
  if (boss){
    S.bossId = boss.id;
    S.bossBlocks = 0;
    S.bossCleared = false;
    setPill('mini', `BOSS 0/${TUNE.bossBlockNeed}`);
    setQuest('mini', `BOSS: บล็อก 🍟 ให้ครบ ${TUNE.bossBlockNeed} ครั้ง (ต้องมี Shield)`);
    setQuest('state', 'END-WINDOW BOSS!');
    AudioFx.thunder(0.085);
  }
}

function bossOnBlock(t){
  S.bossBlocks++;
  S.score += TUNE.scoreBossBlock;
  AudioFx.beep(1100, 0.07, 0.045);
  scorePopAt(t.x, t.y, `BOSS BLOCK ${S.bossBlocks}/${TUNE.bossBlockNeed}`);

  setPill('mini', `BOSS ${S.bossBlocks}/${TUNE.bossBlockNeed}`);

  if (S.bossBlocks >= TUNE.bossBlockNeed){
    S.bossCleared = true;
    S.miniCleared = 1;

    S.score += 420;
    AudioFx.beep(1650, 0.09, 0.05);
    scorePopAt(t.x, t.y, 'BOSS DOWN!');

    removeTarget(t);
    setPill('mini', '✅ BOSS DOWN');
    setQuest('state', 'MINI CLEARED!');
  } else {
    // keep boss alive until cleared or window ends
    // extend life a bit so it won't expire before next block
    t.born = now();
    t.life = Math.max(t.life, 1500);
  }
}

// ---------- Shoot ----------
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
    scorePopAt(0.5, 0.5, 'MISS');
    uiSync();
    return;
  }

  S.hits++;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  // RT / perfect
  const rtMs = clamp(now() - t.born, 0, 9999);
  S.rtSumMs += rtMs;
  S.rtCount++;

  const inEnd = !!(S.stormActive && S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  let scoreAdd = 0;

  if (t.type === 'goodPlus'){
    S.waterPct = clamp(S.waterPct + TUNE.plusAmt, 0, 100);
    scoreAdd = TUNE.scoreGood;
    AudioFx.beep(980, 0.05, 0.045);
    scorePopAt(t.x, t.y, '+WATER');
    S.fever = clamp(S.fever + 3, 0, 100);
    removeTarget(t);
  }
  else if (t.type === 'goodMinus'){
    S.waterPct = clamp(S.waterPct - TUNE.minusAmt, 0, 100);
    scoreAdd = TUNE.scoreGood;
    AudioFx.beep(820, 0.05, 0.042);
    scorePopAt(t.x, t.y, '-WATER');
    S.fever = clamp(S.fever + 3, 0, 100);
    removeTarget(t);
  }
  else if (t.type === 'shield'){
    S.shield = clamp(S.shield + 1, 0, 6);
    scoreAdd = TUNE.scoreShield;
    AudioFx.beep(720, 0.06, 0.040);
    scorePopAt(t.x, t.y, 'SHIELD+1');
    removeTarget(t);
  }
  else if (t.type === 'star'){
    scoreAdd = TUNE.scoreStar;
    AudioFx.beep(1200, 0.05, 0.040);
    scorePopAt(t.x, t.y, 'BONUS');
    S.fever = clamp(S.fever + 10, 0, 100);
    removeTarget(t);
  }
  else if (t.type === 'diamond'){
    scoreAdd = TUNE.scoreDiamond;
    AudioFx.beep(1380, 0.05, 0.040);
    scorePopAt(t.x, t.y, 'FEVER+');
    S.fever = clamp(S.fever + 18, 0, 100);
    removeTarget(t);
  }
  else if (t.type === 'bad'){
    if (S.shield > 0){
      S.shield--;
      scoreAdd = TUNE.scoreBlock;
      AudioFx.beep(1050, 0.06, 0.045);
      scorePopAt(t.x, t.y, 'BLOCK!');
      removeTarget(t);
    } else {
      S.misses++;
      S.combo = 0;
      S.waterPct = clamp(S.waterPct - TUNE.badPenalty, 0, 100);
      AudioFx.beep(240, 0.06, 0.045);
      scorePopAt(t.x, t.y, 'BAD!');
      removeTarget(t);
    }
    S.fever = clamp(S.fever + 6, 0, 100);
  }
  else if (t.type === 'bossbad'){
    // BOSS ต้องบล็อกด้วย shield เท่านั้น
    if (S.shield > 0){
      S.shield--;
      bossOnBlock(t);
    } else {
      S.misses++;
      S.combo = 0;
      S.waterPct = clamp(S.waterPct - TUNE.bossPenalty, 0, 100);
      AudioFx.beep(200, 0.07, 0.05);
      scorePopAt(t.x, t.y, 'BOSS HIT!');
      // boss stays (reset streak)
      S.bossBlocks = 0;
      setPill('mini', `BOSS 0/${TUNE.bossBlockNeed}`);
      // keep boss alive
      t.born = now();
      t.life = Math.max(t.life, 1600);
    }
    S.fever = clamp(S.fever + 8, 0, 100);
  }

  // Perfect bonus if hit fast enough (exclude tap on already-expiring? still ok)
  if (!S.ended && rtMs <= TUNE.perfectWindowMs && (t.type !== 'bossbad')){
    onPerfect(rtMs, t);
  }

  // fever score bump
  const feverMul = (S.fever >= 90) ? 1.25 : (S.fever >= 70 ? 1.15 : 1.0);
  scoreAdd = Math.round(scoreAdd * feverMul);

  // combo multiplier (soft)
  if (S.combo >= 10) scoreAdd = Math.round(scoreAdd * 1.12);
  if (S.combo >= 20) scoreAdd = Math.round(scoreAdd * 1.22);

  S.score += scoreAdd;

  try{ Particles.burstAt(); }catch{}
  setWaterGauge(S.waterPct);
  uiSync();
}

// ---------- Storm / End-window / Pressure / Goal ----------
function goalTick(dt){
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

function stormTick(dt){
  if (S.stormActive){
    const prevLeft = S.stormLeftSec;
    S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

    // enter end-window edge
    const nowInEnd = (S.stormLeftSec <= TUNE.endWindowSec);
    if (!S.inEndWindow && nowInEnd){
      S.inEndWindow = true;
      ensureBossSpawn();
    }

    // ticking urgency
    if (nowInEnd) AudioFx.tick();

    if (S.stormLeftSec <= 0){
      // storm ends
      S.stormActive = false;
      S.nextStormInSec = TUNE.stormEverySec;

      // if boss not cleared in end-window => reset boss state
      S.inEndWindow = false;
      if (!S.bossCleared){
        S.bossBlocks = 0;
        S.bossId = 0;
        S.bossCleared = false;
      }
      DOC.body.classList.remove('endwindow');
      DOC.documentElement.style.setProperty('--endamp', '0');
      DOC.documentElement.style.setProperty('--endflash', '0');
    }
  } else {
    S.nextStormInSec = Math.max(0, S.nextStormInSec - dt);
    if (S.nextStormInSec <= 0){
      // start storm
      S.stormActive = true;
      S.stormLeftSec = TUNE.stormLenSec;
      S.inEndWindow = false;
      S.bossId = 0;
      S.bossBlocks = 0;
      S.bossCleared = false;
      S.miniCleared = 0;

      AudioFx.thunder(0.07);
    }
  }

  // pressure dynamics (still used)
  if (S.stormActive){
    const z = zoneFrom(S.waterPct);
    const k = (z === 'GREEN') ? -18 : 28;
    S.pressure = clamp(S.pressure + k*dt, 0, 100);

    const inEnd = (S.stormLeftSec <= TUNE.endWindowSec);
    if (inEnd){
      DOC.body.classList.add('endwindow');
      const k2 = clamp(1 - (S.stormLeftSec / TUNE.endWindowSec), 0, 1);
      DOC.documentElement.style.setProperty('--endamp', String(0.25 + 0.75*k2));
      DOC.documentElement.style.setProperty('--endflash', String(0.25*k2));
    } else {
      DOC.body.classList.remove('endwindow');
      DOC.documentElement.style.setProperty('--endamp', '0');
      DOC.documentElement.style.setProperty('--endflash', '0');
    }
  } else {
    S.pressure = clamp(S.pressure - 22*dt, 0, 100);
    DOC.body.classList.remove('endwindow');
    DOC.documentElement.style.setProperty('--endamp', '0');
    DOC.documentElement.style.setProperty('--endflash', '0');
  }
}

// ---------- Grade ----------
function gradeOf(){
  const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;
  const avgRt = (S.rtCount > 0) ? (S.rtSumMs / S.rtCount) : 9999;

  // RT: ยิ่งเร็ว ยิ่งได้ bonus
  const rtBonus = avgRt <= 380 ? 260 : (avgRt <= 520 ? 140 : 0);

  const base = S.score
    + (S.goalDone ? 800 : 0)
    + (S.miniCleared ? 650 : 0)
    + Math.round(acc * 400)
    + rtBonus
    + Math.min(220, S.perfectCount * 12);

  if (base >= 4600) return 'SSS';
  if (base >= 3700) return 'SS';
  if (base >= 2950) return 'S';
  if (base >= 2100) return 'A';
  if (base >= 1300) return 'B';
  return 'C';
}

// ---------- UI sync ----------
function uiSync(){
  setAllText('[data-stat="score"]', S.score|0);
  setAllText('[data-stat="combo"]', S.combo|0);
  setAllText('[data-stat="miss"]',  S.misses|0);
  setAllText('[data-stat="time"]',  Math.ceil(S.leftSec));
  setAllText('[data-stat="shield"]', S.shield|0);

  const press = Math.round(S.pressure) + '%';
  setAllText('[data-stat="press"]', press);

  const g = gradeOf();
  setAllText('[data-stat="grade"]', g);

  // pills
  const goalLeft = Math.max(0, Math.ceil(TUNE.greenNeedSec - S.greenSec));
  setPill('goal', S.goalDone ? '✅ DONE' : (goalLeft + 's GREEN'));

  if (!S.stormActive){
    setPill('storm', 'in ' + Math.ceil(S.nextStormInSec) + 's');
    setPill('mini', 'WAIT STORM');
  } else {
    setPill('storm', Math.ceil(S.stormLeftSec) + 's');
    if (S.inEndWindow){
      if (S.bossCleared) setPill('mini', '✅ BOSS DOWN');
      else setPill('mini', `BOSS ${S.bossBlocks}/${TUNE.bossBlockNeed}`);
    } else {
      setPill('mini', 'STORM…');
    }
  }

  // quest lines
  setQuest('goal', S.goalDone ? 'อยู่ใน GREEN ครบแล้ว!' : `อยู่ใน GREEN ให้ครบ ${TUNE.greenNeedSec|0}s`);
  setQuest('prog', `${Math.floor(S.greenSec)}/${TUNE.greenNeedSec}s GREEN`);

  if (!S.stormActive){
    setQuest('mini', 'รอพายุ (STORM) แล้วเตรียม Shield');
    setQuest('state', 'CALM');
  } else {
    if (!S.inEndWindow){
      setQuest('mini', 'สะสม Shield + คุมโซนน้ำ (อย่า GREEN ตลอด)');
      setQuest('state', 'STORM!');
    } else {
      setQuest('mini', `BOSS: บล็อก 🍟 ให้ครบ ${TUNE.bossBlockNeed} ครั้ง`);
      setQuest('state', S.bossCleared ? 'MINI CLEARED!' : 'END-WINDOW BOSS!');
    }
  }

  // perfect pill (data-stat perf)
  setAllText('[data-stat="perf"]', S.perfectCount|0);

  // events
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

  const hs = hostSet();
  const r = rectOf(hs.boundsL);
  if (!r) return;

  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;
  const tx = r.left + t.x * r.width;
  const ty = r.top  + t.y * r.height;
  const dist = Math.hypot(tx-cx, ty-cy);
  const rad = Math.max(18, t.s * TUNE.gazeRadiusMul);

  if (dist <= rad) S.gazeHoldMs += dt*1000;
  else S.gazeHoldMs = Math.max(0, S.gazeHoldMs - dt*1000*2.2);

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

  // goal/storm/boss/gaze
  goalTick(dt);
  stormTick(dt);
  gazeTick(dt);

  // adaptive eval (Feature #3)
  Adaptive.eval(t, S);

  // gauge
  setWaterGauge(S.waterPct);

  // spawn
  const baseInterval = S.stormActive ? TUNE.stormSpawnInterval : TUNE.spawnInterval;
  const interval = Math.max(220, Math.round(baseInterval / (Adaptive.enabled ? Adaptive.spawnMul : 1.0)));

  if ((t - S.lastSpawn) >= interval){
    S.lastSpawn = t;

    // if end-window and boss alive: spawn slightly less clutter
    if (S.inEndWindow && S.bossId && !S.bossCleared){
      if (rng() < 0.75) spawnTarget();
    } else {
      spawnTarget();
      if (S.stormActive && rng() < 0.35) spawnTarget();
    }
  }

  // keep boss guaranteed in end-window
  if (S.inEndWindow) ensureBossSpawn();

  cleanupDead();
  uiSync();

  if (S.leftSec <= 0) endGame('timeup');

  requestAnimationFrame(tick);
}

// ---------- End payload ----------
function buildEndPayload(reason='end'){
  const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;
  const grade = gradeOf();
  const avgRt = (S.rtCount > 0) ? (S.rtSumMs / S.rtCount) : 0;

  return {
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
    gameVersion: String(qs('gameVersion','20251228-hydration-boss-perfect-adapt')),
    diff: diff,
    durationPlannedSec: Number(qs('durationPlannedSec', TUNE.timeLimitSec)) || TUNE.timeLimitSec,
    durationPlayedSec: Math.round((S.endTime - S.startTime)/1000),

    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    goalsCleared: S.goalDone ? 1 : 0,
    goalsTotal: 1,
    miniCleared: S.miniCleared ? 1 : 0,
    miniTotal: 1,
    accuracyGoodPct: Math.round(acc*100),

    waterEndPct: Math.round(S.waterPct),
    greenSec: Math.round(S.greenSec),
    greenNeedSec: TUNE.greenNeedSec,

    perfectCount: S.perfectCount|0,
    avgRtGoodMs: Math.round(avgRt),

    bossBlocks: S.bossBlocks|0,
    bossCleared: !!S.bossCleared,

    adaptiveEnabled: Adaptive.enabled,
    adaptiveLevel: Adaptive.enabled ? Number(Adaptive.level.toFixed(3)) : 0,

    grade,
    device: (navigator.userAgent || ''),
    reason,

    startTimeIso: new Date(Date.now() - Math.round((TUNE.timeLimitSec - S.leftSec)*1000)).toISOString(),
    endTimeIso: new Date().toISOString(),

    studentKey: String(qs('studentKey','')),
    studentNo: String(qs('studentNo','')),
    age: String(qs('age','')),
    gradeLevel: String(qs('gradeLevel','')),
  };
}

function endGame(reason='end'){
  if (S.ended) return;
  S.ended = true;
  S.endTime = now();

  const payload = buildEndPayload(reason);

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    localStorage.setItem('hha_last_summary', JSON.stringify(payload));
  }catch{}

  dispatch('hha:end', payload);
  dispatch('hvr:endui', payload);
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

  // initialize adaptive baseline by diff (optional)
  if (Adaptive.enabled){
    Adaptive.level = (diff === 'easy') ? 0.12 : (diff === 'hard' ? 0.28 : 0.20);
    Adaptive.apply();
  }

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

// tap anywhere to shoot (pad)
(function bindShootPads(){
  const mono = DOC.getElementById('playfield');
  if (mono){
    mono.addEventListener('pointerdown', (ev)=>{
      if (ev.target && String(ev.target.className||'').includes('tgt')) return;
      shoot({ reason:'pad' });
    }, { passive:true });
  }
  const l = DOC.getElementById('cbPlayL');
  const r = DOC.getElementById('cbPlayR');
  if (l) l.addEventListener('pointerdown', (ev)=>{ if(String(ev.target.className||'').includes('tgt')) return; shoot({ reason:'pad' }); }, { passive:true });
  if (r) r.addEventListener('pointerdown', (ev)=>{ if(String(ev.target.className||'').includes('tgt')) return; shoot({ reason:'pad' }); }, { passive:true });
})();

// autostart=1
if (qs('autostart','0') === '1'){
  DOC.body.classList.remove('cardboard');
  start('mono');
}
