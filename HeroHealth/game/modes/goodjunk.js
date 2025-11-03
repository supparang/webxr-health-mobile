// === /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// v3.5 "Super-Calm" — ช้ามาก/น้อยมาก เล่นทันแน่
// - CAP: Desktop 3 / Mobile 2
// - Spawn ~1.35s (±7%) ทีละ 1 ชิ้น (ไม่มี wave)
// - อายุชิ้น ~3.0s (ยาวขึ้นมาก)
// - Golden 5% / Power 3% (ต่ำมาก)
// - Adaptive throttle: พลาด/กด Junk ล่าสุด → spawn ช้าลงช่วงสั้นๆ
// - MISS นับเฉพาะของดีหมดอายุ

export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚','🍆','🥝','🍍','🍐'];
const JUNK  = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🌭','🍰','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

let host=null, alive=false, fever=false, diff='Normal';
let allowMiss=0;

// ---- Base tuning (Super-Calm) ----
let iconSizeBase=50;
let lifeBaseS   =3.0;
let spawnBaseS  =1.35;
let jitter      =0.07;
let firstDelayS =1.10;

// ---- Runtime ----
let _bus=null;
let _nextSpawnS=0;
let _activeCount=0;
const _pos=new Map();
let _adaptSlowS=0; // ช้าลงชั่วคราวเมื่อพลาด/กด junk

const _isMobile = ()=> (matchMedia?.('(pointer:coarse)').matches || innerWidth<900);
const _cap = ()=> (_isMobile()?2:3);

export function start(cfg={}){
  ensureHost(); clearHost();
  alive=true; _bus=null; _pos.clear(); _activeCount=0; _adaptSlowS=0;
  fever=!!cfg.fever; diff=String(cfg.difficulty||'Normal');

  if(diff==='Easy'){   spawnBaseS=1.45; lifeBaseS=3.2; iconSizeBase=54; }
  else if(diff==='Hard'){ spawnBaseS=1.25; lifeBaseS=2.8; iconSizeBase=48; }
  else { spawnBaseS=1.35; lifeBaseS=3.0; iconSizeBase=50; }

  allowMiss=0;
  _nextSpawnS=firstDelayS;

  // Prefill 1 ชิ้นแบบนุ่มๆ
  spawnRandom(_bus);
}

export function update(dt,bus){
  if(!alive) return;
  _bus=bus||_bus;

  // นับเวลาช้าชั่วคราว (adaptive)
  if(_adaptSlowS>0) _adaptSlowS=Math.max(0,_adaptSlowS-dt);

  _nextSpawnS-=dt;
  if(_nextSpawnS<=0){
    if(_activeCount<_cap()){
      spawnRandom(bus);
    }
    // ถ้ากำลังอยู่ในช่วงช้าลง → เพิ่มฐานเวลาอีกเล็กน้อย
    const adaptMul = _adaptSlowS>0 ? 1.25 : 1.0;
    _nextSpawnS = jittered(spawnBaseS*adaptMul, jitter);
  }
}

export function stop(){ alive=false; try{ host&&(host.innerHTML=''); }catch{} _activeCount=0; _pos.clear(); }
export function cleanup(){ stop(); }
export function setFever(on){ fever=!!on; }
export function restart(){ stop(); start({difficulty:diff,fever}); }

// ---------- Internals ----------
function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
}
function clearHost(){ try{host&&(host.innerHTML='');}catch{} }
function jittered(base,j=0.07){ const f=1+(Math.random()*2*j-j); return Math.max(0.12,base*f); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function consumeShield(){ if(allowMiss>0){ allowMiss--; return true;} return false; }
function onMissGood(bus){
  if(consumeShield()){ bus?.power?.('shield'); return; }
  bus?.miss?.({source:'good-timeout'});
  // ชะลอการเกิดชั่วคราว 1.6s หลังพลาด เพื่อหายใจทัน
  _adaptSlowS = Math.max(_adaptSlowS, 1.6);
}

function spawnRandom(bus){
  const r=Math.random();
  // Power โผล่เบามาก และไม่ออกถ้าใกล้เต็ม
  const nearFull = (_activeCount>=_cap()-1);
  if(r<0.03 && !nearFull){ spawnPower(pick(POWERS),bus); return; }

  const isGolden=(Math.random()<0.05); // Golden 5%
  const isGood=isGolden || (Math.random()<0.66);
  const glyph=isGolden?'🌟':(isGood?pick(GOOD):pick(JUNK));
  spawnOne(glyph,isGood,isGolden,bus);
}

function spawnOne(glyph,isGood,isGolden,bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size=isGolden?(iconSizeBase+6):iconSizeBase;
  const {x,y}=placeNonOverlap();
  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.92)',
    border:0,background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:5500,opacity:'0',transition:'transform .18s, opacity .35s'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs=Math.floor((lifeBaseS+(isGolden?0.25:0))*1000*(0.94+Math.random()*0.12));
  const kill=setTimeout(()=>{ fadeRemove(d); if(isGood) onMissGood(bus); },lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    fadeRemove(d);
    if(isGood){
      const perfect=isGolden||Math.random()<0.20;
      const pts=Math.round((perfect?200:100)*(fever?1.5:1));
      bus?.hit?.({kind:(perfect?'perfect':'good'),points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{golden:isGolden}});
      if(perfect) bus?.sfx?.perfect(); else bus?.sfx?.good();
    }else{
      bus?.bad?.(); bus?.sfx?.bad?.();
      // กด Junk → ช้าลงช่วงสั้นๆ 1.2s
      _adaptSlowS = Math.max(_adaptSlowS, 1.2);
    }
  },{passive:true});
}

function spawnPower(kind,bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');
  const {x,y}=placeNonOverlap();
  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.92)',
    border:0,background:'transparent',cursor:'pointer',
    fontSize:(iconSizeBase+8)+'px',filter:'drop-shadow(0 8px 18px rgba(0,180,255,.55))',
    zIndex:5550,opacity:'0',transition:'transform .18s, opacity .35s'
  });
  host.appendChild(d); _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs=Math.floor((lifeBaseS+0.35)*1000*(0.94+Math.random()*0.12));
  const kill=setTimeout(()=>fadeRemove(d),lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    fadeRemove(d);
    if(kind==='shield'){ allowMiss++; bus?.power?.('shield'); }
    else{
      const pts=Math.round(150*(fever?1.5:1));
      bus?.hit?.({kind:'perfect',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{power:kind}});
    }
    bus?.sfx?.power?.();
  },{passive:true});
}

function fadeRemove(d){
  try{
    d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.92)';
    setTimeout(()=>{ try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); },200);
  }catch{}
}

function placeNonOverlap(){
  const pad=80, topPad=108, bottomPad=190; // เว้นเยอะขึ้น
  const minD=130, tries=28;                // ระยะห่างมากขึ้น
  for(let i=0;i<tries;i++){
    const x=Math.floor(pad+Math.random()*(innerWidth-pad*2));
    const y=Math.floor(topPad+Math.random()*(innerHeight-(topPad+bottomPad)));
    let ok=true;
    for(const {x:ox,y:oy} of _pos.values()){ const dx=x-ox,dy=y-oy; if(dx*dx+dy*dy<minD*minD){ ok=false; break; } }
    if(ok) return {x,y};
  }
  return {x:Math.random()*innerWidth, y:Math.random()*(innerHeight-bottomPad-topPad)+topPad};
}

export function create(){
  return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus),
           cleanup:()=>stop(), setFever:(on)=>setFever(on), restart:()=>restart() };
}
