// === /herohealth/vr-groups/dl-infer.js ===
// Tiny DL Inference Stub (MLP 32->16->1) — DEMO
// ✅ Enable: run=play AND (?mode=dl)
// ✅ Disable: research/practice
// ✅ Emits: groups:risk {risk, level, reason:'dl'}
// ✅ Weights are default heuristic; can be replaced later (load from localStorage)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const LS_W = 'HHA_GROUPS_DL_W_V1';

  function bodyHas(c){ try{ return DOC.body && DOC.body.classList.contains(c); }catch{ return false; } }

  function getRunMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r==='research') return 'research';
    if (r==='practice') return 'practice';
    return 'play';
  }
  function enabled(){
    if (getRunMode()!=='play') return false;
    const mode = String(qs('mode','')||'').toLowerCase();
    return mode==='dl';
  }

  // -------- state tracker (same signals as dataset) --------
  const S = {
    leftSec:0, tSec:0, score:0, combo:0, misses:0,
    accGoodPct:0, grade:'C',
    powerCharge:0, powerThreshold:8,
    goalPct:0, goalNow:0, goalTotal:1,
    groupKey:'',
    view:String(qs('view','mobile')||'mobile').toLowerCase(),
    miniOn:false, miniNeed:0, miniNow:0, miniTimeLeftSec:0,
    miniCountTotal:0, miniCountCleared:0
  };
  function currentPressure(){
    if (bodyHas('press-3')) return 3;
    if (bodyHas('press-2')) return 2;
    if (bodyHas('press-1')) return 1;
    return 0;
  }

  WIN.addEventListener('hha:score',(ev)=>{
    const d=ev.detail||{};
    S.score=Number(d.score||0);
    S.combo=Number(d.combo||0);
    S.misses=Number(d.misses||0);
  },{passive:true});
  WIN.addEventListener('hha:time',(ev)=>{
    const d=ev.detail||{};
    S.leftSec=Number(d.left||0);
    const timePlan = clamp(qs('time',90), 5, 180);
    S.tSec = Math.max(0, Math.round(timePlan - S.leftSec));
  },{passive:true});
  WIN.addEventListener('hha:rank',(ev)=>{
    const d=ev.detail||{};
    S.grade=String(d.grade||'C');
    S.accGoodPct=Number(d.accuracy||0);
  },{passive:true});
  WIN.addEventListener('groups:power',(ev)=>{
    const d=ev.detail||{};
    S.powerCharge=Number(d.charge||0);
    S.powerThreshold=Math.max(1, Number(d.threshold||8));
  },{passive:true});
  WIN.addEventListener('quest:update',(ev)=>{
    const d=ev.detail||{};
    S.groupKey=String(d.groupKey||'');
    S.goalNow=Number(d.goalNow||0);
    S.goalTotal=Math.max(1, Number(d.goalTotal||1));
    S.goalPct=clamp(Number(d.goalPct ?? (S.goalNow/S.goalTotal*100)),0,100);

    const on = (String(d.miniTitle||'—')!=='—') && (Number(d.miniTotal||0)>0);
    S.miniOn=!!on;
    S.miniNeed=Number(d.miniTotal||0);
    S.miniNow=Number(d.miniNow||0);
    S.miniTimeLeftSec=Number(d.miniTimeLeftSec||0);

    S.miniCountTotal=Number(d.miniCountTotal||0);
    S.miniCountCleared=Number(d.miniCountCleared||0);
  },{passive:true});

  function x32(){
    const acc = clamp(S.accGoodPct,0,100)/100;
    const misses = clamp(S.misses,0,30)/30;
    const combo = clamp(S.combo,0,20)/20;
    const score = clamp(S.score,0,2500)/2500;

    const pressure = clamp(currentPressure(),0,3)/3;
    const storm = bodyHas('groups-storm') ? 1 : 0;

    const miniOn = S.miniOn?1:0;
    const miniGap = (miniOn && S.miniNeed>0) ? clamp((S.miniNeed-S.miniNow)/S.miniNeed,0,1) : 0;
    const miniLeft= clamp(S.miniTimeLeftSec||0,0,12)/12;

    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const spawnMs = (diff==='hard')?560 : (diff==='easy'?780:650);
    const spawnFast = clamp((720-spawnMs)/720,0,1);

    const timePlan = clamp(qs('time',90), 5, 180);
    const leftSec = clamp(S.leftSec,0,timePlan)/Math.max(1,timePlan);

    const keys=['fruit','veg','protein','grain','dairy'];
    const gk=String(S.groupKey||'');
    const onehot=keys.map(k=>k===gk?1:0);

    const x=new Array(32).fill(0);
    x[0]=acc; x[1]=misses; x[2]=combo; x[3]=score;
    x[4]=pressure; x[5]=storm; x[6]=miniOn; x[7]=miniGap;
    x[8]=miniLeft; x[9]=spawnFast; x[10]=leftSec;
    x[11]= clamp(S.powerCharge/Math.max(1,S.powerThreshold),0,1);
    x[12]= clamp(S.goalPct/100,0,1);
    x[13]= clamp(S.goalNow/Math.max(1,S.goalTotal),0,1);
    x[14]= clamp(S.miniCountCleared/Math.max(1,S.miniCountTotal||1),0,1);

    for(let i=0;i<5;i++) x[15+i]=onehot[i];

    x[24]= bodyHas('groups-storm-urgent')?1:0;
    x[25]= bodyHas('clutch')?1:0;
    x[26]= (S.view==='cvr')?1:0;
    x[27]= (S.view==='vr')?1:0;
    x[28]= (S.view==='pc')?1:0;
    x[29]= (diff==='hard')?1:0;
    x[30]= (diff==='easy')?1:0;
    x[31]= 1;

    return x;
  }

  // -------- tiny MLP (heuristic default) --------
  function relu(v){ return v>0?v:0; }
  function sigmoid(z){
    if (z>=0){ const ez=Math.exp(-z); return 1/(1+ez); }
    const ez=Math.exp(z); return ez/(1+ez);
  }

  function defaultWeights(){
    // Hand-tuned-ish: raise risk with misses/pressure/storm/miniUrgent,
    // lower risk with high acc/combo
    const W1 = Array.from({length:16}, ()=> new Array(32).fill(0));
    const b1 = new Array(16).fill(0);
    const W2 = new Array(16).fill(0);
    let b2 = -0.2;

    // neuron 0: miss+pressure
    W1[0][1]= 2.2; W1[0][4]= 1.8; W1[0][0]= -1.2; b1[0]= 0.2;
    // neuron 1: storm / storm urgent
    W1[1][5]= 1.6; W1[1][24]= 1.4; b1[1]= 0.05;
    // neuron 2: mini urgent / gap
    W1[2][6]= 0.8; W1[2][7]= 1.4; W1[2][8]= 0.9; b1[2]= 0.05;
    // neuron 3: low accuracy
    W1[3][0]= -2.2; b1[3]= 1.0;
    // neuron 4: low combo
    W1[4][2]= -1.6; b1[4]= 0.7;
    // neuron 5: spawn fast + clutch
    W1[5][9]= 1.4; W1[5][25]= 0.9; b1[5]= 0.05;

    // output combine
    W2[0]= 1.0;
    W2[1]= 0.9;
    W2[2]= 0.8;
    W2[3]= 0.7;
    W2[4]= 0.5;
    W2[5]= 0.6;

    return { W1,b1,W2,b2 };
  }

  function loadWeights(){
    try{
      const j = JSON.parse(localStorage.getItem(LS_W)||'null');
      if (j && j.W1 && j.b1 && j.W2) return j;
    }catch(_){}
    return defaultWeights();
  }

  let M = loadWeights();

  function predictRisk(x){
    const h = new Array(16).fill(0);
    for(let i=0;i<16;i++){
      let s = M.b1[i]||0;
      for(let j=0;j<32;j++) s += (M.W1[i][j]||0) * x[j];
      h[i]=relu(s);
    }
    let z = M.b2||0;
    for(let i=0;i<16;i++) z += (M.W2[i]||0) * h[i];
    return sigmoid(z);
  }

  function emitRisk(r){
    const risk = clamp(r,0,1);
    const level = (risk>=0.82)?3 : (risk>=0.62)?2 : (risk>=0.42)?1 : 0;
    try{
      WIN.dispatchEvent(new CustomEvent('groups:risk', {
        detail:{ risk, level, reason:'dl' }
      }));
    }catch(_){}
  }

  // tick 1Hz (same cadence as dataset)
  let timer=0;
  function tick(){
    if (!enabled()) return;
    const r = predictRisk(x32());
    emitRisk(r);
  }
  function start(){
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  if (enabled()) start();

  // API
  NS.setDLWeights = function(obj){
    if (!obj || !obj.W1 || !obj.b1 || !obj.W2) return false;
    try{
      localStorage.setItem(LS_W, JSON.stringify(obj));
      M = obj;
      return true;
    }catch(_){ return false; }
  };
  NS.getDLWeights = function(){ return M; };

})();