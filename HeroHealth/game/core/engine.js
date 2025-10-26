// core/engine.js
// มินิมอลเอนจิน: ตั้งค่า THREE renderer + helper FX (DOM-based) สำหรับ popText / 3D shards

export class Engine {
  constructor(THREE, canvas) {
    this.THREE = THREE;
    this.canvas = canvas || document.getElementById('c');

    // Renderer (ไม่บังคับต้องใช้ scene/camera เพราะเกมเป็น DOM-first)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false
    });
    try {
      this.renderer.setPixelRatio(window.devicePixelRatio || 1);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    } catch {}

    window.addEventListener('resize', () => {
      try { this.renderer.setSize(window.innerWidth, window.innerHeight); } catch {}
    }, { passive: true });

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- FX helpers (DOM) ----
    this.fx = {
      // ใช้แทนการ popup แบบดิบในโหมด (รองรับทั้งที่ mode/main เรียก)
      popText: (text, opts = {}) => {
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
        requestAnimationFrame(() => { el.style.opacity = '1'; el.style.translate = '0 0'; });
        setTimeout(() => { el.style.opacity = '0'; el.style.translate = '0 -8px'; setTimeout(() => { try { el.remove(); } catch {} }, 220); }, reduceMotion ? 200 : 720);
      },

      // เอฟเฟกต์ "แตกเศษ 3D" แบบ DOM (เบาเครื่อง) — ใช้ perspective + rotate3d + gravity
      spawnShards: (x, y, opts = {}) => {
        if (reduceMotion) return;
        const count = Math.max(6, Math.min(96, (opts.count|0) || 48));
        const wrap = document.createElement('div');
        wrap.style.cssText = `
          position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
          pointer-events:none;z-index:115;perspective:800px;contain:layout style paint;
        `;
        document.body.appendChild(wrap);

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

          // ค่าฟิสิกส์แบบง่าย
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 5;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed - (2 + Math.random()*2);
          const vz = (Math.random() - 0.5) * 4;

          const rx = (Math.random() - 0.5) * 2;
          const ry = (Math.random() - 0.5) * 2;
          const rz = (Math.random() - 0.5) * 2;
          const rotSpd = 2 + Math.random() * 4;

          let px = 0, py = 0, pz = 0, t = 0, life = 550 + Math.random() * 400;
          const start = performance.now();

          const step = (now) => {
            const dt = Math.min(32, now - (s._t || now)); s._t = now; t += dt;
            // gravity
            const gy = 0.0065 * dt;
            px += vx * dt * 0.06;
            py += vy * dt * 0.06 + gy * dt;
            pz += vz * dt * 0.06;

            const r = rotSpd * t * 0.02;
            s.style.transform =
              `translate3d(${px}px, ${py}px, ${pz}px) rotate3d(${rx.toFixed(2)}, ${ry.toFixed(2)}, ${rz.toFixed(2)}, ${r.toFixed(2)}rad)`;

            // fade out
            const lifePct = (now - start) / life;
            s.style.opacity = String(1 - lifePct);

            if (now - start < life) {
              s._af = requestAnimationFrame(step);
            } else {
              try { s.remove(); } catch {}
            }
          };
          s._af = requestAnimationFrame(step);
        }

        // ล้าง wrapper
        setTimeout(() => { try { wrap.remove(); } catch {} }, 1200);
      }
    };
  }
}
