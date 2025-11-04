// === Hero Health Academy — game/modes/goodjunk.js
// DOM-spawn, reliable clicks, anti-overlap, continuous spawn + Golden Pity ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = fever + คะแนนพิเศษ

let host, items=[], alive=0;
let cfg, spawnAcc=0, running=false;

// ความหนาแน่น (เพิ่มเล็กน้อย) + อายุชิ้นนานพอคลิกได้ + ขนาดต่างตามระดับ
const PRESET = {
  Easy:   { spawnEvery: 1.20, maxAlive: 6, life: 4.2, size: 76 },
  Normal: { spawnEvery: 1.00, maxAlive: 7, life: 3.7, size: 64 },
  Hard:   { spawnEvery: 0.85, maxAlive: 8, life: 3.3, size: 54 },
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
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

// ----- หาตำแหน่งวาง: ลดการทับกัน -----
function findFreeSpot(size){
  const pad = Math.max(70, size*1.3);
  const ww = window.innerWidth, hh = window.innerHeight;
  const minDist = size*1.4;

  for(let attempt=0; attempt<12; attempt++){
    const x = clamp(Math.random()*ww, pad, ww-pad);
    const y = clamp(Math.random()*hh, pad+20, hh-pad-80);
    let ok = true;
    for(const it of items){
      const dx=x-it.x, dy=y-it.y;
      if(Math.hypot(dx,dy) < minDist){ ok=false; break; }
    }
    if(ok) return {x,y};
  }
  return {
    x: clamp(Math.random()*ww, pad, ww-pad),
    y: clamp(Math.random()*hh, pad+20, hh-pad-80)
  };
}

// ----- Golden Pity: ถ้านานเกิน X วิ ไม่มี ⭐ → บังคับใบต่อไปเป็นทอง -----
let sinceLastGolden = 0;
let forceGoldNext = false;
const GOLDEN_PITY_SEC = 7;

// ----- สร้าง 1 ชิ้น -----
function spawnOne(BUS, forceKind=null){
  if (alive >= cfg.maxAlive) return;

  let kind = 'good';
  if (forceKind === 'gold') kind = 'gold';
  else {
    // โอกาสพื้นฐาน (เพิ่มนิดหน่อย)
    const r = Math.random();
    if(r > 0.88) kind='gold';         // ~12%
    else if(r > 0.58) kind='junk';    // ~30%
    else kind='good';                  // ~58%
  }

  // ถ้ามี Pity ค้างอยู่ → บังคับทอง
  if (forceGoldNext){ kind='gold'; forceGoldNext=false; }

  const emoji = (kind==='gold') ? pick(GOLD) : (kind==='junk' ? pick(JUNK) : pick(GOOD));
  const pos = findFreeSpot(cfg.size);
  const x = pos.x, y = pos.y;
  const s = cfg.size;

  const glow = (kind==='gold') ? '0 0 28px rgba(255,205,80,.90)'
             : (kind==='good') ? '0 0 18px rgba(80,200,255,.35)'
                               : '0 0 18px rgba(255,120,120,.28)';

  const el = document.createElement('div');
  el.className = 'gj-it';
  el.textContent = emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow});
    transition: transform .12s ease, opacity .22s ease;
    touch-action: manipulation;
  `;

  const life = cfg.life * (0.92 + Math.random()*0.18);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  const fireHit = (ev)=>{
    // กันอีเวนต์ถูกกลืน
    try{ ev.preventDefault(); ev.stopPropagation(); }catch{}
    if (obj.dead) return;
    obj.dead = true;
    alive = Math.max(0, alive-1);

    // เอฟเฟกต์แตก
    try{ el.style.transform='translate(-50%,-50%) scale(0.82)'; }catch{}
    setTimeout(()=>{ try{ el.style.opacity='0'; }catch{}; }, 20);
    setTimeout(()=>{ try{ el.remove(); }catch{}; }, 160);

    // ตำแหน่ง UI ปลอดภัย
    const ui = {
      x: (ev && (ev.clientX||ev.pageX)) ? (ev.clientX||ev.pageX) : x|0,
      y: (ev && (ev.clientY||ev.pageY)) ? (ev.clientY||ev.pageY) : y|0
    };

    if (kind==='junk'){
      BUS.bad?.({ source: obj, ui });
      BUS.sfx?.bad?.();
    } else {
      const isGold = (kind==='gold');
      const base = isGold ? 50 : 10;
      BUS.hit?.({ points: base, kind: isGold ? 'perfect' : 'good', ui, meta:{ golden:isGold } });
      if (isGold){
        BUS.sfx?.power?.();
        sinceLastGolden = 0;          // รีเซ็ตนับเวลาเมื่อเจอทองจริง
      } else {
        BUS.sfx?.good?.();
      }
    }
  };

  // ใช้ทั้ง pointerdown + click (fallback) และ capture เพื่อเลี่ยง overlay กลืน
  el.addEventListener('pointerdown', fireHit, { capture:true, passive:false });
  el.addEventListener('click',       fireHit, { capture:true, passive:false });

  host.appendChild(el);
  items.push(obj);
  alive++;
}

// ----- วนลูปภายในโหมด -----
function tick(dt, BUS){
  if(!running) return;

  // สะสมเวลาเพื่อสปอว์น
  spawnAcc += dt;
  const need = Math.floor(spawnAcc / cfg.spawnEvery);
  if (need > 0){
    spawnAcc -= need * cfg.spawnEvery;
    for(let i=0;i<need;i++){
      // ถ้าเกินเวลาพัก ⭐ นานไป → บังคับชิ้นนี้เป็นทอง
      if (sinceLastGolden >= GOLDEN_PITY_SEC){
        forceGoldNext = true;
      }
      spawnOne(BUS);
    }
  }

  // นับอายุ + ลบชิ้นที่หมดเวลา
  for(let i=items.length-1;i>=0;i--){
    const it = items[i];
    if (it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if (it.t >= it.life){
      it.dead = true;
      alive = Math.max(0, alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{}; }, 140);
      if (it.kind !== 'junk'){ BUS.miss?.({ source: it }); }
      items.splice(i,1);
    }
  }

  // เดินตัวนับ “ไม่มีทองนานเท่าไร”
  sinceLastGolden += dt;
}

// ========== Public API ==========

export function start({ difficulty='Normal' } = {}){
  ensureHost();
  running = true;
  items.length=0; alive=0; spawnAcc=0;
  sinceLastGolden = 0; forceGoldNext = false;

  cfg = PRESET[difficulty] || PRESET.Normal;

  // ให้เลเยอร์เป้ารับคลิกแน่นอน
  try{
    host.style.pointerEvents = 'auto';
    document.querySelectorAll('canvas').forEach(c=>{
      c.style.pointerEvents='none';
      c.style.zIndex='1';
    });
    // เผื่อมี overlay HUD อื่น ๆ
    const fg = document.getElementById('feverGauge');
    if (fg) fg.style.pointerEvents = 'none';
  }catch{}

  // เติมตั้งต้น 3 ชิ้น
  for(let i=0;i<3;i++) spawnOne({ hit:()=>{}, bad:()=>{}, sfx:{} });
}

export function update(dt, BUS){
  if (!(dt>0) || dt>1.5) dt = 0.016;
  tick(dt, BUS);
}

export function stop(){ running=false; }

export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items.length=0; alive=0;
}
