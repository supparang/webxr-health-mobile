// === /herohealth/vr/hha-reticlefx.js ===
// Reticle FX (IIFE) — hover/press feedback for <a-cursor>
// ✅ Must load after AFRAME, before scene uses component

(function (root) {
  'use strict';

  const A = root.AFRAME;
  if (!A || !A.registerComponent) return;

  if (A.components && A.components['hha-reticlefx']) return;

  function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }

  A.registerComponent('hha-reticlefx', {
    schema: {
      idleScale: { type:'number', default: 1.0 },
      hoverScale:{ type:'number', default: 1.25 },
      pressScale:{ type:'number', default: 0.85 },
      ease:      { type:'number', default: 0.22 }
    },
    init: function () {
      this.s = this.data.idleScale;
      this.t = this.data.idleScale;

      this.onEnter = () => { this.t = this.data.hoverScale; };
      this.onLeave = () => { this.t = this.data.idleScale; };
      this.onDown  = () => { this.t = this.data.pressScale; };
      this.onUp    = () => { this.t = this.data.hoverScale; };

      this.el.addEventListener('mouseenter', this.onEnter);
      this.el.addEventListener('mouseleave', this.onLeave);

      // cursor emits click; also listen pointer to feel responsive on mobile
      this.el.addEventListener('click', () => {
        this.t = this.data.pressScale;
        setTimeout(() => { this.t = this.data.hoverScale; }, 90);
      });

      root.addEventListener('pointerdown', this.onDown, { passive:true });
      root.addEventListener('pointerup', this.onUp, { passive:true });
      root.addEventListener('touchstart', this.onDown, { passive:true });
      root.addEventListener('touchend', this.onUp, { passive:true });
    },
    tick: function () {
      const e = clamp(this.data.ease, 0.05, 0.5);
      this.s += (this.t - this.s) * e;

      const g = this.el.getAttribute('geometry') || {};
      const ri = Number(g.radiusInner || 0.01);
      const ro = Number(g.radiusOuter || 0.018);

      // scale ring radii
      this.el.setAttribute('geometry', `primitive:ring; radiusInner:${(ri*this.s).toFixed(4)}; radiusOuter:${(ro*this.s).toFixed(4)}`);

      // slight opacity cue
      const mat = this.el.getAttribute('material') || {};
      const baseOp = 0.85;
      const op = clamp(baseOp + (this.s-1)*0.25, 0.55, 0.98);
      this.el.setAttribute('material', `color:${mat.color||'#fff'}; shader:flat; opacity:${op.toFixed(3)}`);
    }
  });

})(window);
