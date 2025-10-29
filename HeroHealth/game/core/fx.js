// === HHA FX Namespace (safe, single export) ===
// ใช้แบบ: import FX from '../core/fx.js';  แล้วเรียก FX.add3DTilt(el), FX.shatter3D(x,y)

const FX = (() => {
  function add3DTilt(el){
    if (!el || el.__hhaTilted) return;
    el.__hhaTilted = true;
    el.style.transformStyle = 'preserve-3d';
    el.addEventListener('pointermove', (e)=>{
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const dx = (e.clientX - cx)/r.width, dy = (e.clientY - cy)/r.height;
      el.style.transform = `translate(-50%,-50%) rotateX(${(-dy*9).toFixed(2)}deg) rotateY(${(dx*9).toFixed(2)}deg)`;
    }, { passive:true });
    el.addEventListener('pointerleave', ()=>{
      el.style.transform = 'translate(-50%,-50%)';
    }, { passive:true });
  }

  function shatter3D(x, y){
    try{
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        pointer-events:none;z-index:130;`;
      for(let i=0;i<12;i++){
        const s=document.createElement('i');
        s.textContent='✦';
        s.style.cssText=`position:absolute;left:0;top:0;font:900 12px ui-rounded;opacity:.9;`;
        p.appendChild(s);
        const ang = Math.random()*Math.PI*2;
        const dist= 30+Math.random()*34;
        const tx  = Math.cos(ang)*dist, ty = Math.sin(ang)*dist;
        s.animate([{ transform:'translate(0,0) scale(1)', opacity:1 },
                   { transform:`translate(${tx}px,${ty}px) scale(.5)`, opacity:0 }],
                  { duration:620+Math.random()*200, easing:'cubic-bezier(.2,.9,.2,1)' });
      }
      document.body.appendChild(p);
      setTimeout(()=>{ try{ p.remove(); }catch{} }, 720);
    }catch{}
  }

  return { add3DTilt, shatter3D };
})();

export default FX;
