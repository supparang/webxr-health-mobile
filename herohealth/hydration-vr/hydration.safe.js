// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION (DOM Engine + WaterGauge + Shield + Storm Mini + Boss Mini + Research Logging)
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:storm, hha:end
// ✅ Play: adaptive ON + storm mini "นุ่มขึ้น" (ผ่านได้จริง แต่ยังโหด)
// ✅ Research: adaptive OFF + deterministic seed + deterministic storm schedule (คงเดิม)
// ✅ Logging: ?log=<WEB_APP_EXEC_URL> => POST JSON on end
// ✅ Mini counters: stormCycles / stormMiniSuccess / bossMiniSuccess
// ✅ Summary: TimeInGreen + StreakMax + StormRate (ถูกต้อง)
// ✅ FX: storm-clear / boss-clear (ส่งผ่าน hha:judge)

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

// optional Particles hook
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){ } };

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
    outline: 2px dashed rgba(239,68,68,.40);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 22px rgba(239,68,68,.12);
    filter: saturate(1.1) contrast(1.06);
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

  // ✅ goal: time in GREEN
  timeInGreen: 0,          // seconds
  greenTarget: 0,

  // ✅ streak bonus (GREEN continuous)
  greenStreak: 0,
  streakMax: 0,
  lastZoneWasGreen: false,

  // ✅ storm
  stormActive:false,
  stormLeftSec:0,
  stormDur: 0,
  stormCycles: 0,

  // windows
  endWindowSec: 1.55,       // ✅ play-friendly (research still deterministic schedule, not this)
  inEndWindow:false,

  // mini results
  stormMiniSuccess: 0,
  bossMiniSuccess: 0,

  // ----- mini conditions (storm mini) -----
  miniState: {
    inStorm:false,
    zoneOK:false,           // off-green (LOW/HIGH)
    pressure:0,
    pressureOK:false,
    endWindow:false,
    blockedInEnd:false,
    doneThisStorm:false,
  },

  // ----- Boss mini (ท้าย Storm): ต้อง BLOCK boss-bad >= bossNeed -----
  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 3.0,       // ✅ play-friendly

  // adaptive
  adaptiveOn: (run !== 'research'),
  adaptK: 0.0,

  // cinematic drift outputs (fed to HTML)
  driftX:0, driftY:0, driftRot:0
};

// difficulty tuning (game feel)
const TUNE = (() => {
  const sizeBase =
    diff === 'easy' ? 80 :
    diff === 'hard' ? 56 : 66;

  const spawnBase =
    diff === 'easy' ? 700 :
    diff === 'hard' ? 500 : 600;

  const stormEvery =
    diff === 'easy' ? 18 :
    diff === 'hard' ? 14 : 16;

  const stormDur =
    diff === 'easy' ? 5.6 :
    diff === 'hard' ? 6.4 : 6.0;

  const g = clamp(
    Math.round(timeLimit * (diff==='easy' ? 0.40 : diff==='hard' ? 0.55 : 0.48)),
    18,
    Math.max(18, timeLimit-8)
  );

  return {
    sizeBase,
    spawnBaseMs: spawnBase,
    spawnJitter: 170,

    goodLifeMs: diff==='hard' ? 950 : 1100,
    badLifeMs:  diff==='hard' ? 1000 : 1150,
    shieldLifeMs: 1400,

    stormEverySec: stormEvery,
    stormDurSec: stormDur,
    endWindowSec: (run==='research') ? 1.20 : 1.55,

    stormSpawnMul: diff==='hard' ? 0.58 : 0.66,

    nudgeToMid: 5.0,
    badPush:    8.2,
    missPenalty: 1,

    greenTargetSec: g,

    bossWindowSec: (run==='research')
      ? (diff==='hard' ? 2.4 : 2.2)
      : (diff==='hard' ? 2.9 : 3.0)
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

// expose for HTML cinematic driver
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
  const mini = S.stormMiniSuccess|0;
  const boss = S.bossMiniSuccess|0;

  // ✅ grade ที่คุณต้องการ SSS, SS, S, A, B, C
  if (acc >= 95 && miss <= 2 && (mini >= 1 || boss >= 1)) return 'SSS';
  if (acc >= 90 && miss <= 4) return 'SS';
  if (acc >= 82) return 'S';
  if (acc >= 70) return 'A';
  if (acc >= 55) return 'B';
  return 'C';
}

function stormRatePct(){
  const denom = Math.max(1, S.stormCycles|0);
  return clamp((S.stormMiniSuccess / denom) * 100, 0, 100);
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
  setText(elQuest2, `GREEN: ${(S.timeInGreen).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s • StreakMax: ${S.streakMax|0}`);

  if (S.stormActive){
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : ` • Boss✓ ${S.bossMiniSuccess|0}`;
    setText(elQuest3, `Storm Mini: LOW/HIGH + BLOCK (ท้ายพายุ) • Mini✓ ${S.stormMiniSuccess|0}/${S.stormCycles|0}${bossTxt}`);
  } else {
    setText(elQuest3, `รอ Storm แล้วทำ Mini (Mini✓ ${S.stormMiniSuccess|0}/${S.stormCycles|0} • Boss✓ ${S.bossMiniSuccess|0})`);
  }

  const m = S.miniState;
  setText(
    elQuest4,
    S.stormActive
      ? `Mini: zone=${m.zoneOK?'OK':'..'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
      : `State: เก็บ Shield แล้วคุม GREEN (Space/ปุ่ม SHOOT ยิงกลางจอ)`
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

    stormCycles: S.stormCycles|0,
    stormMiniSuccess: S.stormMiniSuccess|0,
    bossMiniSuccess: S.bossMiniSuccess|0,

    // cinematic drift
    driftX: S.driftX, driftY: S.driftY, driftRot: S.driftRot
  });

  emit('hha:time', { left: S.leftSec|0 });

  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.timeInGreen, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.timeInGreen >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: 'Storm Mini',
    miniNow: (S.stormMiniSuccess|0),
    miniNeed: Math.max(1, (S.stormMiniSuccess|0) + 1),
    miniLeftSec: S.stormActive ? S.stormLeftSec : 0,
    miniUrgent: S.stormActive && S.inEndWindow,
    miniCleared: S.stormMiniSuccess|0,
    miniTotal: Math.max(1, (S.stormCycles|0))  // ✅ ไม่ใช้ 999 แล้ว (แสดงผลไม่งง)
  });
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

// ------------------ spawn math (center bias + margins) ------------------
function pickXY(){
  const r = playfield.getBoundingClientRect();
  const pad = 22;
  const w = Math.max(1, r.width - pad*2);
  const h = Math.max(1, r.height - pad*2);

  // bell-ish distribution
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
    const c = clamp(S.combo/18, 0, 1);
    const k = clamp((acc*0.7 + c*0.3), 0, 1);
    S.adaptK = k;
    s = s * (1.04 - 0.22*k);
  }

  if (S.stormActive) s *= (diff==='hard' ? 0.80 : 0.84);
  return clamp(s, 44, 88);
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
                  : kind === 'boss' ? 'rgba(168,85,247,.95)'
                  : 'rgba(239,68,68,.95)';
    layer.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

// ------------------ input sanity / anti-spam ------------------
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

    kill('hit');

    // small splash / burst (best effort)
    try{ Particles.burstAt?.(50, 50, kind); }catch{}

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(18, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // ✅ GREEN streak bonus (ถ้าอยู่ GREEN ต่อเนื่อง)
      if (S.waterZone === 'GREEN'){
        S.score += 1; // เบาๆ
      }

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
        S.score += 5;
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

// deterministic storm schedule (seconds since start)
let nextStormAt = 0;
let stormIndex = 0;

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;

  if (S.adaptiveOn){
    base *= (1.00 - 0.26 * S.adaptK);
  }
  if (S.stormActive){
    base *= TUNE.stormSpawnMul;
  }

  return clamp(base, 220, 1250);
}

function pickKind(){
  let pGood = 0.66;
  let pBad  = 0.28;
  let pSh   = 0.06;

  if (S.stormActive){
    pGood = 0.54;
    pBad  = 0.34;
    pSh   = 0.12;

    if (S.bossActive){
      pBad  += 0.10;
      pGood -= 0.10;
    }
  }
  if (diff === 'hard'){
    pBad += 0.05;
    pGood -= 0.05;
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
  S.stormCycles++;

  // signal HTML for intro
  emit('hha:storm', { state:'enter', cycle: S.stormCycles|0 });
  emit('hha:judge', { kind:'storm-in' });

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
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -8 : +8), 0, 100);
    updateZone();
  }

  syncHUD();
}

function evaluateStormMini(){
  const m = S.miniState;

  // ✅ เกมจริง: Play โหมด “นุ่มขึ้น”
  // - zoneOK: ต้องอยู่ LOW/HIGH สักครั้งใน storm
  // - pressureOK: ไม่ต้องเต็ม 1.0 เสมอ (play >= 0.80 ก็พอ)
  // - endWindow: เข้า end window จริง
  // - blockedInEnd: ต้องมี block ตอนท้าย (หรือมี boss block อย่างน้อย 1 ใน end window)

  const pressurePass = (run === 'research')
    ? !!m.pressureOK
    : (m.pressureOK || m.pressure >= 0.80);

  const blockPass = (run === 'research')
    ? !!m.blockedInEnd
    : (!!m.blockedInEnd || (S.bossBlocked >= 1 && m.endWindow));

  const ok = !!(m.zoneOK && pressurePass && m.endWindow && blockPass);
  return ok;
}

function evaluateBossMini(){
  if (S.bossDoneThisStorm) return true;
  return (S.bossBlocked >= S.bossNeed);
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // ✅ storm mini result
  if (!S.miniState.doneThisStorm){
    const ok = evaluateStormMini();
    if (ok){
      S.miniState.doneThisStorm = true;
      S.stormMiniSuccess++;
      S.score += 40;
      makePop('STORM ✓', 'shield');
      emit('hha:judge', { kind:'storm-clear' });
      try{ Particles.celebrate?.('goal'); }catch{}
    }
  }

  // ✅ boss mini result
  if (!S.bossDoneThisStorm){
    if (evaluateBossMini()){
      S.bossDoneThisStorm = true;
      S.bossMiniSuccess++;
      S.score += 55;
      makePop('BOSS ✓', 'boss');
      emit('hha:judge', { kind:'boss-clear' });
      try{ Particles.celebrate?.('mini'); }catch{}
    }
  }

  S.bossActive = false;

  emit('hha:storm', { state:'exit', cycle: S.stormCycles|0 });
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

  const zoneOK = (S.waterZone !== 'GREEN'); // LOW/HIGH
  if (zoneOK) S.miniState.zoneOK = true;

  // ✅ pressure fill (play เร็วขึ้น)
  const pGain = zoneOK ? (run==='research' ? 0.50 : 0.62) : (run==='research' ? 0.24 : 0.30);
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

  // ✅ time in GREEN + streak tracking
  const isGreen = (S.waterZone === 'GREEN');
  if (isGreen){
    S.timeInGreen += dt;
    S.greenStreak += dt;
    if (S.greenStreak > 2.2){
      // เบาๆ ให้รู้สึกว่ามีรางวัล
      if ((S.greenStreak % 1.2) < dt){
        S.score += 2;
        emit('hha:judge', { kind:'streak' });
        makePop('STREAK +2', 'good');
      }
    }
  } else {
    S.greenStreak = 0;
  }
  if (isGreen && !S.lastZoneWasGreen){
    // enter green -> perfect-ish cue (เล็กๆ)
    if (S.combo >= 8) emit('hha:judge', { kind:'perfect' });
  }
  S.lastZoneWasGreen = isGreen;
  S.streakMax = Math.max(S.streakMax, Math.floor(S.greenStreak * 10) / 10);

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

    // ✅ drift: ทำให้รู้สึกมีลม (ส่งค่าให้ HTML)
    const wob = Math.sin(elapsed * 2.7) * 5.5;
    const wob2 = Math.cos(elapsed * 2.1) * 4.8;
    const rot = Math.sin(elapsed * 1.6) * 1.8;
    const k = S.inEndWindow ? 1.25 : 1.0;
    S.driftX = wob * k;
    S.driftY = wob2 * k;
    S.driftRot = rot * k;
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

    goalsCleared: (S.timeInGreen >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    // ✅ replaced confusing 0/999
    stormCycles: S.stormCycles|0,
    stormMiniSuccess: S.stormMiniSuccess|0,
    bossMiniSuccess: S.bossMiniSuccess|0,
    stormSuccessRatePct: stormRatePct(),

    timeInGreenSec: Number(S.timeInGreen || 0),
    streakMax: Number(S.streakMax || 0),

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

  // init deterministic storm schedule
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