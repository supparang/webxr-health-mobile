// === /HeroHealth/vr/particles.js (2025-11-12 LATEST + scorePop) ===
export const Particles = {
  burstShards(host, pos, opts){
    // เดิมของคุณไว้ตามเดิมได้เลย… (ถ้ายังไม่มี ให้ทำแบบ DOM-mode คร่าว ๆ)
    if (opts && opts.screen){
      const { x, y } = opts.screen;
      const n = 12;
      for (let i=0;i<n;i++){
        const s = document.createElement('div');
        s.textContent = '✦';
        Object.assign(s.style, {
          position:'fixed', left:(x)+'px', top:(y)+'px',
          transform:'translate(-50%,-50%)',
          font:'700 14px system-ui', color:'#fff',
          textShadow:'0 2px 10px rgba(0,0,0,.5)',
          pointerEvents:'none', zIndex:700
        });
        document.body.appendChild(s);
        const dx = (Math.random()*2-1)*80;
        const dy = (Math.random()*2-1)*80;
        s.animate([
          { transform:'translate(-50%,-50%) scale(1)', opacity:1 },
          { transform:`translate(${dx}px, ${dy}px) scale(.8)`, opacity:0 }
        ], { duration:600+Math.random()*400, easing:'ease-out' }).onfinish=()=>s.remove();
      }
    }
  },

  // ✅ เด้งคะแนน/ข้อความตรงตำแหน่งคลิก
  scorePop(x, y, text){
    const el = document.createElement('div');
    el.textContent = String(text);
    Object.assign(el.style, {
      position:'fixed', left:x+'px', top:y+'px',
      transform:'translate(-50%,-50%)',
      font:'900 18px system-ui', color:'#e2e8f0',
      padding:'2px 6px', borderRadius:'10px',
      background:'rgba(11,18,32,.75)', border:'1px solid #334155',
      boxShadow:'0 8px 28px rgba(0,0,0,.35)',
      pointerEvents:'none', zIndex:720
    });
    document.body.appendChild(el);
    el.animate([
      { transform:'translate(-50%,-50%) scale(1)', opacity:1, filter:'drop-shadow(0 0 0px rgba(99,102,241,0))' },
      { transform:'translate(-50%,-70%) scale(1.15)', opacity:0, filter:'drop-shadow(0 0 12px rgba(99,102,241,.9))' }
    ], { duration:700, easing:'cubic-bezier(.2,.8,.2,1)' }).onfinish = ()=>el.remove();
  }
};
export default { Particles };
