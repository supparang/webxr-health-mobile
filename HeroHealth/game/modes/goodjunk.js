// === modes/goodjunk.js (DOM-spawn version; uses Engine FX via Bus.ui coords; imports fx for optional tilt)
import { add3DTilt } from '../core/fx.js';

export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍨','🍿','🥓'];

export function create({ engine, hud, coach }){
  const host = document.getElementById('spawnHost');
  const W = host.clientWidth, H = host.clientHeight;

  let t=0, spawnAcc=0, ended=false;

  function spawnOne(){
    if (!host || ended) return;
    const isGood = Math.random() < 0.65;
    const ch = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
    const el = document.createElement('button');
    el.className='spawn-emoji';
    el.textContent = ch;
    const x = 40 + Math.random()*(W-80);
    const y = 60 + Math.random()*(H-120);
    el.style.left = x+'px'; el.style.top = y+'px';
    host.appendChild(el);

    try{ add3DTilt(el); }catch{}

    const life = 1200 + Math.random()*800;
    const killAt = setTimeout(()=>{ try{ el.remove(); }catch{} }, life);

    el.addEventListener('click', (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      const rect = el.getBoundingClientRect();
      const ui = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      if (isGood){
        coach?.say?.('ดีมาก!');
        window.HHA?.bus?.hit?.({ kind:'good', ui, meta:{ good:true } });
      } else {
        coach?.say?.('ระวังของหวาน!');
        window.HHA?.bus?.miss?.({ meta:{ junk:true } });
      }
      try{ el.remove(); }catch{}
      clearTimeout(killAt);
    }, { capture:true });
  }

  // expose a small bus for main to call (optional)
  window.HHA = window.HHA || {};
  window.HHA.bus = window.HHA.bus || {};

  return {
    start(){ coach?.say?.('Ready?'); },
    update(dt, Bus){ if (ended) return; t += dt; spawnAcc += dt;
      if (spawnAcc >= 0.35){ spawnAcc = 0; spawnOne(); } window.HHA.bus = Bus; },
    stop(){ ended=true; try{ host.innerHTML=''; }catch{}; }
  };
}
