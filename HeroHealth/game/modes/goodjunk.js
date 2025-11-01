// === modes/goodjunk.js (3D emoji feel, click → score, miss → bus.miss)
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['x2','freeze','sweep','shield'];
const PGLYPH = { x2:'×2', freeze:'🧊', sweep:'🧲', shield:'🛡️' };

let host=null, alive=false, rate=0.7, age=0, life=1.6, diff='Normal';

export function start(cfg={}){
  host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
  host.innerHTML=''; alive=true; age=0; diff = String(cfg.difficulty||'Normal');
  if (diff==='Easy'){ rate=0.82; life=1.9; } else if (diff==='Hard'){ rate=0.56; life=1.4; } else { rate=0.7; life=1.6; }
}

export function stop(){ alive=false; try{ host && (host.innerHTML=''); }catch{} }

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.dataset.good = isGood ? '1':'0';
  d.textContent=glyph;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent', fontSize:(diff==='Easy'?'44px':(diff==='Hard'?'32px':'38px')),
    filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))', transform:'translate(-50%,-50%)'
  });
  const pad=40, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left = x+'px'; d.style.top = y+'px';

  const lifeMs = Math.floor((life + (isGolden?0.2:0))*1000);
  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} bus?.miss?.(); }, lifeMs);

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto); try{ d.remove(); }catch{}
    if (isGood){
      const perfect = Math.random()<0.22 || isGolden;
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
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', fontSize:'42px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 4px 9px rgba(10,120,160,.55))' });
  const pad=40, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{d.remove();}catch{} }, Math.floor((life+0.2)*1000));
  d.addEventListener('click',(ev)=>{ clearTimeout(killto); try{d.remove();}catch{} bus?.power?.(kind); bus?.hit?.({kind:'good',points:0,ui:{x:ev.clientX,y:ev.clientY}}); }, { passive:true });
  host.appendChild(d);
}

export function update(dt, bus){
  if(!alive) return;
  age += dt;
  // spawn by rate (items per second)
  if (age >= rate){
    age -= rate;
    const roll = Math.random();
    if (roll < 0.12){ // power
      spawnPower(POWERS[(Math.random()*POWERS.length)|0], bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood = isGolden || (Math.random()<0.7);
      const glyph = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}
