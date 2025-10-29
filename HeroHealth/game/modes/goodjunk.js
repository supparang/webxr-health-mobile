// === Hero Health Academy — game/modes/goodjunk.js (DOM-spawn + click-shatter) ===
export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧂','🍜','🧁'];

const CHANCE_GOOD = 0.68;     // สัดส่วนของดี
const LIFE = { Easy:1800, Normal:1450, Hard:1200 };

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function toast(msg){
  let el = document.getElementById('toast');
  if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1000);
}

/* Factory adapter */
export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[],
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    difficulty: (document.body.getAttribute('data-diff')||'Normal'),
    stats:{ good:0, perfect:0, bad:0, miss:0 }
  };

  function start(){
    stop();
    state.running=true; state.items.length=0; state.stats={good:0,perfect:0,bad:0,miss:0};
    coach?.onStart?.();
    toast(state.lang==='TH'?'เก็บของดี เลี่ยงขยะ!':'Collect good, avoid junk!');
  }

  function stop(){
    state.running=false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length=0;
  }

  function update(dt, Bus){
    if(!state.running||!layer) return;
    const now=performance.now(); const rect=layer.getBoundingClientRect();
    if(!state._cd) state._cd=0.16;
    state._cd -= dt;
    const bias = (Number(document.getElementById('time')?.textContent||'0')|0) <= 15 ? 0.12 : 0;
    if(state._cd<=0){
      spawnOne(rect, Bus);
      state._cd = clamp(0.36 - bias + Math.random()*0.22, 0.22, 0.9);
    }

    // life check
    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.life){
        if(it.meta.good){ Bus?.miss?.(); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const isGood = Math.random() < CHANCE_GOOD;
    const life = clamp(LIFE[state.difficulty]||1450, 700, 3000);
    const meta = { good:isGood, junk:!isGood };
    const pad=30;
    const x=Math.round(pad + Math.random()*(Math.max(1,rect.width)-pad*2));
    const y=Math.round(pad + Math.random()*(Math.max(1,rect.height)-pad*2));

    const b=document.createElement('button');
    b.className='spawn-emoji'; b.type='button';
    b.textContent = isGood ? pick(GOOD) : pick(JUNK);
    b.style.left=x+'px'; b.style.top=y+'px';
    b.setAttribute('aria-label', isGood?'Healthy food':'Junk food');
    // 3D pop a bit
    b.style.transform='translate(-50%, -50%) translateZ(8px)';

    b.addEventListener('click',(ev)=>{
      if(!state.running) return; ev.stopPropagation();
      const ui={x:ev.clientX,y:ev.clientY};
      if(isGood){
        const pts=10; Bus?.hit?.({kind:'good',points:pts,ui,meta:{...meta}});
        engine?.fx?.popText?.(`+${pts}`,{x:ui.x,y:ui.y,ms:720});
        engine?.fx?.shatter3D?.(ui.x,ui.y,{shards:26,sparks:10});
        coach?.onGood?.();
      } else {
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),160);
        coach?.onBad?.(); Bus?.miss?.({meta});
      }
      try{ b.remove(); }catch{}
      const idx=state.items.findIndex(it=>it.el===b); if(idx>=0) state.items.splice(idx,1);
    },{passive:false});

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({el:b,born:performance.now(),life,meta});
  }

  function cleanup(){ stop(); }

  return { start, stop, update, cleanup };
}
