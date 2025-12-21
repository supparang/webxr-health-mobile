// === /herohealth/vr/hha-reticlefx.js ===
// Global reticle hover/fuse feedback for <a-cursor>
// ต้องเป็น global เพื่อเลี่ยง “unknown component” ตอน A-Frame init

(function () {
  'use strict';
  const A = window.AFRAME;
  if (!A || !A.registerComponent) return;
  if (A.components && A.components['hha-reticlefx']) return;

  A.registerComponent('hha-reticlefx', {
    schema: {
      on: { default: true },
      pulse: { default: true },
      hoverScale: { default: 1.15 },
      fuseGlow: { default: true }
    },
    init: function () {
      this._baseScale = this.el.object3D.scale.clone();
      this._hovering = false;
      this._fusing = false;
      this._t = 0;

      const setScale = (k) => {
        try {
          const s = this._baseScale;
          this.el.object3D.scale.set(s.x * k, s.y * k, s.z * k);
        } catch (_) {}
      };

      const setOpacity = (op) => {
        try {
          const mesh = this.el.getObject3D('mesh');
          if (!mesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (!m) continue;
            m.transparent = true;
            m.opacity = Math.max(0.15, Math.min(1, op));
            m.needsUpdate = true;
          }
        } catch (_) {}
      };

      this._setScale = setScale;
      this._setOpacity = setOpacity;

      this.el.addEventListener('mouseenter', () => {
        this._hovering = true;
        setScale(this.data.hoverScale);
        setOpacity(1.0);
      });

      this.el.addEventListener('mouseleave', () => {
        this._hovering = false;
        this._fusing = false;
        setScale(1.0);
        setOpacity(0.85);
      });

      this.el.addEventListener('fusing', () => {
        this._fusing = true;
        if (this.data.fuseGlow) setOpacity(1.0);
      });

      this.el.addEventListener('click', () => {
        // click pulse
        setScale(this.data.hoverScale + 0.15);
        setOpacity(1.0);
        setTimeout(() => {
          if (!this._hovering) setScale(1.0);
        }, 90);
      });

      setOpacity(0.85);
      setScale(1.0);
    },
    tick: function (t, dt) {
      if (!this.data.on) return;
      if (!this.data.pulse) return;
      if (!this._hovering && !this._fusing) return;

      this._t += (dt || 16);
      const k = 1 + 0.04 * Math.sin(this._t / 120);
      try { this._setScale((this._hovering ? this.data.hoverScale : 1.0) * k); } catch (_) {}
    }
  });
})();
