// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR — PRODUCTION
// ✅ Emits: hha:score, hha:time, quest:update, hha:judge, hha:coach, hha:storm, hha:boss, hha:end
// ✅ Research: run=research => adaptive OFF + deterministic seed + deterministic storm schedule + deterministic side-quest chain
// ✅ Logging: ?log=<WEB_APP_EXEC_URL> => POST JSON on end (รองรับไว้ได้)
// ✅ PATCH 23: Cardboard/Glassboard -> spawn+rehoming targets into #hvr-layerL/#hvr-layerR (fix black screen + missing targets)
// ✅ PATCH 24: Quest chain 1–3 (Side quests) + boss announce event
// ✅ PATCH 25: Heat system (realtime tension) + target motion/FX (CSS inject)
// ✅ PATCH 26: Hydration Coach persona + image mood mapping (./img/coach-*.png)
// ✅ PATCH 27: flush-hardened end triggers (pagehide, backhub, etc.)

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
function safeText(x){ return String(x ?? '').slice(0, 260); }

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
const layerMain = DOC.getElementById('hvr-layer');

// Cardboard layers
const layerL = DOC.getElementById('hvr-layerL');
const layerR = DOC.getElementById('hvr-layerR');
const cbPlayfieldL = DOC.getElementById('cbPlayfieldL');
const cbPlayfieldR = DOC.getElementById('cbPlayfieldR');
const cbPlayfield = cbPlayfieldL || cbPlayfieldR || DOC.querySelector('.cbPlayfield') || DOC.querySelector('.cb-playfield') || null;

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

// ------------------ (5) Inject styles: target motion/FX ------------------
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
    transform: translate(-50%,-50%) translate3d(0,0,0) rotate(0deg) scale(1);
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
    will-change: transform, filter, opacity, left, top;
    animation: hvrFloat 1.35s ease-in-out infinite;
    animation-delay: calc(var(--ph,0) * -1s);
  }
  @keyframes hvrFloat{
    0%{ transform: translate(-50%,-50%) translate3d(-1.2px, 0px, 0) rotate(-.6deg) scale(0.995); }
    50%{ transform: translate(-50%,-50%) translate3d( 1.2px,-1.6px,0) rotate( .6deg) scale(1.01); }
    100%{ transform: translate(-50%,-50%) translate3d(-1.2px, 0px, 0) rotate(-.6deg) scale(0.995); }
  }
  .hvr-target.good{ outline: 2px solid rgba(34,197,94,.18); }
  .hvr-target.bad { outline: 2px solid rgba(239,68,68,.18); animation-name:hvrFloat,hvrBadWobble; animation-duration:1.35s,.55s; animation-iteration-count:infinite,infinite; }
  .hvr-target.shield{ outline: 2px solid rgba(34,211,238,.18); filter:saturate(1.05); box-shadow: 0 18px 60px rgba(0,0,0,.45), 0 0 16px rgba(34,211,238,.10); }
  @keyframes hvrBadWobble{
    0%{ filter: saturate(1.05) contrast(1.05); }
    50%{ filter: saturate(1.22) contrast(1.10); }
    100%{ filter: saturate(1.05) contrast(1.05); }
  }
  .hvr-target.bossbad{
    outline: 2px dashed rgba(239,68,68,.38);
    box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 26px rgba(239,68,68,.14);
    filter: saturate(1.15) contrast(1.06);
    animation-name: hvrFloat, hvrBossPulse;
    animation-duration: 1.1s, .38s;
    animation-iteration-count: infinite, infinite;
  }
  @keyframes hvrBossPulse{
    0%{ transform: translate(-50%,-50%) scale(0.98); }
    50%{ transform: translate(-50%,-50%) scale(1.04); }
    100%{ transform: translate(-50%,-50%) scale(0.98); }
  }
  .hvr-target.hit{
    animation: hvrHit .16s ease-out 1 !important;
  }
  @keyframes hvrHit{
    0%{ transform: translate(-50%,-50%) scale(1.00); filter:brightness(1.0); }
    100%{ transform: translate(-50%,-50%) scale(1.14); filter:brightness(1.22); }
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

  // mini conditions (storm mini)
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

  // Boss mini (ท้ายพายุ)
  bossActive:false,
  bossNeed: 2,
  bossBlocked: 0,
  bossDoneThisStorm:false,
  bossWindowSec: 2.2,
  bossAnnounced:false,

  // (5) heat system 0..1
  heat: 0,
  heatMax: 1,

  adaptiveOn: (run !== 'research'),
  adaptK: 0.0,

  // (4) Side quest chain 1–3
  sideIndex: 0,
  sideQuest: null,   // {id,title,now,need,deadline,active,done,fail}
  sideDone: 0
};

// difficulty tuning (faster + tighter)
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

  const bossNeed =
    diff === 'easy' ? 1 :
    diff === 'hard' ? 3 : 2;

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

    bossWindowSec: diff==='hard' ? 2.4 : 2.2,
    bossNeed,

    // heat dynamics
    heatUpBad: diff==='hard' ? 0.11 : 0.09,
    heatUpMiss: diff==='hard' ? 0.08 : 0.065,
    heatDownGood: 0.022,
    heatDownTick: 0.010,
  };
})();

S.greenTarget = TUNE.greenTargetSec;
S.endWindowSec = TUNE.endWindowSec;
S.stormDur = TUNE.stormDurSec;
S.bossWindowSec = TUNE.bossWindowSec;
S.bossNeed = TUNE.bossNeed;

// expose (optional)
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

// ------------------ Coach (5) persona ------------------
let lastCoachAt = 0;
function coach(mood, text, sub=''){
  const t = now();
  if (t - lastCoachAt < 220) return;
  lastCoachAt = t;
  emit('hha:coach', { mood, text: safeText(text), sub: safeText(sub) });
}
function coachStart(){
  coach('neutral', 'พร้อมแล้ว! ยิง 💧 ให้เข้า GREEN แล้วรักษาให้นิ่ง 🟢', 'Tip: เก็บ 🛡️ ไว้ใช้ตอนท้ายพายุ');
}
function coachOnGood(){
  if (S.streakGood === 6) coach('happy', 'โฟลว์มาแล้ว! อีกนิดจะได้ STREAK โบนัส ✨', 'คุมจังหวะ อย่ารีบกดมั่ว');
  else if (S.waterZone === 'GREEN' && S.greenHold > 1.5) coach('happy', 'ดีมาก! GREEN สะสมขึ้นเรื่อย ๆ 🟢', 'ตอนพายุอย่าอยู่ GREEN นะ');
}
function coachOnBad(){
  coach('sad', 'โอ๊ะ! BAD ทำให้น้ำเสียสมดุล 😵', 'เก็บ 🛡️ กันพลาด + เล็งให้ชัวร์');
}
function coachOnStormEnter(){
  coach('fever', 'STORM มาแล้ว! ตอนนี้ต้องทำ Mini ให้ผ่าน 🌀', 'ให้น้ำ LOW/HIGH แล้ว BLOCK ช่วงท้าย!');
}
function coachOnBossEnter(){
  coach('fever', 'BOSS WINDOW! 🌩️ ล็อกเป้า BAD แล้ว BLOCK ให้ครบ!', `ต้อง BLOCK 🌩️ ≥ ${S.bossNeed}`);
}
function coachOnSideStart(){
  if (!S.sideQuest) return;
  coach('neutral', `Side Quest: ${S.sideQuest.title}`, S.sideQuest.deadline ? `เหลือ ${S.sideQuest.deadline.toFixed(0)}s` : '');
}
function coachOnSideDone(){
  coach('happy', 'Side Quest สำเร็จ! +โบนัส ✨', 'ไปด่านต่อเลย!');
}
function coachOnSideFail(){
  coach('sad', 'Side Quest พลาด… ไม่เป็นไร ไปอันถัดไป!', 'ลองเล่นนิ่ง ๆ แล้วทำตามจังหวะ');
}

// ------------------ (4) Side Quest chain (1–3) ------------------
function buildSidePool(){
  // deterministic: สำหรับ research ให้เรียงตาม seed (ผ่าน rng)
  // play: จะใช้ rng เหมือนกันแต่ adaptive จะปรับความต้องการนิดหน่อย
  const base = [
    { id:'shield2', title:'เก็บ 🛡️ 2 อัน ภายในเวลา', need:2, dur: diff==='easy'?10: (diff==='hard'?7:8) },
    { id:'streak8', title:'ยิง 💧 ติดต่อกัน (ห้ามพลาด)', need: diff==='easy'?6:(diff==='hard'?10:8), dur: 0 },
    { id:'nobad6',  title:'ห้ามโดน 🥤 (BAD) ภายในเวลา', need:1, dur: diff==='easy'?7:(diff==='hard'?9:8) },
  ];

  // shuffle by rng deterministic
  for (let i=base.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    const t = base[i]; base[i]=base[j]; base[j]=t;
  }
  return base;
}

const SIDE_POOL = buildSidePool();

function startNextSide(){
  if (S.ended) return;
  if (S.sideIndex >= SIDE_POOL.length){
    S.sideQuest = null;
    return;
  }
  const def = SIDE_POOL[S.sideIndex++];
  const q = {
    id: def.id,
    title: def.title,
    now: 0,
    need: def.need,
    deadline: def.dur ? def.dur : 0,
    active: true,
    done: false,
    fail: false,
    // for streak quest
    streakNow: 0,
    // for nobad timer
    tNoBad: 0,
  };

  // adaptive (play only): ถ้าเล่นเก่ง -> เพิ่มความต้องการนิด
  if (S.adaptiveOn && run !== 'research'){
    const acc = computeAccuracy()/100;
    if (acc > 0.86 && def.id === 'shield2') q.need = Math.min(3, q.need+1);
    if (acc > 0.90 && def.id === 'streak8') q.need = q.need + 1;
  }

  S.sideQuest = q;
  coachOnSideStart();
}

function updateSide(dt){
  const q = S.sideQuest;
  if (!q || !q.active || q.done || q.fail) return;

  if (q.deadline > 0){
    q.deadline = Math.max(0, q.deadline - dt);
    if (q.deadline <= 0.0001){
      q.fail = true; q.active = false;
      coachOnSideFail();
      startNextSide();
    }
  }

  // nobad timer: แค่ “อยู่รอด” ตามเวลา ถ้าโดน bad -> fail
  if (q.id === 'nobad6'){
    q.now = 1; // แสดงว่า active อยู่
  }
}

function sideOnGood(){
  const q = S.sideQuest;
  if (!q || !q.active || q.done || q.fail) return;

  if (q.id === 'streak8'){
    q.streakNow++;
    q.now = q.streakNow;
    if (q.streakNow >= q.need){
      q.done = true; q.active = false;
      S.sideDone++;
      S.score += 22;
      makePop('SIDE ✓', 'good');
      coachOnSideDone();
      startNextSide();
    }
  }
}

function sideOnShield(){
  const q = S.sideQuest;
  if (!q || !q.active || q.done || q.fail) return;

  if (q.id === 'shield2'){
    q.now++;
    if (q.now >= q.need){
      q.done = true; q.active = false;
      S.sideDone++;
      S.score += 22;
      makePop('SIDE ✓', 'good');
      coachOnSideDone();
      startNextSide();
    }
  }
}

function sideOnBadHit(){
  const q = S.sideQuest;
  if (!q || !q.active || q.done || q.fail) return;

  if (q.id === 'nobad6'){
    q.fail = true; q.active = false;
    coachOnSideFail();
    startNextSide();
  }
  if (q.id === 'streak8'){
    // streak quest แค่ reset (ไม่ fail ทันที)
    q.streakNow = 0;
    q.now = 0;
  }
}

// ------------------ water dynamics ------------------
function updateZone(){
  S.waterZone = zoneFrom(S.waterPct);

  // body class for UI gauge
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
  const r = pf ? pf.getBoundingClientRect() : { width: 1, height: 1 };

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

  // heat: ยิ่งร้อน ยิ่งเล็ก/ไว
  const heatK = clamp(S.heat, 0, 1);
  s *= (1.00 - 0.10*heatK);

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

// ------------------ input sanity ------------------
let lastHitAt = 0;
const HIT_COOLDOWN_MS = 55;

// ------------------ target lifecycle (dual-eye + rehome-ready) ------------------
let UID = 1;
function spawn(kind){
  if (S.ended) return;

  const layers = activeLayers();
  if (!layers.length) return;

  const { xPct, yPct } = pickXY();
  const s = targetSize();

  const isBossBad = (kind === 'bad' && S.bossActive);
  const uid = String(UID++);

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
    el.dataset.uid = uid;
    if (isBossBad) el.dataset.boss = '1';

    el.style.setProperty('--x', xPct.toFixed(2) + '%');
    el.style.setProperty('--y', yPct.toFixed(2) + '%');
    el.style.setProperty('--s', s.toFixed(0) + 'px');
    el.style.setProperty('--ph', (rng()*1.4).toFixed(2));

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
        S.heat = clamp(S.heat + TUNE.heatUpMiss, 0, 1);
      }
    }
  }

  function onHit(){
    if (killed || S.ended) return;

    const t = performance.now();
    if (t - lastHitAt < HIT_COOLDOWN_MS) return;
    lastHitAt = t;

    // tiny hit FX
    for (const n of nodes){ try{ n.classList.add('hit'); }catch{} }
    setTimeout(()=>{ for (const n of nodes){ try{ n.classList.remove('hit'); }catch{} } }, 140);

    kill('hit');

    if (kind === 'good'){
      S.nHitGood++;
      S.score += 10 + Math.min(15, (S.combo|0));
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      nudgeWaterGood();

      S.streakGood++;
      S.streakMax = Math.max(S.streakMax, S.streakGood);

      // heat down
      S.heat = clamp(S.heat - TUNE.heatDownGood, 0, 1);

      if (S.streakGood > 0 && S.streakGood % 7 === 0){
        S.score += 12;
        makePop('STREAK!', 'good');
        emit('hha:judge', { kind:'streak' });
      } else {
        makePop('+GOOD', 'good');
        emit('hha:judge', { kind:'good' });
      }
      sideOnGood();
      coachOnGood();
    }
    else if (kind === 'shield'){
      S.score += 6;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.shield = clamp(S.shield + 1, 0, S.shieldMax);
      makePop('+SHIELD', 'shield');
      emit('hha:judge', { kind:'shield' });

      // heat down slightly
      S.heat = clamp(S.heat - 0.010, 0, 1);

      sideOnShield();
    }
    else { // bad
      S.streakGood = 0;

      if (S.shield > 0){
        S.shield--;
        S.nHitBadGuard++;
        S.score += 4;
        makePop('BLOCK!', 'shield');
        emit('hha:judge', { kind:'block' });

        // mini condition: block in end-window
        if (S.stormActive && S.inEndWindow && !S.miniState.doneThisStorm){
          S.miniState.blockedInEnd = true;

          if (S.waterZone !== 'GREEN'){
            S.score += 8;
            makePop('PERFECT!', 'shield');
            emit('hha:judge', { kind:'perfect' });
          }
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

        // heat up
        S.heat = clamp(S.heat + TUNE.heatUpBad, 0, 1);
        coachOnBad();

        // side quest impact
        sideOnBadHit();
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

// ------------------ (2) Rehome targets on layer mode switch ------------------
function rehomeTargets(toCardboard){
  if (!layerMain && !(layerL && layerR)) return;

  const all = [];
  if (layerMain) all.push(...layerMain.querySelectorAll('.hvr-target'));
  if (layerL) all.push(...layerL.querySelectorAll('.hvr-target'));
  if (layerR) all.push(...layerR.querySelectorAll('.hvr-target'));

  // group by uid if exists; fallback treat as unique
  const map = new Map();
  for (const el of all){
    const uid = el.dataset.uid || (el.dataset.uid = String(UID++));
    if (!map.has(uid)) map.set(uid, []);
    map.get(uid).push(el);
  }

  if (toCardboard){
    if (!(layerL && layerR)) return;

    for (const [uid, nodes] of map.entries()){
      // keep a template
      const t = nodes[0];
      const kind = t.dataset.kind || 'good';
      const clsBoss = t.classList.contains('bossbad');
      const x = t.style.getPropertyValue('--x') || '50%';
      const y = t.style.getPropertyValue('--y') || '50%';
      const s = t.style.getPropertyValue('--s') || '64px';
      const ph = t.style.getPropertyValue('--ph') || '0';

      // ensure L node
      const hasL = nodes.some(n => n.parentElement === layerL);
      const hasR = nodes.some(n => n.parentElement === layerR);

      function makeClone(){
        const el = DOC.createElement('div');
        el.className = `hvr-target ${kind}` + (clsBoss ? ' bossbad' : '');
        el.dataset.kind = kind;
        el.dataset.uid = uid;
        if (clsBoss) el.dataset.boss = '1';
        el.style.setProperty('--x', x);
        el.style.setProperty('--y', y);
        el.style.setProperty('--s', s);
        el.style.setProperty('--ph', ph);

        el.textContent =
          (kind === 'good') ? '💧' :
          (kind === 'shield') ? '🛡️' :
          (clsBoss ? '🌩️' : '🥤');

        // click hook: dispatch pointerdown to itself (so handler works)
        el.addEventListener('pointerdown', (ev)=>{
          try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
          // bubble to existing logic: we reuse same handler by triggering click-style
          // easiest: simulate direct hit by dispatching on itself (no external needed)
          // (spawn already binds), here we just let it be interactive:
          // We can't share old handler, so we must bind minimal:
          // -> dispatch "hvr:rehit" then main listener below will capture?
        }, { passive:false });

        return el;
      }

      // IMPORTANT: We need the same onHit logic; easiest is: when cloning,
      // route pointerdown to the "first existing node" if still alive.
      // We'll do that by storing "uid router".
      // (See uidRouter map below)
      if (!uidRouter.has(uid)) uidRouter.set(uid, { alive:true });
      // the spawn binder attaches router handler later (below)
      // We'll bind a generic handler:
      const bindRouter = (el)=>{
        el.addEventListener('pointerdown', (ev)=>{
          try{
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.pointerType === 'touch' && ev.isPrimary === false) return;
          }catch{}
          const r = uidRouter.get(uid);
          if (r && r.hit) r.hit();
        }, { passive:false });
      };

      if (!hasL){
        const c = makeClone();
        bindRouter(c);
        layerL.appendChild(c);
      }
      if (!hasR){
        const c = makeClone();
        bindRouter(c);
        layerR.appendChild(c);
      }

      // remove main nodes to avoid double-vision mismatch
      for (const n of nodes){
        if (n.parentElement === layerMain){
          try{ n.remove(); }catch{}
        }
      }
    }
  } else {
    // to main: keep one node in main, remove L/R duplicates
    if (!layerMain) return;

    for (const [uid, nodes] of map.entries()){
      let keep = nodes.find(n => n.parentElement === layerMain) || nodes[0];
      if (keep.parentElement !== layerMain){
        // move to main
        try{ layerMain.appendChild(keep); }catch{}
      }
      for (const n of nodes){
        if (n !== keep && (n.parentElement === layerL || n.parentElement === layerR)){
          try{ n.remove(); }catch{}
        }
      }
    }
  }
}

// Router for rehomed clones: uid -> hit() of original target instance
const uidRouter = new Map();

// When we spawn, we must register router hit() for that uid to call the actual onHit.
// We'll do that by hooking inside spawn: we can’t reach onHit from outside after creation,
// so we register router before returning by capturing closure. We do it here with a wrapper:
const _spawn = spawn;
spawn = function(kind){
  const node = _spawn(kind);
  // node might be null
  if (node && node.dataset && node.dataset.uid){
    const uid = node.dataset.uid;
    // find all nodes created by this spawn: in activeLayers they share uid.
    // bind router to call the actual pointerdown on the first node (it has real handler)
    const router = uidRouter.get(uid) || {};
    router.alive = true;
    router.hit = ()=>{
      // dispatch pointerdown on node (real handler lives there)
      try{
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true }));
      }catch{}
    };
    uidRouter.set(uid, router);
  }
  return node;
};

// listen layer mode switch from HTML
window.addEventListener('hha:layer_mode', (ev)=>{
  const d = ev.detail || {};
  rehomeTargets(!!d.cardboard);
}, { passive:true });

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

  // heat makes faster
  const heatK = clamp(S.heat, 0, 1);
  base *= (1.00 - 0.22 * heatK);

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

  // heat: เพิ่ม bad นิด ๆ เพื่อกดดัน
  const heatK = clamp(S.heat, 0, 1);
  pBad += 0.03 * heatK;
  pGood -= 0.03 * heatK;

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
  S.bossAnnounced = false;

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

  emit('hha:storm', { state:'enter', cycle:S.stormCycle|0 });
  coachOnStormEnter();
  syncHUD();
}

function exitStorm(){
  S.stormActive = false;
  S.stormLeftSec = 0;
  S.inEndWindow = false;

  // storm mini evaluate
  if (!S.miniState.doneThisStorm){
    const m = S.miniState;
    const ok = !!(m.zoneOK && m.pressureOK && m.endWindow && m.blockedInEnd);
    if (ok){
      S.miniCleared++;
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

    // (4) boss announce once per storm
    if (!S.bossAnnounced){
      S.bossAnnounced = true;
      emit('hha:boss', { state:'enter', need:S.bossNeed|0 });
      emit('hha:judge', { kind:'boss' });
      coachOnBossEnter();
    }
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

  // PC/Mobile quest lines
  setText(elQuest1, `คุม GREEN ให้ครบ ${S.greenTarget|0}s (สะสม)`);
  setText(elQuest2, `GREEN: ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`);

  // storm mini
  if (S.stormActive){
    const bossTxt = S.bossActive ? ` • BOSS 🌩️ ${S.bossBlocked}/${S.bossNeed}` : '';
    setText(elQuest3, `Storm Mini: LOW/HIGH + BLOCK (ท้ายพายุ)${bossTxt}`);
  } else {
    setText(elQuest3, `รอ Storm แล้วค่อยทำ Mini`);
  }

  // side quest
  const q = S.sideQuest;
  if (q && q.active){
    const left = q.deadline ? ` • ${q.deadline.toFixed(0)}s` : '';
    const prog = (q.id === 'nobad6') ? 'ห้ามโดน BAD' : `${q.now}/${q.need}`;
    setText(elQuest4, `Side: ${q.title} • ${prog}${left}`);
  } else if (S.sideDone >= SIDE_POOL.length){
    setText(elQuest4, `Side: เคลียร์ครบแล้ว ✅`);
  } else {
    setText(elQuest4, `Side: เตรียมด่านถัดไป…`);
  }

  setWaterGauge(S.waterPct);

  // score event (HTML ใช้สำหรับ VR HUD)
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

    // drift placeholders (ถ้าอยากต่อกับ cinematic)
    driftX: 0, driftY: 0, driftRot: 0,

    // heat (debug/ต่อยอดได้)
    heat: S.heat
  });

  emit('hha:time', { left: S.leftSec|0 });

  // quest:update แบบ “ข้อความพร้อมแสดง”
  const goalLine1 = `Goal: GREEN Control`;
  const goalLine2 = `GREEN ${(S.greenHold).toFixed(1)} / ${(S.greenTarget).toFixed(0)}s`;

  const miniLine3 = S.stormActive
    ? `Storm: ${S.stormLeftSec.toFixed(0)}s • ${S.inEndWindow?'⚠️END':'…'} • block=${S.miniState.blockedInEnd?'YES':'..'}`
    : `Storm: waiting…`;

  let sideLine4 = 'Side: —';
  if (q && q.active){
    const left = q.deadline ? ` (${q.deadline.toFixed(0)}s)` : '';
    if (q.id === 'nobad6') sideLine4 = `Side: No BAD${left}`;
    else sideLine4 = `Side: ${q.title} • ${q.now}/${q.need}${left}`;
  } else if (S.sideDone >= SIDE_POOL.length) sideLine4 = 'Side: cleared ✅';

  emit('quest:update', { goalLine1, goalLine2, miniLine3, sideLine4 });
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

  // heat cool down slowly over time (ถ้าไม่โดนกดดัน)
  S.heat = clamp(S.heat - TUNE.heatDownTick * dt, 0, 1);

  if (S.waterZone === 'GREEN'){
    S.greenHold += dt;
  }

  // side quest tick (เมื่อไม่อยู่ storm ก็ยังทำได้)
  updateSide(dt);

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

  const grade = computeGrade();
  const acc = computeAccuracy();

  // storm success count: นับเฉพาะ mini ที่ผ่านใน storm (เราเพิ่ม miniCleared รวม boss ด้วย)
  // แยกสองตัว: stormMiniSuccess = จำนวน storm cycle ที่เคลียร์ mini เงื่อนไขครบ (ไม่รวม boss)
  // แต่โค้ดเดิมไม่ได้เก็บแยก => ทำแบบ simple: miniCleared ทั้งหมด
  const stormMiniSuccess = (S.miniCleared|0);
  const stormSuccessRatePct = clamp((stormMiniSuccess / Math.max(1, S.stormCycle|0)) * 100, 0, 100);

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

    sideCleared: S.sideDone|0,
    sideTotal: SIDE_POOL.length|0,

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
    stormMiniSuccess,
    stormSuccessRatePct,

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

  // (4) start side quest chain
  startNextSide();

  coachStart();
  syncHUD();

  function raf(t){
    if (S.ended) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - S.lastTick)/1000));
    S.lastTick = t;
    update(dt);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // (6) flush-hardened end triggers
  window.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) endGame('hidden');
  }, { passive:true });

  window.addEventListener('pagehide', ()=>{
    if (!S.ended) { try{ endGame('pagehide'); }catch{} }
  }, { passive:true });

  window.addEventListener('beforeunload', ()=>{
    if (!S.ended) { try{ endGame('unload'); }catch{} }
  });

  window.addEventListener('hha:force_end', (ev)=>{
    const d = ev.detail || {};
    if (!S.ended) endGame(d.reason || 'force');
  }, { passive:true });
}

boot().catch(err=>console.error('[Hydration] boot error', err));