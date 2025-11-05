// === Hero Health Academy — game/modes/goodjunk.js
// (interval spawner + immediate burst + HUD-safe spawn + self-watchdog)

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0, running=false, BUSRef=null;
let spawnTimer=null, safetyTimer=null, resizeBound=false, lastSpawnAt=0;

const PRESET = {
  Easy:   { every: 680, maxAlive: 7, life: 3200, size: 72, goldenProb: 0.10 },
  Normal: { every: 560, maxAlive: 8, life: 3000, size: 64, goldenProb: 0.14 },
  Hard:   { every: 480, maxAlive: 9, life: 2800, size: 58, goldenProb: 0.18 },
};

let cfg = PRESET.Normal;

function pick(a){ return a[(Math.random()*a.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

function collectHudRects(){
  const rects=[];
  const push=(el)=>{ if(!el) return; const r=el.getBoundingClientRect(); if(r.width>0&&r.height>0) rects.push(r); };
  push(document.querySelector('#hud'));
  push(document.querySelector('#questChips'));
  push(document.querySelector('#powerBarWrap'));
  push(document.querySelector('#resultModal'));
  return rects;
}
function overlaps(x,y,sz,rects){
  const r={left:x-sz/2, top:y-sz/2, right:x+sz/2, bottom:y+sz/2};
  for(const b of rects){ if(!(r.right<b.left||r.left>b.right||r.bottom<b.top||r.top>b.bottom)) return true; }
  return false;
}
function findFreeSpot(size){
  const ww=window.innerWidth, hh=window.innerHeight;
  const padX=Math.max(64,size*1.1), padY=Math.max(64,size*1.1);
  const rects = collectHudRects();
  for(let i=0;i<22;i++){
    const x=clamp(Math.random()*ww, padX, ww-padX);
    const y=clamp(Math.random()*hh, padY, hh-padY);
    if(!overlaps(x,y,size+12,rects)) return {x,y};
  }
  return { x:clamp(Math.random()*ww, padX, ww-padX), y:clamp(Math.random()*hh, padY, hh-padY) };
}

function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .28s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.7)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 300);
}

function flashRed(){
  const old=document.body.style.backgroundColor;
  document.body.style.transition='background .08s';
  document.body.style.backgroundColor='#2c0f10';
  setTimeout(()=>{ document.body.style.backgroundColor=old||''; }, 120);
}

function decideKind(){
  const r=Math.random();
  if(r < cfg.goldenProb) return 'gold';
  if(r < cfg.goldenProb + 0.35) return 'junk';
  return 'good';
}

function spawnOne(){
  if(!running || alive>=cfg.maxAlive) return;

  const kind=decideKind();
  const emoji=(kind==='gold'?pick(GOLD):kind==='junk'?pick(JUNK):pick(GOOD));
  const s=cfg.size;
  const pos=findFreeSpot(s);
  const x=pos.x, y=pos.y;

  const glow=(kind==='gold')?'0 0 28px rgba(255,205,80,.85)'
            :(kind==='good')?'0 0 18px rgba(80,200,255,.35)'
            :'0 0 18px rgba(255,120,120,.25)';

  const el=document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText=`
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow}); transition: transform .12s ease, opacity .24s ease;`;
  const life = cfg.life * (0.92 + Math.random()*0.18);
  const obj={ el, x, y, kind, dead:false, lifeId:0 };

  el.addEventListener('pointerdown',(ev)=>{
    if(!running||obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.86)';
    setTimeout(()=>{ el.style.opacity='0'; }, 20);
    setTimeout(()=>{ try{el.remove();}catch{}; }, 140);
    if(obj.lifeId) clearTimeout(obj.lifeId);

    const uiX=ev.clientX||x, uiY=ev.clientY||y;
    boomEffect(uiX,uiY,emoji);
    if(obj.kind==='junk'){
      BUSRef?.bad?.({ui:{x:uiX,y:uiY}, source:obj}); BUSRef?.sfx?.bad?.(); flashRed();
    }else{
      const isGold=(obj.kind==='gold'); const pts=isGold?150:100;
      BUSRef?.hit?.({points:pts, kind:isGold?'perfect':'good', ui:{x:uiX,y:uiY}, meta:{golden:isGold}});
      if(isGold) BUSRef?.sfx?.power?.(); else BUSRef?.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++; lastSpawnAt=performance.now?performance.now():Date.now();

  // อายุชิ้นแบบ timeout (ไม่ต้องพึ่ง rAF)
  obj.lifeId = setTimeout(()=>{
    if(obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    try{ el.style.opacity='0'; }catch{}
    setTimeout(()=>{ try{el.remove();}catch{}; }, 120);
    if (obj.kind!=='junk') BUSRef?.miss?.({source:obj});
  }, life);
}

function startIntervalSpawning(){
  stopIntervalSpawning();
  // spawn ต่อเนื่องตามค่า every
  spawnTimer = setInterval(()=>{ if(running && alive<cfg.maxAlive) spawnOne(); }, cfg.every);

  // safety: ถ้า 1.2 วิ. ไม่มีของใหม่ ให้บังคับสปอนทันที
  safetyTimer = setInterval(()=>{
    if(!running) return;
    const now=performance.now?performance.now():Date.now();
    if(now - lastSpawnAt > 1200 && alive < cfg.maxAlive) spawnOne();
  }, 600);
}
function stopIntervalSpawning(){
  clearInterval(spawnTimer); spawnTimer=null;
  clearInterval(safetyTimer); safetyTimer=null;
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  try{ host.innerHTML=''; }catch{}
  items=[]; alive=0; BUSRef=null; lastSpawnAt=0;
  cfg = PRESET[difficulty] || PRESET.Normal;
  running=true;

  // canvases ไม่บังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

  // เปิดเกมต้องมีให้เห็นทันที
  for(let i=0;i<Math.min(3, cfg.maxAlive); i++) spawnOne();

  // เริ่มสปอนต่อเนื่อง
  startIntervalSpawning();

  // จัดใหม่เมื่อจอเปลี่ยน
  if(!resizeBound){
    window.addEventListener('resize', onViewportChange, {passive:true}); 
    window.addEventListener('orientationchange', onViewportChange, {passive:true});
    resizeBound=true;
  }
}

export function update(_dt, bus){ BUSRef = bus || BUSRef; /* ไม่พึ่ง rAF แล้ว แต่คงไว้เพื่อเข้ากับ main.js */ }

export function stop(){
  running=false;
  stopIntervalSpawning();
}

export function cleanup(){
  running=false;
  stopIntervalSpawning();
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0;
}

export function onViewportChange(){
  const rects = collectHudRects();
  for(const it of items){
    const s = cfg?.size || 64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if (overlaps(it.x,it.y,s+12,rects)){
      const pos = findFreeSpot(s); it.x=pos.x; it.y=pos.y;
    }
    if (it.el){ it.el.style.left=it.x+'px'; it.el.style.top=it.y+'px'; }
  }
}