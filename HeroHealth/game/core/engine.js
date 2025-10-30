// === Hero Health Academy — core/engine.js (2025-10-30)
// Mini engine + DOM FX, ใช้ named import จาก core/fx.js

import * as FX from './fx.js';

export class Engine {
  constructor(THREE, canvas) {
    this.THREE  = THREE || {};
    this.canvas = canvas || document.getElementById('c') || this._ensureCanvas();

    // (ออปชัน) Renderer — ป้องกัน error ถ้าไม่มี THREE
    try {
      if (this.THREE?.WebGLRenderer) {
        const R = this.THREE.WebGLRenderer;
        this.renderer = new R({
          canvas: this.canvas, antialias:true, alpha:true, preserveDrawingBuffer:false
        });
        const pr = Math.min(2, window.devicePixelRatio || 1);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      }
    } catch {}

    // Resize (throttle)
    let _raf = 0;
    this._onResize = () => {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        _raf = 0;
        try { this.renderer?.setSize(window.innerWidth, window.innerHeight, false); } catch {}
      });
    };
    window.addEventListener('resize', this._onResize, { passive:true });

    // ลด motion ถ้าผู้ใช้ตั้งค่า
    try {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reduceMotion = !!mq?.matches;
    } catch { this.reduceMotion = false; }

    // FX facade (ใช้ DOM เป็นหลัก + เรียก helper จาก fx.js)
    this.fx = {
      popText: (text, opts = {}) => this._popText(text, opts),
      glowAt:  (x, y, color, ms) => FX.glowAt(x, y, color, ms),
      shatter3D: (x, y, opts={}) => { FX.shatter3D(x, y, opts); },
      add3DTilt: (el) => { try { FX.add3DTilt(el); } catch {} },
      // เผื่อโหมดอื่นต้องการต่อยอด
      screenFromElementCenter: (el) => this._screenFromElementCenter(el),
    };
  }

  dispose() {
    try { window.removeEventListener('resize', this._onResize, { passive:true }); } catch {}
    try { this.renderer?.dispose?.(); } catch {}
    if (this._ownCanvas && this.canvas?.parentNode) {
      try { this.canvas.remove(); } catch {}
    }
  }

  /* ---------- Internal helpers ---------- */
  _ensureCanvas() {
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(c);
    this._ownCanvas = true;
    return c;
  }

  _popText(text, opts = {}) {
    if (!text) return;
    const el = document.createElement('div');
    const x = (opts.x ?? innerWidth/2), y = (opts.y ?? innerHeight/2);
    el.textContent = String(text);
    el.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      font:900 18px/1 ui-rounded,system-ui; color:#eaf6ff;
      text-shadow:0 2px 8px #000; z-index:130; pointer-events:none;
      opacity:0; translate:0 8px; transition:opacity .22s, translate .22s;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
    setTimeout(()=>{
      el.style.opacity='0'; el.style.translate='0 -8px';
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 220);
    }, this.reduceMotion ? 200 : (opts.ms ?? 720));
  }

  _screenFromElementCenter(el){
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
}
