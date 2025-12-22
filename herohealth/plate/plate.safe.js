// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (ALL-IN / ULTIMATE / Factory + Boss multi-hit)
//
// ✅ ใช้ mode-factory.js เป็นตัว spawn/expire ทั้งหมด
// ✅ BOSS อยู่ใน factory (multi-hit + HP) — judge return {remove:false} จน HP=0
// ✅ Plate skin เหมือน plateTarget (แต่ไม่แตะ transform ของ factory)
// ✅ Tap-anywhere ยิงกลางจอ + Aim assist + PERFECT zone
// ✅ Fever + Shield + Lives (shield block: ไม่เพิ่ม MISS/ไม่ลดหัวใจ)
// ✅ Goals(2) + Minis(7) (Plate Rush + urgent tick/flash/shake)
// ✅ Boss attacks (ring/laser/double) + telegraph + punish
// ✅ Powerups: Slow / No-Junk / Storm (spawn ถี่ขึ้นจริง) via spawnIntervalMul
// ✅ Coach bubble + FX hooks (Particles) + Logger events
//
// HTML expects: A-Frame, particles.js, hha-compat-input.js, hha-cloud-logger.js
// Module: <script type="module" src="./plate/plate.safe.js"></script>

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const doc = ROOT.document;

const URLX = new URL(location.href);
const Q = URLX.searchParams;

const MODE = String(Q.get('run') || 'play').toLowerCase();      // play | research
const DIFF = String(Q.get('diff') || 'normal').toLowerCase();   // easy | normal | hard
const TOTAL_TIME = Math.max(20, parseInt(Q.get('time') || '80', 10) || 80);
const DEBUG = (Q.get('debug') === '1');

const LIVES_PARAM = parseInt(Q.get('lives') || '', 10);
const LIVES_START = Number.isFinite(LIVES_PARAM) && LIVES_PARAM > 0 ? LIVES_PARAM : 3;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ---------- Utils ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=>a+Math.random()*(b-a);
const now = ()=>performance.now();
const fmt = (n)=>String(Math.max(0, Math.floor(n)));
function $(id){ return doc.getElementById(id); }
function setTxt(el, t){ if(el) el.textContent = String(t); }
function setShow(el, on){ if(!el) return; el.style.display = on ? '' : 'none'; }

// ---------- HUD ----------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  feverBar: $('hudFever'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  mode: $('hudMode'),
  diff: $('hudDiff'),
  have: $('hudGroupsHave'),
  perfect: $('hudPerfectCount'),
  goalLine: $('hudGoalLine'),
  miniLine: $('hudMiniLine'),
  miniHint: $('hudMiniHint'),
  paused: $('hudPaused'),
  btnEnterVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),
  resultBackdrop: $('resultBackdrop'),
  btnPlayAgain: $('btnPlayAgain'),

  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG1: $('rG1'),
  rG2: $('rG2'),
  rG3: $('rG3'),
  rG4: $('rG4'),
  rG5: $('rG5'),
  rGTotal: $('rGTotal'),
};

// ---------- A-Frame refs ----------
const scene = doc.querySelector('a-scene');
const cam = doc.querySelector('#cam');

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy: {
    size: 92, life: 3200, spawnMs: 900,
    junkRate: 0.18, goldRate: 0.10, trapRate: 0.045, bossRate: 0.020,
    fakeRate: 0.020, slowRate: 0.045, noJunkRate: 0.020, stormRate: 0.020,
    aimAssist: 160,
    bossHP: 3, bossAtkMs:[2600, 3400], bossPhase2At: 0.45, bossPhase3At: 0.22,
    stormDurMs:[4200, 6500], slowDurMs:[3200, 5200], noJunkDurMs:[4200, 6200],
  },
  normal: {
    size: 78, life: 2700, spawnMs: 780,
    junkRate: 0.24, goldRate: 0.12, trapRate: 0.070, bossRate: 0.028,
    fakeRate: 0.040, slowRate: 0.055, noJunkRate: 0.028, stormRate: 0.030,
    aimAssist: 135,
    bossHP: 4, bossAtkMs:[2200, 3000], bossPhase2At: 0.50, bossPhase3At: 0.25,
    stormDurMs:[4200, 7200], slowDurMs:[3200, 5600], noJunkDurMs:[4200, 6800],
  },
  hard: {
    size: 66, life: 2300, spawnMs: 660,
    junkRate: 0.30, goldRate: 0.14, trapRate: 0.095, bossRate: 0.036,
    fakeRate: 0.070, slowRate: 0.060, noJunkRate: 0.026, stormRate: 0.040,
    aimAssist: 125,
    bossHP: 5, bossAtkMs:[1850, 2650], bossPhase2At: 0.55, bossPhase3At: 0.28,
    stormDurMs:[4800, 8200], slowDurMs:[3200, 5800], noJunkDurMs:[4200, 7200],
  },
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- State ----------
const S = {
  running: false,
  paused: false,

  tStart: 0,
  timeLeft: TOTAL_TIME,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,
  perfectCount: 0,

  fever: 0,
  feverOn: false,

  shield: 0,
  shieldMax: 1,

  lives: LIVES_START,
  livesMax: Math.max(1, LIVES_START),

  goalsCleared: 0,
  goalsTotal: 2,
  minisCleared: 0,
  minisTotal: 7,

  plateHave: new Set(),
  groupsTotal: 5,
  groupCounts: [0,0,0,0,0],

  goalIndex: 0,
  activeGoal: null,
  activeMini: null,

  miniEndsAt: 0,
  miniUrgentArmed: false,
  miniTickAt: 0,

  aimedId: null,
  bossActive: false,
  bossNextAt: 0,

  stormUntil: 0,
  slowUntil: 0,
  noJunkUntil: 0,

  lowTimeLastSec: null,
  perfectZoneOn: false,

  sessionId: `PLATE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

// ---------- Factory handle ----------
let FACT = null;
let FACT_STOP = null;

// ---------- VR helpers ----------
function inVR(){
  try { return !!(scene && scene.is && scene.is('vr-mode')); } catch(_) { return false; }
}

// ---------- Inject CSS ----------
(function injectCss(){
  const st = doc.createElement('style');
  st.textContent = `
  .plate-layer{
    position:fixed; inset:0;
    z-index:400;
    pointer-events:auto;
    touch-action:none;
    transform:translate3d(0,0,0);
    will-change:transform;
  }

  @keyframes aimPulse{
    0%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
    50%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 10px rgba(255,255,255,.14); }
    100%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
  }

  @keyframes urgentFlash{ 0%{ filter:brightness(1); } 50%{ filter:brightness(1.18); } 100%{ filter:brightness(1); } }
  @keyframes gentleShake{
    0%{ transform:translate3d(0,0,0); }
    25%{ transform:translate3d(0.8px,0,0); }
    50%{ transform:translate3d(0,-0.8px,0); }
    75%{ transform:translate3d(-0.8px,0,0); }
    100%{ transform:translate3d(0,0,0); }
  }
  body.hha-mini-urgent #miniPanel{
    animation: urgentFlash 320ms linear infinite;
    border-color: rgba(250,204,21,.55) !important;
    box-shadow: 0 18px 46px rgba(0,0,0,.35), 0 0 30px rgba(250,204,21,.12);
  }
  body.hha-mini-urgent #hudTop{ animation: gentleShake 260ms ease-in-out infinite; }

  @keyframes dmgFlash{ 0%{ opacity:0; } 20%{ opacity:.65; } 100%{ opacity:0; } }
  .hha-dmg-flash{
    position:fixed; inset:0; z-index:980;
    pointer-events:none;
    background: radial-gradient(circle at center, rgba(248,113,113,.0), rgba(248,113,113,.30));
    opacity:0;
  }
  .hha-dmg-flash.on{ animation: dmgFlash 420ms ease-out both; }

  @keyframes screenShake{
    0%{ transform:translate3d(0,0,0); }
    20%{ transform:translate3d(2px,0,0); }
    40%{ transform:translate3d(-2px,0,0); }
    60%{ transform:translate3d(2px,-1px,0); }
    80%{ transform:translate3d(-2px,1px,0); }
    100%{ transform:translate3d(0,0,0); }
  }
  body.hha-screen-shake{ animation: screenShake 260ms ease-in-out 1; }

  .hha-atk-ring{
    position:fixed; left:50%; top:50%;
    width:18px; height:18px;
    margin-left:-9px; margin-top:-9px;
    border-radius:999px;
    border:4px solid rgba(248,113,113,.75);
    box-shadow:0 0 0 10px rgba(248,113,113,.10), 0 0 60px rgba(248,113,113,.18);
    opacity:0;
    pointer-events:none;
    z-index:985;
    transform:translate3d(0,0,0) scale(0.2);
  }
  @keyframes atkRing{
    0%{ opacity:0; transform:translate3d(0,0,0) scale(0.2); }
    12%{ opacity:1; }
    100%{ opacity:0; transform:translate3d(0,0,0) scale(14); }
  }
  .hha-atk-ring.on{ animation: atkRing 720ms ease-out both; }

  .hha-atk-laser{
    position:fixed; inset:0;
    pointer-events:none;
    z-index:986;
    opacity:0;
  }
  .hha-atk-laser::before, .hha-atk-laser::after{
    content:'';
    position:absolute;
    left:50%; top:50%;
    transform:translate(-50%,-50%);
    background:rgba(248,113,113,.30);
    box-shadow:0 0 40px rgba(248,113,113,.22);
  }
  .hha-atk-laser::before{ width:88vw; height:10px; border-radius:999px; }
  .hha-atk-laser::after{ width:10px; height:88vh; border-radius:999px; }
  @keyframes atkLaser{
    0%{ opacity:0; }
    15%{ opacity:1; }
    100%{ opacity:0; }
  }
  .hha-atk-laser.on{ animation: atkLaser 320ms ease-out both; }

  .hha-power{
    position:fixed; left:50%; top:50%;
    width:22px; height:22px;
    margin-left:-11px; margin-top:-11px;
    border-radius:999px;
    border:3px solid rgba(148,163,184,.35);
    opacity:0;
    pointer-events:none;
    z-index:984;
    transform:translate3d(0,0,0) scale(0.5);
  }
  .hha-power.on{ opacity:1; }
  .hha-power.green{ border-color: rgba(16,185,129,.75); box-shadow:0 0 0 10px rgba(16,185,129,.10), 0 0 70px rgba(16,185,129,.18); }
  .hha-power.blue{ border-color: rgba(56,189,248,.75); box-shadow:0 0 0 10px rgba(56,189,248,.10), 0 0 70px rgba(56,189,248,.18); }
  .hha-power.orange{ border-color: rgba(249,115,22,.75); box-shadow:0 0 0 10px rgba(249,115,22,.10), 0 0 70px rgba(249,115,22,.18); }
  @keyframes powerPulse{
    0%{ transform:translate3d(0,0,0) scale(0.8); }
    50%{ transform:translate3d(0,0,0) scale(1.25); }
    100%{ transform:translate3d(0,0,0) scale(0.8); }
  }
  .hha-power.pulse{ animation: powerPulse 520ms ease-in-out infinite; }

  @keyframes lowTimePulse{
    0%{ filter:brightness(1); }
    50%{ filter:brightness(1.10); }
    100%{ filter:brightness(1); }
  }
  body.hha-lowtime #hudTop{ animation: lowTimePulse 420ms linear infinite; }

  .hha-perfect-zone{
    position:fixed; left:50%; top:50%;
    transform:translate(-50%,-50%);
    z-index:983;
    pointer-events:none;
    padding:6px 12px;
    border-radius:999px;
    background:rgba(250,204,21,.12);
    border:1px solid rgba(250,204,21,.35);
    color:#e5e7eb;
    font-weight:1000;
    opacity:0;
    transition:opacity .12s ease;
  }
  .hha-perfect-zone.on{ opacity:1; }

  .hha-coach{
    position:fixed;
    left:12px;
    bottom:92px;
    z-index:920;
    pointer-events:none;
    max-width:min(520px, 78vw);
    background:rgba(2,6,23,.62);
    border:1px solid rgba(148,163,184,.22);
    border-radius:18px;
    padding:10px 12px;
    backdrop-filter: blur(8px);
    box-shadow:0 18px 40px rgba(0,0,0,.30);
    opacity:.0;
    transform:translate3d(0,10px,0);
    transition:opacity .18s ease, transform .18s ease;
  }
  .hha-coach.on{ opacity:1; transform:translate3d(0,0,0); }
  .hha-coach .t{ font-weight:1000; }
  .hha-coach .s{ margin-top:4px; color:rgba(229,231,235,.82); font-weight:900; }

  /* =========================
     Factory targets → Plate skin (NO transform override)
     ========================= */
  .hvr-target.plateSkin{
    pointer-events:auto;
    touch-action:manipulation;
    user-select:none;
    -webkit-tap-highlight-color: transparent;
    display:grid;
    place-items:center;
    font-weight:1000;
    letter-spacing:.02em;
    box-shadow:0 18px 46px rgba(0,0,0,.35);
    backdrop-filter: blur(8px);
    border-radius:999px;
  }
  .hvr-target.plateSkin::before{
    content:'';
    position:absolute; inset:-2px;
    border-radius:inherit;
    opacity:.95;
    pointer-events:none;
  }

  .hvr-target.plateSkin.good{ background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.35); }
  .hvr-target.plateSkin.good::before{ border:3px solid rgba(34,197,94,.75); box-shadow:0 0 0 8px rgba(34,197,94,.12), 0 0 40px rgba(34,197,94,.18); }

  .hvr-target.plateSkin.junk{ background:rgba(251,113,133,.14); border:1px solid rgba(251,113,133,.35); }
  .hvr-target.plateSkin.junk::before{ border:3px solid rgba(251,113,133,.75); box-shadow:0 0 0 8px rgba(251,113,133,.10), 0 0 40px rgba(251,113,133,.16); }

  .hvr-target.plateSkin.gold{ background:rgba(250,204,21,.14); border:1px solid rgba(250,204,21,.42); }
  .hvr-target.plateSkin.gold::before{ border:3px solid rgba(250,204,21,.85); box-shadow:0 0 0 10px rgba(250,204,21,.12), 0 0 54px rgba(250,204,21,.18); }

  .hvr-target.plateSkin.trap{ background:rgba(147,51,234,.12); border:1px solid rgba(147,51,234,.38); }
  .hvr-target.plateSkin.trap::before{ border:3px solid rgba(147,51,234,.70); box-shadow:0 0 0 10px rgba(147,51,234,.12), 0 0 60px rgba(147,51,234,.14); }

  .hvr-target.plateSkin.fake{ background:rgba(34,197,94,.14); border:1px dashed rgba(34,197,94,.35); }
  .hvr-target.plateSkin.fake::before{ border:3px dashed rgba(34,197,94,.55); box-shadow:0 0 0 10px rgba(34,197,94,.10), 0 0 52px rgba(34,197,94,.14); }

  .hvr-target.plateSkin.slow{ background:rgba(56,189,248,.12); border:1px solid rgba(56,189,248,.38); }
  .hvr-target.plateSkin.slow::before{ border:3px solid rgba(56,189,248,.75); box-shadow:0 0 0 10px rgba(56,189,248,.10), 0 0 60px rgba(56,189,248,.14); }

  .hvr-target.plateSkin.nojunk{ background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.38); }
  .hvr-target.plateSkin.nojunk::before{ border:3px solid rgba(16,185,129,.75); box-shadow:0 0 0 10px rgba(16,185,129,.10), 0 0 60px rgba(16,185,129,.14); }

  .hvr-target.plateSkin.storm{ background:rgba(249,115,22,.12); border:1px solid rgba(249,115,22,.38); }
  .hvr-target.plateSkin.storm::before{ border:3px solid rgba(249,115,22,.75); box-shadow:0 0 0 10px rgba(249,115,22,.10), 0 0 60px rgba(249,115,22,.14); }

  .hvr-target.plateSkin.boss{ background:rgba(2,6,23,.62); border:1px solid rgba(248,113,113,.35); }
  .hvr-target.plateSkin.boss::before{ border:3px solid rgba(248,113,113,.75); box-shadow:0 0 0 12px rgba(248,113,113,.10), 0 0 70px rgba(248,113,113,.18); }

  .hvr-target.plateSkin .emoji{
    font-size:calc(var(--sz,80px) * 0.52);
    line-height:1;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,.28));
  }
  .hvr-target.plateSkin.boss .emoji{ font-size:calc(var(--sz,80px) * 0.50); }

  .hvr-target.plateSkin .tag{
    position:absolute;
    bottom:-10px;
    left:50%;
    transform:translateX(-50%);
    font-size:12px;
    font-weight:1000;
    padding:4px 10px;
    border-radius:999px;
    background:rgba(2,6,23,.72);
    border:1px solid rgba(148,163,184,.20);
    color:#e5e7eb;
    white-space:nowrap;
  }

  .hvr-target.plateSkin .hp{
    position:absolute;
    top:-10px;
    left:50%;
    transform:translateX(-50%);
    width:70%;
    height:8px;
    border-radius:999px;
    background:rgba(148,163,184,.16);
    border:1px solid rgba(148,163,184,.22);
    overflow:hidden;
  }
  .hvr-target.plateSkin .hp > div{
    height:100%;
    width:100%;
    background:rgba(248,113,113,.85);
    transform-origin:left;
    transform:scaleX(var(--hp,1));
    transition:transform .08s linear;
  }

  .hvr-target.plateSkin.aimed{ animation: aimPulse 520ms ease-in-out infinite; }
  `;
  doc.head.appendChild(st);
})();

// ---------- Overlays ----------
const dmgFlash = doc.createElement('div');
dmgFlash.className = 'hha-dmg-flash';
doc.body.appendChild(dmgFlash);

const atkRing = doc.createElement('div');
atkRing.className = 'hha-atk-ring';
doc.body.appendChild(atkRing);

const atkLaser = doc.createElement('div');
atkLaser.className = 'hha-atk-laser';
doc.body.appendChild(atkLaser);

const powGreen = doc.createElement('div');
powGreen.className = 'hha-power green pulse';
doc.body.appendChild(powGreen);

const powBlue = doc.createElement('div');
powBlue.className = 'hha-power blue pulse';
doc.body.appendChild(powBlue);

const powOrange = doc.createElement('div');
powOrange.className = 'hha-power orange pulse';
doc.body.appendChild(powOrange);

const perfectZone = doc.createElement('div');
perfectZone.className = 'hha-perfect-zone';
perfectZone.textContent = '🎯 PERFECT ZONE';
doc.body.appendChild(perfectZone);

const coach = doc.createElement('div');
coach.className = 'hha-coach';
coach.innerHTML = `<div class="t">🥦 Coach</div><div class="s">พร้อมลุย!</div>`;
doc.body.appendChild(coach);

// ---------- Layer ----------
const layer = doc.createElement('div');
layer.className = 'plate-layer';
doc.body.appendChild(layer);

// ---------- FX helpers ----------
function vibe(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(_) {} }
function flashDamage(){ try{ dmgFlash.classList.remove('on'); void dmgFlash.offsetWidth; dmgFlash.classList.add('on'); }catch(_){} }
function screenShake(){ doc.body.classList.add('hha-screen-shake'); setTimeout(()=>doc.body.classList.remove('hha-screen-shake'), 280); }
function atkFX(){
  try{
    atkRing.classList.remove('on'); void atkRing.offsetWidth; atkRing.classList.add('on');
    atkLaser.classList.remove('on'); void atkLaser.offsetWidth; atkLaser.classList.add('on');
  }catch(_){}
}
function showCoach(title, sub, ms=1200){
  try{
    coach.querySelector('.t').textContent = title;
    coach.querySelector('.s').textContent = sub;
    coach.classList.add('on');
    clearTimeout(showCoach._t);
    showCoach._t = setTimeout(()=>coach.classList.remove('on'), ms);
  }catch(_){}
}
showCoach._t = 0;

// ---------- Audio ----------
const AudioX = (function(){
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    try { ctx = new (ROOT.AudioContext || ROOT.webkitAudioContext)(); } catch(_) {}
    return ctx;
  }
  function unlock(){
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') { try { c.resume(); } catch(_) {} }
  }
  function beep(freq=740, dur=0.06, gain=0.05, type='sine'){
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0);
    o.stop(t0+dur+0.01);
  }
  function tick(){ beep(860, 0.05, 0.04, 'square'); }
  function warn(){ beep(520, 0.08, 0.06, 'sawtooth'); }
  function good(){ beep(980, 0.045, 0.035, 'sine'); }
  function perfect(){ beep(1180, 0.06, 0.04, 'triangle'); }
  function bad(){ beep(220, 0.08, 0.06, 'sawtooth'); }
  function bossHit(){ beep(420, 0.06, 0.05, 'square'); }
  function bossDown(){ beep(240, 0.11, 0.06, 'sawtooth'); setTimeout(()=>beep(760,0.08,0.05,'triangle'),60); }
  function atk(){ beep(160, 0.10, 0.06, 'sawtooth'); setTimeout(()=>beep(90,0.12,0.05,'square'),70); }
  function shield(){ beep(980,0.08,0.045,'triangle'); setTimeout(()=>beep(1320,0.06,0.04,'sine'),60); }
  function power(){ beep(720,0.08,0.04,'triangle'); setTimeout(()=>beep(1040,0.06,0.035,'sine'),50); }
  return { ensure, unlock, tick, warn, good, perfect, bad, bossHit, bossDown, atk, shield, power };
})();

// ---------- Camera -> view offset (GoodJunk style on mobile; in VR = 0) ----------
function getCamAngles(){
  const r = cam && cam.object3D ? cam.object3D.rotation : null;
  if (!r) return { yaw:0, pitch:0 };
  return { yaw: r.y || 0, pitch: r.x || 0 };
}
function viewOffset(){
  if (inVR()) return { x:0, y:0 };
  const { yaw, pitch } = getCamAngles();
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const pxPerRadX = clamp(vw * 0.55, 180, 720);
  const pxPerRadY = clamp(vh * 0.48, 160, 640);
  const x = clamp(-yaw * pxPerRadX, -vw*1.2, vw*1.2);
  const y = clamp(+pitch * pxPerRadY, -vh*1.2, vh*1.2);
  return { x, y };
}
function applyLayerTransform(){
  const off = viewOffset();
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

// ---------- Target content ----------
const FOOD_BY_GROUP = {
  1: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2: ['🍚','🍞','🥔','🌽','🥨','🍜','🍙'],
  3: ['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4: ['🍎','🍌','🍊','🍉','🍍','🍇'],
  5: ['🥑','🧈','🫒','🥥','🧀'],
};
const JUNK = ['🍩','🍟','🍔','🍕','🧋','🍭','🍫','🥤'];
const TRAPS = ['🎁','⭐','🍬','🍰','🧁'];
function randFrom(arr){ return arr[(Math.random()*arr.length)|0]; }

// ---------- HUD pills injected (Shield/Lives/Power) ----------
let hudShieldVal = null;
let hudLivesVal = null;
let hudPowerVal = null;

function powerLabel(){
  const t = now();
  const labels = [];
  if (t < S.noJunkUntil) labels.push('NO-JUNK');
  if (t < S.slowUntil) labels.push('SLOW');
  if (t < S.stormUntil) labels.push('STORM');
  return labels.length ? labels.join(' + ') : '—';
}

function ensurePills(){
  const top = doc.getElementById('hudTop');
  if (!top) return;
  const card = top.querySelector('.card');
  if (!card) return;
  const rows = card.querySelectorAll('.row');
  if (!rows || !rows.length) return;

  const row = rows[Math.min(1, rows.length-1)];

  if (!doc.getElementById('hudShieldPill')){
    const pill = doc.createElement('span');
    pill.className = 'pill';
    pill.id = 'hudShieldPill';
    pill.innerHTML = `🛡️ <span class="k">SHIELD</span> <span id="hudShield" class="v">0</span>`;
    row.appendChild(pill);
    hudShieldVal = pill.querySelector('#hudShield');
  } else hudShieldVal = doc.getElementById('hudShield');

  if (!doc.getElementById('hudLivesPill')){
    const pill = doc.createElement('span');
    pill.className = 'pill';
    pill.id = 'hudLivesPill';
    pill.innerHTML = `❤️ <span class="k">LIVES</span> <span id="hudLives" class="v">${S.lives}</span>`;
    row.appendChild(pill);
    hudLivesVal = pill.querySelector('#hudLives');
  } else hudLivesVal = doc.getElementById('hudLives');

  if (!doc.getElementById('hudPowerPill')){
    const pill = doc.createElement('span');
    pill.className = 'pill';
    pill.id = 'hudPowerPill';
    pill.innerHTML = `✨ <span class="k">POWER</span> <span id="hudPower" class="v">—</span>`;
    row.appendChild(pill);
    hudPowerVal = pill.querySelector('#hudPower');
  } else hudPowerVal = doc.getElementById('hudPower');

  setTxt(hudShieldVal, S.shield);
  setTxt(hudLivesVal, S.lives);
  setTxt(hudPowerVal, powerLabel());
}

function setShield(n){
  S.shield = clamp(n, 0, S.shieldMax);
  ensurePills();
  setTxt(hudShieldVal, S.shield);
}
function setLives(n){
  S.lives = clamp(n, 0, S.livesMax);
  ensurePills();
  setTxt(hudLivesVal, S.lives);
}
function refreshPowerHUD(){
  ensurePills();
  setTxt(hudPowerVal, powerLabel());

  const t = now();
  setShow(powGreen, t < S.noJunkUntil);
  setShow(powBlue, t < S.slowUntil);
  setShow(powOrange, t < S.stormUntil);
}

// ---------- Perfect zone ----------
function setPerfectZone(on){
  S.perfectZoneOn = !!on;
  perfectZone.classList.toggle('on', S.perfectZoneOn);
}

// ---------- Logger (IIFE cloud logger) ----------
function dispatchEvt(name, detail){
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch(_) {}
}
function logSession(phase){
  dispatchEvt('hha:log_session', {
    sessionId: S.sessionId,
    game: 'PlateVR',
    phase,
    mode: MODE,
    diff: DIFF,
    timeTotal: TOTAL_TIME,
    lives: S.livesMax,
    ts: Date.now(),
    ua: navigator.userAgent,
  });
}
function logEvent(type, data){
  dispatchEvt('hha:log_event', {
    sessionId: S.sessionId,
    game: 'PlateVR',
    type,
    t: Math.round((now() - S.tStart) || 0),
    score: S.score,
    combo: S.combo,
    miss: S.miss,
    perfect: S.perfectCount,
    fever: Math.round(S.fever),
    shield: S.shield,
    lives: S.lives,
    power: powerLabel(),
    data: data || {},
  });
}

// ---------- Score/Fever/Grade ----------
function addScore(delta){ S.score += delta; setTxt(HUD.score, S.score); }
function addCombo(){ S.combo += 1; S.maxCombo = Math.max(S.maxCombo, S.combo); setTxt(HUD.combo, S.combo); }

function grantShield(){
  if (S.shield >= S.shieldMax) return;
  setShield(S.shield + 1);
  Particles.celebrate && Particles.celebrate('SHIELD +1!');
  AudioX.shield();
  vibe(45);
  showCoach('🛡️ Shield!', 'กันพลาดได้ 1 ครั้ง!');
  logEvent('shield_gain', { shield: S.shield });
}
function addFever(v){
  const prev = S.fever;
  S.fever = clamp(S.fever + v, 0, 100);
  const pct = Math.round(S.fever);
  if (HUD.feverBar) HUD.feverBar.style.width = `${pct}%`;
  setTxt(HUD.feverPct, `${pct}%`);

  if (!S.feverOn && S.fever >= 100){
    S.feverOn = true;
    Particles.celebrate && Particles.celebrate('FEVER!');
    showCoach('🔥 FEVER!', 'คอมโบแรงขึ้น + โอกาสเจอโหมดพิเศษ!');
    grantShield();
    logEvent('fever_on', {});
  }
  if (S.feverOn && S.fever <= 15){
    S.feverOn = false;
    logEvent('fever_off', {});
  }
  if (prev < 100 && S.fever >= 100) S.fever = 100;
}

function gradeFromScore(){
  const metric = S.score + S.perfectCount*120 + S.maxCombo*35 - S.miss*260 - (S.livesMax - S.lives)*180;
  if (metric >= 8200) return 'SSS';
  if (metric >= 6200) return 'SS';
  if (metric >= 4600) return 'S';
  if (metric >= 3000) return 'A';
  if (metric >= 1700) return 'B';
  return 'C';
}
function updateGrade(){ setTxt(HUD.grade, gradeFromScore()); }

// ---------- Goals / Minis ----------
const GOALS = [
  { key:'plates2', title:'🍽️ เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ', hint:'เก็บครบ 5 หมู่ = 1 ใบ (อย่าโดนขยะ!)', target:2 },
  { key:'perfect6', title:'⭐ ทำ PERFECT ให้ได้ 6 ครั้ง', hint:'เล็งกลางเป้าให้แม่น ๆ จะได้ PERFECT', target:6 },
];

const MINIS = [
  { key:'plateRush', title:'Plate Rush (8s)', hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ', dur:8000,
    init(){ S._mini = { gotGroups:new Set(), fail:false, madePlate:false }; },
    onHit(rec){ if (isBadKind(rec.kind) || rec.kind==='boss') S._mini.fail=true; if(rec.kind==='good') S._mini.gotGroups.add(rec.group); if(S._mini.gotGroups.size>=5) S._mini.madePlate=true; },
    isClear(){ return S._mini.madePlate && !S._mini.fail; }
  },
  { key:'perfectStreak', title:'Perfect Streak', hint:'ทำ PERFECT ติดต่อกัน 5 ครั้ง (พลาดแล้วนับใหม่)!', dur:11000,
    init(){ S._mini = { streak:0 }; },
    onJudge(j){ if(j==='PERFECT') S._mini.streak++; else if(j!=='HIT') S._mini.streak=0; },
    progress(){ return `${S._mini.streak}/5`; },
    isClear(){ return S._mini.streak>=5; }
  },
  { key:'goldHunt', title:'Gold Hunt (12s)', hint:'เก็บ ⭐ Gold ให้ได้ 2 อันภายในเวลา!', dur:12000,
    init(){ S._mini = { got:0 }; },
    onHit(rec){ if(rec.kind==='gold') S._mini.got++; },
    progress(){ return `${S._mini.got}/2`; },
    isClear(){ return S._mini.got>=2; }
  },
  { key:'comboSprint', title:'Combo Sprint (15s)', hint:'ทำคอมโบให้ถึง 8 ภายใน 15 วิ!', dur:15000,
    init(){ S._mini = { best:0 }; },
    tick(){ S._mini.best = Math.max(S._mini.best, S.combo); },
    progress(){ return `${Math.max(S._mini.best, S.combo)}/8`; },
    isClear(){ return Math.max(S._mini.best, S.combo) >= 8; }
  },
  { key:'cleanAndCount', title:'Clean & Count (10s)', hint:'เก็บของดี 4 ชิ้นใน 10 วิ • ห้ามโดนขยะ!', dur:10000,
    init(){ S._mini = { good:0, fail:false }; },
    onHit(rec){ if(isBadKind(rec.kind) || rec.kind==='boss') S._mini.fail=true; if(rec.kind==='good') S._mini.good++; if(rec.kind==='gold') S._mini.good++; },
    progress(){ return `${S._mini.good}/4`; },
    isClear(){ return (S._mini.good>=4)&&!S._mini.fail; }
  },
  { key:'noMiss', title:'No-Miss (12s)', hint:'12 วิ ห้ามพลาด! (ห้ามโดนขยะ/ห้ามปล่อยหมดอายุ)', dur:12000,
    init(){ S._mini = { missAtStart: S.miss, lifeAtStart:S.lives }; },
    isClear(){ return (S.miss === S._mini.missAtStart) && (S.lives === S._mini.lifeAtStart); }
  },
  { key:'shine', title:'Shine (10s)', hint:'ภายใน 10 วิ ทำ PERFECT 2 หรือ Power 1 ก็ผ่าน!', dur:10000,
    init(){ S._mini = { perfect:0, powered:false }; },
    onJudge(j){ if(j==='PERFECT') S._mini.perfect++; },
    onPower(){ S._mini.powered = true; },
    progress(){ return `P:${S._mini.perfect}/2 • POWER:${S._mini.powered?'1':'0'}`; },
    isClear(){ return S._mini.powered || S._mini.perfect>=2; }
  },
];

function goalProgressText(){
  const g = S.activeGoal;
  if (!g) return '0';
  if (g.key === 'plates2') return `${S.goalsCleared}/${g.target}`;
  if (g.key === 'perfect6') return `${S.perfectCount}/${g.target}`;
  return '0';
}
function setGoal(i){
  S.goalIndex = clamp(i, 0, GOALS.length-1);
  S.activeGoal = GOALS[S.goalIndex];
  setTxt(HUD.goalLine, `Goal ${S.goalIndex+1}/${S.goalsTotal}: ${S.activeGoal.title} (${goalProgressText()})`);
}
function checkGoalClear(){
  const g = S.activeGoal;
  if (!g) return false;
  if (g.key === 'plates2') return (S.goalsCleared >= g.target);
  if (g.key === 'perfect6') return (S.perfectCount >= g.target);
  return false;
}
function onGoalCleared(){
  Particles.celebrate && Particles.celebrate('GOAL CLEAR!');
  showCoach('✅ GOAL CLEAR!', 'ไปต่อ! ภารกิจถัดไป!');
  vibe(60);
  logEvent('goal_clear', { goal: S.activeGoal && S.activeGoal.key });
  if (S.goalIndex+1 < GOALS.length) setGoal(S.goalIndex+1);
}

function startMini(){
  const idx = S.minisCleared % MINIS.length;
  const mini = MINIS[idx];
  S.activeMini = mini;
  S.miniEndsAt = now() + mini.dur;
  S.miniUrgentArmed = false;
  S.miniTickAt = 0;
  if (typeof mini.init === 'function') mini.init();
  updateMiniHud();
  logEvent('mini_start', { mini: mini.key, dur: mini.dur });
}
function updateMiniHud(){
  const m = S.activeMini;
  if (!m){ setTxt(HUD.miniLine, '…'); setTxt(HUD.miniHint, '…'); return; }
  const left = Math.max(0, (S.miniEndsAt - now())/1000);
  const prog = (typeof m.progress === 'function') ? m.progress() : '';
  const progText = prog ? ` • ${prog}` : '';
  setTxt(HUD.miniLine, `MINI: ${m.title}${progText} • ${left.toFixed(1)}s`);
  setTxt(HUD.miniHint, m.hint || '');
}
function tickMini(){
  const m = S.activeMini;
  if (!m) return;
  if (typeof m.tick === 'function') m.tick();

  const leftMs = S.miniEndsAt - now();
  const left = leftMs / 1000;

  const urgent = (leftMs <= 3000 && leftMs > 0);
  if (urgent && !S.miniUrgentArmed){
    S.miniUrgentArmed = true;
    doc.body.classList.add('hha-mini-urgent');
    AudioX.warn(); vibe(25);
  }
  if (!urgent && S.miniUrgentArmed){
    S.miniUrgentArmed = false;
    doc.body.classList.remove('hha-mini-urgent');
  }

  if (urgent){
    const sec = Math.ceil(left);
    if (sec !== S.miniTickAt){
      S.miniTickAt = sec;
      AudioX.tick();
    }
  }

  if (leftMs <= 0){
    doc.body.classList.remove('hha-mini-urgent');

    const cleared = (typeof m.isClear === 'function') ? !!m.isClear() : false;
    if (cleared){
      S.minisCleared += 1;
      Particles.celebrate && Particles.celebrate('MINI CLEAR!');
      showCoach('🧩 MINI CLEAR!', 'สุดยอด! บวกคะแนน!');
      vibe(55);
      logEvent('mini_clear', { mini: m.key });
      addScore(450);
      addFever(18);
    } else {
      showCoach('😬 MINI FAIL', 'ไม่เป็นไร รอบหน้าเอาใหม่!');
      logEvent('mini_fail', { mini: m.key });
      addScore(-120);
      addFever(-12);
    }
    startMini();
  } else {
    updateMiniHud();
  }
}

// ---------- Plate logic ----------
function onGood(group){
  if (group >= 1 && group <= 5){
    S.plateHave.add(group);
    S.groupCounts[group-1] += 1;
  }
  setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);

  if (S.plateHave.size >= S.groupsTotal){
    S.goalsCleared += 1;
    S.plateHave.clear();
    setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);

    Particles.celebrate && Particles.celebrate('PLATE +1!');
    showCoach('🍽️ PLATE +1!', 'เก็บให้ครบอีก!');
    vibe(45);
    logEvent('plate_complete', { plates: S.goalsCleared });

    setGoal(S.goalIndex);
    if (S.activeGoal && S.activeGoal.key === 'plates2' && checkGoalClear()){
      onGoalCleared();
    }
  }
}

// ---------- Helpers ----------
function isBadKind(kind){ return (kind === 'junk' || kind === 'trap' || kind === 'fakebad'); }
function isPowerKind(kind){ return (kind === 'slow' || kind === 'nojunk' || kind === 'storm'); }

function shieldBlock(reason){
  if (S.shield <= 0) return false;
  setShield(S.shield - 1);
  Particles.celebrate && Particles.celebrate('🛡️ BLOCK!');
  Particles.judgeText && Particles.judgeText('SHIELD!');
  AudioX.shield();
  vibe(35);
  showCoach('🛡️ BLOCK!', 'กันความเสียหายได้!');
  logEvent('shield_block', { reason, shield: S.shield });
  return true;
}

function onMiss(reason, extra = {}){
  S.combo = 0;
  setTxt(HUD.combo, S.combo);

  S.miss += 1;
  setTxt(HUD.miss, S.miss);

  const t = now();
  const protectedNoJunk = (t < S.noJunkUntil) && (reason === 'junk' || reason === 'trap' || reason === 'boss' || reason === 'boss_attack');
  if (!protectedNoJunk){
    setLives(S.lives - 1);
  }

  updateGrade();

  if (S.lives <= 0){
    showCoach('💀 GAME OVER', 'หัวใจหมด! จบก่อนเวลา!');
    endGame(true);
  }

  logEvent('miss', { reason, ...extra });
}

function punishBad(reason){
  if (shieldBlock(reason)){
    addScore(-60);
    addFever(-6);
    return;
  }

  const t = now();
  const softened = (t < S.noJunkUntil);

  S.combo = 0;
  setTxt(HUD.combo, S.combo);

  S.miss += 1;
  setTxt(HUD.miss, S.miss);

  addFever(reason === 'boss' ? -22 : -16);
  addScore(softened ? -120 : (reason === 'trap' ? -240 : -180));

  flashDamage();
  screenShake();
  vibe(reason === 'boss' ? 85 : 55);

  Particles.judgeText && Particles.judgeText(softened ? 'BAD (SAFE)' : 'BAD');
  AudioX.bad();

  onMiss(reason, {});
}

function bossAttackPunish(tag){
  atkFX();
  AudioX.atk();
  screenShake();
  flashDamage();
  vibe(85);

  if (shieldBlock(tag)){
    addScore(-80);
    addFever(-8);
    return;
  }

  addScore(-320);
  addFever(-20);

  Particles.judgeText && Particles.judgeText('BOSS ATK!');
  Particles.celebrate && Particles.celebrate('OUCH!');
  onMiss('boss_attack', {});
}

function judgeFromDist(distPx, sizePx){
  const n = clamp(distPx / (sizePx * 0.55), 0, 1);
  return (n <= 0.38) ? 'PERFECT' : 'HIT';
}

// ---------- Powerups ----------
function activateSlow(ms){
  const t = now();
  S.slowUntil = Math.max(S.slowUntil, t + ms);
  AudioX.power(); vibe(35);
  Particles.celebrate && Particles.celebrate('SLOW TIME!');
  showCoach('🐢 SLOW TIME!', 'ช้าลง! เล็งง่ายขึ้น!');
  logEvent('power_slow', { until: S.slowUntil });
  refreshPowerHUD();
  if (S.activeMini && typeof S.activeMini.onPower === 'function') S.activeMini.onPower();
}
function activateNoJunk(ms){
  const t = now();
  S.noJunkUntil = Math.max(S.noJunkUntil, t + ms);
  AudioX.power(); vibe(35);
  Particles.celebrate && Particles.celebrate('NO-JUNK!');
  showCoach('🟢 NO-JUNK!', 'ปลอดขยะชั่วคราว! ลุย!');
  logEvent('power_nojunk', { until: S.noJunkUntil });
  refreshPowerHUD();
  if (S.activeMini && typeof S.activeMini.onPower === 'function') S.activeMini.onPower();
}
function activateStorm(ms){
  const t = now();
  S.stormUntil = Math.max(S.stormUntil, t + ms);
  AudioX.power(); vibe(45);
  Particles.celebrate && Particles.celebrate('STORM!');
  showCoach('🌪️ STORM!', 'เป้าถี่ขึ้นจริง! รับมือ!');
  logEvent('power_storm', { until: S.stormUntil });
  refreshPowerHUD();
  if (S.activeMini && typeof S.activeMini.onPower === 'function') S.activeMini.onPower();
}

// ---------- Aim highlight (scan factory targets) ----------
function pickNearCrosshair(radiusPx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;

  let bestEl = null;
  let bestD = Infinity;

  const els = layer.querySelectorAll('.hvr-target.plateSkin');
  els.forEach(el=>{
    if (!el.isConnected) return;
    const r = el.getBoundingClientRect();
    const sx = r.left + r.width/2;
    const sy = r.top  + r.height/2;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD){ bestD = d; bestEl = el; }
  });

  if (bestEl && bestD <= radiusPx) return { el: bestEl, dist: bestD };
  return null;
}

function updateAimHighlight(){
  const assist = inVR() ? Math.max(D.aimAssist, 170) : D.aimAssist;
  const picked = pickNearCrosshair(assist);
  const el = picked?.el || null;

  if (el){
    const r = el.getBoundingClientRect();
    const sz = Math.max(40, r.width||80);
    const n = clamp(picked.dist / (sz * 0.55), 0, 1);
    setPerfectZone(n <= 0.38);
  } else setPerfectZone(false);

  const tid = el ? (el.dataset?.hhaId || el) : null;
  if (S.aimedId === tid) return;

  const prev = layer.querySelector('.hvr-target.plateSkin.aimed');
  if (prev) prev.classList.remove('aimed');

  S.aimedId = tid;
  if (el) el.classList.add('aimed');
}

// ---------- Tap-anywhere shooting ----------
function isUIElement(target){
  if (!target) return false;
  return !!(target.closest && (target.closest('.btn') || target.closest('#hudRight') || target.closest('#resultBackdrop')));
}
function shootCrosshair(){
  if (!S.running || S.paused) return;
  AudioX.unlock();

  const assist = inVR() ? Math.max(D.aimAssist, 170) : D.aimAssist;
  const picked = pickNearCrosshair(assist);
  const el = picked?.el;
  if (!el) return;

  const d = el.__hhaData;
  if (d && typeof d._hit === 'function'){
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width/2);
    const y = Math.round(r.top  + r.height/2);
    d._hit({ __hhaSynth:true, clientX:x, clientY:y }, null);
  }
}
function onGlobalPointerDown(e){
  if (!S.running || S.paused) return;
  if (isUIElement(e.target)) return;
  try { e.preventDefault(); } catch(_) {}
  shootCrosshair();
}

// ---------- VR controller / keyboard support ----------
function bindShootHotkeys(){
  ROOT.addEventListener('keydown', (e)=>{
    const k = String(e.key || '').toLowerCase();
    if (k === ' ' || k === 'enter' || k === 'z' || k === 'x'){
      shootCrosshair();
    }
  });

  if (scene){
    const fire = ()=>shootCrosshair();
    scene.addEventListener('triggerdown', fire);
    scene.addEventListener('abuttondown', fire);
    scene.addEventListener('xbuttondown', fire);
    scene.addEventListener('gripdown', fire);
    scene.addEventListener('mousedown', fire);
    scene.addEventListener('click', fire);
  }
}

// ---------- Pause/Restart/VR ----------
function setPaused(on){
  S.paused = !!on;
  setShow(HUD.paused, S.paused);
  if (HUD.btnPause) HUD.btnPause.textContent = S.paused ? '▶️ RESUME' : '⏸️ PAUSE';
}
function enterVR(){
  if (!scene || !scene.enterVR) return;
  try { scene.enterVR(); } catch(_) {}
}

// ---------- Boss meta for factory target ----------
const BOSS_META = new WeakMap(); // el -> { hp,hpMax, atkAt, warned, delays }
function bossPhaseBy(el){
  const m = BOSS_META.get(el); if (!m) return 1;
  const ratio = m.hpMax ? (m.hp / m.hpMax) : 1;
  if (ratio <= D.bossPhase3At) return 3;
  if (ratio <= D.bossPhase2At) return 2;
  return 1;
}
function bossStyleByPhase(ph){
  if (ph === 3) return 'double';
  if (ph === 2) return 'laser';
  return 'ring';
}
function bossSyncHP(el){
  const m = BOSS_META.get(el); if (!m) return;
  const ratio = m.hpMax ? clamp(m.hp / m.hpMax, 0, 1) : 0;
  el.style.setProperty('--hp', String(ratio));
  const bar = el.querySelector('.hp > div');
  if (bar) bar.style.transform = `scaleX(${ratio})`;
}
function findBossEl(){
  return layer.querySelector('.hvr-target.plateSkin.boss');
}

// ---------- Decide kind/group ----------
function decideGroup(){ return 1 + ((Math.random()*5)|0); }

function decideKind(){
  const t = now();
  const noJunk = (t < S.noJunkUntil);
  const storm = (t < S.stormUntil);
  const fever = S.feverOn;

  let gold = D.goldRate + (fever ? 0.03 : 0);
  let junk = D.junkRate + (storm ? 0.04 : 0);
  let trap = D.trapRate + (storm ? 0.03 : 0);
  let fake = D.fakeRate + (storm ? 0.02 : 0);

  let slow = D.slowRate * (fever ? 1.05 : 1.0);
  let nojunk = D.noJunkRate * (fever ? 1.10 : 1.0);
  let stormP = D.stormRate * (fever ? 1.20 : 1.0);

  gold = clamp(gold, 0.06, 0.22);
  junk = clamp(junk, 0.08, 0.40);
  trap = clamp(trap, 0.02, 0.22);
  fake = clamp(fake, 0.00, 0.20);

  if (noJunk){
    junk *= 0.12; trap *= 0.12; fake *= 0.10;
    gold *= 1.10; slow *= 1.10; stormP *= 0.60;
  }

  const slowOn = (t < S.slowUntil);
  if (slowOn){
    junk *= 0.86; trap *= 0.86; fake *= 0.86; gold *= 1.05;
  }

  const r = Math.random();
  let acc = 0;

  acc += slow; if (r < acc) return 'slow';
  acc += nojunk; if (r < acc) return 'nojunk';
  acc += stormP; if (r < acc) return 'storm';

  acc += gold; if (r < acc) return 'gold';
  acc += junk; if (r < acc) return 'junk';
  acc += trap; if (r < acc) return 'trap';
  acc += fake; if (r < acc) return 'fake';

  return 'good';
}

// ---------- Factory: pick/decorate/judge/expire ----------
function factoryPickItem(){
  const t = now();

  // spawn boss (only one)
  if (!S.bossActive && t >= (S.bossNextAt || 0)){
    S.bossActive = true;

    const hpMax = (S.feverOn ? Math.max(2, (D.bossHP||4) - 1) : (D.bossHP||4));
    const base = S.feverOn ? rnd(8500,12500) : rnd(10500,16500);
    S.bossNextAt = t + base;

    return {
      ch: (Math.random()<0.5) ? '🦠' : '😈',
      isGood: false,
      isPower: false,
      itemType: 'boss',
      className: 'plateSkin boss',
      sizeMul: 1.55,
      lifeMs: clamp(D.life * 2.2, 5200, 9800),
      extra: { kind:'boss', group:0, hp: hpMax, hpMax }
    };
  }

  const kind = decideKind();

  if (kind === 'slow')   return { ch:'🐢', isGood:true, isPower:true, itemType:'power', className:'plateSkin slow',   extra:{ kind:'slow', group:0 } };
  if (kind === 'nojunk') return { ch:'🟢', isGood:true, isPower:true, itemType:'power', className:'plateSkin nojunk', extra:{ kind:'nojunk', group:0 } };
  if (kind === 'storm')  return { ch:'🌪️', isGood:true, isPower:true, itemType:'power', className:'plateSkin storm',  extra:{ kind:'storm', group:0 } };

  if (kind === 'gold') return { ch:'⭐', isGood:true, isPower:false, itemType:'good', className:'plateSkin gold', extra:{ kind:'gold', group:0 } };

  if (kind === 'junk'){
    const ch = randFrom(JUNK);
    return { ch, isGood:false, isPower:false, itemType:'bad', className:'plateSkin junk', extra:{ kind:'junk', group:0 } };
  }
  if (kind === 'trap'){
    const ch = randFrom(TRAPS);
    return { ch, isGood:false, isPower:false, itemType:'bad', className:'plateSkin trap', extra:{ kind:'trap', group:0 } };
  }

  if (kind === 'fake'){
    const g = decideGroup();
    const ch = randFrom(FOOD_BY_GROUP[g] || ['🥗']);
    return { ch, isGood:true, isPower:false, itemType:'fakeGood', className:'plateSkin fake', extra:{ kind:'fake', group:g } };
  }

  const g = decideGroup();
  const ch = randFrom(FOOD_BY_GROUP[g] || ['🥗']);
  return { ch, isGood:true, isPower:false, itemType:'good', className:'plateSkin good', extra:{ kind:'good', group:g } };
}

function factoryDecorate(el, parts, picked, meta){
  const k = picked?.extra?.kind;
  if (!k) return;

  // set --sz for emoji sizing
  const r = el.getBoundingClientRect();
  const sz = Math.max(48, Math.round(Math.min(r.width || 80, r.height || 80)));
  el.style.setProperty('--sz', `${sz}px`);

  let tag = '';
  if (k === 'good') tag = `G${picked.extra.group||1}`;
  else if (k === 'gold') tag = 'GOLD';
  else if (k === 'junk') tag = 'JUNK';
  else if (k === 'trap') tag = 'TRAP';
  else if (k === 'fake') tag = '???';
  else if (k === 'slow') tag = 'SLOW';
  else if (k === 'nojunk') tag = 'NO-JUNK';
  else if (k === 'storm') tag = 'STORM';
  else if (k === 'boss') tag = 'BOSS';

  el.innerHTML = `
    ${k==='boss' ? `<div class="hp"><div></div></div>` : ``}
    <div class="emoji">${String(picked.ch||'🍽️')}</div>
    ${tag ? `<div class="tag">${tag}</div>` : ``}
  `;

  if (k === 'boss' && !BOSS_META.get(el)){
    const hpMax = picked.extra.hpMax || picked.extra.hp || (D.bossHP||4);
    const hp = picked.extra.hp || hpMax;
    BOSS_META.set(el, {
      hp, hpMax,
      atkAt: now() + rnd(D.bossAtkMs[0], D.bossAtkMs[1]),
      warned:false,
      delays:0
    });
    bossSyncHP(el);

    Particles.judgeText && Particles.judgeText('BOSS!');
    Particles.celebrate && Particles.celebrate('⚠️');
    showCoach('😈 BOSS!', 'บอสมาแล้ว! ยิงให้ล้ม!');
    vibe(35);
    logEvent('boss_spawn', { hpMax });
  }
}

function factoryOnExpire(info){
  const k = info?.extra?.kind;
  const g = info?.extra?.group || 0;

  if (k === 'good' || k === 'gold'){
    onMiss('expire_good', { kind: k, group: g });
    Particles.judgeText && Particles.judgeText('MISS');
    logEvent('miss_expire', { kind: k, group: g });
    return;
  }

  if (k === 'boss'){
    bossAttackPunish('boss_expire');
    S.bossActive = false;
    logEvent('boss_expire_punish', {});
  }
}

function factoryJudge(ch, ctx){
  if (!S.running || S.paused) return { remove:false };

  AudioX.unlock();

  const k = ctx?.extra?.kind;
  const group = ctx?.extra?.group || 0;

  const dist = (typeof ctx.distToCrosshair === 'number') ? ctx.distToCrosshair : 9999;
  const sizePx = Math.max(40, ctx.sizePx || (ctx.rect?.width||80));

  // power
  if (k === 'slow'){
    activateSlow(rnd(D.slowDurMs[0], D.slowDurMs[1]));
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'SLOW');
    Particles.scorePop && Particles.scorePop('+120', ctx.cx, ctx.cy);
    addScore(120); addFever(10);
    logEvent('hit_power', { kind:'slow', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    updateGrade();
    return { remove:true };
  }
  if (k === 'nojunk'){
    activateNoJunk(rnd(D.noJunkDurMs[0], D.noJunkDurMs[1]));
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'NOJUNK');
    Particles.scorePop && Particles.scorePop('+160', ctx.cx, ctx.cy);
    addScore(160); addFever(10);
    logEvent('hit_power', { kind:'nojunk', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    updateGrade();
    return { remove:true };
  }
  if (k === 'storm'){
    activateStorm(rnd(D.stormDurMs[0], D.stormDurMs[1]));
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'STORM');
    Particles.scorePop && Particles.scorePop('+200', ctx.cx, ctx.cy);
    addScore(200); addFever(12);
    logEvent('hit_power', { kind:'storm', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    updateGrade();
    return { remove:true };
  }

  // fake good
  if (k === 'fake'){
    Particles.judgeText && Particles.judgeText('TRICK!');
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'TRICK');
    Particles.scorePop && Particles.scorePop('-220', ctx.cx, ctx.cy);
    showCoach('😈 TRICK!', 'อันนี้หลอก! ระวัง!');
    punishBad('trap');
    logEvent('hit', { kind:'fake', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit({ kind:'trap', group }, 'BAD');
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('BAD');
    updateGrade();
    setGoal(S.goalIndex);
    return { remove:true };
  }

  if (k === 'trap'){
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'TRAP');
    Particles.scorePop && Particles.scorePop('-240', ctx.cx, ctx.cy);
    showCoach('⚠️ TRAP!', 'โดนกับดักแล้ว!');
    punishBad('trap');
    logEvent('hit', { kind:'trap', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit({ kind:'trap', group }, 'BAD');
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('BAD');
    updateGrade();
    setGoal(S.goalIndex);
    return { remove:true };
  }

  if (k === 'junk'){
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'BAD');
    Particles.scorePop && Particles.scorePop('-180', ctx.cx, ctx.cy);
    showCoach('🧋 JUNK!', 'โดนของไม่ดี! ระวัง!');
    punishBad('junk');
    logEvent('hit', { kind:'junk', dist, direct: !ctx?.rawEvent?.__hhaSynth });
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit({ kind:'junk', group }, 'BAD');
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('BAD');
    updateGrade();
    setGoal(S.goalIndex);
    return { remove:true };
  }

  // ✅ BOSS multi-hit
  if (k === 'boss'){
    const el = ctx?.targetEl;
    const m = el ? BOSS_META.get(el) : null;
    if (!el || !m){
      bossAttackPunish('boss');
      return { remove:true };
    }

    if (m.delays < 2){ m.atkAt += 700; m.delays++; }

    m.hp = Math.max(0, (m.hp|0) - 1);
    bossSyncHP(el);

    const ph = bossPhaseBy(el);

    AudioX.bossHit();
    vibe(25);
    Particles.judgeText && Particles.judgeText(ph === 3 ? 'BOSS RAGE!' : 'BOSS HIT!');
    Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, 'BOSS');
    Particles.scorePop && Particles.scorePop('+120', ctx.cx, ctx.cy);

    addScore(120);
    addFever(7);
    logEvent('boss_hit', { hp:m.hp, hpMax:m.hpMax, phase:ph });

    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit({ kind:'boss', group:0 }, 'HIT');
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('HIT');

    if (m.hp <= 0){
      AudioX.bossDown();
      Particles.celebrate && Particles.celebrate('BOSS DOWN!');
      showCoach('🏆 BOSS DOWN!', 'โค่นบอสได้! บวกใหญ่!');
      vibe(85);

      addScore(1000);
      addFever(30);
      S.combo += 2;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      setTxt(HUD.combo, S.combo);

      Particles.scorePop && Particles.scorePop('+1000', ctx.cx, ctx.cy);
      logEvent('boss_down', {});
      S.bossActive = false;

      updateGrade();
      setGoal(S.goalIndex);
      return { remove:true };
    }

    updateGrade();
    setGoal(S.goalIndex);
    return { remove:false }; // ✅ keep until dead
  }

  // good / gold
  const judge = judgeFromDist(dist, sizePx);
  const mult = S.feverOn ? 1.35 : 1.0;
  const base = (k === 'gold') ? 520 : 240;
  const bonus = (judge === 'PERFECT') ? 220 : 0;
  const stormBonus = (now() < S.stormUntil) ? 60 : 0;
  const delta = Math.round((base + bonus + stormBonus) * mult);

  addScore(delta);
  addCombo();

  if (judge === 'PERFECT'){
    S.perfectCount += 1;
    setTxt(HUD.perfect, S.perfectCount);
    addFever(14);
    Particles.judgeText && Particles.judgeText('PERFECT');
    Particles.scorePop && Particles.scorePop(`+${delta}`, ctx.cx, ctx.cy);
    AudioX.perfect();
    vibe(35);
  } else {
    addFever(8);
    Particles.judgeText && Particles.judgeText('GOOD');
    Particles.scorePop && Particles.scorePop(`+${delta}`, ctx.cx, ctx.cy);
    AudioX.good();
  }

  Particles.burstAt && Particles.burstAt(ctx.cx, ctx.cy, (k === 'gold') ? 'GOLD' : 'GOOD');

  if (k === 'good') onGood(group);
  if (k === 'gold'){
    let g = 1 + ((Math.random()*5)|0);
    for (let kk=0;kk<5;kk++){
      const gg = 1 + ((g-1+kk)%5);
      if (!S.plateHave.has(gg)) { g = gg; break; }
    }
    onGood(g);
  }

  if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit({ kind:k, group }, judge);
  if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge(judge);

  if (S.activeGoal && S.activeGoal.key === 'perfect6'){
    if (checkGoalClear()) onGoalCleared();
  }

  updateGrade();
  setGoal(S.goalIndex);

  logEvent('hit', { kind:k, group, judge, dist, direct: !ctx?.rawEvent?.__hhaSynth, delta });

  return { remove:true };
}

// ---------- Boss attack tick (factory DOM) ----------
function tickBossAttackFactory(){
  const el = findBossEl();
  if (!el) return;
  const m = BOSS_META.get(el);
  if (!m) return;

  const t = now();
  const ph = bossPhaseBy(el);
  const style = bossStyleByPhase(ph);

  const phaseMul = (ph === 3) ? 0.78 : (ph === 2) ? 0.90 : 1.0;
  const warnLead = (style === 'double') ? 620 : 450;

  if (t < S.noJunkUntil) m.atkAt += 120;

  if (t >= m.atkAt - warnLead && !m.warned){
    m.warned = true;
    Particles.judgeText && Particles.judgeText(style === 'double' ? '☠️' : '⚠️');
    AudioX.warn(); vibe(18);
  }

  if (t >= m.atkAt){
    m.warned = false;

    if (style === 'ring'){
      atkRing.classList.remove('on'); void atkRing.offsetWidth; atkRing.classList.add('on');
    } else if (style === 'laser'){
      atkLaser.classList.remove('on'); void atkLaser.offsetWidth; atkLaser.classList.add('on');
    } else {
      atkFX();
    }

    AudioX.atk();
    logEvent('boss_attack', { phase: ph, style });

    bossAttackPunish('boss_attack');

    const baseMin = D.bossAtkMs[0] * phaseMul;
    const baseMax = D.bossAtkMs[1] * phaseMul;
    m.atkAt = t + rnd(baseMin, baseMax);

    if (ph === 3 && Math.random() < 0.22){
      m.atkAt = t + rnd(900, 1400);
      Particles.judgeText && Particles.judgeText('CHAIN!');
    }
  }
}

// ---------- Factory boot/start/stop ----------
async function startFactory(){
  if (FACT_STOP) { try{ FACT_STOP(); }catch(_){} FACT_STOP = null; FACT = null; }

  const api = await factoryBoot({
    difficulty: DIFF,
    duration: TOTAL_TIME,

    spawnHost: layer,
    boundsHost: doc.body,
    excludeSelectors: ['#hudTop','#hudLeft','#hudRight','#hudBottom','#resultBackdrop','#miniPanel'],

    getViewOffset: viewOffset,

    pickItem: factoryPickItem,
    decorateTarget: factoryDecorate,
    judge: factoryJudge,
    onExpire: factoryOnExpire,

    spawnIntervalMul: () => {
      let m = 1;
      if (S.feverOn) m *= 0.78;
      if (now() < S.stormUntil) m *= 0.56;
      if (now() < S.slowUntil)  m *= 1.22;
      if (now() < S.noJunkUntil) m *= 0.92;
      return m;
    }
  });

  FACT = api;
  FACT_STOP = ()=>{ try{ api.stop(); }catch(_){} };
}

// ---------- Restart ----------
function restart(){
  if (FACT_STOP) { try{ FACT_STOP(); }catch(_){} FACT_STOP = null; FACT = null; }

  S.running = false;
  S.paused = false;

  S.tStart = 0;
  S.timeLeft = TOTAL_TIME;

  S.score = 0; S.combo = 0; S.maxCombo = 0; S.miss = 0; S.perfectCount = 0;
  S.fever = 0; S.feverOn = false;

  setShield(0);
  setLives(S.livesMax);

  S.goalsCleared = 0; S.minisCleared = 0;

  S.plateHave.clear();
  S.groupCounts = [0,0,0,0,0];

  S.bossActive = false;
  S.bossNextAt = now() + rnd(8000, 14000);

  S.stormUntil = 0;
  S.slowUntil = 0;
  S.noJunkUntil = 0;

  S.lowTimeLastSec = null;
  doc.body.classList.remove('hha-lowtime');

  setPerfectZone(false);
  refreshPowerHUD();

  setTxt(HUD.score, 0); setTxt(HUD.combo, 0); setTxt(HUD.miss, 0);
  setTxt(HUD.perfect, 0); setTxt(HUD.have, `0/5`);
  if (HUD.feverBar) HUD.feverBar.style.width = `0%`;
  setTxt(HUD.feverPct, `0%`);

  updateGrade();
  setPaused(false);
  setShow(HUD.resultBackdrop, false);
  doc.body.classList.remove('hha-mini-urgent');

  setGoal(0);
  startMini();

  showCoach('🥦 Coach', 'เริ่มใหม่! ลุย!');
  logSession('start');

  // start
  start();
}

// ---------- End summary ----------
function endGame(isGameOver){
  if (!S.running) return;
  S.running = false;
  doc.body.classList.remove('hha-mini-urgent');
  doc.body.classList.remove('hha-lowtime');

  if (FACT_STOP) { try{ FACT_STOP(); }catch(_){} FACT_STOP = null; FACT = null; }
  S.bossActive = false;

  setTxt(HUD.rMode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.rGrade, gradeFromScore());
  setTxt(HUD.rScore, S.score);
  setTxt(HUD.rMaxCombo, S.maxCombo);
  setTxt(HUD.rMiss, S.miss);
  setTxt(HUD.rPerfect, S.perfectCount);

  setTxt(HUD.rGoals, `${Math.min(S.goalsCleared, S.goalsTotal)}/${S.goalsTotal}`);
  setTxt(HUD.rMinis, `${Math.min(S.minisCleared, S.minisTotal)}/${S.minisTotal}`);

  setTxt(HUD.rG1, S.groupCounts[0]);
  setTxt(HUD.rG2, S.groupCounts[1]);
  setTxt(HUD.rG3, S.groupCounts[2]);
  setTxt(HUD.rG4, S.groupCounts[3]);
  setTxt(HUD.rG5, S.groupCounts[4]);
  setTxt(HUD.rGTotal, S.groupCounts.reduce((a,b)=>a+b,0));

  setShow(HUD.resultBackdrop, true);

  Particles.celebrate && Particles.celebrate(isGameOver ? 'GAME OVER' : 'ALL DONE!');
  vibe(isGameOver ? 70 : 60);
  logSession(isGameOver ? 'gameover' : 'end');
}

// ---------- Main loop ----------
function start(){
  S.running = true;
  S.tStart = now();

  ensurePills();
  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));

  // start factory
  startFactory().catch(e=>{
    console.error('[PlateVR] factory start failed', e);
    showCoach('❌ Factory Error', 'เปิด console ดู error');
  });

  function frame(){
    if (!S.running) return;

    applyLayerTransform();
    updateAimHighlight();

    if (!S.paused){
      const elapsed = (now() - S.tStart) / 1000;
      S.timeLeft = Math.max(0, TOTAL_TIME - elapsed);
      setTxt(HUD.time, fmt(S.timeLeft));

      if (S.timeLeft <= 10){
        doc.body.classList.add('hha-lowtime');
        const sec = Math.ceil(S.timeLeft);
        if (sec !== S.lowTimeLastSec){
          S.lowTimeLastSec = sec;
          AudioX.tick();
        }
      } else {
        doc.body.classList.remove('hha-lowtime');
        S.lowTimeLastSec = null;
      }

      tickBossAttackFactory();
      tickMini();
      refreshPowerHUD();

      addFever(S.feverOn ? -0.22 : -0.10);
      setGoal(S.goalIndex);

      if (S.timeLeft <= 0){
        showCoach('⏱️ Time!', 'หมดเวลาแล้ว!');
        endGame(false);
        return;
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- Bind UI ----------
function bindUI(){
  layer.addEventListener('pointerdown', onGlobalPointerDown, { passive:false });
  layer.addEventListener('touchstart', onGlobalPointerDown, { passive:false });
  layer.addEventListener('click', onGlobalPointerDown, { passive:false });

  if (HUD.btnEnterVR) HUD.btnEnterVR.addEventListener('click', enterVR);
  if (HUD.btnPause) HUD.btnPause.addEventListener('click', ()=>{
    if (!S.running) return;
    setPaused(!S.paused);
    logEvent('pause', { paused: S.paused });
  });
  if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', ()=>{
    logEvent('restart', {});
    restart();
  });

  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', ()=>{
    setShow(HUD.resultBackdrop, false);
    restart();
  });

  if (HUD.resultBackdrop){
    HUD.resultBackdrop.addEventListener('click', (e)=>{
      if (e.target === HUD.resultBackdrop) setShow(HUD.resultBackdrop, false);
    });
  }
}

// ---------- Boot ----------
(function boot(){
  try {
    if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.init === 'function'){
      ROOT.HHACloudLogger.init({ debug: DEBUG });
    }
  } catch(_) {}

  bindUI();
  bindShootHotkeys();

  setShield(0);
  setLives(S.livesMax);

  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setTxt(HUD.have, `0/5`);
  updateGrade();

  refreshPowerHUD();
  S.bossNextAt = now() + rnd(8000, 14000);

  setGoal(0);
  startMini();

  showCoach('🥦 Coach', 'ALL-IN MODE! เอาให้สุด!');
  logSession('start');
  start();

  if (DEBUG) console.log('[PlateVR] boot ok', { MODE, DIFF, TOTAL_TIME, D });
})();