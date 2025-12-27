// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — Orb Identity + Cinematic Storm Pack (P0+P1)
// ✅ Fix: water gauge not auto-climb / no random 100%
// ✅ Fix: expire policy (GOOD expire hurts; BAD expire in PLAY no penalty)
// ✅ Fix: Goal counts while in GREEN every second (with hysteresis)
// ✅ NEW: Storm warning (3..2..1) + tick ramp + thunder (beep/tick/thunder only)
// ✅ NEW: Mini-Quest (Storm Shield Timing) — block BAD at the right timing window
// ✅ NEW: Hydration unique “ORB” targets via decorateTarget override
// ✅ P1: End summary + Back HUB + store HHA_LAST_SUMMARY
// ✅ Emits standard events + direct HUD update fallback

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// -------------------- Root / helpers --------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const clamp = (v, a, b) => {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
};

const qs = new URLSearchParams((ROOT.location && ROOT.location.search) ? ROOT.location.search : '');
const getQS = (k, d='') => qs.has(k) ? String(qs.get(k) ?? '') : d;

const RUN_MODE = String(getQS('run', getQS('runMode','play')) || 'play').toLowerCase(); // play | study
const DIFF     = String(getQS('diff','normal') || 'normal').toLowerCase();              // easy|normal|hard
const DURATION = clamp(getQS('time', getQS('durationPlannedSec', 70)), 20, 180) | 0;
const HUB_URL  = String(getQS('hub','./hub.html') || './hub.html');

// Unique seed (research reproducibility)
const SEED = String(getQS('sessionId','') || getQS('studentKey','') || '') + '|' + String(getQS('ts', Date.now()));

// -------------------- DOM getters / safe refs --------------------
const $ = (id) => DOC ? DOC.getElementById(id) : null;

const EL = {
  // HUD
  waterZone: $('water-zone'),
  waterPct: $('water-pct'),
  waterBar: $('water-bar'),

  statScore: $('stat-score'),
  statCombo: $('stat-combo'),
  statComboMax: $('stat-combo-max'),
  statMiss: $('stat-miss'),
  statTime: $('stat-time'),
  statGrade: $('stat-grade'),

  questTitle: $('quest-title'),
  q1: $('quest-line1'),
  q2: $('quest-line2'),
  q3: $('quest-line3'),
  q4: $('quest-line4'),

  feverPct: $('fever-pct'),
  feverBar: $('fever-bar'),

  coachFace: $('coach-face'),
  coachText: $('coach-text'),
  coachSub: $('coach-sub'),

  // Buttons / overlays
  btnStart: $('btn-start'),
  btnMotion: $('btn-motion'),
  btnStop: $('btn-stop'),
  btnVR: $('btn-vr'),

  startOverlay: $('start-overlay'),
  stamp: $('hha-stamp'),
  stampBig: $('stamp-big'),
  stampSmall: $('stamp-small'),

  endOverlay: $('hvr-end'),
  endScore: $('end-score'),
  endGrade: $('end-grade'),
  endCombo: $('end-combo'),
  endMiss: $('end-miss'),
  endGoals: $('end-goals'),
  endMinis: $('end-minis'),
  btnRetry: $('btn-retry'),
  btnBack: $('btn-backhub')
};

// -------------------- Inject cinematic overlay (file-only patch) --------------------
function ensureCinematicLayer(){
  if (!DOC || DOC.getElementById('hy-cine-style')) return;

  const s = DOC.createElement('style');
  s.id = 'hy-cine-style';
  s.textContent = `
    .hy-cine-vignette{
      position:fixed; inset:0;
      pointer-events:none;
      z-index:9996;
      opacity:0;
      transition: opacity .18s ease;
      background:
        radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0), rgba(0,0,0,.55) 60%, rgba(0,0,0,.88) 100%);
      mix-blend-mode: normal;
    }
    .hy-cine-vignette.on{ opacity: 1; }
    .hy-cine-edge{
      position:fixed; inset:0;
      pointer-events:none;
      z-index:9996;
      opacity:0;
      transition: opacity .12s ease;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 80px rgba(255, 80, 96, .22);
      filter: drop-shadow(0 0 30px rgba(255,80,96,.15));
    }
    .hy-cine-edge.pulse{
      opacity: 1;
      animation: hyEdgePulse .22s ease-in-out infinite;
    }
    @keyframes hyEdgePulse{
      0%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 70px rgba(255,80,96,.18); }
      50%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.07), inset 0 0 120px rgba(255,80,96,.36); }
      100%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 85px rgba(255,80,96,.22); }
    }
    .hy-cine-flash{
      position:fixed; inset:0;
      pointer-events:none;
      z-index:9996;
      opacity:0;
      background: radial-gradient(900px 700px at 50% 40%, rgba(255,255,255,.55), rgba(167,139,250,.22), rgba(0,0,0,0) 60%);
      transition: opacity .08s ease;
    }
    .hy-cine-flash.on{ opacity: 1; }
    .hy-cine-count{
      position:fixed;
      left:50%; top:45%;
      transform:translate(-50%,-50%);
      z-index:9996;
      pointer-events:none;
      font-weight:1000;
      letter-spacing:.6px;
      padding:10px 14px;
      border-radius:18px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.62);
      box-shadow: 0 30px 90px rgba(0,0,0,.55);
      backdrop-filter: blur(10px);
      opacity:0;
    }
    .hy-cine-count.show{
      opacity:1;
      animation: hyCountPop .18s ease-out both;
    }
    @keyframes hyCountPop{
      from{ transform:translate(-50%,-50%) scale(.92); }
      to{ transform:translate(-50%,-50%) scale(1); }
    }
    .hy-orb{
      position:absolute;
      inset:0;
      border-radius:999px;
      overflow:hidden;
      pointer-events:none;
    }
    .hy-orb::before{
      content:"";
      position:absolute; inset:-20%;
      background:
        radial-gradient(140px 120px at 30% 20%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%),
        radial-gradient(160px 140px at 70% 80%, rgba(34,211,238,.20), rgba(34,211,238,0) 60%),
        radial-gradient(160px 140px at 40% 70%, rgba(59,130,246,.16), rgba(59,130,246,0) 65%);
      filter: blur(0px);
      opacity:.95;
      animation: hyWaterDrift 1.6s ease-in-out infinite;
    }
    @keyframes hyWaterDrift{
      0%{ transform: translate3d(-2%, -2%, 0) rotate(-6deg); }
      50%{ transform: translate3d(2%, 2%, 0) rotate(6deg); }
      100%{ transform: translate3d(-2%, -2%, 0) rotate(-6deg); }
    }
    .hy-orb .bubble{
      position:absolute;
      width:10px; height:10px;
      border-radius:999px;
      background: rgba(255,255,255,.22);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
      opacity:.75;
      animation: hyBubble 1.1s ease-in-out infinite;
    }
    @keyframes hyBubble{
      0%{ transform: translate3d(0,0,0) scale(.9); opacity:.45; }
      50%{ transform: translate3d(0,-6px,0) scale(1.02); opacity:.85; }
      100%{ transform: translate3d(0,0,0) scale(.92); opacity:.55; }
    }
    .hy-now{
      position:fixed;
      left:50%; top:58%;
      transform:translate(-50%,-50%);
      z-index:9996;
      pointer-events:none;
      font-weight:1000;
      padding:10px 14px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(255,80,96,.12);
      box-shadow: 0 0 0 1px rgba(255,80,96,.18), 0 24px 80px rgba(0,0,0,.55);
      opacity:0;
    }
    .hy-now.on{
      opacity:1;
      animation: hyNowPulse .14s ease-in-out infinite;
    }
    @keyframes hyNowPulse{
      0%{ transform:translate(-50%,-50%) scale(1); filter: brightness(1); }
      50%{ transform:translate(-50%,-50%) scale(1.04); filter: brightness(1.15); }
      100%{ transform:translate(-50%,-50%) scale(1); filter: brightness(1); }
    }
  `;
  DOC.head.appendChild(s);

  const vign = DOC.createElement('div'); vign.className='hy-cine-vignette'; vign.id='hy-cine-vignette';
  const edge = DOC.createElement('div'); edge.className='hy-cine-edge'; edge.id='hy-cine-edge';
  const flash = DOC.createElement('div'); flash.className='hy-cine-flash'; flash.id='hy-cine-flash';
  const cnt = DOC.createElement('div'); cnt.className='hy-cine-count'; cnt.id='hy-cine-count'; cnt.textContent='';
  const now = DOC.createElement('div'); now.className='hy-now'; now.id='hy-now'; now.textContent='🛡️ NOW! BLOCK THE BAD ⚡';

  DOC.body.appendChild(vign);
  DOC.body.appendChild(edge);
  DOC.body.appendChild(flash);
  DOC.body.appendChild(cnt);
  DOC.body.appendChild(now);
}
ensureCinematicLayer();

const CINE = {
  vign: DOC ? DOC.getElementById('hy-cine-vignette') : null,
  edge: DOC ? DOC.getElementById('hy-cine-edge') : null,
  flash: DOC ? DOC.getElementById('hy-cine-flash') : null,
  count: DOC ? DOC.getElementById('hy-cine-count') : null,
  now: DOC ? DOC.getElementById('hy-now') : null
};

function cineFlash(ms=110){
  if (!CINE.flash) return;
  CINE.flash.classList.add('on');
  ROOT.setTimeout(()=>{ try{ CINE.flash.classList.remove('on'); }catch{} }, ms);
}
function cineEdgePulse(on){
  if (!CINE.edge) return;
  if (on) CINE.edge.classList.add('pulse');
  else CINE.edge.classList.remove('pulse');
}
function cineVignette(on){
  if (!CINE.vign) return;
  if (on) CINE.vign.classList.add('on');
  else CINE.vign.classList.remove('on');
}
function cineCountShow(txt){
  if (!CINE.count) return;
  CINE.count.textContent = String(txt || '');
  CINE.count.classList.add('show');
  ROOT.setTimeout(()=>{ try{ CINE.count.classList.remove('show'); }catch{} }, 260);
}
function cineNow(on){
  if (!CINE.now) return;
  if (on) CINE.now.classList.add('on');
  else CINE.now.classList.remove('on');
}

// -------------------- WebAudio (beep/tick/thunder only) --------------------
let audioCtx = null;
function ensureAudio(){
  if (!ROOT.AudioContext && !ROOT.webkitAudioContext) return null;
  if (!audioCtx) audioCtx = new (ROOT.AudioContext || ROOT.webkitAudioContext)();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  return audioCtx;
}
function beep(freq=740, dur=0.06, gain=0.06){
  const ctx = ensureAudio(); if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function tick(intensity=1.0){
  // short clicky tick
  const f = 520 + Math.round(220*intensity);
  beep(f, 0.04, 0.05);
}
function thunder(intensity=1.0){
  const ctx = ensureAudio(); if (!ctx) return;

  // noise burst + low sine
  const dur = 0.55 + 0.20*clamp(intensity, 0.8, 1.4);
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i=0;i<bufferSize;i++){
    const t = i / bufferSize;
    const env = Math.exp(-5.2*t);
    data[i] = (Math.random()*2 - 1) * 0.45 * env;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 180 + 40*intensity;

  const g = ctx.createGain();
  g.gain.value = 0.0001;

  noise.connect(bp); bp.connect(g); g.connect(ctx.destination);

  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12*intensity, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  noise.start(t0);
  noise.stop(t0 + dur + 0.02);

  // low rumble
  const o = ctx.createOscillator();
  const g2 = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 52 + 12*intensity;
  g2.gain.value = 0.0001;
  o.connect(g2); g2.connect(ctx.destination);
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(0.08*intensity, t0 + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// -------------------- HUD update (direct + events) --------------------
function setCoach(face, text, sub){
  if (EL.coachFace) EL.coachFace.textContent = String(face || '🥦');
  if (EL.coachText) EL.coachText.textContent = String(text || '');
  if (EL.coachSub)  EL.coachSub.textContent  = String(sub || '');
  try{ ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { face, text, sub } })); }catch{}
}

function updateStatsUI(state){
  if (EL.statScore) EL.statScore.textContent = String(state.score|0);
  if (EL.statCombo) EL.statCombo.textContent = String(state.combo|0);
  if (EL.statComboMax) EL.statComboMax.textContent = String(state.comboMax|0);
  if (EL.statMiss) EL.statMiss.textContent = String(state.miss|0);
  if (EL.statTime) EL.statTime.textContent = String(state.secLeft|0);
  if (EL.statGrade) EL.statGrade.textContent = String(state.grade || 'C');

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:score', { detail: {
      score: state.score|0,
      combo: state.combo|0,
      comboMax: state.comboMax|0,
      miss: state.miss|0,
      grade: state.grade || 'C',
      waterPct: state.waterPct|0,
      waterZone: state.zone
    }}));
  }catch{}
}

function updateFeverUI(pct){
  pct = clamp(pct, 0, 100);
  if (EL.feverPct) EL.feverPct.textContent = String(Math.round(pct)) + '%';
  if (EL.feverBar) EL.feverBar.style.width = String(Math.round(pct)) + '%';
  try{ ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { pct } })); }catch{}
}

function updateWaterUI(pct, zone){
  pct = clamp(pct, 0, 100);
  if (EL.waterPct) EL.waterPct.textContent = String(Math.round(pct)) + '%';
  if (EL.waterZone) EL.waterZone.textContent = String(zone || 'LOW');
  if (EL.waterBar) EL.waterBar.style.width = String(Math.round(pct)) + '%';

  // keep ui-water module in sync too
  try{
    ensureWaterGauge();
    setWaterGauge(pct);
  }catch{}

  try{
    ROOT.dispatchEvent(new CustomEvent('hha:water', { detail: { pct, zone } }));
  }catch{}
}

function showStamp(big, small){
  if (!EL.stamp) return;
  if (EL.stampBig) EL.stampBig.textContent = String(big || 'OK!');
  if (EL.stampSmall) EL.stampSmall.textContent = String(small || '');
  EL.stamp.classList.remove('show');
  // force reflow
  void EL.stamp.offsetWidth;
  EL.stamp.classList.add('show');
}

// -------------------- Water model (NO auto climb!) --------------------
const GREEN_BANDS = {
  // hysteresis band to prevent flicker
  lowToGreen: 42,
  greenToLow: 38,
  greenToHigh: 72,
  highToGreen: 68
};

function zoneFromPctHys(pct, prevZone){
  pct = clamp(pct,0,100);
  const z = String(prevZone || '').toUpperCase();

  if (z === 'GREEN'){
    if (pct <= GREEN_BANDS.greenToLow) return 'LOW';
    if (pct >= GREEN_BANDS.greenToHigh) return 'HIGH';
    return 'GREEN';
  }
  if (z === 'HIGH'){
    if (pct <= GREEN_BANDS.highToGreen) return 'GREEN';
    return 'HIGH';
  }
  // LOW or unknown
  if (pct >= GREEN_BANDS.lowToGreen) return 'GREEN';
  return 'LOW';
}

// -------------------- Difficulty tuning (Play balanced but harsh like research) --------------------
const TUNE = (function(){
  // Base — keep “playable”, but penalties strong enough (as requested)
  const base = {
    goodHit:  +10,
    goodPerfectBonus: +4,
    badHit:   -14,
    goodExpire: -8,      // ✅ good disappears hurts
    badExpirePlay: 0,    // ✅ play = no penalty
    badExpireStudy: -5,  // study = penalty
    waterGood: +7,
    waterGoodPerfect: +9,
    waterBad: -11,
    waterGoodExpire: -7,
    waterBadExpireStudy: -4,
    feverGood: +6,
    feverBad: -10,
    feverGoodExpire: -7,
    feverDecayPerSec: 1.1,
    shieldDurMs: 4200
  };

  // difficulty scalers
  const mult = (DIFF === 'easy') ? 0.92 : (DIFF === 'hard') ? 1.12 : 1.0;
  const harsh = (RUN_MODE === 'study') ? 1.10 : 1.00;

  return {
    ...base,
    goodHit: Math.round(base.goodHit * mult),
    badHit: Math.round(base.badHit * mult * harsh),
    goodExpire: Math.round(base.goodExpire * harsh),
    waterGood: Math.round(base.waterGood * mult),
    waterBad: Math.round(base.waterBad * mult * harsh),
    waterGoodExpire: Math.round(base.waterGoodExpire * harsh),
    feverDecayPerSec: base.feverDecayPerSec * harsh
  };
})();

// -------------------- Goals / Minis (Hydration identity) --------------------
const GOAL_GREEN_NEED = (DIFF === 'easy') ? 10 : (DIFF === 'hard') ? 14 : 12; // seconds in GREEN
// Keep it “research-hard” but still fair in Play
const GOAL2_GREEN_NEED = (DIFF === 'easy') ? 12 : (DIFF === 'hard') ? 16 : 14;

const state = {
  started:false,
  ended:false,

  secLeft: DURATION,
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  waterPct: 50,         // ✅ start from balanced
  zone: 'GREEN',
  feverPct: 0,

  shieldUntil: 0,
  lastLaserFireTs: 0,
  laserWindowMs: 750,

  // goals
  goalIndex: 0,
  greenSecAcc: 0,
  goalsDone: 0,
  goalsTotal: 2,

  // minis
  minisDone: 0,
  minisTotal: 999, // open-ended
  stormMini: { active:false, need:2, got:0, done:false, stormId:0 },

  // storm
  storm: {
    id:0,
    warning:false,
    active:false,
    warnLeft:0,
    activeLeft:0,
    nextAtSec: Math.max(8, Math.floor(DURATION * 0.35)), // first storm mid-early
    periodSec: (RUN_MODE === 'study') ? 14 : 18,
    warnSec: 3,
    activeSec: (RUN_MODE === 'study') ? 8 : 7
  }
};

function isShieldOn(nowMs=Date.now()){
  return nowMs < state.shieldUntil;
}
function setShield(ms){
  const now = Date.now();
  state.shieldUntil = Math.max(state.shieldUntil, now + Math.max(900, ms|0));
  setCoach('🛡️','SHIELD ON!','กัน BAD ได้ — แต่ Storm timing ต้อง “จังหวะ” นะ');
}

function applyWaterDelta(d){
  // ✅ ONLY update when events happen (NO background auto-fill)
  state.waterPct = clamp(state.waterPct + (Number(d)||0), 0, 100);
  state.zone = zoneFromPctHys(state.waterPct, state.zone);
  updateWaterUI(state.waterPct, state.zone);
}

function applyFeverDelta(d){
  state.feverPct = clamp(state.feverPct + (Number(d)||0), 0, 100);
  updateFeverUI(state.feverPct);

  // optional auto-shield at high fever (hydration identity)
  if (state.feverPct >= 92) setShield(2600);
}

function addMiss(n=1){
  state.miss += (n|0);
}

function addScore(n){
  state.score += (n|0);
}

function addCombo(){
  state.combo += 1;
  state.comboMax = Math.max(state.comboMax, state.combo);
}
function breakCombo(){
  state.combo = 0;
}

function computeGrade(){
  // harsh but readable (SSS..C not shown in hydration HUD by default; keep simple A..C)
  // You can map to SSS later via global HUD if needed.
  const t = Math.max(1, DURATION);
  const scorePerSec = state.score / t;
  const missRate = state.miss / t;

  if (scorePerSec >= 13 && missRate <= 0.06 && state.goalsDone >= 2) return 'S';
  if (scorePerSec >= 10 && missRate <= 0.10 && state.goalsDone >= 1) return 'A';
  if (scorePerSec >= 7  && missRate <= 0.15) return 'B';
  return 'C';
}

function updateQuestUI(){
  if (EL.questTitle) EL.questTitle.textContent = `Hydration Quest ${state.goalIndex + 1}`;
  const goalName = (state.goalIndex === 0)
    ? `Goal: อยู่ GREEN รวม ${GOAL_GREEN_NEED} วิ 🟢`
    : `Goal: อยู่ GREEN รวม ${GOAL2_GREEN_NEED} วิ (เข้มขึ้น) 🟢`;

  // miniquest line (Storm only)
  const stormMini = state.stormMini;
  let miniLine = `Mini (Storm): ใช้ Shield block BAD “ถูกจังหวะ” ${stormMini.got}/${stormMini.need}`;
  if (stormMini.done) miniLine = `Mini (Storm): สำเร็จ! ✅ ${stormMini.need}/${stormMini.need}`;

  let stormLine = '';
  if (state.storm.warning) stormLine = `⚠️ Storm warning: ${state.storm.warnLeft}s`;
  else if (state.storm.active) stormLine = `🌪️ STORM ACTIVE: ${state.storm.activeLeft}s`;
  else stormLine = `Next storm in ~${Math.max(0, state.storm.nextAtSec - (DURATION - state.secLeft))}s`;

  const goalsLine = `Goals done: ${state.goalsDone} / ${state.goalsTotal} · Minis done: ${state.minisDone}`;
  const progToS = clamp(Math.round((state.goalsDone / state.goalsTotal) * 100), 0, 100);

  if (EL.q1) EL.q1.textContent = goalName;
  if (EL.q2) EL.q2.textContent = `${miniLine}`;
  if (EL.q3) EL.q3.textContent = `${stormLine} · ${goalsLine}`;
  if (EL.q4) EL.q4.textContent = `Progress to S: ${progToS}%`;

  try{
    ROOT.dispatchEvent(new CustomEvent('quest:update', { detail: {
      title: EL.questTitle ? EL.questTitle.textContent : 'Hydration Quest',
      line1: EL.q1 ? EL.q1.textContent : goalName,
      line2: EL.q2 ? EL.q2.textContent : miniLine,
      line3: EL.q3 ? EL.q3.textContent : goalsLine,
      line4: EL.q4 ? EL.q4.textContent : ''
    }}));
  }catch{}
}

// -------------------- Storm scheduling --------------------
function stormStartWarning(){
  if (state.storm.warning || state.storm.active) return;
  state.storm.warning = true;
  state.storm.warnLeft = state.storm.warnSec;

  cineVignette(true);
  cineEdgePulse(true);
  setCoach('⚠️','STORM WARNING!','อีก 3 วิพายุเข้า — เตรียม Shield + จังหวะ laser-fire!');
  cineCountShow('STORM IN 3');

  // tick ramp: 3..2..1
  let k = 0;
  const id = ROOT.setInterval(()=>{
    if (!state.started || state.ended) { try{ ROOT.clearInterval(id); }catch{}; return; }
    k++;
    state.storm.warnLeft = Math.max(0, state.storm.warnSec - k);
    const left = state.storm.warnLeft;

    // ramp tick intensity
    tick(1.0 + (0.3*k));
    cineCountShow(left > 0 ? `STORM IN ${left}` : 'GO!');

    if (left <= 0){
      try{ ROOT.clearInterval(id); }catch{}
      state.storm.warning = false;
      stormBegin();
    }
    updateQuestUI();
  }, 1000);
}

function stormBegin(){
  state.storm.id++;
  state.storm.active = true;
  state.storm.activeLeft = state.storm.activeSec;

  // reset storm mini
  state.stormMini = { active:true, need:2, got:0, done:false, stormId: state.storm.id };

  cineFlash(140);
  thunder(1.1);
  setCoach('🌪️','STORM ACTIVE!','ตอน laser-fire ให้กด block BAD “จังหวะนั้น” ถึงนับ mini!');
  updateQuestUI();

  // random lightning flashes (throttled)
  const flashes = (RUN_MODE === 'study') ? 3 : 2;
  for (let i=0;i<flashes;i++){
    const t = 600 + Math.random()*1800;
    ROOT.setTimeout(()=>{ if (state.storm.active && state.started && !state.ended) cineFlash(110); }, t);
  }
}

function stormTickPerSecond(){
  const elapsed = (DURATION - state.secLeft);

  // schedule next storm
  if (!state.storm.warning && !state.storm.active && elapsed >= state.storm.nextAtSec){
    stormStartWarning();
    // plan next cycle
    state.storm.nextAtSec = elapsed + state.storm.periodSec;
  }

  // storm active countdown
  if (state.storm.active){
    state.storm.activeLeft = Math.max(0, (state.storm.activeLeft|0) - 1);
    // cinematic intensity (pulse on)
    cineVignette(true);
    cineEdgePulse(true);

    if (state.storm.activeLeft <= 0){
      state.storm.active = false;
      cineEdgePulse(false);
      cineVignette(false);

      if (state.stormMini && state.stormMini.done){
        state.minisDone += 1;
        showStamp('MINI!', `Storm Shield ${state.stormMini.need}/${state.stormMini.need}`);
        setCoach('🤩','Storm mini ผ่านแล้ว!','คุมจังหวะได้ดีมาก!');
      } else {
        setCoach('😤','Storm จบแล้ว','รอบหน้า “จับจังหวะ laser-fire” ให้ตรงขึ้นนะ');
      }
      updateQuestUI();
    }
  } else if (!state.storm.warning) {
    // calm state
    cineEdgePulse(false);
    cineVignette(false);
  }
}

// -------------------- Goal counting (GREEN every second) --------------------
function goalTickPerSecond(){
  // ✅ must count while GREEN (with hysteresis)
  if (state.zone === 'GREEN'){
    state.greenSecAcc += 1;
  }

  const need = (state.goalIndex === 0) ? GOAL_GREEN_NEED : GOAL2_GREEN_NEED;

  if (state.greenSecAcc >= need){
    state.goalsDone = Math.min(state.goalsTotal, state.goalsDone + 1);
    showStamp('GOAL!', `GREEN ${need}s`);
    setCoach('🥦','ดีมาก! GREEN สำเร็จ','ไปต่อ goal ถัดไป (เข้มขึ้น)');
    cineFlash(120);

    // advance goal
    state.goalIndex = Math.min(state.goalsTotal-1, state.goalIndex + 1);
    state.greenSecAcc = 0;
    updateQuestUI();

    // small celebration
    try{ ROOT.dispatchEvent(new CustomEvent('hha:celebrate', { detail: { kind:'goal', label:'GREEN' } })); }catch{}
  }
}

// -------------------- Listen laser ticks from mode-factory --------------------
ROOT.addEventListener('hha:tick', (ev)=>{
  const d = ev && ev.detail ? ev.detail : {};
  const kind = String(d.kind || '');
  const intensity = Number(d.intensity || 1.0);

  if (!state.started || state.ended) return;

  if (kind === 'laser-warn'){
    // subtle pre-warning, not too spammy
    tick(0.9);
  }
  if (kind === 'laser-fire'){
    // ✅ timing window for storm mini
    state.lastLaserFireTs = Date.now();
    // cinematic NOW indicator only during storm
    if (state.storm.active){
      cineNow(true);
      tick(1.15 * intensity);
      ROOT.setTimeout(()=> cineNow(false), 520);
    }
  }
});

// -------------------- Spawn mul hook (storm + warning) --------------------
function spawnIntervalMul(){
  if (state.storm.active) return (RUN_MODE === 'study') ? 0.55 : 0.62;
  if (state.storm.warning) return 0.90;
  return 1.0;
}

// -------------------- Target decorate (Hydration ORB identity) --------------------
function decorateOrb(el, parts, data, meta){
  try{
    // hide emoji-ish feel (keep tiny icon only for power)
    if (parts && parts.icon){
      if (data.itemType === 'power'){
        parts.icon.textContent = '🛡️';
      } else if (data.itemType === 'bad'){
        parts.icon.textContent = '☠️';
      } else {
        parts.icon.textContent = ''; // orb-only
      }
      parts.icon.style.fontSize = Math.max(16, Math.round(meta.size * 0.22)) + 'px';
      parts.icon.style.opacity = (data.itemType === 'bad' || data.itemType === 'power') ? '0.92' : '0.0';
    }

    // override palette to “water orb”
    const sz = meta.size || 78;

    if (data.itemType === 'bad'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,120,120,.95), rgba(234,88,12,.92))';
      el.style.boxShadow = '0 16px 34px rgba(0,0,0,.55), 0 0 0 2px rgba(255,80,96,.22), 0 0 24px rgba(255,80,96,.28)';
    } else if (data.itemType === 'power'){
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(250,204,21,.95), rgba(249,115,22,.92))';
      el.style.boxShadow = '0 16px 34px rgba(0,0,0,.55), 0 0 0 2px rgba(250,204,21,.28), 0 0 24px rgba(250,204,21,.24)';
    } else {
      el.style.background = 'radial-gradient(circle at 30% 25%, rgba(34,211,238,.85), rgba(59,130,246,.85))';
      el.style.boxShadow = '0 16px 34px rgba(0,0,0,.55), 0 0 0 2px rgba(34,211,238,.22), 0 0 22px rgba(59,130,246,.22)';
    }

    // add orb shimmer layer + bubbles
    const orb = DOC.createElement('div');
    orb.className = 'hy-orb';

    const b1 = DOC.createElement('i'); b1.className='bubble';
    b1.style.left='22%'; b1.style.top='58%'; b1.style.width=(sz*0.10)+'px'; b1.style.height=(sz*0.10)+'px';
    b1.style.animationDelay = (Math.random()*0.35).toFixed(2)+'s';

    const b2 = DOC.createElement('i'); b2.className='bubble';
    b2.style.left='62%'; b2.style.top='42%'; b2.style.width=(sz*0.08)+'px'; b2.style.height=(sz*0.08)+'px';
    b2.style.animationDelay = (Math.random()*0.35).toFixed(2)+'s';

    orb.appendChild(b1); orb.appendChild(b2);
    (parts && parts.inner ? parts.inner : el).appendChild(orb);

    // ring styling less “dashed”, more “fluid”
    if (parts && parts.ring){
      parts.ring.style.border = '2px solid rgba(255,255,255,.22)';
      parts.ring.style.outline = '1px solid rgba(255,255,255,.08)';
      parts.ring.style.opacity = '0.88';
      parts.ring.style.filter = 'drop-shadow(0 0 14px rgba(255,255,255,.08))';
    }
  }catch{}
}

// -------------------- Judge / Expire --------------------
function withinLaserWindow(){
  const now = Date.now();
  return (now - state.lastLaserFireTs) <= state.laserWindowMs;
}

function judge(ch, ctx){
  // ctx: { itemType, hitPerfect, ... }
  const type = String(ctx.itemType || '');
  const perfect = !!ctx.hitPerfect;

  // shield block logic
  const shieldOn = isShieldOn(Date.now());

  // BAD
  if (type === 'bad'){
    if (shieldOn){
      // blocked: no penalty
      addScore(+2);
      // mini counts only during storm & only if within timing window
      if (state.storm.active && state.stormMini && state.stormMini.active && !state.stormMini.done){
        if (withinLaserWindow()){
          state.stormMini.got += 1;
          showStamp('BLOCK!', `${state.stormMini.got}/${state.stormMini.need}`);
          cineFlash(90);
          if (state.stormMini.got >= state.stormMini.need){
            state.stormMini.done = true;
            state.stormMini.active = false;
            setCoach('🤩','Perfect timing!','Storm mini สำเร็จแล้ว — รอดพายุให้ครบ!');
          } else {
            setCoach('😎','Nice block!','อีกนิดเดียว — รอ laser-fire แล้วค่อย block อีกที');
          }
          updateQuestUI();
        } else {
          // blocked but not “timed”
          setCoach('😅','Block ได้ แต่ยังไม่ “จังหวะ”','ให้รอช่วง laser-fire (NOW!) ถึงจะนับ');
        }
      }
      return { good:true, scoreDelta:+2, kind:'bad-blocked', shield:true };
    }

    // hit bad (penalty)
    breakCombo();
    addMiss(1);
    addScore(TUNE.badHit);
    applyWaterDelta(TUNE.waterBad);
    applyFeverDelta(TUNE.feverBad);

    setCoach('😟','โดน BAD!','ถ้ามี Shield จะกันได้ — และช่วง storm ต้องจับจังหวะ');
    return { good:false, scoreDelta:TUNE.badHit, kind:'bad-hit' };
  }

  // POWER
  if (type === 'power'){
    addCombo();
    addScore(8);
    applyWaterDelta(+5);
    applyFeverDelta(+12);
    setShield(TUNE.shieldDurMs);
    showStamp('POWER!', '+SHIELD');
    updateQuestUI();
    return { good:true, scoreDelta:+8, kind:'power' };
  }

  // FAKEGOOD (soft reward; still “hydration orb”)
  if (type === 'fakeGood'){
    addCombo();
    addScore(4);
    applyWaterDelta(+2);
    applyFeverDelta(+3);
    if (perfect) addScore(+2);
    setCoach('🤨','นี่น้ำจริงไหมนะ…','ได้แต้มเล็กน้อย แต่ไม่แรงเท่าน้ำดี');
    return { good:true, scoreDelta:+4, kind:'fakeGood' };
  }

  // GOOD
  addCombo();
  addScore(TUNE.goodHit + (perfect ? TUNE.goodPerfectBonus : 0));
  applyWaterDelta(perfect ? TUNE.waterGoodPerfect : TUNE.waterGood);
  applyFeverDelta(TUNE.feverGood);
  if (perfect) showStamp('PERFECT!', '+BONUS');

  return { good:true, scoreDelta:(TUNE.goodHit + (perfect?TUNE.goodPerfectBonus:0)), kind:'good-hit', perfect };
}

function onExpire(info){
  const type = String((info && info.itemType) ? info.itemType : '');
  if (!state.started || state.ended) return;

  if (type === 'good'){
    // ✅ GOOD expire hurts
    breakCombo();
    addMiss(1);
    addScore(TUNE.goodExpire);
    applyWaterDelta(TUNE.waterGoodExpire);
    applyFeverDelta(TUNE.feverGoodExpire);
    setCoach('😤','พลาดน้ำดี!','พยายามรักษา GREEN นะ');
    return;
  }

  if (type === 'bad'){
    if (RUN_MODE === 'study'){
      // study is harsh
      breakCombo();
      addMiss(1);
      addScore(TUNE.badExpireStudy);
      applyWaterDelta(TUNE.waterBadExpireStudy);
      setCoach('😤','BAD หลุด! (study)','ในโหมดวิจัย BAD หลุดก็โดนด้วยนะ');
    } else {
      // play: no penalty
      setCoach('😎','หลบ BAD สำเร็จ','Play mode: ไม่โดนลงโทษจาก BAD expire');
    }
    return;
  }

  if (type === 'power'){
    // power expire: small miss, but not harsh
    addScore(-2);
    setCoach('😅','พลาด Power','ถ้าเก็บได้จะได้ Shield ช่วยตอน storm');
    return;
  }

  if (type === 'fakeGood'){
    // harmless
    addScore(-1);
  }
}

// -------------------- End summary + Back HUB (P1 standard) --------------------
function makeSummary(){
  const grade = computeGrade();
  return {
    timestampIso: new Date().toISOString(),
    projectTag: getQS('projectTag','HeroHealth'),
    runMode: RUN_MODE,
    sessionId: getQS('sessionId','') || getQS('sessionKey','') || '',
    gameMode: 'hydration',
    diff: DIFF,
    durationPlannedSec: DURATION,
    durationPlayedSec: DURATION - state.secLeft,
    scoreFinal: state.score|0,
    comboMax: state.comboMax|0,
    misses: state.miss|0,
    goalsCleared: state.goalsDone|0,
    goalsTotal: state.goalsTotal|0,
    miniCleared: state.minisDone|0,
    miniTotal: state.minisTotal|0,
    waterEndPct: Math.round(state.waterPct),
    grade
  };
}

function storeLastSummary(sum){
  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(sum || {}));
    localStorage.setItem('hha_last_summary', JSON.stringify(sum || {}));
  }catch{}
}

function showEnd(){
  if (state.ended) return;
  state.ended = true;

  const grade = computeGrade();
  state.grade = grade;

  const sum = makeSummary();
  storeLastSummary(sum);

  // update end overlay
  if (EL.endScore) EL.endScore.textContent = String(sum.scoreFinal);
  if (EL.endGrade) EL.endGrade.textContent = String(sum.grade);
  if (EL.endCombo) EL.endCombo.textContent = String(sum.comboMax);
  if (EL.endMiss) EL.endMiss.textContent = String(sum.misses);
  if (EL.endGoals) EL.endGoals.textContent = `${sum.goalsCleared}/${sum.goalsTotal}`;
  if (EL.endMinis) EL.endMinis.textContent = `${sum.miniCleared}/${sum.miniTotal}`;

  updateStatsUI({ ...state, grade });

  // emit
  try{ ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: sum })); }catch{}

  if (EL.endOverlay){
    EL.endOverlay.style.display = 'flex';
  }
  setCoach('🥳','จบเกมแล้ว!','กด RETRY หรือกลับ HUB ได้เลย');
}

// -------------------- Boot game engine --------------------
let factory = null;

function bindButtons(){
  if (EL.btnStop){
    EL.btnStop.addEventListener('click', ()=>{
      try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
      stopGame();
    }, { passive:true });
  }

  if (EL.btnRetry){
    EL.btnRetry.addEventListener('click', ()=>{
      // keep same params but refresh
      ROOT.location.reload();
    }, { passive:true });
  }

  if (EL.btnBack){
    EL.btnBack.addEventListener('click', ()=>{
      // go hub, keep context
      try{
        const u = new URL(HUB_URL, ROOT.location.href);
        u.searchParams.set('ts', String(Date.now()));
        ROOT.location.href = u.toString();
      }catch{
        ROOT.location.href = HUB_URL;
      }
    }, { passive:true });
  }

  if (EL.btnVR){
    EL.btnVR.addEventListener('click', ()=>{
      // simple fullscreen helper (optional)
      try{
        const el = DOC.documentElement;
        if (DOC.fullscreenElement) DOC.exitFullscreen();
        else if (el.requestFullscreen) el.requestFullscreen();
      }catch{}
    }, { passive:true });
  }

  if (EL.btnStart){
    EL.btnStart.addEventListener('click', async ()=>{
      ensureAudio(); // unlock audio
      startGame();
    }, { passive:true });
  }

  // iOS motion permission (if needed)
  if (EL.btnMotion){
    EL.btnMotion.addEventListener('click', async ()=>{
      try{
        if (ROOT.DeviceMotionEvent && typeof ROOT.DeviceMotionEvent.requestPermission === 'function'){
          await ROOT.DeviceMotionEvent.requestPermission();
          EL.btnMotion.style.display = 'none';
          setCoach('✅','Motion enabled','พร้อมเล่น VR-feel แล้ว');
        }
      }catch{}
    }, { passive:true });
  }

  // show motion button only if requestPermission exists
  try{
    if (EL.btnMotion && ROOT.DeviceMotionEvent && typeof ROOT.DeviceMotionEvent.requestPermission === 'function'){
      EL.btnMotion.style.display = 'inline-flex';
    }
  }catch{}
}

function setStartOverlay(show){
  if (!EL.startOverlay) return;
  EL.startOverlay.style.display = show ? 'flex' : 'none';
}

function resetState(){
  state.started = false;
  state.ended = false;

  state.secLeft = DURATION;
  state.score = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.miss = 0;

  state.waterPct = 50;
  state.zone = 'GREEN';
  state.feverPct = 0;

  state.shieldUntil = 0;
  state.lastLaserFireTs = 0;

  state.goalIndex = 0;
  state.greenSecAcc = 0;
  state.goalsDone = 0;

  state.minisDone = 0;
  state.stormMini = { active:false, need:2, got:0, done:false, stormId:0 };

  state.storm = {
    ...state.storm,
    id:0,
    warning:false,
    active:false,
    warnLeft:0,
    activeLeft:0,
    nextAtSec: Math.max(8, Math.floor(DURATION * 0.35))
  };
}

function updateAllUI(){
  updateWaterUI(state.waterPct, state.zone);
  updateFeverUI(state.feverPct);
  state.grade = computeGrade();
  updateStatsUI({ ...state, grade: state.grade });
  updateQuestUI();
}

function stopGame(){
  try{ if (factory && factory.stop) factory.stop(); }catch{}
  factory = null;
  showEnd();
}

async function startGame(){
  if (state.started) return;
  resetState();
  state.started = true;

  setStartOverlay(false);

  // Ensure water gauge exists & set initial
  try{ ensureWaterGauge(); }catch{}
  updateAllUI();

  // Coach intro
  setCoach('💧','Hydration 시작!','รักษา GREEN และเตรียมรับ STORM');

  // Setup hha:time listener for per-second logic
  const onTime = (ev)=>{
    if (!state.started || state.ended) return;
    const sec = (ev && ev.detail && Number.isFinite(ev.detail.sec)) ? (ev.detail.sec|0) : state.secLeft;
    state.secLeft = clamp(sec, 0, DURATION)|0;

    // fever decay only once per sec
    applyFeverDelta(-TUNE.feverDecayPerSec);

    // goal tick + storm tick
    goalTickPerSecond();
    stormTickPerSecond();

    // grade refresh
    state.grade = computeGrade();
    updateStatsUI({ ...state, grade: state.grade });
    updateQuestUI();

    if (state.secLeft <= 0){
      stopGame();
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // Spawn pools (hydration identity)
  const pools = {
    good: [''],         // we render orb (no emoji)
    bad:  [''],         // orb with skull icon overlay
    trick:['']          // fakeGood minimal
  };
  const powerups = ['🛡️'];

  // In play: adaptive ON; in study: adaptive OFF
  const allowAdaptive = (RUN_MODE !== 'study');

  // Good rate: hydration should feel “manageable”, but storm makes it nasty
  const baseGoodRate = (DIFF === 'easy') ? 0.68 : (DIFF === 'hard') ? 0.60 : 0.64;

  function goodRateDynamic(){
    if (state.storm.active) return clamp(baseGoodRate - 0.12, 0.45, 0.70);
    if (state.storm.warning) return clamp(baseGoodRate - 0.06, 0.45, 0.75);
    return baseGoodRate;
  }

  // Boot spawner
  factory = await factoryBoot({
    modeKey: 'hydration',
    difficulty: DIFF,
    duration: DURATION,

    // hosts
    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',

    // spawn behavior
    spawnAroundCrosshair: false,           // ✅ hydration = full-spread (distinct feel)
    spawnStrategy: 'grid9',                // ✅ distribute on screen
    minSeparation: 1.05,
    maxSpawnTries: 16,

    // safezone padding
    playPadXFrac: 0.10,
    playPadTopFrac: 0.14,
    playPadBotFrac: 0.16,

    autoRelaxSafezone: true,

    // seeded rng for reproducible research
    seed: SEED,

    // dynamic rates / intervals
    goodRate: goodRateDynamic(),
    spawnIntervalMul: ()=> spawnIntervalMul(),

    // make storms feel “heavier” by adding more BAD & more power pressure
    powerups,
    powerRate: (RUN_MODE === 'study') ? 0.10 : 0.12,
    powerEvery: 7,
    trickRate: (RUN_MODE === 'study') ? 0.10 : 0.08,

    allowAdaptive,
    rhythm: null,

    pools,
    decorateTarget: decorateOrb,

    judge,
    onExpire
  });

  // Touch middle screen to shoot crosshair (if you want)
  const onTapShoot = (ev)=>{
    if (!state.started || state.ended) return;
    // allow audio
    ensureAudio();
    try{
      if (factory && typeof factory.shootCrosshair === 'function'){
        const ok = factory.shootCrosshair();
        if (ok) return;
      }
    }catch{}
  };
  DOC.addEventListener('pointerdown', onTapShoot, { passive:true });

  // Stop cleanup when end
  const onStop = ()=>{
    ROOT.removeEventListener('hha:time', onTime);
    DOC.removeEventListener('pointerdown', onTapShoot);
  };
  ROOT.addEventListener('hha:stop', onStop, { once:true });

  // Start: immediate storm plan update in UI
  updateQuestUI();
}

// -------------------- Startup default UI (prevent “not showing”) --------------------
(function init(){
  bindButtons();

  // Force initial stable values (prevent random 100%)
  try{ ensureWaterGauge(); }catch{}
  state.waterPct = 50;
  state.zone = zoneFromPctHys(state.waterPct, 'GREEN');
  state.feverPct = 0;

  updateAllUI();
  setCoach('🥦','พร้อมแล้ว เก็บน้ำดี ๆ นะ!','แตะเป้า หรือแตะกลางจอเพื่อยิง crosshair');

  // If start overlay missing, just auto-start (failsafe)
  if (!EL.startOverlay && EL.btnStart == null){
    startGame();
  }
})();
