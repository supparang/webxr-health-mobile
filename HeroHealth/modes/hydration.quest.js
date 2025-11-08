// === hydration.quest.js — Hydration (stub/playable) ===
export async function boot(cfg = {}) {
  const host = cfg.host || document.getElementById('spawnHost') || document.body;
  const dur  = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  const layer = document.createElement('div'); layer.className='hha-layer';
  Object.assign(layer.style,{position:'fixed',inset:0,zIndex:650}); document.body.appendChild(layer);

  const WATER = '💧', DRINKS = ['🥤','🧋','🍹','🍺','🥛']; // นับเฉพาะ 💧 เป็นน้ำ
  let left = dur, running=true, spawnTimer=null, timeTimer=null;
  let goal = 12, drinked=0, junk=0;

  function vw(){return Math.max(320,innerWidth||320)}; function vh(){return Math.max(320,innerHeight||320)};
  function rndPos(){ return {x: Math.floor(vw()*0.25+Math.random()*vw()*0.5), y: Math.floor(vh()*0.30+Math.random()*vh()*0.46)} }
  function HUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Hydration: จิบน้ำ ${drinked}/${goal}`}})); }

  function spawn(){
    if(!running) return;
    const isWater = Math.random()<0.6;
    const ch = isWater?WATER: DRINKS[(Math.random()*DRINKS.length)|0];
    const pos=rndPos();
    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch;
    el.style.left=pos.x+'px'; el.style.top=pos.y+'px'; el.style.fontSize='68px';
    el.onclick=()=>{ el.classList.add('hha-hit'); el.remove();
      if(ch===WATER){ drinked++; window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:drinked*8,combo:drinked}})); pulse(pos.x,pos.y,'#60a5fa'); }
      else { junk++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:junk}})); }
      HUD(); if(drinked>=goal) end('win'); else schedule();
    };
    layer.appendChild(el);
    setTimeout(()=>{ if(el.isConnected){ el.remove(); schedule(); } }, 1500);
  }
  function pulse(x,y,color){ const p=document.createElement('div'); p.className='hha-pop'; p.textContent='+น้ำ'; p.style.left=x+'px'; p.style.top=y+'px'; p.style.color=color; layer.appendChild(p); setTimeout(()=>p.remove(),600) }
  function schedule(){ spawnTimer=setTimeout(spawn, 650+Math.random()*450); }

  function end(reason='done'){
    if(!running) return; running=false;
    try{clearTimeout(spawnTimer)}catch{}; try{clearInterval(timeTimer)}catch{};
    Array.from(layer.children).forEach(n=>n.remove()); layer.remove();
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score:drinked*8,combo:drinked,misses:junk,hits:drinked,spawns:drinked+junk,difficulty:diff,questsCleared:reason==='win'?1:0,questsTotal:1}}));
  }

  timeTimer=setInterval(()=>{ left=Math.max(0,left-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); if(left<=0) end('timeout'); },1000);
  HUD(); schedule();
  return { stop:()=>end('quit'), pause(){running=false}, resume(){if(!running){running=true;schedule();}} };
}
export default { boot };
