// === /herohealth/vr-plate/plate.safe.js ===
// PlateVR SAFE — PRODUCTION scaffold
// ✅ deterministic + hha:shoot + HUD-safe spawn via SpawnGuard
// FULL v20260301-PLATE-SAFE-SPAWNGUARD
'use strict';

import { createSpawnGuard } from '../vr/spawn-guard.js';

export function boot(cfg){
  cfg = cfg || {};
  const WIN=window, DOC=document;

  const qs=(k,d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a,Math.min(b,v)); };
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  const DEBUG = (qs('debug','0')==='1');

  function xmur3(str){ str=String(str||''); let h=1779033703^str.length;
    for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=(h<<13)|(h>>>19); }
    return function(){ h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); return (h^=(h>>>16))>>>0; };
  }
  function sfc32(a,b,c,d){ return function(){ a>>>=0;b>>>=0;c>>>=0;d>>>=0;
    let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0;
    t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; };
  }
  function makeRng(seedStr){ const s=xmur3(seedStr); return sfc32(s(),s(),s(),s()); }

  const view=String(cfg.view || qs('view','mobile')).toLowerCase();
  const diff=String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec=clamp(cfg.time ?? qs('time','80'), 20, 300);
  const seedStr=String(cfg.seed || qs('seed', String(Date.now())));
  const rng=makeRng(seedStr);
  const r01=()=>rng();

  const layer=DOC.getElementById('layer');
  if(!layer){ console.warn('[Plate] Missing #layer'); return; }

  const SpawnGuard=createSpawnGuard({ hudSelector:'.hud', margin:(view==='mobile')?12:14, debug:DEBUG });
  setInterval(()=>SpawnGuard.tick(false), 500);

  function layerRect(){ return layer.getBoundingClientRect(); }

  // Minimal demo targets (replace with plate food mechanics)
  const items=new Map(); let idSeq=1;

  function spawnFood(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='food';
    el.dataset.id=id;
    el.dataset.kind=kind;
    el.textContent=emoji;

    const r=layerRect();
    const pad=(view==='mobile')?18:22;

    const pt=SpawnGuard.random01(r01);
    let x=pt.x01 * WIN.innerWidth;
    let y=pt.y01 * WIN.innerHeight;
    x = clamp(x - r.left, pad, Math.max(pad, r.width - pad));
    y = clamp(y - r.top,  pad, Math.max(pad, r.height - pad));

    el.style.left=`${x}px`;
    el.style.top=`${y}px`;

    layer.appendChild(el);
    const born=nowMs();
    const ttl=Math.max(0.8, ttlSec)*1000;
    items.set(id,{id,el,kind,emoji,born,ttl});
    return items.get(id);
  }

  function remove(id){ const it=items.get(String(id)); if(!it) return; items.delete(String(id)); try{ it.el.remove(); }catch(e){} }

  // click/tap
  layer.addEventListener('pointerdown',(ev)=>{
    const el=ev.target?.closest?.('.food'); if(!el) return;
    remove(el.dataset.id);
  }, {passive:true});

  // shoot
  WIN.addEventListener('hha:shoot',()=>{
    // optional: implement closest-to-center like Hydration if needed
  });

  let playing=true, tLeft=plannedSec, last=nowMs(), acc=0;
  function loop(){
    if(!playing) return;
    const t=nowMs(); const dt=Math.min(0.05, Math.max(0.001, (t-last)/1000)); last=t;
    tLeft=Math.max(0, tLeft-dt);

    const base=(diff==='hard')?1.0:(diff==='easy')?0.7:0.85;
    acc += base*dt;
    while(acc>=1){
      acc-=1;
      spawnFood('food', (r01()<0.5)?'🍚':'🥦', 2.8);
    }

    for(const it of Array.from(items.values())){
      if(t - it.born >= it.ttl) remove(it.id);
    }

    if(tLeft<=0){ playing=false; for(const it of items.values()){ try{it.el.remove();}catch(e){} } items.clear(); return; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}