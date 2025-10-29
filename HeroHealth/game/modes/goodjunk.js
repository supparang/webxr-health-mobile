// === modes/goodjunk.js (DOM-spawn, 3D FX, expiry, scoring hooks)
import { add3DTilt, explodeButton } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

export const name='goodjunk';
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍫','🍭','🧁','🥓','🍜'];

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function pickMeta(){
  const isGood = Math.random()<0.62;
  const char = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  const golden = isGood && Math.random()<0.08;
  const life = clamp(1800 + Math.random()*900, 900, 4500);
  return { char, aria: isGood?'Good food':'Junk food', good:isGood, golden, life };
}

export function create({ engine, hud, coach }){
  const host = document.getElementById('spawnHost');
  const layer= document.getElementById('gameLayer');
  const state={ running:false, items:[], stats:{good:0,perfect:0,bad:0,miss:0} };

  function start(){ stop(); state.running=true; spawnLoopReset(); coach?.onStart?.(); }
  function stop(){ state.running=false; try{ for(const it of state.items) it.el.remove(); }catch{} state.items.length=0; }
  function spawnLoopReset(){ state._spawnCd=0.16; }

  function update(dt, Bus){
    if(!state.running||!layer) return;
    const now=performance.now(); const rect=layer.getBoundingClientRect();
    state._spawnCd -= dt;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15?0.14:0;
    if (state._spawnCd<=0){ spawnOne(rect, Bus); state._spawnCd = clamp(0.38 - bias + Math.random()*0.22, 0.24, 0.9); }

    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.meta.life){
        if(it.meta.good){ Bus?.miss?.(); state.stats.miss++; }
        try{ it.el.remove(); }catch{} gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta();
    const pad=30;
    const w = host?.clientWidth  || rect.width  || 0;
    const h = host?.clientHeight || rect.height || 0;
    const x = Math.round(pad + Math.random()*(Math.max(1,w) - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1,h) - pad*2));

    const b=document.createElement('button');
    b.className='spawn-emoji'; b.type='button'; b.style.left=x+'px'; b.style.top=y+'px';
    b.textContent=meta.char; b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    add3DTilt(b);

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born:performance.now(), meta });

    b.addEventListener('click',(ev)=>{
      if(!state.running) return; ev.stopPropagation();
      const ui={ x:ev.clientX, y:ev.clientY };
      if (meta.good){
        const perfect = !!meta.golden || Math.random()<0.12;
        engine?.fx?.popText?.(`+${perfect?18:10}${perfect?' ✨':''}`, { x:ui.x, y:ui.y, ms:700 });
        Bus?.hit?.({ kind: perfect?'perfect':'good', points: perfect?18:10, ui, meta:{...meta, groupId:null, isGood:true, golden:meta.golden} });
        explodeButton(b, ui.x, ui.y);
      } else {
        explodeButton(b, ui.x, ui.y);
        Bus?.miss?.({ meta });
      }
      const idx=state.items.findIndex(it=>it.el===b); if(idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, cleanup };
}
