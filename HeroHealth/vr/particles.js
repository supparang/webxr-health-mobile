// === /HeroHealth/vr/particles.js (2025-11-13 scorePop + shards) ===
export const Particles = (function(){
  'use strict';
  const ID = 'hha-particles-css';
  if(!document.getElementById(ID)){
    const css = document.createElement('style'); css.id=ID;
    css.textContent = `
    .hha-pop{position:fixed;left:0;top:0;pointer-events:none;z-index:700;font:900 16px system-ui;color:#e5e7eb;
      text-shadow:0 2px 10px rgba(0,0,0,.45);will-change:transform,opacity}
    .hha-pop.good{color:#86efac}
    .hha-pop.bad{color:#fecaca}
    .hha-shard{position:fixed;left:0;top:0;pointer-events:none;z-index:690;transform:translate(-50%,-50%);opacity:.95}
    `;
    document.head.appendChild(css);
  }

  function scorePop({x,y,delta}){
    try{
      const el = document.createElement('div');
      el.className = 'hha-pop ' + (delta>=0?'good':'bad');
      el.textContent = (delta>=0?'+':'') + (delta|0);
      el.style.transform = `translate(${x}px, ${y}px)`;
      document.body.appendChild(el);
      const dy = (delta>=0? -34 : -20);
      requestAnimationFrame(()=>{
        el.animate([
          { transform:`translate(${x}px, ${y}px) scale(1)`,   opacity:1 },
          { transform:`translate(${x}px, ${y+dy}px) scale(1.08)`, opacity:0 }
        ], { duration:700, easing:'ease-out' }).onfinish = ()=>{ try{el.remove();}catch{} };
      });
    }catch{}
  }

  function burstShards(_host,_pos,{screen, theme}={}){
    try{
      const n = 10;
      const colors = theme==='hydration' ? ['#60a5fa','#93c5fd','#e0f2fe']
                  : theme==='groups'    ? ['#fde68a','#fca5a5','#86efac']
                  : theme==='plate'     ? ['#86efac','#fcd34d','#93c5fd']
                  : ['#93c5fd','#c4b5fd','#fda4af'];
      for(let i=0;i<n;i++){
        const dot = document.createElement('div');
        dot.className = 'hha-shard';
        dot.style.left = screen.x+'px'; dot.style.top = screen.y+'px';
        dot.style.width = dot.style.height = (6+Math.random()*6)+'px';
        dot.style.background = colors[i%colors.length];
        dot.style.borderRadius = '999px';
        document.body.appendChild(dot);
        const ang = Math.random()*Math.PI*2;
        const dist = 30 + Math.random()*70;
        const tx = screen.x + Math.cos(ang)*dist;
        const ty = screen.y + Math.sin(ang)*dist;
        const dur = 350 + Math.random()*250;
        dot.animate([
          { transform:`translate(-50%,-50%)`, opacity:1 },
          { transform:`translate(${tx-screen.x-50}%, ${ty-screen.y-50}%)`, opacity:0 }
        ], { duration:dur, easing:'ease-out' }).onfinish = ()=>{ try{dot.remove();}catch{} };
      }
    }catch{}
  }

  return { scorePop, burstShards };
})();
export default Particles;
