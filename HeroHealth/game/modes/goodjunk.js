// === modes/goodjunk.js — continuous spawn (cap+non-overlap+dyn-diff) ===
export const name = 'goodjunk';

const G = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'];
const B = ['🍔','🍟','🍕','🍩','🍫','🥤'];

let host, alive=false, fever=false;
let t=0, elapsed=0, _intervalCurrent=0.75;

// perf: cap & pool
const BASE_MAX = 14;
const MAX_ACTIVE = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 8 : BASE_MAX;
const pool = [];
function getBtn(){ return pool.pop() || document.createElement('button'); }
function releaseBtn(el){ try{ el.remove(); }catch{} el.onclick=null; pool.push(el); }
function activeCount(){ return (host?.children.length)|0; }

function randX(){ return 56 + Math.random()*(innerWidth-112); }
function randY(){ return 90 + Math.random()*(innerHeight-240); }
function placeNonOverlap(el, tries=10){
  for(let i=0;i<tries;i++){
    const x=randX(), y=randY();
    let ok=true;
    for(const other of host.children){
      const dx=(other._x||0)-x, dy=(other._y||0)-y;
      if(dx*dx+dy*dy < 100*100){ ok=false; break; }
    }
    if(ok){ el.style.left=x+'px'; el.style.top=y+'px'; el._x=x; el._y=y; return; }
  }
  const x=randX(), y=randY(); el.style.left=x+'px'; el.style.top=y+'px'; el._x=x; el._y=y;
}

function spawn(bus){
  if(activeCount() >= MAX_ACTIVE) return;
  const isGood = Math.random()<0.72;
  const isGolden = Math.random()<0.12;
  const glyph = isGolden ? '🌟' : (isGood ? G[Math.random()*G.length|0] : B[Math.random()*B.length|0]);

  const d = getBtn();
  d.textContent=glyph; d.type='button';
  Object.assign(d.style,{
    position:'fixed', transform:'translate(-50%,-50%)',
    font:`900 ${isGolden?64:54}px ui-rounded`,
    border:0, background:'transparent',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    cursor:'pointer', zIndex:5500, willChange:'transform, opacity'
  });
  placeNonOverlap(d, 10);

  // dyn-diff
  const accel = Math.min(0.45, elapsed*0.010);
  const interval = Math.max(0.38, 0.75 - accel);
  const lifeBase = Math.max(1.1, 2.0 - elapsed*0.006);
  const life = lifeBase + (isGolden?0.30:0);
  _intervalCurrent = interval;

  const kill = setTimeout(()=>{
    releaseBtn(d);
    if(isGood) bus?.miss?.({source:'good-timeout'});
  }, (life*1000)|0);

  d.onclick = (ev)=>{
    clearTimeout(kill);
    releaseBtn(d);
    if(isGood){
      const perfect = isGolden || Math.random()<0.20;
      const pts = Math.round((perfect?200:100) * (fever?1.5:1));
      bus?.hit?.({kind:perfect?'perfect':'good', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{good:1, golden:isGolden?1:0}});
    }else{
      bus?.bad?.({source:'junk-click'});
    }
  };

  host.appendChild(d);
}

export function setFever(on){ fever=!!on; }

export function start({ time=45, difficulty='Normal' }={}){
  host = document.getElementById('spawnHost') || document.body;
  alive=true; t=0; elapsed=0;
  // prefill
  for(let i=0;i<3;i++) spawn({ hit(){}, miss(){}, bad(){} });
}

export function update(dt, bus){
  if(!alive) return;
  elapsed += dt; t += dt;
  const interval = Math.max(0.36, _intervalCurrent || 0.75);
  while(t >= interval){ t -= interval; spawn(bus); }
}

export function cleanup(){
  alive=false;
  try{ if(host) host.innerHTML=''; }catch{}
}
