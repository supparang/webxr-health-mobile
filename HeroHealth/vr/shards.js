// === vr/shards.js (2025-11-06) ===
// Lightweight shard/confetti burst for A-Frame (no direct THREE usage)
// API:
//   SHARDS.setMode('goodjunk'|'groups'|'hydration'|'plate')
//   SHARDS.attach(sceneEl?)    // optional; auto-attaches to <a-scene> on first burst
//   SHARDS.burst(worldPos, { color, palette, count, speed, size, life, gravity })
//
// worldPos: {x,y,z} in scene/world coordinates

const MODE_PALETTES = {
  goodjunk : ['#22c55e','#16a34a','#86efac','#bbf7d0','#0ea5e9'],
  groups   : ['#f59e0b','#84cc16','#22c55e','#a855f7','#06b6d4'],
  hydration: ['#60a5fa','#38bdf8','#0ea5e9','#22d3ee','#93c5fd'],
  plate    : ['#ef4444','#f59e0b','#22c55e','#3b82f6','#eab308'],
  default  : ['#a3a3a3','#d4d4d4','#737373','#f5f5f5']
};

class ShardSystem {
  constructor() {
    this.scene = null;
    this.root  = null;
    this.mode  = 'default';
    this.pool  = [];
    this.active = [];
    this.maxPool = 180;           // total shards pooled
    this.running = false;
    this._last = performance.now();

    // physics defaults
    this.defaultLife = 900;       // ms
    this.defaultGravity = -2.2;   // m/s^2 (down)
  }

  setMode(mode) {
    this.mode = MODE_PALETTES[mode] ? mode : 'default';
  }

  attach(sceneEl) {
    if (this.root && this.scene) return;
    this.scene = sceneEl || document.querySelector('a-scene');
    if (!this.scene) return;

    // root container
    const root = document.createElement('a-entity');
    root.id = 'shardRoot';
    this.scene.appendChild(root);
    this.root = root;

    // build pool
    for (let i = 0; i < this.maxPool; i++) {
      const p = document.createElement('a-entity');
      // small plane shard
      p.setAttribute('geometry', 'primitive: plane; width: 0.06; height: 0.02');
      p.setAttribute('material', 'color: #fff; transparent: true; opacity: 0; side: double');
      p.setAttribute('visible', false);
      // state bag
      p.__vx = 0; p.__vy = 0; p.__vz = 0;
      p.__ax = 0; p.__ay = 0; p.__az = 0;
      p.__life = 0; p.__age = 0;
      p.__spin = (Math.random() * 240 - 120); // deg/s around Z
      this.root.appendChild(p);
      this.pool.push(p);
    }

    if (!this.running) {
      this.running = true;
      this._last = performance.now();
      this._loop();
    }
  }

  burst(worldPos, opts = {}) {
    if (!this.root) this.attach();         // lazy attach
    if (!this.root) return;                // scene not ready yet

    const pal = Array.isArray(opts.palette) ? opts.palette
              : MODE_PALETTES[this.mode] || MODE_PALETTES.default;

    const count  = Math.max(4, Math.min(48, Math.floor(opts.count ?? 18)));
    const speed  = Number.isFinite(opts.speed) ? opts.speed : 2.0;      // m/s base
    const size   = Number.isFinite(opts.size) ? opts.size : 1.0;        // scale multiplier
    const life   = Math.max(300, Math.floor(opts.life ?? this.defaultLife));
    const gravity= Number.isFinite(opts.gravity) ? opts.gravity : this.defaultGravity;
    const colorOverride = opts.color || null;

    for (let i = 0; i < count; i++) {
      const shard = this._get();
      if (!shard) break;

      // random direction (forward cone + outward)
      const ang = Math.random() * Math.PI * 2;
      const upBias = 0.6 + Math.random() * 0.6;   // push upward a bit
      const spd = speed * (0.7 + Math.random() * 0.9);

      shard.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
      shard.setAttribute('rotation', `0 0 ${Math.floor(Math.random()*360)}`);

      // velocity
      shard.__vx = Math.cos(ang) * spd * 0.6;
      shard.__vz = Math.sin(ang) * spd * 0.6;
      shard.__vy = upBias * spd;

      // acceleration (gravity only)
      shard.__ax = 0;
      shard.__ay = gravity;
      shard.__az = 0;

      // lifetime/appearance
      shard.__life = life * (0.85 + Math.random()*0.3);
      shard.__age  = 0;

      // size & color
      const w = 0.06 * size * (0.7 + Math.random()*1.1);
      const h = 0.02 * size * (0.7 + Math.random()*1.1);
      shard.setAttribute('geometry', `primitive: plane; width: ${w}; height: ${h}`);
      const col = colorOverride || pal[(Math.random()*pal.length)|0];
      shard.setAttribute('material', `color: ${col}; transparent: true; opacity: 1; side: double`);

      shard.style.willChange = 'transform, opacity';
      shard.setAttribute('visible', true);

      // enlist
      this.active.push(shard);
    }
  }

  // ------- internals -------
  _get() {
    // try pool first
    for (let i = 0; i < this.pool.length; i++) {
      const el = this.pool[i];
      if (!el.__busy) {
        el.__busy = true;
        return el;
      }
    }
    // try steal from oldest active
    if (this.active.length) {
      const el = this.active.shift();
      el.__busy = true;
      return el;
    }
    return null;
  }

  _free(el) {
    el.__busy = false;
    el.setAttribute('visible', false);
    // opacity back to 0 for safety
    try {
      const mat = el.getAttribute('material') || {};
      el.setAttribute('material', `color:${mat.color||'#fff'}; transparent:true; opacity:0; side:double`);
    } catch {}
  }

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(64, Math.max(0, now - this._last)) / 1000; // clamp dt
    this._last = now;

    if (this.active.length) {
      const keep = [];
      for (let i = 0; i < this.active.length; i++) {
        const el = this.active[i];
        el.__age += dt * 1000;

        // physics
        el.__vx += el.__ax * dt;
        el.__vy += el.__ay * dt;
        el.__vz += el.__az * dt;

        const p = el.object3D.position;
        p.x += el.__vx * dt;
        p.y += el.__vy * dt;
        p.z += el.__vz * dt;

        // spin around Z
        const rot = el.getAttribute('rotation');
        const z = (rot?.z || 0) + el.__spin * dt;
        el.setAttribute('rotation', `0 0 ${z}`);

        // fade
        const t = Math.max(0, 1 - (el.__age / el.__life));
        const alpha = (t < 0.25) ? t * 4 * 0.6 : 0.6; // keep bright then fade
        try {
          const mat = el.getAttribute('material') || {};
          el.setAttribute('material', `color:${mat.color||'#fff'}; transparent:true; opacity:${alpha.toFixed(3)}; side:double`);
        } catch {}

        // deactivate when time’s up / too far below
        if (el.__age >= el.__life || p.y < -5) {
          this._free(el);
        } else {
          keep.push(el);
        }
      }
      this.active = keep;
    }

    requestAnimationFrame(this._loop.bind(this));
  }
}

// singleton + global
export const SHARDS = new ShardSystem();
if (typeof window !== 'undefined') window.SHARDS = SHARDS;
export default SHARDS;
