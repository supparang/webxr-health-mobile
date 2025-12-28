// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini)
// Works with: /herohealth/hydration-vr.html (ids: playfield, hvr-layer, water-*, stat-*)
// Uses: /herohealth/vr/ui-water.js
// Optional: /herohealth/vr/mode-factory.js (if exists). Fallback engine included.

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
function qn(name, def){
  const v = Number(qs(name, def));
  return Number.isFinite(v) ? v : def;
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// seeded RNG (deterministic for research)
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
    // xorshift32
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

// ------------------ DOM bind ------------------
const playfield = DOC.getElementById('playfield');
const layer = DOC.getElementById('hvr-layer');

const elScore = DOC.getElementById('stat-score');
const elCombo = DOC.getElementById('stat-combo');
const elComboMax = DOC.getElementById('stat-combo-max'); // optional
const elMiss = DOC.getElementById('stat-miss');
const elTime = DOC.getElementById('stat-time');
const elGrade = DOC.getElementById('stat-grade');

const elQuest1 = DOC.getElementById('quest-line1');
const elQuest2 = DOC.getElementById('quest-line2');
const elQuest3 = DOC.getElementById('quest-line3');
const elQuest4 = DOC.getElementById('quest-line4');

const elStormLeft = DOC.getElementById('storm-left');
const elShieldCount = DOC.getElementById('shield-count');

if (!playfield || !layer){
  console.warn('[Hydration] missing #playfield or #hvr-layer');
}

// inject target styles (so targets always visible)
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
  .hvr-target::after{
    content:"";
    position:absolute; inset:-8px;
    border-radius:999px;
    background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.08), rgba(255,255,255,0) 60%);
    opacity:.35;
    pointer-events:none;
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
    100%{ opacity:0; transform: translate(-50%,-70%) scale(1.05); }
  }
  `;
  DOC.head.appendChild(st);
})();

// ------------------ gameplay state ------------------
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

  nHitGood:0,
  nHitBad:0,
  nHitBadGuard:0,
  nExpireGood:0,

  waterPct: 50,
  waterZone: 'GREEN',

  shield: 0,          // charges
  shieldMax: 3,

  // goal: stay GREEN for target seconds (cumulative)
  greenHold: 0,
  greenTarget: 0,

  // storm cycle
  stormActive:false,
  stormLeftSec:0,
  stormDur: 0,
  stormCycle: 0,

  // end-window (ท้ายพายุ)
  endWindowSec: 1.2,
  inEndWindow:false,

  // mini progress / cleared
  miniCleared:0,
  miniTotal: 999,
  miniState: {
    // per-storm flags
    inStorm:false,
    zoneOK:false,        // LOW/HIGH (not GREEN)
    pressure:0,          // 0..1
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  },

  // adaptive
  adaptiveOn: (run !== 'research'), // play = adaptive, research = fixed
  adaptK: 0.0
};

// difficulty tuning
const TUNE = (() => {
  // base target size
  const sizeBase =
    diff === 'easy' ? 78 :
    diff === 'hard' ? 56 : 66;

  // spawn rates
  const spawnBase =
    diff === 'easy' ? 720 :
    diff === 'hard' ? 520 : 620;

  // storm
  const stormEvery =
    diff === 'easy' ? 18 :
    diff === 'hard' ? 14 : 16;

  const stormDur =
    diff === 'easy' ? 5.2 :
    diff === 'hard' ? 6.2 : 5.8;

  // goal target: percentage of game time, clamp
  const g = clamp(Math.round(timeLimit * (diff==='easy' ? 0.42 : diff==='hard' ? 0.55 : 0.48)), 18, Math.max(18, timeLimit-8));

  return {
    sizeBase,
    spawnBaseMs: spawnBase,
    spawnJitter: 190,
    goodLifeMs: diff==='hard' ? 980 : 1120,
    badLifeMs:  diff==='hard' ? 1050 : 1200,
    shieldLifeMs: 1400,

    stormEverySec: stormEvery,
    stormDurSec: stormDur,
    endWindowSec: 1.2,

    // storm spawn accel
    stormSpawnMul: diff==='hard' ? 0.58 : 0.65,

    // water delta
    nudgeToMid: 5.0,     // good hit nudges toward 55
    badPush:    8.0,     // bad hit pushes away from 55
    missPenalty: 1,

    greenTargetSec: g
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;

// expose debug for HTML cinematic driver (if any)
ROOT.__HVR__ = ROOT.__HVR__ || {};
ROOT.__HVR__.S = S;
ROOT.__HVR__.TUNE = TUNE;

// ------------------ UI update ------------------
function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

function computeAccuracy(){
  const denom = Math.max(1, S.nGoodSpawn);
  return clamp((S.nHitGood / denom) * 100, 0, 100);
}

function computeGrade(){
  const acc = computeAccuracy();
  const miss = S.misses|0;
  const mini = S.miniCleared|0;

  // โทน SSS,SS,S,A,B,C ตามที่ตกลง
  if (acc >= 95 && miss <= 2 && mini >= 1) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}

function syncHUD(){
  const grade = computeGrade();
  const acc = computeAccuracy();

  setText(elScore, S.score|0);
  setText(elCombo, S.combo|0);
  if (elComboMax) setText(elComboMax, S.comboMax|0);
  setText(elMiss, S.misses|0);
  setText(elTime, S.leftSec|0);
  setText(elGrade, grade);

  setText(elShieldCount, S.shield|0);
  setText(elStormLeft, S.stormActive ? (S.stormLeftSec|0) : 0);

  // quest lines
  setText(elQuest1, `คุม GREEN ให้ครบ ${S.greenTarget|0}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`);
  setText(elQuest3, S.stormActive
    ? `Storm Mini: Shield Timing (โหมดโหด)`
    : `รอ Storm แล้วค่อยทำ Mini (ผ่านแล้วจะได้โบนัส)`
  );
  const m = S.miniState;
  setText(elQuest4, S.stormActive
    ? `Mini: zone=${m.zoneOK?'OK':'NO'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
    : `State: สะสมคะแนน + เตรียม Shield`
  );

  // water gauge
  setWaterGauge(S.waterPct);

  // emit global
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
    stormLeftSec: S.stormLeftSec
  });

  emit('hha:time', { left: S.leftSec|0 });

  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: 'Storm Shield Timing',
    miniNow: (S.miniCleared|0),
    miniNeed: (S.miniCleared|0) + 1,   // show incremental feel
    miniLeftSec: S.stormActive ? S.stormLeftSec : 0,
    miniUrgent: S.stormActive && S.inEndWindow,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0
  });
}

// ------------------ water dynamics ------------------
function updateZone(){
  S.waterZone = zoneFrom(S.waterPct);
}

function nudgeWaterGood(){
  // good “ดันเข้ากลาง” (ใกล้ 55)
  const mid = 55;
  const d = mid - S.waterPct;
  const step = Math.sign(d) * Math.min(Math.abs(d), TUNE.nudgeToMid);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

function pushWaterBad(){
  // bad “ดันออกจากกลาง”
  const mid = 55;
  const d = S.waterPct - mid;
  const step = (d >= 0 ? +1 : -1) * TUNE.badPush;
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// ------------------ spawn math (center bias + safe margins) ------------------
function pickXY(){
  const r = playfield.getBoundingClientRect();
  const pad = 22; // avoid edges
  const w = Math.max(1, r.width - pad*2);
  const h = Math.max(1, r.height - pad*2);

  // center-bias: average of 2 randoms pulls toward center
  const rx = (rng()+rng())/2;
  const ry = (rng()+rng())/2;

  const x = pad + rx * w;
  const y = pad + ry * h;

  return { xPct: (x / r.width) * 100, yPct: (y / r.height) * 100 };
}

function targetSize(){
  let s = TUNE.sizeBase;

  // adaptive in play mode: ถ้าเล่นแม่น/คอมโบสูง -> เล็กลงนิด + spawn ถี่ขึ้น
  if (S.adaptiveOn){
    const acc = computeAccuracy()/100;
    const c = clamp(S.combo/20, 0, 1);
    const k = clamp((acc*0.7 + c*0.3), 0, 1);
    S.adaptK = k;
    s = s * (1.02 - 0.22*k);
  }

  // storm shrinks more
  if (S.stormActive) s *= (diff==='hard' ? 0.78 : 0.82);

  return clamp(s, 44, 86);
}

// ------------------ DOM target lifecycle ------------------
function makePop(text, kind){
  try{
    const p = DOC.createElement('div');
    p.className = 'hvr-pop';
    p.textContent = text;
    p.style.left = '50%';
    p.style.top = '46%';
    p.style.color = kind === 'good' ? 'rgba(34,197,94,.95)'
                  : kind === 'shield' ? 'rgba(34,211,238,.95)'
                  : 'rgba(239,68,68,.95)';
    layer.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

function spawn(kind){
  if (S.ended) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const el = DOC.createElement('div');
  el.className = 'hvr-target ' + kind;
  el.dataset.kind = kind;

  el.style.setProperty('--x', xPct.toFixed(2) + '%');
  el.style.setProperty('--y', yPct.toFixed(2) + '%');
  el.style.setProperty('--s', s.toFixed(0) + 'px');

  // emoji
  el.textContent =
    kind === 'good' ? '💧' :
    kind === 'shield' ? '🛡️' :
    '🥤';

  // counts
  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;

  // life
  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  let killed = false;
  const born = now();

  function kill(reason){
    if (killed) return;
    killed = true;
    try{ el.remove(); }catch{}
    if (reason === 'expire'){
      if (kind === 'good') {
        S.misses += TUNE.missPenalty;
        S.nExpireGood++;
        S.combo = 0;
      }
    }
  }

  el.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault();
    ev.stopPropagation();
    if (killed || S.ended) return;

    // hit
    kill('hit');

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0)); // combo scaling
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();
      makePop('+GOOD', 'good');
    }
    else if (kind === 'shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
    }
    else { // bad
      // if shield available -> guard
      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;
        makePop('BLOCK!', 'shield');

        // ✅ mini condition: block bad in end-window
        if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
          S.miniState.blockedInEnd = true;
        }
      } else {
        S.nHitBad++;
        S.misses++;
        S.combo = 0;
        S.score = Math.max(0, S.score - 6);
        pushWaterBad();
        makePop('BAD!', 'bad');
      }
    }

    syncHUD();
  }, { passive:false });

  layer.appendChild(el);

  // expire timer
  setTimeout(()=>kill('expire'), life);

  return el;
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;

  // adaptive faster
  if (S.adaptiveOn){
    base *= (1.00 - 0.25 * S.adaptK);
  }

  // storm accel
  if (S.stormActive){
    base *= TUNE.stormSpawnMul;
  }

  return clamp(base, 220, 1200);
}

function pickKind(){
  // baseline distribution
  let pGood = 0.66;
  let pBad  = 0.28;
  let pSh   = 0.06;

  // storm: more bad + more shield
  if (S.stormActive){
    pGood = 0.52;
    pBad  = 0.38;
    pSh   = 0.10;
  }

  // hard: slightly more bad
  if (diff === 'hard'){
    pBad += 0.04;
    pGood -= 0.04;
  }

  const r = rng();
  if (r < pSh) return 'shield';
  if (r < pSh + pBad) return 'bad';
  return 'good';
}

// ------------------ storm + mini logic ------------------
function enterStorm(){
  S.stormActive = true;
  S.stormLeftSec = S.stormDur;
  S.stormCycle++;

  // reset mini per storm
  S.miniState = {
    inStorm:true,
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  };

  // force “ต้องเล่นเสี่ยง”: ให้คนดันออกจาก green
  // (ไม่ทำแรงเกิน เดี๋ยวเสียบาลานซ์)
  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // if mini achieved this storm, count it once
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
      m.doneThisStorm = true;
      // bonus
      S.score += 35;
      makePop('MINI ✓', 'shield');
    }
  }

  syncHUD();
}

// pressure accumulates in storm, faster when not green
function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  // end-window flag
  const inEnd = (S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  // conditions:
  // 1) must be LOW/HIGH (not GREEN) sometime during storm
  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  // 2) pressure builds when storm + not green
  const pGain = zoneOK ? 0.48 : 0.22;
  S.miniState.pressure = clamp(S.miniState.pressure + dt * pGain, 0, 1);

  if (S.miniState.pressure >= 1) S.miniState.pressureOK = true;

  // 3) final: block bad in end-window with shield (set in hit handler)

  if (S.stormLeftSec <= 0.001){
    exitStorm();
  }
}

// ------------------ main loop ------------------
function update(dt){
  if (!S.started || S.ended) return;

  // time
  S.leftSec = Math.max(0, S.leftSec - dt);

  // goal: accumulate green time
  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  // storm schedule
  const elapsed = (now() - S.t0) / 1000;
  // start storm at multiples
  if (!S.stormActive){
    const nextAt = Math.max(2, TUNE.stormEverySec);
    const phase = Math.floor(elapsed / nextAt);
    // enter at phase change (but avoid entering too near end)
    if (phase > 0 && (elapsed - (phase*nextAt)) < 0.04 && S.leftSec > (S.stormDur + 2)){
      enterStorm();
    }
  } else {
    tickStorm(dt);
  }

  // spawn
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

function endGame(reason){
  if (S.ended) return;
  S.ended = true;

  const grade = computeGrade();
  const acc = computeAccuracy();

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
    miniTotal: S.miniTotal|0,

    nTargetGoodSpawned: S.nGoodSpawn|0,
    nTargetJunkSpawned: S.nBadSpawn|0,
    nTargetShieldSpawned: S.nShieldSpawn|0,

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitBad|0,
    nHitJunkGuard: S.nHitBadGuard|0,
    nExpireGood: S.nExpireGood|0,

    accuracyGoodPct: acc,
    grade,
    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  emit('hha:end', summary);
  console.log('[Hydration] end', summary);
}

// ------------------ start gating (wait start overlay hide) ------------------
async function waitStartGate(){
  // if start overlay exists, wait until it's hidden or removed
  const ov = DOC.getElementById('start-overlay') || DOC.getElementById('startOverlay');
  if (!ov) return;

  // if already hidden, ok
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

    // fallback timeout (กันค้าง)
    setTimeout(()=>{
      try{ mo.disconnect(); }catch{}
      resolve();
    }, 25000);
  });
}

// ------------------ init ------------------
async function boot(){
  ensureWaterGauge();
  setWaterGauge(S.waterPct);

  // initial spawn delay
  spawnTimer = 350;

  // wait start gate
  await waitStartGate();

  S.started = true;
  S.t0 = now();
  S.lastTick = S.t0;

  // prime HUD
  updateZone();
  syncHUD();

  // main RAF loop
  function raf(t){
    if (S.ended) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - S.lastTick)/1000));
    S.lastTick = t;
    update(dt);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // safety: stop on page hide
  window.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) endGame('hidden');
  });

  // Back button safe end (optional)
  window.addEventListener('beforeunload', ()=>{
    if (!S.ended) {
      try{ endGame('unload'); }catch{}
    }
  });
}

boot().catch(err=>console.error('[Hydration] boot error', err));