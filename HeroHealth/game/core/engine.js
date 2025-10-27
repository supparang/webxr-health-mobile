// === Hero Health Academy — core/engine.js (hardened + FX utilities) ===
// มินิมอลเอนจิน: ตั้งค่า THREE renderer + helper FX (DOM-first)

export class Engine {
  constructor(THREE, canvas) {
    this.THREE = THREE || {};
    this.canvas = canvas || document.getElementById('c') || this._ensureCanvas();

    // ---------- Renderer (optional/defensive) ----------
    let renderer = null;
    try {
      const R = this.THREE.WebGLRenderer;
      if (typeof R === 'function') {
        renderer = new R({
          canvas: this.canvas,
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false
        });
        const pr = Math.min(2, window.devicePixelRatio || 1);   // cap pixelRatio เพื่อประหยัด
        renderer.setPixelRatio(pr);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
      }
    } catch {}
    this.renderer = renderer;

    // ---------- Resize ----------
    this._onResize = () => {
      try { this.renderer?.setSize(window.innerWidth, window.innerHeight, false); } catch {}
    };
    window.addEventListener('resize', this._onResize, { passive:true });

    // ---------- Motion preference ----------
    this.reduceMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;

    // ---------- Book-keeping for cleanup ----------
    this._activeFX = new Set();  // เก็บ DOM nodes/timeout/raf เพื่อ dispose ง่าย

    // ---------- FX helpers (DOM-first) ----------
    this.fx = {
      // Popข้อความกลางจอหรือพิกัด x/y ที่ส่งมา
      popText: (text, opts = {}) => this._popText(text, opts),
      // เศษแตกแบบ DOM 3D (เบาเครื่องกว่าพาร์ติเคิลใน WebGL)
      spawnShards: (x, y, opts = {}) => this._spawnShards(x, y, opts),
      // อีโมจิแตกกระจาย
      burstEmoji: (x, y, emojis = ['✨','🟡','🟠'], opts = {}) => this._burstEmoji(x, y, emojis, opts),
      // เอฟเฟกต์สั้น ๆ รอบเมาส์/ทัช (ใช้ในดีบักหรือ tutorial)
      cursorBurst: (emojis = ['✨']) => this._cursorBurst(emojis),
      // แสง/กลอว์ ณ พิกัดจอ (ใช้ย้ำ feedback จุดที่กด)
      glowAt: (x, y, color = 'rgba(0,255,200,.6)', ms = 480) => this._glowAt(x, y, color, ms),

      // Utilities พิกัด/ตำแหน่ง
      screenFrom3D: (camera, vec3) => this._screenFrom3D(camera, vec3),
      screenFromElementCenter: (el) => this._screenFromElementCenter(el),
      cancelAll: () => this._cancelAllFX()
    };
  }

  /* ======================= Public lifecycle ======================= */
  dispose() {
    try { window.removeEventListener('resize', this._onResize, { passive:true }); } catch {}
    this._cancelAllFX();
    try { this.renderer?.dispose?.(); } catch {}
  }

  /* ======================= Internal helpers ======================= */
  _ensureCanvas() {
    const c = document.createElement('canvas');
    c.id = 'c';
    c.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
    document.body.appendChild(c);
    return c;
  }

  _track(obj) {
    // รับได้ทั้ง DOM node, timeout id, requestAnimationFrame id (บันทึกเพื่อเคลียร์ภายหลัง)
    if (!obj) return;
    this._activeFX.add(obj);
    return obj;
  }
  _untrack(obj) {
    if (!obj) return;
    this._activeFX.delete(obj);
  }
  _cancelAllFX() {
    // ลบ DOM, ยกเลิก timeout/raf ทั้งหมดที่สร้างจาก engine.fx
    for (const o of this._activeFX) {
      if (typeof o === 'number') {
        // อาจเป็น timeout หรือ raf — ลองทั้งคู่แบบปลอดภัย
        try { cancelAnimationFrame(o); } catch {}
        try { clearTimeout(o); } catch {}
      } else if (o && o.nodeType === 1) {
        try { o.remove(); } catch {}
      } else if (o && o.type === 'raf') {
        try { cancelAnimationFrame(o.id); } catch {}
      }
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

    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      const size = Math.random() * 10 + 6;
      const hue = 35 + Math.random() * 40; // โทนส้มเหลือง
      s.style.cssText = `
        position:absolute;left:0;top:0;width:${size}px;height:${size * 0.6}px;border-radius:${(size*0.15)|0}px;
        background:linear-gradient(${Math.random()*180}deg, hsl(${hue} 100% 60%), hsl(${hue} 100% 50%));
        box-shadow:0 0 8px #0004; transform-style:preserve-3d; will-change:transform,opacity;
      `;
      wrap.appendChild(s);

      // ฟิสิกส์ง่าย ๆ
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (2 + Math.random()*2);
      const vz = (Math.random() - 0.5) * 4;

      const rx = (Math.random() - 0.5) * 2;
      const ry = (Math.random() - 0.5) * 2;
      const rz = (Math.random() - 0.5) * 2;
      const rotSpd = 2 + Math.random() * 4;

      let px = 0, py = 0, pz = 0, t = 0;
      const life = 550 + Math.random() * 400;
      const start = performance.now();

      const step = (now) => {
        const dt = Math.min(32, now - (s._t || now)); s._t = now; t += dt;
        const gy = 0.0065 * dt; // gravity
        px += vx * dt * 0.06;
        py += vy * dt * 0.06 + gy * dt;
        pz += vz * dt * 0.06;

        const r = rotSpd * t * 0.02;
        s.style.transform = `translate3d(${px}px, ${py}px, ${pz}px) rotate3d(${rx.toFixed(2)}, ${ry.toFixed(2)}, ${rz.toFixed(2)}, ${r.toFixed(2)}rad)`;

        const lifePct = (now - start) / life;
        s.style.opacity = String(1 - lifePct);

        if (now - start < life) {
          s._raf = requestAnimationFrame(step);
          this._track({ type:'raf', id:s._raf });
        } else {
          try { s.remove(); } catch {}
        }
      };
      s._raf = requestAnimationFrame(step);
      this._track({ type:'raf', id:s._raf });
    }

    const rmWrap = setTimeout(() => { try { wrap.remove(); this._untrack(wrap); } catch {} }, 1200);
    this._track(rmWrap);
  }

  /* ======================= FX: burstEmoji ======================= */
  _burstEmoji(x, y, emojis = ['✨'], opts = {}) {
    if (this.reduceMotion) return;
    const count = Math.max(4, Math.min(60, opts.count ?? 18));
    const spread = opts.spread ?? 1.0;
    const lifeMs = opts.life ?? 700;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      pointer-events:none;z-index:125;contain:layout style paint;
    `;
    document.body.appendChild(wrap);
    this._track(wrap);

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

      let px=0, py=0; const start = performance.now();
      const tick = (now)=>{
        const t = (now - start);
        const dt = Math.min(32, now - (e._t || now)); e._t = now;
        px += vx * dt * 0.6;
        py += vy * dt * 0.6 + 0.0012 * dt * dt; // gravity-ish
        const k = Math.min(1, t / 120);
        e.style.transform = `translate(${px}px, ${py}px) scale(${1 + 0.4*k})`;
        e.style.opacity = String(1 - t / lifeMs);
        if (t < lifeMs) {
          e._raf = requestAnimationFrame(tick);
          this._track({ type:'raf', id:e._raf });
        } else { try { e.remove(); } catch {} }
      };
      e._raf = requestAnimationFrame(tick);
      this._track({ type:'raf', id:e._raf });
    }
    const rm = setTimeout(()=>{ try { wrap.remove(); this._untrack(wrap); } catch {} }, lifeMs+180);
    this._track(rm);
  }

  /* ======================= FX: cursorBurst (helper) ======================= */
  _cursorBurst(emojis=['✨']) {
    const on = (ev)=>{
      const x = ev.clientX, y = ev.clientY;
      this._burstEmoji(x, y, emojis, { count: 12, spread: 1.2, life: 640 });
    };
    window.addEventListener('pointerdown', on, { passive:true });
    // คืนฟังก์ชันยกเลิก
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
      // THREE Vector3 ที่ถูก world->NDC แล้ว
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
    // ใช้คู่กับ fx.popText / spawnShards / burstEmoji ได้
  }
}
