// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION v3 (STORM patterns + Decoy + Boss 2-Stage + Siren/Tick + Perfect chain)
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:storm, hha:end
// ✅ Research: run=research => adaptive OFF + deterministic seed + deterministic storm schedule
// ✅ Cardboard spawn: targets into #hvr-layerL/#hvr-layerR

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ------------------ helpers ------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return performance.now(); }
function qs(name, def){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

// seeded RNG (deterministic)
function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

// ------------------ config from URL ------------------
const diff = String(qs('diff','normal')).toLowerCase();               // easy/normal/hard
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();   // play/research
const timeLimit = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 600);

const hub = String(qs('hub','./hub.html'));
const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const rng = makeRng(seed);

const logEndpoint = String(qs('log','') || '');
const soundOn = String(qs('sound','1')) !== '0'; // ?sound=0 ปิดได้

// ------------------ DOM bind ------------------
const playfield = DOC.getElementById('playfield');
const layerMain = DOC.getElementById('hvr-layer');
const layerL = DOC.getElementById('hvr-layerL');
const layerR = DOC.getElementById('hvr-layerR');

function isCardboard(){
  try{ return DOC.body && DOC.body.classList.contains('cardboard'); }catch{ return false; }
}
function activeLayers(){
  if (isCardboard() && layerL && layerR) return [layerL, layerR];
  return [layerMain].filter(Boolean);
}
function activePlayfield(){
  return playfield || (DOC.getElementById('cbPlayfieldL') || null);
}
function fxLayer(){
  return (layerMain || layerL || layerR);
}

// HUD nodes
const elScore = DOC.getElementById('stat-score');
const elCombo = DOC.getElementById('stat-combo');
const elMiss = DOC.getElementById('stat-miss');
const elTime = DOC.getElementById('stat-time');
const elGrade = DOC.getElementById('stat-grade');

const elQuest1 = DOC.getElementById('quest-line1');
const elQuest2 = DOC.getElementById('quest-line2');
const elQuest3 = DOC.getElementById('quest-line3');
const elQuest4 = DOC.getElementById('quest-line4');

const elStormLeft = DOC.getElementById('storm-left');
const elShieldCount = DOC.getElementById('shield-count');

function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

// ------------------ STYLE (targets + decoy + boss) ------------------
(function injectStyle(){
  const id = 'hvr-target-style';
  if (DOC.getElementById(id)) return;
  const st = DOC.createElement('style');
  st.id = id;
  st.textContent = `
  .hvr-target{
    position:absolute;
    left: var(--x, 50%);
    top: var(--y, 50%);
    transform: translate(-50%,-50%);
    width: var(--s, 64px);
    height: var(--s, 64px);
    display:flex;
    align-items:center;
    justify-content:center;
    font-size: calc(var(--s,64px) * 0.55);
    border-radius: 999px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.50);
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    user-select:none;
    pointer-events:auto;
    cursor:pointer;
    will-change: transform, filter, opacity;
  }
  .hvr-target.good{ outline: 2px solid rgba(34,197,94,.18); }
  .hvr-target.bad { outline: 2px solid rgba(239,68,68,.18); }
  .hvr-target.shield{ outline: 2px solid rgba(34,211,238,.18); }

  /* decoy looks "almost good" but slightly suspicious */
  .hvr-target.decoy{
    outline: 2px solid rgba(56,189,248,.14);
    filter: saturate(1.05) contrast(1.03);
    box-shadow: 0 18px 60px rgba(0,0,0,.45), 0 0 18px rgba(56,189,248,.08);
    animation: decoyWobble .72s ease-in-out infinite;
  }
  @keyframes decoyWobble{
    0%{ transform: translate(-50%,-50%) rotate(-1.2deg); }
    50%{ transform: translate(-50%,-50%) rotate(1.2deg); }
    100%{ transform: translate(-50%,-50%) rotate(-1.2deg); }
  }

  .hvr-target.bossbad{
    outline: 2px dashed rgba(239,68,68,.55);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 28px rgba(239,68,68,.16);
    filter: saturate(1.30) contrast(1.12);
    animation: bossPulse .34s linear infinite;
  }
  @keyframes bossPulse{
    0%{ transform: translate(-50%,-50%) scale(1.00); }
    50%{ transform: translate(-50%,-50%) scale(1.08); }
    100%{ transform: translate(-50%,-50%) scale(1.00); }
  }

  .hvr-pop{
    position:absolute;
    left:50%; top:50%;
    transform: translate(-50%,-50%);
    font-weight:1100;
    text-shadow: 0 10px 26px rgba(0,0,0,.55);
    pointer-events:none;
    animation: hvrPop .55s ease forwards;
  }
  @keyframes hvrPop{
    0%{ opacity:0; transform: translate(-50%,-50%) scale(.88); }
    15%{ opacity:1; }
    100%{ opacity:0; transform: translate(-50%,-70%) scale(1.06); }
  }`;
  DOC.head.appendChild(st);
})();

// ------------------ AUDIO (no file) ------------------
const AudioFX = (function(){
  let ctx = null;
  let master = null;

  // siren node
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;

  // tick limiter
  let lastTickAt = 0;

  function ensure(){
    if (!soundOn) return false;
    if (ctx) return true;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
      return true;
    }catch{
      return false;
    }
  }

  function unlockOnce(){
    if (!soundOn) return;
    if (!ensure()) return;
    try{
      if (ctx.state === 'suspended') ctx.resume();
    }catch{}
  }

  function beep(freq=880, dur=0.07, vol=0.16){
    if (!ensure()) return;
    try{
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    }catch{}
  }

  function tick(){
    const t = performance.now();
    if (t - lastTickAt < 90) return;
    lastTickAt = t;
    beep(1600, 0.03, 0.10);
  }

  function startSiren(type='normal'){
    if (!ensure()) return;
    if (sirenOn) return;
    try{
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'sawtooth';
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenOn = true;

      // pattern by type
      const base = (type === 'fast') ? 820 :
                   (type === 'boss-heavy') ? 760 :
                   (type === 'long') ? 680 : 720;
      const span = (type === 'fast') ? 520 :
                   (type === 'boss-heavy') ? 620 :
                   (type === 'long') ? 440 : 480;

      let phase = 0;
      const step = () => {
        if (!sirenOn || !ctx) return;
        phase += 1;
        const p = (phase % 80) / 80;
        const f = base + Math.sin(p * Math.PI * 2) * span;
        try{ sirenOsc.frequency.setValueAtTime(f, ctx.currentTime); }catch{}
        try{ sirenGain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.03); }catch{}
        setTimeout(step, 60);
      };
      step();
    }catch{}
  }

  function stopSiren(){
    if (!ctx || !sirenOn) return;
    try{
      sirenOn = false;
      if (sirenGain) sirenGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.05);
      setTimeout(()=>{
        try{ sirenOsc && sirenOsc.stop(); }catch{}
        try{ sirenOsc && sirenOsc.disconnect(); }catch{}
        try{ sirenGain && sirenGain.disconnect(); }catch{}
        sirenOsc = null; sirenGain = null;
      }, 180);
    }catch{}
  }

  return { unlockOnce, beep, tick, startSiren, stopSiren };
})();

// auto unlock on first user intent
(function bindAudioUnlock(){
  const fn = ()=>{ try{ AudioFX.unlockOnce(); }catch{} };
  window.addEventListener('pointerdown', fn, { once:true, passive:true });
  window.addEventListener('touchstart', fn, { once:true, passive:true });
  window.addEventListener('keydown', fn, { once:true, passive:true });
})();

// ------------------ STATE ------------------
const S = {
  started:false,
  ended:false,

  t0:0,
  lastTick:0,
  leftSec: timeLimit,

  score:0,
  combo:0,
  comboMax:0,
  misses:0,

  nGoodSpawn:0,
  nBadSpawn:0,
  nShieldSpawn:0,
  nDecoySpawn:0,

  nHitGood:0,
  nHitBad:0,
  nHitBadGuard:0,
  nHitDecoy:0,
  nExpireGood:0,

  streakGood:0,
  streakMax:0,

  waterPct: 50,
  waterZone: 'GREEN',

  shield: 0,
  shieldMax: 3,

  greenHold: 0,
  greenTarget: 0,

  stormActive:false,
  stormLeftSec:0,
  stormCycle: 0,

  stormPatternName: 'normal',
  stormSpawnMul: 1.0,
  endWindowSec: 1.2,
  inEndWindow:false,

  // mini (storm timing)
  miniCleared:0,
  miniPlanned: 0,
  miniState: {
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  },

  // BOSS 2-STAGE (NEW)
  bossActive:false,
  bossNeedBlock: 2,
  bossBlocked: 0,

  bossStage: 0,          // 0 none, 1 block stage, 2 accuracy stage, 3 cleared
  bossStage2NeedGood: 3, // must hit good during stage2
  bossStage2Good: 0,
  bossStage2Bad: 0,
  bossWindowSec: 2.2,
  bossDoneThisStorm:false,

  // PERFECT chain (end-window)
  perfectChain: 0,
  perfectMax: 0,
  perfectShieldGranted: 0,
  perfectWindowArmed:false,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0
};

// ------------------ TUNING ------------------
const TUNE = (() => {
  const sizeBase =
    diff === 'easy' ? 78 :
    diff === 'hard' ? 56 : 66;

  const spawnBase =
    diff === 'easy' ? 680 :
    diff === 'hard' ? 480 : 580;

  const stormEvery =
    diff === 'easy' ? 18 :
    diff === 'hard' ? 14 : 16;

  const stormDur =
    diff === 'easy' ? 5.2 :
    diff === 'hard' ? 6.2 : 5.8;

  const g = clamp(
    Math.round(timeLimit * (diff==='easy' ? 0.42 : diff==='hard' ? 0.55 : 0.48)),
    18,
    Math.max(18, timeLimit-8)
  );

  return {
    sizeBase,
    spawnBaseMs: spawnBase,
    spawnJitter: 170,

    goodLifeMs: diff==='hard' ? 930 : 1080,
    badLifeMs:  diff==='hard' ? 980 : 1120,
    shieldLifeMs: 1350,
    decoyLifeMs: diff==='hard' ? 980 : 1080,

    stormEverySec: stormEvery,
    stormDurSec: stormDur,

    endWindowSecBase: 1.2,
    stormSpawnMulBase: diff==='hard' ? 0.56 : 0.64,

    nudgeToMid: 5.0,
    badPush:    8.0,
    missPenalty: 1,

    greenTargetSec: g,

    bossWindowSec: diff==='hard' ? 2.55 : 2.25
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSecBase;
S.bossWindowSec = TUNE.bossWindowSec;

// expose for debug
ROOT.__HVR__ = ROOT.__HVR__ || {};
ROOT.__HVR__.S = S;
ROOT.__HVR__.TUNE = TUNE;

// ------------------ computed ------------------
function computeAccuracy(){
  const denom = Math.max(1, S.nGoodSpawn);
  return clamp((S.nHitGood / denom) * 100, 0, 100);
}
function computeGrade(){
  const acc = computeAccuracy();
  const miss = S.misses|0;
  const mini = S.miniCleared|0;

  if (acc >= 95 && miss <= 2 && mini >= 2) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}

// ------------------ water dynamics ------------------
function updateZone(){
  S.waterZone = zoneFrom(S.waterPct);
}
function nudgeWaterGood(){
  const mid = 55;
  const d = mid - S.waterPct;
  const step = Math.sign(d) * Math.min(Math.abs(d), TUNE.nudgeToMid);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}
function pushWaterBad(strengthMul=1){
  const mid = 55;
  const d = S.waterPct - mid;
  const step = (d >= 0 ? +1 : -1) * (TUNE.badPush * strengthMul);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// ------------------ spawn math ------------------
function pickXY(){
  const pf = activePlayfield();
  const r = pf ? pf.getBoundingClientRect() : { width: 1, height: 1, left:0, top:0 };

  const pad = 22;
  const w = Math.max(1, r.width - pad*2);
  const h = Math.max(1, r.height - pad*2);

  const rx = (rng()+rng())/2;
  const ry = (rng()+rng())/2;

  const x = pad + rx * w;
  const y = pad + ry * h;

  const xPct = (x / Math.max(1, r.width)) * 100;
  const yPct = (y / Math.max(1, r.height)) * 100;

  return { xPct, yPct };
}

function targetSize(){
  let s = TUNE.sizeBase;

  if (S.adaptiveOn){
    const acc = computeAccuracy()/100;
    const c = clamp(S.combo/20, 0, 1);
    const k = clamp((acc*0.7 + c*0.3), 0, 1);
    S.adaptK = k;
    s = s * (1.02 - 0.22*k);
  }

  if (S.stormActive) s *= (diff==='hard' ? 0.78 : 0.82);
  return clamp(s, 44, 86);
}

// ------------------ FX pop ------------------
function makePop(text, kind){
  const L = fxLayer();
  if (!L) return;
  try{
    const p = DOC.createElement('div');
    p.className = 'hvr-pop';
    p.textContent = text;
    p.style.left = '50%';
    p.style.top = '46%';
    p.style.color =
      kind === 'good' ? 'rgba(34,197,94,.95)' :
      kind === 'shield' ? 'rgba(34,211,238,.95)' :
      kind === 'boss' ? 'rgba(239,68,68,.95)' :
      kind === 'decoy' ? 'rgba(56,189,248,.95)' :
      'rgba(239,68,68,.95)';
    L.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

// ------------------ anti-spam ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ STORM PATTERNS ------------------
function chooseStormPattern(cycleIndex){
  const rr = makeRng(seed + '|storm|' + cycleIndex);
  const r = rr();

  let name = 'normal';
  let spawnMul = TUNE.stormSpawnMulBase;
  let dur = TUNE.stormDurSec;
  let endWin = TUNE.endWindowSecBase;
  let bossWin = S.bossWindowSec;

  let bossNeedBlock = (diff === 'hard') ? 3 : 2;
  let stage2NeedGood = (diff === 'hard') ? 4 : 3;
  let decoyRate = (diff === 'hard') ? 0.09 : 0.07;

  if (r < 0.22){
    name = 'fast';
    dur *= 0.86;
    spawnMul *= 0.84;
    endWin = Math.max(1.0, endWin * 0.92);
    bossWin *= 0.92;
    bossNeedBlock = (diff === 'hard') ? 3 : 2;
    stage2NeedGood = (diff === 'hard') ? 4 : 3;
    decoyRate += 0.02;
  }
  else if (r < 0.48){
    name = 'long';
    dur *= 1.16;
    spawnMul *= 0.74;
    endWin = Math.min(1.45, endWin * 1.10);
    bossWin *= 1.10;
    bossNeedBlock = (diff === 'hard') ? 4 : 3;
    stage2NeedGood = (diff === 'hard') ? 5 : 4;
    decoyRate += 0.015;
  }
  else if (r < 0.76){
    name = 'boss-heavy';
    dur *= 1.02;
    spawnMul *= 0.78;
    endWin = Math.min(1.55, endWin * 1.12);
    bossWin *= 1.18;
    bossNeedBlock = (diff === 'hard') ? 4 : 3;
    stage2NeedGood = (diff === 'hard') ? 5 : 4;
    decoyRate += 0.03;
  }
  else {
    name = 'breath';
    dur *= 0.98;
    spawnMul *= 0.92;
    endWin = Math.max(1.1, endWin);
    bossWin *= 1.00;
    bossNeedBlock = (diff === 'hard') ? 3 : 2;
    stage2NeedGood = (diff === 'hard') ? 4 : 3;
    decoyRate = Math.max(0.05, decoyRate - 0.015);
  }

  dur = clamp(dur, 4.2, 7.8);
  spawnMul = clamp(spawnMul, 0.44, 0.95);
  endWin = clamp(endWin, 1.0, 1.6);
  bossWin = clamp(bossWin, 1.7, 3.2);

  bossNeedBlock = clamp(bossNeedBlock, 2, 5) | 0;
  stage2NeedGood = clamp(stage2NeedGood, 2, 7) | 0;
  decoyRate = clamp(decoyRate, 0.04, 0.14);

  return { name, dur, spawnMul, endWin, bossWin, bossNeedBlock, stage2NeedGood, decoyRate };
}

// ------------------ PERFECT chain ------------------
function resetPerfect(){
  S.perfectChain = 0;
  S.perfectWindowArmed = false;
  S.perfectShieldGranted = 0;
}
function bumpPerfect(){
  S.perfectChain++;
  S.perfectMax = Math.max(S.perfectMax, S.perfectChain);

  const bonus = 6 + Math.min(22, S.perfectChain * 4);
  S.score += bonus;
  S.combo += 1;
  S.comboMax = Math.max(S.comboMax, S.combo);

  if (S.perfectChain === 2) makePop('PERFECT x2!', 'shield');
  else if (S.perfectChain === 3) makePop('PERFECT x3!', 'shield');
  else if (S.perfectChain >= 4) makePop('PERFECT 🔥', 'shield');

  // shield drip (แฟร์)
  if (S.shield < S.shieldMax){
    const want = (S.perfectChain >= 3 && S.perfectShieldGranted === 0) ||
                 (S.perfectChain >= 5 && S.perfectShieldGranted === 1);
    if (want){
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      S.perfectShieldGranted++;
      makePop('+SHIELD (PERF)', 'shield');
    }
  }

  emit('hha:judge', { kind:'perfect' });
}

// ------------------ lifecycle spawn ------------------
function spawn(kind){
  if (S.ended) return;

  const layers = activeLayers();
  if (!layers.length) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossBad = (kind === 'bad' && S.bossActive && S.bossStage === 1);
  const isDecoy = (kind === 'decoy');

  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;
  if (kind === 'decoy') S.nDecoySpawn++;

  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    kind === 'decoy' ? TUNE.decoyLifeMs :
    TUNE.badLifeMs;

  let killed = false;
  const nodes = [];

  function buildNode(){
    const el = DOC.createElement('div');
    el.className = 'hvr-target ' + kind + (isBossBad ? ' bossbad' : '');
    el.dataset.kind = kind;
    if (isBossBad) el.dataset.boss = '1';
    if (isDecoy) el.dataset.decoy = '1';

    el.style.setProperty('--x', xPct.toFixed(2) + '%');
    el.style.setProperty('--y', yPct.toFixed(2) + '%');
    el.style.setProperty('--s', s.toFixed(0) + 'px');

    // decoy: looks close to good (but different)
    el.textContent =
      kind === 'good' ? '💧' :
      kind === 'shield' ? '🛡️' :
      kind === 'decoy' ? '💧' :        // mimic good
      (isBossBad ? '🌩️' : '🥤');

    // subtle hint: decoy uses slight opacity on emoji via CSS filter? keep simple
    if (isDecoy){
      el.style.opacity = '0.96';
    }

    return el;
  }

  function kill(reason){
    if (killed) return;
    killed = true;
    for (const n of nodes){
      try{ n.remove(); }catch{}
    }

    if (reason === 'expire'){
      if (kind === 'good') {
        S.misses += TUNE.missPenalty;
        S.nExpireGood++;
        S.combo = 0;
        S.streakGood = 0;
        if (S.stormActive && S.inEndWindow) resetPerfect();
      }
    }
  }

  function onHit(){
    if (killed || S.ended) return;

    const t = performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt = t;

    kill('hit');

    // ---- GOOD
    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      // Boss Stage2: count good hits
      if (S.bossActive && S.bossStage === 2){
        S.bossStage2Good++;
        if (S.bossStage2Good >= S.bossStage2NeedGood && S.bossStage2Bad === 0){
          // clear boss
          S.bossStage = 3;
          S.bossDoneThisStorm = true;
          S.miniCleared++;
          S.score += 55;
          makePop('BOSS STAGE2 ✓', 'boss');
          AudioFX.beep(1080, 0.08, 0.18);
          emit('hha:judge', { kind:'boss-pass' });
        }
      }

      makePop('+GOOD', 'good');
      emit('hha:judge', { kind:'good' });
    }

    // ---- SHIELD
    else if (kind === 'shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
      AudioFX.beep(920, 0.05, 0.12);
      emit('hha:judge', { kind:'shield' });
    }

    // ---- DECOY (NEW): looks like good but punish
    else if (kind === 'decoy'){
      S.nHitDecoy++;
      // punish similar to BAD hit (but slightly fairer)
      const endPenalty = (S.stormActive && S.inEndWindow) ? 2 : 1;
      S.misses += endPenalty;
      S.combo = 0;
      S.score = Math.max(0, S.score - (S.stormActive && S.inEndWindow ? 9 : 5));
      pushWaterBad(S.stormActive && S.inEndWindow ? 1.18 : 1.0);
      if (S.stormActive && S.inEndWindow) resetPerfect();

      // Boss Stage2: decoy counts as bad (fail stage2)
      if (S.bossActive && S.bossStage === 2){
        S.bossStage2Bad++;
      }

      makePop('DECOY!', 'decoy');
      AudioFX.beep(260, 0.09, 0.18);
      emit('hha:judge', { kind:'decoy' });
    }

    // ---- BAD
    else {
      S.streakGood = 0;

      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;

        // stage1 boss block count only when bossStage=1
        if (isBossBad){
          S.bossBlocked++;
          makePop('BOSS BLOCK!', 'boss');
          AudioFX.beep(780, 0.05, 0.13);
          emit('hha:judge', { kind:'bossblock' });

          // stage1 cleared => stage2 begins (accuracy)
          if (S.bossBlocked >= S.bossNeedBlock && S.bossStage === 1){
            S.bossStage = 2;
            S.bossStage2Good = 0;
            S.bossStage2Bad = 0;
            makePop('STAGE2: HIT 💧!', 'shield');
            AudioFX.beep(1200, 0.06, 0.16);
            emit('hha:judge', { kind:'boss-stage2' });
          }
        } else {
          makePop('BLOCK!', 'shield');
          AudioFX.beep(740, 0.04, 0.10);
          emit('hha:judge', { kind:'block' });
        }

        // end-window perfect
        if (S.stormActive && S.inEndWindow){
          if (!S.perfectWindowArmed) S.perfectWindowArmed = true;

          if (S.waterZone !== 'GREEN') bumpPerfect();
          else resetPerfect();

          if (!S.miniState.doneThisStorm){
            S.miniState.blockedInEnd = true;
          }
        } else {
          resetPerfect();
        }
      } else {
        // hit bad unguarded
        S.nHitBad++;
        const endPenalty = (S.stormActive && S.inEndWindow) ? 2 : 1;
        S.misses += endPenalty;
        S.combo = 0;
        S.score = Math.max(0, S.score - (S.stormActive && S.inEndWindow ? 10 : 6));
        pushWaterBad(S.stormActive && S.inEndWindow ? 1.25 : 1.0);
        if (S.stormActive && S.inEndWindow) resetPerfect();

        // Boss stage2: any unguarded bad fails stage2
        if (S.bossActive && S.bossStage === 2){
          S.bossStage2Bad++;
        }

        makePop((S.stormActive && S.inEndWindow) ? 'BAD!!' : 'BAD!', 'bad');
        AudioFX.beep(240, 0.10, 0.20);
        emit('hha:judge', { kind:'bad' });
      }
    }

    syncHUD();
  }

  for (const L of layers){
    const el = buildNode();
    el.addEventListener('pointerdown', (ev)=>{
      try{
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.pointerType === 'touch' && ev.isPrimary === false) return;
      }catch{}
      onHit();
    }, { passive:false });
    nodes.push(el);
    L.appendChild(el);
  }

  setTimeout(()=>kill('expire'), life);
  return nodes[0];
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;

// deterministic storm schedule
let nextStormAt = 0;
let stormIndex = 0;

// pattern runtime values
let PAT = {
  decoyRate: 0.07
};

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;
  if (S.adaptiveOn){
    base *= (1.00 - 0.25 * S.adaptK);
  }
  if (S.stormActive){
    base *= (S.stormSpawnMul);
  }
  return clamp(base, 210, 1200);
}

function pickKind(){
  // base mix
  let pGood = 0.66;
  let pBad  = 0.28;
  let pSh   = 0.06;
  let pDec  = 0.00;

  if (S.stormActive){
    pGood = 0.52;
    pBad  = 0.36;
    pSh   = 0.10;
    pDec  = PAT.decoyRate;

    if (S.stormPatternName === 'boss-heavy'){
      pBad += 0.06; pGood -= 0.06;
      pDec += 0.02;
    }

    if (S.inEndWindow){
      // end-window: more shield, slightly more decoy (ใจสั่น)
      pSh += 0.04; pGood -= 0.03; pBad -= 0.01;
      pDec += 0.01;
    }

    // Boss stage2: increase good a bit so it is doable (but decoy stays)
    if (S.bossActive && S.bossStage === 2){
      pGood += 0.06;
      pBad  -= 0.03;
      pSh   -= 0.02;
      pDec  -= 0.01;
    }
  }

  if (diff === 'hard'){
    pBad += 0.04;
    pGood -= 0.04;
  }

  pGood = Math.max(0.28, pGood);
  pBad  = Math.max(0.16, pBad);
  pSh   = Math.max(0.04, pSh);
  pDec  = Math.max(0.00, pDec);

  const sum = pGood + pBad + pSh + pDec;
  pGood/=sum; pBad/=sum; pSh/=sum; pDec/=sum;

  const r = rng();
  if (r < pSh) return 'shield';
  if (r < pSh + pDec) return 'decoy';
  if (r < pSh + pDec + pBad) return 'bad';
  return 'good';
}

// ------------------ storm + mini + boss logic ------------------
function enterStorm(){
  S.stormActive = true;

  const P = chooseStormPattern(S.stormCycle + 1);
  S.stormPatternName = P.name;
  S.stormLeftSec = P.dur;
  S.stormSpawnMul = P.spawnMul;
  S.endWindowSec = P.endWin;
  S.bossWindowSec = P.bossWin;

  // boss 2-stage params
  S.bossNeedBlock = P.bossNeedBlock;
  S.bossStage2NeedGood = P.stage2NeedGood;

  PAT.decoyRate = P.decoyRate;

  S.stormCycle++;

  S.miniState = {
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  };

  // reset boss
  S.bossActive = false;
  S.bossStage = 0;
  S.bossBlocked = 0;
  S.bossStage2Good = 0;
  S.bossStage2Bad = 0;
  S.bossDoneThisStorm = false;

  resetPerfect();

  // force water off-green a bit
  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  // siren start
  AudioFX.startSiren(S.stormPatternName);

  emit('hha:storm', {
    state:'enter',
    pattern: S.stormPatternName,
    bossNeedBlock: S.bossNeedBlock,
    bossStage2NeedGood: S.bossStage2NeedGood,
    decoyRate: PAT.decoyRate
  });
  emit('hha:judge', { kind:'storm-in' });

  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // stop siren
  AudioFX.stopSiren();

  // evaluate storm mini
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
      m.doneThisStorm = true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
      AudioFX.beep(1040, 0.07, 0.14);
      emit('hha:judge', { kind:'mini-pass' });
    }
  }

  // boss resolved: must clear both stages to count
  if (!S.bossDoneThisStorm && S.bossStage === 3){
    // already counted on clear
  } else if (S.bossStage > 0 && !S.bossDoneThisStorm){
    // fail feedback
    if (S.bossStage === 2){
      makePop('BOSS FAIL', 'boss');
      AudioFX.beep(220, 0.12, 0.20);
    }
  }

  S.bossActive = false;
  S.bossStage = 0;

  resetPerfect();
  syncHUD();
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (S.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  // tick sound in end-window (clock pressure)
  if (inEnd) AudioFX.tick();

  // boss window: last bossWindowSec
  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  if (inBoss && !S.bossDoneThisStorm){
    S.bossActive = true;

    // stage flow:
    // stage1 starts when boss window opens
    if (S.bossStage === 0) {
      S.bossStage = 1;
      S.bossBlocked = 0;
      S.bossStage2Good = 0;
      S.bossStage2Bad = 0;
      makePop('BOSS! STAGE1', 'boss');
      AudioFX.beep(920, 0.07, 0.16);
      emit('hha:judge', { kind:'boss-start' });
    }
  } else {
    S.bossActive = false;
  }

  // mini: zone must be non-green at least once
  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  // pressure accumulates faster when in end window
  const pGain = zoneOK ? (inEnd ? 0.72 : 0.50) : (inEnd ? 0.32 : 0.24);
  S.miniState.pressure = clamp(S.miniState.pressure + dt * pGain, 0, 1);
  if (S.miniState.pressure >= 1) S.miniState.pressureOK = true;

  if (!inEnd){
    resetPerfect();
  }

  if (S.stormLeftSec <= 0.001){
    exitStorm();
  }
}

// ------------------ HUD sync ------------------
function syncHUD(){
  const grade = computeGrade();
  const acc = computeAccuracy();

  setText(elScore, S.score|0);
  setText(elCombo, S.combo|0);
  setText(elMiss, S.misses|0);
  setText(elTime, S.leftSec|0);
  setText(elGrade, grade);

  setText(elShieldCount, S.shield|0);
  setText(elStormLeft, S.stormActive ? (S.stormLeftSec|0) : 0);

  setText(elQuest1, `คุม GREEN ให้ครบ ${S.greenTarget|0}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`);

  if (S.stormActive){
    let bossTxt = '';
    if (S.bossActive && S.bossStage === 1) bossTxt = ` • BOSS S1 BLOCK ${S.bossBlocked}/${S.bossNeedBlock}`;
    if (S.bossActive && S.bossStage === 2) bossTxt = ` • BOSS S2 HIT 💧 ${S.bossStage2Good}/${S.bossStage2NeedGood}`;
    if (S.bossStage === 3) bossTxt = ` • BOSS ✓`;

    const perfTxt = (S.inEndWindow && S.perfectWindowArmed) ? ` • PERFECT x${S.perfectChain}` : '';
    setText(elQuest3, `Storm (${S.stormPatternName})${bossTxt}${perfTxt}`);
  } else {
    setText(elQuest3, `รอ Storm แล้วค่อยทำ Mini`);
  }

  const m = S.miniState;
  setText(
    elQuest4,
    S.stormActive
      ? `Mini: zone=${m.zoneOK?'OK':'NO'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
      : `State: เก็บคะแนน + สะสม Shield`
  );

  setWaterGauge(S.waterPct);

  emit('hha:score', {
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    accuracyGoodPct: acc,
    grade,
    waterPct: S.waterPct,
    waterZone: S.waterZone,
    shield: S.shield|0,
    stormActive: !!S.stormActive,
    stormLeftSec: S.stormLeftSec,
    stormPattern: S.stormPatternName,
    stormInEndWindow: !!S.inEndWindow,

    // mini flags
    miniZoneOK: !!m.zoneOK,
    miniPressureOK: !!m.pressureOK,
    miniEndWindow: !!m.endWindow,
    miniBlockedInEnd: !!m.blockedInEnd,

    // boss
    bossActive: !!S.bossActive,
    bossStage: S.bossStage|0,
    bossBlocked: S.bossBlocked|0,
    bossNeedBlock: S.bossNeedBlock|0,
    bossStage2Good: S.bossStage2Good|0,
    bossStage2NeedGood: S.bossStage2NeedGood|0,

    // decoy/perfect
    decoyRate: PAT.decoyRate,
    nDecoySpawn: S.nDecoySpawn|0,
    nHitDecoy: S.nHitDecoy|0,
    perfectChain: S.perfectChain|0,
    perfectMax: S.perfectMax|0,

    driftX: 0, driftY: 0, driftRot: 0
  });

  emit('hha:time', { left: S.leftSec|0 });

  // quest:update (HUD binder ใช้ได้)
  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: 'Storm Shield Timing + Boss 2-Stage',
    miniLeftSec: S.stormActive ? S.stormLeftSec : 0,
    miniUrgent: S.stormActive && S.inEndWindow,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniPlanned|0
  });
}

// ------------------ end logging ------------------
async function sendLog(payload){
  if (!logEndpoint) return;
  try{
    await fetch(logEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  }catch(e){
    try{
      const u = new URL(logEndpoint, location.href);
      u.searchParams.set('projectTag', String(payload.projectTag||'HeroHealth'));
      u.searchParams.set('gameMode', 'hydration');
      u.searchParams.set('sessionId', String(payload.sessionId||''));
      u.searchParams.set('scoreFinal', String(payload.scoreFinal||0));
      u.searchParams.set('grade', String(payload.grade||'C'));
      await fetch(u.toString(), { method:'GET', keepalive:true });
    }catch{}
  }
}

// ------------------ main loop ------------------
function update(dt){
  if (!S.started || S.ended) return;

  S.leftSec = Math.max(0, S.leftSec - dt);

  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  const elapsed = (now() - S.t0) / 1000;

  // deterministic storm schedule
  if (!S.stormActive){
    if (elapsed >= nextStormAt && S.leftSec > (TUNE.stormDurSec + 2)){
      enterStorm();
      stormIndex++;
      nextStormAt = (stormIndex + 1) * TUNE.stormEverySec;
    }
  } else {
    tickStorm(dt);
  }

  spawnTimer -= dt * 1000;
  while (spawnTimer <= 0){
    spawn(pickKind());
    spawnTimer += nextSpawnDelay();
  }

  syncHUD();

  if (S.leftSec <= 0.0001){
    endGame('timeup');
  }
}

async function endGame(reason){
  if (S.ended) return;
  S.ended = true;

  // stop siren
  try{ AudioFX.stopSiren(); }catch{}

  const grade = computeGrade();
  const acc = computeAccuracy();

  // planned minis: 1 storm-mini + 1 boss-mini per storm
  S.miniPlanned = Math.max(0, (S.stormCycle|0) * 2);

  const summary = {
    timestampIso: qs('timestampIso', new Date().toISOString()),
    projectTag: qs('projectTag', 'HeroHealth'),
    runMode: run,
    sessionId: sessionId || '',
    gameMode: 'hydration',
    diff,
    durationPlannedSec: timeLimit,
    durationPlayedSec: timeLimit,

    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,

    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniCleared: S.miniCleared|0,
    miniTotal: S.miniPlanned|0,

    nTargetGoodSpawned: S.nGoodSpawn|0,
    nTargetJunkSpawned: S.nBadSpawn|0,
    nTargetShieldSpawned: S.nShieldSpawn|0,
    nTargetDecoySpawned: S.nDecoySpawn|0,

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitBad|0,
    nHitJunkGuard: S.nHitBadGuard|0,
    nHitDecoy: S.nHitDecoy|0,
    nExpireGood: S.nExpireGood|0,

    accuracyGoodPct: acc,
    grade,
    streakMax: S.streakMax|0,
    timeInGreenSec: Number(S.greenHold||0),

    stormCycles: S.stormCycle|0,
    stormPatternLast: S.stormPatternName,
    perfectMax: S.perfectMax|0,

    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  emit('hha:end', summary);
  await sendLog(summary);
}

// ------------------ start gate ------------------
async function waitStartGate(){
  const ov = DOC.getElementById('start-overlay') || DOC.getElementById('startOverlay');
  if (!ov) return;

  const isHidden = () => {
    const cs = getComputedStyle(ov);
    return (cs.display === 'none' || cs.visibility === 'hidden' || ov.hidden);
  };
  if (isHidden()) return;

  await new Promise((resolve)=>{
    const mo = new MutationObserver(()=>{
      if (!ov.isConnected || isHidden()){
        try{ mo.disconnect(); }catch{}
        resolve();
      }
    });
    mo.observe(ov, { attributes:true, attributeFilter:['style','class','hidden'] });
    setTimeout(()=>{
      try{ mo.disconnect(); }catch{}
      resolve();
    }, 25000);
  });
}

// ------------------ init ------------------
async function boot(){
  const pf = activePlayfield();
  if (!pf || !activeLayers().length){
    console.warn('[Hydration] missing playfield or layers', {
      playfield: !!playfield,
      layerMain: !!layerMain,
      layerL: !!layerL,
      layerR: !!layerR
    });
    return;
  }

  ensureWaterGauge();
  setWaterGauge(S.waterPct);
  updateZone();

  spawnTimer = 320;

  await waitStartGate();

  S.started = true;
  S.t0 = now();
  S.lastTick = S.t0;

  nextStormAt = TUNE.stormEverySec;
  stormIndex = 0;

  syncHUD();

  function raf(t){
    if (S.ended) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - S.lastTick)/1000));
    S.lastTick = t;
    update(dt);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  window.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) endGame('hidden');
  });

  window.addEventListener('beforeunload', ()=>{
    if (!S.ended) {
      try{ endGame('unload'); }catch{}
    }
  });

  window.addEventListener('hha:force_end', (ev)=>{
    const d = ev.detail || {};
    if (!S.ended) endGame(d.reason || 'force');
  });
}

boot().catch(err=>console.error('[Hydration] boot error', err));