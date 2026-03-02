// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION
// ✅ deterministic + hha:shoot + HUD-safe spawn via SpawnGuard
// FULL v20260301-GROUPS-SAFE-SPAWNGUARD
'use strict';

import { createSpawnGuard } from '../vr/spawn-guard.js';

export function boot(cfg){
  cfg = cfg || {};
  const WIN=window, DOC=document;

  const qs=(k,d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a,Math.min(b,v)); };
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso=()=> new Date().toISOString();

  const DEBUG = (qs('debug','0')==='1');

  // deterministic rng (same as Hydration)
  function xmur3(str){
    str=String(str||'');
    let h=1779033703^str.length;
    for(let i=0;i<str.length;i++){
      h=Math.imul(h^str.charCodeAt(i),3432918353);
      h=(h<<13)|(h>>>19);
    }
    return function(){
      h=Math.imul(h^(h>>>16),2246822507);
      h=Math.imul(h^(h>>>13),3266489909);
      return (h^=(h>>>16))>>>0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0;b>>>=0;c>>>=0;d>>>=0;
      let t=(a+b)|0;
      a=b^(b>>>9);
      b=(c+(c<<3))|0;
      c=(c<<21)|(c>>>11);
      d=(d+1)|0;
      t=(t+d)|0;
      c=(c+t)|0;
      return (t>>>0)/4294967296;
    };
  }
  function makeRng(seedStr){
    const s=xmur3(seedStr);
    return sfc32(s(),s(),s(),s());
  }

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=>rng();

  const layer = DOC.getElementById('layer') || DOC.getElementById('stage') || DOC.querySelector('.layer');
  if(!layer){ console.warn('[Groups] Missing layer element'); return; }

  const SpawnGuard = createSpawnGuard({
    hudSelector: '.hud',
    margin: (view==='mobile')?12:14,
    debug: DEBUG
  });
  setInterval(()=>SpawnGuard.tick(false), 500);

  function layerRect(){ return layer.getBoundingClientRect(); }

  // ---- Minimal HUD (kept simple; your UI can override) ----
  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    grade: DOC.getElementById('uiGrade')
  };

  let playing=true, paused=false;
  let tLeft=plannedSec;
  let last=nowMs();
  let score=0, miss=0;

  // ---- Targets (generic) ----
  const targets = new Map();
  let idSeq=1;

  function makeTarget(kind, label, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='target';
    el.dataset.id=id;
    el.dataset.kind=kind;
    el.textContent=label;

    const r=layerRect();
    const pad=(view==='mobile')?18:22;

    // ✅ SAFE spawn (HUD-safe)
    const pt=SpawnGuard.random01(r01);
    let x=pt.x01 * WIN.innerWidth;
    let y=pt.y01 * WIN.innerHeight;
    x = clamp(x - r.left, pad, Math.max(pad, r.width - pad));
    y = clamp(y - r.top,  pad, Math.max(pad, r.height - pad));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    layer.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(0.8, ttlSec)*1000;
    targets.set(id,{id,el,kind,label,born,ttl});
    return {id,el,kind,label,born,ttl};
  }

  function removeTarget(id){
    const t=targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{ t.el.remove(); }catch(e){}
  }

  // click/tap
  layer.addEventListener('pointerdown',(ev)=>{
    if(!playing||paused) return;
    const el=ev.target?.closest?.('.target');
    if(!el) return;
    const t=targets.get(String(el.dataset.id));
    if(!t) return;
    score += (t.kind==='good') ? 10 : 2;
    removeTarget(t.id);
  }, {passive:true});

  // hha:shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    const r=layerRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    let best=null, bestD=1e9;
    for(const t of targets.values()){
      const bb=t.el.getBoundingClientRect();
      const tx=bb.left+bb.width/2, ty=bb.top+bb.height/2;
      const d=Math.hypot(tx-cx, ty-cy);
      if(d<bestD){ bestD=d; best=t; }
    }
    if(best && bestD<=lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot',(ev)=>{
    if(!playing||paused) return;
    const t=pickClosestToCenter(ev?.detail?.lockPx ?? 56);
    if(!t) return;
    score += (t.kind==='good') ? 10 : 2;
    removeTarget(t.id);
  });

  // tick
  let spawnAcc=0;
  function setHUD(){
    ui.score && (ui.score.textContent=String(score|0));
    ui.time && (ui.time.textContent=String(Math.ceil(tLeft)));
    ui.miss && (ui.miss.textContent=String(miss|0));
    ui.grade && (ui.grade.textContent='—');
  }

  function spawnTick(dt){
    const base = (diff==='hard')?1.0:(diff==='easy')?0.7:0.85;
    spawnAcc += base*dt;
    while(spawnAcc>=1){
      spawnAcc-=1;
      // simple: mostly good
      const p=r01();
      if(p<0.8) makeTarget('good','🥦', 2.8);
      else makeTarget('bad','🍩', 2.8);
    }
  }

  function updateTargets(){
    const t=nowMs();
    for(const obj of Array.from(targets.values())){
      if(t-obj.born >= obj.ttl){
        // expire
        if(obj.kind==='good'){ miss++; }
        removeTarget(obj.id);
      }
    }
  }

  function endIfNeeded(){
    if(tLeft<=0){
      playing=false;
      for(const obj of targets.values()){ try{ obj.el.remove(); }catch(e){} }
      targets.clear();
      return true;
    }
    return false;
  }

  function loop(){
    if(!playing) return;
    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-last)/1000));
    last=t;
    if(!paused){
      tLeft=Math.max(0, tLeft-dt);
      spawnTick(dt);
      updateTargets();
      setHUD();
      if(endIfNeeded()) return;
    }
    requestAnimationFrame(loop);
  }

  setHUD();
  requestAnimationFrame(loop);
}