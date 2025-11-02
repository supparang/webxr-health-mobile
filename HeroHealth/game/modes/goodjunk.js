// === modes/goodjunk.js (PRODUCTION) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // ⭐=+150 perfect, 🛡️=ignore next miss

let host=null, alive=false, fever=false, allowMiss=0, diff='Normal';
let iconSizeBase=48, spawnIntervalS=0.70, lifeS=1.60, _accum=0;
const MAX_CHILD = 80; // cap anti-leak

export function setFever(on){ fever=!!on; }
export function grantShield(n=1){ allowMiss += n|0; }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('div');
    host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5';
    document.body.appendChild(host);
  }
}
function trimChildrenCap(){
  const nodes = host?.querySelectorAll('.spawn-emoji');
  if(nodes && nodes.length>MAX_CHILD){
    const over = nodes.length - MAX_CHILD;
    for(let i=0;i<over;i++){ try{ nodes[i].remove(); }catch{} }
  }
}
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true;
  diff=String(cfg.difficulty||'Normal');
  if(diff==='Easy'){ spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=54; }
  else if(diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=40; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=48; }
  _accum=0; allowMiss=0;
}
export function stop(){ alive=false; clearHost(); }

function onMiss(bus, why){
  if(consumeShield()){ bus?.sfx?.power?.(); return; }
  bus?.miss?.({kind:why||'timeout'});
  bus?.sfx?.bad?.();
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent',
    fontSize:(iconSizeBase)+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))', cursor:'pointer' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad+Math.random()*(W-pad*2)), y=Math.floor(pad+Math.random()*(H-pad*2-140));
  d.style.left=x+'px'; d.style.top=y+'px';
  const to=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click',(ev)=>{ clearTimeout(to); try{d.remove();}catch{};
    if(kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else{ bus?.hit?.({kind:'perfect',points:150,ui:{x:ev.clientX,y:ev.clientY},meta:{gold:true}}); }
  },{passive:true});
  host.appendChild(d); trimChildrenCap();
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;
  const size=isGolden?(iconSizeBase+8):iconSizeBase;
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)', filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))', cursor:'pointer' });

  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad+Math.random()*(W-pad*2)), y=Math.floor(pad+Math.random()*(H-pad*2-140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const lifeMs=Math.floor((lifeS+(isGolden?0.25:0))*1000);
  const killto=setTimeout(()=>{ try{d.remove();}catch{}; if(isGood||isGolden) onMiss(bus,'good_timeout'); }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{};
    if(isGood||isGolden){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect?200:100;
      const mult = fever?1.5:1.0;
      const pts = Math.round(basePts*mult);
      bus?.hit?.({ kind:(isGolden?'perfect':(perfect?'perfect':'good')),
                   points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{ gold:!!isGolden } });
      if(perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    }else{
      onMiss(bus,'junk_click');
    }
  },{passive:true});

  host.appendChild(d); trimChildrenCap();
}

export function update(dt, bus){
  if(!alive) return;
  _accum += dt;
  while(_accum>=spawnIntervalS){
    _accum -= spawnIntervalS;
    const r=Math.random();
    if(r<0.10) spawnPower(POWERS[(Math.random()*POWERS.length)|0],bus); // 10%
    else{
      const isGolden = Math.random()<0.12;
      const isGood   = isGolden || (Math.random()<0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph,isGood,isGolden,bus);
    }
  }
}

// Optional API compatibility
export function create(){ return { start:(c)=>start(c), update:(dt,b)=>update(dt,b), cleanup:()=>stop(), setFever:(on)=>setFever(on) }; }
