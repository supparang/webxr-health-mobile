// === vr/particles.js — DOM burst + A-Frame fallback (safe) ===
export const Particles = {
  /**
   * burstShards(host, pos, opts)
   * - DOM mode:  ถ้า opts.screen = {x,y} หรือ pos มี x,y → แตกกระจายบนจอ (ไม่ใช้ A-Frame)
   * - 3D mode:   ใช้ A-Frame ถ้าอยาก (host หรือ #spawnHost / <a-scene>), แต่จะกัน host=null ให้เสมอ
   */
  burstShards(host, pos, opts) {
    opts = opts || {};
    const scr = opts.screen || (pos && typeof pos.x === 'number' && typeof pos.y === 'number'
                                ? { x: pos.x, y: pos.y } : null);

    // ---------- DOM MODE (ปลอดภัย, ไม่แตะ A-Frame) ----------
    if (scr) {
      const x = Math.round(scr.x), y = Math.round(scr.y);
      const theme = opts.theme || 'default';
      let color = '#8ee9a1', count = 14, dur = 560;

      if (theme === 'goodjunk')   { color = '#22c55e'; count = 16; }
      else if (theme === 'groups'){ color = '#f59e0b'; count = 14; }
      else if (theme === 'hydration'){ color = '#60a5fa'; count = 14; }
      else if (theme === 'plate'){ color = '#facc15'; count = 16; }

      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        Object.assign(p.style, {
          position: 'fixed', left: x + 'px', top: y + 'px',
          width: '6px', height: '6px', borderRadius: '999px',
          background: color, opacity: '0.96', zIndex: 999,
          transform: 'translate(-50%,-50%)', transition: 'all .55s ease',
          pointerEvents: 'none'
        });
        document.body.appendChild(p);

        const ang = Math.random() * Math.PI * 2;
        const r   = 24 + Math.random() * 28;
        const tx  = x + Math.cos(ang) * r;
        const ty  = y + Math.sin(ang) * r - 8;

        // animate
        requestAnimationFrame(() => {
          p.style.left = tx + 'px';
          p.style.top  = ty + 'px';
          p.style.opacity = '0';
        });
        setTimeout(() => { try { p.remove(); } catch {} }, dur);
      }
      return;
    }

    // ---------- 3D MODE (fallback ให้ host เสมอ) ----------
    // ถ้าผู้ใช้ยังอยากใช้กับ A-Frame อยู่
    try {
      // หา host ปลายทางที่ปลอดภัย
      let root = host;
      if (!root || !root.appendChild) {
        root = document.getElementById('spawnHost')
            || document.querySelector('a-scene')
            || document.body;
      }

      const theme = opts.theme || 'default';
      let color = '#8ee9a1', count = 10, speed = 0.8, dur = 600;
      if (theme === 'goodjunk')   { color = '#22c55e'; count = 12; }
      else if (theme === 'plate'){ color = '#facc15'; count = 14; }
      else if (theme === 'hydration'){ color = '#60a5fa'; count = 10; }
      else if (theme === 'groups'){ color = '#f472b6'; count = 16; }

      // ถ้าไม่มี A-Frame ก็เลี้ยวกลับไป DOM อีกที
      const hasAFrame = !!window.AFRAME;
      if (!hasAFrame || !root) {
        return this.burstShards(null, { x: (pos && pos.x) || (window.innerWidth/2),
                                        y: (pos && pos.y) || (window.innerHeight/2) },
                                { theme, screen: { x: (pos && pos.x) || (window.innerWidth/2),
                                                   y: (pos && pos.y) || (window.innerHeight/2) } });
      }

      for (let i = 0; i < count; i++) {
        const shard = document.createElement('a-plane');
        shard.setAttribute('width', 0.06);
        shard.setAttribute('height', 0.12);
        shard.setAttribute('material', `color:${color}; opacity:0.9; transparent:true`);
        const p = pos && pos.x != null ? pos : { x: 0, y: 1, z: -1.5 };
        shard.setAttribute('position', `${p.x} ${p.y} ${p.z || -1.5}`);

        const a = Math.random() * Math.PI * 2;
        const r = 0.25 + Math.random() * speed;
        const up = 0.10 + Math.random() * 0.40;
        const tx = (p.x || 0) + Math.cos(a) * r;
        const ty = (p.y || 1) + up;
        const tz = (p.z || -1.5) + Math.sin(a) * r;

        shard.setAttribute('animation__move', `property: position; to:${tx} ${ty} ${tz}; dur:${dur}; easing:ease-out`);
        shard.setAttribute('animation__fade', `property: material.opacity; to:0; dur:${dur}; easing:linear`);

        root.appendChild(shard);
        setTimeout(() => { try { shard.remove(); } catch {} }, dur + 80);
      }
    } catch (err) {
      // ถ้าใด ๆ พัง → ใช้ DOM fallback เสมอ
      const x = (pos && pos.x) || (window.innerWidth / 2);
      const y = (pos && pos.y) || (window.innerHeight / 2);
      this.burstShards(null, null, { screen: { x, y }, theme: opts.theme });
    }
  }
};

export default { Particles };
