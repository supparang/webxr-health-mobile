// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini + Boss Mini + Research Logging)
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:storm, hha:end
// ✅ Research: run=research => adaptive OFF + deterministic seed + deterministic storm schedule
// ✅ Logging: ?log=<WEB_APP_EXEC_URL> => POST JSON on end (best effort)
// ✅ Boss mini: ท้าย Storm ต้อง BLOCK boss-bad >= bossNeed
// ✅ deterministic storm schedule (no frame-window race)
// ✅ Cardboard: spawn targets into L/R layers (so gaze works)
// ✅ Summary: TimeInGreen + StreakMax + StormRate
// ✅ Drift: storm wind drift -> hha:score detail (driftX/Y/Rot)

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
const layerL = DOC.getElementById('hvr-layerL');
const layerR = DOC.getElementById('hvr-layerR');

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

function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

// optional Particles hooks
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){} };

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

  // streak (while in GREEN and hitting good)
  streak: 0,
  streakMax: 0,

  // storm schedule
  stormActive:false,
  stormLeftSec:0,
  stormDur: 0,
  stormCycle: 0,

  endWindowSec: 1.2,
  inEndWindow:false,

  // storm result counters
  stormMiniSuccess: 0, // count storms where mini ok (zone+pressure+end+block)
  stormBossSuccess: 0, // count storms where boss ok
  stormMiniTried: 0,   // storms finished (for rate)

  // ----- mini conditions (storm mini) -----
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

  // ----- Boss mini (ท้าย Storm) -----
  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0,

  // drift values (wind)
  driftX: 0,
  driftY: 0,
  driftRot: 0
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

    // streak / perfect tuning
    streakStepBonus: diff==='hard' ? 6 : 5,     // every N streak -> bonus
    streakBonusPts:  14,
    perfectRemainMs: diff==='hard' ? 95 : 115,  // remaining life <= threshold -> perfect
    perfectBonusPts: 18
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

// expose for HTML cinematic driver (optional)
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

  // bell-ish distribution via (rng+rng)/2
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
  } else {
    S.adaptK = 0;
  }

  if (S.stormActive) s *= (diff==='hard' ? 0.78 : 0.82);
  return clamp(s, 44, 86);
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

// ------------------ input sanity / anti-spam ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ grouped target spawn (main + L/R) ------------------
let targetSeq = 0;

function buildTargetEl(kind, isBossBad, xPct, yPct, sPx){
  const el = DOC.createElement('div');
  el.className = 'hvr-target ' + kind + (isBossBad ? ' bossbad' : '');
  el.dataset.kind = kind;
  if (isBossBad) el.dataset.boss = '1';

  el.style.setProperty('--x', xPct.toFixed(2) + '%');
  el.style.setProperty('--y', yPct.toFixed(2) + '%');
  el.style.setProperty('--s', sPx.toFixed(0) + 'px');

  el.textContent =
    kind === 'good' ? '💧' :
    kind === 'shield' ? '🛡️' :
    (isBossBad ? '🌩️' : '🥤');

  return el;
}

function spawn(kind){
  if (S.ended) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossBad = (kind === 'bad' && S.bossActive);
  const bornAt = performance.now();

  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;

  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  const id = (++targetSeq);
  let killed = false;

  const els = [];
  const elMain = buildTargetEl(kind, isBossBad, xPct, yPct, s);
  els.push(elMain);
  if (layerL) els.push(buildTargetEl(kind, isBossBad, xPct, yPct, s));
  if (layerR) els.push(buildTargetEl(kind, isBossBad, xPct, yPct, s));

  function kill(reason){
    if (killed) return;
    killed = true;
    for (const e of els){ try{ e.remove(); }catch{} }

    if (reason === 'expire'){
      if (kind === 'good') {
        S.misses += TUNE.missPenalty;
        S.nExpireGood++;
        S.combo = 0;
        S.streak = 0;
      }
    }
  }

  function onHit(ev){
    if (killed || S.ended) return;

    // multi-touch sanity
    if (ev && ev.pointerType === 'touch' && ev.isPrimary === false) return;

    const t = performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt = t;

    kill('hit');

    const remainMs = Math.max(0, (bornAt + life) - t);

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      nudgeWaterGood();

      // streak: only counts when CURRENT zone is GREEN AFTER update
      if (S.waterZone === 'GREEN'){
        S.streak++;
        S.streakMax = Math.max(S.streakMax, S.streak);

        if (S.streak > 0 && (S.streak % TUNE.streakStepBonus) === 0){
          S.score += TUNE.streakBonusPts;
          makePop('STREAK +', 'good');
          emit('hha:judge', { kind:'streak' });
        }
      } else {
        S.streak = 0;
      }

      // perfect timing: hit very late
      if (remainMs <= TUNE.perfectRemainMs){
        S.score += TUNE.perfectBonusPts;
        emit('hha:judge', { kind:'perfect' });
      } else {
        emit('hha:judge', { kind:'good' });
      }

      makePop('+GOOD', 'good');

      // splash FX (best effort)
      try{ Particles.burstAt && Particles.burstAt(xPct, yPct, 'WATER'); }catch{}
    }
    else if (kind === 'shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
      emit('hha:judge', { kind:'shield' });
      try{ Particles.burstAt && Particles.burstAt(xPct, yPct, 'SHIELD'); }catch{}
    }
    else { // bad
      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;
        makePop('BLOCK!', 'shield');
        emit('hha:judge', { kind:'block' });

        // mini condition: block in end-window
        if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
          S.miniState.blockedInEnd = true;
        }

        // boss block count
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
  }

  for (const e of els){
    e.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      onHit(ev);
    }, { passive:false });
  }

  // mount
  layer.appendChild(elMain);
  if (layerL && els[1]) layerL.appendChild(els[1]);
  if (layerR && els[2]) layerR.appendChild(els[2]);

  setTimeout(()=>kill('expire'), life);
  return { id, kind };
}

// ------------------ spawner loop ------------------
let spawnTimer = 0;

// deterministic storm schedule (seconds since start)
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

  // force water off-green a bit so mini is feasible
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

  // count storms evaluated
  S.stormMiniTried++;

  // evaluate storm mini
  let miniOk = false;
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    miniOk = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (miniOk){
      S.miniCleared++;
      S.stormMiniSuccess++;
      m.doneThisStorm = true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
    }
  }

  // boss result
  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm = true;
      S.miniCleared++;
      S.stormBossSuccess++;
      S.score += 45;
      makePop('BOSS ✓', 'shield');
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

// ------------------ drift (wind) ------------------
function updateDrift(dt){
  // drift stronger during storm, subtle otherwise
  const targetAmp = S.stormActive ? (diff==='hard' ? 26 : 22) : 7;
  const targetRot = S.stormActive ? (diff==='hard' ? 7 : 6) : 2;

  // phase speed depends on storm urgency
  const t = (now() - S.t0) / 1000;
  const sp = S.stormActive ? (S.inEndWindow ? 5.2 : 3.6) : 1.4;

  const wantX = Math.sin(t * sp) * targetAmp;
  const wantY = Math.cos(t * (sp * 0.88)) * (targetAmp * 0.62);
  const wantR = Math.sin(t * (sp * 0.72)) * targetRot;

  // smooth
  const k = S.stormActive ? 0.12 : 0.08;
  S.driftX += (wantX - S.driftX) * k;
  S.driftY += (wantY - S.driftY) * k;
  S.driftRot += (wantR - S.driftRot) * k;
}

// ------------------ HUD + events ------------------
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

  if (S.stormActive){
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText(elQuest3, `Storm Mini: LOW/HIGH + BLOCK (End Window)${bossTxt}`);
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
    stormInEndWindow: !!S.inEndWindow,

    // drift payload
    driftX: S.driftX,
    driftY: S.driftY,
    driftRot: S.driftRot
  });

  emit('hha:time', { left: S.leftSec|0 });

  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: 'Storm Timing',
    miniNow: (S.miniCleared|0),
    miniNeed: (S.miniCleared|0) + 1,
    miniLeftSec: S.stormActive ? S.stormLeftSec : 0,
    miniUrgent: S.stormActive && S.inEndWindow,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0
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
    if (elapsed >= nextStormAt && S.leftSec > (S.stormDur + 2)){
      enterStorm();
      stormIndex++;
      nextStormAt = (stormIndex + 1) * TUNE.stormEverySec;
    }
  } else {
    tickStorm(dt);
  }

  // wind drift
  updateDrift(dt);

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

  const grade = computeGrade();
  const acc = computeAccuracy();

  const storms = S.stormCycle|0;
  const ok = (S.stormMiniSuccess + S.stormBossSuccess)|0; // count as successes
  const rate = storms > 0 ? clamp((ok / storms) * 100, 0, 100) : 0;

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

    // ✅ added
    timeInGreenSec: Number(S.greenHold||0),
    streakMax: S.streakMax|0,
    stormCycles: storms,
    stormMiniSuccess: (S.stormMiniSuccess + S.stormBossSuccess)|0,
    stormSuccessRatePct: rate,

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

  // deterministic storm schedule
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