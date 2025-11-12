// === /HeroHealth/vr/particles.js ===
export const Particles = {
  // เอฟเฟกต์เศษชิ้นส่วนแตก (ธีมเลือกได้)
  burstShards(host, pos, opts={}){
    const screen = opts.screen || null;
    const theme  = String(opts.theme||'goodjunk');
    const n = 12;
    for(let i=0;i<n;i++){
      const el = document.createElement('div');
      el.textContent = theme==='hydration' ? '💧' :
                       theme==='groups'    ? '🍽️' :
                       theme==='plate'     ? '🥗' : '✨';
      el.style.cssText = `
        position:fixed; left:${screen?screen.x:innerWidth/2}px; top:${screen?screen.y:innerHeight/2}px;
        transform:translate(-50%,-50%); font-size:20px; pointer-events:none;
        transition:transform .6s ease, opacity .6s ease; opacity:1; z-index:700;`;
      document.body.appendChild(el);
      const dx = (Math.random()*2-1)*80;
      const dy = (Math.random()*2-1)*80;
      requestAnimationFrame(()=>{
        el.style.transform = `translate(${dx}px,${dy}px) scale(${0.9+Math.random()*0.6})`;
        el.style.opacity = '0';
      });
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 620);
    }
  },

  // เด้งตัวเลขคะแนนตรงจุดคลิก (delta เป็น + / -)
  scorePop(x, y, delta){
    const el = document.createElement('div');
    const isPlus = (delta|0) >= 0;
    el.textContent = (isPlus?'+':'') + (delta|0);
    el.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
      font:900 18px system-ui; color:${isPlus?'#86efac':'#fecaca'};
      text-shadow:0 6px 14px rgba(0,0,0,.45);
      pointer-events:none; opacity:0; z-index:720; transition:transform .6s ease, opacity .6s ease;`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity='1';
      el.style.transform='translate(-50%,-80%)';
    });
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translate(-50%,-120%)'; }, 380);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 1000);
  }
};

export default { Particles };
