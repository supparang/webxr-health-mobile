// === Good vs Junk (DOM-spawn, 3D FX, remove-on-click/expiry, quest feed) ===
import FX from '../core/fx.js';
import { Quests } from '../core/quests.js';

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍨','🧂','🥓','🧈'];

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function pickMeta({ life=1800 }={}){
  const r=Math.random();
  if (r<0.68) return { id:'good', char: GOOD[(Math.random()*GOOD.length)|0], good:true,  life };
  if (r<0.96) return { id:'junk', char: JUNK[(Math.random()*JUNK.length)|0], good:false, life };
  return { id:'gold', char:'⭐', good:true, golden:true, life: Math.min(2600, life+500) };
}

export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');
  const state = { running:false, items:[], stats:{good:0,perfect:0,bad:0,miss:0} };

  function start(){
    stop();
    state.running=true; state.items.length=0;
    coach?.onStart?.();
  }
  function stop(){
    state.running=false;
    try{ for(const it of state.items) it.el.remove(); }catch{}
    state.items.length=0;
  }

  function update(dt, Bus){
    if(!state.running || !layer) return;
    const now = performance.now();
    const rect = layer.getBoundingClientRect();

    if(!state._spawnCd) state._spawnCd = 0.14;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.12 : 0;
    state._spawnCd -= dt;

    if (state._spawnCd<=0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.34 - bias + Math.random()*0.22, 0.20, 0.9);
    }

    // lifetime expiry
    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.life){
        if (it.meta.good) { Bus?.miss?.({ meta:it.meta }); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const pad=30;
    const w = Math.max(2*pad+1, (host?.clientWidth||rect.width||0));
    const h = Math.max(2*pad+1, (host?.clientHeight||rect.height||0));
    const x = Math.round(pad + Math.random()*(w-2*pad));
    const y = Math.round(pad + Math.random()*(h-2*pad));

    const meta = pickMeta({});
    const b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.left = x+'px';
    b.style.top  = y+'px';
    b.textContent = meta.char;
    if (meta.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';

    (host||layer).appendChild(b);
    FX.add3DTilt(b);
    state.items.push({ el:b, born: performance.now(), life: meta.life, meta });

    b.addEventListener('click', (ev)=>{
      if(!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      let kind='ok';
      if (meta.good){
        kind = meta.golden ? 'perfect' : 'good';
        const pts = (kind==='perfect') ? 18 : 10;
        engine?.fx?.popText?.(`+${pts}${kind==='perfect'?' ✨':''}`, { x:ui.x, y:ui.y, ms:720 });
        FX.shatter3D(ui.x, ui.y);
        state.stats[kind]++; Bus?.hit?.({ kind, points: pts, ui, meta: { ...meta, good:true } });
        coach?.onGood?.();
      } else {
        kind='bad';
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      // Quests feed
      Quests.event('hit', { result:kind, comboNow: (engine?.score?.combo|0), meta:{ good: meta.good, golden:meta.golden } });

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, cleanup };
}
