// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION v2 (STORM patterns + Perfect chain + Fair penalty/bonus)
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:storm, hha:end
// ✅ Research: run=research => adaptive OFF + deterministic seed + deterministic storm schedule
// ✅ Cardboard spawn: targets into #hvr-layerL/#hvr-layerR
// ✅ NEW: storm patterns per cycle (fast/long/boss heavy/breath)
// ✅ NEW: perfect chain in end-window (x score + shield drip)
// ✅ NEW: fair penalty scaling in end-window (but reward for skill)

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

// HUD nodes (normal)
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

// inject target styles
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

  .hvr-target.bossbad{
    outline: 2px dashed rgba(239,68,68,.48);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 26px rgba(239,68,68,.14);
    filter: saturate(1.25) contrast(1.10);
    animation: bossPulse .38s linear infinite;
  }
  @keyframes bossPulse{
    0%{ transform: translate(-50%,-50%) scale(1.00); }
    50%{ transform: translate(-50%,-50%) scale(1.07); }
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

  // NEW: pattern params per storm
  stormPatternName: 'normal',
  stormSpawnMul: 1.0,
  endWindowSec: 1.2,
  inEndWindow:false,

  // mini state (per storm)
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

  // boss mini
  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,

  // NEW: perfect chain (ท้ายพายุ)
  perfectChain: 0,
  perfectMax: 0,
  perfectShieldGranted: 0, // กันแจกถี่
  perfectWindowArmed:false,

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

    // base end-window (จะถูก pattern override)
    endWindowSecBase: 1.2,

    // base storm spawn mul (จะถูก pattern override)
    stormSpawnMulBase: diff==='hard' ? 0.56 : 0.64,

    nudgeToMid: 5.0,
    badPush:    8.0,
    missPenalty: 1,

    greenTargetSec: g,

    bossWindowSec: diff==='hard' ? 2.45 : 2.2
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSecBase;
S.bossWindowSec = TUNE.bossWindowSec;

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
  try{
    const b = DOC.body;
    b.classList.toggle('water-low',  S.waterZone === 'LOW');
    b.classList.toggle('water-green',S.waterZone === 'GREEN');
    b.classList.toggle('water-high', S.waterZone === 'HIGH');
  }catch{}
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
      'rgba(239,68,68,.95)';
    L.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

// ------------------ anti-spam ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ STORM PATTERNS (NEW) ------------------
// deterministic pattern chooser by stormCycle + seed
function chooseStormPattern(cycleIndex){
  // 4 patterns: fast / long / boss-heavy / breath
  // ใช้ rng แบบ deterministic: ผูกกับ seed + cycleIndex
  const rr = makeRng(seed + '|storm|' + cycleIndex);
  const r = rr();

  // base
  let name = 'normal';
  let spawnMul = TUNE.stormSpawnMulBase;
  let dur = TUNE.stormDurSec;
  let endWin = TUNE.endWindowSecBase;
  let bossWin = S.bossWindowSec;
  let bossNeed = (diff === 'hard') ? 3 : 2;

  if (r < 0.22){
    name = 'fast';
    dur *= 0.86;
    spawnMul *= 0.84;     // เป้าโผล่ถี่ขึ้น
    endWin = Math.max(1.0, endWin * 0.92);
    bossWin *= 0.92;
    bossNeed = (diff === 'hard') ? 3 : 2;
  }
  else if (r < 0.48){
    name = 'long';
    dur *= 1.16;
    spawnMul *= 0.74;     // โผล่ถี่ขึ้นในพายุยาว
    endWin = Math.min(1.45, endWin * 1.10);
    bossWin *= 1.10;
    bossNeed = (diff === 'hard') ? 4 : 3;
  }
  else if (r < 0.76){
    name = 'boss-heavy';
    dur *= 1.02;
    spawnMul *= 0.78;
    endWin = Math.min(1.50, endWin * 1.12);
    bossWin *= 1.18;
    bossNeed = (diff === 'hard') ? 4 : 3;
  }
  else {
    name = 'breath';
    dur *= 0.98;
    spawnMul *= 0.92;     // ไม่ถี่มาก ให้หายใจได้
    endWin = Math.max(1.1, endWin);
    bossWin *= 1.00;
    bossNeed = (diff === 'hard') ? 3 : 2;
  }

  // clamp
  dur = clamp(dur, 4.2, 7.8);
  spawnMul = clamp(spawnMul, 0.44, 0.95);
  endWin = clamp(endWin, 1.0, 1.6);
  bossWin = clamp(bossWin, 1.7, 3.2);
  bossNeed = clamp(bossNeed, 2, 5) | 0;

  return { name, dur, spawnMul, endWin, bossWin, bossNeed };
}

// ------------------ perfect chain (NEW) ------------------
function resetPerfect(reason=''){
  S.perfectChain = 0;
  S.perfectWindowArmed = false;
  S.perfectShieldGranted = 0;
}
function bumpPerfect(){
  S.perfectChain++;
  S.perfectMax = Math.max(S.perfectMax, S.perfectChain);

  // reward: score multiplier-ish (flat bonus) + combo push
  const bonus = 6 + Math.min(22, S.perfectChain * 4);
  S.score += bonus;
  S.combo += 1;
  S.comboMax = Math.max(S.comboMax, S.combo);

  if (S.perfectChain === 2){
    makePop('PERFECT x2!', 'shield');
    emit('hha:judge', { kind:'perfect' });
  } else if (S.perfectChain === 3){
    makePop('PERFECT x3!', 'shield');
    emit('hha:judge', { kind:'perfect' });
  } else if (S.perfectChain >= 4){
    makePop('PERFECT 🔥', 'shield');
    emit('hha:judge', { kind:'perfect' });
  }

  // shield drip: แจกไม่ถี่เกิน (แฟร์)
  if (S.shield < S.shieldMax){
    const want = (S.perfectChain >= 3 && S.perfectShieldGranted === 0) ||
                 (S.perfectChain >= 5 && S.perfectShieldGranted === 1);
    if (want){
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      S.perfectShieldGranted++;
      makePop('+SHIELD (PERF)', 'shield');
      emit('hha:judge', { kind:'shield' });
    }
  }
}

// ------------------ target lifecycle ------------------
function spawn(kind){
  if (S.ended) return;

  const layers = activeLayers();
  if (!layers.length) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossBad = (kind === 'bad' && S.bossActive);

  if (kind === 'good') S.nGoodSpawn++;
  if (kind === 'bad') S.nBadSpawn++;
  if (kind === 'shield') S.nShieldSpawn++;

  const life =
    kind === 'good' ? TUNE.goodLifeMs :
    kind === 'shield' ? TUNE.shieldLifeMs :
    TUNE.badLifeMs;

  let killed = false;
  const nodes = [];

  function buildNode(){
    const el = DOC.createElement('div');
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

        // แฟร์: ถ้าพลาดช่วงท้ายพายุ รีเซ็ต perfect
        if (S.stormActive && S.inEndWindow) resetPerfect('expire-good');
      }
    }
  }

  function onHit(){
    if (killed || S.ended) return;

    const t = performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt = t;

    kill('hit');

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      // ระหว่างท้ายพายุ ถ้ากำลังทำ perfect window, ยิง good ไม่รีเซ็ต
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
      S.streakGood = 0;

      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;

        // boss block
        if (isBossBad){
          S.bossBlocked++;
          makePop('BOSS BLOCK!', 'boss');
          emit('hha:judge', { kind:'bossblock' });
        } else {
          makePop('BLOCK!', 'shield');
          emit('hha:judge', { kind:'block' });
        }

        // ---- PERFECT WINDOW: ท้ายพายุ (NEW)
        if (S.stormActive && S.inEndWindow){
          // arm window เมื่อเข้า end window แล้วค่อย chain
          if (!S.perfectWindowArmed) S.perfectWindowArmed = true;

          // เงื่อนไข perfect: ตอน block ต้องอยู่ LOW หรือ HIGH (ไม่ใช่ GREEN)
          if (S.waterZone !== 'GREEN'){
            bumpPerfect();
          } else {
            // ถ้า GREEN ถือว่าไม่ perfect แต่ไม่ลงโทษหนัก แค่ไม่ chain
            resetPerfect('green-block');
          }

          // mini condition: block in end-window
          if (!S.miniState.doneThisStorm){
            S.miniState.blockedInEnd = true;
          }
        } else {
          // block นอก end window รีเซ็ต perfect
          resetPerfect('block-outside');
        }
      } else {
        // ---- FAIR PENALTY: ท้ายพายุเจ็บขึ้น (NEW)
        S.nHitBad++;
        const endPenalty = (S.stormActive && S.inEndWindow) ? 2 : 1;
        S.misses += endPenalty;
        S.combo = 0;
        S.score = Math.max(0, S.score - (S.stormActive && S.inEndWindow ? 10 : 6));

        // ช่วงท้ายพายุ bad push แรงขึ้นเล็กน้อย
        pushWaterBad(S.stormActive && S.inEndWindow ? 1.25 : 1.0);

        // ท้ายพายุโดน bad = รีเซ็ต perfect แน่ ๆ
        if (S.stormActive && S.inEndWindow) resetPerfect('bad-hit-end');

        makePop((S.stormActive && S.inEndWindow) ? 'BAD!!' : 'BAD!', 'bad');
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

function nextSpawnDelay(){
  let base = TUNE.spawnBaseMs + (rng()*2-1)*TUNE.spawnJitter;

  if (S.adaptiveOn){
    base *= (1.00 - 0.25 * S.adaptK);
  }
  if (S.stormActive){
    base *= (S.stormSpawnMul); // ✅ ใช้ pattern mul
  }
  return clamp(base, 210, 1200);
}

function pickKind(){
  // base mix
  let pGood = 0.66;
  let pBad  = 0.28;
  let pSh   = 0.06;

  if (S.stormActive){
    pGood = 0.52;
    pBad  = 0.38;
    pSh   = 0.10;

    // boss heavy => เพิ่ม bad
    if (S.stormPatternName === 'boss-heavy'){
      pBad += 0.06; pGood -= 0.06;
    }

    // end window => เพิ่ม shield เล็กน้อย (แฟร์)
    if (S.inEndWindow){
      pSh += 0.04; pGood -= 0.02; pBad -= 0.02;
    }
  }

  if (diff === 'hard'){
    pBad += 0.04;
    pGood -= 0.04;
  }

  // clamp
  pGood = Math.max(0.30, pGood);
  pBad  = Math.max(0.18, pBad);
  pSh   = Math.max(0.04, pSh);

  const sum = pGood + pBad + pSh;
  pGood/=sum; pBad/=sum; pSh/=sum;

  const r = rng();
  if (r < pSh) return 'shield';
  if (r < pSh + pBad) return 'bad';
  return 'good';
}

// ------------------ storm + mini logic ------------------
function enterStorm(){
  S.stormActive = true;

  // ✅ apply pattern
  const P = chooseStormPattern(S.stormCycle + 1);
  S.stormPatternName = P.name;
  S.stormLeftSec = P.dur;
  S.stormSpawnMul = P.spawnMul;
  S.endWindowSec = P.endWin;
  S.bossWindowSec = P.bossWin;
  S.bossNeed = P.bossNeed;

  S.stormCycle++;

  S.miniState = {
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

  resetPerfect('enter-storm');

  // force water off-green a bit
  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  emit('hha:storm', { state:'enter', pattern: S.stormPatternName });
  emit('hha:judge', { kind:'storm-in' });
  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // evaluate storm mini
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
      m.doneThisStorm = true;
      S.score += 35;
      makePop('MINI ✓', 'shield');
      emit('hha:judge', { kind:'mini-pass' });
    }
  }

  // boss result
  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm = true;
      S.miniCleared++;
      S.score += 45;
      makePop('BOSS ✓', 'boss');
      emit('hha:judge', { kind:'boss-pass' });
    }
  }

  S.bossActive = false;
  resetPerfect('exit-storm');
  syncHUD();
}

function tickStorm(dt){
  if (!S.stormActive) return;

  S.stormLeftSec = Math.max(0, S.stormLeftSec - dt);

  const inEnd = (S.stormLeftSec <= (S.endWindowSec + 0.02));
  S.inEndWindow = inEnd;
  S.miniState.endWindow = inEnd;

  // boss active in last bossWindowSec
  const inBoss = (S.stormLeftSec <= (S.bossWindowSec + 0.02));
  S.bossActive = !!(inBoss && !S.bossDoneThisStorm);

  // mini: zone must be non-green at least once
  const zoneOK = (S.waterZone !== 'GREEN');
  if (zoneOK) S.miniState.zoneOK = true;

  // pressure accumulates faster when in end window (เพิ่มความเดือด)
  const pGain = zoneOK ? (inEnd ? 0.72 : 0.50) : (inEnd ? 0.32 : 0.24);
  S.miniState.pressure = clamp(S.miniState.pressure + dt * pGain, 0, 1);
  if (S.miniState.pressure >= 1) S.miniState.pressureOK = true;

  // end window but no perfect action for too long => reset chain
  if (!inEnd) {
    resetPerfect('not-end-window');
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
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    const pTxt = (S.inEndWindow && S.perfectWindowArmed) ? ` • PERFECT x${S.perfectChain}` : '';
    setText(elQuest3, `Storm (${S.stormPatternName})${bossTxt}${pTxt}`);
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

    // checklist flags
    miniZoneOK: !!m.zoneOK,
    miniPressureOK: !!m.pressureOK,
    miniEndWindow: !!m.endWindow,
    miniBlockedInEnd: !!m.blockedInEnd,
    bossActive: !!S.bossActive,
    bossBlocked: S.bossBlocked|0,
    bossNeed: S.bossNeed|0,

    // perfect info (optional debug UI ใช้ได้)
    perfectChain: S.perfectChain|0,
    perfectMax: S.perfectMax|0,

    driftX: 0, driftY: 0, driftRot: 0
  });

  emit('hha:time', { left: S.leftSec|0 });

  emit('quest:update', {
    goalTitle: 'GREEN Control',
    goalNow: Math.min(S.greenHold, S.greenTarget),
    goalNeed: S.greenTarget,
    goalsCleared: (S.greenHold >= S.greenTarget) ? 1 : 0,
    goalsTotal: 1,

    miniTitle: 'Storm Shield Timing',
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
let spawnTimer = 0;
let nextStormAt = 0;
let stormIndex = 0;

function update(dt){
  if (!S.started || S.ended) return;

  S.leftSec = Math.max(0, S.leftSec - dt);

  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  const elapsed = (now() - S.t0) / 1000;

  // storm schedule (deterministic)
  if (!S.stormActive){
    if (elapsed >= nextStormAt && S.leftSec > (TUNE.stormDurSec + 2)){
      enterStorm();
      stormIndex++;
      nextStormAt = (stormIndex + 1) * TUNE.stormEverySec;
    }
  } else {
    tickStorm(dt);
  }

  // spawns
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

  // mini planned: 2 per storm (storm + boss)
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

    nHitGood: S.nHitGood|0,
    nHitJunk: S.nHitBad|0,
    nHitJunkGuard: S.nHitBadGuard|0,
    nExpireGood: S.nExpireGood|0,

    accuracyGoodPct: acc,
    grade,
    streakMax: S.streakMax|0,

    timeInGreenSec: Number(S.greenHold||0),

    stormCycles: S.stormCycle|0,
    stormMiniSuccess: (S.miniCleared|0),
    stormSuccessRatePct: clamp(((S.miniCleared|0) / Math.max(1, S.miniPlanned|0)) * 100, 0, 100),

    // NEW metrics
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