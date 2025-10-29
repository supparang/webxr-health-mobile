// === Hero Health Academy — game/core/fx.js (bridge to Engine.fx) ===

// 3D tilt แบบเบา ๆ บน DOM node (ปลอดภัยต่อมือถือ)
export function add3DTilt(el){
  if (!el || el.__hhaTiltOn) return;
  el.__hhaTiltOn = true;
  el.style.transformStyle = 'preserve-3d';
  el.style.willChange = (el.style.willChange||'') + ', transform';

  const max = 10; // องศาสูงสุด
  const onMove = (e)=>{
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const x = (e.clientX - cx) / (r.width/2);
    const y = (e.clientY - cy) / (r.height/2);
    const rx =  Math.max(-1, Math.min(1, y)) * max;
    const ry = -Math.max(-1, Math.min(1, x)) * max;
    el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const onLeave = ()=>{ el.style.transform = 'perspective(600px) rotateX(0) rotateY(0)'; };

  el.addEventListener('pointermove', onMove, {passive:true});
  el.addEventListener('pointerleave', onLeave, {passive:true});

  // cleanup handle
  el.__hhaTiltOff = ()=>{ 
    el.removeEventListener('pointermove', onMove, {passive:true});
    el.removeEventListener('pointerleave', onLeave, {passive:true});
    delete el.__hhaTiltOn; delete el.__hhaTiltOff;
  };
}

export function shatter3D(x, y, opts = {}){
  try { window.HHA?.engine?.fx?.shatter3D(x, y, opts); } catch {}
}
export function popText(text, opts = {}){
  try { window.HHA?.engine?.fx?.popText?.(text, opts); } catch {}
}

// เผื่ออนาคต: expose utility อื่น ๆ ถ้าต้องการ
export const burstEmoji = (x,y,emojis,opts)=>{ try { window.HHA?.engine?.fx?.burstEmoji?.(x,y,emojis,opts); } catch {} };
export const glowAt     = (x,y,color,ms)=>{ try { window.HHA?.engine?.fx?.glowAt?.(x,y,color,ms); } catch {} };
