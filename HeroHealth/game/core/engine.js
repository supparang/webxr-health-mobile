// === core/engine.js (minimal renderer helper + FX export; safe for DOM-only modes) ===
export class Engine {
  constructor() {
    this.canvas = document.getElementById('c') || this._ensureCanvas();
    // ป้องกันบังคลิก
    try {
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '1';
      this.canvas.style.position = 'fixed';
      this.canvas.style.inset = '0';
    } catch {}
  }
  _ensureCanvas(){
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
    document.body.appendChild(c);
    return c;
  }
}

// ✅ FX popText พร้อม export (แก้ error “does not provide an export named 'FX'”)
export const FX = {
  popText(txt, pos){
    try{
      const el = document.createElement('div');
      el.textContent = txt;
      Object.assign(el.style, {
        position:'fixed', left:(pos?.x||innerWidth/2)+'px', top:(pos?.y||innerHeight/2)+'px',
        transform:'translate(-50%,-50%) scale(1)',
        font:'900 20px ui-rounded,system-ui', color:'#fff',
        textShadow:'0 2px 10px rgba(0,0,0,.7)',
        transition:'transform .6s, opacity .6s',
        opacity:'1', zIndex:2000, pointerEvents:'none'
      });
      document.body.appendChild(el);
      requestAnimationFrame(()=>{
        el.style.transform='translate(-50%,-120%) scale(1.4)';
        el.style.opacity='0';
      });
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 620);
    }catch{}
  }
};
