// === core/fx.js
export function add3DTilt(el){
  if (!el || el.__hhaTilt) return; el.__hhaTilt = 1;
  el.addEventListener('pointermove', (e)=>{
    const r = el.getBoundingClientRect();
    const cx=(e.clientX-r.left)/r.width-.5, cy=(e.clientY-r.top)/r.height-.5;
    el.style.transform = `translate(-50%,-50%) rotateX(${cy*-6}deg) rotateY(${cx*8}deg)`;
  }, {passive:true});
  el.addEventListener('pointerleave', ()=>{ el.style.transform='translate(-50%,-50%)'; });
}
export function shatter3D(x,y){
  const p = document.createElement('div');
  p.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 16px #fff8;
    pointer-events:none;z-index:300;opacity:1;transition:all .6s ease-out`;
  document.body.appendChild(p);
  requestAnimationFrame(()=>{ p.style.opacity='0'; p.style.transform='translate(-50%,-120%) scale(1.6)'; });
  setTimeout(()=>p.remove(), 620);
}
// set once (modes อ้างผ่าน window.HHA_FX เพื่อเลี่ยง import ซ้ำ)
if (!window.HHA_FX) window.HHA_FX = { add3DTilt, shatter3D };
