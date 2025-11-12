// === /HeroHealth/vr/particles.js (scorePop precise) ===
export const Particles = {
  scorePop(x, y, text, positive){
    try{
      const layer = document.querySelector('.hha-layer') || document.body;
      const el = document.createElement('div');
      el.style.position='fixed'; el.style.left=x+'px'; el.style.top=y+'px';
      el.style.transform='translate(-50%,-50%)';
      el.style.font='900 18px system-ui, Apple Color Emoji, Segoe UI Emoji, sans-serif';
      el.style.color = positive ? '#86efac' : '#fca5a5';
      el.style.textShadow='0 3px 12px rgba(0,0,0,.45)';
      el.style.pointerEvents='none'; el.style.zIndex='9999';
      el.textContent = String(text||'');
      layer.appendChild(el);

      const start = performance.now(), dur=620;
      (function anim(t0){
        const t = Math.min(1, (performance.now()-start)/dur);
        const ease = 1 - Math.pow(1-t, 3);
        const dy = -38*ease;
        const a  = 1 - t;
        el.style.transform = `translate(-50%, calc(-50% + ${dy}px)) scale(${1+0.15*ease})`;
        el.style.opacity = String(a);
        if (t<1) requestAnimationFrame(anim); else try{ layer.removeChild(el); }catch(_){}
      })();
    }catch(_){}
  },
  burstShards(host, pos, opts){
    // (safe no-op / simple halo)
    try{
      const x=(opts&&opts.screen&&opts.screen.x)||0, y=(opts&&opts.screen&&opts.screen.y)||0;
      const layer = document.querySelector('.hha-layer') || document.body;
      for(let i=0;i<10;i++){
        const s=document.createElement('div');
        s.style.position='fixed'; s.style.left=x+'px'; s.style.top=y+'px';
        s.style.width='4px'; s.style.height='4px'; s.style.borderRadius='999px';
        s.style.background='rgba(148,163,184,.9)'; s.style.pointerEvents='none'; s.style.zIndex='9998';
        layer.appendChild(s);
        const ang=Math.random()*Math.PI*2, dist=24+Math.random()*24, life=280+Math.random()*180;
        const sx=Math.cos(ang)*dist, sy=Math.sin(ang)*dist;
        const t0=performance.now();
        (function anim(){
          const t=(performance.now()-t0)/life; if(t>=1){ try{layer.removeChild(s)}catch(_){ } return; }
          s.style.transform=`translate(${sx*t}px, ${sy*t}px)`; s.style.opacity=String(1-t);
          requestAnimationFrame(anim);
        })();
      }
    }catch(_){}
  }
};
export default Particles;
