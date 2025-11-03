// === /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// v3.1 "Lean Flow"
// - Desktop cap = 6, Mobile cap = 4
// - ช้าลงอีก: spawn interval ยาวขึ้น + jitter ลดลง
// - ไม่ปล่อย power ถ้าใกล้ชนเพดาน
// - เหมือนเดิม: ไม่มี prefill, นับ MISS เฉพาะ good timeout, fade-out นุ่ม

export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚','🍆','🥝','🍍','🍐'];
const JUNK  = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🌭','🍰','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

let host=null, alive=false, fever=false, diff='Normal';
let allowMiss=0;

// Tunables (ปรับตาม diff ใน start())
let iconSizeBase=52;
let lifeBaseS=1.45;        // ปรับสั้นลงนิด เพื่อลดการค้างบนจอ
let spawnBaseS=0.95;       // ช้าลง (Normal)
let jitter=0.22;           // ลดการกระเพื่อม ให้คาดเดาง่ายขึ้น
let firstDelayS=0.65;      // เว้นจังหวะหลัง GO

// Runtime
let _bus=null;
let _nextSpawnS=0;
let _activeCount=0;
const _pos=new Map();

// caps ที่ลดลงชัดเจน
const _capDesktop=6;
const _capMobile=4;
const _cap=()=>((matchMedia?.('(pointer:coarse)').matches || innerWidth<900)?_capMobile:_capDesktop);

export function start(cfg={}) {
  ensureHost(); clearHost();
  alive=true; _bus=null; _pos.clear(); _activeCount=0;
  fever=!!cfg.fever; diff=String(cfg.difficulty||'Normal');

  if (diff==='Easy'){   spawnBaseS=1.15; lifeBaseS=1.70; iconSizeBase=58; }
  else if (diff==='Hard'){ spawnBaseS=0.78; lifeBaseS=1.25; iconSizeBase=46; }
  else {                spawnBaseS=0.95; lifeBaseS=1.45; iconSizeBase=52; }

  jitter=0.22;
  allowMiss=0;
  _nextSpawnS=firstDelayS;   // ไม่มี prefill
}

export function update(dt,bus){
  if(!alive) return;
  _bus=bus||_bus;

  _nextSpawnS-=dt;
  if(_nextSpawnS<=0){
    if(_activeCount<_cap()){
      spawnRandom(bus);
      _nextSpawnS=jittered(spawnBaseS, jitter);
    }else{
      _nextSpawnS=0.14; // ตรวจใหม่ช้าลงหน่อย
    }
  }
}

export function stop(){ alive=false; try{ host&&(host.innerHTML=''); }catch{} _activeCount=0; _pos.clear(); }
export function cleanup(){ stop(); }
export function setFever(on){ fever=!!on; }
export function restart(){ stop(); start({ difficulty:diff, fever }); }

// ---------- internals ----------
function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }else{
    host.style.zIndex='5000'; host.style.pointerEvents='auto';
  }
}
function clearHost(){ try{ host&&(host.innerHTML=''); }catch{} }
function jittered(base,j=0.2){ const f=1+(Math.random()*2*j-j); return Math.max(0.06, base*f); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function isOverCap(){ return _activeCount>=_cap(); }

function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }
function onMissGood(bus){ if(consumeShield()){ try{bus?.power?.('shield');}catch{} return; } try{bus?.miss?.({source:'good-timeout'});}catch{} }

function spawnRandom(bus){
  // ถ้าใกล้เต็มแล้ว (เหลือช่อง <=1) งดปล่อย power เพื่อลดการค้าง
  const nearFull = (_activeCount >= _cap()-1);
  const r=Math.random();
  if(r<0.10 && !nearFull){ spawnPower(pick(POWERS), bus); return; }

  const isGolden=Math.random()<0.08;              // ลด golden เล็กน้อย (ลดชิ้นชนกัน)
  const isGood=isGolden || (Math.random()<0.66);  // ลดโอกาสของดีลงเล็กน้อย
  const glyph=isGolden?'🌟':(isGood?pick(GOOD):pick(JUNK));
  spawnOne(glyph, isGood, isGolden, bus);
}

function spawnOne(glyph,isGood,isGolden,bus){
  if(isOverCap()) return;

  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size=isGolden?(iconSizeBase+6):iconSizeBase;
  const {x,y}=placeNonOverlap();

  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:'0',background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:'5500',opacity:'0',transition:'transform .18s ease, opacity .35s ease'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs=Math.floor((lifeBaseS+(isGolden?0.22:0))*1000*(0.92+Math.random()*0.16));
  const kill=setTimeout(()=>{
    try{ d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.92)'; setTimeout(()=>{ try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 200);}catch{}
    if(isGood) onMissGood(bus);
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    try{ d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(1.08)'; setTimeout(()=>{ try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 140);}catch{}
    if(isGood){
      const perfect=isGolden||Math.random()<0.20; // ลด perfect นิดหนึ่ง
      const pts=Math.round((perfect?200:100)*(fever?1.5:1));
      try{
        bus?.hit?.({ kind:(isGolden?'perfect':(perfect?'perfect':'good')), points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{good:1,golden:(isGolden?1:0)} });
        if(perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
      }catch{}
    }else{
      try{ bus?.bad?.({source:'junk-click'}); bus?.sfx?.bad?.(); }catch{}
    }
    window.__notifySpawn?.();
  }, {passive:true});
}

function spawnPower(kind,bus){
  if(isOverCap()) return;

  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');

  const size=iconSizeBase+6;
  const {x,y}=placeNonOverlap();

  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:'0',background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))',
    zIndex:'5550',opacity:'0',transition:'transform .18s ease, opacity .35s ease'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs=Math.floor((lifeBaseS+0.30)*1000*(0.92+Math.random()*0.16));
  const kill=setTimeout(()=>{
    try{ d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.92)'; setTimeout(()=>{ try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 200);}catch{}
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    try{ d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(1.1)'; setTimeout(()=>{ try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 140);}catch{}
    if(kind==='shield'){ allowMiss++; try{ bus?.power?.('shield'); bus?.sfx?.power?.(); }catch{} }
    else{
      const pts=Math.round(150*(fever?1.5:1));
      try{ bus?.hit?.({ kind:'perfect', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{gold:1,power:'gold'} }); bus?.power?.('gold'); bus?.sfx?.power?.(); }catch{}
    }
    window.__notifySpawn?.();
  }, {passive:true});
}

// วางตำแหน่งให้กระจายตัวมากขึ้น
function placeNonOverlap(){
  const pad=60, topPad=90, bottomPad=170;
  const minD=(matchMedia?.('(pointer:coarse)').matches||innerWidth<900)?100:120;
  const tries=26;
  for(let k=0;k<tries;k++){
    const x=Math.floor(pad+Math.random()*(innerWidth-pad*2));
    const y=Math.floor(topPad+Math.random()*(innerHeight-(topPad+bottomPad)));
    let ok=true;
    for(const {x:ox,y:oy} of _pos.values()){
      const dx=x-ox, dy=y-oy; if((dx*dx+dy*dy)<(minD*minD)){ ok=false; break; }
    }
    if(ok) return {x,y};
  }
  // fallback
  const x=Math.floor(pad+Math.random()*(innerWidth-pad*2));
  const y=Math.floor(topPad+Math.random()*(innerHeight-(topPad+bottomPad)));
  return {x,y};
}

export function create(){
  return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus),
           cleanup:()=>stop(), setFever:(on)=>setFever(on), restart:()=>restart() };
}
