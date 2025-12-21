// === /herohealth/vr/hha-vrlook.js ===
// Global VR-like look controls:
// - drag-to-look (mouse/touch)
// - deviceorientation-to-look (mobile gyro)
// - light inertia smoothing
// - auto iOS permission helper via custom event `hha:request-motion`
//
// In VR mode (WebXR), component stops writing rotation.

(function () {
  'use strict';
  const A = window.AFRAME;
  const THREE = window.THREE;
  if (!A || !A.registerComponent || !THREE) return;
  if (A.components && A.components['hha-vrlook']) return;

  // --- iOS permission helper (callable from game code) ---
  async function requestMotionPermission() {
    let ok = true;
    try {
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const res = await window.DeviceOrientationEvent.requestPermission();
        ok = ok && (res === 'granted');
      }
    } catch (_) { ok = false; }
    try {
      if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function') {
        const res = await window.DeviceMotionEvent.requestPermission();
        ok = ok && (res === 'granted');
      }
    } catch (_) {}
    return !!ok;
  }

  window.addEventListener('hha:request-motion', async () => {
    try { await requestMotionPermission(); } catch (_) {}
  });

  // --- Gyro conversion (based on three.js DeviceOrientationControls idea) ---
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around X

  function setObjectQuaternion(quat, alpha, beta, gamma, orient) {
    // alpha, beta, gamma are radians
    euler.set(beta, alpha, -gamma, 'YXZ');
    quat.setFromEuler(euler);
    quat.multiply(q1);
    quat.multiply(q0.setFromAxisAngle(zee, -orient));
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  A.registerComponent('hha-vrlook', {
    schema: {
      enabled: { default: true },
      inertia: { default: 0.14 },        // 0..1 (higher = smoother)
      gyroBlend: { default: 0.92 },      // 0..1 (how much gyro drives target when not dragging)
      pitchLimit: { default: 1.30 }      // radians
    },
    init: function () {
      this._yaw = 0;
      this._pitch = 0;
      this._yawT = 0;
      this._pitchT = 0;

      this._dragging = false;
      this._lastX = 0;
      this._lastY = 0;

      this._gyroAlpha = null;
      this._gyroBeta = null;
      this._gyroGamma = null;
      this._screenOrient = 0;

      this._gyroQuat = new THREE.Quaternion();
      this._gyroEuler = new THREE.Euler(0,0,0,'YXZ');

      this._scene = this.el.sceneEl;

      // prevent browser scroll gestures over canvas
      const sc = this._scene;
      const bindCanvas = () => {
        const c = sc && sc.canvas;
        if (!c) return;
        c.style.touchAction = 'none';
      };
      if (sc && sc.hasLoaded) bindCanvas();
      else sc.addEventListener('loaded', bindCanvas, { once:true });

      // drag handlers
      const onDown = (ev) => {
        if (!this.data.enabled) return;
        if (this._scene && this._scene.is && this._scene.is('vr-mode')) return;
        const t = ev.target;
        if (t && t.closest && t.closest('.btn, #resultBackdrop')) return;

        this._dragging = true;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        this._lastX = p.clientX;
        this._lastY = p.clientY;
      };

      const onMove = (ev) => {
        if (!this._dragging) return;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const dx = (p.clientX - this._lastX);
        const dy = (p.clientY - this._lastY);
        this._lastX = p.clientX;
        this._lastY = p.clientY;

        // sensitivity tuned for mobile
        const s = 0.0040;
        this._yawT   -= dx * s;
        this._pitchT -= dy * s;
        this._pitchT = clamp(this._pitchT, -this.data.pitchLimit, this.data.pitchLimit);
      };

      const onUp = () => { this._dragging = false; };

      window.addEventListener('pointerdown', onDown, { passive:true });
      window.addEventListener('pointermove', onMove, { passive:true });
      window.addEventListener('pointerup', onUp, { passive:true });
      window.addEventListener('pointercancel', onUp, { passive:true });

      window.addEventListener('touchstart', onDown, { passive:true });
      window.addEventListener('touchmove', onMove, { passive:true });
      window.addEventListener('touchend', onUp, { passive:true });
      window.addEventListener('touchcancel', onUp, { passive:true });

      // gyro listeners
      const onOrient = (e) => {
        if (!e) return;
        // degrees
        this._gyroAlpha = (e.alpha != null) ? THREE.MathUtils.degToRad(e.alpha) : null;
        this._gyroBeta  = (e.beta  != null) ? THREE.MathUtils.degToRad(e.beta)  : null;
        this._gyroGamma = (e.gamma != null) ? THREE.MathUtils.degToRad(e.gamma) : null;
      };
      window.addEventListener('deviceorientation', onOrient, true);

      const onScreen = () => {
        const o = (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number')
          ? window.screen.orientation.angle
          : (typeof window.orientation === 'number' ? window.orientation : 0);
        this._screenOrient = THREE.MathUtils.degToRad(o || 0);
      };
      window.addEventListener('orientationchange', onScreen, true);
      if (window.screen && window.screen.orientation) window.screen.orientation.addEventListener('change', onScreen);
      onScreen();

      // init yaw/pitch from current rotation
      try {
        const r = this.el.object3D.rotation;
        this._yaw = r.y || 0;
        this._pitch = r.x || 0;
        this._yawT = this._yaw;
        this._pitchT = this._pitch;
      } catch (_) {}
    },
    tick: function () {
      if (!this.data.enabled) return;
      const sc = this._scene;
      if (sc && sc.is && sc.is('vr-mode')) return; // do not override WebXR

      // gyro -> target (when available)
      if (this._gyroAlpha != null && this._gyroBeta != null && this._gyroGamma != null) {
        setObjectQuaternion(this._gyroQuat, this._gyroAlpha, this._gyroBeta, this._gyroGamma, this._screenOrient);
        this._gyroEuler.setFromQuaternion(this._gyroQuat, 'YXZ');

        // map to yaw/pitch (YXZ)
        const gy = this._gyroEuler.y;
        const gp = this._gyroEuler.x;

        if (!this._dragging) {
          const b = clamp(this.data.gyroBlend, 0, 1);
          // blend gyro into target
          this._yawT = this._yawT * (1 - b) + gy * b;
          this._pitchT = this._pitchT * (1 - b) + gp * b;
          this._pitchT = clamp(this._pitchT, -this.data.pitchLimit, this.data.pitchLimit);
        }
      }

      // inertia smoothing
      const a = clamp(this.data.inertia, 0.01, 0.35);
      this._yaw   = this._yaw   + (this._yawT   - this._yaw)   * a;
      this._pitch = this._pitch + (this._pitchT - this._pitch) * a;

      // apply
      try {
        this.el.object3D.rotation.set(this._pitch, this._yaw, 0, 'YXZ');
      } catch (_) {}
    }
  });
})();
