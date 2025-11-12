// === /HeroHealth/vr/particles.js (2025-11-12) ===
export const Particles = {
  scorePop(x, y, delta, opts={}){
    const el = document.createElement('div');
    el.className = 'hha-score-pop';
    el.textContent = (delta>0?'+':'') + (delta|0);
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    if (delta>0){
      el.style.background = 'rgba(34,197,94,.18)';
      el.style.borderColor = '#22c55e';
      el.style.color = '#bbf7d0';
    }else{
      el.style.background = 'rgba(239,68,68,.18)';
      el.style.borderColor = '#ef4444';
      el.style.color = '#fecaca';
    }
    (document.querySelector('.game-wrap')||document.body).appendChild(el);
    // animate
    requestAnimationFrame(()=>{
      el.style.transform = 'translate(-50%, -80%) scale(1.05)';
      el.style.opacity = '0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 700);
  },

  burstShards(host=null, pos=null, {screen, theme}={}){
    const wrap = document.createElement('div');
    wrap.className = 'hha-burst';
    wrap.style.left = (screen?.x|0)+'px';
    wrap.style.top  = (screen?.y|0)+'px';
    const n = 10;
    for(let i=0;i<n;i++){
      const p = document.createElement('i');
      p.className = 'hha-piece';
      p.style.setProperty('--tx', ((Math.random()*2-1)*60|0)+'px');
      p.style.setProperty('--ty', ((Math.random()*2-1)*60|0)+'px');
      p.style.opacity = '1';
      wrap.appendChild(p);
    }
    (document.querySelector('.game-wrap')||document.body).appendChild(wrap);
    // auto remove
    setTimeout(()=>{ try{ wrap.remove(); }catch{} }, 600);
  }
};

// inject CSS once
(function(){
  if (document.getElementById('hha-pfx-css')) return;
  const css = document.createElement('style'); css.id='hha-pfx-css';
  css.textContent = `
  .hha-score-pop{
    position:fixed; z-index:900; pointer-events:none;
    transform:translate(-50%,-50%); opacity:.95;
    background:#0f172a; border:2px solid #334155; color:#e2e8f0;
    padding:4px 8px; border-radius:10px; font:900 14px system-ui;
    filter:drop-shadow(0 10px 18px rgba(0,0,0,.35));
    transition: transform .45s ease, opacity .45s ease;
  }
  .hha-burst{ position:fixed; z-index:880; width:0; height:0; pointer-events:none; }
  .hha-burst .hha-piece{
    position:absolute; left:0; top:0; width:6px; height:6px; opacity:0;
    background:linear-gradient(180deg, #93c5fd, #a5b4fc);
    border-radius:999px; transform:translate(-50%,-50%);
    animation:hhaShard .55s ease forwards;
  }
  @keyframes hhaShard {
    0% { transform:translate(-50%,-50%) scale(.9); opacity:0.9; }
    100%{ transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(.6); opacity:0; }
  }`;
  document.head.appendChild(css);
})();
export default Particles;
