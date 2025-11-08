// === plate.quest.js — Healthy Plate (stub/playable) ===
export async function boot(cfg = {}) {
  const dur  = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  const layer = document.createElement('div'); layer.className='hha-layer';
  Object.assign(layer.style,{position:'fixed',inset:0,zIndex:650}); document.body.appendChild(layer);

  // เป้าหมาย: รักษาสัดส่วน 1/2 ผักผลไม้, 1/4 ธัญพืช, 1/4 โปรตีน
  const VEG = ['🥦','🥕','🍅','🍇','🍓','🍎']; const GRAINS=['🍞','🍚','🥖']; const PRO=['🍗','🐟','🥚','🫘'];
  const BAD  = ['🍩','🍪','🍟','🍕'];

  let left=dur, running=true, spawnTimer=null, timeTimer=null;
  let veg=0, grains=0, pro=0, bad=0;

  function vw(){return Math.max(320,innerWidth||320)}; function vh(){return Math.max(320,innerHeight||320)};
  function rndPos(){ return {x: Math.floor(vw()*0.22+Math.random()*vw()*0.56), y: Math.floor(vh()*0.30+Math.random()*vh()*0.48)} }

  function HUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Plate: ผัก/ผลไม้ ${veg} | ธัญพืช ${grains} | โปรตีน ${pro}`}})); }

  function spawn(){
    if(!running) return;
    const r=Math.random();
    let pool = r<.5?VEG : r<.75?GRAINS : r<.95?PRO : BAD;
    const ch = pool[(Math.random()*pool.length)|0];
    const pos=rndPos();
    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch; el.style.left=pos.x+'px'; el.style.top=pos.y+'px'; el.style.fontSize='66px';
    el.onclick=()=>{ el.classList.add('hha-hit'); el.remove();
      if(VEG.includes(ch)) veg++; else if(GRAINS.includes(ch)) grains++; else if(PRO.includes(ch)) pro++; else bad++;
      const score = veg*6 + grains*8 + pro*10 - bad*12;
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo:veg+grains+pro}}));
      HUD(); if(veg>=10 && grains>=6 && pro>=6) end('win'); else schedule();
    };
    layer.appendChild(el);
    setTimeout(()=>{ if(el.isConnected){ el.remove(); schedule(); } }, 1500);
  }
  function schedule(){ spawnTimer=setTimeout(spawn, 650+Math.random()*450); }

  function end(reason='done'){
    if(!running) return; running=false;
    try{clearTimeout(spawnTimer)}catch{}; try{clearInterval(timeTimer)}catch{};
    Array.from(layer.children).forEach(n=>n.remove()); layer.remove();
    const score = veg*6 + grains*8 + pro*10 - bad*12;
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,combo:veg+grains+pro,misses:bad,hits:veg+grains+pro,spawns:veg+grains+pro+bad,difficulty:diff,questsCleared:reason==='win'?1:0,questsTotal:1}}));
  }

  timeTimer=setInterval(()=>{ left=Math.max(0,left-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); if(left<=0) end('timeout'); },1000);
  HUD(); schedule();
  return { stop:()=>end('quit'), pause(){running=false}, resume(){if(!running){running=true;schedule();}} };
}
export default { boot };
