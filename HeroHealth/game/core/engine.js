// === core/engine.js ===
// Minimal canvas helper (pointer-events:none) + HiDPI resize
// + FX.popText ตรงตามที่โหมด DOM ใช้ได้
'use strict';

export class Engine {
  constructor() {
    this.canvas = document.getElementById('c') || this._ensureCanvas();
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true }) || null;

    try {
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '1';
      this.canvas.style.position = 'fixed';
      this.canvas.style.inset = '0';
    } catch {}

    // bind + initial fit
    this._boundResize = this._fitToWindow.bind(this);
    window.addEventListener('resize', this._boundResize);
    this._fitToWindow();
  }

  _ensureCanvas(){
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
    document.body.appendChild(c);
    return c;
  }

  _fitToWindow(){
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.floor(innerWidth);
    const h = Math.floor(innerHeight);
    if (this.canvas.width !== Math.floor(w*dpr) || this.canvas.height !== Math.floor(h*dpr)) {
      this.canvas.width  = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width  = w + 'px';
      this.canvas.style.height = h + 'px';
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.clear();
      }
    }
  }

  clear(){
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // สำหรับเอฟเฟกต์วาดเล็กๆ ถ้าต้องการ (ไม่รบกวน DOM modes)
  drawText(txt, x, y) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.font = '900 20px ui-rounded,system-ui';
    this.ctx.fillStyle = '#fff';
    this.ctx.shadowColor = 'rgba(0,0,0,.7)';
    this.ctx.shadowBlur = 10;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(String(txt), x, y);
    this.ctx.restore();
  }

  dispose(){
    try { window.removeEventListener('resize', this._boundResize); } catch {}
  }
}

// Lightweight DOM FX ชนิดเดียวกับที่โหมด DOM ใช้
export const FX = {
  popText(txt, pos){
    try{
      const el = document.createElement('div');
      el.textContent = String(txt);
      Object.assign(el.style, {
        position:'fixed',
        left: ((pos && pos.x != null) ? pos.x : innerWidth/2) + 'px',
        top:  ((pos && pos.y != null) ? pos.y : innerHeight/2) + 'px',
        transform:'translate(-50%,-50%) scale(1)',
        font:'900 20px ui-rounded,system-ui',
        color:'#fff',
        textShadow:'0 2px 10px rgba(0,0,0,.7)',
        transition:'transform .6s, opacity .6s',
        opacity:'1',
        zIndex:2000,
        pointerEvents:'none'
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
