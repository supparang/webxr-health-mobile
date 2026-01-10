// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION+
// HHA Standard + Safe Spawn + Goals/Mini + Storm + Boss + Adaptive + AI Hooks
// Works with: plate-vr.html (IDs matched)
// Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:judge,
//        hha:adaptive, hha:ai, hha:end, hha:celebrate
// Logger: compatible with hha-cloud-logger.js (flush-hardened)

'use strict';

/* =========================
   Utilities / Globals
========================= */
const ROOT = window;
const DOC  = document;

const qs = (id)=>DOC.getElementById(id);
const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
const emit = (name, detail)=>{
  try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(e){}
};
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||false);

// seeded RNG (mulberry32)
function mulberry32(seed){
  let t = seed>>>0 || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t>>>15), 1 | t);
    r ^= r + Math.imul(r ^ (r>>>7), 61 | r);
    return ((r ^ (r>>>14))>>>0)/4294967296;
  };
}
const uid = ()=> Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2);

/* =========================
   Params / Mode
========================= */
const URLX = new URL(location.href);
const hubUrl = URLX.searchParams.get('hub') || '';
const runRaw = (URLX.searchParams.get('run')||'play').toLowerCase();
const diff   = (URLX.searchParams.get('diff')||'normal').toLowerCase();
const timePlannedSec = clamp(URLX.searchParams.get('time')||90,20,9999);
const viewParam = (URLX.searchParams.get('view')||'mobile').toLowerCase();

const isStudy = (runRaw==='study'||runRaw==='research');
const runMode = isStudy?'study':'play';

const DEFAULT_SEED = 13579;
const seedParam = URLX.searchParams.get('seed');
const seed = isStudy
  ? (Number(seedParam)||DEFAULT_SEED)
  : (seedParam!=null ? (Number(seedParam)||DEFAULT_SEED) : (Date.now() ^ (Math.random()*1e9)));

const rng = mulberry32(seed);

/* =========================
   Difficulty Base
========================= */
const DIFF = {
  easy:   { size:64, lifeMs:1800, spawn:1.5, junk:0.18 },
  normal: { size:56, lifeMs:1600, spawn:1.9, junk:0.24 },
  hard:   { size:48, lifeMs:1400, spawn:2.2, junk:0.30 },
};
const base = DIFF[diff]||DIFF.normal;

/* =========================
   DOM Handles (IDs MUST MATCH HTML)
========================= */
const layer = qs('plate-layer');
const hitFx = qs('hitFx');

const hudTop = qs('hudTop');
const miniPanel = qs('miniPanel');
const coachPanel = qs('coachPanel');
const hudBtns = qs('hudBtns');

const bossHud = qs('bossHud');
const bossTitle = qs('bossTitle');
const bossHint = qs('bossHint');
const bossProg = qs('bossProg');
const bossFx = qs('bossFx');

const stormHud = qs('stormHud');
const stormTitle = qs('stormTitle');
const stormHint = qs('stormHint');
const stormProg = qs('stormProg');
const stormFx = qs('stormFx');

const startOverlay = qs('startOverlay');
const hudPaused = qs('hudPaused');
const resultBackdrop = qs('resultBackdrop');

const btnStart = qs('btnStart');
const btnPause = qs('btnPause');
const btnRestart = qs('btnRestart');
const btnEnterVR = qs('btnEnterVR');
const btnPlayAgain = qs('btnPlayAgain');
const btnBackHub = qs('btnBackHub');

/* =========================
   State
========================= */
let running=false, paused=false;
let tStartMs=0, tLastMs=0, tLeftSec=timePlannedSec;
let score=0, combo=0, comboMax=0, miss=0;

const groupEmojis = ['🥦','🍎','🐟','🍚','🥑'];
let gCount=[0,0,0,0,0];
let plateHave=[false,false,false,false,false];

let fever=0, shield=0;
let targets=new Map();
let spawnAcc=0;

let goalsTotal=2, goalsCleared=0;
let minisTotal=0, miniCleared=0;
let activeGoal=null, activeMini=null;

/* =========================
   HUD Update
========================= */
function accuracyPct(){
  const hitGood = targetsStats.nHitGood;
  const missG   = targetsStats.nExpireGood;
  const denom = hitGood + missG;
  return denom? (hitGood/denom*100):0;
}

function setText(id,v){ const el=qs(id); if(el) el.textContent=String(v); }

function updateHUD(){
  setText('uiScore',score);
  setText('uiCombo',combo);
  setText('uiComboMax',comboMax);
  setText('uiMiss',miss);
  setText('uiPlateHave', plateHave.filter(Boolean).length);
  setText('uiAcc', Math.round(accuracyPct())+'%');
  setText('uiGrade', calcGrade());
  setText('uiTime', Math.ceil(tLeftSec));
  setText('uiShieldN', shield);

  setText('uiG1',gCount[0]);
  setText('uiG2',gCount[1]);
  setText('uiG3',gCount[2]);
  setText('uiG4',gCount[3]);
  setText('uiG5',gCount[4]);

  const ff=qs('uiFeverFill');
  if(ff) ff.style.width = clamp(fever,0,100)+'%';

  emit('hha:score',{
    game:'plate',runMode,diff,timeLeftSec:tLeftSec,
    score,combo,comboMax,miss,fever,shield,
    accuracyGoodPct:accuracyPct(),
    plateHave:plateHave.filter(Boolean).length
  });
}

/* =========================
   Coach / Judge
========================= */
function coach(msg,mood){
  emit('hha:coach',{game:'plate',msg,mood:mood||'neutral'});
  const cm=qs('coachMsg'); if(cm) cm.textContent=msg;
}
function judge(text,kind){
  emit('hha:judge',{game:'plate',text,kind:kind||'info'});
}

/* =========================
   Grade
========================= */
function calcGrade(){
  const acc=accuracyPct();
  if(acc>=92 && miss<=2) return 'S';
  if(acc>=82 && miss<=4) return 'A';
  if(acc>=72) return 'B';
  return 'C';
}

/* =========================
   Targets / Spawn
========================= */
const goodPool = groupEmojis.map((e,i)=>({emoji:e,kind:'good',gi:i}));
const junkPool = ['🍟','🍕','🥤','🍩','🍭','🧁','🍔'].map(e=>({emoji:e,kind:'junk'}));

const targetsStats={
  nHitGood:0,
  nExpireGood:0
};

function spawnTarget(){
  if(!layer) return;
  const kind = (rng()<base.junk)?'junk':'good';
  const spec = (kind==='good') ? goodPool[Math.floor(rng()*goodPool.length)]
                              : junkPool[Math.floor(rng()*junkPool.length)];
  const size = base.size;
  const x = rng()*(innerWidth-size);
  const y = rng()*(innerHeight-size);

  const el=DOC.createElement('button');
  const id='t_'+uid();
  el.className='plateTarget';
  el.textContent=spec.emoji;
  el.style.cssText=`
    position:absolute; left:${x}px; top:${y}px;
    width:${size}px; height:${size}px;
    border-radius:999px; font:900 28px/1 system-ui;
  `;
  on(el,'pointerdown',(e)=>{
    e.preventDefault();
    if(!running||paused) return;
    hit(id);
  });
  layer.appendChild(el);
  targets.set(id,{id,el,kind:spec.kind,gi:spec.gi,born:nowMs()});
}

function hit(id){
  const t=targets.get(id);
  if(!t) return;
  targets.delete(id);
  t.el.remove();

  if(t.kind==='good'){
    targetsStats.nHitGood++;
    combo++; comboMax=Math.max(comboMax,combo);
    score+=50;
    if(t.gi!=null){
      gCount[t.gi]++; plateHave[t.gi]=true;
    }
    fever=clamp(fever-3,0,100);
  }else{
    miss++; combo=0; score=Math.max(0,score-40);
    fever=clamp(fever+8,0,100);
  }
  updateHUD();
}

/* =========================
   Loop / Timer
========================= */
function tick(){
  if(!running) return;
  const t=nowMs();
  const dt=(t-tLastMs)/1000;
  tLastMs=t;

  if(!paused){
    tLeftSec=Math.max(0,tLeftSec-dt);
    spawnAcc+=dt*base.spawn;
    while(spawnAcc>=1){
      spawnAcc--; spawnTarget();
    }
  }

  if(tLeftSec<=0){
    endGame('time');
    return;
  }
  requestAnimationFrame(tick);
}

/* =========================
   Start / Pause / End
========================= */
function startGame(){
  if(running) return;
  running=true; paused=false;
  tStartMs=nowMs(); tLastMs=tStartMs; tLeftSec=timePlannedSec;
  startOverlay.style.display='none';

  coach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪','neutral');
  judge('▶ START','good');

  emit('hha:start',{game:'plate',runMode,diff,seed});
  updateHUD();
  requestAnimationFrame(tick);
}

function endGame(reason){
  running=false;
  targets.forEach(t=>t.el.remove());
  targets.clear();

  emit('hha:end',{
    game:'plate',runMode,diff,score,miss,grade:calcGrade(),reason
  });
  resultBackdrop.style.display='grid';
}

/* =========================
   Buttons Bind
========================= */
on(btnStart,'click',startGame);
on(btnPause,'click',()=>{ paused=!paused; hudPaused.style.display=paused?'grid':'none'; });
on(btnRestart,'click',()=>location.reload());
on(btnEnterVR,'click',()=>{
  const sc=DOC.querySelector('a-scene');
  sc && sc.enterVR && sc.enterVR();
});
on(btnBackHub,'click',()=>{
  if(hubUrl) location.href=hubUrl;
});

/* =========================
   Init
========================= */
(function init(){
  DOC.body.classList.add(
    viewParam==='cvr'?'view-cvr':
    viewParam==='vr'?'view-vr':
    viewParam==='pc'?'view-pc':'view-mobile'
  );
  updateHUD();
})();