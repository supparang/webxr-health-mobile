// === modes/goodjunk.js (robust spawn; always exports update) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let host=null, alive=false, rate=0.7, age=0, life=1.6, diff='Normal';

const FONT_BY_DIFF = { Easy:64, Normal:56, Hard:48 };

export function init(state={}, hud={}, opts={ time:45 }){ start({ difficulty: state?.difficulty || 'Normal' }); }
export function create(){ return { start:(opt)=>start(opt||{}), update, cleanup:stop }; }

export function start(cfg={}){
  host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
  host.innerHTML='';
  alive=true; age=0;
  diff = String(cfg?.difficulty || document.body.getAttribute('data-diff') || 'Normal');

  if (diff==='Easy'){ rate=0.80; life=1.9; }
  else if (diff==='Hard'){ rate=0.56; life=1.4; }
  else { rate=0.70; life=1.6; }
}

export function cleanup(){ stop(); }
export function stop(){ alive=false; try{ host && (host.innerHTML=''); }catch{} }

function spawnOne(glyph, isGood, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.dataset.good = isGood ? '1':'0';
  d.textContent=glyph;

  const fpx = (FONT_BY_DIFF[diff] ?? 56) | 0;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize: fpx+'px',
    filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))',
    transform:'translate(-50%,-50%)', cursor:'pointer'
  });

  const pad=50, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left = x+'px'; d.style.top = y+'px';

  const killto = setTimeout(()=>{ try{ d.remove(); }catch{} bus?.miss?.(); }, Math.floor(life*1000));

  d.addEventListener('click', (ev)=>{
    clearTimeout(killto); try{ d.remove(); }catch{}
    const perfect = Math.random()<0.22;
    const pts = isGood ? (perfect?200:100) : 0;
    if (isGood) { bus?.hit?.({ kind:(perfect?'perfect':'good'), points:pts, ui:{x:ev.clientX, y:ev.clientY} }); }
    else { bus?.miss?.(); }
  }, { passive:true });

  host.appendChild(d);
}

export function update(dt, bus){
  if(!alive) return;
  age += dt;
  if (age >= rate){
    age -= rate;
    const isGood = Math.random() < 0.72;
    const glyph  = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
    spawnOne(glyph, isGood, bus);
  }
}
