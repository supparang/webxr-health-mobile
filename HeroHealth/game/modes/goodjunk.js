// === Hero Health Academy — game/modes/goodjunk.js (LEGACY-STABLE)
// - ไม่พึ่ง rAF
// - สปอนด้วย setInterval เดี่ยว ๆ + เปิดฉาก burst
// - ไม่เช็ค HUD ทับ (กัน false positive)
// - ทำงานเหมือนเวอร์ชันที่เคยใช้ได้ดี

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

const PRESET = {
  Easy:   { spawnEvery: 600, maxAlive: 7, life: 3600, size: 72, goldenProb: 0.10 }, // ms
  Normal: { spawnEvery: 520, maxAlive: 8, life: 3400, size: 64, goldenProb: 0.14 },
  Hard:   { spawnEvery: 450, maxAlive: 9, life: 3200, size: 58, goldenProb: 0.18 },
};

let host, items=[], alive=0, running=false, cfg;
let spawnTimer=null, ageTimer=null, BUSRef=null;

function pick(a){ return a[(Math.random()*a.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
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
    font-size:42px;opacity:1;transition:all .32s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.8)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 320);
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
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText=`
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; cursor:pointer; user-select:none; pointer-events:auto;`;
  const life = cfg.life*(0.92+Math.random()*0.22);
  const obj={el,x,y,dieAt:performance.now()+life,kind,dead:false};

  el.addEventListener('pointerdown',(ev)=>{
    if(!running||obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.opacity='0'; setTimeout(()=>{ try{el.remove();}catch{}; },120);
    const uiX=ev.clientX||x, uiY=ev.clientY||y; boomEffect(uiX,uiY,emoji);
    if(kind==='junk'){ BUSRef?.bad?.({source:obj,ui:{x:uiX,y:uiY}}); BUSRef?.sfx?.bad?.(); }
    else{
      const gold=(kind==='gold'); const pts=gold?150:100;
      BUSRef?.hit?.({points:pts,kind:gold?'perfect':'good',ui:{x:uiX,y:uiY},meta:{golden:gold}});
      if(gold) BUSRef?.sfx?.power?.(); else BUSRef?.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj); alive++;
}

function clearTimers(){ clearInterval(spawnTimer); spawnTimer=null; clearInterval(ageTimer); ageTimer=null; }

export function start({difficulty='Normal'}={}){
  ensureHost();
  running=true; items=[]; alive=0;
  try{ host.innerHTML=''; }catch{}
  cfg = PRESET[difficulty] || PRESET.Normal;

  // เปิดฉากให้เห็นทันที
  const burst=Math.min(4,cfg.maxAlive);
  for(let i=0;i<burst;i++) spawnOne();

  // สปอนคงที่ แบบเดิมที่เคยใช้ได้ดี
  clearTimers();
  spawnTimer=setInterval(()=>{
    if(!running) return;
    if(alive<cfg.maxAlive) spawnOne();
  }, cfg.spawnEvery);

  // อายุไอเท็มแบบคงที่ (100ms/ครั้ง)
  ageTimer=setInterval(()=>{
    if(!running) return;
    const now=performance.now();
    for(let i=items.length-1;i>=0;i--){
      const it=items[i]; if(it.dead) { items.splice(i,1); continue; }
      if(now>=it.dieAt){
        it.dead=true; alive=Math.max(0,alive-1);
        try{ it.el.style.opacity='0'; }catch{}
        setTimeout(()=>{ try{it.el.remove();}catch{}; },100);
        if(it.kind!=='junk') BUSRef?.miss?.({source:it});
        items.splice(i,1);
      }
    }
  }, 100);

  // กัน canvas บังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });
}

export function update(_dt,bus){ BUSRef = bus || BUSRef; /* ไม่ต้องทำอะไร: ใช้ interval ล้วน */ }
export function stop(){ running=false; clearTimers(); }
export function cleanup(){ stop(); try{ if(host) host.innerHTML=''; }catch{} items=[]; alive=0; }
export function onViewportChange(){
  // ปรับให้อยู่ในจอ ถ้า rotate/resize
  for(const it of items){
    const s=cfg?.size||64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if(it.el){ it.el.style.left=it.x+'px'; it.el.style.top=it.y+'px'; }
  }
}
