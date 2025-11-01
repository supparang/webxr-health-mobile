// === /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js ===
// (ต่อยอดจากเวอร์ชัน DOM spawn เดิมของคุณ)
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let host=null, alive=false, spawnT=0, rate=700, life=1600;
function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function on(el,ev,fn){ if(el) el.addEventListener(ev,fn,false); }

export function start(cfg){
  host = document.getElementById('spawnHost');
  if(!host){
    const gl = document.getElementById('gameLayer');
    host = document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:absolute;inset:0';
    (gl||document.body).appendChild(host);
  }
  alive = true; spawnT = 0;
  const d = (cfg && cfg.difficulty) || 'Normal';
  if (d === 'Easy'){ rate=820; life=1900; }
  else if (d === 'Hard'){ rate=560; life=1400; }
  else { rate=700; life=1600; }
}

export function stop(){
  alive = false;
  if(host){ [...host.querySelectorAll('.spawn-emoji')].forEach(n=>n.remove()); }
}

export function pause(){ alive=false; }
export function resume(){ alive=true; }

export function update(dtSec, bus){
  if(!alive) return;
  const dt = (dtSec*1000)|0;
  spawnT += dt;
  if (spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
    const count = (Math.random() < 0.15) ? 2 : 1;
    for(let i=0;i<count;i++){
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.7);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[rng(0,GOOD.length-1)] : JUNK[rng(0,JUNK.length-1)]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

function spawnOne(glyph, isGood, isGolden, bus){
  const d = document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.textContent=glyph;
  d.setAttribute('aria-label', isGood ? 'good item' : 'junk item');
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize: (isGolden? '52px':'40px'),
    filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))'
  });

  const W = host.clientWidth||innerWidth, H = host.clientHeight||innerHeight;
  const pad = 28;
  const x = rng(pad, Math.max(pad, W - 64));
  const y = rng(pad, Math.max(pad, H - 64));
  d.style.left = x+'px'; d.style.top = y+'px';

  // lifetime (miss ถ้าไม่คลิก)
  const lifeMs = rng(life-250, life+250);
  let gone=false;
  const killto = setTimeout(()=>{
    if (!gone && alive){
      gone = true;
      try{ d.remove(); }catch{}
      bus?.miss?.(); // <- นับ miss
    }
  }, lifeMs);

  on(d,'click', (ev)=>{
    if(!alive) return;
    gone = true; clearTimeout(killto);
    try{ d.remove(); }catch{}

    // ชนิด hit
    let kind='good', points=100;
    if (isGolden){ kind='golden'; points=200; }
    else if (Math.random() < 0.22){ kind='perfect'; points=200; }

    // แจ้งไป main + บึ้ม FX
    bus?.hit?.({ kind, points, ui:{ x: ev.clientX, y: ev.clientY } });
  });

  host.appendChild(d);
}
const POWERS = ['x2','freeze','sweep','shield'];
const PGLYPH = { x2:'×2', freeze:'🧊', sweep:'🧲', shield:'🛡️' };

function spawnPower(kind,bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power';
  d.textContent=PGLYPH[kind]||'★';
  d.style.cssText='position:absolute;font-size:42px;border:0;background:none;cursor:pointer;';
  const W=window.innerWidth,H=window.innerHeight;
  const x=Math.random()*(W-100)+50,y=Math.random()*(H-160)+80;
  d.style.left=x+'px';d.style.top=y+'px';
  const life=1800;
  const to=setTimeout(()=>d.remove(),life);
  d.onclick=(ev)=>{
    clearTimeout(to); d.remove();
    bus?.power?.(kind);
    FX.popText(`+${kind.toUpperCase()}`,{x:ev.clientX,y:ev.clientY});
  };
  document.body.appendChild(d);
}
