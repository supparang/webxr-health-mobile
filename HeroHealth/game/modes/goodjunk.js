// === modes/goodjunk.js — DOM-spawn mode (difficulty-aware) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['x2','freeze','sweep','shield'];
const PGLYPH = { x2:'×2', freeze:'🧊', sweep:'🧲', shield:'🛡️' };

let host=null, alive=false, rate=0.7, life=1.6, diff='Normal';
let frozenMs = 0;

function applyDiff(d='Normal'){
  diff = String(d);
  if (diff==='Easy'){  rate=0.85; life=1.95; }
  else if (diff==='Hard'){ rate=0.56; life=1.35; }
  else { rate=0.70; life=1.60; }
}

function ensureHost(){
  host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  } else {
    host.style.pointerEvents = 'auto';
    host.style.zIndex = '5';
  }
}

export function start(cfg={}){
  ensureHost();
  host.innerHTML='';
  applyDiff(cfg.difficulty || 'Normal');
  alive = true; frozenMs = 0;
}

export function cleanup(){
  alive = false;
  try{ host && (host.innerHTML=''); }catch{}
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.dataset.good = isGood ? '1':'0';
  d.textContent=glyph;

  const baseSize = (diff==='Easy'?46 : diff==='Hard'?34 : 40);
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize: baseSize+'px',
    filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))',
    transform:'translate(-50%,-50%)', cursor:'pointer'
  });

  const pad=40, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left = x+'px'; d.style.top = y+'px';

  const lifeMs = Math.floor((life + (isGolden?0.25:0))*1000);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} bus?.miss?.(); }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto);
    try{ d.remove(); }catch{}
    if (isGood){
      const perfect = isGolden || Math.random()<0.22;
      const pts = perfect ? 200 : 100;
      bus?.hit?.({ kind:(isGolden?'golden':(perfect?'perfect':'good')), points:pts, ui:{x:ev.clientX, y:ev.clientY} });
    } else {
      bus?.miss?.();
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button'; d.textContent=PGLYPH[kind]||'★';
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', fontSize:'42px',
    transform:'translate(-50%,-50%)', filter:'drop-shadow(0 4px 9px rgba(10,120,160,.55))', cursor:'pointer' });
  const pad=40, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((life+0.2)*1000));
  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{};
    // simple power effects
    if (kind==='freeze'){ frozenMs = Math.max(frozenMs, 1200); }
    bus?.hit?.({kind:'good',points:0,ui:{x:ev.clientX,y:ev.clientY}});
  }, { passive:true });
  host.appendChild(d);
}

let accum = 0;
export function update(dt, bus){
  if(!alive) return;

  if (frozenMs > 0){
    frozenMs -= dt*1000;
    return; // pause spawns while frozen
  }

  accum += dt;
  // spawn by cadence "rate" (seconds per item)
  if (accum >= rate){
    accum -= rate;
    const roll = Math.random();
    if (roll < 0.12){
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood = isGolden || (Math.random() < 0.7);
      const glyph = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}
