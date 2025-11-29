(function (global) {
  'use strict';
  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  const MODE_PALETTES = {
    goodjunk : ['#22c55e','#16a34a','#86efac','#bbf7d0','#0ea5e9'],
    groups   : ['#f59e0b','#84cc16','#22c55e','#a855f7','#06b6d4'],
    hydration: ['#60a5fa','#38bdf8','#0ea5e9','#22d3ee','#93c5fd'],
    plate    : ['#ef4444','#f59e0b','#22c55e','#3b82f6','#eab308'],
    default  : ['#a3a3a3','#d4d4d4','#737373','#f5f5f5']
  };

  const now = () => performance.now();

  class ShardSystem {
    constructor() {
      this.scene = null;
      this.root = null;
      this.mode = 'default';
      this.pool = [];
      this.active = [];
      this.maxPool = 180;
      this.running = false;
      this._last = now();
      this.defaultLife = 900;
      this.defaultGravity = -2.2;
    }
    setMode(mode) { this.mode = MODE_PALETTES[mode] ? mode : 'default'; }
    attach(sceneEl) {
      if (this.root && this.scene) return;
      this.scene = sceneEl || document.querySelector('a-scene');
      if (!this.scene) return;
      const root = document.createElement('a-entity');
      root.id = 'shardRoot';
      root.setAttribute('data-hha-ui', '1');
      this.scene.appendChild(root);
      this.root = root;
      for (let i = 0; i < this.maxPool; i++) {
        const p = document.createElement('a-entity');
        p.setAttribute('geometry', 'primitive: plane; width:0.06; height:0.02');
        p.setAttribute('material', 'color:#fff; transparent:true; opacity:0; side:double');
        p.setAttribute('visible', false);
        p.__vx = p.__vy = p.__vz = 0;
        p.__ax = p.__ay = p.__az = 0;
        p.__life = p.__age = 0;
        p.__spin = (Math.random() * 240 - 120);
        p.__busy = false;
        root.appendChild(p);
        this.pool.push(p);
      }
      if (!this.running) {
        this.running = true;
        this._last = now();
        this._loop();
      }
    }
    _get() {
      for (let i = 0; i < this.pool.length; i++) {
        const el = this.pool[i];
        if (!el.__busy) { el.__busy = true; return el; }
      }
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
      try {
        const m = el.getAttribute('material') || {};
        el.setAttribute('material',
          `color:${m.color || '#fff'}; transparent:true; opacity:0; side:double`);
      } catch { }
    }
    burst(worldPos, opts = {}) {
      if (!this.root) this.attach();
      if (!this.root || !worldPos) return;
      const pal = Array.isArray(opts.palette) ? opts.palette : (MODE_PALETTES[this.mode] || MODE_PALETTES.default);
      const count = Math.max(4, Math.min(48, Math.floor(opts.count == null ? 18 : opts.count)));
      const speed = Number.isFinite(opts.speed) ? opts.speed : 2.0;
      const size  = Number.isFinite(opts.size)  ? opts.size  : 1.0;
      const life  = Math.max(300, Math.floor(opts.life == null ? this.defaultLife : opts.life));
      const grav  = Number.isFinite(opts.gravity) ? opts.gravity : this.defaultGravity;
      const override = opts.color || null;

      for (let i = 0; i < count; i++) {
        const shard = this._get();
        if (!shard) break;
        const ang = Math.random() * Math.PI * 2;
        const up = 0.6 + Math.random() * 0.6;
        const sp = speed * (0.7 + Math.random() * 0.9);
        shard.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
        shard.setAttribute('rotation', `0 0 ${Math.floor(Math.random() * 360)}`);
        shard.__vx = Math.cos(ang) * sp * 0.6;
        shard.__vz = Math.sin(ang) * sp * 0.6;
        shard.__vy = up * sp;
        shard.__ax = 0;
        shard.__ay = grav;
        shard.__az = 0;
        shard.__life = life * (0.85 + Math.random() * 0.3);
        shard.__age = 0;
        const w = 0.06 * size * (0.7 + Math.random() * 1.1);
        const h = 0.02 * size * (0.7 + Math.random() * 1.1);
        shard.setAttribute('geometry', `primitive: plane; width:${w}; height:${h}`);
        const col = override || pal[(Math.random() * pal.length) | 0];
        shard.setAttribute('material', `color:${col}; transparent:true; opacity:1; side:double`);
        shard.setAttribute('visible', true);
        this.active.push(shard);
      }
    }
    _loop() {
      if (!this.running) return;
      const t = now();
      const dt = Math.min(64, Math.max(0, t - this._last)) / 1000;
      this._last = t;

      if (this.active.length) {
        const keep = [];
        for (let i = 0; i < this.active.length; i++) {
          const el = this.active[i];
          el.__age += dt * 1000;
          el.__vx += el.__ax * dt;
          el.__vy += el.__ay * dt;
          el.__vz += el.__az * dt;
          if (el.object3D) {
            const p = el.object3D.position;
            p.x += el.__vx * dt;
            p.y += el.__vy * dt;
            p.z += el.__vz * dt;
            const rot = el.getAttribute('rotation');
            const z = (rot && rot.z ? rot.z : 0) + el.__spin * dt;
            el.setAttribute('rotation', `0 0 ${z}`);
            const fadeT = Math.max(0, 1 - (el.__age / el.__life));
            const alpha = (fadeT < 0.25) ? fadeT * 4 * 0.6 : 0.6;
            try {
              const m = el.getAttribute('material') || {};
              el.setAttribute('material',
                `color:${m.color || '#fff'}; transparent:true; opacity:${alpha.toFixed(3)}; side:double`);
            } catch { }
            if (el.__age >= el.__life || p.y < -5) this._free(el); else keep.push(el);
          }
        }
        this.active = keep;
      }
      requestAnimationFrame(this._loop.bind(this));
    }
  }

  const SHARDS = new ShardSystem();
  exports.SHARDS = SHARDS;
  if (typeof window !== 'undefined') window.SHARDS = SHARDS;

  exports.setShardMode = function (mode) {
    SHARDS.setMode(mode);
  };

  exports.burstAt = function (sceneEl, worldPos, opts = {}) {
    if (!SHARDS.root) SHARDS.attach(sceneEl);
    if (opts && opts.mode) SHARDS.setMode(opts.mode);
    SHARDS.burst(worldPos, opts);
  };

  exports.floatScore = function (sceneEl, worldPos, text = '+10', color = '#ffffff') {
    const scene = sceneEl || document.querySelector('a-scene');
    if (!scene || !worldPos) return;
    const A = window.AFRAME;
    const hasTroika = !!(A && A.components && A.components['troika-text']);
    const el = document.createElement('a-entity');
    if (hasTroika)
      el.setAttribute('troika-text', `value:${text}; color:${color}; fontSize:0.10;`);
    else
      el.setAttribute('text', `value:${text}; color:${color}; align:center; width:2.2`);
    el.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
    const y2 = (worldPos.y + 0.35).toFixed(3);
    el.setAttribute('animation__rise',
      `property: position; to: ${worldPos.x} ${y2} ${worldPos.z}; dur:520; easing:easeOutQuad`);
    el.setAttribute('animation__fade',
      'property: opacity; to: 0; dur:520; easing:linear');
    scene.appendChild(el);
    setTimeout(() => {
      try { scene.removeChild(el); } catch { }
    }, 560);
  };

})(window);
