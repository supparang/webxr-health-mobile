// === modes/goodjunk.js — HUD-v2 ready (MISS=GOOD-timeout only; junk=penalty; fever hooks) ===
export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield'];

let host=null, alive=false, diff='Normal';
let iconSizeBase=58, spawnIntervalS=0.70, lifeS=1.65, _accum=0;
let fever=false, allowMiss=0;

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true;
  diff = String(cfg.difficulty||'Normal');
  if (diff==='Easy'){   spawnIntervalS=0.82; lifeS=1.95; iconSizeBase=70; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.35; iconSizeBase=50; }
  else {                 spawnIntervalS=0.70; lifeS=1.65; iconSizeBase=60; }
  _accum=0;
}
export function stop(){ alive=false; clearHost(); }
export function setFever(on){ fever=!!on; }
export function grantShield(n=1){ allowMiss += (n|0); }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(host); }
}
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

function reportMiss(bus, meta){
  if (consumeShield()){ bus?.sfx?.power?.(); return; }
  bus?.miss?.(meta||{}); bus?.sfx?.bad?.();
}
function reportPenalty(bus, meta){ // junk click = not MISS
  bus?.penalty?.(meta||{}); // main จะตัด combo / นับ fever-break
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;
  const size = isGolden ? (iconSizeBase+10) : iconSizeBase;
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', cursor:'pointer',
    fontSize:size+'px', transform:'translate(-50%,-50%)', filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad+Math.random()*(W-pad*2));
  const y=Math.floor(pad+Math.random()*(H-pad*2-140));
  d.style.left=x+'px'; d.style.top=y+'px';

  // timeout → MISS เฉพาะ good เท่านั้น
  const lifeMs=Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto=setTimeout(()=>{ try{ d.remove(); }catch{} if(isGood){ reportMiss(bus,{type:'timeout'}); } }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{ d.remove(); }catch{};
    // เล็กน้อย: effect แตกกระจาย
    explodeAt(x,y);

    if(isGood){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect ? 200 : 100;
      const mult    = fever ? 1.5 : 1.0;
      const pts     = Math.round(basePts*mult);
      const kind    = isGolden ? 'gold' : (perfect?'perfect':'good');
      bus?.hit?.({ kind, points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{good:true,golden:!!isGolden,perfect,feverActive:!!fever} });
      if (isGolden) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    }else{
      // junk click = penalty (ไม่ใช่ MISS)
      reportPenalty(bus,{type:'junk'});
    }
  },{passive:true});

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', cursor:'pointer',
    fontSize:iconSizeBase+'px', transform:'translate(-50%,-50%)', filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x=Math.floor(pad+Math.random()*(W-pad*2));
  const y=Math.floor(pad+Math.random()*(H-pad*2-140));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{ d.remove(); }catch{} }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{ d.remove(); }catch{}
    if(kind==='shield'){ grantShield(1); bus?.power?.('shield'); bus?.sfx?.power?.(); }
    else{
      const pts = Math.round(150*(fever?1.5:1.0));
      bus?.hit?.({ kind:'gold', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{good:true,golden:true,fromPower:true,feverActive:!!fever} });
      bus?.sfx?.perfect?.();
    }
  },{passive:true});
  host.appendChild(d);
}

export function update(dt,bus){
  if(!alive) return;
  _accum += dt;
  while(_accum >= spawnIntervalS){
    _accum -= spawnIntervalS;
    const r=Math.random();
    if(r<0.10){ spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus); }
    else{
      const isGolden = Math.random()<0.12;
      const isGood   = isGolden || (Math.random()<0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div'); p.textContent='✦';
    Object.assign(p.style,{ position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff', textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out', opacity:'1', zIndex:1200, pointerEvents:'none' });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} },720);
  }
}

// compatibility for main.create()
export function create(){ return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus), cleanup:()=>stop() }; }
