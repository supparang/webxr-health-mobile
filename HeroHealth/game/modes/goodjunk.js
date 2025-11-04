// === Hero Health Academy — game/modes/goodjunk.js
// (DOM-spawn, low-density, quest-aware, NO internal fever, with explode FX) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = ใช้ HUD fever ภายนอก (ส่ง meta.golden=true ไปให้ main)

// Runtime state
let host, items = [], alive = 0;
let cfg, spawnAcc = 0, running = false;

// ความหนาแน่นต่ำ + อายุชิ้นนานขึ้น + ขนาดแยกตามระดับความยาก
const PRESET = {
  Easy:   { spawnEvery: 1.60, maxAlive: 4,  life: 4.2, size: 76 },
  Normal: { spawnEvery: 1.30, maxAlive: 5,  life: 3.6, size: 64 },
  Hard:   { spawnEvery: 1.05, maxAlive: 6,  life: 3.2, size: 54 },
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

// หาตำแหน่งใหม่ โดยเลี่ยงชนกันมากไป
function findFreeSpot(size){
  const pad = Math.max(70, size * 1.3);
  const ww = window.innerWidth, hh = window.innerHeight;
  const minDist = size * 1.35;

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
  // สำรอง
  return { 
    x: clamp(Math.random()*ww, pad, ww-pad), 
    y: clamp(Math.random()*hh, pad+20, hh-pad-80)
  };
}

// เอฟเฟกต์แตกกระจาย (particles แบบ self-contained)
function explodeAt(x,y,{color='rgba(255,220,120,.95)', pieces=12, spread=38}={}){
  for(let i=0;i<pieces;i++){
    const p=document.createElement('b');
    p.style.cssText=
      `position:fixed;left:${x}px;top:${y}px;width:6px;height:6px;`+
      `background:${color};border-radius:50%;pointer-events:none;z-index:9100;opacity:1;`;
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2;
    const dist= spread*(0.6+Math.random()*0.8);
    const dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist;
    const dur=420+Math.random()*300;
    requestAnimationFrame(()=>{
      p.animate(
        [{ transform:'translate(-3px,-3px)', opacity:1 },
         { transform:`translate(${dx-3}px,${dy-3}px)`, opacity:0 }],
        { duration: dur, easing:'cubic-bezier(.25,.6,.3,1)' }
      ).onfinish=()=>{ try{p.remove();}catch{} };
    });
  }
}

// สร้างไอเท็ม 1 ชิ้น
function spawnOne(BUS){
  if (!running) return;
  if (alive >= cfg.maxAlive) return;

  // เลือกชนิด
  const r = Math.random();
  let kind = 'good';
  if (r > 0.86) kind = 'gold';      // ~14%
  else if (r > 0.58) kind = 'junk'; // ~28%

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

  const life = cfg.life * (0.93 + Math.random()*0.20); // ±7%
  const obj = { el, x, y, t:0, life, kind, dead:false };

  // คลิก/แตะ
  el.addEventListener('pointerdown',(ev)=>{
    if (!running || obj.dead) return;
    obj.dead = true;
    alive = Math.max(0, alive-1);

    // เอฟเฟกต์ยุบ + แตกกระจาย
    try { el.style.transform = 'translate(-50%,-50%) scale(0.82)'; } catch{}
    setTimeout(()=>{ try{ el.style.opacity='0'; }catch{}; }, 25);
    setTimeout(()=>{ try{ el.remove(); }catch{}; }, 180);
    explodeAt(x,y,{ color: (kind==='junk'?'rgba(255,120,120,.95)':'rgba(180,220,255,.95)') });

    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){
      BUS.bad?.({ source: obj, ui });
      BUS.sfx?.bad?.();
    } else {
      const isGold = (kind==='gold');
      const base   = isGold ? 50 : 10;
      BUS.hit?.({ points: base, kind: isGold ? 'perfect' : 'good', ui, meta:{ golden: isGold } });
      if(isGold) BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

// อัปเดตรอบลูป (ถูกเรียกจาก main.update)
function tick(dt, BUS){
  if (!running) return;

  // เกิดของใหม่ตามเวลา
  spawnAcc += dt;
  const need = Math.floor(spawnAcc / cfg.spawnEvery);
  if (need > 0){
    spawnAcc -= need * cfg.spawnEvery;
    for (let i=0; i<need; i++) spawnOne(BUS);
  }

  // อายุและ “พลาด”
  for (let i=items.length-1;i>=0;i--){
    const it = items[i];
    if (it.dead) { items.splice(i,1); continue; }
    it.t += dt;
    if (it.t >= it.life){
      it.dead = true;
      alive = Math.max(0, alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{}; }, 140);
      if (it.kind!=='junk'){ BUS.miss?.({source:it}); }
      items.splice(i,1);
    }
  }
}

/* ========== Public API (called by main.js) ========== */

export function start({ difficulty='Normal' } = {}){
  ensureHost();
  running  = true;
  items    = [];
  alive    = 0;
  spawnAcc = 0;

  // ตั้งค่าตามระดับ
  cfg = PRESET[difficulty] || PRESET.Normal;

  // กันแคนวาสบังคลิก
  try {
    host.style.pointerEvents = 'auto';
    document.querySelectorAll('canvas').forEach(c=>{
      c.style.pointerEvents = 'none';
      c.style.zIndex = '1';
    });
  }catch{}

  // เติมของตั้งต้นเล็กน้อย (ให้ผู้เล่นเห็นทันที)
  for(let i=0;i<3;i++) spawnOne({ hit:()=>{}, bad:()=>{}, sfx:{} });
}

export function update(dt, BUS){
  if (!(dt>0) || dt>1.5) dt = 0.016; // กัน NaN/กระโดดเฟรม
  tick(dt, BUS);
}

export function stop(){ running = false; }

export function cleanup(){
  running = false;
  try { if (host) host.innerHTML = ''; } catch {}
  items = [];
  alive = 0;
}
