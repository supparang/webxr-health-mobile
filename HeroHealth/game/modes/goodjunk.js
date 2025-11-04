// === Hero Health Academy — game/modes/goodjunk.js (stable: clock-agnostic + spawn watchdog nudge) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = fever + คะแนนพิเศษ

let host, items=[], alive=0;
let cfg, spawnAcc=0, running=false;

// ความหนาแน่น/อายุ/ขนาด ปรับตามความยาก
const PRESET = {
  Easy:   { spawnEvery: 1.8, maxAlive: 4,  life: 4.2, size: 76 },
  Normal: { spawnEvery: 1.4, maxAlive: 5,  life: 3.6, size: 64 },
  Hard:   { spawnEvery: 1.1, maxAlive: 6,  life: 3.2, size: 54 },
};

const pick=(a)=>a[(Math.random()*a.length)|0];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

function findFreeSpot(size){
  const pad=Math.max(70,size*1.3);
  const ww=window.innerWidth, hh=window.innerHeight;
  const minDist=size*1.4;
  for(let k=0;k<10;k++){
    const x=clamp(Math.random()*ww,pad,ww-pad);
    const y=clamp(Math.random()*hh,pad+20,hh-pad-80);
    let ok=true;
    for(const it of items){
      if(!it.dead && Math.hypot(x-it.x,y-it.y)<minDist){ ok=false; break; }
    }
    if(ok) return {x,y};
  }
  return {
    x:clamp(Math.random()*ww,pad,ww-pad),
    y:clamp(Math.random()*hh,pad+20,hh-pad-80)
  };
}

function spawnOne(BUS){
  if(!running) return;
  if(alive >= cfg.maxAlive) return;

  // สัดส่วน: good ~58% / junk ~28% / gold ~14%
  const r=Math.random();
  const kind=(r>0.86)?'gold':(r>0.58)?'junk':'good';
  const emoji = kind==='gold'?pick(GOLD):kind==='junk'?pick(JUNK):pick(GOOD);

  const {x,y}=findFreeSpot(cfg.size);
  const s=cfg.size;
  const glow=(kind==='gold')?'0 0 28px rgba(255,205,80,.85)'
            :(kind==='good')?'0 0 18px rgba(80,200,255,.35)'
            :'0 0 18px rgba(255,120,120,.25)';

  const el=document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText=`
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;
    font-size:${s-6}px;user-select:none;cursor:pointer;pointer-events:auto;
    filter:drop-shadow(${glow});transition:transform .12s ease, opacity .28s ease;
  `;

  const life=cfg.life*(0.93+Math.random()*0.2);
  const obj={ el,x,y,t:0,life,kind,dead:false };

  el.addEventListener('pointerdown',(ev)=>{
    if(obj.dead || !running) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.82)';
    setTimeout(()=>{ el.style.opacity='0'; },25);
    setTimeout(()=>{ try{el.remove();}catch{}; },180);

    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){
      BUS.bad?.({source:obj,ui}); BUS.sfx?.bad?.();
    }else{
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

function tick(dt,BUS){
  if(!running) return;

  // เติมของตามเวลา (ใช้ while เพื่อเคลียร์ backlog กรณี dt ใหญ่)
  spawnAcc+=dt;
  while(spawnAcc >= cfg.spawnEvery){
    spawnAcc -= cfg.spawnEvery;
    spawnOne(BUS);
  }

  // หมดอายุ
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if(it.t >= it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{}; },160);
      if(it.kind!=='junk'){ BUS.miss?.({source:it}); }
      items.splice(i,1);
    }
  }
}

/* ===== Public API ===== */
export function start({difficulty='Normal'}={}){
  ensureHost();
  running=true; items=[]; alive=0; spawnAcc=0;
  cfg=PRESET[difficulty]||PRESET.Normal;

  try{
    host.style.pointerEvents='auto';
    document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; });
  }catch{}

  // เริ่มด้วยของตั้งต้น 3 ชิ้น
  for(let i=0;i<3;i++) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
}

export function update(dt,BUS){
  let d=Number(dt);
  if(!(d>0)) d=0.016;
  if(d>0.5) d=0.5; // clamp เฟรมกระโดด
  tick(d,BUS);
}

// ให้ main เรียกถ้าเงียบ: เติมเพิ่ม 1–2 ชิ้นถ้าของน้อยเกินไป
export function nudge(BUS){
  if(alive < Math.max(1,(cfg?.maxAlive||4)>>1)){
    spawnOne(BUS); spawnOne(BUS);
  }
}

export function stop(){ running=false; }
export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0;
}