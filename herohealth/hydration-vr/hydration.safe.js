// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — Orb Identity + Cinematic Storm + HUD Quest Fix (P0+P1)
// ✅ Fix: Quest panel (bottom-right) not showing -> emit quest:update + hha:quest + cache replay
// ✅ Fix: Hit has NO effect -> built-in FX layer (bubble burst + score pop + punch) (no dependency)
// ✅ Fix: Expire policy: GOOD expire hurts; BAD expire in PLAY no penalty; STUDY penalty
// ✅ Fix: Goal counts while in GREEN (sec-based, hysteresis)
// ✅ Storm: warning (beep/tick) + thunder (ONLY beep/tick/thunder)
// ✅ Mini-Quest Storm: Shield timing in laser-fire window (NOW!)
// ✅ Keep Play mode “playable” แต่โหดแบบวิจัย (harsh tuning)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge } from '../vr/ui-water.js';

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

// seed (repro)
const SEED = String(getQS('sessionId','') || getQS('studentKey','') || '') + '|' + String(getQS('ts', Date.now()));

const $ = (id) => DOC ? DOC.getElementById(id) : null;
const pickEl = (ids=[]) => {
  for (const id of ids){
    const el = $(id);
    if (el) return el;
  }
  return null;
};

// -------------------- FX layer (built-in, no particles.js needed) --------------------
function ensureFxLayer(){
  if (!DOC) return null;
  let layer = DOC.querySelector('.hy-fx-layer');
  if (layer) return layer;

  layer = DOC.createElement('div');
  layer.className = 'hy-fx-layer';
  Object.assign(layer.style, {
    position:'fixed',
    inset:'0',
    pointerEvents:'none',
    zIndex:'9997'
  });
  DOC.body.appendChild(layer);

  if (!DOC.getElementById('hy-fx-style')){
    const st = DOC.createElement('style');
    st.id = 'hy-fx-style';
    st.textContent = `
      .hy-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font-weight:1000;
        letter-spacing:.2px;
        padding:8px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.18);
        background: rgba(2,6,23,.62);
        box-shadow: 0 20px 60px rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
        opacity:0;
        will-change: transform, opacity;
        animation: hyPop 680ms ease-out both;
      }
      @keyframes hyPop{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.85); }
        12%{ opacity:1; transform:translate(-50%,-52%) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-66%) scale(1.05); }
      }
      .hy-burst{
        position:absolute;
        width:10px;height:10px;
        border-radius:999px;
        transform: translate(-50%,-50%);
        background: rgba(255,255,255,.18);
        box-shadow:
          0 0 0 2px rgba(34,211,238,.16),
          0 0 22px rgba(59,130,246,.20);
        opacity:0;
        animation: hyBurst 520ms ease-out both;
        will-change: transform, opacity;
      }
      @keyframes hyBurst{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.5); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.2); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(2.3); }
      }
      .hy-bubble{
        position:absolute;
        width:8px;height:8px;
        border-radius:999px;
        background: rgba(255,255,255,.22);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
        opacity:0;
        animation: hyBubbleFly 600ms ease-out both;
        will-change: transform, opacity;
      }
      @keyframes hyBubbleFly{
        0%{ opacity:0; transform:translate3d(0,0,0) scale(.9); }
        10%{ opacity:.95; }
        100%{ opacity:0; transform:translate3d(var(--dx), var(--dy), 0) scale(1.2); }
      }
      .hy-punch{
        position:fixed; inset:0;
        pointer-events:none;
        z-index:9996;
        background: radial-gradient(900px 700px at 50% 45%, rgba(255,255,255,.18), rgba(0,0,0,0) 58%);
        opacity:0;
      }
      .hy-punch.on{
        animation: hyPunch 140ms ease-out both;
      }
      @keyframes hyPunch{
        0%{ opacity:0; }
        30%{ opacity:1; }
        100%{ opacity:0; }
      }
    `;
    DOC.head.appendChild(st);
  }

  if (!DOC.getElementById('hy-punch')){
    const punch = DOC.createElement('div');
    punch.id = 'hy-punch';
    punch.className = 'hy-punch';
    DOC.body.appendChild(punch);
  }

  return layer;
}

const FX = {
  layer: null,
  punchEl: null
};

function fxInit(){
  FX.layer = ensureFxLayer();
  FX.punchEl = DOC ? DOC.getElementById('hy-punch') : null;
}
fxInit();

function fxPunch(){
  if (!FX.punchEl) return;
  FX.punchEl.classList.remove('on');
  void FX.punchEl.offsetWidth;
  FX.punchEl.classList.add('on');
}

function fxScorePop(x,y,text){
  if (!FX.layer) return;
  const el = DOC.createElement('div');
  el.className = 'hy-pop';
  el.style.left = x+'px';
  el.style.top  = y+'px';
  el.textContent = String(text||'');
  FX.layer.appendChild(el);
  ROOT.setTimeout(()=>{ try{ el.remove(); }catch{} }, 900);
}

function fxBurst(x,y,intensity=1){
  if (!FX.layer) return;

  const ring = DOC.createElement('div');
  ring.className = 'hy-burst';
  ring.style.left = x+'px';
  ring.style.top  = y+'px';
  ring.style.transform = 'translate(-50%,-50%) scale(' + (0.75 + 0.25*intensity).toFixed(2) + ')';
  FX.layer.appendChild(ring);
  ROOT.setTimeout(()=>{ try{ ring.remove(); }catch{} }, 900);

  const n = Math.round(7 + 5*intensity);
  for (let i=0;i<n;i++){
    const b = DOC.createElement('div');
    b.className = 'hy-bubble';
    b.style.left = x+'px';
    b.style.top  = y+'px';
    const ang = Math.random()*Math.PI*2;
    const r = (14 + Math.random()*24) * (0.9 + 0.35*intensity);
    const dx = Math.cos(ang)*r;
    const dy = Math.sin(ang)*r - (18 + Math.random()*26);
    b.style.setProperty('--dx', dx.toFixed(1)+'px');
    b.style.setProperty('--dy', dy.toFixed(1)+'px');
    b.style.animationDelay = (Math.random()*40)+'ms';
    b.style.width = b.style.height = (6 + Math.random()*6)+'px';
    FX.layer.appendChild(b);
    ROOT.setTimeout(()=>{ try{ b.remove(); }catch{} }, 900);
  }
}

function centerFromEl(el){
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch{
    return { x: (ROOT.innerWidth||0)/2, y: (ROOT.innerHeight||0)/2 };
  }
}

// Optional Particles (if loaded)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){} };

// -------------------- Cinematic layer (storm) --------------------
function ensureCinematicLayer(){
  if (!DOC || DOC.getElementById('hy-cine-style')) return;

  const s = DOC.createElement('style');
  s.id = 'hy-cine-style';
  s.textContent = `
    .hy-vignette{
      position:fixed; inset:0; pointer-events:none; z-index:9995;
      opacity:0; transition: opacity .18s ease;
      background: radial-gradient(900px 620px at 50% 45%, rgba(0,0,0,0), rgba(0,0,0,.55) 60%, rgba(0,0,0,.88) 100%);
    }
    .hy-vignette.on{ opacity:1; }
    .hy-edge{
      position:fixed; inset:0; pointer-events:none; z-index:9995;
      opacity:0;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 90px rgba(255,80,96,.22);
      transition: opacity .12s ease;
    }
    .hy-edge.pulse{
      opacity:1;
      animation: hyEdgePulse .22s ease-in-out infinite;
    }
    @keyframes hyEdgePulse{
      0%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 78px rgba(255,80,96,.18); }
      50%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.07), inset 0 0 140px rgba(255,80,96,.36); }
      100%{ box-shadow: inset 0 0 0 2px rgba(255,255,255,.05), inset 0 0 95px rgba(255,80,96,.22); }
    }
    .hy-flash{
      position:fixed; inset:0; pointer-events:none; z-index:9995;
      opacity:0;
      background: radial-gradient(900px 700px at 50% 40%, rgba(255,255,255,.55), rgba(167,139,250,.22), rgba(0,0,0,0) 60%);
      transition: opacity .08s ease;
    }
    .hy-flash.on{ opacity:1; }
    .hy-count{
      position:fixed; left:50%; top:45%;
      transform:translate(-50%,-50%);
      z-index:9995; pointer-events:none;
      font-weight:1000; letter-spacing:.6px;
      padding:10px 14px; border-radius:18px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.62);
      box-shadow: 0 30px 90px rgba(0,0,0,.55);
      backdrop-filter: blur(10px);
      opacity:0;
    }
    .hy-count.show{
      opacity:1;
      animation: hyCountPop .18s ease-out both;
    }
    @keyframes hyCountPop{
      from{ transform:translate(-50%,-50%) scale(.92); }
      to{ transform:translate(-50%,-50%) scale(1); }
    }
    .hy-now{
      position:fixed;
      left:50%; top:58%;
      transform:translate(-50%,-50%);
      z-index:9995;
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
      50%{ transform:translate(-50%,-50%) scale(1.05); filter: brightness(1.2); }
      100%{ transform:translate(-50%,-50%) scale(1); filter: brightness(1); }
    }
    /* Orb shimmer */
    .hy-orb{
      position:absolute; inset:0;
      border-radius:999px; overflow:hidden; pointer-events:none;
    }
    .hy-orb::before{
      content:"";
      position:absolute; inset:-20%;
      background:
        radial-gradient(140px 120px at 30% 20%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%),
        radial-gradient(160px 140px at 70% 80%, rgba(34,211,238,.20), rgba(34,211,238,0) 60%),
        radial-gradient(160px 140px at 40% 70%, rgba(59,130,246,.16), rgba(59,130,246,0) 65%);
      opacity:.95;
      animation: hyDrift 1.5s ease-in-out infinite;
    }
    @keyframes hyDrift{
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
    .hy-hit{
      animation: hyHit .14s ease-out both;
    }
    @keyframes hyHit{
      0%{ transform: translate3d(var(--x), var(--y), 0) scale(var(--s)); filter: brightness(1); }
      50%{ transform: translate3d(var(--x), var(--y), 0) scale(calc(var(--s) * 1.10)); filter: brightness(1.2); }
      100%{ transform: translate3d(var(--x), var(--y), 0) scale(var(--s)); filter: brightness(1); }
    }
  `;
  DOC.head.appendChild(s);

  const vign = DOC.createElement('div'); vign.className='hy-vignette'; vign.id='hy-vignette';
  const edge = DOC.createElement('div'); edge.className='hy-edge'; edge.id='hy-edge';
  const flash = DOC.createElement('div'); flash.className='hy-flash'; flash.id='hy-flash';
  const cnt = DOC.createElement('div'); cnt.className='hy-count'; cnt.id='hy-count'; cnt.textContent='';
  const now = DOC.createElement('div'); now.className='hy-now'; now.id='hy-now'; now.textContent='🛡️ NOW! BLOCK THE BAD ⚡';

  DOC.body.appendChild(vign);
  DOC.body.appendChild(edge);
  DOC.body.appendChild(flash);
  DOC.body.appendChild(cnt);
  DOC.body.appendChild(now);
}
ensureCinematicLayer();

const CINE = {
  vign: DOC ? DOC.getElementById('hy-vignette') : null,
  edge: DOC ? DOC.getElementById('hy-edge') : null,
  flash: DOC ? DOC.getElementById('hy-flash') : null,
  count: DOC ? DOC.getElementById('hy-count') : null,
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
  const f = 520 + Math.round(240*intensity);
  beep(f, 0.04, 0.05);
}
function thunder(intensity=1.0){
  const ctx = ensureAudio(); if (!ctx) return;

  const dur = 0.55 + 0.25*clamp(intensity, 0.8, 1.4);
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

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180 + 40*intensity;

  const g = ctx.createGain();
  g.gain.value = 0.0001;

  noise.connect(lp); lp.connect(g); g.connect(ctx.destination);

  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12*intensity, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  noise.start(t0);
  noise.stop(t0 + dur + 0.02);

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

// -------------------- HUD elements (robust ids) --------------------
const EL = {
  waterZone: pickEl(['water-zone','hud-water-zone']),
  waterPct:  pickEl(['water-pct','hud-water-pct']),
  waterBar:  pickEl(['water-bar','hud-water-bar']),

  statScore: pickEl(['stat-score','hud-score']),
  statCombo: pickEl(['stat-combo','hud-combo']),
  statComboMax: pickEl(['stat-combo-max','hud-combo-max']),
  statMiss:  pickEl(['stat-miss','hud-miss']),
  statTime:  pickEl(['stat-time','hud-time']),
  statGrade: pickEl(['stat-grade','hud-grade']),

  questTitle: pickEl(['quest-title','hud-quest-title','hudQuestTitle']),
  q1: pickEl(['quest-line1','hud-quest-line1','quest-l1']),
  q2: pickEl(['quest-line2','hud-quest-line2','quest-l2']),
  q3: pickEl(['quest-line3','hud-quest-line3','quest-l3']),
  q4: pickEl(['quest-line4','hud-quest-line4','quest-l4']),

  feverPct: pickEl(['fever-pct','hud-fever-pct']),
  feverBar: pickEl(['fever-bar','hud-fever-bar']),

  coachFace: pickEl(['coach-face','hud-coach-face']),
  coachText: pickEl(['coach-text','hud-coach-text']),
  coachSub:  pickEl(['coach-sub','hud-coach-sub']),

  // optional “Storm Mini FULL panel”
  stormPressureBar: pickEl(['pressure-bar','storm-pressure-bar','mini-pressure-bar']),
  stormPressurePct: pickEl(['pressure-pct','storm-pressure-pct']),

  btnStart: $('btn-start'),
  btnMotion: $('btn-motion'),
  btnStop: $('btn-stop'),
  btnVR: $('btn-vr'),

  startOverlay: $('start-overlay'),

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

// -------------------- Quest cache (fix right-bottom not showing) --------------------
function cacheQuest(q){
  try{ ROOT.__HHA_LAST_QUEST__ = q; }catch{}
}
function replayQuestCache(){
  try{
    const q = ROOT.__HHA_LAST_QUEST__;
    if (q) {
      ROOT.dispatchEvent(new CustomEvent('quest:update', { detail: q }));
      ROOT.dispatchEvent(new CustomEvent('hha:quest', { detail: q }));
    }
  }catch{}
}

// -------------------- Game state --------------------
const GREEN_BANDS = {
  lowToGreen: 44,
  greenToLow: 40,
  greenToHigh: 70,
  highToGreen: 66
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
  if (pct >= GREEN_BANDS.lowToGreen) return 'GREEN';
  return 'LOW';
}

const GOAL_GREEN_NEED = (DIFF === 'easy') ? 10 : (DIFF === 'hard') ? 14 : 12;
const GOAL2_GREEN_NEED = (DIFF === 'easy') ? 12 : (DIFF === 'hard') ? 16 : 14;

const baseTune = {
  goodHit:  +10,
  goodPerfectBonus: +4,

  badHit:   -16,           // โหดขึ้น
  goodExpire: -10,         // โหดขึ้น

  // Water deltas (ลดการพุ่ง 100 ง่ายเกิน)
  waterGood: +4,
  waterGoodPerfect: +6,
  waterBad: -9,
  waterGoodExpire: -8,
  badExpirePlay: 0,
  badExpireStudy: -5,

  feverGood: +6,
  feverBad: -11,
  feverGoodExpire: -8,
  feverDecayPerSec: 1.15,

  shieldDurMs: 4200,

  // Cinematic / challenge
  laserWindowMs: 720,      // “จังหวะ” ชัดขึ้น
  stormWarnSec: 3,
  stormActiveSecPlay: 7,
  stormActiveSecStudy: 9,
};

const mult = (DIFF === 'easy') ? 0.92 : (DIFF === 'hard') ? 1.10 : 1.0;
const harsh = (RUN_MODE === 'study') ? 1.12 : 1.00;

const TUNE = {
  ...baseTune,
  goodHit: Math.round(baseTune.goodHit * mult),
  badHit: Math.round(baseTune.badHit * mult * harsh),
  goodExpire: Math.round(baseTune.goodExpire * harsh),
  waterGood: Math.round(baseTune.waterGood * mult),
  waterGoodPerfect: Math.round(baseTune.waterGoodPerfect * mult),
  waterBad: Math.round(baseTune.waterBad * mult * harsh),
  waterGoodExpire: Math.round(baseTune.waterGoodExpire * harsh),
  feverDecayPerSec: baseTune.feverDecayPerSec * harsh
};

const state = {
  started:false,
  ended:false,

  secLeft: DURATION,
  score:0,
  combo:0,
  comboMax:0,
  miss:0,
  grade:'C',

  waterPct: 50,
  zone: 'GREEN',
  feverPct: 0,

  shieldUntil: 0,

  lastLaserFireTs: 0,
  laserWindowMs: TUNE.laserWindowMs,

  goalIndex: 0,
  greenSecAcc: 0,
  goalsDone: 0,
  goalsTotal: 2,

  minisDone: 0,
  minisTotal: 999,

  // extra challenge: pressure (makes it more fun)
  pressure: 0,

  // storm
  storm: {
    id:0,
    warning:false,
    active:false,
    warnLeft:0,
    activeLeft:0,
    nextAtSec: Math.max(8, Math.floor(DURATION * 0.28)), // มาเร็วขึ้น = เร้าใจ
    periodSec: (RUN_MODE === 'study') ? 13 : 16,
    warnSec: TUNE.stormWarnSec,
    activeSec: (RUN_MODE === 'study') ? TUNE.stormActiveSecStudy : TUNE.stormActiveSecPlay
  },

  stormMini: { active:false, need:2, got:0, done:false, stormId:0 }
};

function isShieldOn(nowMs=Date.now()){
  return nowMs < state.shieldUntil;
}
function setShield(ms){
  const now = Date.now();
  state.shieldUntil = Math.max(state.shieldUntil, now + Math.max(900, ms|0));
  setCoach('🛡️','SHIELD ON!','กัน BAD ได้ — แต่ Storm mini ต้อง “จังหวะ laser-fire”');
}

function setCoach(face, text, sub){
  if (EL.coachFace) EL.coachFace.textContent = String(face || '🥦');
  if (EL.coachText) EL.coachText.textContent = String(text || '');
  if (EL.coachSub)  EL.coachSub.textContent  = String(sub || '');
  try{ ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { face, text, sub } })); }catch{}
}

function updateStatsUI(){
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
      waterPct: Math.round(state.waterPct),
      waterZone: state.zone
    }}));
  }catch{}
}

function updateFeverUI(){
  const pct = clamp(state.feverPct,0,100);
  if (EL.feverPct) EL.feverPct.textContent = String(Math.round(pct)) + '%';
  if (EL.feverBar) EL.feverBar.style.width = String(Math.round(pct)) + '%';
  try{ ROOT.dispatchEvent(new CustomEvent('hha:fever', { detail: { pct } })); }catch{}
}

function updateWaterUI(){
  const pct = clamp(state.waterPct,0,100);
  if (EL.waterPct) EL.waterPct.textContent = String(Math.round(pct)) + '%';
  if (EL.waterZone) EL.waterZone.textContent = String(state.zone || 'LOW');
  if (EL.waterBar) EL.waterBar.style.width = String(Math.round(pct)) + '%';
  try{
    ensureWaterGauge();
    setWaterGauge(pct);
  }catch{}
  try{ ROOT.dispatchEvent(new CustomEvent('hha:water', { detail: { pct, zone: state.zone } })); }catch{}
}

function updatePressureUI(){
  const p = clamp(state.pressure, 0, 100);
  if (EL.stormPressureBar) EL.stormPressureBar.style.width = Math.round(p) + '%';
  if (EL.stormPressurePct) EL.stormPressurePct.textContent = Math.round(p) + '%';
  try{ ROOT.dispatchEvent(new CustomEvent('hha:pressure', { detail: { pct: p } })); }catch{}
}

function cacheAndEmitQuest(detail){
  cacheQuest(detail);
  try{ ROOT.dispatchEvent(new CustomEvent('quest:update', { detail })); }catch{}
  try{ ROOT.dispatchEvent(new CustomEvent('hha:quest', { detail })); }catch{}
}

function updateQuestUI(){
  const goalNeed = (state.goalIndex === 0) ? GOAL_GREEN_NEED : GOAL2_GREEN_NEED;
  const goalLine = (state.goalIndex === 0)
    ? `Goal: อยู่ GREEN รวม ${GOAL_GREEN_NEED} วิ 🟢`
    : `Goal: อยู่ GREEN รวม ${GOAL2_GREEN_NEED} วิ (เข้มขึ้น) 🟢`;

  const mini = state.stormMini;
  let miniLine = `Mini (Storm): ใช้ Shield block BAD “ถูกจังหวะ” ${mini.got}/${mini.need}`;
  if (mini.done) miniLine = `Mini (Storm): สำเร็จ! ✅ ${mini.need}/${mini.need}`;

  let stateLine = '';
  if (state.storm.warning) stateLine = `⚠️ Storm warning: ${state.storm.warnLeft}s`;
  else if (state.storm.active) stateLine = `🌪️ STORM ACTIVE: ${state.storm.activeLeft}s · Pressure ${Math.round(state.pressure)}%`;
  else {
    const elapsed = (DURATION - state.secLeft);
    const eta = Math.max(0, state.storm.nextAtSec - elapsed);
    stateLine = `Next storm in ~${eta}s · Pressure ${Math.round(state.pressure)}%`;
  }

  const goalsLine = `Goals done: ${state.goalsDone}/${state.goalsTotal} · Minis done: ${state.minisDone}`;
  const progS = clamp(Math.round((state.goalsDone / Math.max(1,state.goalsTotal)) * 100), 0, 100);

  if (EL.questTitle) EL.questTitle.textContent = `Hydration Quest ${state.goalIndex + 1}`;
  if (EL.q1) EL.q1.textContent = goalLine;
  if (EL.q2) EL.q2.textContent = `${miniLine}`;
  if (EL.q3) EL.q3.textContent = `${stateLine} · ${goalsLine}`;
  if (EL.q4) EL.q4.textContent = `Progress to S: ${progS}%`;

  cacheAndEmitQuest({
    title: `Hydration Quest ${state.goalIndex + 1}`,
    line1: goalLine,
    line2: miniLine,
    line3: `${stateLine} · ${goalsLine}`,
    line4: `Progress to S: ${progS}%`,
    // extra (some HUD binders prefer structured fields)
    goalTitle: `Goal ${state.goalIndex + 1}`,
    goalText: goalLine,
    goalProgress: `${state.greenSecAcc}/${goalNeed}s`,
    miniTitle: `Storm Mini: Shield Timing`,
    miniText: miniLine,
    stateText: stateLine
  });
}

// -------------------- Score / combo / grade --------------------
function addCombo(){
  state.combo += 1;
  state.comboMax = Math.max(state.comboMax, state.combo);
}
function breakCombo(){
  state.combo = 0;
}
function addMiss(n=1){
  state.miss += (n|0);
}
function addScore(n=0){
  state.score += (n|0);
}

function applyWaterDelta(d){
  state.waterPct = clamp(state.waterPct + (Number(d)||0), 0, 100);
  state.zone = zoneFromPctHys(state.waterPct, state.zone);
  updateWaterUI();

  // pressure mechanic: out-of-green builds pressure (more fun)
  if (state.zone !== 'GREEN') state.pressure = clamp(state.pressure + 2.2, 0, 100);
  else state.pressure = clamp(state.pressure - 3.0, 0, 100);
  updatePressureUI();
}

function applyFeverDelta(d){
  state.feverPct = clamp(state.feverPct + (Number(d)||0), 0, 100);
  updateFeverUI();

  // high fever auto shield (identity)
  if (state.feverPct >= 92) setShield(2600);
}

function computeGrade(){
  const t = Math.max(1, DURATION);
  const scorePerSec = state.score / t;
  const missRate = state.miss / t;

  if (scorePerSec >= 13 && missRate <= 0.06 && state.goalsDone >= 2) return 'S';
  if (scorePerSec >= 10 && missRate <= 0.10 && state.goalsDone >= 1) return 'A';
  if (scorePerSec >= 7  && missRate <= 0.15) return 'B';
  return 'C';
}

// -------------------- Storm scheduling --------------------
function withinLaserWindow(){
  const now = Date.now();
  return (now - state.lastLaserFireTs) <= state.laserWindowMs;
}

function stormStartWarning(){
  if (state.storm.warning || state.storm.active) return;
  state.storm.warning = true;
  state.storm.warnLeft = state.storm.warnSec;

  cineVignette(true);
  cineEdgePulse(true);
  setCoach('⚠️','STORM WARNING!','อีก 3 วิพายุเข้า — เตรียม Shield + จังหวะ laser-fire!');
  cineCountShow('STORM IN 3');
  tick(1.0);

  let k = 0;
  const id = ROOT.setInterval(()=>{
    if (!state.started || state.ended) { try{ ROOT.clearInterval(id); }catch{}; return; }
    k++;
    state.storm.warnLeft = Math.max(0, state.storm.warnSec - k);

    const left = state.storm.warnLeft;
    tick(1.0 + 0.35*k);
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

  state.stormMini = { active:true, need:2, got:0, done:false, stormId: state.storm.id };

  cineFlash(140);
  thunder(1.15);
  setCoach('🌪️','STORM ACTIVE!','ตอน laser-fire ให้ block BAD “จังหวะนั้น” ถึงนับ mini!');
  updateQuestUI();

  // cinematic flashes
  const flashes = (RUN_MODE === 'study') ? 4 : 3;
  for (let i=0;i<flashes;i++){
    const t = 520 + Math.random()*1900;
    ROOT.setTimeout(()=>{ if (state.storm.active && state.started && !state.ended) cineFlash(110); }, t);
  }
}

function stormTickPerSecond(){
  const elapsed = (DURATION - state.secLeft);

  // schedule next storm
  if (!state.storm.warning && !state.storm.active && elapsed >= state.storm.nextAtSec){
    stormStartWarning();
    state.storm.nextAtSec = elapsed + state.storm.periodSec;
  }

  // active countdown + pressure spike
  if (state.storm.active){
    state.storm.activeLeft = Math.max(0, (state.storm.activeLeft|0) - 1);

    cineVignette(true);
    cineEdgePulse(true);

    // storm builds pressure fast (thrill)
    state.pressure = clamp(state.pressure + 6.5, 0, 100);
    updatePressureUI();

    if (state.storm.activeLeft <= 0){
      state.storm.active = false;
      cineEdgePulse(false);
      cineVignette(false);
      cineNow(false);

      if (state.stormMini && state.stormMini.done){
        state.minisDone += 1;
        fxScorePop((ROOT.innerWidth||0)/2, (ROOT.innerHeight||0)*0.62, 'MINI CLEAR ✅');
        setCoach('🤩','Storm mini ผ่านแล้ว!','คุมจังหวะได้ดีมาก!');
      } else {
        setCoach('😤','Storm จบแล้ว','รอบหน้า “จับจังหวะ laser-fire” ให้ตรงขึ้นนะ');
      }
      updateQuestUI();
    }
  } else if (!state.storm.warning){
    cineEdgePulse(false);
    cineVignette(false);
  }
}

// -------------------- Goal counting (GREEN every second) --------------------
function goalTickPerSecond(){
  if (state.zone === 'GREEN'){
    state.greenSecAcc += 1;
  }

  const need = (state.goalIndex === 0) ? GOAL_GREEN_NEED : GOAL2_GREEN_NEED;

  if (state.greenSecAcc >= need){
    state.goalsDone = Math.min(state.goalsTotal, state.goalsDone + 1);
    fxScorePop((ROOT.innerWidth||0)/2, (ROOT.innerHeight||0)*0.52, `GOAL ✅ GREEN ${need}s`);
    cineFlash(110);

    setCoach('🥦','ดีมาก! ผ่าน GOAL','ไปต่อ (เข้มขึ้น)');
    state.goalIndex = Math.min(state.goalsTotal-1, state.goalIndex + 1);
    state.greenSecAcc = 0;
    updateQuestUI();

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
    tick(0.95);
  }
  if (kind === 'laser-fire'){
    state.lastLaserFireTs = Date.now();
    if (state.storm.active){
      cineNow(true);
      tick(1.15 * intensity);
      ROOT.setTimeout(()=> cineNow(false), 520);
    }
  }
});

// -------------------- Spawn intensity (fun/challenge) --------------------
function spawnIntervalMul(){
  if (state.storm.active) return (RUN_MODE === 'study') ? 0.52 : 0.60;
  if (state.storm.warning) return 0.88;
  // pressure makes it more intense even outside storm
  const p = clamp(state.pressure, 0, 100);
  return clamp(1.0 - (p/100)*0.22, 0.75, 1.0);
}
function goodRateDynamic(){
  const base = (DIFF === 'easy') ? 0.68 : (DIFF === 'hard') ? 0.60 : 0.64;
  if (state.storm.active) return clamp(base - 0.14, 0.44, 0.70);
  if (state.storm.warning) return clamp(base - 0.08, 0.44, 0.75);
  // pressure pushes more BAD
  const p = clamp(state.pressure, 0, 100);
  return clamp(base - (p/100)*0.10, 0.48, 0.74);
}

// -------------------- ORB decorate (hydration identity) --------------------
function decorateOrb(el, parts, data, meta){
  try{
    const sz = meta.size || 78;
    const inner = (parts && parts.inner) ? parts.inner : el;

    if (parts && parts.icon){
      if (data.itemType === 'power') parts.icon.textContent = '🛡️';
      else if (data.itemType === 'bad') parts.icon.textContent = '☠️';
      else parts.icon.textContent = '';
      parts.icon.style.fontSize = Math.max(16, Math.round(sz * 0.22)) + 'px';
      parts.icon.style.opacity = (data.itemType === 'bad' || data.itemType === 'power') ? '0.92' : '0.0';
    }

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

    // add shimmer orb if not exists
    if (!inner.querySelector('.hy-orb')){
      const orb = DOC.createElement('div');
      orb.className = 'hy-orb';
      const b1 = DOC.createElement('i'); b1.className='bubble';
      b1.style.left='22%'; b1.style.top='58%'; b1.style.width=(sz*0.10)+'px'; b1.style.height=(sz*0.10)+'px';
      b1.style.animationDelay = (Math.random()*0.35).toFixed(2)+'s';
      const b2 = DOC.createElement('i'); b2.className='bubble';
      b2.style.left='62%'; b2.style.top='42%'; b2.style.width=(sz*0.08)+'px'; b2.style.height=(sz*0.08)+'px';
      b2.style.animationDelay = (Math.random()*0.35).toFixed(2)+'s';
      orb.appendChild(b1); orb.appendChild(b2);
      inner.appendChild(orb);
    }

    // ring style
    if (parts && parts.ring){
      parts.ring.style.border = '2px solid rgba(255,255,255,.22)';
      parts.ring.style.outline = '1px solid rgba(255,255,255,.08)';
      parts.ring.style.opacity = '0.88';
      parts.ring.style.filter = 'drop-shadow(0 0 14px rgba(255,255,255,.08))';
    }
  }catch{}
}

// -------------------- Judge / Expire + EFFECTS --------------------
function animateHit(el){
  if (!el) return;
  try{
    el.classList.remove('hy-hit');
    void el.offsetWidth;
    el.classList.add('hy-hit');
    ROOT.setTimeout(()=>{ try{ el.classList.remove('hy-hit'); }catch{} }, 220);
  }catch{}
}

function judge(_ch, ctx){
  const type = String(ctx.itemType || '');
  const perfect = !!ctx.hitPerfect;
  const el = ctx.el || ctx.targetEl || null;
  const c = el ? centerFromEl(el) : { x:(ROOT.innerWidth||0)/2, y:(ROOT.innerHeight||0)/2 };

  // helper: do common FX
  const doFx = (txt, intensity=1.0) => {
    animateHit(el);
    fxBurst(c.x, c.y, intensity);
    fxScorePop(c.x, c.y - 14, txt);
    fxPunch();
    try{ Particles.burstAt(c.x, c.y, { kind: type || 'hit' }); }catch{}
    try{ Particles.scorePop(c.x, c.y, txt); }catch{}
  };

  // BAD
  if (type === 'bad'){
    if (isShieldOn()){
      addScore(+2);
      doFx('BLOCK +2', 1.2);

      if (state.storm.active && state.stormMini.active && !state.stormMini.done){
        if (withinLaserWindow()){
          state.stormMini.got += 1;
          if (state.stormMini.got >= state.stormMini.need){
            state.stormMini.done = true;
            state.stormMini.active = false;
            setCoach('🤩','Perfect timing!','Storm mini สำเร็จแล้ว — รอดให้ครบ!');
            doFx('TIMED BLOCK ✅', 1.35);
          } else {
            setCoach('😎','Nice timed block!','อีก 1 ครั้ง — รอ NOW แล้วค่อย block');
            doFx('TIMED +1', 1.25);
          }
          updateQuestUI();
        } else {
          setCoach('😅','Block ได้ แต่ยังไม่ “จังหวะ”','รอ laser-fire (NOW!) ถึงจะนับ');
          doFx('BLOCK (NOT TIMED)', 1.0);
        }
      }
      return { good:true, kind:'bad-blocked', shield:true };
    }

    // hit bad
    breakCombo();
    addMiss(1);
    addScore(TUNE.badHit);
    applyWaterDelta(TUNE.waterBad);
    applyFeverDelta(TUNE.feverBad);

    setCoach('😟','โดน BAD!','เอา Shield ช่วย แล้วคุม GREEN ให้ได้');
    doFx(`${TUNE.badHit}`, 1.3);
    return { good:false, kind:'bad-hit' };
  }

  // POWER
  if (type === 'power'){
    addCombo();
    addScore(9);
    applyWaterDelta(+4);
    applyFeverDelta(+12);
    setShield(TUNE.shieldDurMs);
    setCoach('🛡️','Power ได้ Shield!','เก็บไว้ใช้ตอน storm / NOW window');
    doFx('POWER 🛡️', 1.25);
    updateQuestUI();
    return { good:true, kind:'power' };
  }

  // FAKEGOOD
  if (type === 'fakeGood'){
    addCombo();
    addScore(4 + (perfect ? 2 : 0));
    applyWaterDelta(+1);
    applyFeverDelta(+3);
    setCoach('🤨','น้ำลวงตา…','ได้แต้ม แต่ไม่ช่วยเท่าน้ำดี');
    doFx(perfect ? 'FAKE +6' : 'FAKE +4', 0.95);
    return { good:true, kind:'fakeGood' };
  }

  // GOOD
  addCombo();
  const sc = TUNE.goodHit + (perfect ? TUNE.goodPerfectBonus : 0);
  addScore(sc);
  applyWaterDelta(perfect ? TUNE.waterGoodPerfect : TUNE.waterGood);
  applyFeverDelta(TUNE.feverGood);

  if (perfect){
    setCoach('🤩','PERFECT!','คุมจังหวะดีมาก — รักษา GREEN ต่อ');
    doFx(`+${sc} PERFECT`, 1.25);
  } else {
    doFx(`+${sc}`, 1.05);
  }

  return { good:true, kind:'good-hit', perfect };
}

function onExpire(info){
  const type = String((info && info.itemType) ? info.itemType : '');
  if (!state.started || state.ended) return;

  if (type === 'good'){
    breakCombo();
    addMiss(1);
    addScore(TUNE.goodExpire);
    applyWaterDelta(TUNE.waterGoodExpire);
    applyFeverDelta(TUNE.feverGoodExpire);
    setCoach('😤','พลาดน้ำดี!','พยายามรักษา GREEN');
    return;
  }

  if (type === 'bad'){
    if (RUN_MODE === 'study'){
      breakCombo();
      addMiss(1);
      addScore(TUNE.badExpireStudy);
      applyWaterDelta(-2);
      setCoach('😤','BAD หลุด! (study)','โหมดวิจัย: BAD หลุดก็โดน');
    } else {
      setCoach('😎','หลบ BAD สำเร็จ','Play mode: ไม่โดนลงโทษจาก BAD expire');
    }
    return;
  }

  if (type === 'power'){
    addScore(-2);
    setCoach('😅','พลาด Power','ถ้าเก็บได้จะช่วยตอน storm');
    return;
  }

  if (type === 'fakeGood'){
    addScore(-1);
  }
}

// -------------------- End summary (P1 standard) --------------------
function makeSummary(){
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
    grade: state.grade
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

  state.grade = computeGrade();
  updateStatsUI();

  const sum = makeSummary();
  storeLastSummary(sum);

  try{ ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: sum })); }catch{}

  if (EL.endScore) EL.endScore.textContent = String(sum.scoreFinal);
  if (EL.endGrade) EL.endGrade.textContent = String(sum.grade);
  if (EL.endCombo) EL.endCombo.textContent = String(sum.comboMax);
  if (EL.endMiss) EL.endMiss.textContent = String(sum.misses);
  if (EL.endGoals) EL.endGoals.textContent = `${sum.goalsCleared}/${sum.goalsTotal}`;
  if (EL.endMinis) EL.endMinis.textContent = `${sum.miniCleared}/${sum.miniTotal}`;

  if (EL.endOverlay) EL.endOverlay.style.display = 'flex';
  setCoach('🥳','จบเกมแล้ว!','กด RETRY หรือกลับ HUB ได้เลย');
}

// -------------------- Engine boot --------------------
let factory = null;

function stopGame(){
  try{ if (factory && factory.stop) factory.stop(); }catch{}
  factory = null;
  showEnd();
}

function resetState(){
  state.started=false; state.ended=false;
  state.secLeft=DURATION;
  state.score=0; state.combo=0; state.comboMax=0; state.miss=0; state.grade='C';
  state.waterPct=50; state.zone='GREEN'; state.feverPct=0;
  state.shieldUntil=0;
  state.lastLaserFireTs=0;
  state.goalIndex=0; state.greenSecAcc=0; state.goalsDone=0;
  state.minisDone=0;
  state.pressure=0;

  state.storm.id=0;
  state.storm.warning=false; state.storm.active=false;
  state.storm.warnLeft=0; state.storm.activeLeft=0;
  state.storm.nextAtSec = Math.max(8, Math.floor(DURATION * 0.28));

  state.stormMini = { active:false, need:2, got:0, done:false, stormId:0 };
}

async function startGame(){
  if (state.started) return;
  resetState();
  state.started = true;

  // unlock audio
  ensureAudio();

  try{ ensureWaterGauge(); }catch{}
  updateWaterUI();
  updateFeverUI();
  updatePressureUI();

  state.grade = computeGrade();
  updateStatsUI();
  updateQuestUI();
  replayQuestCache();

  setCoach('💧','Hydration เริ่ม!','รักษา GREEN + เตรียม Storm');

  // per-second logic (listens to external timer if present, else local)
  let localTimer = null;

  const onTime = (ev)=>{
    if (!state.started || state.ended) return;
    const sec = (ev && ev.detail && Number.isFinite(ev.detail.sec)) ? (ev.detail.sec|0) : state.secLeft;
    state.secLeft = clamp(sec, 0, DURATION)|0;

    // fever decay
    applyFeverDelta(-TUNE.feverDecayPerSec);

    // pressure behavior: storm makes it rise
    if (state.storm.active) state.pressure = clamp(state.pressure + 4.0, 0, 100);
    updatePressureUI();

    goalTickPerSecond();
    stormTickPerSecond();

    state.grade = computeGrade();
    updateStatsUI();
    updateQuestUI();

    if (state.secLeft <= 0) stopGame();
  };

  // if some engine dispatches hha:time use it; else local interval fallback
  let hasExternalTime = false;
  const probe = (ev)=>{ hasExternalTime = true; onTime(ev); };
  ROOT.addEventListener('hha:time', probe);

  localTimer = ROOT.setInterval(()=>{
    if (hasExternalTime) return;
    if (!state.started || state.ended) return;
    state.secLeft = Math.max(0, state.secLeft - 1);
    onTime({ detail: { sec: state.secLeft } });
  }, 1000);

  const allowAdaptive = (RUN_MODE !== 'study');

  const pools = { good:[''], bad:[''], trick:[''] };
  const powerups = ['🛡️'];

  factory = await factoryBoot({
    modeKey: 'hydration',
    difficulty: DIFF,
    duration: DURATION,

    spawnHost: '#hvr-layer',
    boundsHost: '#playfield',

    spawnAroundCrosshair: false,
    spawnStrategy: 'grid9',
    minSeparation: 1.05,
    maxSpawnTries: 16,

    playPadXFrac: 0.10,
    playPadTopFrac: 0.14,
    playPadBotFrac: 0.16,
    autoRelaxSafezone: true,

    seed: SEED,

    goodRate: ()=> goodRateDynamic(),
    spawnIntervalMul: ()=> spawnIntervalMul(),

    powerups,
    powerRate: (RUN_MODE === 'study') ? 0.11 : 0.13,
    powerEvery: 7,
    trickRate: (RUN_MODE === 'study') ? 0.11 : 0.08,

    allowAdaptive,
    pools,
    decorateTarget: decorateOrb,

    judge,
    onExpire
  });

  // tap to shoot crosshair if mode-factory provides it
  const onTapShoot = ()=>{
    if (!state.started || state.ended) return;
    ensureAudio();
    try{
      if (factory && typeof factory.shootCrosshair === 'function'){
        factory.shootCrosshair();
      }
    }catch{}
  };
  DOC.addEventListener('pointerdown', onTapShoot, { passive:true });

  const cleanup = ()=>{
    try{ ROOT.removeEventListener('hha:time', probe); }catch{}
    try{ DOC.removeEventListener('pointerdown', onTapShoot); }catch{}
    try{ if (localTimer) ROOT.clearInterval(localTimer); }catch{}
  };
  ROOT.addEventListener('hha:stop', cleanup, { once:true });
}

// -------------------- Buttons (safe) --------------------
function bindButtons(){
  if (EL.btnStop){
    EL.btnStop.addEventListener('click', ()=>{
      try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
      stopGame();
    }, { passive:true });
  }
  if (EL.btnRetry){
    EL.btnRetry.addEventListener('click', ()=> ROOT.location.reload(), { passive:true });
  }
  if (EL.btnBack){
    EL.btnBack.addEventListener('click', ()=>{
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
      try{
        const el = DOC.documentElement;
        if (DOC.fullscreenElement) DOC.exitFullscreen();
        else if (el.requestFullscreen) el.requestFullscreen();
      }catch{}
    }, { passive:true });
  }
  if (EL.btnStart){
    EL.btnStart.addEventListener('click', ()=>{
      ensureAudio();
      startGame();
      if (EL.startOverlay) EL.startOverlay.style.display = 'none';
    }, { passive:true });
  }
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
}

// -------------------- Init --------------------
(function init(){
  bindButtons();

  // hard-set initial (prevents weird HUD empty)
  try{ ensureWaterGauge(); }catch{}
  state.waterPct = 50;
  state.zone = zoneFromPctHys(state.waterPct, 'GREEN');
  state.feverPct = 0;
  state.pressure = 0;

  updateWaterUI();
  updateFeverUI();
  updatePressureUI();

  state.grade = computeGrade();
  updateStatsUI();
  updateQuestUI();
  replayQuestCache();

  setCoach('🥦','พร้อมแล้ว เก็บน้ำดี ๆ นะ!','แตะเป้า หรือแตะกลางจอเพื่อยิง crosshair');

  // failsafe: if no overlay/start button, auto start
  if (!EL.startOverlay && !EL.btnStart) startGame();
})();
