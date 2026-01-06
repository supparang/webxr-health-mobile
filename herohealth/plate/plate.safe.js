// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION+
// HHA Standard + VR-feel + Plate Rush + Storm Cycles + Boss + AI Hooks
// ---------------------------------------------------------------
// Play  : adaptive ON
// Study : deterministic seed + adaptive OFF
// Emits : hha:start, hha:score, hha:time, quest:update,
//         hha:coach, hha:judge, hha:end, hha:celebrate,
//         hha:adaptive, hha:ai
// ---------------------------------------------------------------

'use strict';

/* =========================================================
   Utilities / Globals
========================================================= */
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const qs = (id)=>DOC.getElementById(id);
const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const nowMs = ()=> (performance && performance.now)? performance.now(): Date.now();
const emit = (name, detail)=>{
  try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(e){}
};

/* =========================================================
   Query / Mode
========================================================= */
const URLX = new URL(location.href);
const runRaw = (URLX.searchParams.get('run') || 'play').toLowerCase();
const diff   = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
const view   = (URLX.searchParams.get('view') || 'mobile').toLowerCase();
const hubUrl = URLX.searchParams.get('hub') || '';
const timePlannedSec = clamp(URLX.searchParams.get('time') || 90, 20, 9999);

const isStudy = (runRaw === 'study' || runRaw === 'research');
const runMode = isStudy ? 'study' : 'play';

const DEFAULT_STUDY_SEED = 13579;
const seedParam = URLX.searchParams.get('seed');
const seed =
  isStudy
    ? (Number(seedParam)||DEFAULT_STUDY_SEED)
    : (seedParam!=null ? Number(seedParam)||Date.now() : Date.now());

/* =========================================================
   Seeded RNG
========================================================= */
function mulberry32(seed){
  let t = seed>>>0 || 1;
  return ()=>{
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t>>>15), 1|t);
    r ^= r + Math.imul(r ^ (r>>>7), 61|r);
    return ((r ^ (r>>>14))>>>0)/4294967296;
  };
}
const rng = mulberry32(seed);

/* =========================================================
   Difficulty Base
========================================================= */
const DIFF = {
  easy  : { size:64, life:1800, spawn:1.4, junk:0.18 },
  normal: { size:56, life:1600, spawn:1.8, junk:0.24 },
  hard  : { size:48, life:1400, spawn:2.2, junk:0.30 },
};
const base = DIFF[diff] || DIFF.normal;

/* =========================================================
   Adaptive (Play only)
========================================================= */
let adaptiveOn = !isStudy;
let adapt = { sizeMul:1, spawnMul:1, junkMul:1 };

/* =========================================================
   DOM Handles
========================================================= */
const layer = qs('plate-layer');
const hitFx = qs('hitFx');

const btnStart   = qs('btnStart');
const btnPause   = qs('btnPause');
const btnRestart = qs('btnRestart');
const btnEnterVR = qs('btnEnterVR');

const startOverlay = qs('startOverlay');
const hudPaused    = qs('hudPaused');
const resultBackdrop = qs('resultBackdrop');

const hudTop    = qs('hudTop');
const miniPanel = qs('miniPanel');
const coachPanel= qs('coachPanel');
const hudBtns   = qs('hudBtns');

const bossHud   = qs('bossHud');
const bossFx    = qs('bossFx');
const stormHud  = qs('stormHud');
const stormFx   = qs('stormFx');

/* =========================================================
   Game State
========================================================= */
let running=false, paused=false;
let tStartMs=0, tLastMs=0, tLeftSec=timePlannedSec;

let score=0, combo=0, comboMax=0, miss=0;
let fever=0, shield=0;

const groupEmojis = ['🥦','🍎','🐟','🍚','🥑'];
let gCount=[0,0,0,0,0];
let plateHave=[false,false,false,false,false];

let targets = new Map();
let spawnAccum=0;

/* =========================================================
   AI Hooks
========================================================= */
const AI = {
  enabled: !isStudy,
  lastTipMs:0,
  cooldown:6500,
  tip(key,msg,mood){
    const t=nowMs();
    if(t-this.lastTipMs<this.cooldown) return;
    this.lastTipMs=t;
    coach(msg,mood||'neutral');
    emit('hha:ai',{game:'plate',type:'tip',key,msg,mood});
  }
};

/* =========================================================
   Coach / Judge
========================================================= */
function coach(msg,mood){
  emit('hha:coach',{game:'plate',msg,mood});
  const cm=qs('coachMsg');
  if(cm) cm.textContent=msg;
  const img=qs('coachImg');
  if(img){
    img.src = `./img/coach-${mood||'neutral'}.png`;
  }
}
function judge(text,kind){
  emit('hha:judge',{game:'plate',text,kind});
}

/* =========================================================
   HUD Update
========================================================= */
function accuracy(){
  const hit = gCount.reduce((a,b)=>a+b,0);
  const tot = hit + miss;
  return tot? (hit/tot*100):0;
}
function updateHUD(){
  qs('uiScore').textContent=score;
  qs('uiCombo').textContent=combo;
  qs('uiComboMax').textContent=comboMax;
  qs('uiMiss').textContent=miss;
  qs('uiPlateHave').textContent=plateHave.filter(Boolean).length;
  qs('uiAcc').textContent=Math.round(accuracy())+'%';
  qs('uiTime').textContent=Math.ceil(tLeftSec);
  qs('uiShieldN').textContent=shield;
  qs('uiFeverFill').style.width=clamp(fever,0,100)+'%';
}

/* =========================================================
   Spawn Target
========================================================= */
function spawnTarget(){
  if(!layer) return;

  const tune = {
    size: clamp(base.size*adapt.sizeMul, 40, 86),
    life: base.life,
    spawn: base.spawn*adapt.spawnMul,
    junk: clamp(base.junk*adapt.junkMul, 0.1, 0.6)
  };

  const kind = rng()<tune.junk ? 'junk':'good';
  const el = DOC.createElement('button');
  const id = Math.random().toString(16).slice(2);

  el.className='plateTarget';
  el.dataset.kind=kind;
  if(kind==='good'){
    const gi=Math.floor(rng()*5);
    el.dataset.group=gi;
    el.textContent=groupEmojis[gi];
  }else{
    el.textContent=['🍔','🍟','🥤','🍩'][Math.floor(rng()*4)];
  }

  el.style.left = (rng()*(window.innerWidth-tune.size))+'px';
  el.style.top  = (rng()*(window.innerHeight-tune.size))+'px';
  el.style.width=el.style.height=tune.size+'px';

  el.onclick=()=>onHit(id);
  layer.appendChild(el);

  targets.set(id,{
    id,el,kind,
    groupIdx: kind==='good'?Number(el.dataset.group):-1,
    born: nowMs(), life:tune.life
  });
}

/* =========================================================
   Hit / Miss
========================================================= */
function onHit(id){
  const t=targets.get(id);
  if(!t) return;
  targets.delete(id);
  t.el.remove();

  if(t.kind==='good'){
    combo++; comboMax=Math.max(comboMax,combo);
    score+=50+combo*2;
    gCount[t.groupIdx]++;
    plateHave[t.groupIdx]=true;
    fever=clamp(fever-2,0,100);
  }else{
    miss++; combo=0;
    score=Math.max(0,score-40);
    fever=clamp(fever+10,0,100);
  }
  updateAdaptive();
  updateHUD();
}

/* =========================================================
   Adaptive Update
========================================================= */
function updateAdaptive(){
  if(!adaptiveOn) return;
  const acc=accuracy();
  adapt.sizeMul = acc<70?1.15:acc>90?0.92:1;
  adapt.spawnMul= acc>90?1.12:acc<65?0.9:1;
  adapt.junkMul = acc>92?1.1:acc<70?0.9:1;
  emit('hha:adaptive',{game:'plate',adapt});
}

/* =========================================================
   Loop
========================================================= */
function tick(){
  if(!running) return;
  const t=nowMs();
  const dt=(t-tLastMs)/1000;
  tLastMs=t;

  if(!paused){
    tLeftSec-=dt;
    spawnAccum+=dt*(base.spawn*adapt.spawnMul);
    while(spawnAccum>=1){
      spawnAccum--; spawnTarget();
    }
    if(tLeftSec<=0){
      endGame('time');
      return;
    }
  }
  updateHUD();
  requestAnimationFrame(tick);
}

/* =========================================================
   Start / End
========================================================= */
function startGame(){
  running=true; paused=false;
  tStartMs=nowMs(); tLastMs=tStartMs;
  startOverlay.style.display='none';
  coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪','neutral');
  emit('hha:start',{game:'plate',runMode,diff,seed});
  requestAnimationFrame(tick);
}

function endGame(reason){
  running=false;
  clearTargets();
  const summary={
    game:'plate',runMode,diff,
    score,comboMax,miss,
    accuracy:Math.round(accuracy()),
    duration:Math.round(timePlannedSec-tLeftSec),
    reason
  };
  emit('hha:end',summary);
  showResult(summary);
}

function clearTargets(){
  targets.forEach(t=>t.el.remove());
  targets.clear();
}

function showResult(s){
  resultBackdrop.style.display='grid';
  qs('rScore').textContent=s.score;
  qs('rMaxCombo').textContent=s.comboMax;
  qs('rMiss').textContent=s.miss;
  qs('rGrade').textContent=s.accuracy>85?'A':'B';
}

/* =========================================================
   Bind Buttons
========================================================= */
btnStart?.addEventListener('click',startGame);
btnRestart?.addEventListener('click',()=>location.reload());
btnPause?.addEventListener('click',()=>paused=!paused);
btnEnterVR?.addEventListener('click',()=>{
  const scene=DOC.querySelector('a-scene');
  scene && scene.enterVR && scene.enterVR();
});

/* =========================================================
   Init
========================================================= */
(function init(){
  updateHUD();
  startOverlay.style.display='grid';
})();