// === Hero Health Academy — game/modes/goodjunk.js (LEGACY-STABLE v3)
// interval-only, ไม่พึ่ง rAF/observer, รับ BUS ตั้งแต่ start()
// ปรับถี่/จำนวนให้ aggressive เพื่อให้ "เห็นของแน่นอน"

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

// ms-based presets (ถี่ขึ้น + maxAlive สูงขึ้น)
const PRESET = {
  Easy:   { spawnEvery: 520, maxAlive: 10, life: 3400, size: 72, goldenProb: 0.10 },
  Normal: { spawnEvery: 460, maxAlive: 12, life: 3200, size: 64, goldenProb: 0.14 },
  Hard:   { spawnEvery: 420, maxAlive: 14, life: 3000, size: 58, goldenProb: 0.18 },
};

let host, items=[], alive=0, running=false, cfg;
let spawnTimer=null, ageTimer=null, BUSRef=null;

function pnow(){ try{ return performance.now(); }catch{ return Date.now(); } }
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
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });
}

function randPos(size){
  const ww=window.innerWidth, hh=window.innerHeight;
  const padX=Math.max(60,size*1.1), padY=Math.max(60,size*1.1);
  return {
    x: clamp(Math.random()*ww, padX, ww-padX),
    y: clamp(Math.random()*hh, padY, hh-padY),
  };
}

function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .28s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.6)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 280);
}

function decideKind(){
  const r=Math.random();
  if(r<(cfg.goldenProb||0.12)) return 'gold';
  if(r<(cfg.goldenProb||0.12)+0.35) return 'junk';
  return 'good';
}

function spawnOne(){
  if(!running || alive>=cfg.maxAlive) return;

  const kind=decideKind();
  const emoji=(kind==='gold'?pick(GOLD):kind==='junk'?pick(JUNK):pick(GOOD));
  const s=cfg.size;
  const {x,y}=randPos(s);

  const el=document.createElement('div');
  el.className='gj-it gj-real';
  el.textContent=emoji;
  el.style.cssText=`
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; cursor:pointer; user-select:none; pointer-events:auto;`;
  const life = cfg.life*(0.92+Math.random()*0.22);
  const obj={el,x,y,dieAt:pnow()+life,kind,dead:false};

  el.addEventListener('pointerdown',(ev)=>{
    if(!running||obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.opacity='0'; setTimeout(()=>{ try{el.remove();}catch{}; },110);
    const uiX=ev.clientX||x, uiY=ev.clientY||y; boomEffect(uiX,uiY,emoji);
    if(!BUSRef) return;
    if(kind==='junk'){ BUSRef.bad?.({source:obj,ui:{x:uiX,y:uiY}}); BUSRef.sfx?.bad?.(); }
    else{
      const gold=(kind==='gold'); const pts=gold?150:100;
      BUSRef.hit?.({points:pts,kind:gold?'perfect':'good',ui:{x:uiX,y:uiY},meta:{golden:gold}});
      if(gold) BUSRef.sfx?.power?.(); else BUSRef.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj); alive++;
}

function clearTimers(){ clearInterval(spawnTimer); spawnTimer=null; clearInterval(ageTimer); ageTimer=null; }

export function start({difficulty='Normal', bus=null}={}){
  ensureHost();
  running=true; items=[]; alive=0; BUSRef = bus || BUSRef;
  try{ host.innerHTML=''; }catch{}
  cfg = PRESET[difficulty] || PRESET.Normal;

  // เปิดฉากแน่น ๆ
  const burst = Math.min(6, cfg.maxAlive);
  for(let i=0;i<burst;i++) spawnOne();

  clearTimers();
  spawnTimer=setInterval(()=>{ if(running && alive<cfg.maxAlive) spawnOne(); }, cfg.spawnEvery);
  ageTimer=setInterval(()=>{
    if(!running) return;
    const now=pnow();
    for(let i=items.length-1;i>=0;i--){
      const it=items[i]; if(it.dead){ items.splice(i,1); continue; }
      if(now>=it.dieAt){
        it.dead=true; alive=Math.max(0,alive-1);
        try{ it.el.style.opacity='0'; }catch{}
        setTimeout(()=>{ try{it.el.remove();}catch{}; },90);
        if(BUSRef && it.kind!=='junk') BUSRef.miss?.({source:it});
        items.splice(i,1);
      }
    }
  }, 100);
}

export function update(_dt,bus){ if(bus) BUSRef = bus; }
export function stop(){ running=false; clearTimers(); }
export function cleanup(){ stop(); try{ if(host) host.innerHTML=''; }catch{} items=[]; alive=0; }
export function onViewportChange(){
  for(const it of items){
    const s=cfg?.size||64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if(it.el){ it.el.style.left=it.x+'px'; it.el.style.top=it.y+'px'; }
  }
}
