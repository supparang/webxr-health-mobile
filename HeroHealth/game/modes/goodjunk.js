// === Hero Health Academy — game/modes/goodjunk.js (spawn-nudge + host-visibility) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = special points + fever

let host, items = [], alive = 0;
let cfg, spawnAcc = 0, running = false;

// ความหนาแน่นต่ำ + อายุชิ้นนานขึ้น + ขนาดแตกต่างตามระดับความยาก
const PRESET = {
  Easy:   { spawnEvery: 1.8, maxAlive: 4,  life: 4.2, size: 76 },
  Normal: { spawnEvery: 1.4, maxAlive: 5,  life: 3.6, size: 64 },
  Hard:   { spawnEvery: 1.1, maxAlive: 6,  life: 3.2, size: 54 },
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    document.body.appendChild(host);
  }
  // บังคับให้มองเห็น/คลิกได้เสมอ (กันโดน CSS อื่นทับ)
  host.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:auto;display:block;opacity:1;visibility:visible';
}

// หาตำแหน่งใหม่ โดยเลี่ยงไม่ให้ซ้อนของเดิมเกินระยะกำหนด
function findFreeSpot(size){
  const pad = Math.max(70, size * 1.3);
  const ww = window.innerWidth, hh = window.innerHeight;
  const minDist = size * 1.4;

  for (let attempt=0; attempt<10; attempt++){
    const x = clamp(Math.random()*ww, pad, ww-pad);
    const y = clamp(Math.random()*hh, pad+20, hh-pad-80);
    let ok = true;
    for (const it of items){
      const dx = x - it.x, dy = y - it.y;
      if (Math.hypot(dx,dy) < minDist){ ok = false; break; }
    }
    if (ok) return {x,y};
  }
  // ถ้าหาไม่ได้ก็สุ่มแบบปกติ
  return { 
    x: clamp(Math.random()*ww, pad, ww-pad), 
    y: clamp(Math.random()*hh, pad+20, hh-pad-80)
  };
}

// เอฟเฟกต์แตก (visual)
function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .4s ease;z-index:10000;pointer-events:none;`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.8)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 380);
}

// สร้างไอเท็ม 1 ชิ้น
function spawnOne(BUS){
  if (!running) return;
  if (alive >= cfg.maxAlive) return;

  const r = Math.random();
  let kind = 'good';
  if (r > 0.86) kind = 'gold';
  else if (r > 0.58) kind = 'junk';

  const emoji = kind==='gold' ? pick(GOLD)
               : kind==='junk' ? pick(JUNK)
               : pick(GOOD);

  const pos = findFreeSpot(cfg.size);
  const x = pos.x, y = pos.y;
  const s = cfg.size;

  const glow = (kind==='gold') ? '0 0 28px rgba(255,205,80,.85)'
             : (kind==='good') ? '0 0 18px rgba(80,200,255,.35)'
             : '0 0 18px rgba(255,120,120,.25)';

  const el = document.createElement('div');
  el.className = 'gj-it';
  el.textContent = emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow});
    transition: transform .12s ease, opacity .28s ease;
  `;

  const life = cfg.life * (0.93 + Math.random()*0.2);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  // เมื่อคลิก
  el.addEventListener('pointerdown',(ev)=>{
    if (obj.dead) return;
    obj.dead=true;
    alive=Math.max(0,alive-1);

    el.style.transform='translate(-50%,-50%) scale(0.82)';
    setTimeout(()=>{ el.style.opacity='0'; }, 30);
    setTimeout(()=>{ try{ el.remove(); }catch{}; }, 170);
    boomEffect(x,y,emoji);

    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){
      BUS.bad?.({source:obj,ui});
      BUS.sfx?.bad?.();
    } else {
      const isGold=(kind==='gold');
      const base=isGold?50:10;
      BUS.hit?.({points:base,kind:isGold?'perfect':'good',ui,meta:{golden:isGold}});
      if(isGold) BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

// ลูปอัปเดต
function tick(dt,BUS){
  if(!running) return;

  spawnAcc+=dt;
  const need=Math.floor(spawnAcc/cfg.spawnEvery);
  if(need>0){
    spawnAcc-=need*cfg.spawnEvery;
    for(let i=0;i<need;i++) spawnOne(BUS);
  }

  // ตรวจอายุ
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){items.splice(i,1);continue;}
    it.t+=dt;
    if(it.t>=it.life){
      it.dead=true;
      alive=Math.max(0,alive-1);
      try{it.el.style.opacity='0';}catch{}
      setTimeout(()=>{try{it.el.remove();}catch{};},150);
      if(it.kind!=='junk') BUS.miss?.({source:it});
      items.splice(i,1);
    }
  }
}

// ---------- Public ----------
export function start({difficulty='Normal'}={}){
  ensureHost();
  running=true;
  items=[];alive=0;spawnAcc=0;
  cfg=PRESET[difficulty]||PRESET.Normal;

  // กันกรณีองค์ประกอบอื่นบังคลิก
  try{
    document.querySelectorAll('canvas, #hud, #hud *').forEach(n=>{
      if(n.id!=='resultModal'){
        if(n.id==='hud') n.style.pointerEvents = 'none';
      }
    });
    host.style.pointerEvents='auto';
  }catch{}

  // เริ่มด้วยของตั้งต้น 3 ชิ้น
  for(let i=0;i<3;i++) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});

  // เผื่อมี CSS ไปซ่อน .gj-it
  const ss=document.createElement('style');
  ss.textContent='.gj-it{visibility:visible;opacity:1}';
  document.head.appendChild(ss);
}

export function update(dt,BUS){
  if(!(dt>0)||dt>1.5) dt=0.016;
  tick(dt,BUS);
}

export function stop(){ running = false; }

export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[];alive=0;
}

// NEW: ใช้ให้ main กระตุกเมื่อจอโล่ง
export function nudge(BUS){
  if(!running) return;
  const need = Math.min(3, Math.max(1, (cfg?.maxAlive||4) - alive));
  for(let i=0;i<need;i++) spawnOne(BUS);
}