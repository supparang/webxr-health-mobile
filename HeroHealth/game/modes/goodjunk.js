// === Hero Health Academy — game/modes/goodjunk.js
// (mobile-fast cadence + internal heartbeat watchdog + HUD-safe spawn)

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0, running=false, spawnAcc=0, cfg, BUSRef=null;
let lastSpawnAt = 0, hbId = null;

// เร่งความถี่บนมือถือ + กำหนดเพดานต่ำสุดของ interval
const adapt = { accel:0, minEvery:(/Mobi|Android/i.test(navigator.userAgent)?0.36:0.40), accelPerSec:0.0038 };

const PRESET = {
  Easy:   { spawnEvery: 1.00, maxAlive: 8, life: 3.8, size: 68, goldenProb: 0.12 },
  Normal: { spawnEvery: 0.90, maxAlive: 9, life: 3.6, size: 64, goldenProb: 0.15 },
  Hard:   { spawnEvery: 0.78, maxAlive:10, life: 3.2, size: 60, goldenProb: 0.18 },
};

function pick(a){ return a[(Math.random()*a.length) | 0]; }
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

/* ---------- HUD-safe ---------- */
function collectHudRects(){
  const rects=[]; const push=(el)=>{ if(!el) return; const r=el.getBoundingClientRect(); if(r.width>0&&r.height>0) rects.push(r); };
  push(document.querySelector('#hud'));
  push(document.querySelector('#questChips'));
  push(document.querySelector('#powerBarWrap'));
  push(document.querySelector('#resultModal'));
  return rects;
}
function overlaps(x,y,sz,rects){
  const r={left:x-sz/2,top:y-sz/2,right:x+sz/2,bottom:y+sz/2};
  return rects.some(b=> !(r.right<b.left||r.left>b.right||r.bottom<b.top||r.top>b.bottom));
}
function findFreeSpot(size){
  const ww=innerWidth, hh=innerHeight;
  const padX=Math.max(64,size*1.15), padY=Math.max(64,size*1.15);
  const rects=collectHudRects();
  for(let i=0;i<28;i++){
    const x=clamp(Math.random()*ww, padX, ww-padX);
    const y=clamp(Math.random()*hh, padY, hh-padY);
    if(!overlaps(x,y,size+12,rects)) return {x,y};
  }
  return { x:clamp(Math.random()*ww,padX,ww-padX), y:clamp(Math.random()*hh,padY,hh-padY) };
}

/* ---------- FX ---------- */
function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .35s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.8)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 360);
}

/* ---------- Core spawn ---------- */
function currentEvery(){ return Math.max(adapt.minEvery, cfg.spawnEvery - adapt.accel); }

function decideKind(){
  const r=Math.random(); if(r<(cfg.goldenProb||0.12)) return 'gold';
  if(r<(cfg.goldenProb||0.12)+0.35) return 'junk'; return 'good';
}

function spawnOne(){
  if(!running || alive>=cfg.maxAlive) return;

  const kind=decideKind();
  const emoji=(kind==='gold'?pick(GOLD):kind==='junk'?pick(JUNK):pick(GOOD));

  const s=cfg.size; const pos=findFreeSpot(s); const x=pos.x,y=pos.y;
  const glow=(kind==='gold')?'0 0 28px rgba(255,205,80,.85)'
            :(kind==='good')?'0 0 18px rgba(80,200,255,.35)'
            :'0 0 18px rgba(255,120,120,.25)';

  const el=document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;
    font-size:${s-6}px;user-select:none;cursor:pointer;pointer-events:auto;
    filter:drop-shadow(${glow});transition:transform .12s ease,opacity .24s ease;`;
  const life=cfg.life*(0.92+Math.random()*0.22);
  const obj={el,x,y,t:0,life,kind,dead:false};

  el.addEventListener('pointerdown',(ev)=>{
    if(!running||obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.84)'; setTimeout(()=>{ el.style.opacity='0'; },30);
    setTimeout(()=>{ try{el.remove();}catch{} },160);
    const uiX=ev.clientX||x, uiY=ev.clientY||y; boomEffect(uiX,uiY,emoji);
    const ui={x:uiX,y:uiY};
    if(kind==='junk'){ BUSRef?.bad?.({source:obj,ui}); BUSRef?.sfx?.bad?.(); }
    else { const gold=(kind==='gold'); const pts=gold?150:100; BUSRef?.hit?.({points:pts,kind:gold?'perfect':'good',ui,meta:{golden:gold}}); if(gold) BUSRef?.sfx?.power?.(); else BUSRef?.sfx?.good?.(); }
    lastSpawnAt = performance.now?performance.now():Date.now();
  }, {passive:true});

  host.appendChild(el); items.push(obj); alive++;
  lastSpawnAt = performance.now?performance.now():Date.now();
}

function tick(dt){
  if(!running) return;
  if(!(dt>0)||dt>1.2) dt=0.016;

  adapt.accel = Math.min(0.9, adapt.accel + adapt.accelPerSec*dt);

  spawnAcc += dt;
  const every=currentEvery();
  while(spawnAcc >= every){ spawnAcc -= every; spawnOne(); }

  for(let i=items.length-1;i>=0;i--){
    const it=items[i]; if(it.dead){ items.splice(i,1); continue; }
    it.t+=dt;
    if(it.t>=it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{it.el.remove();}catch{} },140);
      if(it.kind!=='junk') BUSRef?.miss?.({source:it});
      items.splice(i,1);
    }
  }
}

/* ---------- Internal heartbeat (กันเงียบ) ---------- */
function heartbeat(){
  if(!running) return;
  const now = performance.now?performance.now():Date.now();
  // ถ้าไม่มีอะไรเกิดเลยนาน > 900ms หรือจำนวนบนจอน้อยกว่า 2 → บังคับสปอน
  const tooQuiet = (now - lastSpawnAt) > 900;
  if (alive < Math.min(3, (cfg.maxAlive|0)-2) || tooQuiet) {
    try{ spawnOne(); }catch{}
  }
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  try{ host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0; lastSpawnAt = 0;
  cfg = PRESET[difficulty] || PRESET.Normal;
  running=true;

  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

  // seed ให้เห็นทันที
  for(let i=0;i<Math.min(5, cfg.maxAlive); i++) spawnOne();

  // heartbeat ทุก 600ms กันเงียบ
  clearInterval(hbId);
  hbId = setInterval(heartbeat, 600);

  window.removeEventListener('resize', onViewportChange);
  window.addEventListener('resize', onViewportChange, {passive:true});
  window.removeEventListener('orientationchange', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange, {passive:true});
}

export function update(dt,bus){ BUSRef = bus || BUSRef; tick(dt); }
export function stop(){
  running=false;
  clearInterval(hbId); hbId=null;
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('orientationchange', onViewportChange);
}
export function cleanup(){
  running=false; clearInterval(hbId); hbId=null;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0; lastSpawnAt = 0;
}

export function onViewportChange(){
  const rects=collectHudRects();
  for(const it of items){
    const s=cfg?.size||64;
    it.x=clamp(it.x,s,innerWidth-s);
    it.y=clamp(it.y,s,innerHeight-s);
    if(overlaps(it.x,it.y,s+12,rects)){ const p=findFreeSpot(s); it.x=p.x; it.y=p.y; }
    if(it.el){ it.el.style.left=it.x+'px'; it.el.style.top=it.y+'px'; }
  }
}