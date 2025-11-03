// === Hero Health Academy — game/modes/goodjunk.js (DOM-spawn, low-density, quest-aware) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = แตะได้คะแนนพิเศษ

let host, items = [], alive = 0;
let cfg, spawnAcc = 0, running = false;

// ค่าเกิดน้อยลงชัดเจน (ตามที่ขอ)
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
  else if (r > 0.58) kind = 'junk';// ~28%
  // ที่เหลือ ~58% = good

  const emoji = kind==='gold' ? pick(GOLD)
               : kind==='junk' ? pick(JUNK) : pick(GOOD);

  // สุ่มตำแหน่ง: ไม่ชิดขอบ
  const pad = 70;
  const ww = window.innerWidth, hh = window.innerHeight;
  const x = clamp(Math.random()*ww, pad, ww-pad);
  const y = clamp(Math.random()*hh, pad+20, hh-pad-80); // เลี่ยงทับ HUD ล่าง

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
    // เอฟเฟ็กต์แตก
    try { el.style.transform = 'translate(-50%,-50%) scale(0.82)'; } catch{}
    setTimeout(()=>{ try{ el.style.opacity='0'; }catch{}; }, 25);
    setTimeout(()=>{ try{ el.remove(); }catch{}; }, 180);

    // แจ้ง BUS
    if (kind==='junk'){
      BUS.bad?.({ source: obj, ui:{x, y} });
      BUS.sfx?.bad?.();
    } else {
      const base = (kind==='gold') ? 50 : 10;
      const mult = (kind==='gold') ? 2 : 1;
      BUS.hit?.({ points: base, kind: 'good', ui:{x,y}, meta:{ golden: kind==='gold', mult } });
      if (kind==='gold') BUS.sfx?.power?.(); else BUS.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

// ลูปอัปเดต (ถูกเรียกจาก main.update)
function tick(dt, BUS){
  if (!running) return;

  // สปอว์น
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
      // นับ miss เฉพาะของดี/ทอง (ถ้าไม่ทันคลิก)
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
}

export function update(dt, BUS){
  // ป้องกัน dt หลุดเป็น NaN/Infinity
  if (!(dt>0) || dt>1.5) dt = 0.016;
  tick(dt, BUS);
}

export function stop(){
  running = false;
}

export function cleanup(){
  running = false;
  try {
    items.forEach(it=>{ try{ it.el.remove(); }catch{}; });
  } catch {}
  items = [];
  alive = 0;
}
