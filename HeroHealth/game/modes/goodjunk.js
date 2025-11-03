// === /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// v3.2 "Arcade Flow" — สนุกขึ้น มีของขึ้นต่อเนื่อง แต่ไม่ล้น
// - Desktop cap = 12, Mobile cap = 8
// - spawn เร็วขึ้น (base 0.55s ±20%), life ~2s
// - wave แบบสุ่ม 1–2 ชิ้น
// - MISS เฉพาะ good timeout

export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚','🍆','🥝','🍍','🍐'];
const JUNK  = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🌭','🍰','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

let host=null, alive=false, fever=false, diff='Normal';
let allowMiss=0;

// --- Configurable rates ---
let iconSizeBase=52;
let lifeBaseS=2.0;
let spawnBaseS=0.55;
let jitter=0.2;
let firstDelayS=0.55;

// --- Runtime ---
let _bus=null;
let _nextSpawnS=0;
let _activeCount=0;
const _pos=new Map();
const _cap=()=>((matchMedia?.('(pointer:coarse)').matches||innerWidth<900)?8:12);

export function start(cfg={}){
  ensureHost(); clearHost();
  alive=true; _bus=null; _pos.clear(); _activeCount=0;
  fever=!!cfg.fever; diff=String(cfg.difficulty||'Normal');

  if(diff==='Easy'){   spawnBaseS=0.7; lifeBaseS=2.3; iconSizeBase=60; }
  else if(diff==='Hard'){ spawnBaseS=0.45; lifeBaseS=1.7; iconSizeBase=48; }
  else { spawnBaseS=0.55; lifeBaseS=2.0; iconSizeBase=52; }

  _nextSpawnS=firstDelayS;
  allowMiss=0;
}

export function update(dt,bus){
  if(!alive) return;
  _bus=bus||_bus;

  _nextSpawnS-=dt;
  if(_nextSpawnS<=0){
    const waveCount=(Math.random()<0.3)?2:1;  // 30% ออกทีละสอง
    for(let i=0;i<waveCount;i++){
      if(_activeCount<_cap()) spawnRandom(bus);
    }
    _nextSpawnS=jittered(spawnBaseS,jitter);
  }
}

export function stop(){ alive=false; try{ host&&(host.innerHTML=''); }catch{} _activeCount=0; _pos.clear(); }
export function cleanup(){ stop(); }
export function setFever(on){ fever=!!on; }
export function restart(){ stop(); start({difficulty:diff,fever}); }

// ---------- internals ----------
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
function jittered(base,j=0.2){ const f=1+(Math.random()*2*j-j); return Math.max(0.05,base*f); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function consumeShield(){ if(allowMiss>0){ allowMiss--; return true;} return false; }
function onMissGood(bus){ if(consumeShield()){bus?.power?.('shield');return;} bus?.miss?.({source:'good-timeout'}); }

function spawnRandom(bus){
  const nearFull=(_activeCount>=_cap()-1);
  const r=Math.random();
  if(r<0.1 && !nearFull){ spawnPower(pick(POWERS),bus); return; }

  const isGolden=Math.random()<0.1;
  const isGood=isGolden||(Math.random()<0.7);
  const glyph=isGolden?'🌟':(isGood?pick(GOOD):pick(JUNK));
  spawnOne(glyph,isGood,isGolden,bus);
}

function spawnOne(glyph,isGood,isGolden,bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size=isGolden?(iconSizeBase+8):iconSizeBase;
  const {x,y}=placeNonOverlap();
  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:0,background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:5500,opacity:'0',transition:'transform .18s, opacity .35s'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{d.style.opacity='1';d.style.transform='translate(-50%,-50%) scale(1)';});

  const lifeMs=Math.floor((lifeBaseS+(isGolden?0.3:0))*1000*(0.9+Math.random()*0.2));
  const kill=setTimeout(()=>{
    fadeRemove(d); if(isGood) onMissGood(bus);
  },lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    fadeRemove(d);
    if(isGood){
      const perfect=isGolden||Math.random()<0.25;
      const pts=Math.round((perfect?200:100)*(fever?1.6:1));
      bus?.hit?.({kind:(perfect?'perfect':'good'),points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{golden:isGolden}});
      if(perfect) bus?.sfx?.perfect(); else bus?.sfx?.good();
    }else{ bus?.bad?.(); bus?.sfx?.bad(); }
  },{passive:true});
}

function spawnPower(kind,bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  const {x,y}=placeNonOverlap();
  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:0,background:'transparent',cursor:'pointer',
    fontSize:(iconSizeBase+8)+'px',filter:'drop-shadow(0 8px 18px rgba(0,180,255,.55))',
    zIndex:5550,opacity:'0',transition:'transform .18s, opacity .35s'
  });
  host.appendChild(d); _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{d.style.opacity='1';d.style.transform='translate(-50%,-50%) scale(1)';});

  const lifeMs=Math.floor((lifeBaseS+0.4)*1000*(0.9+Math.random()*0.2));
  const kill=setTimeout(()=>fadeRemove(d),lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    fadeRemove(d);
    if(kind==='shield'){allowMiss++; bus?.power?.('shield');}
    else{const pts=Math.round(150*(fever?1.5:1)); bus?.hit?.({kind:'perfect',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{power:kind}});}
    bus?.sfx?.power();
  },{passive:true});
}

function fadeRemove(d){
  try{
    d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.9)';
    setTimeout(()=>{try{d.remove();}catch{} _pos.delete(d); _activeCount=Math.max(0,_activeCount-1);},200);
  }catch{}
}

function placeNonOverlap(){
  const pad=60, topPad=90, bottomPad=160;
  const minD=95, tries=20;
  for(let i=0;i<tries;i++){
    const x=Math.floor(pad+Math.random()*(innerWidth-pad*2));
    const y=Math.floor(topPad+Math.random()*(innerHeight-(topPad+bottomPad)));
    let ok=true;
    for(const {x:ox,y:oy} of _pos.values()){const dx=x-ox,dy=y-oy;if(dx*dx+dy*dy<minD*minD){ok=false;break;}}
    if(ok) return {x,y};
  }
  return {x:Math.random()*innerWidth,y:Math.random()*innerHeight*0.7+90};
}

export function create(){
  return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus),
           cleanup:()=>stop(), setFever:(on)=>setFever(on), restart:()=>restart() };
}
