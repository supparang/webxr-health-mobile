// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini + Boss Mini + Research Logging)
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:end
// ✅ Research: run=research => adaptive OFF + deterministic seed + deterministic storm schedule
// ✅ Logging: ?log=<WEB_APP_EXEC_URL> => POST JSON on end
// ✅ PATCH 10: Boss mini (ท้าย Storm) ต้อง BLOCK boss-bad >= bossNeed
// ✅ PATCH 11: deterministic storm schedule (no frame-window race)
// ✅ PATCH 12: input throttle + sanity (เร็วขึ้น/แม่นขึ้น/กัน spam)
//
// ✅ PATCH 1–3:
// (1) Storm Mini “ผ่านได้จริง”: การันตีมี BAD ให้ block ใน end-window + ลดความโหดตาม diff
// (2) Cardboard HUD/Quest: checklist ชัด ๆ ว่าขาดอะไร (Zone/Pressure/End/Block)
// (3) miniTotal = จำนวน Storm โดยประมาณ (ไม่โชว์ 999)
//
// ✅ PATCH 4–6 (NEW):
// (4) End-storm FX: border flash + subtle shake + tick sound (best-effort)
// (5) Storm success feedback: celebrate + coach + summary metrics (stormSuccess/stormRate)
// (6) Shield balance: boost shield spawn when low/in storm/end-window + gentle guarantee

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
function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

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
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

// ------------------ audio (PATCH 4) ------------------
let _AC = null;
function ensureAC(){
  try{
    if (_AC) return _AC;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _AC = new Ctx();
    return _AC;
  }catch{ return null; }
}
function beep(freq=880, dur=0.04, gain=0.03){
  const ac = ensureAC();
  if (!ac) return;
  try{
    if (ac.state === 'suspended') ac.resume().catch(()=>{});
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }catch{}
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

// inject target styles + end-storm FX (PATCH 4)
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

  /* boss BAD */
  .hvr-target.bossbad{
    outline: 2px dashed rgba(239,68,68,.35);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 22px rgba(239,68,68,.10);
    filter: saturate(1.1) contrast(1.05);
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

  /* PATCH 4: End-storm vibe */
  body.hvr-vibe-shake{
    animation: hvrShake .22s linear infinite;
  }
  @keyframes hvrShake{
    0%{ transform: translate3d(0,0,0); }
    25%{ transform: translate3d(-0.7px,0.4px,0); }
    50%{ transform: translate3d(0.6px,-0.6px,0); }
    75%{ transform: translate3d(0.8px,0.6px,0); }
    100%{ transform: translate3d(0,0,0); }
  }
  #playfield.hvr-endflash::after{
    content:"";
    position:absolute; inset:0;
    pointer-events:none;
    border-radius: 22px;
    border: 2px solid rgba(239,68,68,.25);
    box-shadow:
      inset 0 0 0 2px rgba(239,68,68,.12),
      0 0 26px rgba(239,68,68,.14);
    animation: hvrFlash .33s ease-in-out infinite;
  }
  @keyframes hvrFlash{
    0%,100%{ opacity:.20; }
    50%{ opacity:.85; }
  }`;
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

  shield: 0,
  shieldMax: 3,

  greenHold: 0,
  greenTarget: 0,

  stormActive:false,
  stormLeftSec:0,
  stormDur: 0,
  stormCycle: 0,

  endWindowSec: 1.2,
  inEndWindow:false,

  // ----- mini conditions (storm mini) -----
  miniCleared:0,
  miniTotal: 0, // PATCH 3
  miniState: {
    inStorm:false,
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    blockedAny:false,
    doneThisStorm:false,
  },

  // ----- PATCH 10: Boss mini (ท้ายพายุ) -----
  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,

  // ----- PATCH 1: fairness end-window spawn -----
  endBadNeed: 1,
  endBadSpawned: 0,

  // ----- PATCH 5: storm success metrics -----
  stormSuccess: 0,

  // ----- PATCH 4: tick control -----
  _tickMark: -1,
  _vibeOn: false,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0
};

// difficulty tuning
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

    stormEverySec: stormEvery,
    stormDurSec: stormDur,
    endWindowSec: 1.2,

    // storm spawn faster
    stormSpawnMul: diff==='hard' ? 0.56 : 0.64,

    // water dynamics
    nudgeToMid: 5.0,
    badPush:    8.0,
    missPenalty: 1,

    greenTargetSec: g,

    // PATCH 10
    bossWindowSec: diff==='hard' ? 2.4 : 2.2
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

// PATCH 1: end-window need ตาม diff
S.endBadNeed = (diff === 'hard' ? 2 : 1);

// PATCH 3: miniTotal = จำนวน storm โดยประมาณ
(function computeMiniTotal(){
  const playable = Math.max(0, timeLimit - (S.stormDur + 2));
  const approx = Math.max(1, Math.floor(playable / TUNE.stormEverySec));
  S.miniTotal = approx;
})();

// expose
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

  if (acc >= 95 && miss <= 2 && mini >= 1) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}

// ------------------ FX pop ------------------
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

function setVibe(on){
  if (!playfield) return;
  if (on && !S._vibeOn){
    S._vibeOn = true;
    try{ DOC.body.classList.add('hvr-vibe-shake'); }catch{}
    try{ playfield.classList.add('hvr-endflash'); }catch{}
  }
  if (!on && S._vibeOn){
    S._vibeOn = false;
    try{ DOC.body.classList.remove('hvr-vibe-shake'); }catch{}
    try{ playfield.classList.remove('hvr-endflash'); }catch{}
  }
}

// ------------------ HUD sync ------------------
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

  setText(elQuest1, `คุม GREEN ให้ครบ ${S.greenTarget|0}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`);

  // PATCH 2: checklist ชัด
  const m = S.miniState;
  const z = m.zoneOK ? '✅' : '❌';
  const p = m.pressureOK ? '✅' : '❌';
  const e = m.endWindow ? '✅' : '❌';
  const bEnd = m.blockedInEnd ? '✅' : '❌';
  const bAny = m.blockedAny ? '✅' : '❌';

  let ruleTxt = '';
  if (diff === 'easy'){
    ruleTxt = 'Block ระหว่างพายุ (เมื่อไรก็ได้) 1 ครั้ง';
  } else if (diff === 'normal'){
    ruleTxt = 'Block ตอนท้ายพายุ (End) 1 ครั้ง';
  } else {
    ruleTxt = 'Block ตอนท้ายพายุ + BOSS (โหด)';
  }

  if (S.stormActive){
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText(elQuest3, `Storm Mini: ${ruleTxt}${bossTxt}`);

    if (diff === 'easy'){
      setText(elQuest4, `Mini ✓  Zone ${z}  Pressure ${p}  Block(any) ${bAny}`);
    } else {
      setText(elQuest4, `Mini ✓  Zone ${z}  Pressure ${p}  End ${e}  Block(end) ${bEnd}`);
    }
  } else {
    setText(elQuest3, `รอ Storm แล้วค่อยทำ Mini`);
    setText(elQuest4, `State: เก็บคะแนน + สะสม Shield`);
  }

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
    stormCycle: S.stormCycle|0,
    stormSuccess: S.stormSuccess|0
  });

  emit('hha:time', { left: S.leftSec|0 });

  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: (diff==='easy')
      ? 'Storm Mini: Block(anytime)'
      : (diff==='normal')
        ? 'Storm Mini: Block(end)'
        : 'Storm Mini: Block(end)+Boss',
    miniNow: (S.miniCleared|0),
    miniNeed: Math.min((S.miniTotal|0), (S.miniCleared|0) + 1),
    miniLeftSec: S.stormActive ? S.stormLeftSec : 0,
    miniUrgent: S.stormActive && S.inEndWindow,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0,
    miniFlags: {
      zoneOK: !!m.zoneOK,
      pressureOK: !!m.pressureOK,
      endWindow: !!m.endWindow,
      blockedInEnd: !!m.blockedInEnd,
      blockedAny: !!m.blockedAny
    }
  });
}

// ------------------ water dynamics ------------------
function updateZone(){ S.waterZone = zoneFrom(S.waterPct); }
function nudgeWaterGood(){
  const mid = 55;
  const d = mid - S.waterPct;
  const step = Math.sign(d) * Math.min(Math.abs(d), TUNE.nudgeToMid);
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}
function pushWaterBad(){
  const mid = 55;
  const d = S.waterPct - mid;
  const step = (d >= 0 ? +1 : -1) * TUNE.badPush;
  S.waterPct = clamp(S.waterPct + step, 0, 100);
  updateZone();
}

// ------------------ spawn math ------------------
function pickXY(){
  const r = playfield.getBoundingClientRect();
  const pad = 22;
  const w = Math.max(1, r.width - pad*2);
  const h = Math.max(1, r.height - pad*2);

  const rx = (rng()+rng())/2;
  const ry = (rng()+rng())/2;

  const x = pad + rx * w;
  const y = pad + ry * h;

  return { xPct: (x / r.width) * 100, yPct: (y / r.height) * 100 };
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

// ------------------ PATCH 12: input sanity ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ target lifecycle ------------------
function spawn(kind){
  if (S.ended) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const el = DOC.createElement('div');

  const isBossBad = (kind === 'bad' && S.bossActive);
  el.className = 'hvr-target ' + kind + (isBossBad ? ' bossbad' : '');
  el.dataset.kind = kind;
  if (isBossBad) el.dataset.boss = '1';

  el.style.setProperty('--x', xPct.toFixed(2) + '%');
  el.style.setProperty('--y', yPct.toFixed(2) + '%');
  el.style.setProperty('--s', s.toFixed(0) + 'px');

  el.textContent =
    kind === 'good' ? '💧' :
    kind === 'shield' ? '🛡️' :
    (isBossBad ? '🌩️' : '🥤');

  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;

  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  let killed = false;

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

    if (ev.pointerType === 'touch' && ev.isPrimary === false) return;

    const t = performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt = t;

    // allow audio after interaction
    ensureAC();

    kill('hit');

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();
      makePop('+GOOD', 'good');
      emit('hha:judge', { kind:'good' });
    }
    else if (kind === 'shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
      emit('hha:judge', { kind:'shield' });
    }
    else { // bad
      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;
        makePop('BLOCK!', 'shield');
        emit('hha:judge', { kind:'block' });

        if (S.stormActive && !S.miniState.doneThisStorm){
          S.miniState.blockedAny = true;   // easy
        }
        if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
          S.miniState.blockedInEnd = true; // normal/hard
        }

        if (isBossBad){
          S.bossBlocked++;
        }
      } else {
        S.nHitBad++;
        S.misses++;
        S.combo = 0;
        S.score = Math.max(0, S.score - 6);
        pushWaterBad();
        makePop('BAD!', 'bad');
        emit('hha:judge', { kind:'bad' });
      }
    }

    syncHUD();
  }, { passive:false });

  layer.appendChild(el);
  setTimeout(()=>kill('expire'), life);

  return el;
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;

// deterministic storm schedule
let nextStormAt = 0;
let stormIndex = 0;

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;

  if (S.adaptiveOn){
    base *= (1.00 - 0.25 * S.adaptK);
  }
  if (S.stormActive){
    base *= TUNE.stormSpawnMul;
  }

  return clamp(base, 210, 1200);
}

// PATCH 6: shield balance helper
function shieldBoostP(){
  // base boost when shield low
  const low = (S.shield <= 0) ? 0.08 : (S.shield === 1 ? 0.04 : 0.00);
  const storm = S.stormActive ? 0.04 : 0.00;
  const endW  = (S.stormActive && S.inEndWindow && S.shield <= 1) ? 0.06 : 0.00;
  return clamp(low + storm + endW, 0, 0.18);
}

function pickKind(){
  let pGood = 0.66;
  let pBad  = 0.28;
  let pSh   = 0.06;

  if (S.stormActive){
    pGood = 0.52;
    pBad  = 0.38;
    pSh   = 0.10;

    if (S.bossActive){
      pBad  += 0.10;
      pGood -= 0.10;
    }
  }
  if (diff === 'hard'){
    pBad += 0.04;
    pGood -= 0.04;
  }

  // PATCH 6: boost shield when needed (ไม่โกง แต่กัน SHIELD=0 ตลอด)
  pSh = clamp(pSh + shieldBoostP(), 0.06, 0.22);
  // normalize by shaving from good mostly
  const over = (pSh + pBad + pGood) - 1;
  if (over > 0){
    pGood = Math.max(0.22, pGood - over);
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

  S.miniState = {
    inStorm:true,
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    blockedAny:false,
    doneThisStorm:false,
  };

  S.bossActive = false;
  S.bossBlocked = 0;
  S.bossDoneThisStorm = false;

  S.endBadSpawned = 0;

  // force water off-green a bit so mini feasible
  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  // PATCH 6: gentle guarantee shield early in storm (ถ้าไม่มีเลย)
  if (S.shield === 0 && rng() < 0.65){
    spawn('shield');
  }

  syncHUD();
}

function evalStormMini(){
  const m = S.miniState;
  if (m.doneThisStorm) return false;

  if (diff === 'easy'){
    return !!(m.zoneOK && m.pressureOK && m.blockedAny);
  }
  return !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
}

function celebrate(kind='mini'){
  // best-effort: particles.js / hud binder may listen
  emit('hha:celebrate', { kind });
  emit('hha:coach', { mood:'happy', text: kind==='boss' ? 'BOSS ผ่านแล้ว! 👏' : 'Mini สำเร็จ! ✅' });
}

function exitStorm(){
  // stop end-storm vibe
  setVibe(false);
  S._tickMark = -1;

  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // evaluate storm mini
  if (!S.miniState.doneThisStorm){
    const ok = evalStormMini();
    if (ok){
      S.miniCleared++;
      S.stormSuccess++;              // PATCH 5
      S.miniState.doneThisStorm = true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
      celebrate('mini');
    }
  }

  // boss result
  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm = true;
      S.miniCleared++;
      S.score += 45;
      makePop('BOSS ✓', 'shield');
      celebrate('boss');
    }
  }
  S.bossActive = false;

  syncHUD();
}

function guaranteeEndBad(){
  if (!S.stormActive) return;
  if (!S.inEndWindow) return;
  if (S.endBadSpawned >= S.endBadNeed) return;

  S.endBadSpawned++;
  spawn('bad');
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  // PATCH 4: end-storm vibe + ticking
  if (inEnd){
    setVibe(true);

    // tick based on deci-second mark (10 steps)
    const mark = Math.floor(S.stormLeftSec * 10);
    if (mark !== S._tickMark){
      S._tickMark = mark;
      // faster tick as time goes lower
      const f = (S.stormLeftSec <= 0.35) ? 1050 : (S.stormLeftSec <= 0.8 ? 940 : 860);
      beep(f, 0.03, 0.022);
    }

    // guarantee BAD to block
    guaranteeEndBad();
    if (diff === 'hard'){
      if (S.endBadSpawned < S.endBadNeed && (rng() < 0.55)){
        guaranteeEndBad();
      }
    }
  } else {
    setVibe(false);
    S._tickMark = -1;
  }

  // boss window
  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  if (inBoss && !S.bossDoneThisStorm){
    S.bossActive = true;
  } else if (!inBoss){
    S.bossActive = false;
  }

  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  const pGain = zoneOK ? 0.50 : 0.24;
  S.miniState.pressure = clamp(S.miniState.pressure + dt * pGain, 0, 1);
  if (S.miniState.pressure >= 1) S.miniState.pressureOK = true;

  if (S.stormLeftSec <= 0.001){
    exitStorm();
  }
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
    if (elapsed >= nextStormAt && S.leftSec > (S.stormDur + 2)){
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

  setVibe(false);

  const grade = computeGrade();
  const acc = computeAccuracy();

  const stormRate = (S.stormCycle > 0) ? (S.stormSuccess / S.stormCycle) : 0;

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

    // PATCH 5: storm metrics (ใช้โชว์ใน summary)
    stormCycles: S.stormCycle|0,
    stormSuccess: S.stormSuccess|0,
    stormRatePct: Math.round(stormRate * 1000) / 10, // 1 decimal

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
  await sendLog(summary);
}

// ------------------ start gating ------------------
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
  if (!playfield || !layer){
    console.warn('[Hydration] missing #playfield or #hvr-layer');
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