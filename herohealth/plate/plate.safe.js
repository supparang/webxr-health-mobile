// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION+ (HHA Standard)
// Engine: DOM targets + adaptive + storm + boss + AI hooks
// Emits: hha:start, hha:score, hha:time, quest:update, hha:coach, hha:adaptive, hha:end
// Listens: hha:shoot (from vr-ui.js)
// Flush-hardened compatible with hha-cloud-logger.js

'use strict';

export function boot(opts = {}) {
  const ROOT = window;
  const DOC  = document;

  // ------------------------ helpers ------------------------
  const qs = (s)=>DOC.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=>performance.now();
  const emit = (name, detail)=>{
    try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{}
  };

  // ------------------------ ctx ------------------------
  const host = opts.host || qs('#plate-layer');
  const runMode = (opts.runMode||'play').toLowerCase();
  const isStudy = runMode === 'study';
  const diff = (opts.diff||'normal').toLowerCase();
  const durationPlannedSec = Number(opts.durationPlannedSec||70);
  const seed = Number(opts.seed||Date.now());
  const view = opts.view || 'mobile';
  const hub  = opts.hub || '';

  // expose minimal ctx
  ROOT.__PLATE_CTX__ = { runMode, isStudy, diff, seed, view };

  // ------------------------ seeded RNG ------------------------
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seed);

  // ------------------------ difficulty ------------------------
  const DIFF = {
    easy:   { size:64, life:1800, sps:1.4, junk:0.18 },
    normal: { size:56, life:1600, sps:1.8, junk:0.24 },
    hard:   { size:48, life:1400, sps:2.2, junk:0.30 },
  };
  const base = DIFF[diff] || DIFF.normal;

  let adapt = { sizeMul:1, spsMul:1, junkMul:1 };

  // ------------------------ state ------------------------
  let running=false, paused=false;
  let tStart=0, tLast=0, timeLeft=durationPlannedSec;

  let score=0, combo=0, comboMax=0, miss=0;
  let goalsTotal=2, goalsCleared=0;
  let miniTotal=3, miniCleared=0;

  let nHitGood=0, nHitJunk=0, nExpireGood=0;
  let rtGood=[], perfectHits=0;

  const groups = ['🥦','🍎','🐟','🍚','🥑'];
  let plateHave=[false,false,false,false,false];
  let gCount=[0,0,0,0,0];

  const targets = new Map();
  let spawnAcc=0;

  // ------------------------ UI refs ------------------------
  const vScore=qs('#vScore'), vTime=qs('#vTime'), vCombo=qs('#vCombo');
  const goalText=qs('#goalText'), goalCur=qs('#goalCur'), goalTarget=qs('#goalTarget'), goalBar=qs('#goalBar');
  const miniText=qs('#miniText'), miniCur=qs('#miniCur'), miniTarget=qs('#miniTarget'), miniBar=qs('#miniBar'), miniLeft=qs('#miniLeft');
  const coachCard=qs('#coachCard'), coachMsg=qs('#coachMsg');

  // ------------------------ coach ------------------------
  function coach(text, ms=1800){
    emit('hha:coach',{ text, ms });
  }

  // ------------------------ quests ------------------------
  let activeGoal = { text:'เติมจานให้ครบ 5 หมู่', cur:0, target:5 };
  let activeMini = null;

  function updateGoal(){
    activeGoal.cur = plateHave.filter(Boolean).length;
    if(activeGoal.cur>=5 && goalsCleared===0){
      goalsCleared=1;
      coach('เยี่ยม! ครบ 5 หมู่แล้ว 🔥');
      activeGoal = { text:'รักษาความแม่นยำ ≥ 80%', cur:0, target:80 };
    }
    emitQuest();
  }

  function accuracy(){
    const denom = nHitGood + nHitJunk + nExpireGood;
    return denom>0 ? (nHitGood/denom*100) : 0;
  }

  function emitQuest(){
    emit('quest:update',{
      goal:{
        text:activeGoal.text,
        cur:activeGoal.cur,
        target:activeGoal.target
      },
      mini: activeMini ? {
        text:activeMini.text,
        cur:activeMini.cur,
        target:activeMini.target,
        leftSec: Math.ceil(activeMini.left())
      } : { text:'—', cur:miniCleared, target:miniTotal, leftSec:0 }
    });

    // reflect UI (safe)
    if(goalText) goalText.textContent = activeGoal.text;
    if(goalCur) goalCur.textContent = activeGoal.cur;
    if(goalTarget) goalTarget.textContent = activeGoal.target;
    if(goalBar){
      const pct = activeGoal.target>0 ? activeGoal.cur/activeGoal.target*100 : 0;
      goalBar.style.width = clamp(pct,0,100)+'%';
    }

    if(miniText) miniText.textContent = activeMini?activeMini.text:'—';
    if(miniCur) miniCur.textContent = miniCleared;
    if(miniTarget) miniTarget.textContent = miniTotal;
    if(miniBar){
      const pct = miniTotal>0 ? miniCleared/miniTotal*100 : 0;
      miniBar.style.width = clamp(pct,0,100)+'%';
    }
    if(miniLeft) miniLeft.textContent = activeMini?Math.ceil(activeMini.left()):0;
  }

  // ------------------------ spawning ------------------------
  const goodPool = groups.map((e,i)=>({emoji:e, kind:'good', gi:i}));
  const junkPool = ['🍟','🍕','🥤','🍩','🍔','🍭'].map(e=>({emoji:e, kind:'junk'}));

  function currentTune(){
    let size = base.size * adapt.sizeMul;
    let sps  = base.sps  * adapt.spsMul;
    let junk = base.junk * adapt.junkMul;
    size = clamp(size,40,80);
    sps  = clamp(sps,0.8,3.2);
    junk = clamp(junk,0.1,0.6);
    return { size, sps, junk, life: base.life };
  }

  function spawn(){
    if(!host) return;
    const t = currentTune();
    const kind = rng()<t.junk ? 'junk' : 'good';
    const spec = kind==='good'
      ? goodPool[Math.floor(rng()*goodPool.length)]
      : junkPool[Math.floor(rng()*junkPool.length)];

    const el = DOC.createElement('button');
    const id = Math.random().toString(36).slice(2);
    el.className = 'plateTarget';
    el.dataset.id = id;
    el.dataset.kind = spec.kind;
    if(spec.gi!=null) el.dataset.gi = spec.gi;
    el.textContent = spec.emoji;
    el.style.width = el.style.height = t.size+'px';
    el.style.left = Math.round(rng()*(innerWidth-t.size))+'px';
    el.style.top  = Math.round(rng()*(innerHeight-t.size))+'px';

    el.addEventListener('pointerdown', ()=>{
      if(!running||paused) return;
      hit(id);
    }, {passive:true});

    host.appendChild(el);
    targets.set(id,{ id, el, kind:spec.kind, gi:spec.gi, born:now(), life:t.life });
  }

  function despawn(id){
    const o = targets.get(id);
    if(!o) return;
    try{o.el.remove();}catch{}
    targets.delete(id);
  }

  // ------------------------ hit logic ------------------------
  function hit(id){
    const t = targets.get(id);
    if(!t) return;
    const rt = now()-t.born;
    despawn(id);

    if(t.kind==='good'){
      nHitGood++; combo++; comboMax=Math.max(comboMax,combo);
      if(rt<420){ perfectHits++; score+=85; }
      else score+=50;
      rtGood.push(rt);

      if(t.gi!=null){
        gCount[t.gi]++; plateHave[t.gi]=true;
      }
      updateGoal();
    }else{
      nHitJunk++; miss++; combo=0; score=Math.max(0,score-60);
      coach('โดนขยะ! 😵');
    }

    emitScore();
  }

  // ------------------------ shoot from vr-ui ------------------------
  function onShoot(ev){
    const d = ev.detail||{};
    const x=d.x||innerWidth/2, y=d.y||innerHeight/2;
    const lock=d.lockPx||28;
    let best=null, bestD=Infinity;
    for(const [id,t] of targets){
      const r=t.el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=cx-x, dy=cy-y;
      const d2=dx*dx+dy*dy;
      if(d2<bestD){ bestD=d2; best=id; }
    }
    if(best && bestD<=lock*lock) hit(best);
  }

  ROOT.addEventListener('hha:shoot', onShoot, {passive:true});

  // ------------------------ HUD emit ------------------------
  function emitScore(){
    emit('hha:score',{
      score, combo, comboMax,
      accuracyGoodPct: Math.round(accuracy()*10)/10
    });
    if(vScore) vScore.textContent=score;
    if(vCombo) vCombo.textContent=combo;
  }

  // ------------------------ loop ------------------------
  function loop(){
    if(!running) return;
    const t=now(), dt=(t-tLast)/1000; tLast=t;
    if(!paused){
      timeLeft=Math.max(0,timeLeft-dt);
      if(vTime) vTime.textContent=Math.ceil(timeLeft);
      emit('hha:time',{ left:Math.ceil(timeLeft) });

      const tune=currentTune();
      spawnAcc+=dt*tune.sps;
      while(spawnAcc>=1){ spawnAcc--; spawn(); }

      for(const [id,o] of targets){
        if(t-o.born>=o.life){
          despawn(id);
          if(o.kind==='good'){ nExpireGood++; miss++; combo=0; }
        }
      }

      if(timeLeft<=0){ end('time'); return; }
    }
    requestAnimationFrame(loop);
  }

  // ------------------------ end ------------------------
  function end(reason){
    running=false;
    targets.forEach((_,id)=>despawn(id));

    const played = Math.round((now()-tStart)/1000);
    const acc = Math.round(accuracy()*10)/10;

    if(activeGoal.text.includes('ความแม่นยำ') && acc>=80){
      goalsCleared=2;
    }

    const summary={
      game:'plate',
      runMode, diff, seed,
      durationPlannedSec,
      durationPlayedSec: played,
      scoreFinal: score,
      comboMax,
      misses: miss,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal,
      nHitGood, nHitJunk, nExpireGood,
      accuracyGoodPct: acc,
      startTimeIso: new Date(tStart).toISOString(),
      endTimeIso: new Date().toISOString(),
      hub
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch{}

    emit('hha:end', summary);
  }

  // ------------------------ start ------------------------
  function start(){
    running=true; paused=false;
    tStart=now(); tLast=tStart;
    emit('hha:start',{ game:'plate', runMode, diff, seed, view });
    coach('เริ่มเลย! เติมจานให้ครบ 5 หมู่ 💪');
    emitQuest();
    emitScore();
    requestAnimationFrame(loop);
  }

  start();
}