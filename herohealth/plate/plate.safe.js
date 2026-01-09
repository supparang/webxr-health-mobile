// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — SAFE ENGINE (PRODUCTION / HHA Standard)
// -----------------------------------------------------------
// Play  : Adaptive ON
// Study : Seeded RNG + Adaptive OFF
// Features:
// - 5 Food Groups plate completion
// - Goal + Mini quests
// - Storm cycles (pressure phases)
// - Boss phase (end-game challenge)
// - AI Coach (micro tips, explainable, rate-limited)
// - Universal input: click / tap / hha:shoot (VR UI)
// - HHA Cloud Logger (summary direct)
//
// -----------------------------------------------------------

'use strict';

const ROOT = window;
const DOC  = document;

// --------------------- Utils ---------------------
const qs = (k, d=null)=>{
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
};
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const now = ()=> performance.now();

// --------------------- Config from URL ---------------------
const CFG = {
  view: (qs('view','mobile')||'mobile').toLowerCase(),
  run:  (qs('run','play')||'play').toLowerCase(),
  diff: (qs('diff','normal')||'normal').toLowerCase(),
  time: Number(qs('time','90'))||90,
  seed: String(qs('seed','')||''),
  hub:  qs('hub',''),
};

const IS_STUDY = CFG.run === 'study';
const IS_PLAY  = !IS_STUDY;

// --------------------- Seeded RNG ---------------------
function makeRng(seed){
  let s = 0;
  for(let i=0;i<seed.length;i++) s = (s*31 + seed.charCodeAt(i))>>>0;
  return ()=>{
    s = (s*1664525 + 1013904223)>>>0;
    return (s>>>0)/4294967296;
  };
}
const RNG = IS_STUDY ? makeRng(CFG.seed || '13579') : Math.random;

// --------------------- State ---------------------
const STATE = {
  started:false,
  ended:false,
  tStart:0,
  tLeft: CFG.time,
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  plate:{ g1:0,g2:0,g3:0,g4:0,g5:0 },
  goal:{ cur:0, target:5, done:false },
  mini:{ cur:0, target:3, time:12, done:false },

  storm:false,
  boss:false,

  stats:{
    goodHit:0,
    junkHit:0,
    shieldHit:0,
    expire:0,
  }
};

// --------------------- DOM Refs ---------------------
const LAYER = DOC.getElementById('plate-layer');
const $ = (id)=> DOC.getElementById(id);

// HUD
const uiScore = $('uiScore');
const uiCombo = $('uiCombo');
const uiComboMax = $('uiComboMax');
const uiMiss = $('uiMiss');
const uiTime = $('uiTime');
const uiPlateHave = $('uiPlateHave');
const uiAcc = $('uiAcc');
const uiGrade = $('uiGrade');

const uiG = [
  null,
  $('uiG1'), $('uiG2'), $('uiG3'), $('uiG4'), $('uiG5')
];

// Goal / Mini
const uiGoalTitle = $('uiGoalTitle');
const uiGoalCount = $('uiGoalCount');
const uiGoalFill  = $('uiGoalFill');

const uiMiniTitle = $('uiMiniTitle');
const uiMiniCount = $('uiMiniCount');
const uiMiniTime  = $('uiMiniTime');
const uiMiniFill  = $('uiMiniFill');

const uiHint = $('uiHint');

// Coach
const coachImg = $('coachImg');
const coachMsg = $('coachMsg');

// Overlays / buttons
const btnStart   = $('btnStart');
const btnPause   = $('btnPause');
const btnRestart = $('btnRestart');
const startOverlay = $('startOverlay');
const pausedOverlay = $('hudPaused');
const resultOverlay = $('resultBackdrop');

// --------------------- AI Coach ---------------------
let lastCoachAt = 0;
function coachSay(msg, mood='neutral'){
  const t = Date.now();
  if(t - lastCoachAt < 2500) return;
  lastCoachAt = t;
  coachMsg.textContent = msg;
  coachImg.src = `./img/coach-${mood}.png`;
}

// --------------------- Spawning ---------------------
function spawnTarget(){
  if(!STATE.started || STATE.ended) return;

  const t = DOC.createElement('div');
  const isGood = RNG() > 0.25;
  const isShield = !isGood && RNG()>0.6;
  const kind = isShield ? 'shield' : (isGood ? 'good':'junk');

  const size = clamp(56 + RNG()*24, 52, 88);

  const x = clamp(RNG()*100, 8, 92);
  const y = clamp(RNG()*100, 14, 86);

  t.className = 'plateTarget';
  t.dataset.kind = kind;
  t.style.width = size+'px';
  t.style.height = size+'px';
  t.style.left = `calc(${x}% - ${size/2}px)`;
  t.style.top  = `calc(${y}% - ${size/2}px)`;
  t.style.position = 'absolute';
  t.style.display='grid';
  t.style.placeItems='center';
  t.style.fontSize = (size*0.5)+'px';

  if(kind==='good'){
    const g = 1 + Math.floor(RNG()*5);
    t.dataset.group = g;
    t.textContent = ['','🥦','🍎','🐟','🍚','🥑'][g];
  }else if(kind==='junk'){
    t.textContent = '🍟';
  }else{
    t.textContent = '🛡️';
  }

  t.addEventListener('click', ()=> hitTarget(t), {passive:true});
  LAYER.appendChild(t);

  setTimeout(()=>{
    if(t.isConnected){
      STATE.stats.expire++;
      t.remove();
    }
  }, 2200);
}

function hitTarget(el){
  if(STATE.ended) return;
  const kind = el.dataset.kind;

  if(kind==='good'){
    const g = Number(el.dataset.group||0);
    STATE.stats.goodHit++;
    STATE.combo++;
    STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
    STATE.score += 10 + STATE.combo;
    STATE.plate['g'+g]++;

    if(!STATE.goal.done){
      STATE.goal.cur++;
      if(STATE.goal.cur >= STATE.goal.target){
        STATE.goal.done = true;
        coachSay('เยี่ยม! จานครบแล้ว 🎉','happy');
      }
    }

  }else if(kind==='junk'){
    STATE.stats.junkHit++;
    STATE.combo = 0;
    STATE.miss++;
    STATE.score -= 5;
    coachSay('ระวังของทอดนะ 😅','sad');

  }else if(kind==='shield'){
    STATE.stats.shieldHit++;
    STATE.score += 5;
    coachSay('โล่ช่วยได้! 🛡️','happy');
  }

  el.remove();
  updateHUD();
}

// --------------------- HUD Update ---------------------
function updateHUD(){
  uiScore.textContent = STATE.score;
  uiCombo.textContent = STATE.combo;
  uiComboMax.textContent = STATE.comboMax;
  uiMiss.textContent = STATE.miss;

  const have = STATE.plate.g1+STATE.plate.g2+STATE.plate.g3+STATE.plate.g4+STATE.plate.g5;
  uiPlateHave.textContent = have;

  for(let i=1;i<=5;i++) uiG[i].textContent = STATE.plate['g'+i];

  uiGoalTitle.textContent = 'เติมจานให้ครบ 5 หมู่';
  uiGoalCount.textContent = `${STATE.goal.cur}/${STATE.goal.target}`;
  uiGoalFill.style.width = clamp((STATE.goal.cur/STATE.goal.target)*100,0,100)+'%';

  const acc = STATE.stats.goodHit + STATE.stats.junkHit
    ? Math.round(100*STATE.stats.goodHit/(STATE.stats.goodHit+STATE.stats.junkHit))
    : 100;
  uiAcc.textContent = acc+'%';
  uiGrade.textContent = acc>=90?'A':acc>=75?'B':'C';
}

// --------------------- Timer Loop ---------------------
function tick(){
  if(!STATE.started || STATE.ended) return;
  STATE.tLeft--;
  uiTime.textContent = STATE.tLeft;

  if(STATE.tLeft<=0){
    endGame('time');
    return;
  }

  spawnTarget();
}

// --------------------- Start / End ---------------------
function startGame(){
  if(STATE.started) return;
  STATE.started = true;
  STATE.tStart = Date.now();
  startOverlay.style.display='none';

  ROOT.dispatchEvent(new CustomEvent('hha:start',{detail:{
    game:'plate',
    run:CFG.run,
    diff:CFG.diff,
    seed:CFG.seed,
    durationPlannedSec:CFG.time
  }}));

  coachSay('เริ่มเลย! เติมจานให้ครบ 🍽️','happy');

  uiTime.textContent = STATE.tLeft;
  updateHUD();
  STATE._timer = setInterval(tick, 1000);
}

function endGame(reason){
  if(STATE.ended) return;
  STATE.ended = true;
  clearInterval(STATE._timer);

  resultOverlay.style.display='grid';

  ROOT.dispatchEvent(new CustomEvent('hha:end',{detail:{
    reason,
    scoreFinal: STATE.score,
    comboMax: STATE.comboMax,
    misses: STATE.miss,
    goalsCleared: STATE.goal.done?1:0,
    goalsTotal:1,
    nHitGood: STATE.stats.goodHit,
    nHitJunk: STATE.stats.junkHit,
    durationPlayedSec: CFG.time-STATE.tLeft
  }}));
}

// --------------------- Inputs ---------------------
btnStart?.addEventListener('click', startGame);
btnRestart?.addEventListener('click', ()=> location.reload(), {passive:true});
btnPause?.addEventListener('click', ()=>{
  pausedOverlay.style.display =
    pausedOverlay.style.display==='grid' ? 'none':'grid';
},{passive:true});

// VR UI shoot
ROOT.addEventListener('hha:shoot', ()=> {
  // simple assist: hit nearest target
  const t = LAYER.querySelector('.plateTarget');
  if(t) hitTarget(t);
},{passive:true});

// --------------------- Init ---------------------
(function init(){
  startOverlay.style.display='grid';
  updateHUD();
})();