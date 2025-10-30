// === FX singleton (no re-declare) ===
let __HHA_FX_CREATED = false;
export function add3DTilt(el){
  try{
    el.style.transformStyle='preserve-3d';
    el.addEventListener('mousemove', (e)=>{
      const r = el.getBoundingClientRect();
      const cx = (e.clientX - r.left)/r.width - .5;
      const cy = (e.clientY - r.top)/r.height - .5;
      el.style.transform = `translate(-50%,-50%) rotateX(${-cy*8}deg) rotateY(${cx*10}deg)`;
    });
    el.addEventListener('mouseleave', ()=>{ el.style.transform='translate(-50%,-50%)'; });
  }catch{}
}
export function shatter3D(x,y){
  try{
    const p=document.createElement('div');
    p.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      width:16px;height:16px;border-radius:999px;background:#fff;box-shadow:0 0 24px #fff8;z-index:150;pointer-events:none;opacity:.9;transition:all .45s`;
    document.body.appendChild(p);
    requestAnimationFrame(()=>{ p.style.opacity='0'; p.style.transform=`translate(-50%,-50%) scale(2)`; });
    setTimeout(()=>{ try{p.remove();}catch{} }, 460);
  }catch{}
}
if (!__HHA_FX_CREATED){ __HHA_FX_CREATED = true; }
