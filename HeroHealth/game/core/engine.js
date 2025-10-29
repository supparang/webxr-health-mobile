// === Hero Health Academy — core/engine.js (hardened + FX utilities) ===
// Mini engine: optional THREE renderer + DOM-first FX helpers (safe & lean)

export class Engine {
  constructor(THREE, canvas) {
    this.THREE  = THREE || {};
    this.canvas = canvas || document.getElementById('c') || this._ensureCanvas();

    // ---------- Renderer (optional/defensive) ----------
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
        const pr = Math.min(2, window.devicePixelRatio || 1); // cap pixelRatio for perf
        renderer.setPixelRatio(pr);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
      }
    } catch {}
    this.renderer = renderer;

    // ---------- Resize (throttled) ----------
    let _resizeRaf = 0;
    this._onResize = () => {
      if (_resizeRaf) return;
      _resizeRaf = requestAnimationFrame(() => {
        _resizeRaf = 0;
        try { this.renderer?.setSize(window.innerWidth, window.innerHeight, false); } catch {}
      });
    };
    window.addEventListener('resize', this._onResize, { passive:true });

    // ---------- Motion preference ----------
    try {
      const mq = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reduceMotion = !!(mq && mq.matches);
    } catch { this.reduceMotion = false; }

    // ---------- Book-keeping ----------
    this._activeFX = new Set(); // DOM nodes / timeouts / RAF controllers / off() handles

    // ---------- FX helpers (DOM-first) ----------
    this.fx = {
      popText: (text, opts = {}) => this._popText(text, opts),
      spawnShards: (x, y, opts = {}) => this._spawnShards(x, y, opts),
      burstEmoji: (x, y, emojis = ['✨','🟡','🟠'], opts = {}) => this._burstEmoji(x, y, emojis, opts),
      cursorBurst: (emojis = ['✨']) => this._cursorBurst(emojis),
      glowAt: (x, y, color = 'rgba(0,255,200,.6)', ms = 480) => this._glowAt(x, y, color, ms),

      // Convenience: “shatter” = shards + sparkles
      shatter3D: (x, y, opts = {}) => {
        const shards = Math.max(8, Math.min(120, opts.shards ?? 28));
        const sparks = Math.max(0, Math.min(60,  opts.sparks ?? 12));
        this._spawnShards(x, y, { count: shards });
        if (sparks > 0) this._burstEmoji(x, y, ['✨','⭐','✦'], { count: sparks, spread: 1.1, life: 680 });
      },

      // Utilities
      screenFrom3D: (camera, vec3) => this._screenFrom3D(camera, vec3),
      screenFromElementCenter: (el) => this._screenFromElementCenter(el),
      cancelAll: () => this._cancelAllFX(),
    };
  }

  /* ======================= Public lifecycle ======================= */
  dispose() {
    try { window.removeEventListener('resize', this._onResize, { passive:true }); } catch {}
    this._cancelAllFX();
    try { this.renderer?.dispose?.(); } catch {}
    if (this._ownCanvas && this.canvas?.parentNode) {
      try { this.canvas.remove(); } catch {}
    }
  }

  /* ======================= Internal helpers ======================= */
  _ensureCanvas() {
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(c);
    this._ownCanvas = true;
    return c;
  }

  _track(obj) {
    if (!obj) return;
    this._activeFX.add(obj);
    return obj;
  }
  _untrack(obj) {
    if (!obj) return;
    this._activeFX.delete(obj);
  }

  _cancelAllFX() {
    for (const o of this._activeFX) {
      try {
        if (typeof o === 'number') {
          // timeout id
          clearTimeout(o);
          cancelAnimationFrame(o); // harmless if not a RAF
        } else if (o && typeof o.off === 'function') {
          o.off(); // e.g., from cursorBurst
        } else if (o && o.nodeType === 1) {
          o.remove(); // DOM node
        } else if (o && o.__rafCtl) {
          // raf controller { __rafCtl:true, id:number, cancel:fn }
          o.cancel?.();
        }
      } catch {}
    }
    this._activeFX.clear();
  }

  /* ======================= FX: popText ======================= */
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
      opacity:0; translate:0 8px; transition:opacity .22s, translate .22s;
    `;
    el.textContent = String(text);
    document.body.appendChild(el);
    this._track(el);

    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.translate = '0 0'; });
    const hideAt = setTimeout(() => {
      el.style.opacity = '0'; el.style.translate = '0 -8px';
      const rmAt = setTimeout(() => { try { el.remove(); this._untrack(el); } catch {} }, 220);
      this._track(rmAt);
    }, this.reduceMotion ? 200 : (opts.ms ?? 720));
    this._track(hideAt);
  }

  /* ======================= FX: spawnShards ======================= */
  _spawnShards(x, y, opts = {}) {
    if (this.reduceMotion) return;
    const count = Math.max(6, Math.min(96, (opts.count|0) || 48));

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      pointer-events:none;z-index:115;perspective:800px;contain:layout style paint;
    `;
    document.body.appendChild(wrap);
    this._track(wrap);

    // One RAF controller for entire batch (avoid per-frame tracking leak)
    const rafCtl = { __rafCtl:true, id:0, cancel:()=>rafCtl.id && cancelAnimationFrame(rafCtl.id) };
    this._track(rafCtl);

    const shards = [];
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      const size = Math.random() * 10 + 6;
      const hue = 35 + Math.random() * 40; // warm hue
      s.style.cssText = `
        position:absolute;left:0;top:0;width:${size}px;height:${size * 0.6}px;border-radius:${(size*0.15)|0}px;
        background:linear-gradient(${Math.random()*180}deg, hsl(${hue} 100% 60%), hsl(${hue} 100% 50%));
        box-shadow:0 0 8px #0004; transform-style:preserve-3d; will-change:transform,opacity;
      `;
      wrap.appendChild(s);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (2 + Math.random()*2);
      const vz = (Math.random() - 0.5) * 4;

      const rx = (Math.random() - 0.5) * 2;
      const ry = (Math.random() - 0.5) * 2;
      const rz = (Math.random() - 0.5) * 2;
      const rotSpd = 2 + Math.random() * 4;

      shards.push({
        el: s,
        px:0, py:0, pz:0, t:0,
        vx, vy, vz,
        rx, ry, rz,
        rotSpd,
        start: performance.now(),
        life: 550 + Math.random() * 400,
        _t: 0
      });
    }

    const step = (now) => {
      let alive = 0;
      for (const o of shards) {
        if (!o.el) continue;
        const dt = Math.min(32, now - (o._t || now)); o._t = now; o.t += dt;
        const gy = 0.0065 * dt;
        o.px += o.vx * dt * 0.06;
        o.py += o.vy * dt * 0.06 + gy * dt;
        o.pz += o.vz * dt * 0.06;

        const r = o.rotSpd * o.t * 0.02;
        o.el.style.transform = `translate3d(${o.px}px, ${o.py}px, ${o.pz}px) rotate3d(${o.rx.toFixed(2)}, ${o.ry.toFixed(2)}, ${o.rz.toFixed(2)}, ${r.toFixed(2)}rad)`;

        const lifePct = (now - o.start) / o.life;
        o.el.style.opacity = String(1 - lifePct);

        if ((now - o.start) < o.life) {
          alive++;
        } else {
          try { o.el.remove(); o.el = null; } catch {}
        }
      }

      if (alive > 0) {
        rafCtl.id = requestAnimationFrame(step);
      } else {
        // cleanup
        const rmWrap = setTimeout(() => { try { wrap.remove(); this._untrack(wrap); } catch {} }, 60);
        this._track(rmWrap);
        this._untrack(rafCtl);
      }
    };
    rafCtl.id = requestAnimationFrame(step);
  }

  /* ======================= FX: burstEmoji ======================= */
  _burstEmoji(x, y, emojis = ['✨'], opts = {}) {
    if (this.reduceMotion) return;
    const count  = Math.max(4, Math.min(60, opts.count ?? 18));
    const spread = opts.spread ?? 1.0;
    const lifeMs = opts.life ?? 700;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      pointer-events:none;z-index:125;contain:layout style paint;
    `;
    document.body.appendChild(wrap);
    this._track(wrap);

    const rafCtl = { __rafCtl:true, id:0, cancel:()=>rafCtl.id && cancelAnimationFrame(rafCtl.id) };
    this._track(rafCtl);

    const parts = [];
    for (let i=0;i<count;i++){
      const e = document.createElement('div');
      e.textContent = emojis[(Math.random()*emojis.length)|0];
      e.style.cssText = `
        position:absolute;left:0;top:0;font-size:${12 + Math.random()*10}px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
        will-change: transform, opacity;
      `;
      wrap.appendChild(e);

      const a = Math.random()*Math.PI*2;
      const sp = (0.8 + Math.random()*1.8) * spread;
      const vx = Math.cos(a)*sp, vy = Math.sin(a)*sp - 0.6;

      parts.push({
        el: e,
        vx, vy,
        px:0, py:0,
        start: performance.now(),
        life: lifeMs,
        _t: 0
      });
    }

    const step = (now)=>{
      let alive = 0;
      for (const p of parts) {
        if (!p.el) continue;
        const t  = (now - p.start);
        const dt = Math.min(32, now - (p._t || now)); p._t = now;
        p.px += p.vx * dt * 0.6;
        p.py += p.vy * dt * 0.6 + 0.0012 * dt * dt; // gravity-ish
        const k = Math.min(1, t / 120);
        p.el.style.transform = `translate(${p.px}px, ${p.py}px) scale(${1 + 0.4*k})`;
        p.el.style.opacity = String(1 - t / p.life);
        if (t < p.life) {
          alive++;
        } else {
          try { p.el.remove(); p.el = null; } catch {}
        }
      }
      if (alive > 0) {
        rafCtl.id = requestAnimationFrame(step);
      } else {
        const rm = setTimeout(()=>{ try { wrap.remove(); this._untrack(wrap); } catch {} }, 80);
        this._track(rm);
        this._untrack(rafCtl);
      }
    };
    rafCtl.id = requestAnimationFrame(step);
  }

  /* ======================= FX: cursorBurst (helper) ======================= */
  _cursorBurst(emojis=['✨']) {
    const on = (ev)=>{
      const x = ev.clientX, y = ev.clientY;
      this._burstEmoji(x, y, emojis, { count: 12, spread: 1.2, life: 640 });
    };
    window.addEventListener('pointerdown', on, { passive:true });
    const off = () => window.removeEventListener('pointerdown', on, { passive:true });
    this._track({ off });
    return off;
  }

  /* ======================= FX: glowAt ======================= */
  _glowAt(x, y, color='rgba(0,255,200,.6)', ms=480){
    const dot = document.createElement('div');
    dot.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      width:22px;height:22px;border-radius:999px;background:radial-gradient(${color}, transparent 60%);
      filter: blur(2px); opacity:.85; pointer-events:none; z-index:124; transition:opacity .2s, transform .2s;
    `;
    document.body.appendChild(dot);
    this._track(dot);
    const t1 = setTimeout(()=>{ dot.style.opacity='.0'; dot.style.transform='translate(-50%,-50%) scale(1.4)'; }, ms-180);
    const t2 = setTimeout(()=>{ try{ dot.remove(); this._untrack(dot);}catch{} }, ms);
    this._track(t1); this._track(t2);
  }

  /* ======================= Coord utilities ======================= */
  _screenFrom3D(camera, vec3) {
    try {
      const v = vec3.clone();
      v.project(camera);
      const x = (v.x *  0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      return { x, y, z: v.z };
    } catch { return null; }
  }
  _screenFromElementCenter(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }
}
