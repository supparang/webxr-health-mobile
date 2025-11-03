// === Hero Health Academy — game/modes/goodjunk.js (DOM-spawn, low-density, quest-aware, tuned) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = คะแนนพิเศษ

let host, items = [], alive = 0;
let cfg, spawnAcc = 0, running = false;

// ความหนาแน่นต่ำ + อายุชิ้นนานขึ้น
const PRESET = {
  Easy:   { spawnEvery: 1.30, maxAlive: 6,  life: 3.6, size: 60 },
  Normal: { spawnEvery: 1.10, maxAlive: 7,  life: 3.3, size: 62 },
  Hard:   { spawnEvery: 0.95, maxAlive: 8,  life: 3.0, size: 64 },
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

// สร้าง 1 ชิ้น
function spawnOne(BUS){
  if (alive >= cfg.maxAlive) return;

  // สุ่มชนิด (ลด junk ให้เกมไหลลื่น)
  const r = Math.random();
  let kind = 'good';
  if (r > 0.86) kind = 'gold';     // ~14%
  else if (r > 0.58) kind = 'junk';// ~28% ; ที่เหลือ ~58% = good

  const emoji = kind==='gold' ? pick(GOLD)
               : kind==='junk' ? pick(JUNK) : pick(GOOD);

  // สุ่มตำแหน่ง: ไม่ชิดขอบ + เลี่ยง HUD ล่าง
  const pad = 70;
  const ww = window.innerWidth, hh = window.innerHeight;
  const x = clamp(Math.random()*ww, pad, ww-pad);
  const y = clamp(Math.random()*hh, pad+20, hh-pad-80);

  const el = document.createElement('div');
  const s = cfg.size;
  const glow = (kind==='gold') ? '0 0 26px rgba(255,205,80,.85)'
             : (kind==='good') ? '0 0 18px rgba(80,200,255,.28)'
                                : '0 0 18px rgba(255,120,120,.25)';
  el.className = 'gj-it';
  el.textContent = emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow});
    transition: transform .12s ease, opacity .28s ease;
  `;

  const life = cfg.life * (0.9 + Math.random()*0.3); // +/-10–15%
  const obj = { el, x, y, t:0, life, kind, dead:false };

  // คลิก
  el.addEventListener('pointerdown', (ev)=>{
    if (obj.dead) return;
    obj.dead = true;
    alive = Math.max(0, alive-1);

    // เอฟเฟกต์ "แตก"
    try { el.style.transform = 'translate(-50%,-50%) scale(0.82)'; } catch{}
    setTimeout(()=>{ try{ el.style.opacity='0'; }catch{}; }, 25);
    setTimeout(()=>{ try{ el.remove(); }catch{}; }, 180);

    // แจ้ง BUS + เอฟเฟกต์เสียง
    const ui = { x: ev.clientX, y: ev.clientY };
    if (kind==='junk'){
      BUS.bad?.({ source: obj, ui });
      BUS.sfx?.bad?.();
    } else {
      const isGold = (kind==='gold');
      const base = isGold ? 50 : 10;
      BUS.hit?.({ points: base, kind: isGold ? 'perfect' : 'good', ui, meta:{ golden: isGold } });
      if (isGold) BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

// อัปเดตรอบลูป (ถูกเรียกจาก main.update)
function tick(dt, BUS){
  if (!running) return;

  // สร้างของใหม่ตามเวลา
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
      setTimeout(()=>{ try{ it.el.remove(); }catch{}; }, 160);
      // นับ miss เฉพาะของดี/ทอง
      if (it.kind!=='junk'){ BUS.miss?.({source:it}); }
      items.splice(i,1);
    }
  }
}

// ========== Public API required by main ==========

export function start({ difficulty='Normal' } = {}){
  ensureHost();
  running = true;
  items = [];
  alive = 0;
  spawnAcc = 0;

  cfg = PRESET[difficulty] || PRESET.Normal;

  // กันกรณีสไตล์อื่นบล็อกคลิก
  try {
    host.style.pointerEvents = 'auto';
    document.querySelectorAll('canvas').forEach(c=>{
      c.style.pointerEvents = 'none';
      c.style.zIndex = '1';
    });
  }catch{}

  // เติมของตั้งต้นทันที 2–3 ชิ้น ให้ไม่โล่ง
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
