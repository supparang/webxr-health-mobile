// === /herohealth/vr/hha-reticlefx.js ===
// Global Reticle FX (IIFE) — hover/fuse feedback for <a-cursor>
// ✅ โหลดก่อน scene → ไม่เจอ unknown component
// Usage: <a-cursor hha-reticlefx="hoverScale:1.25; hoverOpacity:1; idleOpacity:.7; fusePulse:1"></a-cursor>

(function () {
  'use strict';
  const A = window.AFRAME;
  if (!A || !A.registerComponent) return;
  if (A.components && A.components['hha-reticlefx']) return;

  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  A.registerComponent('hha-reticlefx', {
    schema: {
      hoverScale: { type: 'number', default: 1.25 },
      idleOpacity:{ type: 'number', default: 0.70 },
      hoverOpacity:{ type: 'number', default: 1.0 },
      fusePulse:  { type: 'number', default: 1 }
    },
    init: function () {
      this._hover = false;
      this._fusing = false;
      this._t0 = performance.now();

      const el = this.el;
      this._base = {
        scale: el.object3D.scale.clone(),
        opacity: (function(){
          try{
            const m = el.getAttribute('material') || {};
            return Number(m.opacity);
          }catch(_){ return 0.88; }
        })()
      };

      const setOpacity = (op) => {
        try{
          el.setAttribute('material', 'opacity', clamp(op, 0, 1));
        }catch(_){}
      };

      const setScaleMul = (mul) => {
        try{
          el.object3D.scale.set(
            this._base.scale.x * mul,
            this._base.scale.y * mul,
            this._base.scale.z * mul
          );
        }catch(_){}
      };

      this._applyIdle = () => {
        this._hover = false;
        this._fusing = false;
        setScaleMul(1);
        setOpacity(this.data.idleOpacity);
      };

      this._applyHover = () => {
        this._hover = true;
        setScaleMul(this.data.hoverScale);
        setOpacity(this.data.hoverOpacity);
      };

      el.addEventListener('raycaster-intersection', () => this._applyHover());
      el.addEventListener('raycaster-intersection-cleared', () => this._applyIdle());

      el.addEventListener('fusing', () => { this._fusing = true; });
      el.addEventListener('mouseleave', () => this._applyIdle());

      // start idle
      this._applyIdle();
    },
    tick: function (t) {
      if (!this._hover) return;
      if (!this.data.fusePulse) return;
      if (!this._fusing) return;

      // gentle pulse while fusing
      const phase = ((t - this._t0) / 180) % (Math.PI * 2);
      const pulse = 1 + Math.sin(phase) * 0.06;
      try{
        this.el.object3D.scale.set(
          this._base.scale.x * this.data.hoverScale * pulse,
          this._base.scale.y * this.data.hoverScale * pulse,
          this._base.scale.z * this.data.hoverScale * pulse
        );
      }catch(_){}
    }
  });
})();
