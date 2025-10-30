// Minimal but complete DOM-spawn version
export const name = 'goodjunk';
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🧂','🍭','🥠','🧁','🍨','🥓','🍗','🍖'];

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function pickMeta(){
  const r=Math.random();
  if (r<0.7) return { char: GOOD[(Math.random()*GOOD.length)|0], aria:'Good', good:true,  life: 2000+Math.random()*1200 };
  const golden = Math.random()<0.08;
  return { char: JUNK[(Math.random()*JUNK.length)|0], aria:'Junk', good:false, life: 2000+Math.random()*1200, golden };
}

export function create({ engine, hud, coach }){
  const host=document.getElementById('spawnHost');
  const layer=document.getElementById('gameLayer');
  const state={ running:false, items:[] };

  function start(){ stop(); state.running=true; coach?.onStart?.(); }
  function stop(){ state.running=false; try{ state.items.forEach(it=>it.el.remove()); }catch{} state.items.length=0; }

  function update(dt, Bus){
    if (!state.running||!layer) return;
    if (!state._cd) state._cd = 0.18;
    state._cd -= dt;
    if (state._cd <= 0){
      spawnOne(Bus);
      const t = Number(document.getElementById('time')?.textContent||'0')|0;
      const bias = t<=15 ? 0.14 : 0;
      state._cd = clamp(0.40 - bias + Math.random()*0.20, 0.24, .95);
    }
    const now=performance.now(), gone=[];
    for(const it of state.items){
      if (now - it.born > it.meta.life){ if (it.meta.good){ Bus?.miss?.({meta:{reason:'expire'}}); } try{ it.el.remove(); }catch{} gone.push(it); }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(Bus){
    const meta=pickMeta();
    const pad=30, w=host.clientWidth||layer.clientWidth, h=host.clientHeight||layer.clientHeight;
    const x=Math.round(pad + Math.random()*(w-pad*2)), y=Math.round(pad + Math.random()*(h-pad*2));
    const b=document.createElement('button');
    b.className='spawn-emoji'; b.type='button';
    b.style.left=x+'px'; b.style.top=y+'px'; b.textContent=meta.char; b.setAttribute('aria-label', meta.aria);
    if (meta.golden && !meta.good) b.style.filter='grayscale(1) drop-shadow(0 0 10px rgba(255,215,0,.85))';
    host.appendChild(b);
    state.items.push({ el:b, born:performance.now(), meta });
    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui={x:ev.clientX,y:ev.clientY};
      if (meta.good){
        const perfect = Math.random()<0.10;
        const pts = perfect? 18:10;
        engine.fx.popText(`+${pts}${perfect?' ✨':''}`, {x:ui.x,y:ui.y,ms:720});
        Bus?.hit?.({kind: perfect?'perfect':'good', points:pts, ui, meta:{...meta,isGood:true}});
      }else{
        Bus?.miss?.({meta});
      }
      try{ b.remove(); }catch{}; const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, {passive:false});
  }

  return { start, stop, update, cleanup:stop };
}
