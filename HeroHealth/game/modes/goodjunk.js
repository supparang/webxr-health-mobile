// === Hero Health Academy — /game/modes/goodjunk.js (2025-11-03 DENSITY-SAFE v2) ===
// จุดเด่นเวอร์ชันนี้:
// • สปอน "ทีละชิ้น" ต่อเฟรมเท่านั้น (ไม่ while)
// • Dynamic CAP ตามขนาดจอ + soft cap throttle แรง
// • อายุไอคอนสั้นลง, junk สั้นกว่า good → จอโปร่ง
// • prefill เพียง 1 ชิ้น
// • stop() เคลียร์จอทันทีแบบ fade-out
// • เข้ากับ BUS ของ main.js เดิม

export const name = 'goodjunk';

const GOOD   = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚'];
const JUNK   = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🍗','🥓','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

// ---- Density policy (dynamic) ----------------------------------------------
function dynCap(){
  // คำนวณเพดานตามพื้นที่จอ: 8–16 ชิ้น
  const area = Math.max(320*480, innerWidth*innerHeight);
  const base = Math.floor(area / 220000) + 6;   // 1920x1080 → ~15
  return Math.max(8, Math.min(16, base));
}
function softCap(){ return Math.max(6, dynCap() - 4); }

let host = null, alive = false, fever = false;
let allowMiss = 0, diff = 'Normal';

let iconSizeBase = 52;
let lifeGoodS = 1.35;     // good อยู่สั้นลง
let lifeJunkS = 1.05;     // junk อยู่แป๊บเดียว เพื่อลดรก
let spawnIntervalS = 0.90;
let _accum = 0;

let _bus = {
  hit(){}, miss(){}, bad(){}, power(){},
  sfx:{ good(){}, bad(){}, perfect(){}, power(){} }
};

// ============================================================================
// Public API
// ============================================================================
export function start(cfg = {}){
  ensureHost();
  clearHost();
  alive = true;
  fever = !!cfg.fever;
  allowMiss = 0;
  diff = String(cfg.difficulty || 'Normal');

  // ปรับตามความยาก (โดยรวม "ช้าลง" จากเดิม)
  if (diff === 'Easy'){  spawnIntervalS = 1.10; iconSizeBase = 58; }
  else if (diff === 'Hard'){ spawnIntervalS = 0.70; iconSizeBase = 46; }
  else { spawnIntervalS = 0.90; iconSizeBase = 52; }

  _accum = 0;

  // Prefill แค่ 1 ชิ้น
  const isGolden = Math.random() < 0.08;
  const isGood   = isGolden || (Math.random() < 0.72);
  const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
  spawnOne(glyph, isGood, isGolden, _bus);
}

export function update(dt, bus){
  if (!alive) return;
  _bus = bus || _bus;

  const live = liveCount();
  const cap  = dynCap();
  const soft = softCap();

  // เกิน CAP → ไม่สปอนเพิ่ม
  if (live >= cap) return;

  // soft throttle: ยิ่งใกล้เพดาน ยิ่งหน่วงหนัก
  let interval = spawnIntervalS;
  if (live >= soft){
    const over = Math.max(0, live - soft);
    interval *= (1 + over * 0.45);    // หน่วงแรงขึ้น
  }

  _accum += dt;
  if (_accum < interval) return;      // สปอน "ทีละชิ้น"
  _accum = 0;

  // ใกล้ CAP แล้ว → งด power ชั่วคราว (กันล้น)
  const allowPower = live <= (cap - 2);

  const r = Math.random();
  if (allowPower && r < 0.08){
    spawnPower(pick(POWERS), _bus);
    return;
  }

  const isGolden = Math.random() < 0.10;
  const isGood   = isGolden || (Math.random() < 0.70);
  const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
  spawnOne(glyph, isGood, isGolden, _bus);
}

export function stop(){
  alive = false;
  if (host){
    const kids = Array.from(host.children);
    for (const el of kids){
      try{
        el.style.transition = 'opacity .22s ease';
        el.style.opacity = '0';
        el.disabled = true;
        setTimeout(()=>{ try{ el.remove(); }catch{}; }, 240);
      }catch{}
    }
  }
}
export function cleanup(){ stop(); }
export function setFever(on){ fever = !!on; }
export function restart(){ stop(); start({ difficulty: diff, fever }); }

// ============================================================================
// Internals
// ============================================================================
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

  // โซนสุ่ม: กันขอบ + กัน HUD
  const pad=56, topPad=84, bottomPad=160;
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

  // อายุ: junk สั้นกว่า good เพื่อลดความแน่น
  const life = (isGood ? lifeGoodS : lifeJunkS) + (isGolden?0.20:0);
  const lifeMs = Math.floor(life * 1000);

  const killto = setTimeout(()=>{
    try{ d.remove(); }catch{}
    if (isGood) onMissGood(bus);
  }, lifeMs);

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
    }else{
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

  const lifeMs = Math.floor((lifeGoodS + 0.25) * 1000);
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

function explodeAt(x,y){
  const n = 7 + ((Math.random()*4)|0);
  for (let i=0;i<n;i++){
    const p = document.createElement('div');
    p.textContent = '✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff',
      textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .6s ease-out, opacity .6s ease-out',
      opacity:'1', zIndex:'6000', pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*100-50), dy=(Math.random()*100-50), s=0.6+Math.random()*0.5;
    requestAnimationFrame(()=>{ p.style.transform = `translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{ p.remove(); }catch{}; }, 620);
  }
}

// Legacy bridge
export function create(){
  return {
    start:(cfg)=>start(cfg),
    update:(dt,bus)=>update(dt,bus),
    cleanup:()=>stop(),
    setFever:(on)=>setFever(on),
    restart:()=>restart()
  };
}
