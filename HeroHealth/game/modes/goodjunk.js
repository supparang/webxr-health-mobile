// === Hero Health Academy — game/modes/goodjunk.js
// (robust spawn: keep-at-maxAlive + DOM reconcile + heartbeat)
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0;
let cfg, spawnAcc=0, running=false;
let hbAcc=0, sinceSpawn=0, reconAcc=0;

const PRESET = {
  Easy:   { spawnEvery: 1.6, maxAlive: 4, life: 4.2, size: 76 },
  Normal: { spawnEvery: 1.2, maxAlive: 5, life: 3.6, size: 64 },
  Hard:   { spawnEvery: 1.0, maxAlive: 6, life: 3.2, size: 54 },
};

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pick=(arr)=>arr[(Math.random()*arr.length)|0];

function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; document.body.appendChild(host); }
  host.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:auto;display:block;opacity:1;visibility:visible';
}

function findFreeSpot(size){
  const pad=Math.max(70,size*1.3);
  const ww=innerWidth||window.innerWidth, hh=innerHeight||window.innerHeight;
  const minDist=size*1.4;
  for(let k=0;k<10;k++){
    const x=clamp(Math.random()*ww,pad,ww-pad);
    const y=clamp(Math.random()*hh,pad+20,hh-pad-80);
    let ok=true;
    for(const it of items){ if(!it.dead && Math.hypot(x-it.x,y-it.y)<minDist){ ok=false; break; } }
    if(ok) return {x,y};
  }
  return { x:clamp(Math.random()*ww,pad,ww-pad), y:clamp(Math.random()*hh,pad+20,hh-pad-80) };
}

function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .36s ease;z-index:10000;pointer-events:none;`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.7)'; p.style.opacity='0';});
  setTimeout(()=>{ try{p.remove();}catch{}; }, 340);
}

function spawnOne(BUS){
  if(!running) return;
  if(alive>=cfg.maxAlive) return;

  const r=Math.random();
  let kind='good';
  if(r>0.86) kind='gold';
  else if(r>0.58) kind='junk';

  const emoji = kind==='gold'?pick(GOLD):(kind==='junk'?pick(JUNK):pick(GOOD));
  const {x,y}=findFreeSpot(cfg.size);
  const s=cfg.size;

  const glow=(kind==='gold')?'0 0 28px rgba(255,205,80,.85)':
             (kind==='good')?'0 0 18px rgba(80,200,255,.35)':
                              '0 0 18px rgba(255,120,120,.25)';

  const el=document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText=`
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow});
    transition: transform .12s ease, opacity .28s ease;
  `;

  const life=cfg.life*(0.93+Math.random()*0.2);
  const obj={ el, x, y, t:0, life, kind, dead:false };

  el.addEventListener('pointerdown',(ev)=>{
    if(obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.82)';
    setTimeout(()=>{ el.style.opacity='0'; }, 25);
    setTimeout(()=>{ try{el.remove();}catch{}; }, 170);
    boomEffect(x,y,emoji);

    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){ BUS.bad?.({source:obj,ui}); BUS.sfx?.bad?.(); }
    else{
      const isGold=(kind==='gold'); const base=isGold?50:10;
      BUS.hit?.({points:base,kind:isGold?'perfect':'good',ui,meta:{golden:isGold}});
      if(isGold) BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++; sinceSpawn=0;
}

function reconcileDomCount(){
  // ถ้า DOM มีน้อยกว่า alive ให้ sync จาก DOM จริง
  try{
    const domCnt = host.querySelectorAll('.gj-it').length|0;
    if(domCnt < alive) alive = domCnt + items.filter(it=>!it.dead).length - (host.querySelectorAll('.gj-it').length - domCnt);
    // เติมให้ถึง maxAlive ถ้ายังไม่ครบ
    let need = Math.max(0, cfg.maxAlive - domCnt);
    while(need-- > 0) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
  }catch{}
}

function tick(dt,BUS){
  if(!running) return;

  spawnAcc+=dt; hbAcc+=dt; reconAcc+=dt; sinceSpawn+=dt;

  // สปอว์นตามช่วงเวลา
  const need=Math.floor(spawnAcc/cfg.spawnEvery);
  if(need>0){
    spawnAcc-=need*cfg.spawnEvery;
    for(let i=0;i<need;i++) spawnOne(BUS);
  }

  // อายุ + miss
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t+=dt;
    if(it.t>=it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{it.el.remove();}catch{}; }, 150);
      if(it.kind!=='junk') BUS.miss?.({source:it});
      items.splice(i,1);
    }
  }

  // Heartbeat: เติมจนถึง maxAlive เสมอ
  if(hbAcc>=0.5){
    hbAcc=0;
    const domCnt = (host.querySelectorAll('.gj-it').length|0);
    let toAdd = Math.max(0, (cfg.maxAlive - Math.max(alive, domCnt)));
    while(toAdd-- > 0) spawnOne(BUS);
  }

  // ถ้าเงียบเกิน 1.6s ให้บังคับเติม 1–2 ชิ้น
  if(sinceSpawn>1.6){
    sinceSpawn=0;
    let toAdd=Math.min(2, Math.max(0, cfg.maxAlive - alive));
    while(toAdd-- > 0) spawnOne(BUS);
  }

  // DOM reconcile ช่วง ๆ กัน edge-case
  if(reconAcc>=1.2){ reconAcc=0; reconcileDomCount(); }
}

// ---------- Public ----------
export function start({difficulty='Normal'}={}){
  ensureHost();
  running=true; items=[]; alive=0; spawnAcc=0; hbAcc=0; reconAcc=0; sinceSpawn=0;
  cfg=PRESET[difficulty]||PRESET.Normal;

  try{
    document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; });
    const hud=document.getElementById('hud'); if(hud) hud.style.pointerEvents='none';
    host.style.pointerEvents='auto';
  }catch{}

  // เติมตั้งต้นจนถึง maxAlive เลย
  for(let i=0;i<cfg.maxAlive;i++) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
}

export function update(dt,BUS){
  if(!(dt>0)||dt>1.5) dt=0.016;
  tick(dt,BUS);
}

export function stop(){ running=false; }

export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0;
}

// optional nudge
export function nudge(BUS){ if(!running) return; let need=Math.max(0,cfg.maxAlive - (host.querySelectorAll('.gj-it').length|0)); while(need-- > 0) spawnOne(BUS); }