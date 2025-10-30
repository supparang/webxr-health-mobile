// === modes/goodjunk.js (DOM spawn, anti-repeat, golden, life/expire)
export const name = 'goodjunk';
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭','🥓','🧈','🧂','🍨','🍦','🍗','🧃','🥧'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function pickMeta(diff={}){
  const r = Math.random();
  const life = clamp(Number(diff.life)>0?Number(diff.life): 2000, 700, 4500);
  if (r<0.70) return { char: GOOD[(Math.random()*GOOD.length)|0], good:true, aria:'Good', life };
  if (r<0.92) return { char: JUNK[(Math.random()*JUNK.length)|0], good:false, aria:'Junk', life };
  return { char:'⭐', good:true, golden:true, aria:'Golden', life };
}

export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');
  const state = { running:false, items:[], lastKind:null, stats:{good:0,perfect:0,bad:0,miss:0} };

  function start(){ stop(); state.running=true; state.items.length=0; coach?.onStart?.(); }
  function stop(){ state.running=false; try{ for(const it of state.items) it.el.remove(); }catch{} state.items.length=0; }

  function update(dt, Bus){
    if(!state.running || !layer) return;
    const now = performance.now();
    const rect = layer.getBoundingClientRect();
    if (!state._spawnCd) state._spawnCd = 0.16;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.14 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.38 - bias + Math.random()*0.22, 0.24, 0.9);
    }

    const gone=[];
    for(const it of state.items){
      if (now - it.born > it.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{ reason:'expire'} }); state.stats.miss++; }
        try{ it.el.remove(); }catch{} gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1800 });
    const pad=30;
    const x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));

    const b = document.createElement('button');
    b.className='spawn-emoji'; b.type='button';
    b.style.left = x+'px'; b.style.top  = y+'px';
    b.textContent = meta.char; b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), life: meta.life, meta });

    b.addEventListener('click', (ev)=>{
      if(!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };
      if (meta.good){
        const kind = meta.golden ? 'perfect' : 'good';
        state.stats[kind]++; Bus?.hit?.({ kind, points:(kind==='perfect'?20:10), ui, meta:{...meta,isGood:true} });
        try{ (window?.HHA_FX?.shatter3D||(()=>{}))(ui.x, ui.y); }catch{}
      }else{
        state.stats.bad++; Bus?.miss?.({ meta });
      }
      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  return { start, stop, update, cleanup:stop };
}
