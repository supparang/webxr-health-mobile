// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION++ (Full package)
// ✅ Goal+Mini+Boss, deterministic research seed, cardboard dual-layer
// ✅ NEW: modes (focus/challenge/training/endless)
// ✅ NEW: Tier + Smart Summary Tips + Next Focus
// ✅ NEW: Export (Copy JSON / Download CSV)
// ✅ NEW: SFX (WebAudio beep) + gentle feedback
// ✅ NEW: Hold-to-confirm for Retry/BackHub
// ✅ NEW: Cardboard landscape lock best-effort
// ✅ NEW: AI Coach integration (template-based)

'use strict';

import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createAICoach } from '../vr/ai-coach.js';

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

// ------------------ config from URL ------------------
const diff = String(qs('diff','normal')).toLowerCase();               // easy/normal/hard
const run  = String(qs('run', qs('runMode','play'))).toLowerCase();   // play/research
const mode = String(qs('mode','play')).toLowerCase();                 // play/focus/challenge/training/endless

const timeLimitBase = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10) || 70, 20, 1200);
const timeLimit = (mode === 'endless') ? 9999 : timeLimitBase;

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

const cbPlayfield =
  DOC.getElementById('cb-playfield') ||
  DOC.getElementById('cbPlayfield') ||
  DOC.getElementById('cardboard-playfield') ||
  DOC.querySelector('.cb-playfield') ||
  DOC.querySelector('.cbPlayfield') ||
  DOC.getElementById('cb-left') || null;

function isCardboard(){
  try{ return DOC.body && DOC.body.classList.contains('cardboard'); }catch{ return false; }
}
function activeLayers(){
  if (isCardboard() && layerL && layerR) return [layerL, layerR];
  return [layerMain].filter(Boolean);
}
function activePlayfield(){
  if (isCardboard() && cbPlayfield) return cbPlayfield;
  return playfield || cbPlayfield;
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
const elTier  = DOC.getElementById('stat-tier');
const elMode  = DOC.getElementById('stat-mode');

const elQuest1 = DOC.getElementById('quest-line1');
const elQuest2 = DOC.getElementById('quest-line2');
const elQuest3 = DOC.getElementById('quest-line3');
const elQuest4 = DOC.getElementById('quest-line4');

const elStormLeft = DOC.getElementById('storm-left');
const elShieldCount = DOC.getElementById('shield-count');

// Controls
const btnShoot = DOC.getElementById('btnShoot');
const btnStop = DOC.getElementById('btnStop');
const btnCardboard = DOC.getElementById('btnCardboard');

// Summary UI
const resultBackdrop = DOC.getElementById('resultBackdrop');
const rScore = DOC.getElementById('rScore');
const rGrade = DOC.getElementById('rGrade');
const rAcc = DOC.getElementById('rAcc');
const rComboMax = DOC.getElementById('rComboMax');
const rMiss = DOC.getElementById('rMiss');
const rGoals = DOC.getElementById('rGoals');
const rMinis = DOC.getElementById('rMinis');
const rGreen = DOC.getElementById('rGreen');
const rStreak = DOC.getElementById('rStreak');
const rStormCycles = DOC.getElementById('rStormCycles');
const rStormOk = DOC.getElementById('rStormOk');
const rStormRate = DOC.getElementById('rStormRate');

const rTips = DOC.getElementById('rTips');
const rTier = DOC.getElementById('rTier');
const rNext = DOC.getElementById('rNext');

const btnRetry = DOC.getElementById('btnRetry');
const btnBackHub = DOC.getElementById('btnBackHub');
const btnCloseSummary = DOC.getElementById('btnCloseSummary');
const btnCopyJSON = DOC.getElementById('btnCopyJSON');
const btnDownloadCSV = DOC.getElementById('btnDownloadCSV');

// Start overlay (hide => start gate ends)
const startOverlay = DOC.getElementById('start-overlay') || DOC.getElementById('startOverlay');
const btnStart = DOC.getElementById('btnStart');

// ------------------ inject target styles ------------------
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

// ------------------ SFX (no asset needed) ------------------
const SFX = (() => {
  let ctx = null;
  let muted = (String(qs('mute','0')) === '1');

  function ensure(){
    if (muted) return null;
    if (!ctx){
      try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch{ ctx = null; }
    }
    return ctx;
  }

  function beep(freq=660, dur=0.06, vol=0.05){
    const ac = ensure();
    if (!ac) return;
    try{
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    }catch{}
  }

  return {
    unlock(){
      const ac = ensure();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume().catch(()=>{});
    },
    good(){ beep(740, 0.05, 0.05); },
    shield(){ beep(520, 0.06, 0.05); },
    bad(){ beep(220, 0.08, 0.06); },
    perfect(){ beep(980, 0.08, 0.06); beep(1220, 0.06, 0.05); },
    mini(){ beep(880, 0.08, 0.06); },
    end(){ beep(660, 0.10, 0.05); },
    setMuted(v){ muted = !!v; }
  };
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
  stormDur: 0,
  stormCycle: 0,

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

  adaptiveOn: (run !== 'research') && (mode !== 'training') && (mode !== 'focus'),
  adaptK: 0.0,

  mode,
  run,
  diff
};

// difficulty tuning
const TUNE = (() => {
  const sizeBase =
    diff === 'easy' ? 78 :
    diff === 'hard' ? 56 : 66;

  let spawnBase =
    diff === 'easy' ? 680 :
    diff === 'hard' ? 480 : 580;

  let stormEvery =
    diff === 'easy' ? 18 :
    diff === 'hard' ? 14 : 16;

  let stormDur =
    diff === 'easy' ? 5.2 :
    diff === 'hard' ? 6.2 : 5.8;

  // mode modifiers
  if (mode === 'focus'){
    spawnBase *= 1.25;
    stormEvery = 99999; // effectively off
    stormDur = 0;
  }
  if (mode === 'challenge'){
    spawnBase *= 0.86;
    stormEvery *= 0.85;
    stormDur *= 1.08;
  }
  if (mode === 'training'){
    spawnBase *= 1.05;
  }
  if (mode === 'endless'){
    stormEvery *= 0.95;
  }

  const g = clamp(
    Math.round((mode==='training'? timeLimitBase : timeLimitBase) * (diff==='easy' ? 0.42 : diff==='hard' ? 0.55 : 0.48)),
    18,
    Math.max(18, timeLimitBase-8)
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

    bossWindowSec: diff==='hard' ? 2.4 : 2.2
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;

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
function computeTier(sum){
  const g = String(sum.grade||'C');
  const acc = Number(sum.accuracyGoodPct||0);
  const miss = Number(sum.misses||0);
  const mini = Number(sum.miniCleared||0);

  if ((g==='SSS' || g==='SS') && acc >= 90 && miss <= 6 && mini >= 1) return 'Legend';
  if (g==='S' && acc >= 82 && miss <= 12) return 'Master';
  if (g==='A' && acc >= 70) return 'Expert';
  if (g==='B' || (acc >= 55 && miss <= 30)) return 'Skilled';
  return 'Beginner';
}
function buildTips(sum){
  const tips = [];
  const acc = Number(sum.accuracyGoodPct||0);
  const miss = Number(sum.misses||0);
  const green = Number(sum.greenHoldSec||0);
  const stormCycles = Number(sum.stormCycles||0);
  const minis = Number(sum.miniCleared||0);
  const wzGreenGoal = (sum.goalsCleared|0) >= 1;

  if (wzGreenGoal) tips.push('✅ คุม GREEN ได้ตามเป้าแล้ว (ดีมาก)');
  else tips.push('🎯 โฟกัส: ยิง 💧 ให้แม่นเพื่อดันน้ำเข้า GREEN แล้วคุมให้นิ่ง');

  if (stormCycles > 0 && minis <= 0){
    tips.push('🌀 MINI ยังไม่ผ่าน: ตอน STORM ต้อง “ทำให้น้ำเป็น LOW/HIGH” แล้วค่อย BLOCK ช่วงท้ายพายุ');
    tips.push('🛡️ เคล็ดลับ: เก็บ SHIELD ไว้ 1–2 ก่อน STORM เข้า');
  } else if (minis > 0){
    tips.push('🔥 MINI ผ่านแล้ว! ต่อไปลองท้าทาย: ผ่าน MINI ให้ได้ทุกพายุ');
  }

  if (miss >= 25) tips.push('💥 MISS เยอะ: ลดการรัว ยิงแบบ “จังหวะเดียว” จะคุมโซนง่ายขึ้น');
  if (acc < 60) tips.push('🎯 Accuracy ต่ำ: เล็งกลางจอก่อนค่อยยิง (อย่ากดถี่)');
  if (acc >= 80) tips.push('⚡ Accuracy ดีแล้ว! เพิ่มคอมโบจะดันเกรดขึ้นเร็วมาก');

  if (mode === 'training') tips.push('🧪 Training: รอบนี้เน้นเรียนรู้จังหวะ (คะแนนจะผ่อนลง)');
  if (mode === 'focus') tips.push('🧘 Focus: เหมาะสำหรับฝึกคุม GREEN แบบนิ่ง ๆ');
  if (mode === 'challenge') tips.push('⚔️ Challenge: STORM ถี่ขึ้น — เก็บ 🛡️ ให้เร็วขึ้น');

  // next focus (single)
  let next = 'คุม GREEN + ลด MISS';
  if (stormCycles > 0 && minis <= 0) next = 'ผ่าน MINI (LOW/HIGH + BLOCK ช่วงท้ายพายุ)';
  else if (acc < 70) next = 'เพิ่ม Accuracy ให้เกิน 70%';
  else if (miss > 15) next = 'ลด MISS ให้ต่ำกว่า 10';
  else next = 'ทำคอมโบยาว ๆ + ผ่าน MINI ทุกพายุ';

  return { tips, next };
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
    p.style.color = kind === 'good' ? 'rgba(34,197,94,.95)'
                  : kind === 'shield' ? 'rgba(34,211,238,.95)'
                  : 'rgba(239,68,68,.95)';
    L.appendChild(p);
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }catch{}
}

// ------------------ input throttle ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ spawn targets ------------------
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
      SFX.good();
      S.nHitGood++;

      // training mode: score softer
      const add = (mode === 'training') ? 6 : 10;
      S.score += add + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      if (S.streakGood > 0 && S.streakGood % 7 === 0){
        S.score += (mode === 'training') ? 6 : 12;
        makePop('STREAK!', 'good');
        emit('hha:judge', { kind:'streak' });
      } else {
        makePop('+GOOD', 'good');
        emit('hha:judge', { kind:'good' });
      }
    }
    else if (kind === 'shield'){
      SFX.shield();
      S.score += (mode === 'training') ? 3 : 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
      emit('hha:judge', { kind:'shield' });
    }
    else { // bad
      S.streakGood = 0;

      if (S.shield > 0){
        SFX.shield();
        S.shield--;
        S.nHitBadGuard++;
        S.score += (mode === 'training') ? 2 : 4;
        makePop('BLOCK!', 'shield');
        emit('hha:judge', { kind:'block' });

        if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
          S.miniState.blockedInEnd = true;

          if (S.waterZone !== 'GREEN'){
            SFX.perfect();
            S.score += (mode === 'training') ? 5 : 8;
            makePop('PERFECT!', 'shield');
            emit('hha:judge', { kind:'perfect' });
          }
        }

        if (isBossBad){
          S.bossBlocked++;
        }
      } else {
        SFX.bad();
        S.nHitBad++;
        S.misses++;
        S.combo = 0;
        if (mode !== 'training') S.score = Math.max(0, S.score - 6);
        pushWaterBad();
        makePop('BAD!', 'bad');
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
  return clamp(base, 210, 1400);
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

  // training: safer distribution
  if (mode === 'training'){
    pBad = Math.max(0.18, pBad - 0.08);
    pGood = Math.min(0.74, pGood + 0.06);
    pSh = 1 - (pGood + pBad);
  }

  const r = rng();
  if (r < pSh) return 'shield';
  if (r < pSh + pBad) return 'bad';
  return 'good';
}

// ------------------ storm + mini logic ------------------
function enterStorm(){
  if (TUNE.stormEverySec >= 9999) return; // focus mode
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

  if (S.waterZone === 'GREEN'){
    S.waterPct = clamp(S.waterPct + (rng() < 0.5 ? -7 : +7), 0, 100);
    updateZone();
  }

  emit('hha:coach', { mood:'neutral', text:'STORM มาแล้ว! เตรียมทำ MINI 🌀', sub:'ทำให้น้ำเป็น LOW/HIGH แล้วค่อย BLOCK ช่วงท้าย' });
  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
      m.doneThisStorm = true;
      if (mode !== 'training') S.score += 35;
      makePop('MINI ✓', 'shield');
      SFX.mini();
      emit('hha:coach', { mood:'happy', text:'MINI ผ่านแล้ว! 🔥', sub:'รอบหน้าลองผ่านให้ได้ทุกพายุ' });
    }
  }

  if (!S.bossDoneThisStorm){
    if (S.bossBlocked >= S.bossNeed){
      S.bossDoneThisStorm = true;
      S.miniCleared++;
      if (mode !== 'training') S.score += 45;
      makePop('BOSS ✓', 'shield');
      SFX.mini();
      emit('hha:coach', { mood:'happy', text:'BOSS ผ่าน! โคตรโหด! ⚡', sub:'จังหวะ BLOCK ของคุณดีมาก' });
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

// ------------------ AI Coach integration ------------------
const AICOACH = createAICoach({
  game:'hydration',
  cooldownMs: clamp(parseInt(qs('coachCd', 3200),10) || 3200, 1200, 12000),
  emit
});
function buildCoachCtx(){
  const acc = computeAccuracy()/100;
  const miss = S.misses|0;

  // simple proxies
  const frustration = clamp((miss/25) * (1 - acc), 0, 1);
  const fatigue = clamp(((now()-S.t0)/1000) / 120, 0, 1);

  return {
    skill: clamp(acc*0.75 + clamp(S.combo/20,0,1)*0.25, 0, 1),
    fatigue,
    frustration,
    inStorm: !!S.stormActive,
    inEndWindow: !!S.inEndWindow,
    waterZone: S.waterZone,
    shield: S.shield|0,
    misses: miss,
    combo: S.combo|0
  };
}

// ------------------ HUD sync ------------------
function syncHUD(){
  const grade = computeGrade();
  const acc = computeAccuracy();

  setText(elScore, S.score|0);
  setText(elCombo, S.combo|0);
  setText(elMiss, S.misses|0);
  setText(elTime, (mode==='endless') ? '∞' : (S.leftSec|0));
  setText(elGrade, grade);

  setText(elShieldCount, S.shield|0);
  setText(elStormLeft, S.stormActive ? (S.stormLeftSec|0) : 0);

  const goalNeed = S.greenTarget|0;
  setText(elQuest1, `คุม GREEN ให้ครบ ${goalNeed}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${goalNeed}s`);

  if (S.stormActive){
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText(elQuest3, `Storm Mini: LOW/HIGH + BLOCK (ท้ายพายุ)${bossTxt}`);
  } else {
    setText(elQuest3, (TUNE.stormEverySec>=9999) ? `โหมด Focus: ไม่มี STORM` : `รอ STORM แล้วค่อยทำ Mini`);
  }

  const m = S.miniState;
  setText(
    elQuest4,
    S.stormActive
      ? `Mini: zone=${m.zoneOK?'OK':'NO'} pressure=${m.pressureOK?'OK':'..'} end=${m.endWindow?'YES':'..'} block=${m.blockedInEnd?'YES':'..'}`
      : `State: เก็บคะแนน + สะสม Shield`
  );

  // Tier display (live, approximate)
  const liveSum = { grade, accuracyGoodPct: acc, misses:S.misses, miniCleared:S.miniCleared };
  const tier = computeTier(liveSum);
  setText(elTier, `Tier: ${tier}`);
  setText(elMode, `Mode: ${mode}`);

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
    stormLeftSec: S.stormLeftSec
  });

  emit('hha:time', { left: (mode==='endless') ? 9999 : (S.leftSec|0) });

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

  // AI coach update (throttled by ai-coach itself)
  if (S.started && !S.ended){
    AICOACH.onUpdate(buildCoachCtx());
  }
}

// ------------------ end logging (optional) ------------------
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

// ------------------ Summary tools ------------------
function toCSVRow(obj){
  const keys = Object.keys(obj);
  const esc = (v)=> {
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const header = keys.join(',');
  const row = keys.map(k=>esc(obj[k])).join(',');
  return header + '\n' + row + '\n';
}
function downloadText(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      try{ URL.revokeObjectURL(a.href); }catch{}
      try{ a.remove(); }catch{}
    }, 50);
  }catch{}
}
async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    // fallback
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    }catch{}
  }
  return false;
}
function showSummary(sum){
  if (!resultBackdrop) return;
  try{ resultBackdrop.hidden = false; }catch{}

  setText(rScore, sum.scoreFinal|0);
  setText(rGrade, sum.grade);
  setText(rAcc, `${Number(sum.accuracyGoodPct||0).toFixed(1)}%`);
  setText(rComboMax, sum.comboMax|0);
  setText(rMiss, sum.misses|0);
  setText(rGoals, `${sum.goalsCleared|0}/${sum.goalsTotal|0}`);
  setText(rMinis, `${sum.miniCleared|0}/${sum.miniTotal|0}`);
  setText(rGreen, `${Number(sum.greenHoldSec||0).toFixed(1)}s`);
  setText(rStreak, sum.streakMax|0);
  setText(rStormCycles, sum.stormCycles|0);
  setText(rStormOk, sum.miniCleared|0);
  setText(rStormRate, `${Number(sum.stormRatePct||0).toFixed(0)}%`);

  const tier = computeTier(sum);
  const { tips, next } = buildTips(sum);

  setText(rTier, `Tier: ${tier}`);
  setText(rNext, `Next Focus: ${next}`);
  setText(rTips, tips.map(t=>`• ${t}`).join('\n'));

  // Coach end line
  AICOACH.onEnd(sum);
}
function hideSummary(){
  try{ resultBackdrop.hidden = true; }catch{}
}

// Hold-to-confirm
function bindHold(btn, fn, holdMs=650){
  if (!btn) return;
  let t0 = 0;
  let timer = null;
  function clear(){
    if (timer){ clearTimeout(timer); timer=null; }
    t0 = 0;
    btn.classList.remove('holding');
  }
  btn.addEventListener('pointerdown', (ev)=>{
    try{ ev.preventDefault(); }catch{}
    SFX.unlock();
    btn.classList.add('holding');
    t0 = performance.now();
    timer = setTimeout(()=>{
      clear();
      fn();
    }, holdMs);
  }, { passive:false });
  btn.addEventListener('pointerup', clear, { passive:true });
  btn.addEventListener('pointercancel', clear, { passive:true });
  btn.addEventListener('mouseleave', clear, { passive:true });
}

// ------------------ main loop ------------------
function update(dt){
  if (!S.started || S.ended) return;

  if (mode !== 'endless'){
    S.leftSec = Math.max(0, S.leftSec - dt);
  }

  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  const elapsed = (now() - S.t0) / 1000;

  // deterministic storm schedule
  if (!S.stormActive){
    if (elapsed >= nextStormAt && (mode==='endless' || S.leftSec > (S.stormDur + 2))){
      if (TUNE.stormEverySec < 9999){
        enterStorm();
        stormIndex++;
        nextStormAt = (stormIndex + 1) * TUNE.stormEverySec;
      }
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

  if (mode !== 'endless' && S.leftSec <= 0.0001){
    endGame('timeup');
  }
}

async function endGame(reason){
  if (S.ended) return;
  S.ended = true;
  SFX.end();

  const grade = computeGrade();
  const acc = computeAccuracy();

  const summary = {
    timestampIso: qs('timestampIso', new Date().toISOString()),
    projectTag: qs('projectTag', 'HeroHealth'),
    runMode: run,
    sessionId: sessionId || '',
    gameMode: 'hydration',
    diff,
    mode,
    durationPlannedSec: timeLimitBase,
    durationPlayedSec: timeLimitBase,

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
    streakMax: S.streakMax|0,

    stormCycles: S.stormCycle|0,
    stormSuccess: (S.miniCleared|0),
    stormRatePct: clamp(((S.miniCleared|0) / Math.max(1, S.stormCycle|0)) * 100, 0, 100),

    greenHoldSec: S.greenHold,

    reason: reason || 'end'
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    localStorage.setItem('hha_last_summary', JSON.stringify(summary));
  }catch{}

  emit('hha:end', summary);
  await sendLog(summary);

  showSummary(summary);
}

// ------------------ start gating ------------------
async function waitStartGate(){
  if (!startOverlay) return;

  const isHidden = () => {
    const cs = getComputedStyle(startOverlay);
    return (cs.display === 'none' || cs.visibility === 'hidden' || startOverlay.hidden);
  };
  if (isHidden()) return;

  await new Promise((resolve)=>{
    const mo = new MutationObserver(()=>{
      if (!startOverlay.isConnected || isHidden()){
        try{ mo.disconnect(); }catch{}
        resolve();
      }
    });
    mo.observe(startOverlay, { attributes:true, attributeFilter:['style','class','hidden'] });
    setTimeout(()=>{
      try{ mo.disconnect(); }catch{}
      resolve();
    }, 25000);
  });
}

// ------------------ Cardboard UX: fullscreen + landscape lock best-effort ------------------
function setCardboard(on){
  const pf = DOC.getElementById('playfield');
  const cb = DOC.getElementById('cb-playfield');
  if (!pf || !cb) return;
  if (on){
    DOC.body.classList.add('cardboard');
    cb.hidden = false;
    pf.hidden = true;
  } else {
    DOC.body.classList.remove('cardboard');
    cb.hidden = true;
    pf.hidden = false;
  }
}
async function enterFullscreen(){
  try{
    const el = DOC.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch{}
}
async function lockLandscape(){
  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch{}
}

// ------------------ init ------------------
async function boot(){
  const pf = activePlayfield();
  if (!pf || !activeLayers().length){
    console.warn('[Hydration] missing playfield or layers', {
      playfield: !!playfield,
      cbPlayfield: !!cbPlayfield,
      layerMain: !!layerMain,
      layerL: !!layerL,
      layerR: !!layerR
    });
    return;
  }

  // UI init
  ensureWaterGauge();
  setWaterGauge(S.waterPct);
  updateZone();

  // mode labels
  setText(elMode, `Mode: ${mode}`);

  // start overlay button unlock audio
  btnStart?.addEventListener('click', ()=>{ SFX.unlock(); }, { passive:true });

  // Controls
  btnShoot?.addEventListener('click', ()=>{
    SFX.unlock();
    // simulate shoot: pick nearest target? (simple: spawn a "hit" by clicking crosshair is complex)
    // Here: we just encourage tap on targets. Button remains for UX consistency.
    emit('hha:coach', { mood:'neutral', text:'แตะ/ยิงที่เป้า 💧🛡️🥤', sub:'Tip: ยิงแบบไม่รัว จะคุมโซนง่ายขึ้น' });
  }, { passive:true });

  btnStop?.addEventListener('click', ()=>{
    SFX.unlock();
    if (!S.ended) endGame('stop');
  }, { passive:true });

  btnCardboard?.addEventListener('click', async ()=>{
    SFX.unlock();
    const on = !isCardboard();
    setCardboard(on);
    if (on){
      await enterFullscreen();
      await lockLandscape();
      emit('hha:coach', { mood:'happy', text:'Cardboard ON ✅', sub:'หมุนเครื่องเป็นแนวนอน แล้วเล่นได้เลย' });
    } else {
      emit('hha:coach', { mood:'neutral', text:'Cardboard OFF', sub:'กลับสู่โหมดปกติ' });
    }
  }, { passive:true });

  // Summary buttons
  btnCloseSummary?.addEventListener('click', hideSummary, { passive:true });

  bindHold(btnRetry, ()=>{
    try{
      const u = new URL(location.href);
      u.searchParams.set('ts', String(Date.now()));
      location.href = u.toString();
    }catch{
      location.reload();
    }
  }, 650);

  bindHold(btnBackHub, ()=>{
    try{
      location.href = hub;
    }catch{}
  }, 650);

  btnCopyJSON?.addEventListener('click', async ()=>{
    try{
      const raw = localStorage.getItem('HHA_LAST_SUMMARY') || localStorage.getItem('hha_last_summary') || '';
      if (!raw) return;
      await copyToClipboard(raw);
      makePop('COPIED!', 'shield');
      SFX.shield();
    }catch{}
  }, { passive:true });

  btnDownloadCSV?.addEventListener('click', ()=>{
    try{
      const raw = localStorage.getItem('HHA_LAST_SUMMARY') || localStorage.getItem('hha_last_summary') || '';
      if (!raw) return;
      const obj = JSON.parse(raw);
      const csv = toCSVRow(obj);
      downloadText(`hydration_${(obj.sessionId||'session')}_${Date.now()}.csv`, csv, 'text/csv');
      makePop('CSV ✓', 'good');
      SFX.good();
    }catch{}
  }, { passive:true });

  // Prepare spawner
  spawnTimer = 320;

  // Gate start (overlay hide)
  await waitStartGate();

  // AI coach start line
  AICOACH.onStart();

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