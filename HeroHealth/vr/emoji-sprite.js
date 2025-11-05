// vr/emoji-sprite.js
// สร้าง plane โปร่งใสแสดงอีโมจิจาก Canvas → Texture
AFRAME.registerComponent('emoji-sprite', {
  schema: {
    char: { default: '🍎' },
    size: { default: 0.6 },        // ขนาด plane (เมตร)
    fontSize: { default: 256 },    // px
    padding: { default: 32 }       // px
  },
  init: function () {
    const d = this.data;
    const el = this.el;

    // ----- Canvas โปร่งใส -----
    const canvas = document.createElement('canvas');
    const W = d.fontSize + d.padding * 2;
    const H = d.fontSize + d.padding * 2;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, W, H);

    // 🔧 สำคัญ: บางระบบเรนเดอร์เป็น monochrome → ถ้าไม่กำหนด fillStyle จะได้ "ดำ"
    ctx.fillStyle = '#ffffff';           // ให้เป็นขาวแทนดำ เมื่อเป็น mono
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${d.fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","NotoColorEmoji","Twemoji Mozilla",sans-serif`;
    ctx.fillText(this.data.char, W / 2, H / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(d.size, d.size);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,       // ไม่ทับ HUD
      alphaTest: 0.01          // ตัดขอบโปร่งใสนิดหน่อย
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;      // HUD ยังอยู่บนสุด

    el.setObject3D('mesh', mesh);
  },
  update: function (old) {
    if (!old || old.char !== this.data.char) { this.remove(); this.init(); }
  },
  remove: function () {
    const obj = this.el.getObject3D('mesh');
    if (obj) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
      obj.geometry.dispose();
      this.el.removeObject3D('mesh');
    }
  }
});
