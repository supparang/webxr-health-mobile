// === /HeroHealth/vr/particles.js (2025-11-12 DOM burst + score pop + A-Frame fallback) ===
export const Particles = {
  // ดอกแตกกระจาย (ใช้พิกัดจอ screen:{x,y})
  burstShards(host, pos, opts={}){
    try{
      const screen = opts.screen || null;
      const n = opts.count || 12;

      if (screen){
        const fxHost = document.createElement('div');
        fxHost.style.position='fixed';
        fxHost.style.left=screen.x+'px';
        fxHost.style.top=screen.y+'px';
        fxHost.style.transform='translate(-50%,-50%)';
        fxHost.style.pointerEvents='none';
        fxHost.style.zIndex=999;
        document.body.appendChild(fxHost);

        for(let i=0;i<n;i++){
          const p=document.createElement('div');
          p.textContent = ['✨','💥','💫','⭐','🟣','🟡'][Math.floor(Math.random()*6)];
          p.style.position='absolute';
          p.style.left='0'; p.style.top='0';
          p.style.fontSize='22px';
          p.style.opacity='1';
          p.style.transition='transform .8s ease-out, opacity .8s ease-out';
          fxHost.appendChild(p);
          const dx=(Math.random()-0.5)*120, dy=(Math.random()-0.5)*120;
          setTimeout(()=>{ p.style.transform=`translate(${dx}px,${dy}px) scale(.65)`; p.style.opacity='0'; },10);
          setTimeout(()=>{ p.remove(); },830);
        }
        setTimeout(()=>fxHost.remove(),860);
        return;
      }

      // Fallback 3D
      if (window.AFRAME && AFRAME.scenes?.[0]){
        const scene = AFRAME.scenes[0];
        const pos3 = pos || {x:0,y:1.6,z:-1};
        const e = document.createElement('a-entity');
        e.setAttribute('position',`${pos3.x} ${pos3.y} ${pos3.z}`);
        try{ e.setAttribute('particle-system',{preset:'dust', color:'#fff,#8ef,#0ff', particleCount:30}); }catch{}
        scene.appendChild(e);
        setTimeout(()=>{ try{scene.removeChild(e);}catch{} },1100);
      }
    }catch(err){ console.warn('Particles.burstShards error:',err); }
  },

  // ตัวเลขคะแนนดีดขึ้น
  scorePop(x,y,delta,good=true){
    try{
      const el=document.createElement('div');
      el.textContent = (delta>0?'+':'') + delta;
      el.style.position='fixed';
      el.style.left=x+'px'; el.style.top=y+'px';
      el.style.transform='translate(-50%,-50%)';
      el.style.fontWeight='900';
      el.style.fontSize='18px';
      el.style.color = good ? '#4ade80' : '#f87171';
      el.style.textShadow='0 2px 10px rgba(0,0,0,.55)';
      el.style.zIndex=998; el.style.opacity='1';
      el.style.transition='transform .7s ease-out, opacity .7s ease-out';
      document.body.appendChild(el);
      setTimeout(()=>{ el.style.transform='translate(-50%,-150%) scale(1.2)'; el.style.opacity='0'; },10);
      setTimeout(()=>el.remove(),720);
    }catch(_){}
  }
};
