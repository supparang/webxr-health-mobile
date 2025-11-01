// === modes/goodjunk.js — DOM-spawn icons + Fever-aware + Star/Shield power ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // ⭐=bonus, 🛡️=ignore next miss

let host=null, alive=false, rate=0.70, life=1.60, diff='Normal';
let fever=false, allowMiss=0;

export function start(cfg={}){
  host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
  host.innerHTML=''; alive=true;
  diff = String(cfg.difficulty||'Normal');
  // speed/size by diff
  if (diff==='Easy'){ rate=0.82; life=1.90; } 
  else if (diff==='Hard'){ rate=0.56; life=1.30; } 
  else { rate=0.70; life=1.60; }
}

export function stop(){ alive=false; try{ host && (host.innerHTML=''); }catch{} }

export function setFever(on){ fever = !!on; }
export function grantShield(n=1){ allowMiss += n|0; }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;
  const base = (diff==='Easy'? 58 : diff==='Hard'? 44 : 50);
  const size = isGolden ? base+10 : base;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))'
  });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x+'px'; d.style.top = y+'px';

  const lifeMs = Math.floor((life + (isGolden?0.25:0))*1000) * (fever?0.9:1);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} onMiss(bus); }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto); explodeAt(x,y); try{ d.remove(); }catch{}
    if (isGood){
      const perfect = Math.random()<0.22 || isGolden;
      const basePts = perfect ? 200 : 100;
      const mult = fever ? 1.5 : 1.0;
      const pts = Math.round(basePts*mult);
      bus?.hit?.({ kind:(isGolden?'perfect':'good'), points:pts, ui:{x:ev.clientX, y:ev.clientY} });
      if (isGolden) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
    } else {
      onMiss(bus);
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', fontSize:'52px',
    transform:'translate(-50%,-50%)', filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))' });
  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((life+0.25)*1000));
  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{}
    if (kind==='shield'){ grantShield(1); bus?.power?.('shield'); }
    else { bus?.hit?.({ kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY} }); }
    bus?.sfx?.power?.();
  }, { passive:true });
  host.appendChild(d);
}

function onMiss(bus){
  if (consumeShield()){ bus?.sfx?.power?.(); return; }
  bus?.miss?.(); bus?.sfx?.bad?.();
}

export function update(dt, bus){
  if(!alive) return;
  // spawn cadence (items per second)
  let cadence = rate * (fever?1.25:1.0);
  // roll spawns
  let rolls = dt / Math.max(0.01, (1/cadence));
  let k = Math.max(1, Math.floor(rolls));
  while(k--){
    const r = Math.random();
    if (r < 0.10){ // 10% power
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood = isGolden || (Math.random() < 0.70);
      const glyph = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// particle burst
function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.textContent='✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff', textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out', opacity:'1', zIndex:1200, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(${s})`; p.style.opacity='0'; });
    setTimeout(()=>{ try{p.remove();}catch{} }, 720);
  }
}
