// === /webxr-health-mobile/HeroHealth/game/core/engine.js ===
// (Hardened + FX utilities + fx.js helpers integrated)
// - Safe WebGL init (no crash if context blocked)
// - Resize with RAF throttle
// - prefers-reduced-motion aware
// - DOM-based FX: popText, spawnShards, burstEmoji, cursorBurst, glowAt
// - 3D helpers passthrough: add3DTilt, shatter3D
// - Full lifecycle cleanup (dispose / cancelAll)

import { add3DTilt, shatter3D as _shatter3D } from './fx.js';

export class Engine {
  constructor(THREE, canvas) {
    this.THREE  = THREE || {};
    this.canvas = canvas || document.getElementById('c') || this._ensureCanvas();

    // ---------- Renderer (safe) ----------
    let renderer = null;
    try {
      const R = this.THREE?.WebGLRenderer;
      if (typeof R === 'function') {
        renderer = new R({
          canvas: this.canvas,
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false
        });
        const pr = Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(pr);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        renderer.setClearColor?.(0x000000, 0);
      }
    } catch { /* keep null renderer in no-GL env */ }
    this.renderer = renderer;

    // ---------- Resize (RAF-throttled) ----------
    let _resizeRaf = 0;
    this._onResize = () => {
      if (_resizeRaf) return;
      _resizeRaf = requestAnimationFrame(() => {
        _resizeRaf = 0;
        try { this.renderer?.setSize(window.innerWidth, window.innerHeight, false); } catch {}
      });
    };
    try { window.addEventListener('resize', this._onResize, { passive:true }); } catch {}

    // ---------- Motion preference ----------
    try {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reduceMotion = !!(mq && mq.matches);
    } catch { this.reduceMotion = false; }

    // ---------- FX tracker ----------
    this._activeFX = new Set();

    // ---------- Public FX API ----------
    this.fx = {
      popText:     (text, opts = {}) => this._popText(text, opts),
      spawnShards: (x, y, opts = {}) => this._spawnShards(x, y, opts),
      burstEmoji:  (x, y, emojis = ['✨','🟡','🟠'], opts = {}) => this._burstEmoji(x, y, emojis, opts),
      cursorBurst: (emojis = ['✨']) => this._cursorBurst(emojis),
      glowAt:      (x, y, color = 'rgba(0,255,200,.6)', ms = 480) => this._glowAt(x, y, color, ms),
      // passthrough to fx.js
      shatter3D:   (x, y, opts) => _shatter3D(x, y, opts),
      add3DTilt:   (el) => add3DTilt(el),
      // cleanup
      cancelAll:   () => this._cancelAllFX(),
    };
  }

  // ---------- Lifecycle ----------
  dispose() {
    try { window.removeEventListener('resize', this._onResize, { passive:true }); } catch {}
    this._cancelAllFX();
    try { this.renderer?.dispose?.(); } catch {}
    if (this._ownCanvas && this.canvas?.parentNode) {
      try { this.canvas.remove(); } catch {}
    }
  }

  // ---------- Internals ----------
  _ensureCanvas() {
    const c = document.createElement('canvas');
    c.id = 'c';
    // ไม่บังคลิก (โหมด DOM) และอยู่พื้นหลัง
    c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(c);
    this._ownCanvas = true;
    return c;
  }

  _track(o){ if(!o) return o; this._activeFX.add(o); return o; }
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

  // ---------- FX: popText ----------
  _popText(text, opts = {}) {
    if (!text && text !== 0) return;
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
    const hideAt = setTimeout(()=>{
      el.style.opacity='0'; el.style.translate='0 -8px';
      const rmAt = setTimeout(()=>{ try{ el.remove(); this._untrack(el);}catch{} }, 220);
      this._track(rmAt);
    }, this.reduceMotion ? 200 : (opts.ms ?? 720));
    this._track(hideAt);
  }

  // ---------- FX: spawnShards (DOM particles) ----------
  _spawnShards(x, y, opts = {}) {
    const count   = (opts.count ?? 18) | 0;
    const spread  = opts.spread ?? 1.0;     // 0..2
    const life    = opts.life   ?? (this.reduceMotion ? 360 : 620);
    const baseClr = opts.color  || '#bde7ff';
    const sizeMin = opts.sizeMin ?? 6;
    const sizeMax = opts.sizeMax ?? 14;
    const grav    = (opts.gravity ?? 900) / 1000; // px/ms^2 → px/ms

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.textContent = '✦';
      const fs = (Math.random() * (sizeMax - sizeMin) + sizeMin) | 0;
      p.style.cssText = `
        position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        font-weight:900;font-size:${fs}px;color:${baseClr};
        text-shadow:0 2px 8px rgba(0,0,0,.35);opacity:1;z-index:124;pointer-events:none;`;
      document.body.appendChild(p);
      this._track(p);

      const ang = (Math.random() * Math.PI * 2);
      const spd = (220 + Math.random()*380) * spread; // px/s
      const vx = Math.cos(ang) * spd / 1000;          // px/ms
      const vy = Math.sin(ang) * spd / 1000;
      const born = performance.now();

      // animate with RAF for smoother composition
      const rafCtl = { cancel:null };
      const step = (t0) => {
        const t = performance.now();
        const dt = Math.min(32, t - (t0 || born));
        const age = t - born;
        const k = Math.min(1, age / life);
        const dx = vx * age;
        const dy = vy * age + 0.5 * grav * age * age;
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${1 + 0.2*k}) rotate(${(ang*180/Math.PI + age*0.2)|0}deg)`;
        p.style.opacity = String(1 - k);
        if (age >= life) { try{ p.remove(); this._untrack(p); }catch{} return; }
        rafCtl.id = requestAnimationFrame(()=>step(t));
      };
      rafCtl.cancel = ()=>{ try{ cancelAnimationFrame(rafCtl.id); p.remove(); this._untrack(p);}catch{} };
      p.__rafCtl = rafCtl;
      this._track(rafCtl);
      step();
    }
  }

  // ---------- FX: burstEmoji (DOM emoji particles) ----------
  _burstEmoji(x, y, emojis = ['✨'], opts = {}) {
    const count   = (opts.count ?? 16) | 0;
    const spread  = opts.spread ?? 1.0;
    const life    = opts.life   ?? (this.reduceMotion ? 380 : 720);
    const sizeMin = opts.sizeMin ?? 18;
    const sizeMax = opts.sizeMax ?? 28;
    const grav    = (opts.gravity ?? 700) / 1000; // px/ms^2
    const rotAmp  = opts.rotAmp ?? 0.25;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.textContent = emojis[(Math.random()*emojis.length)|0] || '✨';
      const fs = (Math.random() * (sizeMax - sizeMin) + sizeMin) | 0;
      p.style.cssText = `
        position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        font-size:${fs}px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35));
        opacity:1;z-index:123;pointer-events:none;`;
      document.body.appendChild(p);
      this._track(p);

      const ang = (Math.random() * Math.PI * 2);
      const spd = (180 + Math.random()*340) * spread; // px/s
      const vx = Math.cos(ang) * spd / 1000;
      const vy = Math.sin(ang) * spd / 1000;
      const born = performance.now();
      const rotSpeed = (Math.random()*2 - 1) * rotAmp;

      const rafCtl = { cancel:null };
      const step = (t0) => {
        const t = performance.now();
        const age = t - (t0 || born);
        const k = Math.min(1, (t - born) / life);
        const dx = vx * (t - born);
        const dy = vy * (t - born) + 0.5 * grav * (t - born) * (t - born);
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotSpeed*(t-born)}rad) scale(${1 + 0.25*k})`;
        p.style.opacity = String(1 - k);
        if ((t - born) >= life) { try{ p.remove(); this._untrack(p);}catch{} return; }
        rafCtl.id = requestAnimationFrame(()=>step(t));
      };
      rafCtl.cancel = ()=>{ try{ cancelAnimationFrame(rafCtl.id); p.remove(); this._untrack(p);}catch{} };
      p.__rafCtl = rafCtl;
      this._track(rafCtl);
      step();
    }
  }

  // ---------- FX: cursorBurst (bind pointerdown then auto cleanup) ----------
  _cursorBurst(emojis = ['✨']) {
    const on = (ev) => {
      this._burstEmoji(ev.clientX, ev.clientY, emojis, { count: 12, spread: 1.2, life: 640 });
    };
    window.addEventListener('pointerdown', on, { passive: true });
    const off = () => window.removeEventListener('pointerdown', on, { passive: true });
    const token = { off };
    this._track(token);
    return off;
  }

  // ---------- FX: glowAt ----------
  _glowAt(x, y, color = 'rgba(0,255,200,.6)', ms = 480) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      width:22px;height:22px;border-radius:999px;
      background:radial-gradient(${color}, transparent 60%);
      filter:blur(2px);opacity:.85;pointer-events:none;z-index:124;
      transition:opacity .2s, transform .2s;`;
    document.body.appendChild(dot);
    this._track(dot);
    const t1 = setTimeout(() => {
      dot.style.opacity = '.0';
      dot.style.transform = 'translate(-50%,-50%) scale(1.4)';
    }, Math.max(0, ms - 180));
    const t2 = setTimeout(() => { try{ dot.remove(); this._untrack(dot);}catch{} }, ms);
    this._track(t1); this._track(t2);
  }
}
