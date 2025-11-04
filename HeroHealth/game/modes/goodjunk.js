// === Hero Health Academy — game/modes/goodjunk.js
// Dense spawn • Golden soft-cooldown • Robust DOM spawn • Quest-aware
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐']; // golden = เติม fever + คะแนนพิเศษ

// ---- runtime ----
let host, items = [], alive = 0;
let cfg, spawnAcc = 0, running = false;
let _goldCooldown = 0; // วินาที — กันสุ่มทองถี่เกิน
let _lastEnsure = 0;

// “หนา” ขึ้นเล็กน้อย + อายุเหมาะมือ
const PRESET = {
  Easy:   { spawnEvery: 1.00, maxAlive: 6,  life: 4.0, size: 76 },
  Normal: { spawnEvery: 0.90, maxAlive: 7,  life: 3.6, size: 64 },
  Hard:   { spawnEvery: 0.80, maxAlive: 8,  life: 3.2, size: 54 },
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

/* ---------- หา “ช่องว่าง” สำหรับเกิดของ ---------- */
function findFreeSpot(size){
  const pad = Math.max(70, size * 1.3);
  const ww = window.innerWidth, hh = window.innerHeight;
  const minDist = size * 1.4;

  for (let attempt=0; attempt<12; attempt++){
    const x = clamp(Math.random()*ww, pad, ww-pad);
    const y = clamp(Math.random()*hh, pad+20, hh-pad-80);
    let ok = true;
    for (const it of items){
      if (it.dead) continue;
      const dx = x - it.x, dy = y - it.y;
      if (Math.hypot(dx,dy) < minDist){ ok = false; break; }
    }
    if (ok) return {x,y};
  }
  // ถ้าแน่นจริง ๆ ก็สุ่มธรรมดา
  return { 
    x: clamp(Math.random()*ww, pad, ww-pad), 
    y: clamp(Math.random()*hh, pad+20, hh-pad-80)
  };
}

/* ---------- เอฟเฟกต์แตก ---------- */
function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .45s ease;z-index:9000;pointer-events:none;`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{
    p.style.transform='translate(-50%,-50%) scale(1.85)';
    p.style.opacity='0';
    p.style.filter='drop-shadow(0 0 20px rgba(255,255,255,.35))';
  });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 460);
}

/* ---------- สร้าง 1 ชิ้น ---------- */
function spawnOne(BUS){
  if (alive >= cfg.maxAlive) return;

  // เลือกชนิด — golden แบบ soft cooldown (อย่างน้อย ~10s ลองปล่อยทีหนึ่ง)
  let kind = 'good';
  const r = Math.random();
  if ((_goldCooldown <= 0 && Math.random() < 0.60) || r > 0.84){
    kind = 'gold'; _goldCooldown = 10;         // รีเฟรชคูลดาวน์
  } else if (r > 0.56){
    kind = 'junk';
  }

  const emoji = (kind==='gold') ? pick(GOLD) : (kind==='junk' ? pick(JUNK) : pick(GOOD));
  const pos = findFreeSpot(cfg.size);
  const x = pos.x, y = pos.y;
  const s = cfg.size;

  const glow = (kind==='gold') ? '0 0 26px rgba(255,205,80,.85)'
             : (kind==='good') ? '0 0 16px rgba(80,200,255,.35)'
             : '0 0 16px rgba(255,120,120,.28)';

  const el = document.createElement('div');
  el.className = 'gj-it';
  el.textContent = emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(.86);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow});
    transition: transform .12s ease, opacity .28s ease;
    will-change: transform, opacity;
  `;

  const life = cfg.life * (0.92 + Math.random()*0.24);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  // ปรากฏตัวนุ่ม ๆ
  requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-50%) scale(1)'; });

  // คลิก
  el.addEventListener('pointerdown',(ev)=>{
    if (obj.dead) return;
    obj.dead=true;
    alive=Math.max(0,alive-1);

    el.style.transform='translate(-50%,-50%) scale(0.82)';
    setTimeout(()=>{ el.style.opacity='0'; }, 40);
    setTimeout(()=>{ try{el.remove();}catch{}; }, 180);
    boomEffect(x,y,emoji);

    const ui={x:ev.clientX,y:ev.clientY};
    if(kind==='junk'){
      BUS?.bad && BUS.bad({source:obj,ui});
      BUS?.sfx?.bad && BUS.sfx.bad();
    } else {
      const isGold=(kind==='gold');
      const base=isGold?50:10;
      BUS?.hit && BUS.hit({points:base,kind:isGold?'perfect':'good',ui,meta:{golden:isGold}});
      if(isGold) BUS?.sfx?.power && BUS.sfx.power(); else BUS?.sfx?.good && BUS.sfx.good();
    }
  },{passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

/* ---------- ลูปอัปเดต ---------- */
function tick(dt,BUS){
  if(!running) return;

  // คูลดาวน์ golden
  _goldCooldown = Math.max(0, _goldCooldown - dt);

  // เกิดของตามเวลา
  spawnAcc += dt;
  const need = Math.floor(spawnAcc / cfg.spawnEvery);
  if (need > 0){
    spawnAcc -= need * cfg.spawnEvery;
    for(let i=0;i<need;i++) spawnOne(BUS);
  }

  // อายุชิ้น
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if(it.t >= it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{it.el.remove();}catch{}; }, 160);
      if(it.kind!=='junk') BUS?.miss && BUS.miss({source:it});
      items.splice(i,1);
    }
  }

  // กันค้าง: ทุก ๆ 1.5s ถ้าไม่มีของเลย ให้ปั่นขึ้น 2–3 ชิ้น
  _lastEnsure += dt;
  if (_lastEnsure >= 1.5){
    _lastEnsure = 0;
    if (alive === 0){
      const n = 2 + (Math.random()<0.5?1:0);
      for(let i=0;i<n;i++) spawnOne(BUS);
    }
  }
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  running=true;
  items=[]; alive=0; spawnAcc=0; _goldCooldown=0; _lastEnsure=0;
  cfg = PRESET[difficulty] || PRESET.Normal;

  try{
    host.style.pointerEvents='auto';
    document.querySelectorAll('canvas').forEach(c=>{
      c.style.pointerEvents='none'; c.style.zIndex='1';
    });
  }catch{}

  // บูตด้วยของตั้งต้น 3 ชิ้น
  for(let i=0;i<3;i++) spawnOne({hit:()=>{},bad:()=>{},sfx:{}});
}

export function update(dt,BUS){
  if(!(dt>0)||dt>1.5) dt=0.016;
  tick(dt,BUS);
}

export function stop(){ running=false; }

export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0;
}
