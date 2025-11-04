// === Hero Health Academy — game/modes/goodjunk.js (spawn watchdog + bus-inject) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

let host, items=[], alive=0;
let cfg, spawnAcc=0, running=false;
let lastBUS=null;
let watchdogId=null;     // กัน “เริ่มแล้วไม่เกิด”
let lastSpawnMs=0;

// ความหนาแน่น & ขนาด
const PRESET = {
  Easy:   { spawnEvery: 1.20, maxAlive: 6,  life: 3.8, size: 72 },
  Normal: { spawnEvery: 1.00, maxAlive: 7,  life: 3.4, size: 62 },
  Hard:   { spawnEvery: 0.90, maxAlive: 8,  life: 3.1, size: 54 },
};

const now = ()=>performance.now?performance.now():Date.now();
function pick(a){ return a[(Math.random()*a.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

// หาโพซิชันไม่ชนกัน
function findFreeSpot(size){
  const pad = Math.max(70, size*1.2);
  const ww = innerWidth, hh = innerHeight;
  const minDist = size*1.4;
  for(let k=0;k<10;k++){
    const x = clamp(Math.random()*ww, pad, ww-pad);
    const y = clamp(Math.random()*hh, pad+20, hh-pad-80);
    let ok = true;
    for(const it of items){
      if(!it.dead && Math.hypot(x-it.x, y-it.y) < minDist){ ok=false; break; }
    }
    if(ok) return {x,y};
  }
  return {
    x: clamp(Math.random()*ww, pad, ww-pad),
    y: clamp(Math.random()*hh, pad+20, hh-pad-80)
  };
}

function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%) scale(1);font-size:42px;opacity:1;transition:all .4s ease;z-index:9000;pointer-events:none;';
  document.body.appendChild(p);
  setTimeout(()=>{p.style.transform='translate(-50%,-50%) scale(1.8)';p.style.opacity='0';},10);
  setTimeout(()=>{try{p.remove();}catch{};},400);
}

function spawnOne(BUS){
  if(alive >= cfg.maxAlive) return;
  ensureHost();

  const r = Math.random();
  let kind = (r>0.86)?'gold' : (r>0.58)?'junk' : 'good';
  const emoji = kind==='gold'?pick(GOLD) : kind==='junk'?pick(JUNK) : pick(GOOD);

  const {x,y} = findFreeSpot(cfg.size);
  const s = cfg.size;
  const glow = (kind==='gold')?'0 0 26px rgba(255,205,80,.85)'
    : (kind==='good')?'0 0 18px rgba(80,200,255,.30)':'0 0 18px rgba(255,120,120,.25)';
  const el = document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;
    font-size:${s-6}px;user-select:none;cursor:pointer;pointer-events:auto;
    filter:drop-shadow(${glow});transition:transform .12s ease,opacity .28s ease;
  `;

  const life = cfg.life*(0.92+Math.random()*0.18);
  const obj = { el,x,y,t:0,life,kind,dead:false };

  el.addEventListener('pointerdown',(ev)=>{
    if(obj.dead) return;
    obj.dead=true; alive=Math.max(0,alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.82)';
    setTimeout(()=>{ el.style.opacity='0'; }, 30);
    setTimeout(()=>{ try{el.remove();}catch{}; }, 180);
    boomEffect(x,y,emoji);

    const ui={x:ev.clientX,y:ev.clientY};
    const BUSx = lastBUS || BUS || {};
    if(kind==='junk'){
      BUSx.bad?.({source:obj,ui}); BUSx.sfx?.bad?.();
    }else{
      const isGold=(kind==='gold'); const base=isGold?50:10;
      BUSx.hit?.({points:base,kind:isGold?'perfect':'good',ui,meta:{golden:isGold}});
      if(isGold) BUSx.sfx?.power?.(); else BUSx.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
  lastSpawnMs = now();
}

function ensureSome(BUS){
  // ถ้าหายเงียบ > 1500ms หรือจำนวนบนจอน้อยกว่า 2 → เติม
  const silent = (now()-lastSpawnMs) > 1500;
  const liveCount = items.filter(it=>!it.dead).length;
  if(silent || liveCount < Math.min(2, cfg.maxAlive)){
    for(let i=0;i<Math.min(3, cfg.maxAlive-liveCount); i++) spawnOne(BUS);
  }
}

function tick(dt, BUS){
  if(!running) return;
  lastBUS = BUS || lastBUS;

  // เติมตามเวลา
  spawnAcc += dt;
  const need = Math.floor(spawnAcc / cfg.spawnEvery);
  if(need>0){
    spawnAcc -= need * cfg.spawnEvery;
    for(let i=0;i<need;i++) spawnOne(BUS);
  }

  // อายุหมด → นับ miss เฉพาะ good/gold
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if(it.t >= it.life){
      it.dead=true; alive=Math.max(0, alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{}; }, 160);
      if(it.kind!=='junk'){ (lastBUS||BUS)?.miss?.({source:it}); }
      items.splice(i,1);
    }
  }

  // กันเงียบ
  ensureSome(BUS);
}

// ===== Public API =====
export function start({ difficulty='Normal', bus=null } = {}){
  ensureHost();
  running=true; items=[]; alive=0; spawnAcc=0; lastBUS = bus; lastSpawnMs = now();

  cfg = PRESET[difficulty] || PRESET.Normal;

  try{
    host.style.pointerEvents='auto';
    document.querySelectorAll('canvas').forEach(c=>{ c.style.pointerEvents='none'; c.style.zIndex='1'; });
  }catch{}

  // เติมของตั้งต้นทันที 3 ชิ้น (ใช้ bus ถ้ามี)
  for(let i=0;i<3;i++) spawnOne(bus);

  // Watchdog: ถ้า 1.2s แล้วไม่มีอะไร → สั่งเกิดอีกชุด
  clearInterval(watchdogId);
  watchdogId = setInterval(()=>{ if(running) ensureSome(lastBUS); }, 600);
}

export function update(dt, BUS){
  if(!(dt>0)||dt>1.5) dt=0.016;
  tick(dt, BUS);
}

export function stop(){ running=false; }

export function cleanup(){
  running=false; try{ if(host) host.innerHTML=''; }catch{};
  items=[]; alive=0; clearInterval(watchdogId); watchdogId=null;
}