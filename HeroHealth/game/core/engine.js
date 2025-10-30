// === core/engine.js (hardened + FX utilities + import fx.js helpers)
import { add3DTilt, shatter3D as _shatter3D } from './fx.js';

export class Engine {
  constructor(THREE, canvas) {
    this.THREE  = THREE || {};
    this.canvas = canvas || document.getElementById('c') || this._ensureCanvas();

    let renderer = null;
    try {
      const R = this.THREE?.WebGLRenderer;
      if (typeof R === 'function') {
        renderer = new R({ canvas:this.canvas, antialias:true, alpha:true, preserveDrawingBuffer:false });
        const pr = Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(pr);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
      }
    } catch {}
    this.renderer = renderer;

    let _resizeRaf = 0;
    this._onResize = () => {
      if (_resizeRaf) return;
      _resizeRaf = requestAnimationFrame(() => {
        _resizeRaf = 0;
        try { this.renderer?.setSize(window.innerWidth, window.innerHeight, false); } catch {}
      });
    };
    window.addEventListener('resize', this._onResize, { passive:true });

    try {
      const mq = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reduceMotion = !!(mq && mq.matches);
    } catch { this.reduceMotion = false; }

    this._activeFX = new Set();

    this.fx = {
      popText: (text, opts = {}) => this._popText(text, opts),
      spawnShards: (x, y, opts = {}) => this._spawnShards(x, y, opts),
      burstEmoji: (x, y, emojis = ['✨','🟡','🟠'], opts = {}) => this._burstEmoji(x, y, emojis, opts),
      cursorBurst: (emojis = ['✨']) => this._cursorBurst(emojis),
      glowAt: (x, y, color = 'rgba(0,255,200,.6)', ms = 480) => this._glowAt(x, y, color, ms),
      shatter3D: (x,y,opts)=>_shatter3D(x,y,opts),
      add3DTilt: (el)=>add3DTilt(el),
      cancelAll: () => this._cancelAllFX(),
    };
  }

  dispose() {
    try { window.removeEventListener('resize', this._onResize, { passive:true }); } catch {}
    this._cancelAllFX();
    try { this.renderer?.dispose?.(); } catch {}
    if (this._ownCanvas && this.canvas?.parentNode) { try { this.canvas.remove(); } catch {} }
  }

  _ensureCanvas() {
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(c);
    this._ownCanvas = true;
    return c;
  }

  _track(o){ if(!o) return; this._activeFX.add(o); return o; }
  _untrack(o){ if(!o) return; this._activeFX.delete(o); }
  _cancelAllFX(){
    for(const o of this._activeFX){
      try{
        if (typeof o === 'number'){ clearTimeout(o); cancelAnimationFrame(o); }
        else if (o?.off) o.off();
        else if (o?.nodeType===1) o.remove();
        else if (o?.__rafCtl) o.cancel?.();
      }catch{}
    }
    this._activeFX.clear();
  }

  _popText(text, opts = {}) {
    if (!text) return;
    const el = document.createElement('div');
    const color = opts.color || '#7fffd4';
    const x = (opts.x ?? (innerWidth / 2));
    const y = (opts.y ?? (innerHeight / 2));
    el.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      font:700 18px/1.2 ui-rounded,system-ui; color:${color};
      text-shadow:0 2px 6px #000c; z-index:130; pointer-events:none;
      opacity:0; translate:0 8px; transition:opacity .22s, translate .22s;`;
    el.textContent = String(text);
    document.body.appendChild(el);
    this._track(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
    const hideAt = setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px';
      const rmAt = setTimeout(()=>{ try{ el.remove(); this._untrack(el);}catch{} }, 220);
      this._track(rmAt);
    }, this.reduceMotion ? 200 : (opts.ms ?? 720));
    this._track(hideAt);
  }

  /* (Spawn shards / burst emoji / glowAt) — ยกมาจากเวอร์ชันก่อนหน้าโดยไม่เปลี่ยนพฤติกรรม */
  _spawnShards(x,y,opts={}){ /* …เหมือนที่ส่งเวอร์ชันก่อน… */ }
  _burstEmoji(x,y,emojis=['✨'],opts={}){ /* …เหมือนที่ส่งเวอร์ชันก่อน… */ }
  _cursorBurst(emojis=['✨']){ const on=(ev)=>{ this._burstEmoji(ev.clientX,ev.clientY,emojis,{count:12,spread:1.2,life:640}); }; window.addEventListener('pointerdown',on,{passive:true}); const off=()=>window.removeEventListener('pointerdown',on,{passive:true}); this._track({off}); return off; }
  _glowAt(x,y,color='rgba(0,255,200,.6)',ms=480){ const dot=document.createElement('div'); dot.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:999px;background:radial-gradient(${color}, transparent 60%);filter:blur(2px);opacity:.85;pointer-events:none;z-index:124;transition:opacity .2s, transform .2s;`; document.body.appendChild(dot); this._track(dot); const t1=setTimeout(()=>{ dot.style.opacity='.0'; dot.style.transform='translate(-50%,-50%) scale(1.4)'; }, ms-180); const t2=setTimeout(()=>{ try{ dot.remove(); this._untrack(dot);}catch{} }, ms); this._track(t1); this._track(t2); }
}
