// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini + Boss Mini)
// ✅ Cardboard: dual-eye targets + sync remove + spawn rect fallback
// ✅ Drift: emit driftX/driftY/driftRot for VR-feel motion
// ✅ Perfect/fast-hit/streak scoring + RT tracking
// ✅ End Summary: timeInGreen/storm success rate/streak/accuracy

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

const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
const ts = String(qs('ts', Date.now()));
const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));
const rng = makeRng(seed);

// ------------------ DOM bind ------------------
const playfield = DOC.getElementById('playfield');
const layer     = DOC.getElementById('hvr-layer');

// Cardboard layers
const cbPlayfieldL = DOC.getElementById('cbPlayfieldL');
const layerL       = DOC.getElementById('hvr-layerL');
const layerR       = DOC.getElementById('hvr-layerR');

const elScore = DOC.getElementById('stat-score');
const elCombo = DOC.getElementById('stat-combo');
const elMiss  = DOC.getElementById('stat-miss');
const elTime  = DOC.getElementById('stat-time');
const elGrade = DOC.getElementById('stat-grade');

const elQuest1 = DOC.getElementById('quest-line1');
const elQuest2 = DOC.getElementById('quest-line2');
const elQuest3 = DOC.getElementById('quest-line3');
const elQuest4 = DOC.getElementById('quest-line4');

const elStormLeft   = DOC.getElementById('storm-left');
const elShieldCount = DOC.getElementById('shield-count');

function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

// inject target styles (targets visible)
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
    font-size: calc(var(--s,64px) * 0.56);
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
  streak:0,
  streakMax:0,

  misses:0,

  nGoodSpawn:0,
  nBadSpawn:0,
  nShieldSpawn:0,

  nHitGood:0,
  nHitBad:0,
  nHitBadGuard:0,
  nExpireGood:0,

  // RT tracking
  goodRtMs: [],        // store last N RTs
  fastHitCount: 0,
  fastHitThreshMs: 350,

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
  stormMiniSuccess: 0,   // success count per storm cycle (main mini only)

  endWindowSec: 1.2,
  inEndWindow:false,

  miniCleared:0,
  miniTotal: 999,
  miniState: {
    inStorm:false,
    zoneOK:false,
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  },

  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0,

  cardboardOn:false,

  // drift
  driftX:0, driftY:0, driftRot:0,
  driftPhase: rng()*Math.PI*2
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

    stormSpawnMul: diff==='hard' ? 0.56 : 0.64,

    nudgeToMid: 5.0,
    badPush:    8.0,
    missPenalty: 1,

    greenTargetSec: g,

    bossWindowSec: diff==='hard' ? 2.4 : 2.2,

    perfectWindowMs: 320, // fast RT => PERFECT
    perfectBonus: diff==='hard' ? 9 : 7,
    streakBonusEvery: 7,
    streakBonus: 12
  };
})();

S.greenTarget   = TUNE.greenTargetSec;
S.endWindowSec  = TUNE.endWindowSec;
S.stormDur      = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

// ------------------ computed ------------------
function computeAccuracy(){
  const denom = Math.max(1, S.nGoodSpawn);
  return clamp((S.nHitGood / denom) * 100, 0, 100);
}
function computeGrade(){
  const acc  = computeAccuracy();
  const miss = S.misses|0;
  const mini = S.miniCleared|0;

  if (acc >= 95 && miss <= 2 && mini >= 1) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}
function avg(arr){
  if (!arr || !arr.length) return 0;
  let s=0; for (let i=0;i<arr.length;i++) s += arr[i];
  return s / arr.length;
}
function median(arr){
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const m = (a.length-1)/2;
  const lo = Math.floor(m), hi = Math.ceil(m);
  return (a[lo] + a[hi]) / 2;
}

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
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText(elQuest3, `Storm Mini: Shield Timing${bossTxt}`);
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

  // WaterGauge UI
  setWaterGauge(S.waterPct);

  // Quest lines for Cardboard
  const goalLine1 = `GREEN ${Math.round(S.greenTarget)}s`;
  const goalLine2 = `${(Math.min(S.greenHold,S.greenTarget)).toFixed(1)} / ${Math.round(S.greenTarget)}s`;
  const miniLine  = `Mini ✓ ${S.miniCleared|0}/${S.miniTotal|0}`;

  // emit score (includes drift)
  emit('hha:score', {
    leftSec: S.leftSec|0,
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    streakMax: S.streakMax|0,
    misses: S.misses|0,
    accuracyGoodPct: acc,
    grade,
    waterPct: S.waterPct,
    waterZone: S.waterZone,
    shield: S.shield|0,
    stormActive: !!S.stormActive,
    stormLeftSec: S.stormLeftSec,
    stormInEndWindow: !!S.inEndWindow,

    driftX: S.driftX,
    driftY: S.driftY,
    driftRot: S.driftRot
  });

  emit('quest:update', {
    goalLine1,
    goalLine2,
    miniLine
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

// ------------------ spawn rect fallback ------------------
function getRectForSpawn(){
  if (S.cardboardOn && cbPlayfieldL && cbPlayfieldL.getBoundingClientRect){
    const r = cbPlayfieldL.getBoundingClientRect();
    if (r && r.width > 160 && r.height > 180) return { left:r.left, top:r.top, width:r.width, height:r.height };
  }
  if (playfield && playfield.getBoundingClientRect){
    const r = playfield.getBoundingClientRect();
    if (r && r.width > 160 && r.height > 180) return { left:r.left, top:r.top, width:r.width, height:r.height };
  }
  const vw = Math.max(1, window.innerWidth || DOC.documentElement.clientWidth || 1);
  const vh = Math.max(1, window.innerHeight || DOC.documentElement.clientHeight || 1);
  return { left:0, top:0, width:vw, height:vh };
}

function pickXY(){
  const R = getRectForSpawn();
  const pad = 22;
  const w = Math.max(1, R.width - pad*2);
  const h = Math.max(1, R.height - pad*2);

  const rx = (rng()+rng())/2;
  const ry = (rng()+rng())/2;

  let x = pad + rx * w;
  let y = pad + ry * h;

  if (S.cardboardOn){
    const splitGap = 14;
    const mid = R.width * 0.5;
    const seamL = mid - splitGap;
    const seamR = mid + splitGap;
    if (x > seamL && x < seamR){
      x = (rx < 0.5) ? (seamL - 6) : (seamR + 6);
    }
  }

  return { xPct: (x / R.width) * 100, yPct: (y / R.height) * 100 };
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
  const host = (S.cardboardOn && layerL) ? layerL : layer;
  try{
    const p = DOC.createElement('div');
    p.className = 'hvr-pop';
    p.textContent = text;
    p.style.left = '50%';
    p.style.top = '46%';
    p.style.color = kind === 'good' ? 'rgba(34,197,94,.95)'
                  : kind === 'shield' ? 'rgba(34,211,238,.95)'
                  : 'rgba(239,68,68,.95)';
    host.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

// ------------------ input sanity ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ dual-eye targets + sync remove ------------------
let nextTid = 1;
const pairMap = new Map(); // tid -> { a,b,kind,spawnAtMs,killed }
function getSpawnHosts(){
  if (S.cardboardOn && layerL && layerR) return [layerL, layerR];
  return [layer];
}
function killPair(tid, reason){
  const p = pairMap.get(tid);
  if (!p || p.killed) return;
  p.killed = true;
  try{ p.a && p.a.remove(); }catch{}
  try{ p.b && p.b.remove(); }catch{}
  pairMap.delete(tid);

  if (reason === 'expire'){
    if (p.kind === 'good'){
      S.misses += 1;
      S.nExpireGood++;
      S.combo = 0;
      S.streak = 0;
    }
  }
}

function recordGoodRt(rtMs){
  rtMs = clamp(rtMs, 1, 5000);
  const a = S.goodRtMs;
  a.push(rtMs);
  if (a.length > 220) a.splice(0, a.length - 220);
  if (rtMs <= S.fastHitThreshMs) S.fastHitCount++;
}

function spawn(kind){
  if (S.ended) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const hosts = getSpawnHosts();
  const tid = nextTid++;
  const isBossBad = (kind === 'bad' && S.bossActive);

  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;

  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  const text =
    kind === 'good' ? '💧' :
    kind === 'shield' ? '🛡️' :
    (isBossBad ? '🌩️' : '🥤');

  const spawnAt = performance.now();

  function makeEl(){
    const el = DOC.createElement('div');
    el.className = 'hvr-target ' + kind + (isBossBad ? ' bossbad' : '');
    el.dataset.kind = kind;
    el.dataset.tid = String(tid);
    if (isBossBad) el.dataset.boss = '1';
    el.style.setProperty('--x', xPct.toFixed(2) + '%');
    el.style.setProperty('--y', yPct.toFixed(2) + '%');
    el.style.setProperty('--s', s.toFixed(0) + 'px');
    el.textContent = text;

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if (S.ended) return;

      const t = performance.now();
      if (t - lastHitAt < HIT_COOLDOWN_MS) return;
      lastHitAt = t;

      // kill pair once
      killPair(tid, 'hit');

      if (kind === 'good'){
        S.nHitGood++;

        const rt = t - spawnAt;
        recordGoodRt(rt);

        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);

        S.streak++;
        S.streakMax = Math.max(S.streakMax, S.streak);

        let add = 10 + Math.min(15, (S.combo|0));
        if (rt <= TUNE.perfectWindowMs){
          add += TUNE.perfectBonus;
          emit('hha:judge', { kind:'perfect' });
          makePop('PERFECT!', 'shield');
        } else {
          emit('hha:judge', { kind:'good' });
          makePop('+GOOD', 'good');
        }

        if (S.streak > 0 && (S.streak % TUNE.streakBonusEvery) === 0){
          add += TUNE.streakBonus;
          emit('hha:judge', { kind:'streak' });
          makePop('STREAK!', 'good');
        }

        S.score += add;
        nudgeWaterGood();
      }
      else if (kind === 'shield'){
        S.score += 6;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);

        S.streak++;
        S.streakMax = Math.max(S.streakMax, S.streak);

        S.shield = clamp(S.shield + 1, 0, S.shieldMax);
        makePop('+SHIELD', 'shield');
        emit('hha:judge', { kind:'shield' });
      }
      else {
        // BAD
        if (S.shield > 0){
          S.shield--;
          S.nHitBadGuard++;
          S.score += 4;
          makePop('BLOCK!', 'shield');
          emit('hha:judge', { kind:'block' });

          if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
            S.miniState.blockedInEnd = true;
          }
          if (isBossBad){
            S.bossBlocked++;
          }
        } else {
          S.nHitBad++;
          S.misses++;
          S.combo = 0;
          S.streak = 0;
          S.score = Math.max(0, S.score - 6);
          pushWaterBad();
          makePop('BAD!', 'bad');
          emit('hha:judge', { kind:'bad' });
        }
      }

      syncHUD();
    }, { passive:false });

    return el;
  }

  const a = makeEl();
  let b = null;

  hosts[0].appendChild(a);
  if (hosts.length > 1){
    b = makeEl();
    hosts[1].appendChild(b);
  }

  pairMap.set(tid, { a, b, kind, spawnAtMs: spawnAt, killed:false });

  setTimeout(()=> killPair(tid, 'expire'), life);
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;
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
    doneThisStorm:false,
  };

  S.bossActive = false;
  S.bossBlocked = 0;
  S.bossDoneThisStorm = false;

  // kick water away from GREEN for fairness
  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  emit('hha:storm', { state:'enter' });
  emit('hha:judge', { kind:'storm-in' });
  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // evaluate mini (main)
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
      S.stormMiniSuccess++;
      m.doneThisStorm = true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
      emit('hha:judge', { kind:'rush' });
    }
  }

  // boss
  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm = true;
      S.miniCleared++;
      S.score += 45;
      makePop('BOSS ✓', 'shield');
      emit('hha:judge', { kind:'rush' });
    }
  }

  S.bossActive = false;
  syncHUD();
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (TUNE.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

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

// ------------------ drift model (VR feel) ------------------
function updateDrift(dt){
  // intensity from water deviation + storm urgency + combo
  const dev = Math.abs(S.waterPct - 55) / 45; // 0..~1
  const comboK = clamp(S.combo / 18, 0, 1);
  const stormK = S.stormActive ? (S.inEndWindow ? 1 : 0.45) : 0.0;
  const k = clamp(dev*0.55 + comboK*0.25 + stormK*0.35, 0, 1);

  S.driftPhase += dt * (0.9 + 1.8*k);
  const w1 = Math.sin(S.driftPhase);
  const w2 = Math.cos(S.driftPhase*0.82);

  const amp = 6 + 18*k;
  S.driftX = w1 * amp;
  S.driftY = w2 * (amp*0.75);
  S.driftRot = w1 * (1.2 + 4.2*k);
}

// ------------------ end ------------------
function endGame(reason){
  if (S.ended) return;
  S.ended = true;

  // clear remaining targets
  for (const [tid] of pairMap){
    killPair(tid, 'hit');
  }

  const grade = computeGrade();
  const acc = computeAccuracy();

  const avgRt = avg(S.goodRtMs);
  const medRt = median(S.goodRtMs);
  const fastRate = S.goodRtMs.length ? (S.fastHitCount / S.goodRtMs.length) * 100 : 0;

  const stormRate = (S.stormCycle > 0) ? (S.stormMiniSuccess / S.stormCycle) * 100 : 0;

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
    streakMax: S.streakMax|0,
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

    timeInGreenSec: Number(S.greenHold || 0),

    avgRtGoodMs: avgRt,
    medianRtGoodMs: medRt,
    fastHitRatePct: fastRate,

    stormCycles: S.stormCycle|0,
    stormMiniSuccess: S.stormMiniSuccess|0,
    stormSuccessRatePct: stormRate,

    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  emit('hha:end', summary);
}

// ------------------ start gating ------------------
async function waitStartGate(){
  const ov = DOC.getElementById('startOverlay');
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

// ------------------ main loop ------------------
function update(dt){
  if (!S.started || S.ended) return;

  S.leftSec = Math.max(0, S.leftSec - dt);

  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  // drift
  updateDrift(dt);

  const elapsed = (now() - S.t0) / 1000;

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

// ------------------ init ------------------
async function boot(){
  if (!layer){
    console.warn('[Hydration] missing #hvr-layer');
    return;
  }

  // cardboard event from html
  window.addEventListener('hha:cardboard', (ev)=>{
    const d = ev.detail || {};
    S.cardboardOn = !!d.on;
  }, { passive:true });

  // initial guess
  S.cardboardOn = DOC.body.classList.contains('cardboard');

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