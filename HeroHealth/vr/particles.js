// === /HeroHealth/vr/particles.js (2025-11-13: burstShards + scorePop) ===
export const Particles = {
  burstShards(host, pos, opts){
    // DOM-only lightweight confetti around (screen.x, screen.y)
    try{
      const screen = opts?.screen;
      if(!screen) return;
      const cx = screen.x|0, cy = screen.y|0;
      const n = 10;
      for(let i=0;i<n;i++){
        const s = document.createElement('div');
        s.className='hha-shard';
        s.textContent = '✦';
        const dx = (Math.random()*80-40);
        const dy = (Math.random()*60-20);
        s.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);pointer-events:none;z-index:660;font-size:${12+Math.random()*10}px;color:#fff;opacity:.9;transition:transform .6s ease, opacity .6s ease;text-shadow:0 0 8px rgba(255,255,255,.6)`;
        document.body.appendChild(s);
        requestAnimationFrame(()=>{
          s.style.transform = `translate(${dx}px, ${dy-30}px)`;
          s.style.opacity = '0';
        });
        setTimeout(()=>{ try{s.remove();}catch(_){}} , 650);
      }
    }catch(_){}
  },

  scorePop(screen, delta){
    try{
      const cx = screen?.x|0, cy = screen?.y|0;
      const el = document.createElement('div');
      const plus = (delta>=0?'+':'');
      el.textContent = `${plus}${delta|0}`;
      const col = delta>0 ? '#86efac' : (delta<0 ? '#fecaca' : '#e5e7eb');
      el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);pointer-events:none;z-index:670;font:900 18px system-ui;color:${col};text-shadow:0 8px 18px rgba(0,0,0,.45);opacity:1;transition:transform .6s ease, opacity .6s ease`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{
        el.style.transform = 'translate(-50%,-80%)';
        el.style.opacity = '0';
      });
      setTimeout(()=>{ try{el.remove();}catch(_){}} , 700);
    }catch(_){}
  }
};

export default { Particles };
