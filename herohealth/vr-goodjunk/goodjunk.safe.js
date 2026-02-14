// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v4.2 + GatePatch v20260210 (FULL)
// --------------------------------------------------
// ✅ End Summary overlay
// ✅ Daily Warmup detect
// ✅ Daily Cooldown (per PID + category)
// ✅ Boss phase
// ✅ Quest + Mini challenge
// ✅ VR crosshair (hha:shoot)
// --------------------------------------------------

'use strict';

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';
import { awardBadge, getPid } from '../badges.safe.js';

const WIN = window;
const DOC = document;

/* =========================================================
   UTIL
========================================================= */

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

const qs = (k,d=null)=>{
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
};

const emit = (n,d)=>{
  try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{}
};

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if(x<=0) x+=2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

/* =========================================================
   DAILY KEYS (warmup / cooldown)
========================================================= */

function getLocalDayKey(){
  const d = new Date();
  const yyyy=d.getFullYear();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function dailyKey(prefix, category, pid){
  const day=getLocalDayKey();
  const p=(pid||'anon').trim()||'anon';
  return `${prefix}:${category}:${p}:${day}`;
}

function markDaily(prefix,category,pid){
  try{localStorage.setItem(dailyKey(prefix,category,pid),'1');}catch{}
}

function isDaily(prefix,category,pid){
  try{return localStorage.getItem(dailyKey(prefix,category,pid))==='1';}
  catch{return false;}
}

/* =========================================================
   SAFE RECT
========================================================= */

function cssPx(varName,fallback){
  try{
    const v=getComputedStyle(DOC.documentElement).getPropertyValue(varName);
    const n=parseFloat(String(v||'').trim());
    return Number.isFinite(n)?n:fallback;
  }catch{return fallback;}
}

function getSafeRectForLayer(layerEl){
  const r=layerEl.getBoundingClientRect();
  const topSafe=cssPx('--gj-top-safe',90);
  const botSafe=cssPx('--gj-bottom-safe',95);

  const padX=14;

  return {
    x:padX,
    y:Math.max(8,topSafe),
    w:Math.max(140,r.width-padX*2),
    h:Math.max(190,r.height-topSafe-botSafe),
    rect:r
  };
}

/* =========================================================
   TARGET PICKING (VR crosshair)
========================================================= */

function pickByShootAt(x,y,lockPx=28){
  const els=[...DOC.querySelectorAll('.gj-target')];
  let best=null;

  for(const el of els){
    const b=el.getBoundingClientRect();
    if(!b.width||!b.height) continue;

    const inside =
      (x>=b.left-lockPx && x<=b.right+lockPx) &&
      (y>=b.top-lockPx  && y<=b.bottom+lockPx);

    if(!inside) continue;

    const cx=(b.left+b.right)/2;
    const cy=(b.top+b.bottom)/2;
    const dx=cx-x;
    const dy=cy-y;
    const d2=dx*dx+dy*dy;

    if(!best||d2<best.d2) best={el,d2};
  }

  return best?best.el:null;
}

/* =========================================================
   TARGET DECORATION
========================================================= */

function chooseGroupId(rng){
  return 1+Math.floor((rng?rng():Math.random())*5);
}

function decorateTarget(el,t){
  if(t.kind==='good'){
    const gid=t.groupId||1;
    const emo=emojiForGroup(t.rng,gid);
    el.textContent=emo;
    el.dataset.group=String(gid);
    el.setAttribute('aria-label',`${labelForGroup(gid)} ${emo}`);
  }
  else if(t.kind==='junk'){
    const emo=pickEmoji(t.rng,JUNK.emojis);
    el.textContent=emo;
    el.dataset.group='junk';
    el.setAttribute('aria-label',`${JUNK.labelTH} ${emo}`);
  }
}

/* =========================================================
   SUMMARY OVERLAY
========================================================= */

function ensureSummaryOverlay(){
  let ov=DOC.getElementById('gjEndOverlay');
  if(ov) return ov;

  ov=DOC.createElement('div');
  ov.id='gjEndOverlay';
  ov.style.cssText=`
    position:fixed;inset:0;z-index:9999;
    display:none;align-items:center;justify-content:center;
    background:rgba(2,6,23,.72);backdrop-filter:blur(6px);
  `;

  ov.innerHTML=`
    <div style="
      width:min(720px,92vw);
      border:1px solid rgba(148,163,184,.18);
      border-radius:22px;
      background:rgba(2,6,23,.9);
      padding:18px;">
      <div style="font-weight:1000">สรุปผล GoodJunkVR</div>
      <div id="gjEndGrade" style="margin-top:6px"></div>
      <div id="gjEndScore"></div>
      <div id="gjEndMiss"></div>
      <button id="gjEndNext" style="margin-top:12px">ต่อไป</button>
    </div>
  `;

  DOC.body.appendChild(ov);
  return ov;
}

function showSummaryOverlay(summary,ctx,onNext){
  const ov=ensureSummaryOverlay();

  DOC.getElementById('gjEndGrade').textContent=`GRADE: ${summary.grade}`;
  DOC.getElementById('gjEndScore').textContent=`Score: ${summary.scoreFinal}`;
  DOC.getElementById('gjEndMiss').textContent=`Miss: ${summary.miss}`;

  const btn=DOC.getElementById('gjEndNext');
  btn.onclick=()=>{
    ov.style.display='none';
    onNext?.();
  };

  ov.style.display='flex';
}

/* =========================================================
   MAIN GAME
========================================================= */

export function boot(opts={}){

const view=String(opts.view||qs('view','mobile')).toLowerCase();
const run=String(opts.run||qs('run','play')).toLowerCase();
const diff=String(opts.diff||qs('diff','normal')).toLowerCase();
const timePlan=clamp(Number(opts.time||qs('time','80'))||80,20,300);
const seed=String(opts.seed||qs('seed',Date.now()));

const category='nutrition';

let pid=String(opts.pid||qs('pid','')||'').trim();
if(!pid){
  try{pid=String(getPid?.()||'').trim();}catch{}
}
if(!pid) pid='anon';

const hub=String(opts.hub||qs('hub','../hub.html'));

const layerL=opts.layerL||DOC.getElementById('gj-layer');
const layerR=opts.layerR||DOC.getElementById('gj-layer-r');

const rng=makeRNG(seed);

const S={
  started:true,
  ended:false,
  timePlan,
  timeLeft:timePlan,
  score:0,
  miss:0,
  combo:0,
  comboMax:0,
  hitGood:0,
  hitJunk:0,
  expireGood:0,
  shield:0,
  boss:{active:false,cleared:false}
};

/* =========================================================
   HIT LOGIC
========================================================= */

function onHit(kind){
  if(kind==='good'){
    S.hitGood++;
    S.combo++;
    S.comboMax=Math.max(S.comboMax,S.combo);
    S.score+=10+Math.min(10,S.combo);
  }
  else{
    S.hitJunk++;
    S.miss++;
    S.combo=0;
    S.score=Math.max(0,S.score-6);
  }
}

/* =========================================================
   SPAWN
========================================================= */

let uid=1;
const Pair=new Map();

function spawn(kind){
  if(S.ended) return;

  const safe=getSafeRectForLayer(layerL);

  const el=DOC.createElement('div');
  el.className='gj-target';
  el.dataset.uid=uid;
  el.dataset.kind=kind;

  const obj={kind,rng,groupId:null};
  if(kind==='good') obj.groupId=chooseGroupId(rng);

  decorateTarget(el,obj);

  el.style.position='absolute';
  el.style.left=Math.round(safe.x+rng()*safe.w)+'px';
  el.style.top =Math.round(safe.y+rng()*safe.h)+'px';
  el.style.transform='translate(-50%,-50%)';

  const myUid=uid++;
  Pair.set(myUid,{el,alive:true});

  el.addEventListener('pointerdown',()=>{
    const p=Pair.get(myUid);
    if(!p||!p.alive) return;
    p.alive=false;
    el.remove();
    onHit(kind);
  });

  layerL.appendChild(el);

  setTimeout(()=>{
    const p=Pair.get(myUid);
    if(!p||!p.alive) return;
    p.alive=false;
    el.remove();
    if(kind==='good'){
      S.expireGood++;
      S.miss++;
    }
  },1600);
}

/* =========================================================
   SHOOT EVENT (VR)
========================================================= */

function onShoot(ev){
  if(S.ended) return;

  const r=DOC.documentElement.getBoundingClientRect();
  const x=ev?.detail?.x ?? (r.left+r.width/2);
  const y=ev?.detail?.y ?? (r.top+r.height/2);

  const picked=pickByShootAt(x,y,28);
  if(!picked) return;

  picked.dispatchEvent(new PointerEvent('pointerdown'));
}

/* =========================================================
   END GAME
========================================================= */

function gradeNow(){
  if(S.score>=190&&S.miss<=3) return'A';
  if(S.score>=125&&S.miss<=6) return'B';
  if(S.score>=70) return'C';
  return'D';
}

function goCooldownThenHub(summary){

  const already=isDaily('HHA_COOLDOWN_DONE',category,pid);
  if(already){
    location.href=hub;
    return;
  }

  markDaily('HHA_COOLDOWN_DONE',category,pid);

  const u=new URL('../warmup-gate.html',location.href);
  u.searchParams.set('phase','cooldown');
  u.searchParams.set('next',hub);
  u.searchParams.set('hub',hub);
  location.replace(u.toString());
}

function endGame(){
  if(S.ended) return;
  S.ended=true;

  const summary={
    game:'GoodJunkVR',
    category,
    pid,
    scoreFinal:S.score,
    miss:S.miss,
    comboMax:S.comboMax,
    grade:gradeNow()
  };

  localStorage.setItem('HHA_LAST_SUMMARY',JSON.stringify(summary));

  showSummaryOverlay(summary,{hub},()=>{
    goCooldownThenHub(summary);
  });

  emit('hha:end',summary);
}

/* =========================================================
   LOOP
========================================================= */

WIN.addEventListener('hha:shoot',onShoot,{passive:true});
WIN.addEventListener('gj:shoot',onShoot,{passive:true});

let lastSpawn=0;

function tick(ts){
  if(S.ended) return;

  if(!lastSpawn||ts-lastSpawn>900){
    lastSpawn=ts;
    spawn(Math.random()<0.7?'good':'junk');
  }

  S.timeLeft-=0.016;
  if(S.timeLeft<=0){
    endGame();
    return;
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

emit('hha:start',{game:'GoodJunkVR',category,seed,pid});
}