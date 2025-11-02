// === modes/goodjunk.js — DOM-spawn icons + fever hooks + gold/shield; miss only good-timeout ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star=+points burst, shield=ignore next miss

let host=null, alive=false, diff='Normal';
let iconSizeBase=48, spawnIntervalS=0.70, lifeS=1.60, _accum=0;
let fever=false, allowMiss=0;

export function start(cfg={}){
  ensureHost(); clearHost(); alive=true; _accum=0; allowMiss=0; fever=false;
  diff = String(cfg.difficulty||'Normal');
  if (diff==='Easy'){ spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=58; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=44; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=50; }
}
export function stop(){ alive=false; clearHost(); }
export function setFever(on){ fever=!!on; }
export function grantShield(n=1){ allowMiss += n|0; }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host=document.getElementById('spawnHost');
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(host); }
}
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button'); d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;
  const size = (isGolden? (iconSizeBase+10) : iconSizeBase);
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)', filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))', cursor:'pointer' });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';

  const lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto = setTimeout(()=>{
    try{ d.remove(); }catch{}
    // MISS เฉพาะของดีเท่านั้น
    if(isGood){ if(consumeShield()){ bus?.sfx?.power?.(); } else { bus?.miss?.({kind:'timeout_good'}); } }
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); explodeAt(x,y); try{ d.remove(); }catch{}
    if (isGood){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect ? 200 : 100;
      const mult = fever ? 1.5 : 1.0;
      const pts = Math.round(basePts*mult);
      bus?.hit?.({ kind:(isGolden?'gold':(perfect?'perfect':'good')), points:pts, ui:{x:ev.clientX, y:ev.clientY} });
      if(isGolden) bus?.sfx?.perfect?.(); else if(perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    } else {
      // junk click: ไม่ใช่ MISS แต่ตัดคอมโบ + นับ quest หลบ junk ให้ถูก
      bus?.junk?.({ ui:{x:ev.clientX,y:ev.clientY} });
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button'); d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', fontSize:(iconSizeBase)+'px',
    transform:'translate(-50%,-50%)', filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))', cursor:'pointer' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((lifeS+0.25)*1000));
  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{}
    if (kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else { bus?.hit?.({ kind:'gold', points:150, ui:{x:ev.clientX,y:ev.clientY} }); }
  }, { passive:true });
  host.appendChild(d);
}

export function update(dt, bus){
  if(!alive) return;
  _accum += dt;
  while(_accum >= spawnIntervalS){
    _accum -= spawnIntervalS;
    const r = Math.random();
    if (r < 0.10) spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    else {
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// simple particle burst
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
    setTimeout(()=>{ try{p.remove();}catch{} }, 720);
  }
}

// compatibility for main that uses create()
export function create(){ return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus), cleanup:()=>stop() }; }
