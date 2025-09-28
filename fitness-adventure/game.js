// Fitness Adventure VR — Full game.js (OK Click + Fuse 1200ms with Progress Ring per Difficulty)
// Features: Hand-tracking pinch, Beat/QTE, Extra Stages, Plausible Analytics
// Place this file as: webxr-health-mobile/fitness-adventure/game.js

//////////////////////
// Analytics Helper //
//////////////////////
const GAME_ID = "Fitness";
function track(eventName, props = {}) {
  try {
    if (window.plausible) window.plausible(eventName, { props: { game: GAME_ID, ...props } });
  } catch (e) {}
}

//////////////////////
// Simple WebAudio  //
//////////////////////
const SFX = (() => {
  let ctx;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  const tone = (f = 880, d = 0.12, t = 'sine', v = 0.22) => {
    const ac = ensure(), o = ac.createOscillator(), g = ac.createGain();
    o.type = t; o.frequency.value = f;
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(v, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now + d + 0.02);
  };
  return {
    ui:  () => tone(1000, 0.08, 'square', 0.2),
    ok:  () => tone(1200, 0.10, 'square', 0.2),
    bad: () => tone( 240, 0.20, 'sawtooth', 0.25),
    tick:() => tone( 900, 0.05, 'square', 0.2)
  };
})();

//////////////////////
// DOM / HUD Refs   //
//////////////////////
const $ = id => document.getElementById(id);

const HUD = {
  mode: $('modeText'),
  diff: $('diffText'),
  stage: $('stageText'),
  goal: $('goalText'),
  time: $('timeText'),
  score: $('scoreText'),
  prog: $('progressText'),
  meter: $('meterBar'),
  status: $('status')
};

const BTN = {
  practice:  $('btnPractice'),
  challenge: $('btnChallenge'),
  start:     $('btnStart'),
  next:      $('btnNext'),
  reset:     $('btnReset'),
  export:    $('btnExport')
};

const UI = {
  selDiff: $('selDiff'),
  chkBeat: $('chkBeat'),
  selBpm:  $('selBpm')
};

//////////////////////
// Scene References //
//////////////////////
const arena        = $('arena');
const fingerCursor = $('fingerCursor');
const handR        = $('handR');
const handL        = $('handL');
const centerCursor = $('centerCursor');
const fuseProgress = $('fuseProgress');

//////////////////////
// Game State       //
//////////////////////
let MODE = 'Practice';
let DIFF = 'Normal';

let running   = false;
let startedAt = 0;
let elapsed   = 0;
let score     = 0;

let stageIndex = 0;
let taskIndex  = 0;
let timerLimit = 60;

// Beat/QTE
let BEAT_ON   = false;
let BPM       = 100;
let beatIntSec= 0.6;
let nextBeat  = 0;

// Difficulty config
const DIFF_CFG = {
  Easy:   { time: 70, bonus: 10, penalty: 5,  window: 1.3 },
  Normal: { time: 60, bonus: 15, penalty: 8,  window: 1.0 },
  Hard:   { time: 45, bonus: 20, penalty: 12, window: 0.8 }
};

// Progress Ring style per difficulty (สี/ความหนา/ความเร็ว)
const RING_STYLE = {
  Easy:   { color: '#22c55e', inner: 0.020, outer: 0.036, fuseMs: 1200 },
  Normal: { color: '#f59e0b', inner: 0.023, outer: 0.033, fuseMs: 1200 },
  Hard:   { color: '#ef4444', inner: 0.025, outer: 0.031, fuseMs: 1200 }
};

//////////////////////
// Stages / Tasks   //
//////////////////////
const stages = [
  { id:'reach',    name:'Warmup — Reach',   color:'#22d3ee', kind:'reach',  tasks: buildTasks('REACH', 8)  },
  { id:'step',     name:'Side Steps',       color:'#a78bfa', kind:'step',   tasks: buildTasks('STEP', 10)  },
  { id:'squat',    name:'Squats',           color:'#34d399', kind:'squat',  tasks: buildTasks('SQUAT', 8)  },
  { id:'punch',    name:'Punch Targets',    color:'#f97316', kind:'punch',  tasks: buildTasks('PUNCH', 12) },
  { id:'endurance',name:'Endurance Run',    color:'#38bdf8', kind:'mixed',  tasks: buildTasks('MIX', 18)   },
  { id:'combo',    name:'Combo Rush',       color:'#ef4444', kind:'combo',  tasks: buildTasks('COMBO', 16) }
];

function buildTasks(type, n){
  const arr=[];
  for (let i=0;i<n;i++){
    const x = -1.0 + Math.random()*2.0;
    const y =  0.9 + Math.random()*1.0;
    const sub = (type==='MIX'||type==='COMBO')
      ? ['REACH','STEP','SQUAT','PUNCH'][Math.floor(Math.random()*4)]
      : type;
    arr.push({ type: sub, x, y, hit:false });
  }
  return arr;
}

//////////////////////
// Session Log      //
//////////////////////
let sessionLog = { startedAt:null, mode:MODE, difficulty:DIFF, stages:[] };

//////////////////////
// Hand Tracking    //
//////////////////////
let pinchUsingEvents=false, isPinching=false, wasPinching=false;

function setPinching(v){
  isPinching = v;
  if (fingerCursor) fingerCursor.setAttribute('color', v ? '#66ff88' : '#ffffaa');
}

['pinchstarted','pinchended'].forEach(ev=>{
  if (handR) handR.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
  if (handL) handL.addEventListener(ev, ()=>{pinchUsingEvents=true; setPinching(ev==='pinchstarted');});
});

const PINCH_ON  = 0.025;
const PINCH_OFF = 0.035;

function getJointWorldPos(handEnt, nameLike){
  if (!handEnt) return null;
  let node = null;
  handEnt.object3D.traverse(n=>{
    if (n.name && n.name.toLowerCase().includes(nameLike)) node = n;
  });
  if (!node) return null;
  const v = new THREE.Vector3();
  node.getWorldPosition(v);
  return v;
}

function indexTipWorld(){
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent) return null;
  return getJointWorldPos(ent,'index-finger-tip');
}

function pollPinchFallback(){
  if (pinchUsingEvents) return;
  const ent = (handR && handR.object3D.children.length) ? handR :
              (handL && handL.object3D.children.length) ? handL : null;
  if (!ent){ setPinching(false); return; }
  const tip = getJointWorldPos(ent,'index-finger-tip');
  const thb = getJointWorldPos(ent,'thumb-tip');
  if (!tip || !thb){ setPinching(false); return; }
  const d = tip.distanceTo(thb);
  if (!isPinching && d < PINCH_ON) setPinching(true);
  else if (isPinching && d > PINCH_OFF) setPinching(false);
}

/////////////////////////////
// Fuse Progress Ring Ctrl //
/////////////////////////////
let fuseActive = false;
let fuseStartMs = 0;
let fuseDurMs   = 1200; // default; sync via applyCursorStyleForDifficulty()

function setFuseProgress(ratio){
  // ratio: 0..1 => thetaLength: 0..360
  const theta = Math.min(359.9, Math.max(0, ratio * 360));
  const g = fuseProgress.getAttribute('geometry') || {};
  const inner = g.radiusInner || 0.023;
  const outer = g.radiusOuter || 0.033;
  fuseProgress.setAttribute('geometry',
    `primitive: ring; radiusInner: ${inner}; radiusOuter: ${outer}; thetaStart: -90; thetaLength: ${theta}`);
}

function resetFuseProgress(){
  fuseActive = false;
  setFuseProgress(0);
}

function applyCursorStyleForDifficulty(){
  const st = RING_STYLE[DIFF] || RING_STYLE.Normal;

  // ความเร็ว (เวลาจ้อง)
  fuseDurMs = st.fuseMs;

  // sync ให้ตรงกับ cursor attribute
  const cur = centerCursor.getAttribute('cursor') || {};
  centerCursor.setAttribute('cursor', `rayOrigin: entity; fuse: true; fuseTimeout: ${fuseDurMs}`);

  // ความหนา/สี ของ progress ring
  fuseProgress.setAttribute('geometry',
    `primitive: ring; radiusInner: ${st.inner}; radiusOuter: ${st.outer}; thetaStart: -90; thetaLength: 0`);
  fuseProgress.setAttribute('material', `color: ${st.color}; shader: flat; opacity: 0.95`);

  // สีของวง crosshair หลัก (base)
  const baseColor = (DIFF==='Easy') ? '#a7f3d0' : (DIFF==='Hard') ? '#fecaca' : '#fde68a';
  centerCursor.setAttribute('material', `color: ${baseColor}; shader: flat; opacity: 0.95`);

  resetFuseProgress();
}

// rAF update for progress ring
function updateFuseRing(){
  if (fuseActive){
    const now = performance.now();
    const ratio = (now - fuseStartMs) / fuseDurMs;
    setFuseProgress(Math.min(1, ratio));
  }
  requestAnimationFrame(updateFuseRing);
}
requestAnimationFrame(updateFuseRing);

// Hook cursor events
centerCursor.addEventListener('mouseenter', (e)=>{
  if (e && e.detail && e.detail.intersectedEl) {
    fuseActive = true;
    fuseStartMs = performance.now();
  }
});
centerCursor.addEventListener('mouseleave', resetFuseProgress);
centerCursor.addEventListener('click', resetFuseProgress);
// เพิ่มเติมระหว่าง fusing: ทำให้ crosshair ชัดขึ้นนิดๆ
centerCursor.addEventListener('fusing', ()=> centerCursor.setAttribute('material','opacity:1'));

//////////////////////
// A-Frame Component//
//////////////////////
AFRAME.registerComponent('fitness-game', {
  init(){
    this.last = performance.now()/1000;

    // UI events
    BTN.practice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; SFX.ui(); };
    BTN.challenge.onclick= ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; SFX.ui(); };

    UI.selDiff.onchange  = ()=>{
      DIFF = UI.selDiff.value;
      HUD.diff.textContent = DIFF;
      applyCursorStyleForDifficulty();
      SFX.ui();
    };

    UI.chkBeat.onchange  = ()=>{ BEAT_ON = UI.chkBeat.checked; SFX.ui(); };
    UI.selBpm.onchange   = ()=>{ BPM = parseInt(UI.selBpm.value,10)||100; beatIntSec = 60/BPM; SFX.ui(); };

    BTN.start.onclick    = startGame;
    BTN.next.onclick     = nextStage;
    BTN.reset.onclick    = resetGame;
    BTN.export.onclick   = exportJSON;

    // Defaults
    BPM        = parseInt(UI.selBpm.value,10) || 100;
    beatIntSec = 60 / BPM;

    applyCursorStyleForDifficulty();
    resetGame();
  },

  tick(){
    const t = performance.now()/1000, dt = t - this.last; this.last = t;

    // Hand-tracking follow + pinch
    pollPinchFa
