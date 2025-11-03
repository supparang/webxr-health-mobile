// === Hero Health Academy — /game/modes/goodjunk.js (2025-11-03 DENSITY-SAFE) ===
// DOM-spawn icons + Fever hooks + Shield/Gold
// • แก้ "จอแน่น" ด้วย MAX_ONSCREEN + soft density
// • stop() เคลียร์ไอคอนแบบ fade-out
// • เข้ากับ main.js/BUS เดิม

export const name = 'goodjunk';

const GOOD   = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚'];
const JUNK   = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🍗','🥓','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

// ----- Density control -----
const MAX_ONSCREEN = 24;   // ไม่ให้เกินจำนวนนี้บนจอ
const SOFT_CAP     = 18;   // เริ่มหน่วงสปอนเมื่อเกินค่านี้

let host = null, alive = false, fever = false;
let allowMiss = 0, diff = 'Normal';

// Tunables (ปรับตอน start)
let iconSizeBase = 52;
let lifeS = 1.60;
let spawnIntervalS = 0.75;
let _accum = 0;

let _busPlaceholder = {
  hit(){}, miss(){}, bad(){}, power(){},
  sfx:{ good(){}, bad(){}, perfect(){}, power(){} }
};

// =============== Public API ===============
export function start(cfg = {}){
  ensureHost();
  clearHost();
  alive = true;
  fever = !!cfg.fever;
  allowMiss = 0;
  diff = String(cfg.difficulty || 'Normal');

  // ปรับตามความยาก + ชะลอการเกิดโดยรวม
  if (diff === 'Easy'){  spawnIntervalS = 1.00; lifeS = 1.40; iconSizeBase = 58; }
  else if (diff === 'Hard'){ spawnIntervalS = 0.55; lifeS = 1.30; iconSizeBase = 46; }
  else { spawnIntervalS = 0.75; lifeS = 1.55; iconSizeBase = 52; }

  _accum = 0;

  // Prefill 2 ชิ้นให้แน่ใจว่ามีของขึ้น
  for(let i=0;i<2;i++){
    const isGolden = Math.random() < 0.10;
    const isGood   = isGolden || (Math.random() < 0.72);
    const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
    spawnOne(glyph, isGood, isGolden, _busPlaceholder);
  }
}

export function update(dt, bus){
  if (!alive) return;
  _busPlaceholder = bus || _busPlaceholder;

  // ถ้าจำนวนบนจอแตะ MAX → ไม่สปอนเพิ่ม
  const live = liveCount();
  if (live >= MAX_ONSCREEN) return;

  // soft density: หน่วงเมื่อเกิน SOFT_CAP
  let interval = spawnIntervalS;
  if (live > SOFT_CAP){
    const over = Math.min(live - SOFT_CAP, MAX_ONSCREEN - SOFT_CAP);
    interval *= (1 + over * 0.12); // หน่วงเพิ่มตามความหนาแน่น
  }

  _accum += dt;
  while (_accum >= interval){
    _accum -= interval;
    // ป้องกัน frame นี้เกิดเกิน limit
    if (liveCount() >= MAX_ONSCREEN) break;

    // 10% เป็น Power
    const r = Math.random();
    if (r < 0.10){
      spawnPower(pick(POWERS), bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

export function stop(){
  alive = false;
  // fade-out ทุกชิ้นเพื่อเคลียร์จออย่างนุ่มนวล
  if (host){
    const nodes = Array.from(host.children);
    for (const el of nodes){
      try{
        el.style.transition = 'opacity .28s ease';
        el.style.opacity = '0';
        el.disabled = true;
        setTimeout(()=>{ try{ el.remove(); }catch{}; }, 300);
      }catch{}
    }
  }
}
export function cleanup(){ stop(); }
export function setFever(on){ fever = !!on; }
export function restart(){ stop(); start({ difficulty: diff, fever }); }

// =============== Internals ===============
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function liveCount(){ return host ? host.querySelectorAll('.spawn-emoji').length : 0; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto;';
    document.body.appendChild(host);
  }else{
    host.style.zIndex = '5000';
    host.style.pointerEvents = 'auto';
  }
}
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

function consumeShield(){ if (allowMiss>0){ allowMiss--; return true; } return false; }

function onMissGood(bus){
  if (consumeShield()){ try{ bus?.power?.('shield'); }catch{}; return; }
  try{ bus?.miss?.({ source:'good-timeout' }); }catch{}
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.type = 'button';
  d.textContent = glyph;

  const size = isGolden ? (iconSizeBase+10) : iconSizeBase;

  // โซนสุ่ม: กันขอบ + กัน HUD (บน/ล่าง)
  const pad = 56, topPad = 84, bottomPad = 160;
  const W = innerWidth, H = innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(topPad + Math.random()*(H - (topPad + bottomPad)));

  Object.assign(d.style,{
    position:'absolute', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
    border:'0', background:'transparent', cursor:'pointer',
    fontSize: size+'px',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:'5500'
  });

  // อายุไอคอน
  const lifeMs = Math.floor((lifeS + (isGolden?0.28:0))*1000);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} if(isGood) onMissGood(bus); }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto);
    try{ d.remove(); }catch{}

    if (isGood){
      const perfect = isGolden || Math.random() < 0.22;
      const pts = Math.round((perfect?200:100) * (fever?1.5:1));
      explodeAt(x,y);
      try{
        bus?.hit?.({
          kind:(isGolden?'perfect':(perfect?'perfect':'good')),
          points:pts,
          ui:{ x:ev.clientX, y:ev.clientY },
          meta:{ good:1, golden:(isGolden?1:0) }
        });
        if (perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
      }catch{}
    } else {
      try{ bus?.bad?.({ source:'junk-click' }); bus?.sfx?.bad?.(); }catch{}
    }
    window.__notifySpawn?.();
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji power';
  d.type = 'button';
  d.textContent = (kind==='shield' ? '🛡️' : '⭐');

  const pad=56, topPad=84, bottomPad=160;
  const x=Math.floor(pad+Math.random()*(innerWidth-pad*2));
  const y=Math.floor(topPad+Math.random()*(innerHeight-(topPad+bottomPad)));

  Object.assign(d.style,{
    position:'absolute', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
    border:'0', background:'transparent', cursor:'pointer',
    fontSize:(iconSizeBase+6)+'px',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))',
    zIndex:'5550'
  });

  const lifeMs = Math.floor((lifeS + 0.30)*1000);
  const kill = setTimeout(()=>{ try{ d.remove(); }catch{}; }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(kill);
    try{ d.remove(); }catch{}
    if (kind==='shield'){
      allowMiss++;
      try{ bus?.power?.('shield'); bus?.sfx?.power?.(); }catch{}
    } else {
      const pts = Math.round(150 * (fever?1.5:1));
      try{
        bus?.hit?.({
          kind:'perfect',
          points:pts,
          ui:{ x:ev.clientX, y:ev.clientY },
          meta:{ gold:1, power:'gold' }
        });
        bus?.power?.('gold'); bus?.sfx?.power?.();
      }catch{}
    }
    window.__notifySpawn?.();
  }, { passive:true });

  host.appendChild(d);
}

// เอฟเฟกต์แตกกระจายเล็ก ๆ
function explodeAt(x,y){
  const n = 8 + ((Math.random()*5)|0);
  for (let i=0;i<n;i++){
    const p = document.createElement('div');
    p.textContent = '✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff',
      textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out',
      opacity:'1', zIndex:'6000', pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{ p.remove(); }catch{}; }, 720);
  }
}

// Legacy bridge (ยังรองรับโค้ชเก่า)
export function create(){
  return {
    start: (cfg)=>start(cfg),
    update: (dt,bus)=>update(dt,bus),
    cleanup: ()=>stop(),
    setFever: (on)=>setFever(on),
    restart: ()=>restart()
  };
}
