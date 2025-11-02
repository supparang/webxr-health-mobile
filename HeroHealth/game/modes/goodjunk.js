// === modes/goodjunk.js — DOM-spawn icons + Fever hooks + Shield/Gold (MISS เฉพาะ good-timeout) ===
export const name = 'goodjunk';

// Pools
const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚'];
const JUNK  = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🍗','🥓','🍿','🧈','🧂'];
const POWERS = ['gold','shield']; // gold = ⭐ แต้ม+นับเควสต์, shield = กัน MISS ของดี 1 ครั้ง

// State
let host = null;
let alive = false;
let fever = false;
let allowMiss = 0;
let diff = 'Normal';

// Tunables (จะถูกปรับตอน start)
let iconSizeBase = 52;
let lifeS = 1.60;          // อายุของไอคอน (วินาที)
let spawnIntervalS = 0.70; // คาบเวลาในการสปอน
let _accum = 0;

// -------------- Public API --------------
export function start(cfg = {}){
  ensureHost();
  clearHost();

  alive = true;
  fever = !!cfg.fever;
  allowMiss = 0;

  diff = String(cfg.difficulty || 'Normal');

  // ปรับตามความยาก
  if (diff === 'Easy'){  spawnIntervalS = 0.82; lifeS = 1.95; iconSizeBase = 58; }
  else if (diff === 'Hard'){ spawnIntervalS = 0.54; lifeS = 1.35; iconSizeBase = 46; }
  else { spawnIntervalS = 0.70; lifeS = 1.60; iconSizeBase = 52; }

  _accum = 0;

  // Prefill 2 ชิ้น เพื่อการันตีว่ามีของขึ้นทันที
  for(let i=0;i<2;i++){
    const isGolden = Math.random() < 0.10;
    const isGood   = isGolden || (Math.random() < 0.72);
    const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
    spawnOne(glyph, isGood, isGolden, _busPlaceholder);
  }
}

export function stop(){
  alive = false;
  clearHost();
}

export function cleanup(){ stop(); }

export function setFever(on){
  fever = !!on;
}

export function grantShield(n = 1){
  allowMiss += (n|0);
}

// main จะเรียก update(dt, bus)
export function update(dt, bus){
  if(!alive) return;
  _busPlaceholder = bus || _busPlaceholder; // เก็บไว้สำหรับ prefill/timeout

  _accum += dt;

  // มีโอกาส 10% เป็น power, ถ้าไม่ใช่ power ก็สุ่ม good/junk (good ~70%)
  while(_accum >= spawnIntervalS){
    _accum -= spawnIntervalS;
    const r = Math.random();
    if (r < 0.10){
      spawnPower(pick(POWERS), bus);
    }else{
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// -------------- Internal helpers --------------
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto;';
    document.body.appendChild(host);
  }else{
    // กันสไตล์ถูก override
    host.style.zIndex = '5000';
    host.style.pointerEvents = 'auto';
  }
}
function clearHost(){ try{ host && (host.innerHTML = ''); }catch{} }

function consumeShield(){
  if (allowMiss > 0){ allowMiss--; return true; }
  return false;
}

function onMissGood(bus){
  if (consumeShield()){ try{ bus && bus.power && bus.power('shield'); }catch{}; return; }
  // MISS เฉพาะของดีหมดเวลา
  try{ bus && bus.miss && bus.miss({ source:'good-timeout' }); }catch{}
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.type = 'button';
  d.textContent = glyph;

  const size = (isGolden ? (iconSizeBase+10) : iconSizeBase);

  // ตำแหน่งแบบกันขอบ + กันทับ HUD บน/ล่างเล็กน้อย
  const pad = 56, topPad = 84, bottomPad = 160;
  const W = innerWidth, H = innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(topPad + Math.random()*(H - (topPad + bottomPad)));

  Object.assign(d.style,{
    position:'absolute',
    left:x+'px', top:y+'px',
    transform:'translate(-50%,-50%)',
    border:'0', background:'transparent', cursor:'pointer',
    fontSize: size+'px',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:'5500'
  });

  // อายุไอคอน
  const lifeMs = Math.floor((lifeS + (isGolden?0.28:0))*1000);

  const killto = setTimeout(()=>{
    try{ d.remove(); }catch{}
    if(isGood) onMissGood(bus);
  }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto);
    try{ d.remove(); }catch{}

    if (isGood){
      const perfect = isGolden || Math.random() < 0.22;
      const basePts = perfect ? 200 : 100;
      const mult    = fever ? 1.5 : 1.0;
      const pts     = Math.round(basePts * mult);

      // pop effect
      explodeAt(x,y);

      try{
        bus && bus.hit && bus.hit({
          kind:(isGolden?'perfect':(perfect?'perfect':'good')),
          points: pts,
          ui: { x:ev.clientX, y:ev.clientY },
          meta: { good:1, golden:(isGolden?1:0) }
        });
        if (perfect) { bus && bus.sfx && bus.sfx.perfect && bus.sfx.perfect(); }
        else { bus && bus.sfx && bus.sfx.good && bus.sfx.good(); }
      }catch{}
    }else{
      // Junk = bad (ไม่นับ MISS)
      try{
        bus && bus.bad && bus.bad({ source:'junk-click' });
        bus && bus.sfx && bus.sfx.bad && bus.sfx.bad();
      }catch{}
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d = document.createElement('button');
  d.className='spawn-emoji power';
  d.type='button';
  d.textContent = (kind==='shield' ? '🛡️' : '⭐');

  // ตำแหน่ง
  const pad = 56, topPad = 84, bottomPad = 160;
  const W = innerWidth, H = innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(topPad + Math.random()*(H - (topPad + bottomPad)));

  Object.assign(d.style,{
    position:'absolute',
    left:x+'px', top:y+'px',
    transform:'translate(-50%,-50%)',
    border:'0', background:'transparent',
    fontSize:(iconSizeBase+6)+'px',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))',
    cursor:'pointer', zIndex:'5550'
  });

  const lifeMs = Math.floor((lifeS + 0.30)*1000);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{}; }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto);
    try{ d.remove(); }catch{}
    if (kind === 'shield'){
      grantShield(1);
      try{
        bus && bus.power && bus.power('shield');
        bus && bus.sfx && bus.sfx.power && bus.sfx.power();
      }catch{}
    } else {
      // gold power: ให้แต้มทันที + นับเควสต์ทอง
      const pts = Math.round(150 * (fever?1.5:1));
      try{
        bus && bus.hit && bus.hit({
          kind:'perfect',
          points: pts,
          ui:{ x:ev.clientX, y:ev.clientY },
          meta:{ gold:1, power:'gold' }
        });
        bus && bus.power && bus.power('gold');
        bus && bus.sfx && bus.sfx.power && bus.sfx.power();
      }catch{}
    }
  }, { passive:true });

  host.appendChild(d);
}

// เอฟเฟกต์แตกกระจายเล็ก ๆ
function explodeAt(x,y){
  const n = 8 + ((Math.random()*5)|0);
  for(let i=0;i<n;i++){
    const p = document.createElement('div');
    p.textContent = '✦';
    Object.assign(p.style,{
      position:'fixed',
      left:x+'px', top:y+'px',
      transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui',
      color:'#a7c8ff',
      textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out',
      opacity:'1',
      zIndex:'6000',
      pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{
      p.style.transform = `translate(${dx}px,${dy}px) scale(${s})`;
      p.style.opacity = '0';
    });
    setTimeout(()=>{ try{ p.remove(); }catch{}; }, 720);
  }
}

// bus เฉพาะกิจสำหรับ prefill เริ่มต้น (ป้องกัน error ถ้า main ยังไม่ส่ง bus ทันที)
let _busPlaceholder = {
  hit(){}, miss(){}, bad(){}, power(){}, sfx:{ good(){}, bad(){}, perfect(){}, power(){} }
};

// -------------- Legacy bridge --------------
export function create(){
  return {
    start: (cfg)=>start(cfg),
    update: (dt,bus)=>update(dt,bus),
    cleanup: ()=>stop(),
    setFever: (on)=>setFever(on)
  };
}
