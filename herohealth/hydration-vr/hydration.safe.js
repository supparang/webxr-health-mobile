/* === /herohealth/hydration-vr/hydration.safe.js ===
HydrationVR — PRODUCTION FINAL (P0+P1 + HHA Standard FINAL ++ 1–12)

✅ 1) Goals as stages (1/3,2/3,3/3) + celebration + ALL GOALS
✅ 2) Storm mini fail state: hit BAD in end-window without shield => reset mini progress
   + mini count requires End-window AND pressure>=thr (align checklist)
✅ 3) Adaptive difficulty (play mode only): spawnEveryMs / ttl / badBias adjust live

✅ 4) Fix Water gauge “stuck at 50” (prevent dead-lock at mean) + deterministic micro-overshoot
✅ 5) Fair spawn: anti “all red” (bad streak guard + pity-good) + shield spacing
✅ 6) Spawn spread: min-distance + center-bias + safe padding by orb size (no edge clump)

✅ 7) Storm phase: early/mid/end -> bias + cinematic pacing
✅ 8) End-window CINEMATIC: tick accel + stronger edge flash + body class endwindow
✅ 9) Mini card show only warn/storm + checklist YES/NO + bad state highlight

✅ 10) Hit FX always (Particles if present + fallback burst)
✅ 11) Metrics: RT good (avg/median) + fastHitRate + nBlock + nBlockCounted
✅ 12) End summary standard fields + gameVersion + HHA_LAST_SUMMARY + Back HUB

Audio allowed: beep + tick + thunder only
*/

'use strict';

// ------------------------- helpers -------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
function now(){ return performance.now(); }
function qs(){ return new URLSearchParams(location.search); }
function pick(q, k, d){ const v = q.get(k); return (v==null || v==='') ? d : v; }
function num(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
function $(id){ return DOC.getElementById(id); }
function safeText(el, s){ if(el) el.textContent = String(s ?? ''); }
function safeClass(el, cls, on){ if(!el) return; el.classList.toggle(cls, !!on); }

// ------------------------- seeded RNG (deterministic-ish) -------------------------
function makeRng(seed){
  let s = (seed >>> 0) || 0x12345678;
  return function rng(){
    s = (1664525 * s + 1013904223) >>> 0;
    return (s / 4294967296);
  };
}
function hashStrToU32(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ------------------------- HHA event emitter + throttles -------------------------
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function pickContextFromURL(){
  const q = qs();
  const ctx = {
    projectTag: 'hydration',
    runMode: String(pick(q,'run', pick(q,'runMode','play'))),
    studyId: String(pick(q,'studyId','')),
    phase: String(pick(q,'phase','')),
    conditionGroup: String(pick(q,'conditionGroup','')),
    sessionOrder: String(pick(q,'sessionOrder','')),
    blockLabel: String(pick(q,'blockLabel','')),
    siteCode: String(pick(q,'siteCode','')),
    schoolYear: String(pick(q,'schoolYear','')),
    semester: String(pick(q,'semester','')),
    sessionId: String(pick(q,'sessionId','')),
    gameMode: 'hydration',
    diff: String(pick(q,'diff','normal')),
    durationPlannedSec: num(pick(q,'time', pick(q,'durationPlannedSec', 70)), 70),

    // optional student profile
    studentKey: String(pick(q,'studentKey','')),
    schoolCode: String(pick(q,'schoolCode','')),
    schoolName: String(pick(q,'schoolName','')),
    classRoom: String(pick(q,'classRoom','')),
    studentNo: String(pick(q,'studentNo','')),
    nickName: String(pick(q,'nickName','')),
    gender: String(pick(q,'gender','')),
    age: String(pick(q,'age','')),
    gradeLevel: String(pick(q,'gradeLevel','')),
    heightCm: String(pick(q,'heightCm','')),
    weightKg: String(pick(q,'weightKg','')),
    bmi: String(pick(q,'bmi','')),
    bmiGroup: String(pick(q,'bmiGroup','')),
    vrExperience: String(pick(q,'vrExperience','')),
    gameFrequency: String(pick(q,'gameFrequency','')),
    handedness: String(pick(q,'handedness','')),
    visionIssue: String(pick(q,'visionIssue','')),
    healthDetail: String(pick(q,'healthDetail','')),
    consentParent: String(pick(q,'consentParent','')),
  };

  ctx.runMode = String(ctx.runMode || 'play').toLowerCase();
  ctx.diff = String(ctx.diff || 'normal').toLowerCase();
  ctx.durationPlannedSec = clamp(ctx.durationPlannedSec, 20, 180);

  return ctx;
}

function makeSessionSeed(ctx){
  const q = qs();
  const seedParam = pick(q,'seed','');
  if (seedParam !== '') return hashStrToU32(seedParam);
  if (ctx.sessionId) return hashStrToU32(ctx.sessionId);
  return hashStrToU32(String(Date.now()));
}

// quest/update throttle
let _lastQuestEmitAt = 0;
function emitQuestUpdateThrottled(payload){
  const t = now();
  if (t - _lastQuestEmitAt < 160) return;
  _lastQuestEmitAt = t;
  emit('quest:update', payload);
}

// score throttle
let _lastScoreEmitAt = 0;
function emitScoreThrottled(payload){
  const t = now();
  if (t - _lastScoreEmitAt < 120) return;
  _lastScoreEmitAt = t;
  emit('hha:score', payload);
}

// time once/sec
let _lastTimeEmitSec = -999;
function emitTimeOncePerSec(secLeft, secPlayed){
  const s = Math.floor(secPlayed);
  if (s === _lastTimeEmitSec) return;
  _lastTimeEmitSec = s;
  emit('hha:time', { secLeft, secPlayed });
}

// ------------------------- audio (beep/tick/thunder only) -------------------------
const AudioFX = (() => {
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function tone(type, freq, dur, gain){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;

    o.connect(g);
    g.connect(c.destination);

    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.05), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.08));

    o.start(t0);
    o.stop(t0 + (dur || 0.08) + 0.02);
  }
  function beep(){ tone('sine', 780, 0.07, 0.06); }
  function tick(){ tone('square', 1200, 0.035, 0.035); }
  function thunder(){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.7);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.85);
    o.connect(g); g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.9);
  }
  function resume(){
    const c = ensure(); if(!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
  }
  return { resume, beep, tick, thunder };
})();

// ------------------------- Particles (optional) -------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ------------------------- DOM targets (orb) -------------------------
function ensureCrosshair(playfield){
  let ch = DOC.querySelector('.hvr-crosshair');
  if (ch) return ch;
  ch = DOC.createElement('div');
  ch.className = 'hvr-crosshair';
  Object.assign(ch.style, {
    position:'absolute',
    left:'50%', top:'50%',
    width:'18px', height:'18px',
    transform:'translate(-50%,-50%)',
    borderRadius:'999px',
    border:'2px solid rgba(226,232,240,.55)',
    boxShadow:'0 0 0 6px rgba(2,6,23,.35)',
    pointerEvents:'none',
    zIndex:'8',
  });
  const dot = DOC.createElement('div');
  Object.assign(dot.style, {
    position:'absolute', left:'50%', top:'50%',
    width:'4px', height:'4px',
    transform:'translate(-50%,-50%)',
    borderRadius:'999px',
    background:'rgba(34,211,238,.95)',
    boxShadow:'0 0 12px rgba(34,211,238,.35)'
  });
  ch.appendChild(dot);
  playfield.appendChild(ch);
  return ch;
}

function makeOrbEl(kind){
  const el = DOC.createElement('div');
  el.className = 'hvr-orb hvr-' + kind;
  Object.assign(el.style, {
    position:'absolute',
    width:'86px', height:'86px',
    borderRadius:'999px',
    pointerEvents:'auto',
    transform:'translate(-50%,-50%)',
    zIndex:'6',
    boxShadow:'0 16px 50px rgba(0,0,0,.35)',
    willChange:'transform, left, top, filter, opacity'
  });

  const skin = DOC.createElement('div');
  Object.assign(skin.style, {
    position:'absolute', inset:'0',
    borderRadius:'999px',
    border:'1px solid rgba(226,232,240,.18)',
    overflow:'hidden'
  });

  let g1, g2, glow;
  if (kind === 'good'){
    g1 = 'rgba(34,211,238,.92)';
    g2 = 'rgba(59,130,246,.82)';
    glow = 'rgba(34,211,238,.22)';
  } else if (kind === 'bad'){
    g1 = 'rgba(239,68,68,.90)';
    g2 = 'rgba(249,115,22,.80)';
    glow = 'rgba(239,68,68,.20)';
  } else {
    g1 = 'rgba(167,139,250,.92)';
    g2 = 'rgba(34,211,238,.55)';
    glow = 'rgba(167,139,250,.18)';
  }

  skin.style.background =
    `radial-gradient(28px 28px at 30% 30%, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 60%),
     radial-gradient(90px 90px at 40% 35%, ${g1} 0%, ${g2} 62%, rgba(2,6,23,.25) 100%)`;
  skin.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.08), 0 0 22px ${glow}`;

  const icon = DOC.createElement('div');
  Object.assign(icon.style, {
    position:'absolute', left:'50%', top:'110%',
    transform:'translate(-50%,-50%)',
    width:'34px', height:'34px',
    borderRadius:'14px',
    background:'rgba(2,6,23,.55)',
    border:'1px solid rgba(148,163,184,.16)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'18px',
    boxShadow:'0 16px 40px rgba(0,0,0,.35)'
  });
  icon.textContent = (kind === 'good') ? '💧' : (kind === 'bad') ? '☠️' : '🛡️';

  el.appendChild(skin);
  el.appendChild(icon);
  return el;
}

// ------------------------- FX fallback burst -------------------------
function fallbackBurst(x, y, kind){
  const layer = DOC.querySelector('.hha-fx-layer') || DOC.body;
  const p = DOC.createElement('div');
  const r = (kind === 'bad') ? 'rgba(239,68,68,.55)' : (kind === 'shield') ? 'rgba(167,139,250,.45)' : 'rgba(34,211,238,.45)';
  Object.assign(p.style, {
    position:'fixed',
    left: `${x}px`, top:`${y}px`,
    width:'10px', height:'10px',
    borderRadius:'999px',
    transform:'translate(-50%,-50%)',
    boxShadow:`0 0 0 0 ${r}`,
    border:`1px solid rgba(255,255,255,.12)`,
    pointerEvents:'none',
    zIndex:'9999',
    opacity:'1'
  });
  layer.appendChild(p);
  const t0 = now();
  const dur = 420;
  (function anim(){
    const t = now() - t0;
    const k = clamp(t/dur, 0, 1);
    const s = 1 + 7*k;
    p.style.transform = `translate(-50%,-50%) scale(${s})`;
    p.style.opacity = String(1 - k);
    p.style.boxShadow = `0 0 0 ${Math.round(40*k)}px ${r}`;
    if (k < 1) requestAnimationFrame(anim);
    else p.remove();
  })();
}
function burstAtClient(x, y, kind){
  try{ Particles.burstAt?.(x, y, kind); }catch(_){}
  fallbackBurst(x, y, kind);
}

// ------------------------- constants + ctx/seed -------------------------
const CTX = pickContextFromURL();
const RUN = CTX.runMode;          // play|study
const DIFF = CTX.diff;            // easy|normal|hard
const HUB  = String(pick(qs(), 'hub', './hub.html'));
const DUR_SEC = CTX.durationPlannedSec;

const GAME_VERSION = 'hydration-2025-12-27c';

const seed = makeSessionSeed(CTX);
const rng = makeRng(seed);

// ------------------------- base tuning -------------------------
const TUNE = (() => {
  const base = {
    maxTargets: 2,
    spawnEveryMs: 850,
    ttlGoodMs: 2200,
    ttlBadMs: 2600,
    ttlShieldMs: 2400,
    waterStepGood: 9.5,
    waterStepBad: 7.5,
    greenHalfBand: 8,

    // base requirement for goal stage 1 (stages will add)
    goalGreenNeedSec: 12,

    stormEverySec: 14,
    stormDurSec: 5.5,
    warnLeadSec: 2.2,
    endWindowSec: 1.25,

    pressureRisePerSec: 16,
    pressureDropOnGood: 10,
    pressureAddOnBad: 12,
    pressureThr: 65,

    miniBlocksNeed: 2,
    shieldSpawnChance: 0.08,
    badBiasInStorm: 0.72,
  };

  if (DIFF === 'easy'){
    base.maxTargets = 2;
    base.spawnEveryMs = 900;
    base.ttlGoodMs = 2500;
    base.ttlBadMs = 2900;
    base.waterStepGood = 10.5;
    base.waterStepBad = 6.5;
    base.goalGreenNeedSec = 10;
    base.pressureRisePerSec = 14;
    base.pressureThr = 60;
    base.miniBlocksNeed = 2;
    base.badBiasInStorm = 0.64;
  } else if (DIFF === 'hard'){
    base.maxTargets = 3;
    base.spawnEveryMs = 760;
    base.ttlGoodMs = 1950;
    base.ttlBadMs = 2350;
    base.waterStepGood = 8.5;
    base.waterStepBad = 8.5;
    base.goalGreenNeedSec = 14;
    base.stormEverySec = 12;
    base.stormDurSec = 6.2;
    base.pressureRisePerSec = 18;
    base.pressureThr = 70;
    base.miniBlocksNeed = 3;
    base.badBiasInStorm = 0.78;
  }

  if (RUN === 'study'){
    base.maxTargets = Math.max(base.maxTargets, 3);
    base.spawnEveryMs = Math.max(640, base.spawnEveryMs - 80);
    base.ttlGoodMs = Math.max(1600, base.ttlGoodMs - 200);
    base.ttlBadMs = Math.max(1800, base.ttlBadMs - 150);
    base.goalGreenNeedSec = Math.max(12, base.goalGreenNeedSec);
  }

  return base;
})();

// ------------------------- Goals as stages (1/3,2/3,3/3) -------------------------
const GOAL_STAGES = 3;
function goalNeedForStage(stageIndex){
  const base = TUNE.goalGreenNeedSec;
  const step = (DIFF === 'hard') ? 3 : 2;
  return Math.max(6, Math.round(base + stageIndex * step));
}

// ------------------------- state -------------------------
const S = {
  started:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0, // miss = good expired + bad hit (unblocked). shield-block doesn't count miss.

  // water system
  water: 45,
  mean: 50,
  zone: 'GREEN',
  timeInGreen: 0,

  // goals as stages
  goalsTotal: GOAL_STAGES,
  goalStage: 0,          // 0..2
  goalNeedSec: goalNeedForStage(0),
  allGoalsCleared:false,

  // storm + mini
  stormActive:false,
  stormLeftSec: 0,
  stormPhase: 'off',     // off|early|mid|end
  nextStormInSec: TUNE.stormEverySec,
  warnActive:false,
  pressure: 0,
  miniBlocksDone: 0,
  miniBlocksNeed: TUNE.miniBlocksNeed,
  miniDone: 0,
  miniTotal: 0, // storms occurred
  lastBlockedAt: 0,

  shield: 0,

  // live counts
  liveGood: 0,
  liveBad: 0,
  liveShield: 0,

  tStart: 0,
  tLast: 0,
  tLeftSec: DUR_SEC,

  // spawn/hit/expire counters
  nSpawnGood: 0,
  nSpawnBad: 0,
  nSpawnShield: 0,

  nHitGood: 0,
  nHitBad: 0,
  nHitShield: 0,

  nExpireGood: 0,
  nExpireBad: 0,
  nExpireShield: 0,

  // block metrics
  nBlock: 0,
  nBlockCounted: 0,

  // RT metrics
  rtGood: { n:0, sum:0, arr:[], fast:0 },

  // spawn fairness / anti-streak
  lastKind: '',
  badStreak: 0,
  goodStreak: 0,
  sinceLastGood: 0,
  sinceLastShield: 0,

  spawnTimer: 0,

  lookX: 0,
  lookY: 0,

  dragCandidate:false,
  dragOn:false,
  dragX: 0,
  dragY: 0,
  baseLookX: 0,
  baseLookY: 0,

  startTimeIso: '',
  endTimeIso: '',

  // adaptive (play only)
  adaptive: {
    enabled: (RUN === 'play'),
    factor: 0,          // - easier, + harder
    lastCheckAt: 0,
    lastHitGood: 0,
    lastHitBad: 0,
    lastMiss: 0,
  },
  tuneEff: null,

  // cinematic tick accumulators
  __warnTickT: 0,
  __endTickT: 0,
};

function calcZone(){
  const band = TUNE.greenHalfBand;
  const v = S.water;
  if (v < (S.mean - band)) return 'LOW';
  if (v > (S.mean + band)) return 'HIGH';
  return 'GREEN';
}
function setWater(v){
  S.water = clamp(v, 0, 100);
  S.zone = calcZone();
}

// ✅ Fix “stuck at 50”: allow deterministic micro-overshoot/jitter near mean
function regressionTowardMean(step){
  const d = S.mean - S.water;

  // already near mean → tiny jitter so it doesn't lock forever at exactly 50
  if (Math.abs(d) < 0.6){
    const jitter = (rng() < 0.5 ? -1 : 1) * Math.min(1.4, step * 0.10);
    setWater(S.water + jitter);
    return;
  }

  // move toward mean
  const m = Math.min(Math.abs(d), step);
  let next = S.water + Math.sign(d) * m;

  // small chance to cross mean when close (keeps the game dynamic)
  if (Math.abs(d) <= step * 0.70 && rng() < 0.18){
    const over = 0.8 + rng()*1.6; // 0.8..2.4
    next = S.mean + (d > 0 ? +over : -over); // cross to the other side
  }

  setWater(next);
}
function pushAwayFromMean(step){
  const d = S.water - S.mean;
  const dir = (Math.abs(d) < 0.0001) ? (rng() < 0.5 ? -1 : 1) : (d > 0 ? 1 : -1);
  setWater(S.water + dir * step);
}

// ------------------------- adaptive tuning (play only) -------------------------
function computeTuneEff(){
  const f = clamp(S.adaptive.factor, -0.35, 0.35); // + = harder
  const spawnEveryMs = clamp(TUNE.spawnEveryMs * (1 - 0.28*f), 520, 1100);
  const ttlGoodMs    = clamp(TUNE.ttlGoodMs   * (1 - 0.22*f), 1300, 3200);
  const ttlBadMs     = clamp(TUNE.ttlBadMs    * (1 - 0.20*f), 1400, 3400);
  const ttlShieldMs  = clamp(TUNE.ttlShieldMs * (1 - 0.18*f), 1400, 3400);
  const badBiasInStorm = clamp(TUNE.badBiasInStorm + 0.12*f, 0.55, 0.90);
  return { spawnEveryMs, ttlGoodMs, ttlBadMs, ttlShieldMs, badBiasInStorm, factor:f };
}
S.tuneEff = computeTuneEff();

// ------------------------- UI binding -------------------------
const UI = {
  score: $('stat-score'),
  combo: $('stat-combo'),
  comboMax: $('stat-combo-max'),
  miss: $('stat-miss'),
  time: $('stat-time'),
  grade: $('stat-grade'),

  coachText: $('coach-text'),
  coachSub: $('coach-sub'),

  waterZone: $('water-zone'),
  waterPct: $('water-pct'),
  waterBar: $('water-bar'),
  shield: $('shield-count'),
  stormLeft: $('storm-left'),

  q1: $('quest-line1'),
  q2: $('quest-line2'),
  q3: $('quest-line3'),
  q4: $('quest-line4'),

  miniStormIn: $('mini-storm-in'),
  miniPressurePct: $('mini-pressure-pct'),
  miniPressureBar: $('mini-pressure-bar'),
  cStorm: $('mini-c-storm'),
  vStorm: $('mini-v-storm'),
  cZone: $('mini-c-zone'),
  vZone: $('mini-v-zone'),
  cPressure: $('mini-c-pressure'),
  vPressure: $('mini-v-pressure'),
  cEnd: $('mini-c-end'),
  vEnd: $('mini-v-end'),
  cBlock: $('mini-c-block'),
  vBlock: $('mini-v-block'),

  startOverlay: $('start-overlay'),
  btnStart: $('btn-start'),
  btnVR: $('btn-vr'),
  btnStop: $('btn-stop'),

  endWrap: $('hvr-end'),
  btnRetry: $('btn-retry'),
  endScore: $('end-score'),
  endGrade: $('end-grade'),
  endCombo: $('end-combo'),
  endMiss: $('end-miss'),
  endGoals: $('end-goals'),
  endMinis: $('end-minis'),

  playfield: $('playfield'),
  layer: $('hvr-layer'),

  stamp: $('hha-stamp'),
  stampBig: $('stamp-big'),
  stampSmall: $('stamp-small'),
};

function setWarnAmp(v){
  v = clamp(v, 0, 1);
  DOC.documentElement.style.setProperty('--warnamp', String(v));
}
function setEdgeFx(v){
  v = clamp(v, 0, 0.85);
  DOC.documentElement.style.setProperty('--fx', String(v));
}
function flashEdge(strength){
  setEdgeFx(strength);
  const t0 = now();
  const dur = 420;
  (function decay(){
    const k = clamp((now()-t0)/dur, 0, 1);
    setEdgeFx(strength * (1-k));
    if (k < 1) requestAnimationFrame(decay);
  })();
}
function setBodyFx(){
  DOC.body.classList.toggle('fx-low', S.zone === 'LOW');
  DOC.body.classList.toggle('fx-high', S.zone === 'HIGH');
}
function coachSay(main, sub){
  safeText(UI.coachText, main);
  safeText(UI.coachSub, sub || '');
  emit('hha:coach', { text: String(main||''), sub: String(sub||''), mood: '' });
}
function stamp(textBig, textSmall){
  if(!UI.stamp) return;
  safeText(UI.stampBig, textBig);
  safeText(UI.stampSmall, textSmall);
  UI.stamp.classList.add('show');
  setTimeout(()=> UI.stamp?.classList.remove('show'), 760);
}

// ------------------------- grade / progress -------------------------
function calcGrade(){
  const base = S.score;
  const goalBonus = (S.allGoalsCleared ? S.goalsTotal : (S.goalStage)) * 120;
  const miniBonus = S.miniDone * 80;
  const missPenalty = S.miss * 8;
  const total = base + goalBonus + miniBonus - missPenalty;

  if (total >= 900) return 'SSS';
  if (total >= 720) return 'SS';
  if (total >= 560) return 'S';
  if (total >= 420) return 'A';
  if (total >= 280) return 'B';
  return 'C';
}
function progressToS(){
  const goalCleared = S.allGoalsCleared ? S.goalsTotal : S.goalStage;
  const base = S.score + (goalCleared*120) + (S.miniDone*80) - (S.miss*8);
  const pct = clamp((base / 560) * 100, 0, 100);
  return Math.round(pct);
}

// ------------------------- quest/update payload -------------------------
function buildQuestPayload(){
  const ns = S.stormActive ? 'Storm อยู่!' : `Next storm in ~${Math.max(0, Math.ceil(S.nextStormInSec))}s`;
  const totalStorms = Math.max(0, S.miniTotal|0);
  const endWindow = S.stormActive && (S.stormLeftSec <= TUNE.endWindowSec + 0.02);

  const goalLabel = S.allGoalsCleared
    ? `GOAL: ALL CLEARED ✅`
    : `Goal ${S.goalStage+1}/${S.goalsTotal}: อยู่ GREEN รวม ${S.goalNeedSec}s 🟢`;

  const line1 = goalLabel;
  const line2 = S.allGoalsCleared
    ? `ยอดเยี่ยม! เคลียร์ครบทุกด่านแล้ว • เล่นต่อเพื่อคะแนน/mini ได้เลย`
    : `สะสม GREEN: ${Math.floor(S.timeInGreen)} / ${S.goalNeedSec}s • ด่านที่เหลือ: ${S.goalsTotal-(S.goalStage)} ด่าน`;

  const line3 = `Mini (Storm): บล็อก BAD “ท้ายพายุ” ${S.miniBlocksDone}/${S.miniBlocksNeed} • ${ns}`;
  const adaptTxt = S.adaptive.enabled ? `Adaptive ${(S.tuneEff.factor>=0?'+':'')}${Math.round(S.tuneEff.factor*100)}%` : 'Adaptive OFF';
  const line4 = `State: Zone ${S.zone} • Pressure ${Math.round(S.pressure)}% (thr ${TUNE.pressureThr}%) • EndWindow: ${endWindow ? 'NOW' : '—'} • S:${progressToS()}% • ${adaptTxt}`;

  return {
    title: 'Hydration Quest',
    line1, line2, line3, line4,
    goalTitle: line1,
    miniTitle: line3,

    goalsCleared: (S.allGoalsCleared ? S.goalsTotal : S.goalStage)|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniDone|0,
    miniTotal: totalStorms|0,

    goalProg: S.allGoalsCleared ? 'DONE' : `${Math.floor(S.timeInGreen)}/${S.goalNeedSec}s`,
    miniProg: `${S.miniBlocksDone}/${S.miniBlocksNeed}`,
  };
}

// ------------------------- ui update -------------------------
function uiUpdate(){
  safeText(UI.time, Math.max(0, Math.ceil(S.tLeftSec)));

  safeText(UI.score, S.score|0);
  safeText(UI.combo, S.combo|0);
  safeText(UI.comboMax, S.comboMax|0);
  safeText(UI.miss, S.miss|0);

  safeText(UI.grade, calcGrade());

  safeText(UI.waterZone, S.zone);
  safeText(UI.waterPct, `${Math.round(S.water)}%`);
  if (UI.waterBar){
    UI.waterBar.style.width = `${clamp(S.water,0,100)}%`;
    UI.waterBar.classList.toggle('red', (S.zone !== 'GREEN'));
  }
  safeText(UI.shield, S.shield|0);
  safeText(UI.stormLeft, S.stormActive ? Math.ceil(S.stormLeftSec) : 0);

  const q = buildQuestPayload();
  safeText(UI.q1, q.line1);
  safeText(UI.q2, q.line2);
  safeText(UI.q3, q.line3);
  safeText(UI.q4, q.line4);
  emitQuestUpdateThrottled(q);

  // ✅ mini card show only when warn or storm
  const miniCard = DOC.getElementById('mini-card');
  if (miniCard){
    const show = (S.warnActive || S.stormActive);
    miniCard.style.display = show ? '' : 'none';
  }

  const stormIn = S.stormActive ? 0 : Math.max(0, Math.ceil(S.nextStormInSec));
  safeText(UI.miniStormIn, (S.stormActive ? '0' : String(stormIn)));

  const okStorm = S.stormActive;
  const okZone = (S.zone !== 'GREEN');
  const okPressure = (S.pressure >= TUNE.pressureThr);
  const endWindow = S.stormActive && (S.stormLeftSec <= TUNE.endWindowSec + 0.02);
  const okBlock = (S.miniBlocksDone >= S.miniBlocksNeed);

  safeClass(UI.cStorm, 'ok', okStorm);
  safeText(UI.vStorm, okStorm ? 'YES' : 'NO');

  safeClass(UI.cZone, 'ok', okZone && okStorm);
  safeClass(UI.cZone, 'bad', okStorm && !okZone);
  safeText(UI.vZone, okStorm ? (okZone ? `${S.zone} ✅` : `${S.zone} ❌`) : '—');

  safeClass(UI.cPressure, 'ok', okPressure && okStorm);
  safeClass(UI.cPressure, 'bad', okStorm && !okPressure);
  safeText(UI.vPressure, okStorm ? (okPressure ? `${Math.round(S.pressure)}% ✅` : `${Math.round(S.pressure)}% ❌`) : '—');

  safeClass(UI.cEnd, 'ok', endWindow);
  safeClass(UI.cEnd, 'bad', okStorm && !endWindow);
  safeText(UI.vEnd, okStorm ? (endWindow ? 'NOW ✅' : `WAIT ${Math.max(0, Math.ceil(S.stormLeftSec - TUNE.endWindowSec))}s`) : '—');

  safeClass(UI.cBlock, 'ok', okBlock);
  safeClass(UI.cBlock, 'bad', okStorm && !okBlock);
  safeText(UI.vBlock, `${S.miniBlocksDone}/${S.miniBlocksNeed}`);

  if (UI.miniPressureBar){
    UI.miniPressureBar.style.width = `${clamp(S.pressure,0,100)}%`;
  }
  safeText(UI.miniPressurePct, String(Math.round(S.pressure)));

  setBodyFx();

  emitScoreThrottled({
    score: S.score|0,
    combo: S.combo|0,
    comboMax: S.comboMax|0,
    misses: S.miss|0,
    waterPct: Math.round(S.water),
    zone: S.zone,
    shield: S.shield|0,
    goalsCleared: (S.allGoalsCleared ? S.goalsTotal : S.goalStage)|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniDone|0,
    miniTotal: Math.max(0, S.miniTotal|0),
    adaptiveFactor: S.tuneEff.factor,
    stormPhase: S.stormPhase
  });
}

// ------------------------- gameplay: spawning (spread + fairness) -------------------------
const Live = new Map(); // id -> obj
let nextId = 1;

function centerBiasRand(){
  return (rng() + rng()) * 0.5;
}
function getExistingCenters(){
  const centers = [];
  for (const obj of Live.values()){
    const r = obj.el.getBoundingClientRect();
    centers.push({ x: r.left + r.width/2, y: r.top + r.height/2, rad: Math.max(r.width,r.height)*0.5 });
  }
  return centers;
}
function pickSpawnPos(rect, minDistPx){
  const centers = getExistingCenters();
  let best = null;
  let bestScore = -1;

  const tries = 16;
  for (let i=0;i<tries;i++){
    const u = centerBiasRand();
    const v = centerBiasRand();
    const x = rect.left + u * rect.w;
    const y = rect.top  + v * rect.h;

    let nearest = 1e9;
    for (const c of centers){
      const dx = x - c.x, dy = y - c.y;
      const d = Math.sqrt(dx*dx + dy*dy) - c.rad;
      if (d < nearest) nearest = d;
    }

    const score = nearest;
    if (score > bestScore){
      bestScore = score;
      best = { x, y };
    }
    if (nearest >= minDistPx) return { x, y };
  }
  return best || { x: rect.left + rect.w*0.5, y: rect.top + rect.h*0.5 };
}

function playRectForSize(sizePx){
  const r = UI.playfield.getBoundingClientRect();
  const edge = 14;
  const pad = Math.max(46, Math.round(sizePx*0.55)) + edge;
  return {
    left: r.left + pad,
    top:  r.top  + pad,
    w: Math.max(1, (r.width  - pad*2)),
    h: Math.max(1, (r.height - pad*2))
  };
}

function spawnKind(){
  const inStorm = S.stormActive;

  // anti “all red”
  const maxBadStreak = inStorm ? 3 : 2;
  const forceGood = (S.badStreak >= maxBadStreak) || (S.sinceLastGood >= (inStorm ? 5 : 4));

  // shield spacing
  const wantShield = (!inStorm && S.shield < 2 && S.sinceLastShield >= 4 && rng() < TUNE.shieldSpawnChance);

  // base preference
  const wantGood = (S.zone === 'LOW') ? 0.70 : (S.zone === 'HIGH') ? 0.70 : 0.58;

  if (wantShield) return 'shield';
  if (forceGood) return 'good';

  if (inStorm){
    if (S.liveGood <= 0) return 'good';
    if (S.liveBad  <= 0) return 'bad';

    let bias = S.tuneEff.badBiasInStorm;
    if (S.stormPhase === 'early') bias = clamp(bias - 0.10, 0.55, 0.88);
    else if (S.stormPhase === 'end') bias = clamp(bias + 0.12, 0.60, 0.92);

    return (rng() < bias) ? 'bad' : 'good';
  }

  if (S.liveGood <= 0) return 'good';
  if (S.liveBad  <= 0) return 'bad';
  return (rng() < wantGood) ? 'good' : 'bad';
}

function spawnOne(){
  if (!UI.layer || !UI.playfield) return;
  if (Live.size >= TUNE.maxTargets) return;

  const kind = spawnKind();
  const size = (DIFF === 'easy') ? 92 : (DIFF === 'hard') ? 78 : 86;

  const rect = playRectForSize(size);
  const pos  = pickSpawnPos(rect, Math.max(64, Math.round(size*0.78)));
  const x = pos.x;
  const y = pos.y;

  const id = nextId++;
  const el = makeOrbEl(kind);
  UI.layer.appendChild(el);

  const pf = UI.playfield.getBoundingClientRect();
  el.style.left = `${x - pf.left}px`;
  el.style.top  = `${y - pf.top}px`;

  el.style.width  = `${size}px`;
  el.style.height = `${size}px`;

  const bornAt = now();
  const ttl = (kind === 'good') ? S.tuneEff.ttlGoodMs : (kind === 'bad') ? S.tuneEff.ttlBadMs : S.tuneEff.ttlShieldMs;

  const obj = {
    id, kind, el,
    bornAt,
    ttl,
    a: 6 + rng()*10,
    b: 5 + rng()*8,
    sp: 0.9 + rng()*0.9,
    ph: rng()*Math.PI*2
  };
  Live.set(id, obj);

  if (kind === 'good'){ S.liveGood++; S.nSpawnGood++; }
  else if (kind === 'bad'){ S.liveBad++; S.nSpawnBad++; }
  else { S.liveShield++; S.nSpawnShield++; }

  // streak bookkeeping
  S.sinceLastGood++;
  S.sinceLastShield++;
  if (kind === 'good'){
    S.badStreak = 0;
    S.goodStreak++;
    S.sinceLastGood = 0;
  } else if (kind === 'bad'){
    S.badStreak++;
    S.goodStreak = 0;
  } else {
    S.sinceLastShield = 0;
  }
  S.lastKind = kind;

  emit('hha:log_event', { type:'spawn', kind, id, t: Date.now(), secLeft: S.tLeftSec });

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    onHitOrb(obj, e);
  }, { passive:false });
}

function removeOrb(obj, reason){
  if (!obj || !obj.el) return;
  if (!Live.has(obj.id)) return;
  Live.delete(obj.id);
  obj.el.remove();

  if (obj.kind === 'good') S.liveGood = Math.max(0, S.liveGood - 1);
  else if (obj.kind === 'bad') S.liveBad = Math.max(0, S.liveBad - 1);
  else S.liveShield = Math.max(0, S.liveShield - 1);

  if (reason === 'expire'){
    if (obj.kind === 'good') S.nExpireGood++;
    else if (obj.kind === 'bad') S.nExpireBad++;
    else S.nExpireShield++;
    emit('hha:log_event', { type:'expire', kind: obj.kind, id: obj.id, t: Date.now(), secLeft: S.tLeftSec });
  }
}

function onExpire(obj){
  if (obj.kind === 'good'){
    S.miss++;
    S.combo = 0;
    pushAwayFromMean(TUNE.waterStepBad * 0.55);
    flashEdge(0.22);
    coachSay('พลาดน้ำดี! 💧', 'คุมให้อยู่ GREEN ให้นิ่งขึ้น');
    emit('hha:judge', { type:'miss', reason:'expire_good' });
    emit('hha:log_event', { type:'miss', reason:'expire_good', t: Date.now(), secLeft: S.tLeftSec });
  } else if (obj.kind === 'bad'){
    // study mode: bad expire counts (challenge)
    if (RUN === 'study'){
      S.miss++;
      S.combo = 0;
      pushAwayFromMean(TUNE.waterStepBad * 0.25);
      flashEdge(0.18);
      emit('hha:judge', { type:'miss', reason:'expire_bad' });
      emit('hha:log_event', { type:'miss', reason:'expire_bad', t: Date.now(), secLeft: S.tLeftSec });
    }
  }
  removeOrb(obj, 'expire');
}

// ------------------------- hits / scoring -------------------------
function clientXYFromEvent(e, fallbackEl){
  let x = 0, y = 0;
  if (e && typeof e.clientX === 'number'){
    x = e.clientX; y = e.clientY;
  } else if (fallbackEl){
    const r = fallbackEl.getBoundingClientRect();
    x = r.left + r.width/2;
    y = r.top + r.height/2;
  }
  return { x, y };
}

function onHitOrb(obj, e){
  if (!S.started || S.ended) return;

  const { x, y } = clientXYFromEvent(e, obj.el);
  const inEndWindow = (S.stormActive && S.stormLeftSec <= TUNE.endWindowSec + 0.02);

  if (obj.kind === 'good'){
    AudioFX.beep();

    // ✅ RT good
    const rt = Math.max(0, Math.round(now() - obj.bornAt));
    S.rtGood.n++;
    S.rtGood.sum += rt;
    S.rtGood.arr.push(rt);
    if (rt <= 450) S.rtGood.fast++;
    if (S.rtGood.arr.length > 200) S.rtGood.arr.shift();

    S.nHitGood++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.score += 10 + Math.min(12, S.combo);

    regressionTowardMean(TUNE.waterStepGood);
    S.pressure = clamp(S.pressure - TUNE.pressureDropOnGood, 0, 100);

    burstAtClient(x, y, 'good');
    coachSay('ดีมาก! 💧', 'คุม GREEN เพื่อผ่านด่าน Goal');

    emit('hha:judge', { type:'hit', kind:'good' });
    emit('hha:log_event', { type:'hit', kind:'good', rtMs: rt, t: Date.now(), secLeft: S.tLeftSec });

  } else if (obj.kind === 'shield'){
    AudioFX.beep();
    S.nHitShield++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.score += 14;

    S.shield = clamp(S.shield + 1, 0, 9);
    regressionTowardMean(TUNE.waterStepGood * 0.35);

    burstAtClient(x, y, 'shield');
    stamp('SHIELD +1', 'เก็บไว้บล็อก BAD ช่วงท้ายพายุ!');
    coachSay('ได้ Shield แล้ว! 🛡️', 'บล็อก “ท้ายพายุ” + Pressure ถึง จะนับ mini');

    emit('hha:judge', { type:'hit', kind:'shield' });
    emit('hha:log_event', { type:'hit', kind:'shield', t: Date.now(), secLeft: S.tLeftSec });

  } else { // bad
    S.nHitBad++;

    if (S.shield > 0 && S.stormActive){
      // shield-block (no miss)
      S.shield--;
      AudioFX.beep();
      S.score += 18;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.pressure = clamp(S.pressure + (TUNE.pressureAddOnBad * 0.35), 0, 100);

      burstAtClient(x, y, 'shield');

      const canCount = inEndWindow && (S.pressure >= TUNE.pressureThr);
      stamp('BLOCK!', canCount ? 'นับแต้ม mini ✅' : (inEndWindow ? 'Pressure ยังไม่ถึง' : 'ยังไม่ใช่ท้ายพายุ'));

      // ✅ block metrics
      S.nBlock++;
      if (canCount) S.nBlockCounted++;

      emit('hha:log_event', { type:'block', timing: inEndWindow ? 'endwindow' : 'early', pressure: Math.round(S.pressure), counted: !!canCount, t: Date.now(), secLeft: S.tLeftSec });

      if (canCount){
        S.miniBlocksDone++;
        S.lastBlockedAt = now();
        coachSay('บล็อกถูกจังหวะ! ✅', `Mini: ${S.miniBlocksDone}/${S.miniBlocksNeed}`);
        flashEdge(0.22);
      } else {
        coachSay('บล็อกได้ แต่ยังไม่นับ', inEndWindow ? 'ต้อง Pressure ≥ threshold ก่อน (ตาม checklist)' : 'รอ End-window แล้วค่อยบล็อก');
      }

      emit('hha:judge', { type:'hit', kind:'bad_blocked' });

    } else {
      // hit bad without shield = miss
      AudioFX.beep();
      S.combo = 0;
      S.miss++;
      S.score -= 12;
      pushAwayFromMean(TUNE.waterStepBad);
      S.pressure = clamp(S.pressure + TUNE.pressureAddOnBad, 0, 100);

      burstAtClient(x, y, 'bad');
      flashEdge(0.45);

      // (2) FAIL STATE: hit BAD in end-window during storm without shield => reset mini progress
      if (S.stormActive && inEndWindow){
        S.miniBlocksDone = 0;
        S.score -= 20;
        flashEdge(0.70);
        stamp('RESET!', 'ท้ายพายุโดน BAD → mini รีเซ็ต!');
        coachSay('พังท้ายพายุ! ❌', 'โดน BAD ช่วง End-window: mini progress รีเซ็ตเป็น 0');
        emit('hha:log_event', { type:'mini_reset', reason:'hit_bad_endwindow_no_shield', t: Date.now(), secLeft: S.tLeftSec });
      } else {
        coachSay('โดน BAD! ☠️', 'ถ้าเข้า Storm ให้เก็บ Shield ไว้บล็อกท้ายพายุ');
      }

      emit('hha:judge', { type:'miss', reason:'hit_bad' });
      emit('hha:log_event', { type:'miss', reason:'hit_bad', t: Date.now(), secLeft: S.tLeftSec });
    }

    emit('hha:log_event', { type:'hit', kind:'bad', t: Date.now(), secLeft: S.tLeftSec });
  }

  removeOrb(obj, 'hit');
  uiUpdate();
}

// ------------------------- storm system + cinematic -------------------------
let tickHandle = 0;

function setWarn(on){
  S.warnActive = !!on;
  DOC.body.classList.toggle('storm-warn', S.warnActive);
  if (!S.warnActive) setWarnAmp(0);
  if (!S.warnActive) S.__warnTickT = 0;
}
function warnTickUpdate(dtSec){
  if (!S.warnActive) return;
  S.__warnTickT += dtSec;
  const remain = Math.max(0.001, S.nextStormInSec);
  const rate = clamp(0.22 - (0.14 * (1 - clamp(remain / TUNE.warnLeadSec, 0, 1))), 0.07, 0.22);
  if (S.__warnTickT >= rate){
    S.__warnTickT = 0;
    AudioFX.tick();
  }
  const amp = clamp(1 - (remain / TUNE.warnLeadSec), 0, 1);
  setWarnAmp(amp);
}

function endWindowFxUpdate(dtSec, isEndWindow){
  DOC.body.classList.toggle('endwindow', !!isEndWindow);
  if (!isEndWindow){
    S.__endTickT = 0;
    return;
  }
  S.__endTickT += dtSec;
  const left = Math.max(0.001, S.stormLeftSec);
  const rate = clamp(0.20 - (0.11 * (1 - clamp(left / TUNE.endWindowSec, 0, 1))), 0.07, 0.20);
  if (S.__endTickT >= rate){
    S.__endTickT = 0;
    AudioFX.tick();
  }
  flashEdge(0.65);
}

function stormSet(on){
  S.stormActive = !!on;
  DOC.body.classList.toggle('storm', S.stormActive);

  if (S.stormActive){
    S.stormLeftSec = TUNE.stormDurSec;
    S.stormPhase = 'early';
    S.miniTotal++;
    AudioFX.thunder();
    flashEdge(0.60);
    DOC.body.classList.add('fx-shake');
    coachSay('🌪️ Storm มาแล้ว!', 'คุม LOW/HIGH + ดัน Pressure แล้วท้ายพายุค่อยบล็อก');

    emit('hha:log_event', { type:'storm_start', t: Date.now(), secLeft: S.tLeftSec });

  } else {
    DOC.body.classList.remove('fx-shake');
    DOC.body.classList.remove('storm-warn');
    DOC.body.classList.remove('endwindow');
    setWarnAmp(0);
    S.warnActive = false;
    S.stormPhase = 'off';
    S.__endTickT = 0;

    if (S.miniBlocksDone >= S.miniBlocksNeed){
      S.miniDone++;
      stamp('MINI CLEARED!', `ผ่าน Storm (${S.miniBlocksDone}/${S.miniBlocksNeed})`);
      try{ Particles.celebrate?.('mini'); }catch(_){}
      coachSay('Mini ผ่านแล้ว! 🎉', 'ไปต่อ…');
      emit('hha:log_event', { type:'mini_clear', t: Date.now(), secLeft: S.tLeftSec });
    } else {
      coachSay('Storm จบแล้ว', `Mini ยังไม่ครบ (${S.miniBlocksDone}/${S.miniBlocksNeed}) ลองใหม่รอบหน้า`);
      emit('hha:log_event', { type:'mini_fail', t: Date.now(), secLeft: S.tLeftSec });
    }

    S.miniBlocksDone = 0;
    S.pressure = clamp(S.pressure * 0.35, 0, 100);

    emit('hha:log_event', { type:'storm_end', t: Date.now(), secLeft: S.tLeftSec });
  }

  uiUpdate();
}

// ------------------------- goal stages logic -------------------------
function onGoalCleared(){
  stamp(`GOAL ${S.goalStage+1} CLEARED!`, `ด่านผ่าน ✅`);
  try{ Particles.celebrate?.('goal'); }catch(_){}
  S.score += 120;
  flashEdge(0.35);

  emit('hha:log_event', { type:'goal_clear', stage: S.goalStage+1, t: Date.now(), secLeft: S.tLeftSec });

  S.goalStage++;
  if (S.goalStage >= S.goalsTotal){
    S.allGoalsCleared = true;
    stamp('ALL GOALS!', 'เคลียร์ครบทุกด่านแล้ว! 🏆');
    try{ Particles.celebrate?.('all'); }catch(_){}
    coachSay('โหดมาก! 🏆', 'เคลียร์ครบทุก Goal แล้ว เล่นต่อเพื่อคะแนน/mini ได้!');
    emit('hha:log_event', { type:'goal_all_clear', t: Date.now(), secLeft: S.tLeftSec });
    S.timeInGreen = 0;
  } else {
    S.goalNeedSec = goalNeedForStage(S.goalStage);
    coachSay('ต่อด่านถัดไป! 🟢', `Goal ${S.goalStage+1}/${S.goalsTotal}: อยู่ GREEN ${S.goalNeedSec}s`);
    S.timeInGreen = 0;
  }
}

function updateGreenTime(dtSec){
  if (S.allGoalsCleared) return;
  if (S.zone === 'GREEN'){
    S.timeInGreen += dtSec;
    if (S.timeInGreen >= S.goalNeedSec){
      onGoalCleared();
    }
  }
}

// ------------------------- adaptive update (play only) -------------------------
function adaptiveUpdate(t){
  if (!S.adaptive.enabled) return;
  if (t - S.adaptive.lastCheckAt < 2500) return;

  const dg = (S.nHitGood - S.adaptive.lastHitGood);
  const db = (S.nHitBad  - S.adaptive.lastHitBad);
  const dm = (S.miss     - S.adaptive.lastMiss);

  const perf = (dg * 1.0) - (db * 1.4) - (dm * 1.0);

  if (perf > 2.2) S.adaptive.factor += 0.08;
  else if (perf < -1.0) S.adaptive.factor -= 0.10;
  else S.adaptive.factor *= 0.98;

  S.adaptive.factor = clamp(S.adaptive.factor, -0.35, 0.35);

  S.adaptive.lastCheckAt = t;
  S.adaptive.lastHitGood = S.nHitGood;
  S.adaptive.lastHitBad  = S.nHitBad;
  S.adaptive.lastMiss    = S.miss;

  const prev = S.tuneEff.factor;
  S.tuneEff = computeTuneEff();

  if (Math.abs(S.tuneEff.factor - prev) >= 0.02){
    emit('hha:adaptive', {
      factor: S.tuneEff.factor,
      spawnEveryMs: Math.round(S.tuneEff.spawnEveryMs),
      ttlGoodMs: Math.round(S.tuneEff.ttlGoodMs),
      ttlBadMs: Math.round(S.tuneEff.ttlBadMs),
      badBiasInStorm: Number(S.tuneEff.badBiasInStorm.toFixed(3))
    });
    emit('hha:log_event', { type:'adaptive', factor: S.tuneEff.factor, t: Date.now() });
  }
}

// ------------------------- loop (movement + expire + storm + spawn) -------------------------
function moveOrbs(t){
  const lx = clamp(S.lookX, -1, 1);
  const ly = clamp(S.lookY, -1, 1);
  const tx = lx * 14;
  const ty = ly * 10;
  UI.playfield.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

  for (const obj of Live.values()){
    const age = (t - obj.bornAt) / 1000;
    const wobX = Math.sin(age*obj.sp + obj.ph) * obj.a;
    const wobY = Math.cos(age*(obj.sp*0.92) + obj.ph) * obj.b;
    const pulse = 1 + (Math.sin(age*4.2 + obj.ph)*0.02);
    obj.el.style.transform = `translate(-50%,-50%) translate3d(${wobX}px, ${wobY}px, 0) scale(${pulse})`;
  }
}

function updateStorm(dtSec){
  if (!S.stormActive){
    S.stormPhase = 'off';
    S.nextStormInSec -= dtSec;

    if (S.nextStormInSec <= TUNE.warnLeadSec && S.nextStormInSec > 0){
      if (!S.warnActive){
        setWarn(true);
        coachSay('⚠️ Storm กำลังมา!', 'เตรียมตัว: เก็บ Shield + อย่าอยู่ GREEN ตอนพายุ');
      }
    }

    if (S.warnActive){
      warnTickUpdate(dtSec);
      DOC.body.classList.add('fx-shake');
    } else {
      DOC.body.classList.remove('fx-shake');
    }

    if (S.nextStormInSec <= 0){
      setWarn(false);
      DOC.body.classList.remove('fx-shake');
      stormSet(true);
      S.nextStormInSec = TUNE.stormEverySec + (rng()*2.2 - 1.1);
    }

  } else {
    S.stormLeftSec -= dtSec;
    S.pressure = clamp(S.pressure + (TUNE.pressureRisePerSec * dtSec), 0, 100);

    // phase update
    const left = S.stormLeftSec;
    if (left > (TUNE.stormDurSec * 0.60)) S.stormPhase = 'early';
    else if (left > (TUNE.endWindowSec + 0.35)) S.stormPhase = 'mid';
    else S.stormPhase = 'end';

    const endWindow = (left <= TUNE.endWindowSec + 0.02);
    endWindowFxUpdate(dtSec, endWindow);

    if (left <= 0){
      stormSet(false);
    }
  }
}

function updateExpire(t){
  for (const obj of Array.from(Live.values())){
    if ((t - obj.bornAt) > obj.ttl){
      onExpire(obj);
    }
  }
}

function spawnLoop(t){
  if (!S.started || S.ended) return;
  if (!S.spawnTimer) S.spawnTimer = t;

  const cadence = S.tuneEff.spawnEveryMs;
  while (t - S.spawnTimer >= cadence){
    S.spawnTimer += cadence;
    spawnOne();
  }
}

function mainLoop(t){
  if (!S.started || S.ended){
    tickHandle = requestAnimationFrame(mainLoop);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (t - (S.tLast || t)) / 1000));
  S.tLast = t;

  S.tLeftSec = Math.max(0, S.tLeftSec - dt);
  const played = Math.max(0, (DUR_SEC - S.tLeftSec));
  emitTimeOncePerSec(Math.max(0, Math.ceil(S.tLeftSec)), played);

  if (S.tLeftSec <= 0){
    endGame('timeout');
    tickHandle = requestAnimationFrame(mainLoop);
    return;
  }

  adaptiveUpdate(t);

  S.zone = calcZone();
  updateGreenTime(dt);

  updateStorm(dt);

  // extra pressure when storm AND not green (makes it feel “pushy”)
  if (S.stormActive && S.zone !== 'GREEN'){
    S.pressure = clamp(S.pressure + (6*dt), 0, 100);
  }

  moveOrbs(t);
  updateExpire(t);
  spawnLoop(t);

  uiUpdate();
  tickHandle = requestAnimationFrame(mainLoop);
}

// ------------------------- input: drag + gyro (gated) -------------------------
function bindLook(){
  const pf = UI.playfield;
  if (!pf) return;

  const DRAG_THRESH = 10;

  pf.addEventListener('pointerdown', (e)=>{
    AudioFX.resume();
    S.dragCandidate = true;
    S.dragOn = false;
    S.dragX = e.clientX;
    S.dragY = e.clientY;
    S.baseLookX = S.lookX;
    S.baseLookY = S.lookY;
  }, { passive:true });

  pf.addEventListener('pointermove', (e)=>{
    if (!S.dragCandidate) return;
    const dxPx = (e.clientX - S.dragX);
    const dyPx = (e.clientY - S.dragY);
    if (!S.dragOn){
      if (Math.hypot(dxPx, dyPx) >= DRAG_THRESH){
        S.dragOn = true;
      } else return;
    }
    const dx = dxPx / 220;
    const dy = dyPx / 220;
    S.lookX = clamp(S.baseLookX + dx, -1, 1);
    S.lookY = clamp(S.baseLookY + dy, -1, 1);
  }, { passive:true });

  function endDrag(){
    S.dragCandidate = false;
    S.dragOn = false;
  }
  pf.addEventListener('pointerup', endDrag, { passive:true });
  pf.addEventListener('pointercancel', endDrag, { passive:true });

  ROOT.addEventListener('deviceorientation', (ev)=>{
    const g = num(ev.gamma, 0) / 35;
    const b = num(ev.beta, 0) / 45;
    if (!S.dragOn){
      S.lookX = clamp(g, -1, 1);
      S.lookY = clamp(b, -1, 1);
    }
  }, { passive:true });
}

// ------------------------- lifecycle -------------------------
function startGame(){
  if (S.started) return;
  S.started = true;
  S.ended = false;

  AudioFX.resume();

  // reset
  S.score = 0; S.combo = 0; S.comboMax = 0; S.miss = 0;
  setWater(45);
  S.timeInGreen = 0;

  S.goalStage = 0;
  S.goalNeedSec = goalNeedForStage(0);
  S.allGoalsCleared = false;

  S.miniDone = 0;
  S.miniTotal = 0;
  S.miniBlocksDone = 0;
  S.miniBlocksNeed = TUNE.miniBlocksNeed;
  S.pressure = 0;
  S.shield = 0;
  S.stormPhase = 'off';

  S.nSpawnGood = 0; S.nSpawnBad = 0; S.nSpawnShield = 0;
  S.nHitGood = 0; S.nHitBad = 0; S.nHitShield = 0;
  S.nExpireGood = 0; S.nExpireBad = 0; S.nExpireShield = 0;

  S.nBlock = 0;
  S.nBlockCounted = 0;

  S.rtGood = { n:0, sum:0, arr:[], fast:0 };

  S.lastKind = '';
  S.badStreak = 0;
  S.goodStreak = 0;
  S.sinceLastGood = 0;
  S.sinceLastShield = 0;

  S.tLeftSec = DUR_SEC;
  S.tStart = now();
  S.tLast = now();
  S.startTimeIso = new Date().toISOString();
  S.endTimeIso = '';

  S.nextStormInSec = TUNE.stormEverySec;
  setWarn(false);
  stormSet(false);

  // reset adaptive
  S.adaptive.enabled = (RUN === 'play');
  S.adaptive.factor = 0;
  S.adaptive.lastCheckAt = 0;
  S.adaptive.lastHitGood = 0;
  S.adaptive.lastHitBad  = 0;
  S.adaptive.lastMiss    = 0;
  S.tuneEff = computeTuneEff();

  for (const obj of Array.from(Live.values())) removeOrb(obj, 'clear');

  emit('hha:log_session', {
    action:'start',
    timestampIso: S.startTimeIso,
    seed,
    device: (navigator && navigator.userAgent) ? navigator.userAgent : '',
    gameVersion: GAME_VERSION,
    ...CTX,
  });
  emit('hha:log_event', { type:'session_start', t: Date.now(), seed, gameVersion: GAME_VERSION });

  coachSay('พร้อมแล้ว! 💧', `Goal 1/${S.goalsTotal}: อยู่ GREEN ${S.goalNeedSec}s`);
  uiUpdate();
}

function median(arr){
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return (a.length % 2) ? a[m] : Math.round((a[m-1]+a[m]) * 0.5);
}

function endGame(reason){
  if (S.ended) return;
  S.ended = true;
  S.started = false;

  DOC.body.classList.remove('storm-warn','storm','fx-shake','endwindow');
  setWarnAmp(0);
  setEdgeFx(0);

  if (UI.startOverlay) UI.startOverlay.style.display = 'none';
  if (UI.endWrap) UI.endWrap.style.display = 'flex';

  const totalStorms = Math.max(0, S.miniTotal|0);
  const grade = calcGrade();

  safeText(UI.endScore, S.score|0);
  safeText(UI.endGrade, grade);
  safeText(UI.endCombo, S.comboMax|0);
  safeText(UI.endMiss, S.miss|0);

  const goalsCleared = S.allGoalsCleared ? S.goalsTotal : S.goalStage;
  safeText(UI.endGoals, `${goalsCleared}/${S.goalsTotal}`);
  safeText(UI.endMinis, `${S.miniDone}/${totalStorms}`);

  S.endTimeIso = new Date().toISOString();

  const durationPlayedSec = Math.max(0, Math.round(DUR_SEC - S.tLeftSec));

  const nGoodSpawned = S.nSpawnGood|0;
  const nBadSpawned  = S.nSpawnBad|0;
  const nShieldSpawned = S.nSpawnShield|0;

  const nGoodHit = S.nHitGood|0;
  const nBadHit  = S.nHitBad|0;
  const nShieldHit= S.nHitShield|0;

  const nGoodExpire = S.nExpireGood|0;

  const denomGood = Math.max(1, nGoodHit + nGoodExpire);
  const accuracyGoodPct = Math.round((nGoodHit / denomGood) * 100);

  const denomBad = Math.max(1, nBadHit + nBadSpawned);
  const junkErrorPct = Math.round((nBadHit / denomBad) * 100);

  // ✅ RT metrics
  const avgRtGoodMs = S.rtGood.n ? Math.round(S.rtGood.sum / S.rtGood.n) : 0;
  const medianRtGoodMs = median(S.rtGood.arr);
  const fastHitRatePct = S.rtGood.n ? Math.round((S.rtGood.fast / S.rtGood.n) * 100) : 0;

  const summary = {
    timestampIso: S.endTimeIso,
    projectTag: 'hydration',
    runMode: RUN,
    studyId: CTX.studyId,
    phase: CTX.phase,
    conditionGroup: CTX.conditionGroup,
    sessionOrder: CTX.sessionOrder,
    blockLabel: CTX.blockLabel,
    siteCode: CTX.siteCode,
    schoolYear: CTX.schoolYear,
    semester: CTX.semester,
    sessionId: CTX.sessionId,
    gameMode: 'hydration',
    diff: DIFF,
    durationPlannedSec: DUR_SEC,
    durationPlayedSec,
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.miss|0,

    goalsCleared: goalsCleared|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniDone|0,
    miniTotal: totalStorms|0,

    nTargetGoodSpawned: nGoodSpawned,
    nTargetJunkSpawned: nBadSpawned,
    nTargetShieldSpawned: nShieldSpawned,

    nHitGood: nGoodHit,
    nHitJunk: nBadHit,
    nHitShield: nShieldHit,
    nHitJunkGuard: S.nBlock|0,
    nHitJunkGuardCounted: S.nBlockCounted|0,

    nExpireGood: nGoodExpire,

    accuracyGoodPct,
    junkErrorPct,

    avgRtGoodMs,
    medianRtGoodMs,
    fastHitRatePct,

    waterEndPct: Math.round(S.water),
    grade,
    reason,
    seed,
    startTimeIso: S.startTimeIso,
    endTimeIso: S.endTimeIso,

    adaptiveFactor: S.tuneEff.factor,
    spawnEveryMsEff: Math.round(S.tuneEff.spawnEveryMs),
    ttlGoodMsEff: Math.round(S.tuneEff.ttlGoodMs),
    ttlBadMsEff: Math.round(S.tuneEff.ttlBadMs),
    badBiasInStormEff: Number(S.tuneEff.badBiasInStorm.toFixed(3)),

    device: (navigator && navigator.userAgent) ? navigator.userAgent : '',
    gameVersion: GAME_VERSION,

    hub: HUB
  };

  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

  emit('hha:end', summary);
  emit('hha:log_session', { action:'end', timestampIso: S.endTimeIso, reason, ...summary, ...CTX });
  emit('hha:log_event', { type:'session_end', reason, t: Date.now(), gameVersion: GAME_VERSION });

  injectBackToHub();

  coachSay('จบเกมแล้ว', 'กด Retry หรือกลับ HUB ได้เลย');
  uiUpdate();
}

function injectBackToHub(){
  if (!UI.endWrap) return;
  if (UI.endWrap.querySelector('[data-hha-backhub="1"]')) return;

  const btn = DOC.createElement('button');
  btn.className = 'btn secondary';
  btn.type = 'button';
  btn.textContent = '🏠 Back to HUB';
  btn.setAttribute('data-hha-backhub', '1');
  btn.style.marginLeft = '8px';
  btn.style.pointerEvents = 'auto';
  btn.addEventListener('click', ()=>{ location.href = HUB || './hub.html'; });

  const topRow = UI.endWrap.querySelector('.endCard > div');
  if (topRow) topRow.appendChild(btn);
}

// ------------------------- buttons + shooting crosshair -------------------------
function bindButtons(){
  UI.btnStart?.addEventListener('click', ()=>{
    AudioFX.resume();
    if (UI.startOverlay) UI.startOverlay.style.display = 'none';
    if (UI.endWrap) UI.endWrap.style.display = 'none';
    startGame();
  }, { passive:true });

  UI.btnStop?.addEventListener('click', ()=>{
    AudioFX.resume();
    endGame('stop');
  }, { passive:true });

  UI.btnRetry?.addEventListener('click', ()=>{
    AudioFX.resume();
    location.reload();
  }, { passive:true });

  UI.btnVR?.addEventListener('click', ()=>{
    AudioFX.resume();
    const scene = DOC.querySelector('a-scene');
    if (scene && scene.enterVR) {
      try{ scene.enterVR(); }catch(_){}
    } else {
      stamp('VR', 'อุปกรณ์นี้อาจไม่รองรับ WebXR เต็มรูปแบบ');
    }
  }, { passive:true });

  // shoot on tap only if NOT dragging
  UI.playfield?.addEventListener('pointerup', ()=>{
    if (!S.started || S.ended) return;
    if (S.dragOn) return;
    AudioFX.resume();

    const pf = UI.playfield.getBoundingClientRect();
    const cx = pf.left + pf.width/2;
    const cy = pf.top + pf.height/2;

    let best = null;
    let bestD = 999999;
    for (const obj of Live.values()){
      const r = obj.el.getBoundingClientRect();
      const ox = r.left + r.width/2;
      const oy = r.top + r.height/2;
      const d = (ox-cx)*(ox-cx) + (oy-cy)*(oy-cy);
      if (d < bestD){
        bestD = d;
        best = obj;
      }
    }

    if (best && bestD <= (110*110)){
      onHitOrb(best, { clientX: cx, clientY: cy });
    } else {
      flashEdge(0.10);
      emit('hha:judge', { type:'miss', reason:'shot_empty' });
      emit('hha:log_event', { type:'miss', reason:'shot_empty', t: Date.now(), secLeft: S.tLeftSec });
    }
  }, { passive:true });
}

// ------------------------- init -------------------------
(function init(){
  if (!DOC || !UI.playfield || !UI.layer){
    console.warn('[HydrationVR] missing DOM nodes');
    return;
  }

  ensureCrosshair(UI.playfield);

  coachSay('แตะ START เพื่อเริ่ม', 'Goal เป็นด่าน 1/3 → 2/3 → 3/3 แล้วเจอ Storm mini!');
  uiUpdate();

  bindButtons();
  bindLook();

  if (UI.endWrap) UI.endWrap.style.display = 'none';

  tickHandle = requestAnimationFrame(mainLoop);

  ROOT.__HVR__ = { S, TUNE, CTX, seed, GAME_VERSION };
})();