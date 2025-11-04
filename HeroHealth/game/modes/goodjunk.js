// === Hero Health Academy — game/modes/goodjunk.js
// (diff-tuned golden + HUD-safe spawn + resize-safe + smoother cadence)

export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const GOLD = ['⭐'];

// ===== Runtime state =====
let host, items=[], alive=0, running=false, spawnAcc=0, cfg, BUSRef=null, rafSync=0;

// ควบคุมความถี่สปอนแบบ adaptive (จะเร่งเล็กน้อยเมื่อเวลาเดิน)
let adapt = { t:0, accel:0, minEvery:0.42, accelPerSec:0.0035 };

// ===== Difficulty presets =====
const PRESET = {
  Easy:   { spawnEvery: 1.50, maxAlive: 6, life: 4.2, size: 72, goldenProb: 0.10 },
  Normal: { spawnEvery: 1.20, maxAlive: 7, life: 3.6, size: 64, goldenProb: 0.14 },
  Hard:   { spawnEvery: 0.95, maxAlive: 8, life: 3.2, size: 58, goldenProb: 0.18 },
};

function pick(a){ return a[(Math.random()*a.length) | 0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}

/* ---------- HUD-safe zones ---------- */
function collectHudRects(){
  const rects=[];
  const push=(el)=>{
    if(!el) return;
    const r = el.getBoundingClientRect();
    if (r.width>0 && r.height>0) rects.push(r);
  };
  push(document.querySelector('#hud'));          // รวม top bars
  push(document.querySelector('#questChips'));
  push(document.querySelector('#powerBarWrap'));
  push(document.querySelector('#feverGauge'));   // ถ้ามี
  push(document.querySelector('#resultModal'));
  return rects;
}
function overlaps(x,y,sz,rects){
  const r = { left:x-sz/2, top:y-sz/2, right:x+sz/2, bottom:y+sz/2 };
  for(const b of rects){
    const hit = !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
    if (hit) return true;
  }
  return false;
}
function findFreeSpot(size){
  const ww = window.innerWidth, hh = window.innerHeight;
  const padX = Math.max(70, size*1.2);
  const padY = Math.max(70, size*1.2);
  const rects = collectHudRects();
  for(let i=0;i<22;i++){
    const x = clamp(Math.random()*ww, padX, ww-padX);
    const y = clamp(Math.random()*hh, padY, hh-padY);
    if(!overlaps(x,y,size+14,rects)) return {x,y};
  }
  // fallback: random ในกรอบปลอดภัย (ยอมชน HUD ถ้ายังหาไม่ได้)
  return {
    x: clamp(Math.random()*ww, padX, ww-padX),
    y: clamp(Math.random()*hh, padY, hh-padY),
  };
}

/* ---------- FX ---------- */
function boomEffect(x,y,emoji){
  const p=document.createElement('div');
  p.textContent=emoji;
  p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(1);
    font-size:42px;opacity:1;transition:all .35s ease;z-index:9000;pointer-events:none`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.transform='translate(-50%,-50%) scale(1.8)'; p.style.opacity='0'; });
  setTimeout(()=>{ try{p.remove();}catch{}; }, 360);
}

function flashRed(){
  const old = document.body.style.backgroundColor;
  document.body.style.transition='background .08s';
  document.body.style.backgroundColor='#3a0f0f';
  setTimeout(()=>{ document.body.style.backgroundColor=old||''; }, 120);
}

/* ---------- Spawn logic ---------- */
function currentSpawnEvery(){
  // ยิ่งเวลาผ่าน interval จะค่อย ๆ สั้นลง แต่ไม่ต่ำกว่า minEvery
  return Math.max(adapt.minEvery, cfg.spawnEvery - adapt.accel);
}

function decideKind(){
  // golden ตาม diff โดยตรง
  const r = Math.random();
  if (r < (cfg.goldenProb||0.12)) return 'gold';
  // junk ~35% หลังจากหัก golden
  if (r < (cfg.goldenProb||0.12) + 0.35) return 'junk';
  return 'good';
}

function spawnOne(){
  if (!running || alive >= cfg.maxAlive) return;

  const kind  = decideKind();
  const emoji = (kind==='gold' ? pick(GOLD) : kind==='junk' ? pick(JUNK) : pick(GOOD));

  const s = cfg.size;
  const pos = findFreeSpot(s);
  const x=pos.x, y=pos.y;

  const glow = (kind==='gold') ? '0 0 28px rgba(255,205,80,.85)'
             : (kind==='good') ? '0 0 18px rgba(80,200,255,.35)'
             : '0 0 18px rgba(255,120,120,.25)';

  const el = document.createElement('div');
  el.className='gj-it';
  el.textContent=emoji;
  el.style.cssText = `
    position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%) scale(1);
    width:${s}px; height:${s}px; display:flex; align-items:center; justify-content:center;
    font-size:${s-6}px; user-select:none; cursor:pointer; pointer-events:auto;
    filter:drop-shadow(${glow}); transition: transform .12s ease, opacity .24s ease;`;
  const life = cfg.life * (0.92 + Math.random()*0.22);
  const obj = { el, x, y, t:0, life, kind, dead:false };

  el.addEventListener('pointerdown', (ev)=>{
    if (!running || obj.dead) return;
    obj.dead = true;
    alive = Math.max(0, alive-1);
    el.style.transform='translate(-50%,-50%) scale(0.84)';
    setTimeout(()=>{ el.style.opacity='0'; }, 30);
    setTimeout(()=>{ try{el.remove();}catch{} }, 160);
    const uiX = ev.clientX || x, uiY = ev.clientY || y;
    boomEffect(uiX, uiY, emoji);

    const ui = {x:uiX, y:uiY};
    if (kind==='junk'){
      BUSRef?.bad?.({source:obj,ui});
      BUSRef?.sfx?.bad?.();
      flashRed();
    }else{
      const isGold = (kind==='gold');
      const pts = isGold ? 150 : 100;
      BUSRef?.hit?.({points:pts, kind:isGold?'perfect':'good', ui, meta:{golden:isGold}});
      if (isGold) BUSRef?.sfx?.power?.(); else BUSRef?.sfx?.good?.();
    }
  }, {passive:true});

  host.appendChild(el);
  items.push(obj);
  alive++;
}

function tick(dt){
  if(!running) return;

  // ป้องกัน dt แปลก ๆ
  if (!(dt>0) || dt>1.2) dt = 0.016;

  // เร่งสปอนช้า ๆ เมื่อเวลาเดิน
  adapt.t += dt;
  adapt.accel = Math.min(0.75, adapt.accel + adapt.accelPerSec * dt); // เพดานเร่ง

  spawnAcc += dt;
  const every = currentSpawnEvery();

  // ปรับ cadence ให้เนียนขึ้นด้วยการกึ่งล็อก rAF (สร้างอย่างน้อย 1 ต่อช่วง)
  while (spawnAcc >= every) {
    spawnAcc -= every;
    spawnOne();
  }

  // อายุของชิ้น
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];
    if(it.dead){ items.splice(i,1); continue; }
    it.t += dt;
    if (it.t >= it.life){
      it.dead=true; alive=Math.max(0,alive-1);
      try{ it.el.style.opacity='0'; }catch{}
      setTimeout(()=>{ try{ it.el.remove(); }catch{} }, 140);
      // นับ miss เฉพาะ GOOD/GOLD เท่านั้น
      if (it.kind!=='junk') BUSRef?.miss?.({source:it});
      items.splice(i,1);
    }
  }
}

/* ---------- Public API ---------- */
export function start({difficulty='Normal'}={}){
  ensureHost();
  // เคลียร์ของเก่าให้หมดก่อน
  try{ host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0; rafSync=0;
  cfg = PRESET[difficulty] || PRESET.Normal;
  adapt = { t:0, accel:0, minEvery:0.42, accelPerSec:0.0035 };
  running = true;

  // canvases ไม่บังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });

  // เริ่มของตั้งต้น (ให้จอไม่โล่ง)
  for(let i=0;i<Math.min(4, cfg.maxAlive); i++) spawnOne();

  // ผูก resize/orientation ให้จัดวางใหม่
  window.removeEventListener('resize', onViewportChange);
  window.addEventListener('resize', onViewportChange, {passive:true});
  window.removeEventListener('orientationchange', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange, {passive:true});
}

export function update(dt,bus){
  BUSRef = bus || BUSRef;
  tick(dt);
}

export function stop(){
  running=false;
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('orientationchange', onViewportChange);
}

export function cleanup(){
  running=false;
  try{ if(host) host.innerHTML=''; }catch{}
  items=[]; alive=0; spawnAcc=0;
}

export function onViewportChange(){
  // บีบให้อยู่ในจอ และหลบ HUD เพิ่มเติม
  const rects = collectHudRects();
  for(const it of items){
    const s = cfg?.size || 64;
    it.x = clamp(it.x, s, window.innerWidth - s);
    it.y = clamp(it.y, s, window.innerHeight - s);
    if (overlaps(it.x,it.y,s+14,rects)){
      const pos = findFreeSpot(s);
      it.x = pos.x; it.y = pos.y;
    }
    if (it.el){
      it.el.style.left = it.x + 'px';
      it.el.style.top  = it.y + 'px';
    }
  }
}
