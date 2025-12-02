// === /vr-goodjunk/touch-look-goodjunk.js ===
// Drag-to-look สำหรับมือถือ/เครื่องที่ไม่มี gyro
// ใช้กับ <a-entity camera ... touch-look-goodjunk></a-entity>

AFRAME.registerComponent('touch-look-goodjunk', {
  schema: {
    enabled:     { default: true },
    sensitivity: { default: 0.003 } // ยิ่งมาก = หมุนเร็ว
  },

  init: function () {
    this.yaw   = 0;
    this.pitch = 0;

    this.dragging   = false;
    this.touchId    = null;
    this.lastX      = 0;
    this.lastY      = 0;

    // bind this
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp   = this.onMouseUp.bind(this);

    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove  = this.onTouchMove.bind(this);
    this.onTouchEnd   = this.onTouchEnd.bind(this);

    const scene = this.el.sceneEl;
    const canvas = scene && scene.canvas;

    // ถ้า canvas พร้อมแล้วก็ผูก event เลย ไม่งั้นรอ 'loaded'
    if (canvas) {
      this.addListeners(canvas);
    } else if (scene) {
      scene.addEventListener('render-target-loaded', () => {
        if (scene.canvas) this.addListeners(scene.canvas);
      });
    }
  },

  addListeners: function (canvas) {
    this.canvas = canvas;

    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchEnd);
  },

  remove: function () {
    if (!this.canvas) return;

    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
  },

  // -------- Mouse --------
  onMouseDown: function (e) {
    if (!this.data.enabled) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  },

  onMouseMove: function (e) {
    if (!this.dragging || !this.data.enabled) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.applyDelta(dx, dy);
  },

  onMouseUp: function () {
    this.dragging = false;
  },

  // -------- Touch --------
  onTouchStart: function (e) {
    if (!this.data.enabled) return;
    if (e.touches.length > 1) return; // ใช้นิ้วเดียวพอ
    const t = e.touches[0];
    this.dragging = true;
    this.touchId = t.identifier;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    e.preventDefault(); // กัน scroll หน้าเว็บ
  },

  onTouchMove: function (e) {
    if (!this.dragging || !this.data.enabled) return;

    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.touchId) {
        t = e.touches[i];
        break;
      }
    }
    if (!t) return;

    const dx = t.clientX - this.lastX;
    const dy = t.clientY - this.lastY;
    this.lastX = t.clientX;
    this.lastY = t.clientY;
    this.applyDelta(dx, dy);
    e.preventDefault();
  },

  onTouchEnd: function (e) {
    this.dragging = false;
    this.touchId = null;
  },

  // -------- Core rotation logic --------
  applyDelta: function (dx, dy) {
    const s = this.data.sensitivity;

    // หมุนซ้าย/ขวา → yaw
    this.yaw   -= dx * s;
    // ก้ม/เงย → pitch
    this.pitch -= dy * s;

    // จำกัด pitch ไม่ให้หมุนหงายหลัง
    const maxPitch = Math.PI / 2 - 0.1;
    if (this.pitch >  maxPitch) this.pitch =  maxPitch;
    if (this.pitch < -maxPitch) this.pitch = -maxPitch;

    const rot = this.el.object3D.rotation;
    rot.y = this.yaw;
    rot.x = this.pitch;
  }
});
